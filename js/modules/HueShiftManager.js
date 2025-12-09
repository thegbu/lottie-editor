import { rgbToHsl, hslToRgb } from "../utils/colorUtils.js";

/**
 * Manages global HSL (Hue, Saturation, Lightness) adjustments for all colors in the animation.
 * Also handles color locking to exclude specific colors from global adjustments.
 */
export class HslAdjustManager {
    constructor() {
        this.originalAnimData = null;
        this.hueShift = 0;
        this.saturationShift = 0;
        this.lightnessShift = 0;
        // Set to track locked color paths (string paths like "layers.0.shapes.2.c")
        // For gradient stops, path includes index like "layers.0.shapes.2.g.0" (stop at index 0)
        this.lockedPaths = new Set();
    }

    /**
     * Store the original animation data before any adjustments.
     * @param {Object} animData - The animation data to store
     */
    setOriginalData(animData) {
        this.originalAnimData = JSON.parse(JSON.stringify(animData));
        this.hueShift = 0;
        this.saturationShift = 0;
        this.lightnessShift = 0;
    }

    /**
     * Get current adjustment values.
     * @returns {Object} Current HSL shifts
     */
    getCurrentAdjustments() {
        return {
            hue: this.hueShift,
            saturation: this.saturationShift,
            lightness: this.lightnessShift
        };
    }

    /**
     * Check if any adjustment is active.
     * @returns {boolean} True if any adjustment is non-zero
     */
    hasAdjustments() {
        return this.hueShift !== 0 || this.saturationShift !== 0 || this.lightnessShift !== 0;
    }

    /**
     * Set adjustment values directly (used for history restore).
     * @param {number} hue 
     * @param {number} saturation 
     * @param {number} lightness 
     */
    setAdjustments(hue, saturation, lightness) {
        this.hueShift = hue;
        this.saturationShift = saturation;
        this.lightnessShift = lightness;
    }

    /**
     * Lock a color path to prevent HSL adjustments.
     * @param {string} path - Path string identifying the color (e.g., "layers.0.shapes.2.c")
     */
    lockPath(path) {
        this.lockedPaths.add(path);
    }

    /**
     * Unlock a color path to allow HSL adjustments.
     * @param {string} path - Path string identifying the color
     */
    unlockPath(path) {
        this.lockedPaths.delete(path);
    }

    /**
     * Check if a color path is locked.
     * @param {string} path - Path string identifying the color
     * @returns {boolean} True if the path is locked
     */
    isPathLocked(path) {
        return this.lockedPaths.has(path);
    }

    /**
     * Toggle lock state for a color path.
     * @param {string} path - Path string identifying the color
     * @returns {boolean} New lock state (true = locked)
     */
    togglePathLock(path) {
        if (this.isPathLocked(path)) {
            this.unlockPath(path);
            return false;
        } else {
            this.lockPath(path);
            return true;
        }
    }

    /**
     * Clear all locks (call when loading a new file).
     */
    clearLocks() {
        this.lockedPaths.clear();
    }

    /**
     * Apply HSL adjustments to animation data.
     * @param {Object} animData - The animation data to modify
     * @param {number} hue - Degrees to shift hue (-180 to 180)
     * @param {number} saturation - Percentage to shift saturation (-100 to 100)
     * @param {number} lightness - Percentage to shift lightness (-100 to 100)
     * @returns {Object} Modified animation data
     */
    applyAdjustments(animData, hue, saturation, lightness) {
        if (!this.originalAnimData) {
            this.setOriginalData(animData);
        }

        // Sync locked colors from current animData to originalAnimData.
        // This ensures that if the user manually changed a locked color, 
        // that change is preserved and treated as the truth when calculating HSL.
        this.syncLockedColors(animData);

        this.hueShift = hue;
        this.saturationShift = saturation;
        this.lightnessShift = lightness;

        // Start from original data to avoid cumulative color drift
        const freshData = JSON.parse(JSON.stringify(this.originalAnimData));
        this.recursiveAdjustColors(freshData, "");

        return freshData;
    }

    /**
     * Syncs locked color values from current state to original state.
     * @param {Object} currentData - current animation data with potential manual edits
     */
    syncLockedColors(currentData) {
        if (this.lockedPaths.size === 0 || !this.originalAnimData) return;

        this.lockedPaths.forEach(path => {
            const parts = path.split('.');
            const lastKey = parts.pop();

            let currentParent = currentData;
            let originalParent = this.originalAnimData;

            for (const part of parts) {
                if (currentParent && currentParent[part] !== undefined) {
                    currentParent = currentParent[part];
                } else {
                    return; // Path mismatch
                }

                if (originalParent && originalParent[part] !== undefined) {
                    originalParent = originalParent[part];
                } else {
                    return; // Path mismatch
                }
            }

            const currentValue = currentParent[lastKey];

            if (currentValue === undefined) return;

            if (typeof currentValue === 'number') {
                // Gradient stop: A stop is 4 values (offset, r, g, b)
                if (Array.isArray(currentParent) && Array.isArray(originalParent)) {
                    const idx = parseInt(lastKey);
                    if (!isNaN(idx) && idx + 3 < currentParent.length && idx + 3 < originalParent.length) {
                        // Copy 4 values (offset, r, g, b)
                        for (let i = 0; i < 4; i++) {
                            originalParent[idx + i] = currentParent[idx + i];
                        }
                    }
                }
            } else if (typeof currentValue === 'object') {
                // Solid color property or Keyframe object
                originalParent[lastKey] = JSON.parse(JSON.stringify(currentValue));
            }
        });
    }

    /**
     * Recursively adjust colors throughout the Lottie animation tree.
     * * Lottie color structure examples:
     * - c/sc: Solid fill/stroke colors (k = color array)
     * - g: Gradients (k = gradient data or k.k for animated)
     * * @param {Object} obj - Object to process
     * @param {string} path - Current path in the object tree
     */
    recursiveAdjustColors(obj, path) {
        if (!obj || typeof obj !== "object") return;

        if (obj.c && obj.c.k) {
            this.adjustColorProperty(obj.c, path ? `${path}.c` : "c");
        }

        if (obj.sc && obj.sc.k) {
            this.adjustColorProperty(obj.sc, path ? `${path}.sc` : "sc");
        }

        if (obj.g && obj.g.k) {
            this.adjustGradient(obj.g, path ? `${path}.g` : "g");
        }

        for (const key in obj) {
            if (obj.hasOwnProperty(key) && typeof obj[key] === "object") {
                const newPath = path ? `${path}.${key}` : key;
                this.recursiveAdjustColors(obj[key], newPath);
            }
        }
    }

    /**
     * Adjust a color property (solid color).
     * @param {Object} colorProp - Color property object with k value
     * @param {string} path - Path to this color property
     */
    adjustColorProperty(colorProp, path) {
        // Check if this color is locked
        if (this.isPathLocked(path)) {
            return;
        }

        if (colorProp.a === 1 && Array.isArray(colorProp.k)) {
            // Animated color - adjust each keyframe
            colorProp.k.forEach((keyframe, i) => {
                const keyframePath = `${path}.k.${i}`;
                if (!this.isPathLocked(keyframePath)) {
                    if (keyframe.s && Array.isArray(keyframe.s)) {
                        this.adjustRgbaArray(keyframe.s);
                    }
                }
            });
        } else if (Array.isArray(colorProp.k) && colorProp.k.length >= 3) {
            // Static color
            this.adjustRgbaArray(colorProp.k);
        }
    }

    /**
     * Adjust an RGBA array (values 0-1) by applying HSL shifts.
     * @param {number[]} arr - RGBA array [r, g, b, a?] with values 0-1
     */
    adjustRgbaArray(arr) {
        const r = arr[0] * 255;
        const g = arr[1] * 255;
        const b = arr[2] * 255;

        const hsl = rgbToHsl(r, g, b);

        // Apply hue shift (wrap around 0-360)
        hsl.h = (hsl.h + this.hueShift + 360) % 360;

        // Apply saturation shift (clamp 0-100)
        hsl.s = Math.max(0, Math.min(100, hsl.s + this.saturationShift));

        // Apply lightness shift (clamp 0-100)
        hsl.l = Math.max(0, Math.min(100, hsl.l + this.lightnessShift));

        const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);

        arr[0] = newRgb.r / 255;
        arr[1] = newRgb.g / 255;
        arr[2] = newRgb.b / 255;
        // Alpha (arr[3]) is kept unchanged if present.
    }

    /**
     * Adjust gradient colors.
     * @param {Object} gradientProp - Gradient property object
     * @param {string} path - Path to this gradient property
     */
    adjustGradient(gradientProp, path) {
        // Check if the entire gradient is locked
        if (this.isPathLocked(path)) {
            return;
        }

        const numStops = gradientProp.p || 0;

        if (!gradientProp.k.a && Array.isArray(gradientProp.k)) {
            // Static gradient
            this.adjustGradientStops(gradientProp.k, numStops, `${path}.k`);
        } else if (gradientProp.k.a === 1 && Array.isArray(gradientProp.k.k)) {
            // Animated gradient - adjust each keyframe
            gradientProp.k.k.forEach((keyframe, i) => {
                const keyframePath = `${path}.k.k.${i}`;
                if (keyframe && Array.isArray(keyframe.s)) {
                    this.adjustGradientStops(keyframe.s, numStops, `${keyframePath}.s`);
                }
            });
        } else if (gradientProp.k.k && Array.isArray(gradientProp.k.k) && typeof gradientProp.k.k[0] === "number") {
            // Another static gradient format
            this.adjustGradientStops(gradientProp.k.k, numStops, `${path}.k.k`);
        }
    }

    /**
     * Adjust gradient stop colors.
     * @param {number[]} arr - Gradient data array [offset, r, g, b, ...]
     * @param {number} numStops - Number of color stops
     * @param {string} path - Path to the gradient data array
     */
    adjustGradientStops(arr, numStops, path) {
        const loopLimit = numStops * 4;

        for (let i = 0; i < loopLimit && i + 3 < arr.length; i += 4) {
            // Construct path for this specific stop index (e.g., "...k.0" for first color stop's position in array)
            const stopPath = `${path}.${i}`;

            // Skip if this specific stop is locked
            if (this.isPathLocked(stopPath)) {
                continue;
            }

            // arr[i] is offset, arr[i+1], arr[i+2], arr[i+3] are RGB (0-1)
            const r = arr[i + 1] * 255;
            const g = arr[i + 2] * 255;
            const b = arr[i + 3] * 255;

            const hsl = rgbToHsl(r, g, b);

            // Apply hue shift (wrap around 0-360)
            hsl.h = (hsl.h + this.hueShift + 360) % 360;

            // Apply saturation shift (clamp 0-100)
            hsl.s = Math.max(0, Math.min(100, hsl.s + this.saturationShift));

            // Apply lightness shift (clamp 0-100)
            hsl.l = Math.max(0, Math.min(100, hsl.l + this.lightnessShift));

            const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);

            arr[i + 1] = newRgb.r / 255;
            arr[i + 2] = newRgb.g / 255;
            arr[i + 3] = newRgb.b / 255;
        }
    }

    /**
     * Reset HSL adjustments and return the original animation data.
     * @returns {Object|null} Original animation data or null
     */
    reset() {
        this.hueShift = 0;
        this.saturationShift = 0;
        this.lightnessShift = 0;
        if (this.originalAnimData) {
            return JSON.parse(JSON.stringify(this.originalAnimData));
        }
        return null;
    }

    /**
     * Clear stored original data and HSL shifts (call when loading new file).
     */
    clear() {
        this.originalAnimData = null;
        this.hueShift = 0;
        this.saturationShift = 0;
        this.lightnessShift = 0;
    }
}