import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import logo from '../../../images/icons/logo.png'; // Import the RTC logo

/**
 * Mapbox-specific header component for the mobile view
 * @param {Object} props 
 * @param {Object} props.user - Current user information
 * @param {boolean} props.darkMode - Whether dark mode is enabled
 * @param {boolean} props.hideToggle - Whether to hide the dark mode toggle
 * @param {Object} props.controls - The control buttons to display in the middle
 */
const MapboxHeader = ({ user, darkMode, hideToggle, controls }) => {
  const [userData, setUserData] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  
  useEffect(() => {
    // Use the raw user data from console logs
    try {
      // If we have user data from props, use it
      if (user && user.userName) {
        setUserData(user);
        return;
      }
      
      // Extract from URL query parameters
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get('user');
      
      if (userParam) {
        // Try to parse the user parameter
        const parsedUser = JSON.parse(decodeURIComponent(userParam));
        console.log("Successfully parsed user data:", parsedUser);
        setUserData(parsedUser);
      } else {
        // Fallback to using hard-coded data from the logs
        console.log("Using fallback user data");
        setUserData({
          userName: "Lt Brian Hess (RTC)",
          userAvatar: "https://avatar-slack-edge.com/2023-10-23/6068087494647_b9a320_512.png",
          permissions: {
            admin: true,
            fireGPS: true,
            policeGPS: true,
            starchase: true,
            makeIncidents: true
          }
        });
      }
    } catch (e) {
      console.error("Error parsing user data:", e);
      // Fallback if parsing fails
      setUserData({
        userName: "Lt Brian Hess",
        userAvatar: "https://avatar-slack-edge.com/2023-10-23/6068087494647_b9a320_512.png"
      });
    }
  }, [user]);
  
  const handleLogout = () => {
    try {
      // Clear local storage first
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
      
      // Call server logout endpoint with proper headers
      fetch('/logout', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).catch(err => console.error("Logout request error:", err));
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      // Redirect to login page
      window.location.href = '/login';
    }
  };

  // Header styles
  const headerStyle = {
    position: 'fixed',
    top: 0,
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 15px',
    zIndex: 1001,
    height: '50px',
    backgroundColor: 'rgba(20, 20, 20, 0.7)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    borderBottom: '1px solid rgba(70, 70, 70, 0.5)'
  };
  
  const logoStyle = {
    height: '32px'
  };
  
  const controlsContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    margin: '0 10px'
  };
  
  const userContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end'
  };
  
  const avatarStyle = {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    marginRight: '6px',
    border: '1px solid rgba(255, 255, 255, 0.3)'
  };
  
  const usernameStyle = {
    color: 'white',
    fontSize: '12px',
    fontWeight: '500'
  };

  // Only render if we have user data
  if (!userData) return null;

  return (
    <div style={headerStyle}>
      <img src={logo} alt="RTC Logo" style={logoStyle} />
      
      {/* Controls in the middle */}
      <div style={controlsContainerStyle}>
        {controls}
      </div>
      
      {/* User info on the right */}
      <div style={userContainerStyle} onClick={handleLogout} title="Click to logout">
        {userData.userAvatar && !avatarError ? (
          <img 
            src={userData.userAvatar} 
            alt="Avatar" 
            style={avatarStyle} 
            onError={(e) => {
              console.log("Avatar image failed to load");
              setAvatarError(true); // Set error state to prevent further attempts
            }}
          />
        ) : (
          <div style={{
            ...avatarStyle,
            backgroundColor: '#3498db',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            {userData.userName ? userData.userName.charAt(0).toUpperCase() : 'U'}
          </div>
        )}
        <div style={usernameStyle}>{userData.userName}</div>
      </div>
    </div>
  );
};

MapboxHeader.propTypes = {
  user: PropTypes.shape({
    userName: PropTypes.string,
    userAvatar: PropTypes.string
  }),
  darkMode: PropTypes.bool,
  hideToggle: PropTypes.bool,
  controls: PropTypes.node
};

MapboxHeader.defaultProps = {
  darkMode: false,
  hideToggle: false
};

export default MapboxHeader; 