import React, { useState, useEffect } from 'react';
import intersectionService from './utils/intersectionService';
import routingService from './utils/routingService';

/**
 * ApiControl - Admin component to manage API connections
 * 
 * This component provides UI controls to:
 * 1. Toggle between local and remote servers for both Overpass API and OSRM
 * 2. Check connection status for both services
 * 3. View current API configuration for both services
 */
const ApiControl = ({ position = 'bottom-right' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState('overpass'); // 'overpass' or 'osrm'
  
  // Overpass API state
  const [isOverpassLocal, setIsOverpassLocal] = useState(true);
  const [overpassStatus, setOverpassStatus] = useState('');
  const [isOverpassLoading, setIsOverpassLoading] = useState(false);
  
  // OSRM API state
  const [isOsrmLocal, setIsOsrmLocal] = useState(true);
  const [osrmStatus, setOsrmStatus] = useState('');
  const [isOsrmLoading, setIsOsrmLoading] = useState(false);
  
  // Position styles mapping
  const positionStyles = {
    'top-left': { top: '10px', left: '10px' },
    'top-right': { top: '10px', right: '10px' },
    'bottom-left': { bottom: '10px', left: '10px' },
    'bottom-right': { bottom: '100px', right: '10px' },
  };
  
  // Check both servers on component mount
  useEffect(() => {
    checkOverpassStatus();
    checkOsrmStatus();
  }, []);
  
  // Toggle between local and remote Overpass servers
  const toggleOverpassServer = async () => {
    setIsOverpassLoading(true);
    try {
      const newIsLocal = !isOverpassLocal;
      const url = intersectionService.toggleLocalServer(newIsLocal);
      setIsOverpassLocal(newIsLocal);
      setOverpassStatus(`Switched to ${newIsLocal ? 'local' : 'remote'} server: ${url}`);
      
      // Check if the new server is responsive
      await checkOverpassStatus();
    } catch (error) {
      setOverpassStatus(`Error toggling server: ${error.message}`);
    } finally {
      setIsOverpassLoading(false);
    }
  };
  
  // Toggle between local and remote OSRM servers
  const toggleOsrmServer = async () => {
    setIsOsrmLoading(true);
    try {
      const newIsLocal = !isOsrmLocal;
      const url = routingService.toggleLocalOsrmServer(newIsLocal);
      setIsOsrmLocal(newIsLocal);
      setOsrmStatus(`Switched to ${newIsLocal ? 'local' : 'remote'} server: ${url}`);
      
      // Check if the new server is responsive
      await checkOsrmStatus();
    } catch (error) {
      setOsrmStatus(`Error toggling server: ${error.message}`);
    } finally {
      setIsOsrmLoading(false);
    }
  };
  
  // Check if the current Overpass server is responsive
  const checkOverpassStatus = async () => {
    setIsOverpassLoading(true);
    setOverpassStatus('Checking Overpass server status...');
    
    try {
      const isConnected = await intersectionService.checkServerConnectivity();
      if (isConnected) {
        setOverpassStatus(`Connected to ${isOverpassLocal ? 'local' : 'remote'} Overpass server successfully`);
      } else {
        setOverpassStatus(`Failed to connect to ${isOverpassLocal ? 'local' : 'remote'} Overpass server`);
      }
    } catch (error) {
      setOverpassStatus(`Error checking Overpass server: ${error.message}`);
    } finally {
      setIsOverpassLoading(false);
    }
  };
  
  // Check if the current OSRM server is responsive
  const checkOsrmStatus = async () => {
    setIsOsrmLoading(true);
    setOsrmStatus('Checking OSRM server status...');
    
    try {
      const isConnected = await routingService.checkOsrmConnectivity();
      if (isConnected) {
        setOsrmStatus(`Connected to ${isOsrmLocal ? 'local' : 'remote'} OSRM server successfully`);
      } else {
        setOsrmStatus(`Failed to connect to ${isOsrmLocal ? 'local' : 'remote'} OSRM server`);
      }
    } catch (error) {
      setOsrmStatus(`Error checking OSRM server: ${error.message}`);
    } finally {
      setIsOsrmLoading(false);
    }
  };
  
  // Control panel styles
  const panelStyle = {
    position: 'absolute',
    ...positionStyles[position],
    zIndex: 1000,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    padding: '10px',
    transition: 'all 0.3s ease',
    maxWidth: isOpen ? '320px' : '50px',
    overflow: 'hidden'
  };
  
  const toggleButtonStyle = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: '#444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px'
  };
  
  const serverToggleStyle = {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px'
  };
  
  const buttonStyle = {
    backgroundColor: '#2975f7',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 12px',
    margin: '5px',
    cursor: 'pointer',
    opacity: isOverpassLoading || isOsrmLoading ? 0.7 : 1
  };
  
  const statusStyle = {
    marginTop: '10px',
    padding: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: '4px',
    fontSize: '12px'
  };
  
  const tabStyle = {
    display: 'flex',
    borderBottom: '1px solid #ddd',
    marginBottom: '15px'
  };
  
  const tabButtonStyle = (isActive) => ({
    padding: '8px 15px',
    border: 'none',
    background: 'none',
    borderBottom: isActive ? '3px solid #2975f7' : 'none',
    color: isActive ? '#2975f7' : '#666',
    fontWeight: isActive ? 'bold' : 'normal',
    cursor: 'pointer'
  });
  
  // Only show the toggle button if not expanded
  if (!isOpen) {
    return (
      <div style={panelStyle}>
        <button 
          style={toggleButtonStyle}
          onClick={() => setIsOpen(true)}
          title="Open API Controls"
        >
          🌐
        </button>
      </div>
    );
  }
  
  return (
    <div style={panelStyle}>
      <button 
        style={{...toggleButtonStyle, backgroundColor: '#d44'}}
        onClick={() => setIsOpen(false)}
        title="Close panel"
      >
        ✕
      </button>
      
      <h3 style={{ margin: '5px 0 15px 0' }}>API Control Panel</h3>
      
      <div style={tabStyle}>
        <button 
          style={tabButtonStyle(activeTab === 'overpass')}
          onClick={() => setActiveTab('overpass')}
        >
          Overpass API
        </button>
        <button 
          style={tabButtonStyle(activeTab === 'osrm')}
          onClick={() => setActiveTab('osrm')}
        >
          OSRM
        </button>
      </div>
      
      {activeTab === 'overpass' ? (
        // Overpass API Controls
        <div>
          <div style={serverToggleStyle}>
            <span style={{ marginRight: '10px' }}>Server:</span>
            <label style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}>
              <div style={{
                width: '50px',
                height: '24px',
                backgroundColor: isOverpassLocal ? '#2975f7' : '#ccc',
                borderRadius: '12px',
                position: 'relative',
                transition: 'background-color 0.3s',
                marginRight: '10px'
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  position: 'absolute',
                  top: '2px',
                  left: isOverpassLocal ? '28px' : '2px',
                  transition: 'left 0.3s'
                }} />
              </div>
              {isOverpassLocal ? 'Local' : 'Remote'}
            </label>
            <button 
              style={buttonStyle}
              onClick={toggleOverpassServer}
              disabled={isOverpassLoading}
            >
              Switch
            </button>
          </div>
          
          <div>
            <button 
              style={{...buttonStyle, width: '100%'}}
              onClick={checkOverpassStatus}
              disabled={isOverpassLoading}
            >
              {isOverpassLoading ? 'Checking...' : 'Check Server Status'}
            </button>
          </div>
          
          {overpassStatus && (
            <div style={statusStyle}>
              {overpassStatus}
            </div>
          )}
          
          <div style={{
            marginTop: '15px',
            fontSize: '12px',
            color: '#666',
            borderTop: '1px solid #eee',
            paddingTop: '10px'
          }}>
            <div><strong>Local:</strong> http://192.168.2.15:8800/api/interpreter</div>
            <div><strong>Remote:</strong> https://overpass-api.de/api/interpreter</div>
          </div>
        </div>
      ) : (
        // OSRM Controls
        <div>
          <div style={serverToggleStyle}>
            <span style={{ marginRight: '10px' }}>Server:</span>
            <label style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}>
              <div style={{
                width: '50px',
                height: '24px',
                backgroundColor: isOsrmLocal ? '#2975f7' : '#ccc',
                borderRadius: '12px',
                position: 'relative',
                transition: 'background-color 0.3s',
                marginRight: '10px'
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  backgroundColor: 'white',
                  borderRadius: '10px',
                  position: 'absolute',
                  top: '2px',
                  left: isOsrmLocal ? '28px' : '2px',
                  transition: 'left 0.3s'
                }} />
              </div>
              {isOsrmLocal ? 'Local' : 'Remote'}
            </label>
            <button 
              style={buttonStyle}
              onClick={toggleOsrmServer}
              disabled={isOsrmLoading}
            >
              Switch
            </button>
          </div>
          
          <div>
            <button 
              style={{...buttonStyle, width: '100%'}}
              onClick={checkOsrmStatus}
              disabled={isOsrmLoading}
            >
              {isOsrmLoading ? 'Checking...' : 'Check Server Status'}
            </button>
          </div>
          
          {osrmStatus && (
            <div style={statusStyle}>
              {osrmStatus}
            </div>
          )}
          
          <div style={{
            marginTop: '15px',
            fontSize: '12px',
            color: '#666',
            borderTop: '1px solid #eee',
            paddingTop: '10px'
          }}>
            <div><strong>Local:</strong> http://192.168.2.15:5001</div>
            <div><strong>Remote:</strong> https://router.project-osrm.org</div>
          </div>
        </div>
      )}
      
      <div style={{ 
        marginTop: '10px', 
        borderTop: '1px solid #ddd', 
        paddingTop: '10px',
        textAlign: 'center',
        fontSize: '12px'
      }}>
        <button onClick={() => setShowAdvanced(!showAdvanced)} style={{
          background: 'none',
          border: 'none',
          color: '#2975f7',
          cursor: 'pointer',
          fontSize: '12px'
        }}>
          {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
        </button>
        
        {showAdvanced && (
          <div style={{ marginTop: '10px', textAlign: 'left' }}>
            <div><strong>Nominatim:</strong> Coming soon</div>
            <div style={{ marginTop: '5px', fontSize: '11px', color: '#777' }}>
              The Nominatim API is currently building.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiControl; 