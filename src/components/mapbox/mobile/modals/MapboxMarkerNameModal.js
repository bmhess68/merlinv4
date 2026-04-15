import React, { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Modal component for entering a marker name
 * @param {Object} props 
 * @param {boolean} props.show - Whether the modal is visible
 * @param {Function} props.onClose - Function to close the modal
 * @param {Function} props.onSave - Function to save the marker name
 */
const MapboxMarkerNameModal = ({ show, onClose, onSave }) => {
  const [markerName, setMarkerName] = useState('');
  
  if (!show) return null;
  
  const handleSave = () => {
    if (markerName.trim()) {
      onSave(markerName);
      setMarkerName(''); // Reset for next time
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        width: '300px',
        maxWidth: '90%',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
      }}>
        <h3 style={{ 
          margin: '0 0 15px 0', 
          color: '#333',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          Enter Marker Name
        </h3>
        
        <input
          type="text"
          value={markerName}
          onChange={(e) => setMarkerName(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Enter a name for this marker"
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            fontSize: '14px',
            marginBottom: '15px',
            boxSizing: 'border-box'
          }}
          autoFocus
        />
        
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 15px',
              marginRight: '10px',
              backgroundColor: '#f0f0f0',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 15px',
              backgroundColor: '#0567f7',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

MapboxMarkerNameModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired
};

export default MapboxMarkerNameModal; 