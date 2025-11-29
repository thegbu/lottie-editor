export class ColorPicker {
    // Static array to track all picker instances
    static instances = [];

    constructor(options = {}) {
        this.options = {
            initialColor: options.initialColor || '#3b82f6',
            onChange: options.onChange || (() => { }),
            onOpen: options.onOpen || (() => { }),
            onClose: options.onClose || (() => { }),
            showAlpha: false,
            showSwatches: false,
            showEyedropper: options.showEyedropper !== false && this.isEyeDropperSupported(),
            container: options.container || null
        };

        // Store state in HSV for accurate 2D picker representation
        this.hsv = this.parseToHsv(this.options.initialColor);
        this.isDragging = false;
        this.activeSlider = null;
        this.isOpen = false;
        this.currentFormat = 'hex';
        this.scrollListener = null;

        // Register this instance
        ColorPicker.instances.push(this);

        this.init();
    }

    init() {
        this.createElements();
        this.attachEventListeners();
        this.updateUI();
    }

    createElements() {
        // Main container
        this.container = document.createElement('div');
        this.container.className = 'color-picker-component';

        // Color trigger button
        this.trigger = document.createElement('button');
        this.trigger.className = 'color-picker-trigger';
        this.trigger.innerHTML = `
      <div class="color-preview" style="background-color: ${this.getColorString()}"></div>
      <span class="color-value">${this.getColorString()}</span>
    `;

        // Picker popup
        this.popup = document.createElement('div');
        this.popup.className = 'color-picker-popup';
        this.popup.style.display = 'none';

        // SVG Icons
        const eyedropperIcon = `<svg width="16" height="16" viewBox="0 0 5.12 5.12" xmlns="http://www.w3.org/2000/svg"><path d="m3.596 2.316.098.098a.32.32 0 0 1 0 .453l-.141.141a.16.16 0 0 1-.226 0L2.113 1.794a.16.16 0 0 1 0-.226l.141-.141a.32.32 0 0 1 .453 0l.098.098.552-.552a.567.567 0 0 1 .789-.019.56.56 0 0 1 .011.803Z" opacity=".2"/><path d="M4.48 1.35a.72.72 0 0 0-.225-.513.73.73 0 0 0-1.012.022l-.439.439a.48.48 0 0 0-.663.015L2 1.454a.32.32 0 0 0 0 .453l.041.041-1.007 1.007a.8.8 0 0 0-.22.715l-.196.448a.27.27 0 0 0 .058.304.32.32 0 0 0 .226.094.3.3 0 0 0 .129-.027l.42-.183a.8.8 0 0 0 .715-.22l1.007-1.007.041.041a.32.32 0 0 0 .453 0l.141-.141a.48.48 0 0 0 .015-.663l.447-.447a.7.7 0 0 0 .211-.519M1.939 3.859a.48.48 0 0 1-.464.124.16.16 0 0 0-.105.008l-.429.187.187-.429a.16.16 0 0 0 .008-.105.48.48 0 0 1 .124-.464l1.007-1.007.679.679Zm2.104-2.216-.56.56a.16.16 0 0 0 0 .226l.098.098a.16.16 0 0 1 0 .226l-.141.141L2.226 1.68l.141-.141a.16.16 0 0 1 .226 0l.098.098a.16.16 0 0 0 .226 0l.552-.552a.41.41 0 0 1 .566-.016.4.4 0 0 1 .008.574"/></svg>`;
        const copyIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
        const checkIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

        this.popup.innerHTML = `
      <div class="picker-header">
        <div class="picker-tabs">
          <button class="picker-tab active" data-format="hex">HEX</button>
          <button class="picker-tab" data-format="rgb">RGB</button>
          <button class="picker-tab" data-format="hsl">HSL</button>
        </div>
        ${this.options.showEyedropper ? `<button class="eyedropper-btn" title="Pick color from screen">${eyedropperIcon}</button>` : ''}
      </div>
      
      <div class="picker-body">
        <!-- Main color area (Saturation/Value) -->
        <div class="color-area-container">
          <div class="color-area">
            <div class="color-area-overlay white-overlay"></div>
            <div class="color-area-overlay black-overlay"></div>
            <div class="color-area-cursor"></div>
          </div>
        </div>
        
        <!-- Sliders section -->
        <div class="sliders-container">
          <!-- Hue slider -->
          <div class="slider-wrapper">
            <div class="slider hue-slider">
              <div class="slider-track hue-track"></div>
              <div class="slider-thumb"></div>
            </div>
          </div>
        </div>
        
        <!-- Color inputs -->
        <div class="color-inputs-wrapper">
          <div class="inputs-container" id="inputs-container">
            <!-- Inputs injected dynamically -->
          </div>
          <button class="copy-btn" title="Copy color" data-icon-copy='${copyIcon}' data-icon-check='${checkIcon}'>${copyIcon}</button>
        </div>
      </div>
    `;

        this.container.appendChild(this.trigger);
        // Append popup to body for proper z-index layering
        document.body.appendChild(this.popup);

        // Cache references
        this.colorArea = this.popup.querySelector('.color-area');
        this.colorAreaCursor = this.popup.querySelector('.color-area-cursor');
        this.hueSlider = this.popup.querySelector('.hue-slider');
        this.inputsContainer = this.popup.querySelector('#inputs-container');
        this.tabs = this.popup.querySelectorAll('.picker-tab');

        // Append to container
        if (this.options.container) {
            this.options.container.appendChild(this.container);
        }
    }

    attachEventListeners() {
        // Trigger
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        // Dragging
        this.colorArea.addEventListener('mousedown', (e) => this.startDrag(e, 'area'));
        this.colorArea.addEventListener('touchstart', (e) => this.startDrag(e, 'area'), { passive: false });

        this.hueSlider.addEventListener('mousedown', (e) => this.startDrag(e, 'hue'));
        this.hueSlider.addEventListener('touchstart', (e) => this.startDrag(e, 'hue'), { passive: false });

        document.addEventListener('mousemove', (e) => this.handleDrag(e));
        document.addEventListener('touchmove', (e) => this.handleDrag(e), { passive: false });
        document.addEventListener('mouseup', () => this.endDrag());
        document.addEventListener('touchend', () => this.endDrag());

        // Tabs
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFormat = tab.dataset.format;
                this.updateInputsUI();
            });
        });

        // Copy
        const copyBtn = this.popup.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => this.copyColor());

        // Eyedropper
        if (this.options.showEyedropper) {
            const eyedropperBtn = this.popup.querySelector('.eyedropper-btn');
            eyedropperBtn?.addEventListener('click', () => this.openEyeDropper());
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.container.contains(e.target) && !this.popup.contains(e.target)) {
                this.close();
            }
        });
    }

    startDrag(e, type) {
        e.preventDefault();

        // If an input is focused, blur it so updates can resume immediately
        if (document.activeElement && this.container.contains(document.activeElement)) {
            document.activeElement.blur();
        }

        this.isDragging = true;
        this.activeSlider = type;
        this.handleDrag(e);
    }

    handleDrag(e) {
        if (!this.isDragging) return;

        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        if (this.activeSlider === 'area') {
            this.updateColorArea(clientX, clientY);
        } else if (this.activeSlider === 'hue') {
            this.updateHue(clientX, clientY);
        }
    }

    endDrag() {
        this.isDragging = false;
        this.activeSlider = null;
    }

    updateColorArea(clientX, clientY) {
        const rect = this.colorArea.getBoundingClientRect();
        let x = clientX - rect.left;
        let y = clientY - rect.top;

        x = Math.max(0, Math.min(x, rect.width));
        y = Math.max(0, Math.min(y, rect.height));

        // Map X to Saturation (0-100)
        // Map Y to Value (100-0)
        this.hsv.s = (x / rect.width) * 100;
        this.hsv.v = 100 - (y / rect.height) * 100;

        this.updateUI();
        this.notifyChange();
    }

    updateHue(clientX, clientY) {
        const rect = this.hueSlider.getBoundingClientRect();
        let x = clientX - rect.left;
        x = Math.max(0, Math.min(x, rect.width));

        this.hsv.h = (x / rect.width) * 360;

        this.updateUI();
        this.notifyChange();
    }

    updateUI() {
        // Update color area background (pure hue)
        const hueColor = `hsl(${this.hsv.h}, 100%, 50%)`;
        this.colorArea.style.backgroundColor = hueColor;

        // Update cursor position
        const areaRect = this.colorArea.getBoundingClientRect();
        if (areaRect.width > 0) {
            const cursorX = (this.hsv.s / 100) * areaRect.width;
            const cursorY = (1 - this.hsv.v / 100) * areaRect.height;
            this.colorAreaCursor.style.left = `${cursorX}px`;
            this.colorAreaCursor.style.top = `${cursorY}px`;
        }

        // Update hue slider thumb
        const hueThumb = this.hueSlider.querySelector('.slider-thumb');
        const huePercent = (this.hsv.h / 360) * 100;
        hueThumb.style.left = `${huePercent}%`;

        // Update trigger (only if it has the default structure)
        const colorString = this.getColorString();
        const colorPreview = this.trigger.querySelector('.color-preview');
        const colorValue = this.trigger.querySelector('.color-value');

        if (colorPreview) {
            colorPreview.style.backgroundColor = colorString;
        }
        if (colorValue) {
            colorValue.textContent = colorString;
        }

        // Update inputs if the user is NOT typing in them
        const activeElement = document.activeElement;
        const isTyping = activeElement &&
            activeElement.classList.contains('color-input') &&
            this.inputsContainer.contains(activeElement);

        if (!isTyping) {
            this.updateInputsUI();
        }
    }

    updateInputsUI() {
        this.inputsContainer.innerHTML = '';

        if (this.currentFormat === 'hex') {
            this.createInput('hex', this.getColorString('hex'), 'HEX');
        } else if (this.currentFormat === 'rgb') {
            const rgb = this.hsvToRgb(this.hsv.h, this.hsv.s, this.hsv.v);
            this.createInput('r', rgb.r, 'R');
            this.createInput('g', rgb.g, 'G');
            this.createInput('b', rgb.b, 'B');
        } else if (this.currentFormat === 'hsl') {
            const hsl = this.hsvToHsl(this.hsv.h, this.hsv.s, this.hsv.v);
            this.createInput('h', Math.round(hsl.h), 'H');
            this.createInput('s', Math.round(hsl.s), 'S');
            this.createInput('l', Math.round(hsl.l), 'L');
        }
    }

    createInput(id, value, label) {
        const group = document.createElement('div');
        group.className = 'input-group';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'color-input';
        input.value = value;
        input.dataset.type = id;

        const labelEl = document.createElement('span');
        labelEl.className = 'input-label';
        labelEl.textContent = label;

        // Listen for real-time input
        input.addEventListener('input', (e) => this.handleInputChange(e));

        // Handle Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            }
        });

        group.appendChild(input);
        group.appendChild(labelEl);
        this.inputsContainer.appendChild(group);
    }

    handleInputChange(e) {
        const value = e.target.value;

        if (this.currentFormat === 'hex') {
            const hsv = this.parseToHsv(value);
            if (hsv) {
                this.hsv = hsv;
                this.updateUI();
                this.notifyChange();
            }
        } else if (this.currentFormat === 'rgb') {
            const inputs = this.inputsContainer.querySelectorAll('input');
            const r = parseInt(inputs[0].value);
            const g = parseInt(inputs[1].value);
            const b = parseInt(inputs[2].value);

            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                this.hsv = this.rgbToHsv(
                    Math.max(0, Math.min(255, r)),
                    Math.max(0, Math.min(255, g)),
                    Math.max(0, Math.min(255, b))
                );
                this.updateUI();
                this.notifyChange();
            }
        } else if (this.currentFormat === 'hsl') {
            const inputs = this.inputsContainer.querySelectorAll('input');
            const h = parseInt(inputs[0].value);
            const s = parseInt(inputs[1].value);
            const l = parseInt(inputs[2].value);

            if (!isNaN(h) && !isNaN(s) && !isNaN(l)) {
                this.hsv = this.hslToHsv(
                    Math.max(0, Math.min(360, h)),
                    Math.max(0, Math.min(100, s)),
                    Math.max(0, Math.min(100, l))
                );
                this.updateUI();
                this.notifyChange();
            }
        }
    }

    notifyChange() {
        this.options.onChange(this.getColorObject());
    }

    // --- Color Conversion & Parsing ---

    parseToHsv(colorString) {
        if (!colorString) return null;
        colorString = colorString.trim().toLowerCase();

        // HEX
        if (colorString.startsWith('#')) {
            // Validate hex length
            if (colorString.length === 4 || colorString.length === 7) {
                const rgb = this.hexToRgb(colorString);
                if (rgb) return this.rgbToHsv(rgb.r, rgb.g, rgb.b);
            }
            return null;
        }

        // RGB
        const rgbMatch = colorString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            return this.rgbToHsv(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
        }

        // HSL
        const hslMatch = colorString.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/);
        if (hslMatch) {
            return this.hslToHsv(+hslMatch[1], +hslMatch[2], +hslMatch[3]);
        }

        return null;
    }

    getColorString(format = this.currentFormat) {
        if (format === 'hex') {
            const rgb = this.hsvToRgb(this.hsv.h, this.hsv.s, this.hsv.v);
            return this.rgbToHex(rgb.r, rgb.g, rgb.b);
        } else if (format === 'rgb') {
            const rgb = this.hsvToRgb(this.hsv.h, this.hsv.s, this.hsv.v);
            return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        } else if (format === 'hsl') {
            const hsl = this.hsvToHsl(this.hsv.h, this.hsv.s, this.hsv.v);
            return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
        }
    }

    getColorObject() {
        const rgb = this.hsvToRgb(this.hsv.h, this.hsv.s, this.hsv.v);
        const hsl = this.hsvToHsl(this.hsv.h, this.hsv.s, this.hsv.v);

        return {
            hex: this.rgbToHex(rgb.r, rgb.g, rgb.b),
            rgb: rgb,
            hsl: { h: Math.round(hsl.h), s: Math.round(hsl.s), l: Math.round(hsl.l) }
        };
    }

    // --- Math Helpers ---

    rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;
        const d = max - min;
        s = max === 0 ? 0 : d / max;

        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    }

    hsvToRgb(h, s, v) {
        h /= 360; s /= 100; v /= 100;
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }

    hslToHsv(h, s, l) {
        s /= 100; l /= 100;
        const v = s * Math.min(l, 1 - l) + l;
        const newS = v ? 2 - (2 * l) / v : 0;
        return { h, s: newS * 100, v: v * 100 };
    }

    hsvToHsl(h, s, v) {
        s /= 100; v /= 100;
        const l = v - (v * s) / 2;
        const m = Math.min(l, 1 - l);
        const newS = m ? (v - l) / m : 0;
        return { h, s: newS * 100, l: l * 100 };
    }

    hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        if (hex.length !== 6) return null;
        const bigint = parseInt(hex, 16);
        return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    }

    rgbToHex(r, g, b) {
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // --- Other Methods ---

    async copyColor() {
        const color = this.getColorString();
        try {
            await navigator.clipboard.writeText(color);
            const copyBtn = this.popup.querySelector('.copy-btn');
            const originalIcon = copyBtn.dataset.iconCopy;
            const checkIcon = copyBtn.dataset.iconCheck;

            copyBtn.innerHTML = checkIcon;
            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
            }, 1000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    isEyeDropperSupported() {
        return 'EyeDropper' in window;
    }

    async openEyeDropper() {
        if (!this.isEyeDropperSupported()) return;
        try {
            const eyeDropper = new EyeDropper();
            const result = await eyeDropper.open();
            this.hsv = this.parseToHsv(result.sRGBHex);
            this.updateUI();
            this.notifyChange();
        } catch (err) { }
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        // Close all other open pickers
        ColorPicker.instances.forEach(instance => {
            if (instance !== this && instance.isOpen) {
                instance.close();
            }
        });

        this.popup.style.display = 'block';
        this.isOpen = true;
        this.options.onOpen();

        // Add scroll listener
        this.scrollListener = () => this.handleScroll();
        window.addEventListener('scroll', this.scrollListener, true); // Use capture to catch all scroll events

        requestAnimationFrame(() => {
            this.updatePopupPosition();
            this.updateUI();
        });
    }

    updatePopupPosition() {
        const triggerRect = this.trigger.getBoundingClientRect();
        const popupRect = this.popup.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Check if trigger is visible in viewport
        const triggerVisible = triggerRect.top >= 0 &&
            triggerRect.left >= 0 &&
            triggerRect.bottom <= viewportHeight &&
            triggerRect.right <= viewportWidth;

        if (!triggerVisible) {
            this.close();
            return;
        }

        const spaceBelow = viewportHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;

        // Position popup relative to trigger button using fixed positioning
        this.popup.style.position = 'fixed';

        // Calculate horizontal position, keeping popup within viewport
        let leftPos = triggerRect.left;

        // Check if popup would overflow on the right
        if (leftPos + popupRect.width > viewportWidth) {
            // Align popup to the right edge of viewport with some padding
            leftPos = viewportWidth - popupRect.width - 8;
        }

        // Check if popup would overflow on the left
        if (leftPos < 8) {
            leftPos = 8;
        }

        this.popup.style.left = `${leftPos}px`;

        // Calculate vertical position
        if (spaceBelow < popupRect.height && spaceAbove > spaceBelow) {
            // Position above trigger
            this.popup.style.top = `${triggerRect.top - popupRect.height - 8}px`;
        } else {
            // Position below trigger
            this.popup.style.top = `${triggerRect.bottom + 8}px`;
        }
    }

    handleScroll() {
        if (!this.isOpen) return;

        // Update position on scroll
        this.updatePopupPosition();
    }

    close() {
        this.popup.style.display = 'none';
        this.isOpen = false;
        this.options.onClose();

        // Remove scroll listener
        if (this.scrollListener) {
            window.removeEventListener('scroll', this.scrollListener, true);
            this.scrollListener = null;
        }
    }

    setColor(color) {
        this.hsv = this.parseToHsv(color);
        this.updateUI();
    }

    getColor() {
        return this.getColorString();
    }

    destroy() {
        // Remove from instances array
        const index = ColorPicker.instances.indexOf(this);
        if (index > -1) {
            ColorPicker.instances.splice(index, 1);
        }

        // Remove scroll listener if active
        if (this.scrollListener) {
            window.removeEventListener('scroll', this.scrollListener, true);
        }

        this.popup.remove();
        this.container.remove();
    }
}
