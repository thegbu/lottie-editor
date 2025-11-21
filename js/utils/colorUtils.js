/**
 * Color utility functions for converting between different color formats
 */

/**
 * Convert RGBA array (normalized 0-1) to hex color
 * @param {number[]} arr - Array of [r, g, b, a] with values 0-1
 * @returns {string} Hex color string (e.g., "#ff0000")
 */
export function rgbaToHex(arr) {
  const [r, g, b] = arr;
  return rgbToHex(r * 255, g * 255, b * 255);
}

/**
 * Convert RGB values (0-255) to hex color
 * @param {number} r - Red value (0-255)
 * @param {number} g - Green value (0-255)
 * @param {number} b - Blue value (0-255)
 * @returns {string} Hex color string (e.g., "#ff0000")
 */
export function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const h = Math.round(x).toString(16).padStart(2, "0");
        return h;
      })
      .join("")
  );
}

/**
 * Convert hex color to RGB object
 * @param {string} hex - Hex color string (e.g., "#ff0000")
 * @returns {{r: number, g: number, b: number}} RGB object with values 0-255
 */
export function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
