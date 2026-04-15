/**
 * Darkens a color by a specified amount
 * @param {string} color - The color to darken (hex format)
 * @param {number} amount - The amount to darken (0-255)
 * @returns {string} The darkened color
 */
export const darkenColor = (color, amount) => {
  try {
    // Remove the hash if it exists
    color = color.replace('#', '');
    
    // Parse the color components
    let r = parseInt(color.substring(0, 2), 16);
    let g = parseInt(color.substring(2, 4), 16);
    let b = parseInt(color.substring(4, 6), 16);
    
    // Darken each component
    r = Math.max(0, r - amount);
    g = Math.max(0, g - amount);
    b = Math.max(0, b - amount);
    
    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch (error) {
    console.error('Error darkening color:', error);
    return color; // Return the original color on error
  }
}; 