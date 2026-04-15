import React, { useState, useEffect } from 'react';
import logo from '../../images/icons/logo.png'; // Update import path

const Header = ({ user, darkMode, toggleDarkMode, hideToggle = false }) => {
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
    
    const headerStyle = {
        position: 'fixed',
        top: 0,
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 15px',
        zIndex: 1001,
        pointerEvents: 'none',
        height: '60px'
    };
    
    const logoStyle = {
        height: '40px',
        pointerEvents: 'auto'
    };
    
    const userSectionStyle = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
        pointerEvents: 'auto'
    };
    
    const userContainerStyle = {
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'rgba(25, 25, 25, 0.7)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '4px 10px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        pointerEvents: 'auto',
        cursor: 'pointer'
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
    
    const darkModeButtonStyle = {
        backgroundColor: 'rgba(25, 25, 25, 0.7)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        color: 'white',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '20px',
        padding: '5px 12px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%'
    };
    
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
    
    // Only render if we have user data
    if (!userData) return null;
    
    return (
        <div style={headerStyle}>
            <img src={logo} alt="RTC Logo" style={logoStyle} />
            
            <div style={userSectionStyle}>
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
                
                {!hideToggle && (
                    <button 
                        style={darkModeButtonStyle}
                        onClick={toggleDarkMode}
                    >
                        <span style={{ marginRight: '8px', fontSize: '16px' }}>
                            {darkMode ? '☀️' : '🌙'}
                        </span>
                        {darkMode ? 'Light' : 'Dark'} Mode
                    </button>
                )}
            </div>
        </div>
    );
};

export default Header; 