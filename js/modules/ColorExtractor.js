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
     * @param {string} path - Current path in object tree
     */
    recursiveExtract(o, c, path = "") {
        if (o && typeof o === "object") {
            const shapeType = o.ty;

            if (o.c && o.c.k) {
                const colorPath = path ? `${path}.c` : "c";
                this.processFill(o, shapeType, c, colorPath);
            }

            if (o.sc && o.sc.k) {
                const colorPath = path ? `${path}.sc` : "sc";
                this.processStroke(o, c, colorPath);
            }

            if (o.g) {
                const gradientPath = path ? `${path}.g` : "g";
                this.processGradient(o, shapeType, c, gradientPath);
            }

            for (const k in o) {
                if (o.hasOwnProperty(k) && typeof o[k] === "object") {
                    const newPath = path ? `${path}.${k}` : k;
                    this.recursiveExtract(o[k], c, newPath);
                }
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
     * @param {string} path - Path to this color instance
     */
    addColor(c, type, shapeType, ref, hex, index = null, offset = null, stopCount = null, path = "") {
        const instance = { type, shapeType, ref, hex, index, offset, stopCount, path };
        c.push(instance);

        const groupKey = hex.toLowerCase();

        if (!this.groupedColors[groupKey]) {
            this.groupedColors[groupKey] = {
                hex: hex,
                count: 0,
                instances: [],
                shapeType: shapeType,
            };
        }
        this.groupedColors[groupKey].count++;
        this.groupedColors[groupKey].instances.push(instance);
    }

    /**
     * Process fill colors
     * @param {Object} o - Object containing fill data
     * @param {string} shapeType - Shape type
     * @param {Array} c - Array to store colors
     * @param {string} path - Path to this color property
     */
    processFill(o, shapeType, c, path) {
        if (o.c.a === 1) {
            if (Array.isArray(o.c.k)) {
                o.c.k.forEach((keyframe, i) => {
                    const keyframePath = `${path}.k.${i}`;
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

                        this.addColor(c, instanceType, instanceShapeType, keyframe, rgbaToHex(keyframe.s), null, null, null, keyframePath);
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

            this.addColor(c, instanceType, instanceShapeType, o.c, rgbaToHex(o.c.k), null, null, null, path);
        }
    }

    /**
     * Process stroke colors
     * @param {Object} o - Object containing stroke data
     * @param {Array} c - Array to store colors
     * @param {string} path - Path to this color property
     */
    processStroke(o, c, path) {
        if (o.sc.a === 1 && Array.isArray(o.sc.k)) {
            o.sc.k.forEach((keyframe, i) => {
                const keyframePath = `${path}.k.${i}`;
                if (keyframe.s && Array.isArray(keyframe.s)) {
                    this.addColor(c, "stroke", "stroke", keyframe, rgbaToHex(keyframe.s), null, null, null, keyframePath);
                }
            });
        } else if (Array.isArray(o.sc.k)) {
            this.addColor(c, "stroke", "stroke", o.sc, rgbaToHex(o.sc.k), null, null, null, path);
        }
    }

    /**
     * Process gradient colors
     * @param {Object} o - Object containing gradient data
     * @param {string} shapeType - Shape type
     * @param {Array} c - Array to store colors
     * @param {string} path - Path to this gradient property
     */
    processGradient(o, shapeType, c, path) {
        let gradientShapeType = "gradient";
        if (shapeType === "gf") gradientShapeType = "gradient fill";
        else if (shapeType === "gs") gradientShapeType = "gradient stroke";

        const processGradientStops = (gradientData, gradientRef, gradientPath) => {
            const arr = gradientData;
            const numStops = o.g.p || arr.length / 4;
            const loopLimit = numStops * 4;

            for (let i = 0; i < loopLimit; i += 4) {
                const offset = arr[i];
                const r = arr[i + 1];
                const g = arr[i + 2];
                const b = arr[i + 3];

                // Path for this specific stop (e.g., "...k.0" for first stop)
                const stopPath = `${gradientPath}.${i}`;

                this.addColor(
                    c,
                    "gradient",
                    gradientShapeType,
                    gradientRef,
                    rgbToHex(r * 255, g * 255, b * 255),
                    i,
                    offset,
                    numStops,
                    stopPath
                );
            }
        };

        if (o.g.k && !o.g.k.a && Array.isArray(o.g.k)) {
            processGradientStops(o.g.k, o.g, `${path}.k`);
        } else if (o.g.k && o.g.k.a === 1 && Array.isArray(o.g.k.k)) {
            o.g.k.k.forEach((keyframe, i) => {
                const keyframePath = `${path}.k.k.${i}`;
                if (keyframe && Array.isArray(keyframe.s)) {
                    processGradientStops(keyframe.s, keyframe, `${keyframePath}.s`);
                }
            });
        } else if (o.g.k && o.g.k.k && Array.isArray(o.g.k.k) && typeof o.g.k.k[0] === "number") {
            processGradientStops(o.g.k.k, o.g.k, `${path}.k.k`);
        }
    }
}