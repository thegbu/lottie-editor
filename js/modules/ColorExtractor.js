import { rgbaToHex, rgbToHex } from "../utils/colorUtils.js";

/**
 * Extracts and processes colors from Lottie animation data
 */
export class ColorExtractor {
    constructor() {
        this.groupedColors = {};
    }

    /**
     * Extract all colors from animation data
     * @param {Object} obj - Animation data object
     * @returns {Array} Array of extracted color objects
     */
    extractColors(obj) {
        if (obj && typeof obj === "object") {
            this.resetGroupedColors();
            const extracted = [];
            this.recursiveExtract(obj, extracted);
            return extracted;
        }
        return [];
    }

    /**
     * Get grouped colors
     * @returns {Object} Grouped colors object
     */
    getGroupedColors() {
        return this.groupedColors;
    }

    /**
     * Reset grouped colors
     */
    resetGroupedColors() {
        this.groupedColors = {};
    }

    /**
     * Recursively extract colors from object
     * @param {Object} o - Object to extract from
     * @param {Array} c - Array to store extracted colors
     */
    recursiveExtract(o, c) {
        if (o && typeof o === "object") {
            const shapeType = o.ty;

            if (o.c && o.c.k) {
                this.processFill(o, shapeType, c);
            }

            if (o.sc && o.sc.k) {
                this.processStroke(o, c);
            }

            if (o.g) {
                this.processGradient(o, shapeType, c);
            }

            for (const k in o) {
                this.recursiveExtract(o[k], c);
            }
        }
    }

    /**
     * Add a color to the extracted colors and grouped colors
     * @param {Array} c - Array to add color to
     * @param {string} type - Color type
     * @param {string} shapeType - Shape type
     * @param {Object} ref - Reference to color data
     * @param {string} hex - Hex color value
     * @param {number|null} index - Index for gradient colors
     * @param {number|null} offset - Offset for gradient colors
     */
    addColor(c, type, shapeType, ref, hex, index = null, offset = null, stopCount = null) {
        const instance = { type, shapeType, ref, hex, index, offset, stopCount };
        c.push(instance);

        // Use lowercase hex for grouping key to ensure case-insensitivity
        const groupKey = hex.toLowerCase();

        if (!this.groupedColors[groupKey]) {
            this.groupedColors[groupKey] = {
                hex: hex, // Keep original case for display if needed, or normalize
                count: 0,
                instances: [],
                shapeType: shapeType,
            };
        }
        this.groupedColors[groupKey].count++;
        this.groupedColors[groupKey].instances.push(instance);

        // If the new instance has a different hex case but matches the group, update the group hex to match the new one?
        // Or just keep the first one found. Usually we want the latest one if we are editing.
        // But here we are extracting.
    }

    /**
     * Process fill colors
     * @param {Object} o - Object containing fill data
     * @param {string} shapeType - Shape type
     * @param {Array} c - Array to store colors
     */
    processFill(o, shapeType, c) {
        if (o.c.a === 1) {
            if (Array.isArray(o.c.k)) {
                o.c.k.forEach((keyframe) => {
                    if (keyframe.s && Array.isArray(keyframe.s)) {
                        let instanceType = "solid";
                        let instanceShapeType = "solid color (unknown)";

                        if (shapeType === "fl") {
                            instanceShapeType = "fill";
                            instanceType = "solid";
                        } else if (shapeType === "st") {
                            instanceShapeType = "stroke";
                            instanceType = "stroke";
                        } else {
                            console.warn(`Unknown animated color type detected. Shape type (ty): "${shapeType}", Color:`, rgbaToHex(keyframe.s), "Parent object:", o);
                        }

                        this.addColor(c, instanceType, instanceShapeType, keyframe, rgbaToHex(keyframe.s));
                    }
                });
            }
        } else if (Array.isArray(o.c.k)) {
            let instanceType = "solid";
            let instanceShapeType = "solid color (unknown)";

            if (shapeType === "fl") {
                instanceShapeType = "fill";
                instanceType = "solid";
            } else if (shapeType === "st") {
                instanceShapeType = "stroke";
                instanceType = "stroke";
            } else {
                console.warn(`Unknown static color type detected. Shape type (ty): "${shapeType}", Color:`, rgbaToHex(o.c.k), "Parent object:", o);
            }

            this.addColor(c, instanceType, instanceShapeType, o.c, rgbaToHex(o.c.k));
        }
    }

    /**
     * Process stroke colors
     * @param {Object} o - Object containing stroke data
     * @param {Array} c - Array to store colors
     */
    processStroke(o, c) {
        if (o.sc.a === 1 && Array.isArray(o.sc.k)) {
            o.sc.k.forEach((keyframe) => {
                if (keyframe.s && Array.isArray(keyframe.s)) {
                    this.addColor(c, "stroke", "stroke", keyframe, rgbaToHex(keyframe.s));
                }
            });
        } else if (Array.isArray(o.sc.k)) {
            this.addColor(c, "stroke", "stroke", o.sc, rgbaToHex(o.sc.k));
        }
    }

    /**
     * Process gradient colors
     * @param {Object} o - Object containing gradient data
     * @param {string} shapeType - Shape type
     * @param {Array} c - Array to store colors
     */
    processGradient(o, shapeType, c) {
        let gradientShapeType = "gradient";
        if (shapeType === "gf") gradientShapeType = "gradient fill";
        else if (shapeType === "gs") gradientShapeType = "gradient stroke";

        const processGradientStops = (gradientData, gradientRef) => {
            const arr = gradientData;
            const numStops = o.g.p || arr.length / 4;
            const loopLimit = numStops * 4;

            for (let i = 0; i < loopLimit; i += 4) {
                const offset = arr[i];
                const r = arr[i + 1];
                const g = arr[i + 2];
                const b = arr[i + 3];

                this.addColor(
                    c,
                    "gradient",
                    gradientShapeType,
                    gradientRef,
                    rgbToHex(r * 255, g * 255, b * 255),
                    i,
                    offset,
                    numStops
                );
            }
        };

        if (o.g.k && !o.g.k.a && Array.isArray(o.g.k)) {
            processGradientStops(o.g.k, o.g);
        } else if (o.g.k && o.g.k.a === 1 && Array.isArray(o.g.k.k)) {
            o.g.k.k.forEach((keyframe) => {
                if (keyframe && Array.isArray(keyframe.s)) {
                    processGradientStops(keyframe.s, keyframe);
                }
            });
        } else if (o.g.k && o.g.k.k && Array.isArray(o.g.k.k) && typeof o.g.k.k[0] === "number") {
            processGradientStops(o.g.k.k, o.g.k);
        }
    }
}
