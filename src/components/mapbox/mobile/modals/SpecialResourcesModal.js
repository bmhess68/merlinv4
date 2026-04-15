import React, { useState, useEffect, useRef } from 'react';
import moment from 'moment-timezone';
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';

// Helper function for deep comparison of user objects
function isEqual(obj1, obj2) {
  // Handle nullish values
  if (!obj1 && !obj2) return true;
  if (!obj1 || !obj2) return false;
  
  // Compare basic properties we care about
  return (
    obj1.userId === obj2.userId &&
    obj1.userEmail === obj2.userEmail &&
    obj1.userName === obj2.userName &&
    obj1.department === obj2.department
  );
}

// Helper function to get color for category pills
function getCategoryColor(categoryId, categoryName = '') {
  // Predefined color palette - more vibrant colors
  const colors = {
    // Emergency Response
    emt: '#2ecc71',        // Bright green
    paramedic: '#27ae60',  // Green
    medical: '#27ae60',    // Green
    ambulance: '#2ecc71',  // Bright green
    
    // Fire Services
    fire: '#e74c3c',       // Bright red
    hazmat: '#c0392b',     // Dark red
    rescue: '#d35400',     // Burnt orange
    
    // Police Specialties
    k9: '#f39c12',         // Orange
    canine: '#f39c12',     // Orange
    tactical: '#34495e',   // Dark blue-gray
    swat: '#2c3e50',       // Navy blue
    
    // Aerial Support
    drone: '#3498db',      // Bright blue
    uav: '#3498db',        // Bright blue
    air: '#2980b9',        // Dark blue
    helicopter: '#2980b9', // Dark blue
    
    // Water Operations
    dive: '#9b59b6',       // Purple
    water: '#8e44ad',      // Dark purple
    boat: '#3498db',       // Blue
    marine: '#2980b9',     // Dark blue
    
    // Investigation/Detective
    investigation: '#16a085', // Teal
    detective: '#1abc9c',     // Light teal
    accident: '#16a085',      // Teal
    
    // Command & Support
    command: '#7f8c8d',    // Gray
    support: '#95a5a6',    // Light gray
    logistics: '#7f8c8d',  // Gray
    
    // Languages & Communication
    language: '#3498db',   // Blue
    interpreter: '#3498db',// Blue
    communication: '#2980b9', // Dark blue
    
    // Search & Rescue
    search: '#f1c40f',     // Yellow
    wilderness: '#d35400', // Burnt orange
    mountain: '#c0392b',   // Dark red
    
    // Other specialized teams
    bomb: '#c0392b',       // Dark red
    explosive: '#c0392b',  // Dark red
    forensic: '#9b59b6',   // Purple
    traffic: '#f39c12',    // Orange
    crowd: '#95a5a6',      // Light gray
    riot: '#34495e',       // Dark blue-gray
    
    // Generic terms
    team: '#7f8c8d',       // Gray
    unit: '#7f8c8d',       // Gray
    specialist: '#1abc9c', // Light teal
    technician: '#3498db'  // Blue
  };
  
  // Vibrant fallback colors based on ID to ensure consistency
  const fallbackColors = [
    '#3498db', // Blue
    '#e74c3c', // Red
    '#2ecc71', // Green
    '#f39c12', // Orange
    '#9b59b6', // Purple
    '#1abc9c', // Teal
    '#d35400', // Dark Orange
    '#2980b9', // Dark Blue
    '#8e44ad', // Dark Purple
    '#27ae60', // Dark Green
    '#c0392b', // Dark Red
    '#16a085', // Dark Teal
    '#f1c40f', // Yellow
    '#34495e', // Navy
    '#7f8c8d', // Gray
  ];
  
  // Get a consistent color based on name
  if (categoryName) {
    const lowerName = categoryName.toLowerCase();
    
    // Check if the name contains any of our predefined keywords
    for (const [keyword, color] of Object.entries(colors)) {
      if (lowerName.includes(keyword)) {
        return color;
      }
    }
  }
  
  // If no match found, use fallback based on ID
  return fallbackColors[categoryId % fallbackColors.length];
}

/**
 * Special Resources Modal Component for mobile map view
 * Allows users to add and view special resources
 */
const SpecialResourcesModal = ({ show, onClose, user }) => {
  // State variables
  const [activeTab, setActiveTab] = useState('view');
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter state for viewing resources
  const [selectedFilter, setSelectedFilter] = useState('all');
  
  // Form state
  const [department, setDepartment] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [officerCallSign, setOfficerCallSign] = useState('');
  const [tourEnd, setTourEnd] = useState('');
  
  // State to track if data has been loaded
  const [dataLoaded, setDataLoaded] = useState(false);

  // Add state to track if resources and categories have been successfully loaded
  const [resourcesLoaded, setResourcesLoaded] = useState(false);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  
  // Add state to store the enriched user data from URL
  const [enrichedUser, setEnrichedUser] = useState(null);
  
  // Ref to store the previous user object for comparison
  const prevUserRef = useRef(null);
  
  // Add ref to track if we've loaded data from URL
  const loadedFromUrlRef = useRef(false);
  
  // Add ref to track resource refresh status for the current modal session
  const hasRefreshedRef = useRef(false);
  
  // Check if user has meaningfully changed
  const hasUserChanged = !isEqual(prevUserRef.current, user);

  // Add state for editing
  const [editingResource, setEditingResource] = useState(null);
  
  // Add state to track if user is admin
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Function to start editing a resource
  const handleEditResource = (resource) => {
    setEditingResource(resource);
    setActiveTab('add');
    
    // Populate form with resource data
    setDepartment(resource.department || '');
    setCategoryId(resource.category_id.toString());
    setSkillDescription(resource.skill_description || '');
    setOfficerCallSign(resource.user_name || '');
    
    // Set tour end (respecting 24 hour limit)
    const endTime = moment.tz(resource.tour_end, 'America/New_York');
    const maxEndTime = moment().tz('America/New_York').add(24, 'hours');
    
    // If the current end time is more than 24 hours away, adjust it
    if (endTime.isAfter(maxEndTime)) {
      setTourEnd(maxEndTime.format('YYYY-MM-DDTHH:mm'));
    } else {
      setTourEnd(endTime.format('YYYY-MM-DDTHH:mm'));
    }
  };
  
  // Effect to handle user data from URL - only run once
  useEffect(() => {
    // Only run if modal is shown and we haven't already loaded from URL
    if (show && !loadedFromUrlRef.current) {
      try {
        // Extract from URL query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const userParam = urlParams.get('user');
        
        if (userParam) {
          // Parse the user parameter
          const parsedUser = JSON.parse(decodeURIComponent(userParam));
          console.log("Successfully parsed user data from URL:", parsedUser);
          
          // Store the enriched user data in state
          setEnrichedUser(parsedUser);
          
          // Set officer call sign immediately if available
          if (parsedUser.userName) {
            console.log('Setting officer call sign from URL to:', parsedUser.userName);
            setOfficerCallSign(parsedUser.userName);
          }
          
          // Mark that we've loaded from URL
          loadedFromUrlRef.current = true;
        }
      } catch (e) {
        console.error("Error parsing user data from URL:", e);
      }
    }
  }, [show]); // Only depends on show state, not user props
  
  // Special effect that runs when the modal first becomes visible
  useEffect(() => {
    if (show) {
      console.log("Modal became visible, checking for userName");
      
      // Force refresh resources when modal is opened - but only once per modal session
      if (!hasRefreshedRef.current) {
        setResourcesLoaded(false);
        fetchResources();
        hasRefreshedRef.current = true;
      }
      
      // First check enriched user from URL
      if (enrichedUser && enrichedUser.userName && !officerCallSign) {
        console.log("Setting officer name from enrichedUser:", enrichedUser.userName);
        setOfficerCallSign(enrichedUser.userName);
        return;
      }
      
      // Then check props
      if (user && user.userName && !officerCallSign) {
        console.log("Setting officer name from props:", user.userName);
        setOfficerCallSign(user.userName);
        return;
      }
      
      // Last attempt - grab directly from URL if not already loaded
      if (!loadedFromUrlRef.current) {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const userParam = urlParams.get('user');
          
          if (userParam) {
            const parsedUser = JSON.parse(decodeURIComponent(userParam));
            if (parsedUser.userName) {
              console.log("Last resort: Setting name from URL:", parsedUser.userName);
              setOfficerCallSign(parsedUser.userName);
              
              // Also update enriched user if we don't have it yet
              if (!enrichedUser) {
                setEnrichedUser(parsedUser);
              }
            }
          }
        } catch (e) {
          console.error("Error in last attempt to get username:", e);
        }
      }
    } else {
      // Reset refresh flag when modal is closed
      hasRefreshedRef.current = false;
    }
  }, [show, enrichedUser, user, officerCallSign]);
  
  // Debug user object - only log when it actually changes
  useEffect(() => {
    if (user && hasUserChanged) {
      console.log('Special Resources Modal - User object:', user);
      // Update the ref with current user
      prevUserRef.current = { ...user };
    }
  }, [user, hasUserChanged]);
  
  // Initialize tour time and user details when modal opens
  useEffect(() => {
    // Only run if modal is shown, we haven't loaded data yet, and we have either user props or enriched user data
    if (show && !dataLoaded && (user || enrichedUser)) {
      // Use the enriched user from URL if available, otherwise use the props
      const userData = enrichedUser || user;
      
      // Set default end time to 8 hours from now, but not more than end of day
      const eightHoursLater = moment().tz('America/New_York').add(8, 'hours');
      const endOfDay = moment().tz('America/New_York').endOf('day');
      // Use whichever is earlier
      const defaultEndTime = eightHoursLater.isBefore(endOfDay) ? eightHoursLater : endOfDay;
      setTourEnd(defaultEndTime.format('YYYY-MM-DDTHH:mm'));
      
      // Set default department based on user info if available
      if (userData && userData.department) {
        setDepartment(userData.department);
      }
      
      // Mark data as loaded to prevent repeated loading
      setDataLoaded(true);
    }
  }, [show, user, enrichedUser, dataLoaded, officerCallSign]);
  
  // Load resources and categories once we have user data - modified to avoid repeated fetches
  useEffect(() => {
    // Only fetch if the modal is shown, we've loaded user data, and we have user info available,
    // AND we haven't already loaded resources/categories successfully
    if (show && dataLoaded && (user || enrichedUser)) {
      // Only fetch if not already loaded
      if (!resourcesLoaded) {
        fetchResources();
      }
      if (!categoriesLoaded) {
        fetchCategories();
      }
    }
  }, [show, dataLoaded, user, enrichedUser, resourcesLoaded, categoriesLoaded]);
  
  // Reset dataLoaded when modal closes so it will reload on next open
  useEffect(() => {
    if (!show) {
      setDataLoaded(false);
      // Do NOT reset resourcesLoaded or categoriesLoaded here to prevent refetching
      // when the modal is reopened
    }
  }, [show]);
  
  // Reset filter to 'all' if current filter has no resources or doesn't exist in categories
  useEffect(() => {
    if (selectedFilter !== 'all') {
      // Check if any resources match this filter
      const hasMatchingResources = resources.some(
        r => r.category_id.toString() === selectedFilter
      );
      
      // Check if the category still exists
      const categoryExists = categories.some(
        c => c.id.toString() === selectedFilter
      );
      
      if (!hasMatchingResources || !categoryExists) {
        setSelectedFilter('all');
      }
    }
  }, [resources, categories, selectedFilter]);
  
  // Fetch active special resources - modified to update resourcesLoaded state
  const fetchResources = async () => {
    // Skip if already loaded and prevent duplicate requests
    if (resourcesLoaded) return;

    // Use enriched user if available, otherwise use props
    const userData = enrichedUser || user;
    
    // Skip if we don't have user data yet
    if (!userData || (!userData.userEmail && !userData.email && !userData.userId)) {
      console.log('Skipping resource fetch - insufficient user data');
      return;
    }
    
    setIsLoading(true);
    try {
      // Ensure we have a valid user email from either userEmail or email field
      const userEmail = userData?.userEmail || userData?.email || `${userData.userId}@slack.user`;
      
      if (!userEmail) {
        console.warn('No user email available for API request');
        return; // Skip the API call if no email
      }
      
      const baseUrl = process.env.REACT_APP_API_URL || '';
      console.log(`Fetching resources with user email: ${userEmail}`);
      
      const response = await fetch(`${baseUrl}/api/special-resources`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-User-Email': userEmail
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch resources: ${response.status}`);
      }
      
      const data = await response.json();
      setResources(data);
      setResourcesLoaded(true); // Mark resources as loaded successfully
    } catch (error) {
      console.error('Error fetching special resources:', error);
      toast.error('Failed to load special resources');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch resource categories - modified to update categoriesLoaded state
  const fetchCategories = async () => {
    // Skip if already loaded and prevent duplicate requests
    if (categoriesLoaded) return;

    // Use enriched user if available, otherwise use props
    const userData = enrichedUser || user;
    
    // Skip if we don't have user data yet
    if (!userData || (!userData.userEmail && !userData.email && !userData.userId)) {
      console.log('Skipping categories fetch - insufficient user data');
      return;
    }
    
    try {
      // Ensure we have a valid user email from either userEmail or email field
      const userEmail = userData?.userEmail || userData?.email || `${userData.userId}@slack.user`;
      
      if (!userEmail) {
        console.warn('No user email available for API request');
        return; // Skip the API call if no email
      }
      
      const baseUrl = process.env.REACT_APP_API_URL || '';
      console.log(`Fetching categories with user email: ${userEmail}`);
      
      const response = await fetch(`${baseUrl}/api/special-resources/categories`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-User-Email': userEmail
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch categories: ${response.status}`);
      }
      
      const data = await response.json();
      setCategories(data);
      setCategoriesLoaded(true); // Mark categories as loaded successfully
      
      // Set default category if available
      if (data.length > 0 && !categoryId) {
        setCategoryId(data[0].id.toString());
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load resource categories');
    }
  };
  
  // Update handleSubmit to handle both create and update
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Try to get user data from multiple sources
    let userToUse = null;
    
    // 1. First try the enriched user from URL
    if (enrichedUser && enrichedUser.userEmail) {
      userToUse = enrichedUser;
    } 
    // 2. Then try the user prop
    else if (user && user.userEmail) {
      userToUse = user;
    }
    // 3. Last resort - try to get it from URL params again
    else {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const userParam = urlParams.get('user');
        if (userParam) {
          userToUse = JSON.parse(decodeURIComponent(userParam));
          console.log("Got user data from URL params as last resort:", userToUse);
        }
      } catch (e) {
        console.error("Error getting user data from URL params:", e);
      }
    }
    
    // If we still don't have user data, show an error
    if (!userToUse) {
      toast.error('Unable to determine user identity, please refresh the page');
      return;
    }
    
    // Use either userId directly or extract it
    const userId = userToUse.userId || userToUse.id || 'unknown';
    
    // Use either userEmail directly or create one from userId if necessary
    const userEmail = userToUse.userEmail || userToUse.email || `${userId}@slack.user`;
    
    // Use the officer call sign from form for the user_name field
    const userName = officerCallSign;
    
    console.log('Form submission - User info:', {
      userEmail,
      userId,
      userName
    });
    
    if (!department || !categoryId || !tourEnd) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    // Validate tour end time
    const now = moment().tz('America/New_York');
    const endMoment = moment.tz(tourEnd, 'America/New_York');
    const maxEndTime = moment().tz('America/New_York').add(24, 'hours');
    
    if (!endMoment.isValid()) {
      toast.error('Invalid date/time format');
      return;
    }
    
    if (endMoment.isSameOrBefore(now)) {
      toast.error('Tour end time must be in the future');
      return;
    }
    
    if (endMoment.isAfter(maxEndTime)) {
      toast.error('Tour end time cannot be more than 24 hours from now');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const baseUrl = process.env.REACT_APP_API_URL || '';
      
      // Determine if we're updating or creating
      const isUpdate = !!editingResource;
      const url = isUpdate 
        ? `${baseUrl}/api/special-resources/${editingResource.id}`
        : `${baseUrl}/api/special-resources`;
        
      const method = isUpdate ? 'PUT' : 'POST';
      
      const payload = isUpdate 
        ? {
            department,
            category_id: parseInt(categoryId, 10),
            skill_description: skillDescription,
            tour_end: endMoment.toISOString()
          }
        : {
            user_id: userId,
            user_email: userEmail,
            user_name: userName,
            department,
            category_id: parseInt(categoryId, 10),
            skill_description: skillDescription,
            tour_start: moment().tz('America/New_York').toISOString(),
            tour_end: endMoment.toISOString()
          };
      
      const response = await fetch(url, {
        method: method,
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-User-Email': userEmail,
          'X-Is-Admin': isAdmin ? 'true' : 'false'  // Add admin flag to headers
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to ${isUpdate ? 'update' : 'add'} resource: ${response.status} ${errorData.error || ''}`);
      }
      
      // Clear form and editing state
      setCategoryId('');
      setSkillDescription('');
      setTourEnd(moment().tz('America/New_York').add(8, 'hours').format('YYYY-MM-DDTHH:mm'));
      setEditingResource(null);
      
      // Force refresh resources regardless of resourcesLoaded state
      setResourcesLoaded(false); // Reset to force a refresh
      await fetchResources();
      
      toast.success(`Special resource ${isUpdate ? 'updated' : 'added'} successfully`);
      
      // Switch to view tab
      setActiveTab('view');
    } catch (error) {
      console.error(`Error ${editingResource ? 'updating' : 'adding'} special resource:`, error);
      toast.error(error.message || `Failed to ${editingResource ? 'update' : 'add'} special resource`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format date/time for display
  const formatDateTime = (isoString) => {
    return moment.tz(isoString, 'America/New_York').format('MM/DD/YYYY hh:mm A');
  };
  
  // Calculate time remaining
  const getTimeRemaining = (endTime) => {
    const end = moment.tz(endTime, 'America/New_York');
    const now = moment().tz('America/New_York');
    
    if (now > end) return 'Expired';
    
    const duration = moment.duration(end.diff(now));
    const hours = Math.floor(duration.asHours());
    const minutes = Math.floor(duration.minutes());
    
    if (hours < 1) {
      return `${minutes}m remaining`;
    }
    
    return `${hours}h ${minutes}m remaining`;
  };
  
  // Check if a tour is about to expire (less than 1 hour)
  const isAboutToExpire = (endTime) => {
    const end = moment.tz(endTime, 'America/New_York');
    const now = moment().tz('America/New_York');
    const diff = end.diff(now, 'minutes');
    return diff > 0 && diff < 60;
  };
  
  // Get skill card background color
  const getSkillCardColor = (endTime) => {
    if (isAboutToExpire(endTime)) {
      return 'rgba(255, 193, 7, 0.2)'; // Warning yellow for about to expire
    }
    return 'rgba(255, 255, 255, 0.05)'; // Subtle highlight in dark theme
  };
  
  // Function to delete a resource
  const handleDeleteResource = async (resourceId) => {
    // Confirm before deleting
    if (!window.confirm('Are you sure you want to remove this resource?')) {
      return;
    }
    
    try {
      // Use enriched user if available, otherwise use props
      const userData = enrichedUser || user;
      
      if (!userData || (!userData.userEmail && !userData.email && !userData.userId)) {
        toast.error('User info not available. Please refresh the page.');
        return;
      }
      
      // Ensure we have a valid user email
      const userEmail = userData?.userEmail || userData?.email || `${userData.userId}@slack.user`;
      
      if (!userEmail) {
        toast.error('User email not available. Please refresh the page.');
        return;
      }
      
      const baseUrl = process.env.REACT_APP_API_URL || '';
      
      setIsLoading(true);
      
      const response = await fetch(`${baseUrl}/api/special-resources/${resourceId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'X-User-Email': userEmail,
          'X-Is-Admin': isAdmin ? 'true' : 'false'  // Add admin flag to headers
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to delete resource: ${response.status} ${errorData.error || ''}`);
      }
      
      // Refresh resources list
      setResourcesLoaded(false);
      await fetchResources();
      
      toast.success('Resource removed successfully');
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error(error.message || 'Failed to delete resource');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Effect to check if user is an admin when userData changes
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        // Use enriched user if available, otherwise use props
        const userData = enrichedUser || user;
        
        if (!userData || (!userData.userEmail && !userData.email && !userData.userId)) {
          console.log('Cannot check admin status - insufficient user data');
          return;
        }
        
        // Check if admin flag is directly in the user object
        if (userData.permissions && userData.permissions.admin) {
          console.log('User is admin based on permissions object');
          setIsAdmin(true);
          return;
        }

        if (userData.isAdmin === true) {
          console.log('User is admin based on isAdmin flag');
          setIsAdmin(true);
          return;
        }
        
        // If we can't determine from user object, try to fetch from server
        const userEmail = userData?.userEmail || userData?.email || `${userData.userId}@slack.user`;
        
        if (!userEmail) {
          console.warn('No user email available for admin check');
          return;
        }
        
        const baseUrl = process.env.REACT_APP_API_URL || '';
        const response = await fetch(`${baseUrl}/api/users/check-admin`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'X-User-Email': userEmail
          }
        });
        
        if (response.ok) {
          const { isAdmin } = await response.json();
          console.log('Admin check API response:', isAdmin);
          setIsAdmin(!!isAdmin);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        // Default to not admin if there's an error
        setIsAdmin(false);
      }
    };
    
    if (show) {
      checkAdminStatus();
    }
  }, [show, enrichedUser, user]);
  
  // Render nothing if modal is not shown
  if (!show) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: 1100,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        backgroundColor: 'rgba(27, 27, 27, 0.9)',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        padding: '0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #333',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)'
      }}>
        {/* Header */}
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(16, 16, 16, 0.493)', // From modal-header in App.css
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>Special Resources</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              color: '#fff'
            }}
          >
            ×
          </button>
        </div>
        
        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #333'
        }}>
          <button 
            onClick={() => setActiveTab('view')}
            style={{
              flex: 1,
              padding: '10px',
              background: activeTab === 'view' ? '#2c2c2c' : '#1b1b1b',
              border: 'none',
              borderBottom: activeTab === 'view' ? '2px solid #007bff' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'view' ? 'bold' : 'normal',
              color: '#fff'
            }}
          >
            View Resources
          </button>
          <button 
            onClick={() => {
              setActiveTab('add');
              // Clear edit state when switching to add tab
              if (editingResource) {
                setEditingResource(null);
                setCategoryId('');
                setSkillDescription('');
                setDepartment(user?.department || '');
                setTourEnd(moment().tz('America/New_York').add(8, 'hours').format('YYYY-MM-DDTHH:mm'));
              }
            }}
            style={{
              flex: 1,
              padding: '10px',
              background: activeTab === 'add' ? '#2c2c2c' : '#1b1b1b',
              border: 'none',
              borderBottom: activeTab === 'add' ? '2px solid #007bff' : 'none',
              cursor: 'pointer',
              fontWeight: activeTab === 'add' ? 'bold' : 'normal',
              color: '#fff'
            }}
          >
            {editingResource ? 'Edit Resource' : 'Add Resource'}
          </button>
        </div>
        
        {/* Content */}
        <div style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1,
          backgroundColor: '#2c2c2c' // Matching form-container gradient start in App.css
        }}>
          {activeTab === 'view' ? (
            // View Resources Tab
            <div>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#ccc' }}>
                  Loading resources...
                </div>
              ) : resources.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>
                  No active special resources available.
                </div>
              ) : (
                <div>
                  {/* Filter dropdown with resource counts */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '15px' 
                  }}>
                    <div style={{ fontSize: '14px', color: '#aaa' }}>
                      Showing {selectedFilter === 'all' ? resources.length : resources.filter(r => r.category_id.toString() === selectedFilter).length} active special resources
                    </div>
                    
                    {/* Styled dropdown with color indicators */}
                    <div className="category-dropdown" style={{ position: 'relative', minWidth: '180px' }}>
                      <select 
                        value={selectedFilter}
                        onChange={(e) => setSelectedFilter(e.target.value)}
                        style={{
                          padding: '8px 10px',
                          paddingLeft: selectedFilter !== 'all' ? '28px' : '10px',
                          backgroundColor: '#333',
                          color: '#fff',
                          border: '1px solid #444',
                          borderRadius: '4px',
                          fontSize: '14px',
                          width: '100%',
                          cursor: 'pointer',
                          appearance: 'menulist-button',
                          fontWeight: 'bold'
                        }}
                        title="Filter resources by category"
                      >
                        <option 
                          value="all"
                          style={{
                            fontWeight: 'bold',
                            backgroundColor: '#333',
                            color: '#fff',
                            padding: '4px'
                          }}
                        >
                          All Resources ({resources.length})
                        </option>
                        {categories.map(category => {
                          const count = resources.filter(r => r.category_id === category.id).length;
                          if (count > 0) {
                            const categoryColor = getCategoryColor(category.id, category.name);
                            return (
                              <option 
                                key={category.id} 
                                value={category.id.toString()}
                                style={{
                                  backgroundColor: '#333',
                                  color: '#fff',
                                  fontWeight: selectedFilter === category.id.toString() ? 'bold' : 'normal',
                                  padding: '4px',
                                  paddingLeft: '20px'
                                }}
                              >
                                {category.name} ({count})
                              </option>
                            );
                          }
                          return null;
                        })}
                      </select>
                      
                      {/* Color indicator dot for selected category */}
                      {selectedFilter !== 'all' && (
                        <div 
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '10px',
                            transform: 'translateY(-50%)',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: getCategoryColor(
                              parseInt(selectedFilter, 10),
                              categories.find(c => c.id.toString() === selectedFilter)?.name || ''
                            )
                          }}
                        />
                      )}
                    </div>
                  </div>
                  
                  {/* Filtered resources */}
                  {(() => {
                    const filteredResources = resources.filter(
                      resource => selectedFilter === 'all' || resource.category_id.toString() === selectedFilter
                    );
                    
                    // If no resources match the filter
                    if (filteredResources.length === 0 && selectedFilter !== 'all') {
                      const selectedCategory = categories.find(c => c.id.toString() === selectedFilter);
                      return (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '20px', 
                          color: '#aaa',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '6px',
                          marginBottom: '10px'
                        }}>
                          No active {selectedCategory?.name || 'resources'} available.
                        </div>
                      );
                    }
                    
                    // Display filtered resources
                    return filteredResources.map(resource => (
                      <div 
                        key={resource.id}
                        style={{
                          padding: '12px',
                          marginBottom: '10px',
                          borderRadius: '6px',
                          border: '1px solid #444',
                          backgroundColor: getSkillCardColor(resource.tour_end)
                        }}
                      >
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          marginBottom: '4px' 
                        }}>
                          <span style={{ fontWeight: 'bold', color: '#fff' }}>{resource.user_name}</span>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ 
                              fontSize: '12px', 
                              color: isAboutToExpire(resource.tour_end) ? '#dc3545' : '#ccc',
                              fontWeight: isAboutToExpire(resource.tour_end) ? 'bold' : 'normal',
                              marginRight: '10px'
                            }}>
                              {getTimeRemaining(resource.tour_end)}
                            </span>
                            
                            {/* Edit/Delete buttons - shown for user's own resources or for admins */}
                            {(isAdmin || 
                              resource.user_email === (enrichedUser?.userEmail || user?.userEmail) || 
                              resource.user_id === (enrichedUser?.userId || user?.userId)) && (
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                  onClick={() => handleEditResource(resource)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#3498db',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    padding: '0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    opacity: 0.7,
                                  }}
                                  title={isAdmin && resource.user_email !== (enrichedUser?.userEmail || user?.userEmail) ? "Edit as admin" : "Edit this resource"}
                                  disabled={isLoading}
                                >
                                  ✎
                                </button>
                                <button
                                  onClick={() => handleDeleteResource(resource.id)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#dc3545',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    padding: '0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    opacity: 0.7,
                                  }}
                                  title={isAdmin && resource.user_email !== (enrichedUser?.userEmail || user?.userEmail) ? "Delete as admin" : "Remove this resource"}
                                  disabled={isLoading}
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div style={{ 
                          display: 'flex', 
                          marginBottom: '4px',
                          fontSize: '14px' 
                        }}>
                          <span 
                            onClick={() => setSelectedFilter(resource.category_id.toString())}
                            style={{ 
                              backgroundColor: getCategoryColor(resource.category_id, resource.category_name), 
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              marginRight: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            title={`Click to filter by ${resource.category_name}`}
                          >
                            {resource.category_name}
                          </span>
                          <span style={{ color: '#ddd' }}>{resource.department}</span>
                        </div>
                        
                        {resource.skill_description && (
                          <div style={{ 
                            marginTop: '8px',
                            fontSize: '14px',
                            color: '#ccc',
                            fontStyle: 'italic'
                          }}>
                            "{resource.skill_description}"
                          </div>
                        )}
                        
                        <div style={{ 
                          fontSize: '12px',
                          color: '#aaa',
                          marginTop: '8px'
                        }}>
                          Available until: {formatDateTime(resource.tour_end)}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          ) : (
            // Add Resource Tab
            <form onSubmit={handleSubmit}>
              <h3 style={{ 
                marginTop: 0, 
                marginBottom: '15px', 
                color: '#fff',
                borderBottom: '1px solid #444',
                paddingBottom: '10px'
              }}>
                {editingResource ? 'Edit Special Resource' : 'Add New Special Resource'}
              </h3>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '5px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: '#fff'
                }}>
                  Officer Name / Call Sign*
                </label>
                <input 
                  type="text"
                  value={officerCallSign}
                  onChange={(e) => setOfficerCallSign(e.target.value)}
                  placeholder="Enter your name and/or call sign"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    fontSize: '16px',
                    backgroundColor: '#333',
                    color: '#fff'
                  }}
                  required
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '5px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: '#fff'
                }}>
                  Department*
                </label>
                <input 
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Enter your department"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    fontSize: '16px',
                    backgroundColor: '#333',
                    color: '#fff'
                  }}
                  required
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '5px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: '#fff'
                }}>
                  Special Skill/Resource*
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    fontSize: '16px',
                    backgroundColor: '#333',
                    color: '#fff'
                  }}
                  required
                >
                  <option value="">Select a skill/resource</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '5px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: '#fff'
                }}>
                  Additional Details
                </label>
                <textarea
                  value={skillDescription}
                  onChange={(e) => setSkillDescription(e.target.value)}
                  placeholder="Add any additional details about your skill/resource"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    fontSize: '16px',
                    backgroundColor: '#333',
                    color: '#fff',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'block',
                  marginBottom: '5px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: '#fff'
                }}>
                  Available Until (Tour End)*
                </label>
                <input 
                  type="datetime-local"
                  value={tourEnd}
                  onChange={(e) => setTourEnd(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #444',
                    fontSize: '16px',
                    backgroundColor: '#333',
                    color: '#fff'
                  }}
                  required
                />
                <div style={{ 
                  fontSize: '12px', 
                  color: '#aaa', 
                  marginTop: '5px',
                  fontStyle: 'italic'
                }}>
                  Select a time within the next 24 hours when you'll be available with this resource.
                </div>
              </div>
              
              <div style={{
                padding: '10px',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderRadius: '4px',
                marginBottom: '15px',
                fontSize: '14px',
                color: '#eef1ef', // From modal-body color in App.css
                border: '1px solid rgba(0, 123, 255, 0.2)'
              }}>
                <strong>IMPORTANT:</strong> Any requests for outside resources must still go through your department procedures. This system is only to notify other agencies of resource availability.
              </div>
              
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    backgroundColor: '#28a745', // From form-container button in App.css
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '10px 20px',
                    fontSize: '16px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1
                  }}
                >
                  {isLoading ? 'Saving...' : (editingResource ? 'Update Special Resource' : 'Add Special Resource')}
                </button>
              </div>
            </form>
          )}
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '15px 20px',
          borderTop: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          backgroundColor: 'hsla(0, 0%, 6%, .493)', // From modal-footer in App.css
          color: '#eef1ef'
        }}>
          <div style={{ fontSize: '12px', color: '#aaa' }}>
            All times shown in EST
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

SpecialResourcesModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  user: PropTypes.shape({
    userEmail: PropTypes.string,
    userName: PropTypes.string,
    userId: PropTypes.string,
    department: PropTypes.string
  })
};

export default SpecialResourcesModal; 