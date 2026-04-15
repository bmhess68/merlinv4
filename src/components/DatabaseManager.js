import React, { useState, useEffect } from 'react';

const DatabaseManager = () => {
    const [activeTab, setActiveTab] = useState('incidentTypes');
    const [items, setItems] = useState([]);
    const [newItem, setNewItem] = useState('');
    const [newItemDescription, setNewItemDescription] = useState(''); // For resource categories description
    const [editingItem, setEditingItem] = useState(null);
    const [error, setError] = useState(null);
    const [adminEmail, setAdminEmail] = useState('');
    const [showAdminEmailInput, setShowAdminEmailInput] = useState(false);

    // Debug logging for table names
    useEffect(() => {
        console.log('Current table type:', activeTab);
    }, [activeTab]);

    const tabs = {
        incidentTypes: 'Incident Types',
        dispositions: 'Dispositions',
        assignments: 'Assignments',
        resourceCategories: 'Special Resources'
    };

    const fetchItems = async (type) => {
        try {
            let endpoint;
            switch(type) {
                case 'incidentTypes':
                    endpoint = '/api/incidents/types';
                    break;
                case 'dispositions':
                    endpoint = '/api/incidents/dispositions';
                    break;
                case 'assignments':
                    endpoint = '/api/admin/database/assignments';
                    break;
                case 'resourceCategories':
                    endpoint = '/api/special-resources/categories';
                    break;
                default:
                    throw new Error('Invalid type');
            }
            
            const response = await fetch(endpoint);
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                console.error('Data is not an array:', data);
                setItems([]);
                setError('Invalid data format received');
                return;
            }
            
            setItems(data);
            setError(null);
        } catch (error) {
            console.error(`Failed to fetch ${type}:`, error);
            setItems([]);
            setError(`Failed to fetch ${type}`);
        }
    };

    useEffect(() => {
        fetchItems(activeTab);
        // Reset form fields when changing tabs
        setNewItem('');
        setNewItemDescription('');
        setEditingItem(null);
    }, [activeTab]);

    const handleAdd = async () => {
        if (!newItem.trim()) return;

        try {
            let endpoint;
            let body;

            // Different handling for resource categories
            if (activeTab === 'resourceCategories') {
                endpoint = '/api/special-resources/categories';
                body = JSON.stringify({ 
                    name: newItem,
                    description: newItemDescription || '' 
                });
            } else {
                endpoint = `/api/admin/database/${activeTab}`;
                body = JSON.stringify({ name: newItem });
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-Email': getCurrentUserEmail()
                },
                body: body
            });

            if (response.ok) {
                setNewItem('');
                setNewItemDescription('');
                fetchItems(activeTab);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to add item');
            }
        } catch (error) {
            console.error('Failed to add item:', error);
            setError('Failed to add item: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            try {
                let endpoint;
                
                if (activeTab === 'resourceCategories') {
                    endpoint = `/api/special-resources/categories/${id}`;
                } else {
                    endpoint = `/api/admin/database/${activeTab}/${id}`;
                }
                
                // Detailed debugging of URL parameters
                console.log('URL search params:', window.location.search);
                const urlParams = new URLSearchParams(window.location.search);
                const userParam = urlParams.get('user');
                console.log('Raw user param from URL:', userParam);
                
                // Get user email
                const userEmail = getCurrentUserEmail();
                console.log('User email to be used in header:', userEmail);
                
                if (!userEmail) {
                    setError('User email is missing. Please log in again.');
                    return;
                }
                
                console.log(`Sending DELETE request to ${endpoint} with X-User-Email: ${userEmail}`);
                
                // Add a timestamp to avoid caching
                const timestamp = new Date().getTime();
                const finalEndpoint = `${endpoint}?t=${timestamp}`;
                
                const response = await fetch(finalEndpoint, {
                    method: 'DELETE',
                    headers: {
                        'X-User-Email': userEmail,
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });

                console.log('Response status:', response.status);
                
                if (response.ok) {
                    fetchItems(activeTab);
                    setError(null);
                } else {
                    // Try to parse the error response
                    let errorMessage = 'Failed to delete item';
                    let errorDetails = '';
                    try {
                        const errorData = await response.json();
                        console.log('Error response data:', errorData);
                        errorMessage = errorData.error || errorMessage;
                        errorDetails = errorData.details || '';
                    } catch (parseError) {
                        console.error('Could not parse error response:', parseError);
                        try {
                            // Try to get the raw text if JSON parsing fails
                            const text = await response.text();
                            console.log('Raw error response:', text);
                        } catch (e) {
                            console.error('Could not get response text either:', e);
                        }
                    }
                    
                    if (response.status === 403) {
                        errorMessage = 'You do not have permission to delete this item. Admin privileges required.';
                    } else if (response.status === 401) {
                        errorMessage = 'Authentication required. Please log in again.';
                    } else if (response.status === 400) {
                        // For special resource categories, this likely means it's in use
                        errorMessage = 'Cannot delete this item because it is in use by one or more resources.';
                    }
                    
                    if (errorDetails) {
                        errorMessage += ` (${errorDetails})`;
                    }
                    
                    console.error(`Delete failed with status ${response.status}: ${errorMessage}`);
                    setError(errorMessage);
                }
            } catch (error) {
                console.error('Failed to delete item:', error);
                setError('Failed to delete item: ' + error.message);
            }
        }
    };

    const handleEdit = async (id) => {
        if (editingItem?.id === id) {
            try {
                let endpoint;
                let body;
                
                if (activeTab === 'resourceCategories') {
                    endpoint = `/api/special-resources/categories/${id}`;
                    body = JSON.stringify({ 
                        name: editingItem.name,
                        description: editingItem.description || '' 
                    });
                } else {
                    endpoint = `/api/admin/database/${activeTab}/${id}`;
                    body = JSON.stringify({ name: editingItem.name });
                }

                const response = await fetch(endpoint, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-User-Email': getCurrentUserEmail()
                    },
                    body: body
                });

                if (response.ok) {
                    setEditingItem(null);
                    fetchItems(activeTab);
                } else {
                    const errorData = await response.json();
                    setError(errorData.error || 'Failed to update item');
                }
            } catch (error) {
                console.error('Failed to update item:', error);
                setError('Failed to update item: ' + error.message);
            }
        } else {
            const item = items.find(item => item.id === id);
            setEditingItem(item);
        }
    };

    // Helper function to get current user email from URL or other sources
    const getCurrentUserEmail = () => {
        // If admin email has been manually set, use that
        if (adminEmail) {
            console.log('Using manually set admin email:', adminEmail);
            return adminEmail;
        }
        
        console.log('Getting current user email - Start');
        
        // Try to get from URL params first
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const userParam = urlParams.get('user');
            
            console.log('User param from URL:', userParam ? 'Found' : 'Not found');
            
            if (!userParam) {
                console.error('User parameter is missing from URL');
            } else {
                try {
                    const userData = JSON.parse(decodeURIComponent(userParam));
                    console.log('User data parsed:', JSON.stringify(userData, null, 2));
                    
                    // Check for admin permissions
                    const hasAdmin = userData.permissions && userData.permissions.admin;
                    console.log('Has admin permissions:', hasAdmin);
                    
                    if (!userData.userEmail) {
                        console.error('userEmail is missing from user data:', userData);
                    } else {
                        console.log('Using user email for authentication:', userData.userEmail);
                        return userData.userEmail;
                    }
                } catch (parseError) {
                    console.error('Failed to parse user data:', parseError);
                }
            }
        } catch (urlError) {
            console.error('Error accessing URL parameters:', urlError);
        }
        
        // Fallback: Try to get email from localStorage if available
        console.log('Trying localStorage fallback');
        try {
            const localUser = localStorage.getItem('user');
            console.log('User data in localStorage:', localUser ? 'Found' : 'Not found');
            
            if (localUser) {
                try {
                    const userData = JSON.parse(localUser);
                    console.log('User data from localStorage:', JSON.stringify(userData, null, 2));
                    
                    // Check for admin permissions
                    const hasAdmin = userData.permissions && userData.permissions.admin;
                    console.log('Has admin permissions (localStorage):', hasAdmin);
                    
                    if (userData.userEmail) {
                        console.log('Using email from localStorage:', userData.userEmail);
                        return userData.userEmail;
                    } else {
                        console.error('No userEmail in localStorage data');
                    }
                } catch (parseError) {
                    console.error('Error parsing localStorage user:', parseError);
                }
            }
        } catch (localStorageError) {
            console.error('Error accessing localStorage:', localStorageError);
        }
        
        // Last resort - try to find from document.cookie
        console.log('Trying cookie fallback');
        try {
            const cookies = document.cookie.split(';');
            const userCookie = cookies.find(cookie => cookie.trim().startsWith('user='));
            
            if (userCookie) {
                try {
                    const userData = JSON.parse(decodeURIComponent(userCookie.split('=')[1]));
                    console.log('User data from cookie:', userData);
                    
                    if (userData.email) {
                        console.log('Using email from cookie:', userData.email);
                        return userData.email;
                    }
                } catch (e) {
                    console.error('Error parsing user cookie:', e);
                }
            }
        } catch (cookieError) {
            console.error('Error accessing cookies:', cookieError);
        }
        
        console.error('Could not find user email from any source');
        return '';
    };

    // Special rendering for resource categories with descriptions
    const renderResourceCategories = () => {
        return (
            <>
                <div style={styles.addSection}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input
                            type="text"
                            value={newItem}
                            onChange={(e) => setNewItem(e.target.value)}
                            placeholder="Add new resource category name..."
                            style={styles.input}
                        />
                        <input
                            type="text"
                            value={newItemDescription}
                            onChange={(e) => setNewItemDescription(e.target.value)}
                            placeholder="Description (optional)"
                            style={styles.input}
                        />
                    </div>
                    <button onClick={handleAdd} style={styles.addButton}>
                        Add
                    </button>
                </div>

                <div style={styles.itemList}>
                    {items.map(item => (
                        <div key={item.id} style={styles.resourceItem}>
                            <div style={{ flex: 1 }}>
                                {editingItem?.id === item.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <input
                                            type="text"
                                            value={editingItem.name}
                                            onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                                            style={styles.editInput}
                                        />
                                        <input
                                            type="text"
                                            value={editingItem.description || ''}
                                            onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}
                                            placeholder="Description (optional)"
                                            style={styles.editInput}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                                        {item.description && (
                                            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '5px' }}>
                                                {item.description}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <div style={styles.itemButtons}>
                                <button
                                    onClick={() => handleEdit(item.id)}
                                    style={styles.editButton}
                                >
                                    {editingItem?.id === item.id ? 'Save' : 'Edit'}
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    style={styles.deleteButton}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    // Standard rendering for other tables
    const renderStandardItems = () => {
        return (
            <>
                <div style={styles.addSection}>
                    <input
                        type="text"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        placeholder={`Add new ${activeTab.slice(0, -1)}...`}
                        style={styles.input}
                    />
                    <button onClick={handleAdd} style={styles.addButton}>
                        Add
                    </button>
                </div>

                <div style={styles.itemList}>
                    {items.map(item => (
                        <div key={item.id} style={styles.item}>
                            {editingItem?.id === item.id ? (
                                <input
                                    type="text"
                                    value={editingItem.name}
                                    onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                                    style={styles.editInput}
                                />
                            ) : (
                                <span>{item.name}</span>
                            )}
                            <div style={styles.itemButtons}>
                                <button
                                    onClick={() => handleEdit(item.id)}
                                    style={styles.editButton}
                                >
                                    {editingItem?.id === item.id ? 'Save' : 'Edit'}
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    style={styles.deleteButton}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    return (
        <div style={styles.container}>
            <h3 style={styles.heading}>Database Manager</h3>
            
            {error && (
                <div style={styles.error}>
                    {error}
                    {error && error.includes('permission') && !showAdminEmailInput && (
                        <button 
                            onClick={() => setShowAdminEmailInput(true)}
                            style={{
                                marginLeft: '10px',
                                padding: '4px 8px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Set Admin Email
                        </button>
                    )}
                </div>
            )}
            
            {showAdminEmailInput && (
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    marginBottom: '15px',
                    padding: '10px',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderRadius: '4px'
                }}>
                    <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="Enter admin email"
                        style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #444',
                            backgroundColor: '#333',
                            color: '#fff'
                        }}
                    />
                    <button
                        onClick={() => {
                            if (adminEmail) {
                                console.log('Admin email set to:', adminEmail);
                                setShowAdminEmailInput(false);
                                setError(null);
                            }
                        }}
                        style={{
                            padding: '8px 16px',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: '#28a745',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        Use This Email
                    </button>
                </div>
            )}
            
            <div style={styles.tabs}>
                {Object.entries(tabs).map(([key, label]) => (
                    <button
                        key={key}
                        style={{
                            ...styles.tabButton,
                            ...(activeTab === key ? styles.activeTab : {})
                        }}
                        onClick={() => setActiveTab(key)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {activeTab === 'resourceCategories' 
                ? renderResourceCategories() 
                : renderStandardItems()
            }
        </div>
    );
};

const styles = {
    container: {
        padding: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '8px',
        marginTop: '20px'
    },
    heading: {
        marginBottom: '20px',
        color: '#fff'
    },
    tabs: {
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
        flexWrap: 'wrap'
    },
    tabButton: {
        padding: '8px 16px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        backgroundColor: '#444',
        color: '#fff'
    },
    activeTab: {
        backgroundColor: '#007bff'
    },
    addSection: {
        display: 'flex',
        gap: '10px',
        marginBottom: '20px'
    },
    input: {
        flex: 1,
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #444',
        backgroundColor: '#333',
        color: '#fff'
    },
    addButton: {
        padding: '8px 16px',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: '#28a745',
        color: '#fff',
        cursor: 'pointer'
    },
    itemList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    item: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px',
        backgroundColor: '#444',
        borderRadius: '4px',
        color: '#fff'
    },
    resourceItem: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px',
        backgroundColor: '#444',
        borderRadius: '4px',
        color: '#fff'
    },
    itemButtons: {
        display: 'flex',
        gap: '10px'
    },
    editButton: {
        padding: '4px 8px',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: '#ffc107',
        color: '#000',
        cursor: 'pointer'
    },
    deleteButton: {
        padding: '4px 8px',
        border: 'none',
        borderRadius: '4px',
        backgroundColor: '#dc3545',
        color: '#fff',
        cursor: 'pointer'
    },
    editInput: {
        padding: '4px',
        borderRadius: '4px',
        border: '1px solid #666',
        backgroundColor: '#333',
        color: '#fff'
    },
    error: {
        backgroundColor: '#ff000033',
        color: '#ff0000',
        padding: '10px',
        borderRadius: '4px',
        marginBottom: '10px'
    }
};

export default DatabaseManager;