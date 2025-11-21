/**
 * Manages undo/redo history for animation data changes
 */
export class HistoryManager {
    constructor(maxHistory = 20) {
        this.historyStack = [];
        this.redoStack = [];
        this.MAX_HISTORY = maxHistory;
    }

    /**
     * Save current state to history
     * @param {Object} animData - Current animation data to save
     */
    saveState(animData) {
        if (!animData) return;

        const newState = JSON.parse(JSON.stringify(animData));

        // Don't save if identical to last state
        if (this.historyStack.length > 0) {
            const lastState = this.historyStack[this.historyStack.length - 1];
            if (JSON.stringify(newState) === JSON.stringify(lastState)) {
                return;
            }
        }

        this.historyStack.push(newState);
        if (this.historyStack.length > this.MAX_HISTORY) {
            this.historyStack.shift();
        }
        this.redoStack = [];
    }

    /**
     * Undo the last change
     * @returns {Object|null} Previous state or null if no history
     */
    undo() {
        if (this.historyStack.length <= 1) return null;

        this.redoStack.push(this.historyStack.pop());
        return JSON.parse(JSON.stringify(this.historyStack[this.historyStack.length - 1]));
    }

    /**
     * Redo the last undone change
     * @param {Object} currentAnimData - Current animation data
     * @returns {Object|null} Redo state or null if no redo available
     */
    redo(currentAnimData) {
        if (this.redoStack.length === 0) return null;

        const redoState = this.redoStack.pop();
        this.historyStack.push(JSON.parse(JSON.stringify(currentAnimData)));
        return redoState;
    }

    /**
     * Clear all history
     */
    clear() {
        this.historyStack = [];
        this.redoStack = [];
    }

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
        return this.historyStack.length > 1;
    }

    /**
     * Check if redo is available
     * @returns {boolean}
     */
    canRedo() {
        return this.redoStack.length > 0;
    }
}
