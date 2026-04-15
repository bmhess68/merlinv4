import React from 'react';
import { useMap } from 'react-leaflet';

// Zoom Controls Component - Updated style to match other buttons
const ZoomControls = () => {
    const map = useMap();
    
    const controlsContainerStyle = {
        position: 'fixed',
        right: '15px',
        bottom: '120px',  // Increased to position higher
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 9999, // Maximum z-index to ensure buttons are always visible above everything
    };
    
    const buttonStyle = {
        width: '50px', // Even larger buttons
        height: '50px',
        borderRadius: '50%',
        backgroundColor: 'rgba(0, 0, 0, 0.85)', // Darker background for better visibility
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '3px solid rgba(255, 255, 255, 0.4)', // More visible border
        color: 'white',
        fontSize: '30px', // Larger text
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)', // Stronger shadow
        transition: 'transform 0.2s, background-color 0.2s',
        padding: 0, // Remove default padding
        lineHeight: 1, // Ensure vertical centering
        userSelect: 'none', // Prevent text selection
        touchAction: 'manipulation', // Optimize for touch
        transform: 'scale(1)',
    };
    
    const buttonHoverStyle = {
        ...buttonStyle,
        transform: 'scale(1.1)', // Grow on hover/focus
        boxShadow: '0 4px 25px rgba(0, 0, 0, 0.6)',
    };
    
    const [isZoomInHovered, setIsZoomInHovered] = React.useState(false);
    const [isZoomOutHovered, setIsZoomOutHovered] = React.useState(false);
    
    const handleZoomIn = () => {
        const currentZoom = map.getZoom();
        const newZoom = Math.min(currentZoom + 1, 18);
        console.log('ZoomControls: Zoom IN button clicked. Current zoom:', currentZoom, '-> Target zoom:', newZoom);
        
        try {
            map.setZoom(newZoom);
            console.log('ZoomControls: setZoom called successfully');
        } catch (error) {
            console.error('ZoomControls: Error setting zoom:', error);
        }
        
        // Add a delay to log the actual zoom after it's been applied
        setTimeout(() => {
            console.log('ZoomControls: After zoom IN, actual zoom level is now:', map.getZoom());
        }, 100);
    };
    
    const handleZoomOut = () => {
        const currentZoom = map.getZoom();
        const newZoom = Math.max(currentZoom - 1, 15);
        console.log('ZoomControls: Zoom OUT button clicked. Current zoom:', currentZoom, '-> Target zoom:', newZoom);
        
        try {
            map.setZoom(newZoom);
            console.log('ZoomControls: setZoom called successfully');
        } catch (error) {
            console.error('ZoomControls: Error setting zoom:', error);
        }
        
        // Add a delay to log the actual zoom after it's been applied
        setTimeout(() => {
            console.log('ZoomControls: After zoom OUT, actual zoom level is now:', map.getZoom());
        }, 100);
    };
    
    // Add an effect to log the initial zoom level when component mounts
    React.useEffect(() => {
        console.log('ZoomControls: Initial map zoom level:', map.getZoom());
        
        // Add event listener for zoom
        const zoomListener = () => {
            console.log('ZoomControls: Map zoom changed to:', map.getZoom());
        };
        
        map.on('zoom', zoomListener);
        return () => {
            map.off('zoom', zoomListener);
        };
    }, [map]);
    
    return (
        <div style={controlsContainerStyle}>
            <button 
                style={isZoomInHovered ? 
                    {...buttonHoverStyle, backgroundColor: 'rgba(52, 152, 219, 0.95)'} : 
                    {...buttonStyle, backgroundColor: 'rgba(52, 152, 219, 0.9)'}}
                onClick={handleZoomIn}
                onMouseEnter={() => setIsZoomInHovered(true)}
                onMouseLeave={() => setIsZoomInHovered(false)}
                onFocus={() => setIsZoomInHovered(true)}
                onBlur={() => setIsZoomInHovered(false)}
                title="Zoom In"
                className="mobile-button zoom-button"
            >
                +
            </button>
            <button 
                style={isZoomOutHovered ? buttonHoverStyle : buttonStyle}
                onClick={handleZoomOut}
                onMouseEnter={() => setIsZoomOutHovered(true)}
                onMouseLeave={() => setIsZoomOutHovered(false)}
                onFocus={() => setIsZoomOutHovered(true)}
                onBlur={() => setIsZoomOutHovered(false)}
                title="Zoom Out"
                className="mobile-button zoom-button"
            >
                −
            </button>
        </div>
    );
};

export default ZoomControls; 