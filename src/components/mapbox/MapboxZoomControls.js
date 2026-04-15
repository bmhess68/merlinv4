import React, { useState, useEffect } from 'react';
import { useMap } from 'react-map-gl/mapbox';

const MapboxZoomControls = () => {
  const { current: map } = useMap();
  const [currentZoom, setCurrentZoom] = useState(16);
  
  // Initialize and track zoom level
  useEffect(() => {
    if (map) {
      const initialZoom = map.getZoom();
      setCurrentZoom(initialZoom);
      console.log('MapboxZoomControls: Initial zoom level:', initialZoom);
      
      // Add zoom change listener
      const zoomHandler = () => {
        const newZoom = map.getZoom();
        console.log('MapboxZoomControls: Zoom changed to:', newZoom);
        setCurrentZoom(newZoom);
      };
      
      map.on('zoom', zoomHandler);
      map.on('zoomend', () => {
        console.log('MapboxZoomControls: Zoom operation completed. Final level:', map.getZoom());
      });
      
      return () => {
        map.off('zoom', zoomHandler);
      };
    }
  }, [map]);
  
  const controlsContainerStyle = {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    zIndex: 9999 // Maximum z-index to ensure buttons are always visible
  };
  
  const buttonStyle = {
    width: '120px', // Doubled from 60px
    height: '120px', // Doubled from 60px
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '5px solid rgba(255, 255, 255, 0.4)', // Thicker border
    color: 'white',
    fontSize: '70px', // Increased from 36px
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.4)',
    transition: 'transform 0.2s, background-color 0.2s',
    padding: 0,
    lineHeight: 1,
    userSelect: 'none',
    touchAction: 'manipulation',
    transform: 'scale(1)'
  };
  
  const buttonHoverStyle = {
    ...buttonStyle,
    transform: 'scale(1.05)',
    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.6), 0 2px 10px rgba(0, 0, 0, 0.5)',
  };
  
  const [isZoomInHovered, setIsZoomInHovered] = useState(false);
  const [isZoomOutHovered, setIsZoomOutHovered] = useState(false);
  
  const handleZoomIn = () => {
    if (map) {
      const currentZoom = map.getZoom();
      const newZoom = Math.min(currentZoom + 1, 18);
      console.log('MapboxZoomControls: Zoom IN clicked. Current zoom:', currentZoom, '-> Target zoom:', newZoom);
      
      try {
        map.easeTo({
          zoom: newZoom,
          duration: 300
        });
        console.log('MapboxZoomControls: easeTo called successfully for zoom in');
        
        // Verify the zoom change after a short delay
        setTimeout(() => {
          console.log('MapboxZoomControls: After zoom IN, actual zoom level is now:', map.getZoom());
        }, 350);
      } catch (error) {
        console.error('MapboxZoomControls: Error during zoom in:', error);
      }
    } else {
      console.error('MapboxZoomControls: Map reference not available for zoom in');
    }
  };
  
  const handleZoomOut = () => {
    if (map) {
      const currentZoom = map.getZoom();
      const newZoom = Math.max(currentZoom - 1, 15);
      console.log('MapboxZoomControls: Zoom OUT clicked. Current zoom:', currentZoom, '-> Target zoom:', newZoom);
      
      try {
        map.easeTo({
          zoom: newZoom,
          duration: 300
        });
        console.log('MapboxZoomControls: easeTo called successfully for zoom out');
        
        // Verify the zoom change after a short delay
        setTimeout(() => {
          console.log('MapboxZoomControls: After zoom OUT, actual zoom level is now:', map.getZoom());
        }, 350);
      } catch (error) {
        console.error('MapboxZoomControls: Error during zoom out:', error);
      }
    } else {
      console.error('MapboxZoomControls: Map reference not available for zoom out');
    }
  };
  
  return (
    <div style={controlsContainerStyle}>
      <button 
        style={isZoomInHovered ? 
          {...buttonHoverStyle, backgroundColor: 'rgba(52, 152, 219, 0.95)'} : 
          {...buttonStyle, backgroundColor: 'rgba(52, 152, 219, 0.9)'}}
        onClick={handleZoomIn}
        onMouseEnter={() => setIsZoomInHovered(true)}
        onMouseLeave={() => setIsZoomInHovered(false)}
        onTouchStart={() => setIsZoomInHovered(true)}
        onTouchEnd={() => setIsZoomInHovered(false)}
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
        onTouchStart={() => setIsZoomOutHovered(true)}
        onTouchEnd={() => setIsZoomOutHovered(false)}
        title="Zoom Out"
        className="mobile-button zoom-button"
      >
        −
      </button>
      <style>{`
        .zoom-button:active {
          transform: scale(0.95);
          background-color: rgba(41, 117, 247, 0.9) !important;
        }
        
        @media (max-width: 480px) {
          .zoom-button {
            width: 100px !important;
            height: 100px !important;
            font-size: 60px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default MapboxZoomControls; 