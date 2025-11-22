import { FileHandler } from "./modules/FileHandler.js";
import { ColorExtractor } from "./modules/ColorExtractor.js";
import { ColorRenderer } from "./modules/ColorRenderer.js";
import { AnimationController } from "./modules/AnimationController.js";
import { HistoryManager } from "./modules/HistoryManager.js";
import { ExportManager } from "./modules/ExportManager.js";

/**
 * Main Lottie Editor class - orchestrates all modules
 */
class LottieEditor {
    constructor() {
        // Initialize data
        this.animData = null;
        this.originalAnimData = null;
        this.allExtractedColors = [];
        this.currentFilter = "All";
        this.wasPlayingBeforeModal = false;

        // Initialize modules
        this.fileHandler = new FileHandler();
        this.colorExtractor = new ColorExtractor();
        this.historyManager = new HistoryManager(20);
        this.exportManager = new ExportManager();
        this.animController = new AnimationController("anim");

        // Get DOM elements
        this.slider = document.getElementById("frameSlider");
        this.frameLabel = document.getElementById("frameLabel");
        this.frameInput = document.getElementById("frameInput");
        this.frameTotalLabel = document.getElementById("frameTotalLabel");
        this.groupCheckbox = document.getElementById("groupDuplicates");
        this.exportBtn = document.getElementById("exportBtn");
        this.playPauseBtn = document.getElementById("playPauseBtn");
        this.colorList = document.getElementById("colors");
        this.fileInput = document.getElementById("fileInput");
        this.dropZone = document.getElementById("drop-zone");
        this.fileNameDisplay = document.getElementById("file-name-display");
        this.modal = document.getElementById("export-modal");
        this.closeModalBtn = document.querySelector(".modal-close");
        this.exportJsonBtn = document.getElementById("export-as-json");
        this.exportTgsBtn = document.getElementById("export-as-tgs");
        this.exportSvgBtn = document.getElementById("export-as-svg");
        this.exportFrameInput = document.getElementById("exportFrameInput");
        this.resetBtn = document.getElementById("resetBtn");

        // Initialize color renderer with callbacks
        this.colorRenderer = new ColorRenderer(
            this.colorList,
            () => {
                // Re-extract colors to ensure consistency when switching views/filters
                this.allExtractedColors = this.colorExtractor.extractColors(this.animData);
                this.reloadAnim();
            },
            () => {
                // When gradient position changes, we sort the gradient array,
                // so we must re-extract colors to update indices.
                this.allExtractedColors = this.colorExtractor.extractColors(this.animData);
                this.reloadAnim();
                this.applyCurrentFilter();
            },
            () => this.saveState()
        );

        this.initEventListeners();
    }

    initEventListeners() {
        // File upload events
        this.dropZone.addEventListener("click", () => this.fileInput.click());

        this.dropZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            this.dropZone.classList.add("drag-over");
        });

        this.dropZone.addEventListener("dragleave", () => {
            this.dropZone.classList.remove("drag-over");
        });

        this.dropZone.addEventListener("drop", (e) => {
            e.preventDefault();
            this.dropZone.classList.remove("drag-over");
            if (e.dataTransfer.files.length > 0) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });

        this.fileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        // Keyboard shortcuts
        document.addEventListener("keydown", (e) => {
            const isCtrlCmd = e.ctrlKey || e.metaKey;
            if (isCtrlCmd && e.code === "KeyZ") {
                e.preventDefault();
                if (e.shiftKey) {
                    this.redoChange();
                } else {
                    this.undoChange();
                }
            }
        });

        // Button events
        this.playPauseBtn.onclick = () => this.togglePlay();
        this.exportBtn.onclick = () => this.showExportModal();
        this.resetBtn.onclick = () => this.resetColors();
        this.exportJsonBtn.onclick = () => this.handleExport("json");
        this.exportTgsBtn.onclick = () => this.handleExport("tgs");
        this.exportSvgBtn.onclick = () => this.handleSvgExport();
        this.closeModalBtn.onclick = () => this.closeModal();
        this.modal.onclick = (e) => {
            if (e.target === this.modal) this.closeModal();
        };

        // Slider events
        this.slider.oninput = () => {
            const frame = parseFloat(this.slider.value);
            this.animController.pause();
            this.animController.goToFrame(frame, true);
            this.playPauseBtn.textContent = "Play";
            this.frameInput.value = Math.round(frame);
        };

        // Frame input events
        this.frameInput.oninput = () => {
            const frame = parseInt(this.frameInput.value);
            if (!isNaN(frame) && frame >= 0 && frame <= this.slider.max) {
                this.animController.pause();
                this.animController.goToFrame(frame, true);
                this.slider.value = frame;
                this.playPauseBtn.textContent = "Play";
            }
        };

        // Group checkbox
        this.groupCheckbox.onchange = () => {
            this.filterAndRender(
                this.currentFilter,
                document.querySelector(`[data-filter="${this.currentFilter}"]`)
            );
        };

        // Filter buttons
        document.querySelectorAll(".filter-btn").forEach((button) => {
            button.onclick = (e) => {
                this.currentFilter = e.target.dataset.filter;
                this.filterAndRender(this.currentFilter, e.target);
            };
        });
    }

    async handleFile(file) {
        if (!file) return;

        try {
            this.fileNameDisplay.textContent = `Loaded: ${file.name}`;

            // Load file using FileHandler
            const animData = await this.fileHandler.loadFile(file);

            this.originalAnimData = animData;
            this.animData = JSON.parse(JSON.stringify(animData));

            // Reset history
            this.historyManager.clear();
            this.saveState();

            // Enable buttons
            this.exportBtn.disabled = false;
            this.resetBtn.disabled = false;
            this.playPauseBtn.textContent = "Play";

            // Initialize color editor and reload animation
            this.initializeColorEditor(this.animData);
            this.reloadAnim();
        } catch (error) {
            console.error("Error loading or parsing animation file:", error);
            this.fileNameDisplay.textContent = `Error: Invalid Lottie/TGS file.`;
            alert(`An error occurred while loading the file. Error detail: ${error.message}`);
        }
    }

    saveState() {
        this.historyManager.saveState(this.animData);
    }

    undoChange() {
        const previousState = this.historyManager.undo();
        if (!previousState) return;

        this.animData = previousState;
        this.allExtractedColors = this.colorExtractor.extractColors(this.animData);
        this.reloadAnim();
        this.applyCurrentFilter();
    }

    redoChange() {
        const redoState = this.historyManager.redo(this.animData);
        if (!redoState) return;

        this.animData = redoState;
        this.allExtractedColors = this.colorExtractor.extractColors(this.animData);
        this.reloadAnim();
        this.applyCurrentFilter();
    }

    resetColors() {
        if (!this.originalAnimData) return;

        this.saveState();
        this.animData = JSON.parse(JSON.stringify(this.originalAnimData));
        this.initializeColorEditor(this.animData);
        this.reloadAnim();
    }

    togglePlay() {
        const isPaused = this.animController.togglePlay();
        this.playPauseBtn.textContent = isPaused ? "Play" : "Pause";
    }

    showExportModal() {
        if (!this.originalAnimData) {
            alert("Please load a Lottie or TGS file first.");
            return;
        }

        // Pause animation and store state
        this.wasPlayingBeforeModal = !this.animController.getState().isPaused;
        if (this.wasPlayingBeforeModal) {
            this.animController.pause();
            this.playPauseBtn.textContent = "Play";
        }

        this.modal.style.display = "flex";

        // Set current frame in export input
        // Use slider value as it's the most reliable source for the user's current view
        const currentFrame = Math.round(this.slider.value);
        this.exportFrameInput.value = currentFrame;
        this.exportFrameInput.max = this.slider.max;

        setTimeout(() => this.modal.classList.add("show"), 10);
    }

    closeModal() {
        this.modal.classList.remove("show");
        setTimeout(() => {
            this.modal.style.display = "none";

            // Resume animation if it was playing before
            if (this.wasPlayingBeforeModal) {
                this.animController.togglePlay(); // Since we paused it, toggle will play it
                this.playPauseBtn.textContent = "Pause";
                this.wasPlayingBeforeModal = false;
            }
        }, 300);
    }

    handleExport(format) {
        this.closeModal();
        this.exportManager.export(
            this.originalAnimData,
            this.animData,
            format,
            (src, tgt) => this.fileHandler.deepTraverseAndCopyColors(src, tgt)
        );
    }

    handleSvgExport() {
        const frame = parseInt(this.exportFrameInput.value);
        if (isNaN(frame) || frame < 0) {
            alert("Please enter a valid frame number.");
            return;
        }

        // Store current state
        const wasPaused = this.animController.getState().isPaused;
        const originalFrame = this.animController.getState().currentFrame;

        // Go to target frame
        this.animController.goToFrame(frame, true);

        // Wait for render (next tick)
        setTimeout(() => {
            const svgElement = document.getElementById("anim").querySelector("svg");
            if (svgElement) {
                // Clone the SVG to avoid modifying the live one
                const svgClone = svgElement.cloneNode(true);

                // Ensure xmlns attribute
                svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

                const svgData = svgClone.outerHTML;
                const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
                const url = URL.createObjectURL(blob);

                const link = document.createElement("a");
                link.href = url;
                link.download = `frame_${frame}.svg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Restore state
                if (!wasPaused) {
                    this.animController.goToFrame(originalFrame, false);
                } else {
                    this.animController.goToFrame(originalFrame, true);
                }

                this.closeModal();
            } else {
                alert("Could not generate SVG. Please try again.");
            }
        }, 100);
    }

    initializeColorEditor(data) {
        this.allExtractedColors = this.colorExtractor.extractColors(data);
        if (this.currentFilter === "All") {
            this.filterAndRender("All", document.querySelector('[data-filter="All"]'));
        } else {
            this.applyCurrentFilter();
        }
    }

    applyCurrentFilter() {
        const activeButton = document.querySelector(`[data-filter="${this.currentFilter}"]`);
        this.filterAndRender(this.currentFilter, activeButton);
    }

    filterAndRender(filterType, activeButton) {
        let colorsToRender = [];
        const isGrouped = this.groupCheckbox.checked;

        const isFill = (shapeType) => shapeType === "fill";
        const isStroke = (shapeType) => shapeType === "stroke" || shapeType === "stroke (unknown)";
        const isGradientFill = (shapeType) => shapeType === "gradient fill";
        const isGradientStroke = (shapeType) => shapeType === "gradient stroke";

        const filterCondition = (c) => {
            if (filterType === "All") return true;
            if (filterType === "Fill") return isFill(c.shapeType);
            if (filterType === "Stroke") return isStroke(c.shapeType);
            if (filterType.toLowerCase() === "gradient") {
                return isGradientFill(c.shapeType) || isGradientStroke(c.shapeType);
            }
            if (filterType === "Gradient Fill") return isGradientFill(c.shapeType);
            if (filterType === "Gradient Stroke") return isGradientStroke(c.shapeType);
            return c.shapeType.toLowerCase().includes(filterType.toLowerCase());
        };

        if (isGrouped) {
            const groupedColors = this.colorExtractor.getGroupedColors();
            colorsToRender = Object.values(groupedColors).filter((g) => {
                return g.instances.some(filterCondition);
            });
        } else {
            colorsToRender = this.allExtractedColors.filter(filterCondition);
        }

        // Update active filter button
        document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
        if (activeButton) {
            activeButton.classList.add("active");
        }

        this.colorRenderer.renderColors(colorsToRender, isGrouped, filterType);
    }

    reloadAnim() {
        const shouldPlayAfterReload = this.animController.loadAnimation(
            this.animData,
            (totalFrames) => {
                this.slider.max = totalFrames - 1;
                this.frameInput.max = totalFrames - 1;
                this.frameTotalLabel.textContent = `/ ${totalFrames - 1}`;
            },
            (currentFrame) => {
                this.slider.value = currentFrame;
                this.frameInput.value = Math.round(currentFrame);
            }
        );

        if (this.animData) {
            this.playPauseBtn.textContent = shouldPlayAfterReload ? "Pause" : "Play";
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new LottieEditor();
});
