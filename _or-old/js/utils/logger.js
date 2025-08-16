// Default log level is set to INFO to reduce verbosity
// For debugging, you can use the URL parameter ?logLevel=DEBUG to enable more detailed logging


/**
 * Log levels enum
 * @readonly
 * @enum {number}
 */
export const LogLevel = Object.freeze({
    /** Most detailed logging level */
    DEBUG: 0,
    /** Informational messages */
    INFO: 1,
    /** Warning messages */
    WARN: 2,
    /** Error messages */
    ERROR: 3,
    /** No logging */
    NONE: 4
});

const LOG_LEVEL_NAMES = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
};

/**
 * A configurable logger for consistent logging across the application
 */
class Logger {
    /**
     * Creates a new logger instance
     * @param {string} [moduleName=''] - Name of the module using this logger
     * @param {LogLevel} [minLevel=LogLevel.INFO] - Minimum level to log
     */
    constructor(moduleName = '', minLevel = LogLevel.INFO) { // Default level set to INFO to reduce verbosity
        this.moduleName = moduleName;
        this.minLevel = minLevel;
        this.enabled = true;
    }

    /**
     * Sets the minimum log level
     * @param {LogLevel} level - The minimum level to log
     */
    setLevel(level) {
        if (Object.values(LogLevel).includes(level)) {
            this.minLevel = level;
        } else {
            // Use console directly here to avoid recursion if logger itself fails
            console.warn(`[Logger] Invalid log level: ${level}`);
        }
    }

    /**
     * Enables or disables the logger
     * @param {boolean} enabled - Whether logging is enabled
     */
    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
    }

    /**
     * Formats a log message with the module name
     * @private
     * @param {string} message - The message to format
     * @returns {string} Formatted message
     */
    _formatMessage(message) {
        return this.moduleName ? `[${this.moduleName}] ${message}` : message;
    }

    /**
     * Logs a debug message
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments to log
     */
    debug(message, ...args) {
        if (!this.enabled || this.minLevel > LogLevel.DEBUG) return;
        const formatted = this._formatMessage(message);
        console.debug(formatted, ...args);
    }

    /**
     * Logs an info message
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments to log
     */
    info(message, ...args) {
        if (!this.enabled || this.minLevel > LogLevel.INFO) return;
        const formatted = this._formatMessage(message);
        console.info(formatted, ...args);
    }

    /**
     * Logs a warning message
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments to log
     */
    warn(message, ...args) {
        if (!this.enabled || this.minLevel > LogLevel.WARN) return;
        const formatted = this._formatMessage(message);
        console.warn(formatted, ...args);
    }

    /**
     * Logs an error message
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments to log
     */
    error(message, ...args) {
        if (!this.enabled || this.minLevel > LogLevel.ERROR) return;
        const formatted = this._formatMessage(message);
        console.error(formatted, ...args);
    }

    /**
     * Logs a message with a custom level
     * @param {LogLevel} level - The log level
     * @param {string} message - The message to log
     * @param {...any} args - Additional arguments to log
     */
    log(level, message, ...args) {
        switch (level) {
            case LogLevel.DEBUG:
                this.debug(message, ...args);
                break;
            case LogLevel.INFO:
                this.info(message, ...args);
                break;
            case LogLevel.WARN:
                this.warn(message, ...args);
                break;
            case LogLevel.ERROR:
                this.error(message, ...args);
                break;
            default:
                // Do nothing for NONE or invalid levels
                break;
        }
    }

    /**
     * Creates a child logger with the same settings but a different module name
     * @param {string} subModuleName - Name of the sub-module
     * @returns {Logger} A new logger instance
     */
    createSubLogger(subModuleName) {
        const fullName = this.moduleName
            ? `${this.moduleName}.${subModuleName}`
            : subModuleName;

        const subLogger = new Logger(fullName, this.minLevel);
        subLogger.setEnabled(this.enabled); // Inherit enabled state
        return subLogger;
    }

    /**
     * Logs the start of a performance measurement
     * @param {string} label - Label for the measurement
     */
    timeStart(label) {
        if (!this.enabled || this.minLevel > LogLevel.DEBUG) return;
        // DOM logging for timeStart/End might be noisy, skipping for now.
        console.time(this._formatMessage(label));
    }

    /**
     * Logs the end of a performance measurement
     * @param {string} label - Label for the measurement (must match timeStart)
     */
    timeEnd(label) {
        if (!this.enabled || this.minLevel > LogLevel.DEBUG) return;
        // DOM logging for timeStart/End might be noisy, skipping for now.
        console.timeEnd(this._formatMessage(label));
    }
}



// Use WARN as the default minimum level to reduce console clutter
const defaultLogger = new Logger('App', LogLevel.WARN);

// Allows enabling verbose logging via URL parameter, e.g., ?logLevel=DEBUG
try {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        const urlLogLevel = urlParams.get('logLevel');
        if (urlLogLevel) {
            const requestedLevel = urlLogLevel.toUpperCase();
            if (LogLevel.hasOwnProperty(requestedLevel)) {
                const levelValue = LogLevel[requestedLevel];
                console.log(`[Logger] Overriding log level from URL: ${requestedLevel} (${levelValue})`);
                defaultLogger.setLevel(levelValue); // Set level for the default logger instance
            } else {
                console.warn(`[Logger] Invalid log level specified in URL: ${urlLogLevel}`);
            }
        }
    }
} catch (e) {
    console.error("[Logger] Error processing URL log level override:", e);
}


/**
 * Creates a new logger for a specific module
 * @param {string} moduleName - Name of the module
 * @param {LogLevel} [level] - Optional minimum log level
 * @returns {Logger} A new logger instance
 */
export function createLogger(moduleName, level) {
    const newLogger = new Logger(moduleName, level !== undefined ? level : defaultLogger.minLevel);
    newLogger.setEnabled(defaultLogger.enabled); // Inherit enabled state from default logger
    return newLogger;
}

/**
 * Sets the global minimum log level for the default logger and new loggers
 * @param {LogLevel} level - The minimum level to log
 */
export function setGlobalLogLevel(level) {
    defaultLogger.setLevel(level);
    // Note: Existing loggers created via createLogger won't be affected unless they
    // are recreated or manually updated. This sets the default for *new* loggers.
}

/**
 * Enables or disables logging globally for the default logger and new loggers
 * @param {boolean} enabled - Whether logging is enabled
 */
export function setLoggingEnabled(enabled) {
    defaultLogger.setEnabled(enabled);
    // Note: Existing loggers created via createLogger won't be affected unless they
    // are manually updated. This sets the default for *new* loggers.
}

// Export the default logger instance
export default defaultLogger;