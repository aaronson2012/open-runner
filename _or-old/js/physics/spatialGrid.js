// js/physics/spatialGrid.js
import * as THREE from 'three'; // Re-enabled THREE import
import { createLogger } from '../utils/logger.js'; // Import logger

const logger = createLogger('SpatialGrid'); // Instantiate logger

/**
 * A simple 2D spatial grid for optimizing collision detection.
 * Stores object references (like meshes) in grid cells based on their XZ position.
 */
export class SpatialGrid {
    /**
     * @param {number} cellSize The width and depth of each grid cell.
     */
    constructor(cellSize) {
        if (!cellSize || cellSize <= 0) {
            throw new Error("SpatialGrid requires a positive cellSize.");
        }
        this.cellSize = cellSize;
        // Use a Map where key is "gridX,gridZ" and value is a Set of object references
        this.grid = new Map();
        this.objectCellMap = new Map(); // Map objectRef.id -> cellKey
    }

    /**
     * Calculates the grid cell coordinates for a given world position.
     * @param {{x: number, z: number}} position World position (only x and z are used).
     * @returns {{gridX: number, gridZ: number}} The integer grid coordinates.
     */
    _getGridCoords(position) {
        const gridX = Math.floor(position.x / this.cellSize);
        const gridZ = Math.floor(position.z / this.cellSize);
        return { gridX, gridZ };
    }

    /**
     * Generates the string key for a grid cell.
     * @param {number} gridX
     * @param {number} gridZ
     * @returns {string} The cell key "gridX,gridZ".
     */
    _getCellKey(gridX, gridZ) {
        return `${gridX},${gridZ}`;
    }

    /**
     * Adds an object reference to the grid cell corresponding to its position.
     * Note: This simple version adds to only one cell based on the object's origin. (Limitation: Large objects near cell boundaries might miss collisions).
     * A more robust version might add to multiple cells if the object spans boundaries.
     * @param {any} objectRef The object reference to store (e.g., THREE.Mesh). Requires objectRef.position.
     * @param {string} [cellKey=null] Optional: Pre-calculated cell key to avoid recalculation.
     * @returns {boolean} True if the object was successfully added, false otherwise.
     */
    add(objectRef, cellKey = null) {
        if (!objectRef) {
            logger.warn('SpatialGrid.add: Attempted to add null or undefined object');
            return false;
        }

        if (!objectRef.position) {
            logger.warn('SpatialGrid.add: Object has no position property');
            return false;
        }

        // Calculate the cell key if not provided
        let key;
        if (cellKey) {
            key = cellKey;
        } else {
            const coords = this._getGridCoords(objectRef.position);
            key = this._getCellKey(coords.gridX, coords.gridZ);
        }

        // Create a new cell if it doesn't exist
        if (!this.grid.has(key)) {
            this.grid.set(key, new Set());
        }

        // Get the cell and add the object
        const cell = this.grid.get(key);
        const wasAdded = !cell.has(objectRef); // Track if this is a new addition

        cell.add(objectRef);

        // Store the mapping from object ID to cell key if the object has an ID
        if (objectRef.id) {
            this.objectCellMap.set(objectRef.id, key);
        }

        // Store the current cell key on the object's userData for efficient removal/update
        if (!objectRef.userData) {
            objectRef.userData = {};
        }
        objectRef.userData.spatialGridKey = key;

        return wasAdded;
    }

    /**
     * Removes an object reference from the grid cell it was last known to be in.
     * Uses the stored key in objectRef.userData.spatialGridKey for efficiency.
     * @param {any} objectRef The object reference to remove. Requires objectRef.userData.spatialGridKey.
     * @returns {boolean} True if the object was successfully removed, false otherwise.
     */
    remove(objectRef) {
        if (!objectRef) {
            logger.warn('SpatialGrid.remove: Attempted to remove null or undefined object');
            return false;
        }

        // Use objectCellMap first if available and object has ID
        let key = null;
        if (objectRef.id && this.objectCellMap.has(objectRef.id)) {
            key = this.objectCellMap.get(objectRef.id);
        } else if (objectRef.userData?.spatialGridKey) {
            // Fallback to userData key
            key = objectRef.userData.spatialGridKey;
        } else if (objectRef.position) {
            // Fallback to calculating key (less efficient)
            const coords = this._getGridCoords(objectRef.position);
            key = this._getCellKey(coords.gridX, coords.gridZ);
        }

        if (!key) {
            logger.debug('SpatialGrid.remove: Could not determine cell key for object');
            return false;
        }

        let removed = false;

        // Remove from grid cell
        if (this.grid.has(key)) {
            const cell = this.grid.get(key);
            removed = cell.delete(objectRef);

            if (cell.size === 0) {
                this.grid.delete(key); // Clean up empty cell
            }
        } else {
            logger.debug(`SpatialGrid.remove: Cell key ${key} not found in grid`);
        }

        // Remove from objectCellMap
        if (objectRef.id) {
            this.objectCellMap.delete(objectRef.id);
        }

        // Clear the stored userData key if it exists
        if (objectRef.userData?.spatialGridKey) {
            delete objectRef.userData.spatialGridKey;
        }

        return removed;
    }

    /**
     * Updates an object's position in the grid if it has moved to a new cell.
     * @param {any} objectRef The object reference to update. Requires objectRef.position.
     * @returns {boolean} True if the object was successfully updated or added, false otherwise.
     */
    update(objectRef) {
        if (!objectRef) {
            logger.warn('SpatialGrid.update: Attempted to update null or undefined object');
            return false;
        }

        if (!objectRef.position) {
            logger.warn('SpatialGrid.update: Object has no position property');
            return false;
        }

        // If object has no ID, we can't track it in objectCellMap, so just add it
        if (!objectRef.id) {
            logger.debug('SpatialGrid.update: Object has no ID, adding directly');
            this.add(objectRef);
            return true;
        }

        const currentKey = this.objectCellMap.get(objectRef.id);

        // If object wasn't tracked, add it
        if (!currentKey) {
            logger.debug(`SpatialGrid.update: Object ID ${objectRef.id} not found in objectCellMap, adding`);
            this.add(objectRef);
            return true;
        }

        // Calculate the new cell key based on current position
        const { gridX, gridZ } = this._getGridCoords(objectRef.position);
        const newKey = this._getCellKey(gridX, gridZ);

        // Only update if the object has moved to a new cell
        if (newKey !== currentKey) {
            logger.debug(`SpatialGrid.update: Object moved from cell ${currentKey} to ${newKey}`);
            this.remove(objectRef); // Removes from old cell using stored key
            this.add(objectRef, newKey); // Adds to new cell and updates stored key
            return true;
        }

        // Object hasn't changed cells, no update needed
        return false;
    }

    /**
     * Queries the grid and returns a Set of unique objects found within the
     * cells surrounding (and including) the cell containing the given position.
     * Checks a 3x3 area of cells centered on the position's cell.
     * @param {{x: number, z: number}} position The center position of the query area.
     * @returns {Set<any>} A Set containing unique object references found in the nearby cells.
     */
    queryNearby(position) {
        if (!position || typeof position.x !== 'number' || typeof position.z !== 'number') {
            logger.warn('SpatialGrid.queryNearby: Invalid position provided', position);
            return new Set(); // Return empty set
        }

        const { gridX: centerGridX, gridZ: centerGridZ } = this._getGridCoords(position);
        const nearbyObjects = new Set();
        let cellsChecked = 0;
        let objectsFound = 0;

        // Iterate through the 3x3 grid of cells
        for (let x = centerGridX - 1; x <= centerGridX + 1; x++) {
            for (let z = centerGridZ - 1; z <= centerGridZ + 1; z++) {
                const key = this._getCellKey(x, z);
                cellsChecked++;

                if (this.grid.has(key)) {
                    const cell = this.grid.get(key);
                    cell.forEach(obj => {
                        if (obj) { // Only add non-null objects
                            nearbyObjects.add(obj);
                            objectsFound++;
                        }
                    });
                }
            }
        }

        logger.debug(`SpatialGrid.queryNearby: Checked ${cellsChecked} cells, found ${objectsFound} objects`);
        return nearbyObjects;
    }

    // --- Optional Helper Methods ---

    /** Clears the entire grid. */
    clear() {
        this.grid.clear();
        this.objectCellMap.clear();
    }

    /** Gets the number of non-empty cells in the grid. */
    getCellCount() {
        return this.grid.size;
    }

    /** Gets the total number of objects stored in the grid across all cells. */
    getObjectCount() {
        // Return the size of the map tracking unique object IDs
        return this.objectCellMap.size;
    }
}