/**
 * Handles file loading and parsing for Lottie/TGS files
 */
export class FileHandler {
    /**
     * Load and parse a Lottie or TGS file
     * @param {File} file - The file to load
     * @returns {Promise<Object>} Parsed animation data
     */
    async loadFile(file) {
        if (!file) {
            throw new Error("No file provided");
        }

        let text;

        // Handle TGS (compressed) files
        if (file.name.toLowerCase().endsWith(".tgs")) {
            const buffer = await file.arrayBuffer();
            const decompressed = pako.ungzip(new Uint8Array(buffer), {
                to: "string",
            });
            text = decompressed;
        } else {
            // Handle regular JSON files
            text = await file.text();
        }

        return JSON.parse(text);
    }

    /**
     * Deep traverse and copy color data from source to target
     * @param {Object} sourceObj - Source object with modified colors
     * @param {Object} targetObj - Target object to copy colors to
     */
    deepTraverseAndCopyColors(sourceObj, targetObj) {
        if (!sourceObj || typeof sourceObj !== "object" || !targetObj || typeof targetObj !== "object") {
            return;
        }

        if (Array.isArray(sourceObj)) {
            for (let i = 0; i < sourceObj.length; i++) {
                if (targetObj[i]) {
                    this.deepTraverseAndCopyColors(sourceObj[i], targetObj[i]);
                }
            }
        } else {
            for (const key in sourceObj) {
                if (!sourceObj.hasOwnProperty(key)) continue;

                if (key === "c" || key === "sc") {
                    if (sourceObj[key] && sourceObj[key].k) {
                        if (targetObj[key] && targetObj[key].k) {
                            if (Array.isArray(sourceObj[key].k)) {
                                targetObj[key].k = sourceObj[key].k;
                            }
                        }
                    }
                } else if (key === "g") {
                    if (sourceObj[key] && Array.isArray(sourceObj[key].k)) {
                        if (targetObj[key] && Array.isArray(targetObj[key].k)) {
                            targetObj[key].k = sourceObj[key].k;
                        }
                    } else if (sourceObj[key] && sourceObj[key].k && Array.isArray(sourceObj[key].k.k)) {
                        if (targetObj[key] && targetObj[key].k && Array.isArray(targetObj[key].k.k)) {
                            targetObj[key].k.k = sourceObj[key].k.k;
                        }
                    }
                } else if (typeof sourceObj[key] === "object" && sourceObj[key] !== null) {
                    this.deepTraverseAndCopyColors(sourceObj[key], targetObj[key]);
                }
            }
        }
    }
}
