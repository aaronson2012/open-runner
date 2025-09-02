// Utility functions for Babylon.js application

/**
 * Converts degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
export function degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Calculates the distance between two 3D points
 * @param x1 First point x coordinate
 * @param y1 First point y coordinate
 * @param z1 First point z coordinate
 * @param x2 Second point x coordinate
 * @param y2 Second point y coordinate
 * @param z2 Second point z coordinate
 * @returns Distance between the two points
 */
export function calculateDistance(
    x1: number, y1: number, z1: number,
    x2: number, y2: number, z2: number
): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}