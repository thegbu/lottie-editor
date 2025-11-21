/**
 * Handles exporting animation data to different formats
 */
export class ExportManager {
    /**
     * Export animation data to specified format
     * @param {Object} originalAnimData - Original animation data
     * @param {Object} modifiedAnimData - Modified animation data with color changes
     * @param {string} format - Export format ('json' or 'tgs')
     * @param {Function} deepCopyColorsFn - Function to deep copy colors between objects
     */
    export(originalAnimData, modifiedAnimData, format, deepCopyColorsFn) {
        const finalExportData = JSON.parse(JSON.stringify(originalAnimData));
        let filename = "lottie-edited";
        let mimeType = "application/json";
        let fileExtension = "json";

        if (format && format.toLowerCase() === "tgs") {
            fileExtension = "tgs";
            mimeType = "application/x-tgs";
        }

        // Copy modified colors to the export data
        deepCopyColorsFn(modifiedAnimData, finalExportData);

        let fileContent;
        if (fileExtension === "tgs") {
            const jsonString = JSON.stringify(finalExportData);
            const compressed = pako.gzip(jsonString);
            fileContent = compressed;
            filename += ".tgs";
        } else {
            fileContent = JSON.stringify(finalExportData);
            filename += ".json";
        }

        this.downloadFile(fileContent, filename, mimeType);
    }

    /**
     * Trigger file download in browser
     * @param {string|Uint8Array} content - File content
     * @param {string} filename - Name for downloaded file
     * @param {string} mimeType - MIME type of file
     */
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }
}
