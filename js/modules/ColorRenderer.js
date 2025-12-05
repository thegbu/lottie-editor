import { hexToRgb } from "../utils/colorUtils.js";
import { ColorPicker } from "./ColorPicker.js";

/**
 * Renders color UI elements and handles color input changes
 */
export class ColorRenderer {
    constructor(containerElement, onColorChange, onGradientPositionChange, onSaveState) {
        this.container = containerElement;
        this.onColorChange = onColorChange;
        this.onGradientPositionChange = onGradientPositionChange;
        this.onSaveState = onSaveState;
        this.colorPickers = []; // Track all color picker instances
    }
    /**
     * Render colors to the UI
     * @param {Array} colors - Array of color objects to render
     * @param {boolean} isGrouped - Whether colors are grouped
     * @param {string} filterType - Current filter type
     */
    renderColors(colors, isGrouped, filterType = "All") {
        // Clean up existing color pickers
        this.colorPickers.forEach(picker => picker.destroy());
        this.colorPickers = [];

        this.container.innerHTML = "";

        if (colors.length === 0) {
            this.container.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #666;">No colors found for this filter type.</p>';
            return;
        }

        // === Global HSV Sliders ===
        const hsvControls = document.createElement("div");
        hsvControls.className = "hsv-controls";
        hsvControls.innerHTML = `
            <label>Hue:
                <input id="val-hue" class="color-input" type="number" min="0" max="360" value="0" style="width:80px;">
                <input id="global-hue" type="range" min="0" max="360" value="0">
            </label>

            <label>Saturation:
                <input id="val-sat" class="color-input" type="number" min="-100" max="100" value="0" style="width:80px;">
                <input id="global-sat" type="range" min="-100" max="100" value="0">
            </label>

            <label>Value:
                <input id="val-value" class="color-input" type="number" min="-100" max="100" value="0" style="width:80px;">
                <input id="global-value" type="range" min="-100" max="100" value="0">
            </label>
        `;
        this.container.appendChild(hsvControls);

        // Attach slider listeners
        const hueSlider = hsvControls.querySelector("#global-hue");
        const satSlider = hsvControls.querySelector("#global-sat");
        const valueSlider = hsvControls.querySelector("#global-value");

        const hueValue = hsvControls.querySelector("#val-hue");
        const satValue = hsvControls.querySelector("#val-sat");
        const valueValue = hsvControls.querySelector("#val-value");

        const updateAllColors = () => {
            hueValue.value = hueSlider.value;
            satValue.value = satSlider.value;
            valueValue.value = valueSlider.value;

            this.applyGlobalHsv(
                parseFloat(hueSlider.value),
                parseFloat(satSlider.value),
                parseFloat(valueSlider.value)
            );

            this.onColorChange();
        };

        // When typing, sync slider and update
        hueValue.oninput = () => {
            hueSlider.value = hueValue.value;
            updateAllColors();
        };
        satValue.oninput = () => {
            satSlider.value = satValue.value;
            updateAllColors();
        };
        valueValue.oninput = () => {
            valueSlider.value = valueValue.value;
            updateAllColors();
        };

        hueSlider.oninput = updateAllColors;
        satSlider.oninput = updateAllColors;
        valueSlider.oninput = updateAllColors;


        // Create separate containers for grid (solids) and flex (gradients)
        const gridContainer = document.createElement("div");
        gridContainer.className = "colors-grid";

        const flexContainer = document.createElement("div");
        flexContainer.className = "colors-flex";

        let hasSolids = false;
        let hasGradients = false;

        if (isGrouped) {
            // For grouped colors, we treat them all as fitting in the grid
            colors.forEach((c, i) => {
                this.renderSingleColorCard(c, i, true, gridContainer, filterType);
                hasSolids = true;
            });
        } else {
            const solids = colors.filter(c => c.type !== "gradient");
            const gradients = colors.filter(c => c.type === "gradient");

            if (solids.length > 0) {
                solids.forEach((c, i) => {
                    this.renderSingleColorCard(c, i, false, gridContainer, filterType);
                });
                hasSolids = true;
            }

            if (gradients.length > 0) {
                let i = 0;
                while (i < gradients.length) {
                    const c = gradients[i];
                    const gradientStops = [c];
                    let j = i + 1;
                    while (j < gradients.length && gradients[j].ref === c.ref) {
                        gradientStops.push(gradients[j]);
                        j++;
                    }
                    this.renderGradientBar(gradientStops, i, flexContainer);
                    i = j;
                }
                hasGradients = true;
            }
        }

        // Append containers to the main container
        if (hasSolids) {
            this.container.appendChild(gridContainer);
        }

        if (hasGradients) {
            this.container.appendChild(flexContainer);
        }
    }

    applyGlobalHsv(h, s, v) {
        this.colorPickers.forEach(picker => {
            picker.updateShift(h, s, v);
        });
    }

    /**
     * Render a single color card
     * @param {Object} c - Color object
     * @param {number} index - Color index
     * @param {boolean} isGrouped - Whether this is a grouped color
     */
    renderSingleColorCard(c, index, isGrouped, targetContainer, filterType = "All") {
        const card = document.createElement("div");
        card.className = "color-card";

        // Create a container for the color picker that will be styled like a circular swatch
        const pickerContainer = document.createElement("div");
        pickerContainer.style.width = "50px";
        pickerContainer.style.height = "50px";
        pickerContainer.style.position = "relative";

        // Create label first so we can reference it in onChange
        const label = document.createElement("label");
        if (isGrouped) {
            label.textContent = `${c.count} instances of ${c.hex.toUpperCase()}`;
        } else {
            if (filterType === "All") {
                label.innerHTML = `${c.shapeType} ${index + 1}<br>${c.hex.toUpperCase()}`;
            } else {
                label.textContent = c.hex.toUpperCase();
            }
        }

        // Create the ColorPicker
        const picker = new ColorPicker({
            initialColor: c.hex,
            onChange: (colorObj) => {
                const newHex = colorObj.hex;
                const { r, g, b } = hexToRgb(newHex);
                let colorsToUpdate = isGrouped ? c.instances : [c];

                colorsToUpdate.forEach((instance) => {
                    const normalizedR = r / 255;
                    const normalizedG = g / 255;
                    const normalizedB = b / 255;

                    if (instance.type === "solid" || instance.type === "stroke") {
                        if (instance.ref.hasOwnProperty("s")) {
                            instance.ref.s = [normalizedR, normalizedG, normalizedB, 1];
                        } else if (instance.ref.hasOwnProperty("k")) {
                            instance.ref.k = [normalizedR, normalizedG, normalizedB, 1];
                        }
                    } else if (instance.type === "gradient") {
                        if (instance.ref.hasOwnProperty("s") && Array.isArray(instance.ref.s)) {
                            instance.ref.s[instance.index + 1] = normalizedR;
                            instance.ref.s[instance.index + 2] = normalizedG;
                            instance.ref.s[instance.index + 3] = normalizedB;
                        } else if (instance.ref.hasOwnProperty("k") && Array.isArray(instance.ref.k)) {
                            instance.ref.k[instance.index + 1] = normalizedR;
                            instance.ref.k[instance.index + 2] = normalizedG;
                            instance.ref.k[instance.index + 3] = normalizedB;
                        }
                    }
                });

                c.hex = newHex;

                // Update the trigger's background color
                picker.trigger.style.background = newHex;

                // Update the label
                if (isGrouped) {
                    label.textContent = `${c.count} instances of ${newHex.toUpperCase()}`;
                } else {
                    if (filterType === "All") {
                        label.innerHTML = `${c.shapeType} ${index + 1}<br>${newHex.toUpperCase()}`;
                    } else {
                        label.textContent = newHex.toUpperCase();
                    }
                }

                this.onColorChange();
            },
            onOpen: () => this.onSaveState(),
            container: pickerContainer,
            showEyedropper: true
        });

        // Track the picker instance
        this.colorPickers.push(picker);

        // Style the trigger to look like a circular swatch matching the original design
        const trigger = picker.trigger;
        trigger.style.width = "50px";
        trigger.style.height = "50px";
        trigger.style.padding = "0";
        trigger.style.borderRadius = "50%";
        trigger.style.background = c.hex;
        trigger.style.border = "none";
        trigger.style.boxShadow = "inset 0 0 0 1px rgba(0, 0, 0, 0.1)";
        trigger.innerHTML = ""; // Remove default content

        card.appendChild(pickerContainer);
        card.appendChild(label);
        
        // Ignore Global Shift checkbox
        const ignoreWrap = document.createElement("label");
        ignoreWrap.style.display = "flex";
        ignoreWrap.style.alignItems = "center";
        ignoreWrap.style.gap = "4px";
        ignoreWrap.style.fontSize = "0.75rem";

        const ignoreBox = document.createElement("input");
        ignoreBox.type = "checkbox";
        ignoreBox.checked = picker.ignoreShift;
        ignoreBox.onchange = () => {
            picker.ignoreShift = ignoreBox.checked;
            picker.notifyChange();
        };

        ignoreWrap.appendChild(ignoreBox);
        ignoreWrap.append("Ignore Global Shift");
        
        card.appendChild(ignoreWrap);

        targetContainer.appendChild(card);
    }

    /**
     * Render a gradient bar with multiple stops
     * @param {Array} stops - Array of gradient stop objects
     * @param {number} startIndex - Starting index for labeling
     */
    renderGradientBar(stops, startIndex, targetContainer) {
        // Sort stops by offset for display
        stops.sort((a, b) => a.offset - b.offset);

        const card = document.createElement("div");
        card.className = "color-card gradient-card";

        const stopsContainer = document.createElement("div");
        stopsContainer.className = "gradient-stops";

        stops.forEach((stop, i) => {
            const stopDiv = document.createElement("div");
            stopDiv.className = "gradient-stop";

            // Create a container for the color picker
            const pickerContainer = document.createElement("div");
            pickerContainer.style.width = "50px";
            pickerContainer.style.height = "50px";
            pickerContainer.style.position = "relative";

            // Create the hex label BEFORE the picker so we can reference it in onChange
            const hexLabel = document.createElement("label");
            hexLabel.textContent = stop.hex.toUpperCase();
            hexLabel.style.fontSize = "0.75rem";
            hexLabel.style.marginTop = "4px";
            hexLabel.style.marginBottom = "4px";

            // Create the ColorPicker
            const picker = new ColorPicker({
                initialColor: stop.hex,
                onChange: (colorObj) => {
                    const newHex = colorObj.hex;
                    const { r, g, b } = hexToRgb(newHex);
                    const normalizedR = r / 255;
                    const normalizedG = g / 255;
                    const normalizedB = b / 255;

                    if (stop.ref.hasOwnProperty("s") && Array.isArray(stop.ref.s)) {
                        stop.ref.s[stop.index + 1] = normalizedR;
                        stop.ref.s[stop.index + 2] = normalizedG;
                        stop.ref.s[stop.index + 3] = normalizedB;
                    } else if (stop.ref.hasOwnProperty("k") && Array.isArray(stop.ref.k)) {
                        stop.ref.k[stop.index + 1] = normalizedR;
                        stop.ref.k[stop.index + 2] = normalizedG;
                        stop.ref.k[stop.index + 3] = normalizedB;
                    }

                    stop.hex = newHex;
                    hexLabel.textContent = newHex.toUpperCase();

                    // Update the trigger's background color
                    picker.trigger.style.background = newHex;

                    this.onColorChange();
                },
                onOpen: () => this.onSaveState(),
                container: pickerContainer,
                showEyedropper: true
            });

            stop.picker = picker;

            // Track the picker instance
            this.colorPickers.push(picker);

            // Style the trigger to look like a circular swatch
            const trigger = picker.trigger;
            trigger.style.width = "50px";
            trigger.style.height = "50px";
            trigger.style.padding = "0";
            trigger.style.borderRadius = "50%";
            trigger.style.background = stop.hex;
            trigger.style.border = "none";
            trigger.style.boxShadow = "inset 0 0 0 1px rgba(0, 0, 0, 0.1)";
            trigger.innerHTML = ""; // Remove default content

            const posInput = document.createElement("input");
            posInput.type = "number";
            posInput.step = "0.01";
            posInput.min = "0";
            posInput.max = "1";
            posInput.value = stop.offset !== undefined ? stop.offset.toFixed(3) : "0";
            posInput.onfocus = () => this.onSaveState();
            posInput.onchange = () => {
                this.handleGradientPositionInput(posInput, stop);
                this.onSaveState();
            };

            stopDiv.appendChild(pickerContainer);
            stopDiv.appendChild(hexLabel);
            stopDiv.appendChild(posInput);
            stopsContainer.appendChild(stopDiv);
        });

        const infoDiv = document.createElement("div");
        infoDiv.className = "gradient-info";
        const label = document.createElement("label");
        label.textContent = `${stops[0].shapeType} ${startIndex + 1}`;
        infoDiv.appendChild(label);

        card.appendChild(infoDiv);
        card.appendChild(stopsContainer);

        // Ignore Global Shift checkbox
        const ignoreWrap = document.createElement("label");
        ignoreWrap.style.display = "flex";
        ignoreWrap.style.alignItems = "center";
        ignoreWrap.style.gap = "4px";
        ignoreWrap.style.fontSize = "0.75rem";

        const ignoreBox = document.createElement("input");
        ignoreBox.type = "checkbox";
        ignoreBox.checked = stops[0].picker?.ignoreShift || false;
        ignoreBox.onchange = () => {
            stops.forEach(s => {
                if (s.picker) {
                    s.picker.ignoreShift = ignoreBox.checked;
                    s.picker.notifyChange();
                }
            });
        };
        
        ignoreWrap.appendChild(ignoreBox);
        ignoreWrap.append("Ignore Global Shift");
        
        card.appendChild(ignoreWrap);

        targetContainer.appendChild(card);
    }

    /**
     * Handle gradient position input change
     * @param {HTMLInputElement} input - Position input element
     * @param {Object} c - Color object
     */
    handleGradientPositionInput(input, c) {
        const newOffset = parseFloat(input.value);
        if (isNaN(newOffset)) return;

        let arr;
        if (c.ref.hasOwnProperty("s") && Array.isArray(c.ref.s)) {
            arr = c.ref.s;
        } else if (c.ref.hasOwnProperty("k") && Array.isArray(c.ref.k)) {
            arr = c.ref.k;
        }

        if (arr) {
            // Update the offset at the current index
            arr[c.index] = newOffset;

            // Sort the gradient stops (chunks of 4: offset, r, g, b)
            // We assume the array contains only color stops in multiples of 4. 
            // Sometimes Lottie arrays have other data, but for gradient colors usually it's this structure.
            // We should be careful if the array length is not multiple of 4.
            // But ColorExtractor likely only extracts from valid gradient arrays.

            const chunkSize = 4;
            // Use c.stopCount if available to avoid touching transparency values
            const numStops = c.stopCount || Math.floor(arr.length / chunkSize);
            const stops = [];

            for (let i = 0; i < numStops; i++) {
                const start = i * chunkSize;
                stops.push(arr.slice(start, start + chunkSize));
            }

            // Sort by offset (first element of chunk)
            stops.sort((a, b) => a[0] - b[0]);

            // Flatten back to the array
            for (let i = 0; i < numStops; i++) {
                const start = i * chunkSize;
                for (let j = 0; j < chunkSize; j++) {
                    arr[start + j] = stops[i][j];
                }
            }
        }

        c.offset = newOffset;
        this.onGradientPositionChange();
    }
}
