import React, { useState } from 'react';
import { Marker, Popup } from 'react-map-gl/mapbox';

// Custom TempMarker component
const TempMarker = ({ marker, onDelete, user }) => {
  const [showPopup, setShowPopup] = useState(false);
  
  return (
    <>
      <Marker
        longitude={marker.longitude}
        latitude={marker.latitude}
        anchor="bottom"
        onClick={() => setShowPopup(true)}
      >
        <div style={{
          width: '24px',
          height: '34px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer'
        }}>
          <img 
            src="/images/icons/marker.svg" 
            alt="Map Marker"
            style={{
              width: '100%',
              height: '100%',
              filter: 'drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.5))'
            }}
            onError={(e) => {
              // Fallback to emoji if SVG doesn't load
              e.target.outerHTML = '<div style="font-size: 24px; text-shadow: 0px 2px 3px rgba(0,0,0,0.5);">📍</div>';
            }}
          />
        </div>
      </Marker>
      
      {showPopup && (
        <Popup
          longitude={marker.longitude}
          latitude={marker.latitude}
          anchor="bottom"
          onClose={() => setShowPopup(false)}
          closeOnClick={false}
          offset={[0, -30]}
          closeButton={true}
          className="marker-popup"
        >
          <div style={{ 
            padding: '8px',
            minWidth: '150px'
          }}>
            <h3 style={{ 
              margin: '0 0 5px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}>
              {marker.name}
            </h3>
            <p style={{ 
              margin: '0 0 8px', 
              fontSize: '12px',
              color: '#555'
            }}>
              Created by: {marker.createdBy}
            </p>
            {(user && user.userName === marker.createdBy) && (
              <button
                onClick={() => {
                  onDelete(marker.id);
                  setShowPopup(false);
                }}
                style={{
                  backgroundColor: '#2975f7',
                  color: 'white',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  width: '100%',
                  marginTop: '5px'
                }}
              >
                Delete Marker
              </button>
            )}
          </div>
        </Popup>
      )}
    </>
  );
};

export default TempMarker; 