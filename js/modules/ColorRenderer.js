import { hexToRgb } from "../utils/colorUtils.js";

/**
 * Renders color UI elements and handles color input changes
 */
export class ColorRenderer {
    constructor(containerElement, onColorChange, onGradientPositionChange, onSaveState) {
        this.container = containerElement;
        this.onColorChange = onColorChange;
        this.onGradientPositionChange = onGradientPositionChange;
        this.onSaveState = onSaveState;
    }
    /**
     * Render colors to the UI
     * @param {Array} colors - Array of color objects to render
     * @param {boolean} isGrouped - Whether colors are grouped
     * @param {string} filterType - Current filter type
     */
    renderColors(colors, isGrouped, filterType = "All") {
        this.container.innerHTML = "";

        if (colors.length === 0) {
            this.container.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #666;">No colors found for this filter type.</p>';
            return;
        }

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

    /**
     * Render a single color card
     * @param {Object} c - Color object
     * @param {number} index - Color index
     * @param {boolean} isGrouped - Whether this is a grouped color
     */
    renderSingleColorCard(c, index, isGrouped, targetContainer, filterType = "All") {
        const card = document.createElement("div");
        card.className = "color-card";

        const input = document.createElement("input");
        input.type = "color";
        input.value = c.hex;

        input.onfocus = () => this.onSaveState();
        input.onchange = () => this.onSaveState();
        input.oninput = () => this.handleColorInput(input, c, isGrouped);

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

        card.appendChild(input);
        card.appendChild(label);
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

            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.value = stop.hex;
            colorInput.onfocus = () => this.onSaveState();
            colorInput.onchange = () => this.onSaveState();
            colorInput.oninput = () => this.handleColorInput(colorInput, stop, false);

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

            const hexLabel = document.createElement("label");
            hexLabel.textContent = stop.hex.toUpperCase();
            hexLabel.style.fontSize = "0.75rem";
            hexLabel.style.marginTop = "4px";
            hexLabel.style.marginBottom = "4px";

            stopDiv.appendChild(colorInput);
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

    /**
     * Handle color input change
     * @param {HTMLInputElement} input - Color input element
     * @param {Object} c - Color object
     * @param {boolean} isGrouped - Whether this is a grouped color
     */
    handleColorInput(input, c, isGrouped) {
        const newHex = input.value;
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

        // Update the label if it exists (for gradient stops)
        if (input.nextElementSibling && input.nextElementSibling.tagName === "LABEL") {
            input.nextElementSibling.textContent = newHex.toUpperCase();
        }

        this.onColorChange();
    }
}
