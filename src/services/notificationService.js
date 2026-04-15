import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import io from 'socket.io-client';

let socket = null;
let expandedNotifications = {};
let slackNotificationsEnabled = true; // Default to enabled

// Channel name mapping
const channelNames = {
  'C8TAH7Q8M': 'Stolen Vehicles',
  'C8SLAJK25': 'BOLO',
  'C8U8A205D': 'Hotline',
  'C08HJ8J5PRM': 'testwebhook'
};

// Helper function to check if device is mobile
const isMobileDevice = () => {
  return window.innerWidth < 768;
};

// Get responsive styles based on device type
const getResponsiveStyles = () => {
  const isMobile = isMobileDevice();
  
  return {
    fontSize: isMobile ? '14px' : '18px',
    padding: isMobile ? '8px' : '12px',
    maxWidth: isMobile ? '50%' : '100%',
    maxHeight: isMobile ? '150px' : '200px',
    imageHeight: isMobile ? '120px' : '200px'
  };
};

const initialize = () => {
  if (socket) return; // Already initialized
  
  socket = io();
  
  socket.on('notification', handleNotification);
  
  console.log('Notification service initialized');
};

const disconnect = () => {
  if (socket) {
    socket.off('notification', handleNotification);
    socket.disconnect();
    socket = null;
    console.log('Notification service disconnected');
  }
};

// Functions to control Slack notifications
const setSlackNotificationsEnabled = (enabled) => {
  slackNotificationsEnabled = enabled;
  console.log('Slack notifications', enabled ? 'enabled' : 'disabled');
};

const getSlackNotificationsEnabled = () => {
  return slackNotificationsEnabled;
};

const handleNotification = (notification) => {
  // Check if Slack notifications are enabled
  if (!slackNotificationsEnabled) {
    console.log('Slack notification received but notifications are disabled');
    return;
  }

  // Create a unique ID for this notification
  const notificationId = `notification-${Date.now()}`;
  
  // Get channel name
  const channelName = channelNames[notification.channelId] || 'Unknown Channel';
  
  // Format the text to be more readable
  const previewText = notification.text.length > 150 
    ? notification.text.substring(0, 150) + '...' 
    : notification.text;
  
  // Get responsive styles
  const responsiveStyles = getResponsiveStyles();
  
  // Preload images if available
  if (notification.images && notification.images.length > 0) {
    notification.images.forEach(image => {
      // Preload both direct and proxy URLs
      preloadImage(image.directThumbUrl);
      preloadImage(image.thumbUrl);
    });
  }
  
  // Create a custom toast component with inline styles
  const CustomToastContent = () => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [imageIndex, setImageIndex] = React.useState(0);
    const [imageError, setImageError] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(true);
    const [usingDirectUrl, setUsingDirectUrl] = React.useState(true); // Start with direct URL first
    const [retryCount, setRetryCount] = React.useState(0);
    const [retryTimer, setRetryTimer] = React.useState(null);
    const maxRetries = 5;
    
    // Check if notification has images
    const hasImages = notification.images && notification.images.length > 0;
    
    // Function to navigate through images
    const nextImage = () => {
      if (hasImages) {
        clearTimeout(retryTimer);
        setImageError(false);
        setIsLoading(true);
        setUsingDirectUrl(true); // Start with direct URL for new image
        setRetryCount(0);
        setImageIndex((prevIndex) => 
          prevIndex === notification.images.length - 1 ? 0 : prevIndex + 1
        );
      }
    };
    
    const prevImage = () => {
      if (hasImages) {
        clearTimeout(retryTimer);
        setImageError(false);
        setIsLoading(true);
        setUsingDirectUrl(true); // Start with direct URL for new image
        setRetryCount(0);
        setImageIndex((prevIndex) => 
          prevIndex === 0 ? notification.images.length - 1 : prevIndex - 1
        );
      }
    };
    
    // Preload image function
    const preloadImage = (url) => {
      if (!url) return Promise.reject(new Error('No URL provided'));
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => reject(new Error(`Failed to load ${url}`));
        img.src = `${url}?t=${Date.now()}`; // Add timestamp to prevent caching
      });
    };
    
    // Handle image load error - try different approaches
    const handleImageError = () => {
      console.log(`Image load error, retry count: ${retryCount}, using direct URL: ${usingDirectUrl}`);
      
      if (retryCount < maxRetries) {
        // Increment retry count
        const newRetryCount = retryCount + 1;
        setRetryCount(newRetryCount);
        
        // Calculate delay with exponential backoff
        const delay = Math.min(1000 * Math.pow(1.5, newRetryCount), 8000);
        
        // If using direct URL and it failed, try proxy URL
        if (usingDirectUrl) {
          console.log('Direct URL failed, switching to proxy URL');
          setUsingDirectUrl(false);
        } else {
          // If proxy URL failed, try direct URL again with a new timestamp
          console.log('Proxy URL failed, switching back to direct URL');
          setUsingDirectUrl(true);
        }
        
        // Set a timer to retry after delay
        console.log(`Retrying in ${delay}ms (attempt ${newRetryCount}/${maxRetries})`);
        const timer = setTimeout(() => {
          console.log(`Executing retry ${newRetryCount}`);
          // Force a re-render by toggling isLoading
          setIsLoading(true);
        }, delay);
        
        setRetryTimer(timer);
      } else {
        console.log('Max retries reached, showing error');
        setImageError(true);
        setIsLoading(false);
      }
    };
    
    // Handle image load success
    const handleImageLoad = () => {
      console.log('Image loaded successfully');
      clearTimeout(retryTimer);
      setIsLoading(false);
      setRetryCount(0);
    };
    
    // Retry loading the image manually
    const retryImage = () => {
      console.log('Manual retry initiated');
      clearTimeout(retryTimer);
      setImageError(false);
      setIsLoading(true);
      setUsingDirectUrl(true); // Start with direct URL for manual retry
      setRetryCount(0);
    };
    
    // Get current image URL based on state
    const getCurrentImageUrl = () => {
      if (!hasImages || !notification.images[imageIndex]) return '';
      
      const image = notification.images[imageIndex];
      const timestamp = Date.now();
      
      if (usingDirectUrl && image.directThumbUrl) {
        // Add timestamp to prevent caching
        return `${image.directThumbUrl}?t=${timestamp}`;
      } else {
        // Add timestamp to prevent caching
        return `${image.thumbUrl}?t=${timestamp}`;
      }
    };
    
    // Open image in new tab
    const openInNewTab = () => {
      if (!hasImages) return;
      
      const image = notification.images[imageIndex];
      const url = usingDirectUrl ? image.directUrl : image.url;
      window.open(url, '_blank');
    };
    
    // Clean up any timers when component unmounts
    React.useEffect(() => {
      return () => {
        if (retryTimer) {
          clearTimeout(retryTimer);
        }
      };
    }, [retryTimer]);
    
    // Automatically start loading when image changes
    React.useEffect(() => {
      if (hasImages && notification.images[imageIndex]) {
        // Set a longer initial delay (5 seconds) to ensure images are ready
        const timer = setTimeout(() => {
          setIsLoading(false);
        }, 5000);
        
        return () => clearTimeout(timer);
      }
    }, [imageIndex, usingDirectUrl]);
    
    return (
      <div className="notification-content">
        <div style={{ fontSize: responsiveStyles.fontSize }}>
          {/* Show text if available */}
          {notification.text && (
            <strong>
              {isExpanded ? notification.fullText || notification.text : previewText}
            </strong>
          )}
          
          {/* Show images if available */}
          {hasImages && (
            <div style={{ marginTop: '10px', position: 'relative' }}>
              {imageError ? (
                <div style={{
                  padding: '15px',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                  textAlign: 'center',
                  color: '#fff'
                }}>
                  <p>Unable to load image after multiple attempts</p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        retryImage();
                      }}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Retry
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openInNewTab();
                      }}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Open in New Tab
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ position: 'relative', minHeight: '100px' }}>
                  {isLoading && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: 'rgba(0,0,0,0.1)',
                      borderRadius: '4px',
                      zIndex: 1
                    }}>
                      <div>
                        Loading image{usingDirectUrl ? ' (direct URL)' : ' (proxy URL)'}...
                        {retryCount > 0 && ` (Attempt ${retryCount}/${maxRetries})`}
                      </div>
                    </div>
                  )}
                  <img 
                    src={getCurrentImageUrl()} 
                    alt={notification.images[imageIndex].name || 'Image'}
                    onError={handleImageError}
                    onLoad={handleImageLoad}
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: responsiveStyles.imageHeight, 
                      borderRadius: '4px',
                      border: '1px solid rgba(255,255,255,0.3)',
                      display: isLoading ? 'none' : 'block'
                    }}
                  />
                </div>
              )}
              
              {/* Image navigation if multiple images */}
              {notification.images.length > 1 && (
                <div className="notification-image-controls">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      prevImage();
                    }}
                    className="notification-image-button"
                  >
                    Previous
                  </button>
                  <span className="notification-image-counter">
                    {imageIndex + 1} of {notification.images.length}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      nextImage();
                    }}
                    className="notification-image-button"
                  >
                    Next
                  </button>
                </div>
              )}
              
              {/* View full image button */}
              {!imageError && !isLoading && (
                <div style={{ textAlign: 'center', marginTop: '5px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openInNewTab();
                    }}
                    className="notification-image-button"
                  >
                    View Full Image
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div style={{ fontSize: isMobileDevice() ? '12px' : '14px', marginTop: '8px' }}>
            From: Real Time Crime (RTC) • Channel: {channelName} • {new Date(notification.timestamp).toLocaleTimeString()}
          </div>
          
          {/* Show expand button only if there's text and it's long enough */}
          {notification.text && notification.text.length > 150 && (
            <button 
              onClick={(e) => {
                e.stopPropagation(); // Prevent toast from closing
                setIsExpanded(!isExpanded);
              }}
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                marginTop: '8px',
                cursor: 'pointer'
              }}
            >
              {isExpanded ? 'Show Less' : 'See Full Message'}
            </button>
          )}
        </div>
      </div>
    );
  };
  
  // Use the custom component with minimal toast options
  toast(<CustomToastContent />, {
    position: "top-right",
    autoClose: notification.type === 'standard' ? 300000 : 2000, // 5 minutes for Slack, 2 seconds for others
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    limit: 5,
    className: `slack-notification-toast ${isMobileDevice() ? 'notification-toast-mobile' : ''}`,
    style: isMobileDevice() ? { width: '50%', maxWidth: '50%' } : {}
  });
};

// Add preloadImage function at the module level
const preloadImage = (url) => {
  if (!url) return Promise.reject(new Error('No URL provided'));
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = `${url}?t=${Date.now()}`; // Add timestamp to prevent caching
  });
};

export default {
  initialize,
  disconnect,
  setSlackNotificationsEnabled,
  getSlackNotificationsEnabled
};