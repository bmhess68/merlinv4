import React from 'react';

/**
 * SearchAreaBox component that displays active incident details
 * @param {Object} props
 * @param {Object} props.incident - The incident object to display
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @param {Function} props.onClose - Function to handle closing the box
 */
const SearchAreaBox = ({ incident, darkMode, onClose }) => {
  if (!incident) return null;
  
  // Format date if available
  const formattedDate = incident.date ? 
    new Date(incident.date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }) : null;
  
  return (
    <div 
      style={{
        position: 'absolute',
        top: '100px',
        right: '20px',
        backgroundColor: darkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        color: darkMode ? 'white' : 'black',
        padding: '15px',
        borderRadius: '12px',
        zIndex: 1000,
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
        maxWidth: '280px',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        border: darkMode 
          ? '1px solid rgba(255, 255, 255, 0.1)' 
          : '1px solid rgba(0, 0, 0, 0.1)',
        fontSize: '14px'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        borderBottom: darkMode 
          ? '1px solid rgba(255, 255, 255, 0.1)' 
          : '1px solid rgba(0, 0, 0, 0.1)',
        paddingBottom: '5px'
      }}>
        <div style={{ 
          fontSize: '16px', 
          fontWeight: 'bold',
          color: '#0567f7',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Active Incidents
        </div>
        <button 
          onClick={onClose}
          style={{
            background: 'none', 
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: darkMode ? 'white' : 'black',
            padding: '0'
          }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
        {incident.name}
      </div>
      
      {incident.location_address ? (
        <div style={{ 
          fontSize: '13px', 
          marginBottom: '8px',
          padding: '6px 8px',
          backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          borderRadius: '6px',
          borderLeft: '3px solid #0567f7'
        }}>
          {incident.location_address}
        </div>
      ) : (
        incident.location_lat && incident.location_long && (
          <div style={{ 
            fontSize: '13px', 
            marginBottom: '8px',
            fontStyle: 'italic',
            opacity: 0.8
          }}>
            Location: {incident.location_lat.toFixed(5)}, {incident.location_long.toFixed(5)}
          </div>
        )
      )}
      
      {formattedDate && (
        <div style={{ 
          fontSize: '12px', 
          color: darkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
          marginTop: '5px',
          textAlign: 'right'
        }}>
          Date: {formattedDate}
        </div>
      )}
    </div>
  );
};

export default SearchAreaBox; 