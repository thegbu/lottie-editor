import { FileHandler } from "./modules/FileHandler.js";
import { ColorExtractor } from "./modules/ColorExtractor.js";
import { ColorRenderer } from "./modules/ColorRenderer.js";
import { AnimationController } from "./modules/AnimationController.js";
import { HistoryManager } from "./modules/HistoryManager.js";
import { ExportManager } from "./modules/ExportManager.js";
import { HslAdjustManager } from "./modules/HueShiftManager.js";

/**
 * Main Lottie Editor class - orchestrates all modules and handles UI interactions.
 */
class LottieEditor {
    constructor() {
        // --- Core Data Initialization ---
        this.animData = null; // Current modified animation data
        this.originalAnimData = null; // Unmodified animation data for reset
        this.allExtractedColors = [];
        this.currentFilter = "All";
        this.wasPlayingBeforeModal = false;

        // --- Module Initialization ---
        this.fileHandler = new FileHandler();
        this.colorExtractor = new ColorExtractor();
        this.historyManager = new HistoryManager(20); // Stores up to 20 states for Undo/Redo
        this.exportManager = new ExportManager();
        this.animController = new AnimationController("anim"); // Manages lottie animation playback
        this.hslManager = new HslAdjustManager(); // Manages HSL color adjustments

        // --- DOM Elements Initialization (omitted for brevity) ---
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

        // HSL controls
        this.hueSlider = document.getElementById("hueSlider");
        this.hueInput = document.getElementById("hueInput");
        this.saturationSlider = document.getElementById("saturationSlider");
        this.saturationInput = document.getElementById("saturationInput");
        this.lightnessSlider = document.getElementById("lightnessSlider");
        this.lightnessInput = document.getElementById("lightnessInput");
        this.resetHslBtn = document.getElementById("resetHslBtn");

        // --- ColorRenderer Callbacks ---
        // These callbacks ensure UI and animation stay in sync when colors are modified via ColorRenderer.
        this.colorRenderer = new ColorRenderer(
            this.colorList,
            () => {
                // Callback 1: After individual color change (re-extract colors and reload anim)
                this.allExtractedColors = this.colorExtractor.extractColors(this.animData);
                this.reloadAnim();
            },
            () => {
                // Callback 2: After gradient position change (re-extract, reload, and re-render list)
                this.allExtractedColors = this.colorExtractor.extractColors(this.animData);
                this.reloadAnim();
                this.applyCurrentFilter();
            },
            () => this.saveState(), // Callback 3: Save state for Undo/Redo
            this.hslManager,
            (path) => {
                // Callback 4: On lock toggle (re-apply HSL adjustments to respect new lock state)
                if (this.hslManager.hasAdjustments()) {
                    const { hue, saturation, lightness } = this.hslManager.getCurrentAdjustments();
                    this.applyHslAdjustments(hue, saturation, lightness);
                }
                this.applyCurrentFilter(); // Re-render color list to update lock icon state
            }
        );

        this.initEventListeners();
    }

    /**
     * Sets up all event listeners for the application's UI elements.
     */
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

        // Keyboard shortcuts (Ctrl/Cmd + Z for Undo, Ctrl/Cmd + Shift + Z for Redo)
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

        // Slider events: controls frame scrub/preview
        this.slider.oninput = () => {
            const frame = parseFloat(this.slider.value);
            this.animController.pause();
            this.animController.goToFrame(frame, true);
            this.playPauseBtn.textContent = "Play";
            this.frameInput.value = Math.round(frame);
        };

        // Frame input events: syncs with slider
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

        // HSL controls: Bidirectional sync and adjustment application
        const handleHslChange = (fromInput = false) => {
            let hue, saturation, lightness;

            if (fromInput) {
                hue = parseInt(this.hueInput.value) || 0;
                saturation = parseInt(this.saturationInput.value) || 0;
                lightness = parseInt(this.lightnessInput.value) || 0;

                // Clamp values to valid ranges
                hue = Math.max(-180, Math.min(180, hue));
                saturation = Math.max(-100, Math.min(100, saturation));
                lightness = Math.max(-100, Math.min(100, lightness));

                // Sync sliders with clamped values
                this.hueSlider.value = hue;
                this.saturationSlider.value = saturation;
                this.lightnessSlider.value = lightness;
            } else {
                hue = parseInt(this.hueSlider.value);
                saturation = parseInt(this.saturationSlider.value);
                lightness = parseInt(this.lightnessSlider.value);
            }

            // Always sync input fields
            this.hueInput.value = hue;
            this.saturationInput.value = saturation;
            this.lightnessInput.value = lightness;

            this.resetHslBtn.disabled = (hue === 0 && saturation === 0 && lightness === 0);
            this.applyHslAdjustments(hue, saturation, lightness);
        };

        this.hueSlider.oninput = () => handleHslChange(false);
        this.saturationSlider.oninput = () => handleHslChange(false);
        this.lightnessSlider.oninput = () => handleHslChange(false);

        // Reset HSL button
        this.resetHslBtn.onclick = () => {
            this.resetHslAdjustments();
        };

        // Save state on slider release (for Undo/Redo)
        const saveHslState = () => this.saveState();
        this.hueSlider.onchange = saveHslState;
        this.saturationSlider.onchange = saveHslState;
        this.lightnessSlider.onchange = saveHslState;

        // Wrap input handlers to apply changes and save state
        const wrapInputHandler = (element) => {
            element.onchange = () => {
                handleHslChange(true);
                this.saveState();
            };
        };
        wrapInputHandler(this.hueInput);
        wrapInputHandler(this.saturationInput);
        wrapInputHandler(this.lightnessInput);
    }

    /**
     * Handles file loading (Lottie/TGS) and initializes the editor state.
     * @param {File} file - The file uploaded by the user.
     */
    async handleFile(file) {
        if (!file) return;

        try {
            this.fileNameDisplay.textContent = `Loaded: ${file.name}`;

            const animData = await this.fileHandler.loadFile(file);

            this.originalAnimData = animData;
            this.animData = JSON.parse(JSON.stringify(animData));

            this.historyManager.clear();
            this.saveState();

            // Reset HSL adjustments and UI
            this.hslManager.clear();
            this.hueSlider.value = 0;
            this.saturationSlider.value = 0;
            this.lightnessSlider.value = 0;
            this.hueInput.value = 0;
            this.saturationInput.value = 0;
            this.lightnessInput.value = 0;
            this.hueSlider.disabled = false;
            this.saturationSlider.disabled = false;
            this.lightnessSlider.disabled = false;
            this.hueInput.disabled = false;
            this.saturationInput.disabled = false;
            this.lightnessInput.disabled = false;
            this.resetHslBtn.disabled = true;

            this.exportBtn.disabled = false;
            this.resetBtn.disabled = false;
            this.playPauseBtn.textContent = "Play";

            this.initializeColorEditor(this.animData);
            this.reloadAnim();
        } catch (error) {
            console.error("Error loading or parsing animation file:", error);
            this.fileNameDisplay.textContent = `Error: Invalid Lottie/TGS file.`;
            alert(`An error occurred while loading the file. Error detail: ${error.message}`);
        }
    }

    /**
     * Saves the current animation data and HSL settings to the history manager.
     */
    saveState() {
        const state = {
            animData: this.animData,
            hsl: this.hslManager.getCurrentAdjustments()
        };
        this.historyManager.saveState(state);
    }

    /**
     * Reverts to the previous state in history (Undo).
     */
    undoChange() {
        const previousState = this.historyManager.undo();
        if (!previousState) return;

        let animData, hsl;
        if (previousState.animData) {
            animData = previousState.animData;
            hsl = previousState.hsl;
        } else {
            // Backward compatibility for older states
            animData = previousState;
            hsl = { hue: 0, saturation: 0, lightness: 0 };
        }

        this.animData = animData;
        this.hslManager.setAdjustments(hsl.hue, hsl.saturation, hsl.lightness);
        this.updateHslUI(hsl.hue, hsl.saturation, hsl.lightness);

        this.allExtractedColors = this.colorExtractor.extractColors(this.animData);
        this.reloadAnim();
        this.applyCurrentFilter();
    }

    /**
     * Advances to the next state in history (Redo).
     */
    redoChange() {
        const currentState = {
            animData: this.animData,
            hsl: this.hslManager.getCurrentAdjustments()
        };

        const redoState = this.historyManager.redo(currentState);
        if (!redoState) return;

        let animData, hsl;
        if (redoState.animData) {
            animData = redoState.animData;
            hsl = redoState.hsl;
        } else {
            // Backward compatibility for older states
            animData = redoState;
            hsl = { hue: 0, saturation: 0, lightness: 0 };
        }

        this.animData = animData;
        this.hslManager.setAdjustments(hsl.hue, hsl.saturation, hsl.lightness);
        this.updateHslUI(hsl.hue, hsl.saturation, hsl.lightness);

        this.allExtractedColors = this.colorExtractor.extractColors(this.animData);
        this.reloadAnim();
        this.applyCurrentFilter();
    }

    /**
     * Resets the animation colors to the original loaded file data.
     */
    resetColors() {
        if (!this.originalAnimData) return;

        this.saveState();
        this.animData = JSON.parse(JSON.stringify(this.originalAnimData));

        this.hslManager.clear();
        this.updateHslUI(0, 0, 0);

        this.initializeColorEditor(this.animData);
        this.reloadAnim();
    }

    /**
     * Applies HSL adjustments to the animation data, bypassing locked colors.
     * @param {number} hue - Hue shift value (-180 to 180).
     * @param {number} saturation - Saturation adjustment value (-100 to 100).
     * @param {number} lightness - Lightness adjustment value (-100 to 100).
     */
    applyHslAdjustments(hue, saturation, lightness) {
        if (!this.animData) return;

        this.animData = this.hslManager.applyAdjustments(this.animData, hue, saturation, lightness);

        this.allExtractedColors = this.colorExtractor.extractColors(this.animData);
        this.reloadAnim();
        this.applyCurrentFilter();
    }

    /**
     * Updates the HSL slider and input fields.
     */
    updateHslUI(hue, saturation, lightness) {
        this.hueSlider.value = hue;
        this.saturationSlider.value = saturation;
        this.lightnessSlider.value = lightness;
        this.hueInput.value = hue;
        this.saturationInput.value = saturation;
        this.lightnessInput.value = lightness;

        const hasAdjustments = (hue !== 0 || saturation !== 0 || lightness !== 0);
        this.resetHslBtn.disabled = !hasAdjustments;
    }

    /**
     * Resets HSL adjustments and restores original animation data from the HSL Manager.
     */
    resetHslAdjustments() {
        if (!this.animData) return;

        this.saveState();

        // Clear all locks as requested
        this.hslManager.clearLocks();

        const originalData = this.hslManager.reset();
        if (originalData) {
            this.animData = originalData;
        }

        this.hueSlider.value = 0;
        this.saturationSlider.value = 0;
        this.lightnessSlider.value = 0;
        this.hueInput.value = 0;
        this.saturationInput.value = 0;
        this.lightnessInput.value = 0;
        this.resetHslBtn.disabled = true;

        this.allExtractedColors = this.colorExtractor.extractColors(this.animData);
        this.reloadAnim();
        this.applyCurrentFilter();
    }

    /**
     * Toggles the animation play/pause state.
     */
    togglePlay() {
        const isPaused = this.animController.togglePlay();
        this.playPauseBtn.textContent = isPaused ? "Play" : "Pause";
    }

    /**
     * Displays the export modal and pauses the animation.
     */
    showExportModal() {
        if (!this.originalAnimData) {
            alert("Please load a Lottie or TGS file first.");
            return;
        }

        this.wasPlayingBeforeModal = !this.animController.getState().isPaused;
        if (this.wasPlayingBeforeModal) {
            this.animController.pause();
            this.playPauseBtn.textContent = "Play";
        }

        this.modal.style.display = "flex";

        const currentFrame = Math.round(this.slider.value);
        this.exportFrameInput.value = currentFrame;
        this.exportFrameInput.max = this.slider.max;

        setTimeout(() => this.modal.classList.add("show"), 10);
    }

    /**
     * Closes the export modal and resumes the animation if it was playing.
     */
    closeModal() {
        this.modal.classList.remove("show");
        setTimeout(() => {
            this.modal.style.display = "none";

            if (this.wasPlayingBeforeModal) {
                this.animController.togglePlay();
                this.playPauseBtn.textContent = "Pause";
                this.wasPlayingBeforeModal = false;
            }
        }, 300);
    }

    /**
     * Initiates the export process for JSON or TGS.
     * @param {string} format - 'json' or 'tgs'.
     */
    handleExport(format) {
        this.closeModal();
        this.exportManager.export(
            this.originalAnimData,
            this.animData,
            format,
            (src, tgt) => this.fileHandler.deepTraverseAndCopyColors(src, tgt)
        );
    }

    /**
     * Handles exporting the current frame as an SVG file.
     */
    handleSvgExport() {
        const frame = parseInt(this.exportFrameInput.value);
        if (isNaN(frame) || frame < 0) {
            alert("Please enter a valid frame number.");
            return;
        }

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

                // Restore previous frame state
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

    /**
     * Extracts colors and initializes the color list rendering.
     * @param {object} data - The animation data.
     */
    initializeColorEditor(data) {
        this.allExtractedColors = this.colorExtractor.extractColors(data);
        if (this.currentFilter === "All") {
            this.filterAndRender("All", document.querySelector('[data-filter="All"]'));
        } else {
            this.applyCurrentFilter();
        }
    }

    /**
     * Re-applies the currently active color filter and renders the list.
     */
    applyCurrentFilter() {
        const activeButton = document.querySelector(`[data-filter="${this.currentFilter}"]`);
        this.filterAndRender(this.currentFilter, activeButton);
    }

    /**
     * Filters the extracted colors and renders them to the UI.
     * @param {string} filterType - The type of color to filter (e.g., 'Fill', 'Stroke', 'Gradient').
     * @param {HTMLElement} activeButton - The active filter button element.
     */
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
            // Filter grouped colors by checking if any instance matches the filter condition
            const groupedColors = this.colorExtractor.getGroupedColors();
            colorsToRender = Object.values(groupedColors).filter((g) => {
                return g.instances.some(filterCondition);
            });
        } else {
            // Filter individual color instances
            colorsToRender = this.allExtractedColors.filter(filterCondition);
        }

        document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
        if (activeButton) {
            activeButton.classList.add("active");
        }

        this.colorRenderer.renderColors(colorsToRender, isGrouped, filterType);
    }

    /**
     * Reloads the animation with the current modified data.
     */
    reloadAnim() {
        const shouldPlayAfterReload = this.animController.loadAnimation(
            this.animData,
            (totalFrames) => {
                // Update frame controls max values
                this.slider.max = totalFrames - 1;
                this.frameInput.max = totalFrames - 1;
                this.frameTotalLabel.textContent = `/ ${totalFrames - 1}`;
            },
            (currentFrame) => {
                // Update frame controls during playback
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