import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import './StyledIncidentForm.css';
import incidentService from '../services/incidentService';
import axios from 'axios';

const StyledIncidentForm = ({ onClose, onSubmit, location }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('');
    const [incidentTypes, setIncidentTypes] = useState([]);
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [notes, setNotes] = useState('');
    const [radius, setRadius] = useState(0.5);
    const [incidentCommander, setIncidentCommander] = useState('');
    const [stagingManager, setStagingManager] = useState('');
    const [communications, setCommunications] = useState('');
    const [locationAddress, setLocationAddress] = useState('');
    const [isLoadingAddress, setIsLoadingAddress] = useState(false);
    // New state to track if user is manually editing the address
    const [isManuallyEditingAddress, setIsManuallyEditingAddress] = useState(false);
    
    // State to store the extracted user info
    const [userInfo, setUserInfo] = useState({
        userName: 'Unknown',
        userId: 'Unknown'
    });

    useEffect(() => {
        // Extract user information from the URL
        const params = new URLSearchParams(window.location.search);
        const user = params.get('user');
        console.log('Raw user data from URL:', user);
        if (user) {
            try {
                const decodedUser = JSON.parse(decodeURIComponent(user));
                console.log('Decoded user data:', decodedUser); 
                setUserInfo({
                    userName: decodedUser.userName || 'Unknown',
                    userId: decodedUser.userId || 'Unknown'
                });
            } catch (error) {
                console.error('Failed to parse user data from URL:', error);
            }
        }

        const API_URL = process.env.REACT_APP_API_URL || 'https://merlin.westchesterrtc.com';
        
        const fetchIncidentTypes = async () => {
            try {
                const data = await incidentService.getIncidentTypes();
                setIncidentTypes(data);
                console.log('Fetched incident types:', data);
            } catch (error) {
                console.error('Failed to fetch incident types:', error);
            }
        };

        fetchIncidentTypes();

        const now = new Date();
        setDate(now.toISOString().split('T')[0]);
        setTime(now.toTimeString().split(' ')[0].slice(0, 8));
    }, []);

    // Fetch address whenever location changes, but don't override if user is manually editing
    useEffect(() => {
        const fetchAddress = async () => {
            if (location && location.lat && location.lng && !isManuallyEditingAddress) {
                setIsLoadingAddress(true);
                try {
                    // Call the Nominatim API directly
                    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
                        params: {
                            lat: location.lat,
                            lon: location.lng,
                            format: 'json',
                            addressdetails: 1,
                            zoom: 18  // Higher zoom level for more detailed results
                        },
                        headers: {
                            'Accept-Language': 'en'
                        },
                        timeout: 5000  // 5 second timeout
                    });
                    
                    // Format address from the response, excluding county, state, and country
                    if (response.data && response.data.address) {
                        const addr = response.data.address;
                        
                        // Build address parts, prioritizing the most specific components
                        const addressParts = [];
                        
                        // Add house number if available
                        if (addr.house_number) {
                            addressParts.push(addr.house_number);
                        }
                        
                        // Add road/street name
                        if (addr.road) {
                            addressParts.push(addr.road);
                        } 
                        // If no road name is available, try using other identifying features
                        else if (addr.pedestrian) {
                            addressParts.push(addr.pedestrian);
                        } else if (addr.footway) {
                            addressParts.push(addr.footway);
                        } else if (addr.path) {
                            addressParts.push(addr.path);
                        }
                        
                        // If we still don't have a street address, try place names
                        if (addressParts.length === 0) {
                            if (addr.building) {
                                addressParts.push(addr.building);
                            } else if (addr.amenity) {
                                addressParts.push(addr.amenity);
                            } else if (addr.leisure) {
                                addressParts.push(addr.leisure);
                            } else if (addr.natural) {
                                addressParts.push(addr.natural);
                            } else if (addr.place) {
                                addressParts.push(addr.place);
                            }
                        }
                        
                        // Create first line (street address)
                        const streetAddress = addressParts.join(' ');
                        
                        // Add neighborhood, suburb, town/city info if available
                        const localityParts = [];
                        if (addr.neighbourhood) {
                            localityParts.push(addr.neighbourhood);
                        } else if (addr.suburb) {
                            localityParts.push(addr.suburb);
                        }
                        
                        // Add city, town, or village
                        if (addr.city) {
                            localityParts.push(addr.city);
                        } else if (addr.town) {
                            localityParts.push(addr.town);
                        } else if (addr.village) {
                            localityParts.push(addr.village);
                        } else if (addr.hamlet) {
                            localityParts.push(addr.hamlet);
                        }
                        
                        // Join all parts
                        const formattedAddress = [
                            streetAddress,
                            localityParts.join(', ')
                        ].filter(Boolean).join(', ');
                        
                        // Use formatted address or fall back to truncated display_name
                        if (formattedAddress) {
                            setLocationAddress(formattedAddress);
                        } else {
                            // Fallback to display_name but truncate it
                            const shortAddress = response.data.display_name.split(',').slice(0, 2).join(',');
                            setLocationAddress(shortAddress);
                        }
                    } else if (response.data && response.data.display_name) {
                        // Fallback to display_name but only take the first parts (no county/state/country)
                        const shortAddress = response.data.display_name.split(',').slice(0, 2).join(',');
                        setLocationAddress(shortAddress);
                    } else {
                        setLocationAddress(`Location at ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
                    }
                } catch (error) {
                    console.error('Error fetching address:', error);
                    // Fallback to showing coordinates if API call fails
                    setLocationAddress(`Location at ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
                } finally {
                    setIsLoadingAddress(false);
                }
            }
        };

        if (location) {
            fetchAddress();
        }
    }, [location, isManuallyEditingAddress]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name) {
            alert('Please fill out the name field before submitting.');
            return;
        }
        const submissionData = {
            name,
            type,
            location_lat: location ? location.lat : null,
            location_long: location ? location.lng : null,
            location_address: locationAddress,
            notes,
            radius,
            date,
            time,
            incident_commander: incidentCommander,
            staging_manager: stagingManager,
            communications,
            created_by_name: userInfo.userName,
            created_by_userid: userInfo.userId
        };
        console.log('Submitting incident with:', submissionData);
        onSubmit(submissionData);
        setName('');
        setType('');
        setNotes('');
        setRadius(0.5);
        setDate('');
        setTime('');
        setIncidentCommander('');
        setStagingManager('');
        setCommunications('');
    };

    // Handle address field changes
    const handleAddressChange = (e) => {
        setLocationAddress(e.target.value);
        // Mark that the user is now manually editing
        setIsManuallyEditingAddress(true);
    };

    // Button to revert to auto-detected address
    const revertToAutoAddress = async () => {
        setIsManuallyEditingAddress(false);
        // Re-trigger the reverse geocoding
        if (location) {
            setIsLoadingAddress(true);
            try {
                const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
                    params: {
                        lat: location.lat,
                        lon: location.lng,
                        format: 'json',
                        addressdetails: 1,
                        zoom: 18
                    },
                    headers: {
                        'Accept-Language': 'en'
                    },
                    timeout: 5000
                });
                
                if (response.data && response.data.display_name) {
                    const shortAddress = response.data.display_name.split(',').slice(0, 2).join(',');
                    setLocationAddress(shortAddress);
                } else {
                    setLocationAddress(`Location at ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
                }
            } catch (error) {
                console.error('Error re-fetching address:', error);
                setLocationAddress(`Location at ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
            } finally {
                setIsLoadingAddress(false);
            }
        }
    };

    return (
        <Modal 
            show={true} 
            onHide={onClose} 
            centered
            size="md" 
            dialogClassName="incident-form-modal"
        >
            <Modal.Header closeButton>
                <Modal.Title>New Incident</Modal.Title>
            </Modal.Header>
            <Modal.Body className="compact-form">
                <Form>
                    <Form.Group controlId="formName">
                        <Form.Label>Name</Form.Label>
                        <Form.Control
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </Form.Group>
                    <Form.Group controlId="formType" className="mt-2">
                        <Form.Label>Type</Form.Label>
                        <Form.Control
                            as="select"
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            required
                        >
                            <option value="">Select Type</option>
                            {incidentTypes.map((incidentType) => (
                                <option key={incidentType.id} value={incidentType.name}>
                                    {incidentType.name}
                                </option>
                            ))}
                        </Form.Control>
                    </Form.Group>
                    <Form.Group controlId="formLocation" className="mt-2">
                        <Form.Label>Location (Click on Map)</Form.Label>
                        <Form.Control
                            type="text"
                            value={location ? 
                                `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 
                                "Click location on map to set coordinates..."
                            }
                            readOnly
                            style={{
                                fontStyle: location ? 'normal' : 'italic',
                                color: location ? '#fff' : '#888'
                            }}
                        />
                    </Form.Group>
                    
                    {/* Address field - now editable */}
                    <Form.Group controlId="formAddress" className="mt-2">
                        <Form.Label>
                            Address {isLoadingAddress && <small>(loading...)</small>}
                            {isManuallyEditingAddress && 
                                <Button 
                                    variant="link" 
                                    size="sm" 
                                    onClick={revertToAutoAddress}
                                    style={{ fontSize: '0.75rem', padding: '0', marginLeft: '5px' }}
                                >
                                    (revert to auto)
                                </Button>
                            }
                        </Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            value={locationAddress}
                            onChange={handleAddressChange}
                            className={locationAddress && !locationAddress.startsWith('Location at') && !isManuallyEditingAddress ? 'address-success' : ''}
                            style={{
                                fontSize: '0.85rem',
                                color: '#fff',
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                fontStyle: locationAddress && !locationAddress.startsWith('Location at') ? 'normal' : 'italic'
                            }}
                        />
                        {location && !isLoadingAddress && (
                            <div className="text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                                Coordinates: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                {!isManuallyEditingAddress && <span> · Address auto-populated</span>}
                            </div>
                        )}
                    </Form.Group>
                    
                    <div className="row mt-2">
                        <div className="col-6">
                            <Form.Group controlId="formIncidentCommander">
                                <Form.Label>Commander</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={incidentCommander}
                                    onChange={(e) => setIncidentCommander(e.target.value)}
                                />
                            </Form.Group>
                        </div>
                        <div className="col-6">
                            <Form.Group controlId="formRadius">
                                <Form.Label>Radius (mi)</Form.Label>
                                <Form.Control
                                    type="number"
                                    value={radius}
                                    onChange={(e) => setRadius(e.target.value)}
                                    required
                                />
                            </Form.Group>
                        </div>
                    </div>
                    
                    <div className="row mt-2">
                        <div className="col-6">
                            <Form.Group controlId="formStagingManager">
                                <Form.Label>Staging</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={stagingManager}
                                    onChange={(e) => setStagingManager(e.target.value)}
                                />
                            </Form.Group>
                        </div>
                        <div className="col-6">
                            <Form.Group controlId="formCommunications">
                                <Form.Label>Comms</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={communications}
                                    onChange={(e) => setCommunications(e.target.value)}
                                />
                            </Form.Group>
                        </div>
                    </div>
                    
                    <Form.Group controlId="formNotes" className="mt-2">
                        <Form.Label>Notes</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </Form.Group>
                    
                    <Form.Group controlId="formDate" className="mt-2" style={{ display: 'none' }}>
                        <Form.Label>Date</Form.Label>
                        <Form.Control
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </Form.Group>
                    <Form.Group controlId="formTime" className="mt-2" style={{ display: 'none' }}>
                        <Form.Label>Time</Form.Label>
                        <Form.Control
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                        />
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="primary" onClick={handleSubmit} block> 
                    Submit
                </Button>    
            </Modal.Footer>
        </Modal>
    );
};

export default StyledIncidentForm;
