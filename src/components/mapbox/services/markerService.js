/**
 * Saves a marker to the server
 * @param {Array} position - [longitude, latitude] position
 * @param {string} name - Marker name
 * @param {Object} user - Current user
 * @param {function} setMarkers - State setter for markers
 * @param {function} setTempMarkerPosition - State setter for temporary marker position
 * @param {function} setShowNameModal - State setter for name modal visibility
 * @returns {Promise<void>}
 */
export const saveMarker = async (
  position,
  name,
  user,
  setMarkers,
  setTempMarkerPosition,
  setShowNameModal
) => {
  if (!position || !name.trim()) return;
  
  try {
    // Log the user object to see its structure
    console.log('User object received in saveMarker:', JSON.stringify(user, null, 2));
    
    // First try to extract user from URL (which has more complete information)
    let urlUser = null;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get('user');
      if (userParam) {
        urlUser = JSON.parse(decodeURIComponent(userParam));
        console.log("Extracted user from URL:", urlUser);
      }
    } catch (err) {
      console.error("Failed to parse user from URL:", err);
    }
    
    // Use URL user data if available, otherwise fall back to passed user prop
    const currentUser = urlUser || user;
    
    // Get email from whatever user object we have
    const userEmail = currentUser?.userEmail || currentUser?.email;
    
    if (!userEmail) {
      console.error("Cannot save marker: No user email available");
      return;
    }
    
    // Try several possible fields for the user name, with fallbacks
    let userName = currentUser?.userName || currentUser?.name;
    
    // If still no name, try to extract from email
    if (!userName && userEmail) {
      // Extract the part before @ as a username
      userName = userEmail.split('@')[0];
      console.log('Using email prefix as username:', userName);
    }
    
    // If still no username after all attempts, use Unknown User but log a warning
    if (!userName) {
      console.warn('Could not determine user name from user object:', currentUser);
      userName = "Unknown User";
    }
    
    // Create a new marker object
    const newMarker = {
      id: Date.now().toString(), // Simple unique ID
      longitude: position[0],
      latitude: position[1],
      name: name, // Use the name provided by the user
      createdBy: userName,
      createdAt: new Date().toISOString()
    };
    
    console.log('Creating marker with user:', userName);
    
    // Add to local state first for immediate feedback
    setMarkers(prev => [...prev, newMarker]);
    
    // Use the environment variable base URL if available
    const baseUrl = process.env.REACT_APP_API_URL || '';
    
    // Use the proper API endpoint
    const url = `${baseUrl}/api/tempmarkers`;
    
    // Send the marker to the server to broadcast to all users
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-User-Email': userEmail
      },
      credentials: 'include',
      body: JSON.stringify(newMarker)
    });
    
    if (!response.ok) {
      console.error('Failed to save temp marker on server:', await response.text());
      // Keep the marker locally even if server sync fails
    }
    
    // Reset temporary state
    setTempMarkerPosition(null);
    setShowNameModal(false);
    
  } catch (error) {
    console.error('Error saving temp marker:', error);
    // Keep the marker locally even if there's an error
  }
};

/**
 * Deletes a marker from the server
 * @param {string} markerId - ID of the marker to delete
 * @param {Object} user - Current user
 * @param {function} setMarkers - State setter for markers
 * @returns {Promise<void>}
 */
export const deleteMarker = async (
  markerId,
  user,
  setMarkers
) => {
  // Remove from local state immediately for responsive UI
  setMarkers(prev => prev.filter(marker => marker.id !== markerId));
  
  try {
    // First try to extract user from URL
    let urlUser = null;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get('user');
      if (userParam) {
        urlUser = JSON.parse(decodeURIComponent(userParam));
      }
    } catch (err) {
      console.error("Failed to parse user from URL:", err);
    }
    
    // Use URL user data if available, otherwise fall back to passed user prop
    const currentUser = urlUser || user;
    
    // Get email from whatever user object we have
    const userEmail = currentUser?.userEmail || currentUser?.email;
    
    if (!userEmail) {
      console.error("Cannot delete marker: No user email available");
      return;
    }
    
    // Use the environment variable base URL if available
    const baseUrl = process.env.REACT_APP_API_URL || '';
    
    // Use the proper API endpoint
    const url = `${baseUrl}/api/tempmarkers/${markerId}`;
    
    // Send delete request to server
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-User-Email': userEmail
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.error('Failed to delete temp marker on server:', await response.text());
    }
  } catch (error) {
    console.error('Error deleting temp marker:', error);
  }
};

/**
 * Fetches markers from the server
 * @param {Object} user - Current user
 * @param {function} setMarkers - State setter for markers
 * @returns {Promise<void>}
 */
export const fetchMarkers = async (user, setMarkers) => {
  try {
    // First try to extract user from URL
    let urlUser = null;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get('user');
      if (userParam) {
        urlUser = JSON.parse(decodeURIComponent(userParam));
      }
    } catch (err) {
      console.error("Failed to parse user from URL:", err);
    }
    
    // Use URL user data if available, otherwise fall back to passed user prop
    const currentUser = urlUser || user;
    
    // Get email from whatever user object we have
    const userEmail = currentUser?.userEmail || currentUser?.email;
    
    if (!userEmail) {
      console.error("Cannot fetch markers: No user email available");
      return;
    }
    
    // Use the environment variable base URL if available
    const baseUrl = process.env.REACT_APP_API_URL || '';
    
    // Use the API endpoint for tempmarkers with properly authenticated request
    const url = `${baseUrl}/api/tempmarkers`;
    console.log(`Fetching markers from: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-User-Email': userEmail
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    setMarkers(data);
  } catch (error) {
    console.error('Error fetching temp markers:', error);
  }
}; 