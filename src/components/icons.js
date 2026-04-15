import L from 'leaflet';

// Helper to create an icon object with a custom class for rotation
const createIcon = (urlOrSvg, heading = 0) => {
    const isSvg = urlOrSvg.trim().endsWith('.svg'); // Check if the file is SVG based on the file extension
    const htmlContent = isSvg 
        ? `<div style="transform: rotate(${heading}deg); width: 30px; height: 30px; overflow: hidden;"><img src="${urlOrSvg}" style="width: 30px; height: 30px;" /></div>` // Constrain SVG dimensions
        : `<img src="${urlOrSvg}" style="transform: rotate(${heading}deg); width: 30px; height: 30px;" />`; // PNG dimensions

    return L.divIcon({
        className: 'custom-icon',
        html: htmlContent,
        iconSize: [45, 45], // Adjust icon size as needed
        iconAnchor: [19, 3], // Position the icon's anchor
        popupAnchor: [0, -19] // Adjust popup position
    });
};


export const policeCarIcon = createIcon('/images/icons/policecar/policeCar0.svg');
export const k9Icon = createIcon('/images/icons/k9/k90.svg');
export const helicopterIcon = createIcon('/images/icons/helicopter/helicopter0.svg'); 
export const esuIcon = createIcon('/images/icons/esu/esu0.svg');
export const boatIcon = createIcon('/images/icons/marine/boat0.svg');
export const ambulanceIcon = createIcon('/images/icons/ambulance.svg');
export const ladderIcon = createIcon('/images/icons/ladder.svg');
export const rescueIcon = createIcon('/images/icons/rescue.svg');
export const tankerIcon = createIcon('/images/icons/tanker.svg');
export const nyspIcon = createIcon('/images/icons/nyspcar.svg');
export const nypdIcon = createIcon('/images/icons/nypdcar.svg');
export const engineIcon = createIcon('/images/icons/engine.svg');
export const wcpdIcon = createIcon('/images/icons/wcpd.svg');
export const rav4Icon = createIcon('/images/icons/rav4.svg');
export const ctspIcon = createIcon('/images/icons/ctsp.svg');
export const detcarIcon = createIcon('/images/icons/detcar.svg');
export const fbiIcon = createIcon('/images/icons/fbi.svg');
export const starchaseIcon = createIcon('/images/icons/starchase.svg');

// Function to apply rotation
export const rotateIcon = (baseIcon, heading) => {
    if (!baseIcon) {
        console.error('Icon is undefined');
        return null;
    }
    
    // Extract the URL from the original icon's HTML
    const urlMatch = baseIcon.options.html.match(/src="([^"]+)"/);
    if (!urlMatch) {
        console.error('Could not extract URL from icon');
        return baseIcon;
    }
    
    // Create a new icon with the same URL but updated heading
    return createIcon(urlMatch[1], heading);
};

export const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
};
