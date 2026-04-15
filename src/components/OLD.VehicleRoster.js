import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import backgroundImage from '../images/background.jpg';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const VehicleRoster = () => {
    const navigate = useNavigate();
    const [incidents, setIncidents] = useState([]);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [loadingVehicles, setLoadingVehicles] = useState(false);
    const [error, setError] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [editIndex, setEditIndex] = useState(-1);
    const [editedVehicle, setEditedVehicle] = useState({});
    const [newVehicle, setNewVehicle] = useState({});
    const [addingPerson, setAddingPerson] = useState(false);
    const [view, setView] = useState('All');
    const [sortCriteria, setSortCriteria] = useState('Time');
    const [sortAscending, setSortAscending] = useState(true);
    const previousVehiclesRef = useRef(null);

    useEffect(() => {
        const fetchAssignments = async () => {
            try {
                const response = await fetch('/api/assignments');
                const data = await response.json();
                setAssignments(data);
            } catch (err) {
                setError('Failed to load assignments.');
                console.error('Error fetching assignments:', err);
            }
        };
        fetchAssignments();
    }, []);

    useEffect(() => {
        const fetchActiveIncidents = async () => {
            try {
                const response = await fetch('/api/incidents');
                const data = await response.json();
                setIncidents(data.filter(incident => incident.active));
            } catch (err) {
                console.error('Error fetching incidents:', err);
            }
        };
        fetchActiveIncidents();
    }, []);

    const fetchVehiclesForIncident = async (incidentId) => {
        try {
            const response = await fetch(`/api/roster/incident-vehicles/${incidentId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const newData = await response.json();

            if (!Array.isArray(newData)) {
                console.warn('Received non-array data:', newData);
                return;
            }

            let sortedData = [...newData];
            if (sortCriteria === 'Time') {
                sortedData = sortByTime(sortedData);
            } else if (sortCriteria === 'Assignment') {
                sortedData = sortByAssignment(sortedData);
            }

            // Deep comparison of arrays
            const currentVehiclesStr = JSON.stringify(sortedData);
            const previousVehiclesStr = JSON.stringify(vehicles);

            if (currentVehiclesStr !== previousVehiclesStr) {
                setVehicles(sortedData);
            }

        } catch (err) {
            console.error('Error fetching vehicles:', err);
            // Don't clear existing vehicles on error
            if (vehicles.length === 0) {
                setError('Failed to load vehicles.');
            }
        }
    };

    useEffect(() => {
        if (selectedIncident) {
            fetchVehiclesForIncident(selectedIncident);
            
            // Set up polling
            const intervalId = setInterval(() => {
                fetchVehiclesForIncident(selectedIncident);
            }, 2500); // Match the main refresh rate
            
            return () => clearInterval(intervalId);
        }
    }, [selectedIncident, sortCriteria]);

    const handleIncidentSelect = (e) => {
        const incidentId = e.target.value;
        setSelectedIncident(incidentId);
        fetchVehiclesForIncident(incidentId);
    };

    const startEditing = (index) => {
        setEditIndex(index);
        setEditedVehicle({ ...vehicles[index] });
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditedVehicle((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleNewVehicleChange = (e) => {
        const { name, value } = e.target;
        setNewVehicle((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const saveEdit = async (index) => {
        try {
            const vehicleId = vehicles[index].vehicle_id;
            const encodedVehicleId = encodeURIComponent(vehicleId);

            // Create an object with only the fields that have been changed
            const updatedFields = {};
            if (editedVehicle.officer_name !== undefined) updatedFields.officer_name = editedVehicle.officer_name || null;
            if (editedVehicle.assignment !== undefined) updatedFields.assignment = editedVehicle.assignment || null;
            if (editedVehicle.notes !== undefined) updatedFields.notes = editedVehicle.notes || null;

            const response = await fetch(`/api/incident-vehicles/${encodedVehicleId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedFields),
            });

            if (response.ok) {
                const updatedVehicles = [...vehicles];
                updatedVehicles[index] = { ...vehicles[index], ...updatedFields };
                setVehicles(updatedVehicles);
                setEditIndex(-1);
                toast.success('Changes saved successfully!', { autoClose: 500 });
            } else {
                const errorMessage = await response.text();
                console.error(`Error saving vehicle: ${response.status} - ${errorMessage}`);
                toast.error('Failed to save changes. Please try again.', { autoClose: 500 });
            }
        } catch (err) {
            console.error('Error saving vehicle:', err);
            toast.error('Failed to save vehicle data. Please try again.', { autoClose: 500 });
        }
    };

    const saveNewPerson = async () => {
        try {
            if (!newVehicle.officer_name || !newVehicle.assignment) {
                toast.error('Officer name and assignment are required.', { autoClose: 2000 });
                return;
            }

            const response = await fetch('/api/roster/incident-vehicles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...newVehicle,
                    incident_id: selectedIncident,
                    vehicle_id: newVehicle.vehicle_id || 'Unknown'
                }),
            });

            if (response.ok) {
                setAddingPerson(false);
                setNewVehicle({});
                fetchVehiclesForIncident(selectedIncident);
                toast.success('Person added successfully!', { autoClose: 500 });
            } else {
                const errorMessage = await response.text();
                console.error(`Error adding person: ${response.status} - ${errorMessage}`);
                toast.error('Failed to add person. Please try again.', { autoClose: 2000 });
            }
        } catch (err) {
            console.error('Error adding person:', err);
            toast.error('Failed to add person. Please try again.', { autoClose: 2000 });
        }
    };

    const handleViewChange = (e) => {
        const selectedView = e.target.value;
        setView(selectedView);
        setSortCriteria(selectedView);

        let sortedVehicles = [...vehicles];

        if (selectedView === 'Time') {
            sortedVehicles = sortByTime(sortedVehicles);
        } else if (selectedView === 'Assignment') {
            sortedVehicles = sortByAssignment(sortedVehicles);
        }

        setVehicles(sortedVehicles);
    };

    const sortByTime = (vehicles) => {
        return vehicles.sort((a, b) => {
            const timeA = new Date(a.timestamp);
            const timeB = new Date(b.timestamp);
            return sortAscending ? timeA - timeB : timeB - timeA;
        });
    };

    const sortByAssignment = (vehicles) => {
        const assignmentOrder = [
            "IC", "Deputy IC", "Command", "PIO", "Intel", 
            "Staging", "Team A", "Team B", "Team C", "Team D", "Team E", 
            "SOD", "K9", "SRT", "Aviation", "HDU"
        ];

        return vehicles.sort((a, b) => {
            const indexA = assignmentOrder.indexOf(a.assignment);
            const indexB = assignmentOrder.indexOf(b.assignment);

            const indexValueA = indexA === -1 ? assignmentOrder.length + 1 : indexA;
            const indexValueB = indexB === -1 ? assignmentOrder.length + 1 : indexB;

            return sortAscending ? indexValueA - indexValueB : indexValueB - indexValueA;
        });
    };

    return (
        <div style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'auto',
            color: '#ffffff'
        }}>
            <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                padding: '20px',
                borderRadius: '10px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
                maxWidth: '1800px',
                width: '95%',
                color: '#ffffff',
                maxHeight: '100vh',
                overflowY: 'auto'
            }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <img src="/images/logo.png" alt="Logo" style={{ width: '100px', height: '100px' }} />
                    <h1 style={{ fontSize: '32px', fontWeight: 'bold', textAlign: 'center' }}>INCIDENT ROSTER</h1>
                    <img src="/images/RTClogo.png" alt="RTC Logo" style={{ width: '100px', height: '100px' }} />
                </header>

                <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Incident Vehicle Roster</h2>
                {incidents.length > 0 ? (
                    <select value={selectedIncident || ''} onChange={handleIncidentSelect} style={{
                        width: '100%',
                        padding: '12px',
                        marginBottom: '20px',
                        borderRadius: '6px',
                        backgroundColor: '#333',
                        color: '#ffffff',
                        border: '1px solid #555555'
                    }}>
                        <option value="" disabled>Select an active incident</option>
                        {incidents.map((incident) => (
                            <option key={incident.incident_id} value={incident.incident_id}>
                                {incident.name}
                            </option>
                        ))}
                    </select>
                ) : (
                    <p>No active incidents found.</p>
                )}

                {error && vehicles.length === 0 && (
                    <div className="alert alert-danger">{error}</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <label htmlFor="view" style={{ marginRight: '10px' }}>View: </label>
                        <select id="view" value={view} onChange={handleViewChange} style={{
                            padding: '8px',
                            backgroundColor: '#333',
                            color: '#ffffff',
                            borderRadius: '6px'
                        }}>
                            <option value="All">All</option>
                            <option value="Assignment">Assignment</option>
                            <option value="Time">Time</option>
                        </select>
                    </div>
                    <button onClick={() => setSortAscending(!sortAscending)} style={{
                        padding: '10px 20px',
                        backgroundColor: '#007bff',
                        color: '#fff',
                        borderRadius: '5px',
                        border: 'none',
                        cursor: 'pointer'
                    }}>
                        {sortAscending ? "Sort Descending" : "Sort Ascending"}
                    </button>
                </div>

                {vehicles.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#222' }}>
                        <thead>
                            <tr>
                                <th style={{ borderBottom: '2px solid #444', padding: '12px', color: '#ffffff' }}>Vehicle ID</th>
                                <th style={{ borderBottom: '2px solid #444', padding: '12px', color: '#ffffff' }}>Officer Name</th>
                                <th style={{ borderBottom: '2px solid #444', padding: '12px', color: '#ffffff' }}>Assignment</th>
                                <th style={{ borderBottom: '2px solid #444', padding: '12px', color: '#ffffff' }}>Date/Time Arrived</th>
                                <th style={{ borderBottom: '2px solid #444', padding: '12px', color: '#ffffff' }}>Notes</th>
                                <th style={{ borderBottom: '2px solid #444', padding: '12px', color: '#ffffff' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vehicles.map((vehicle, index) => (
                                <tr key={vehicle.vehicle_id}>
                                    <td style={{ padding: '12px', borderBottom: '1px solid #666666', color: '#ffffff' }}>
                                        {vehicle.vehicle_id}
                                    </td>
                                    <td style={{ padding: '12px', borderBottom: '1px solid #666666', color: '#ffffff' }}>
                                        {editIndex === index ? (
                                            <input
                                                type="text"
                                                name="officer_name"
                                                value={editedVehicle.officer_name || ''}
                                                onChange={handleEditChange}
                                                style={{
                                                    padding: '8px',
                                                    backgroundColor: '#333',
                                                    color: '#ffffff',
                                                    borderRadius: '6px'
                                                }}
                                            />
                                        ) : (
                                            vehicle.officer_name === 'Unknown' ? '' : vehicle.officer_name
                                        )}
                                    </td>
                                    <td style={{ padding: '12px', borderBottom: '1px solid #666666', color: '#ffffff' }}>
                                        {editIndex === index ? (
                                            <select
                                                name="assignment"
                                                value={editedVehicle.assignment || ''}
                                                onChange={handleEditChange}
                                                style={{
                                                    padding: '8px',
                                                    backgroundColor: '#333',
                                                    color: '#ffffff',
                                                    borderRadius: '6px'
                                                }}
                                            >
                                                <option value="">Select assignment</option>
                                                {assignments.map((assignment) => (
                                                    <option key={assignment.id} value={assignment.name}>
                                                        {assignment.name}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            vehicle.assignment === 'Unknown' ? '' : vehicle.assignment
                                        )}
                                    </td>
                                    <td style={{ padding: '12px', borderBottom: '1px solid #666666', color: '#ffffff' }}>{new Date(vehicle.timestamp).toLocaleString()}</td>
                                    <td style={{ padding: '12px', borderBottom: '1px solid #666666', color: '#ffffff' }}>
                                        {editIndex === index ? (
                                            <input
                                                type="text"
                                                name="notes"
                                                value={editedVehicle.notes || ''}
                                                onChange={handleEditChange}
                                                style={{
                                                    padding: '8px',
                                                    backgroundColor: '#333',
                                                    color: '#ffffff',
                                                    borderRadius: '6px'
                                                }}
                                            />
                                        ) : (
                                            vehicle.notes || ''
                                        )}
                                    </td>
                                    <td style={{ padding: '12px', borderBottom: '1px solid #666666', color: '#ffffff' }}>
                                        {editIndex === index ? (
                                            <>
                                                <button onClick={() => saveEdit(index)} style={{
                                                    padding: '8px 12px',
                                                    backgroundColor: '#007bff',
                                                    color: '#ffffff',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    marginRight: '5px'
                                                }}>Save</button>
                                                <button onClick={() => setEditIndex(-1)} style={{
                                                    padding: '8px 12px',
                                                    backgroundColor: '#dc3545',
                                                    color: '#ffffff',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer'
                                                }}>Cancel</button>
                                            </>
                                        ) : (
                                            <button onClick={() => startEditing(index)} style={{
                                                padding: '8px 12px',
                                                backgroundColor: '#007bff',
                                                color: '#ffffff',
                                                borderRadius: '6px',
                                                cursor: 'pointer'
                                            }}>Edit</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {/* Add Person Button and Form (moved to bottom) */}
                <div style={{ 
                    marginTop: '20px',
                    marginBottom: '20px'
                }}>
                    {!addingPerson ? (
                        <button onClick={() => setAddingPerson(true)} style={{
                            padding: '10px 20px',
                            backgroundColor: '#007bff',
                            color: '#fff',
                            borderRadius: '5px',
                            border: 'none',
                            cursor: 'pointer'
                        }}>Add Person</button>
                    ) : (
                        <div style={{ backgroundColor: '#333', padding: '20px', borderRadius: '10px' }}>
                            <h3>Add New Person</h3>
                            <input
                                type="text"
                                placeholder="Vehicle ID"
                                name="vehicle_id"
                                value={newVehicle.vehicle_id || ''}
                                onChange={handleNewVehicleChange}
                                style={{ margin: '10px 0', padding: '8px', width: '100%' }}
                            />
                            <input
                                type="text"
                                placeholder="Officer Name"
                                name="officer_name"
                                value={newVehicle.officer_name || ''}
                                onChange={handleNewVehicleChange}
                                style={{ margin: '10px 0', padding: '8px', width: '100%' }}
                            />
                            <select
                                name="assignment"
                                value={newVehicle.assignment || ''}
                                onChange={handleNewVehicleChange}
                                style={{ margin: '10px 0', padding: '8px', width: '100%' }}
                            >
                                <option value="">Select assignment</option>
                                {assignments.map((assignment) => (
                                    <option key={assignment.id} value={assignment.name}>
                                        {assignment.name}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                placeholder="Notes"
                                name="notes"
                                value={newVehicle.notes || ''}
                                onChange={handleNewVehicleChange}
                                style={{ margin: '10px 0', padding: '8px', width: '100%' }}
                            />
                            <div>
                                <button onClick={saveNewPerson} style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#28a745',
                                    color: '#fff',
                                    borderRadius: '5px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    marginRight: '10px'
                                }}>Save</button>
                                <button onClick={() => setAddingPerson(false)} style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#dc3545',
                                    color: '#fff',
                                    borderRadius: '5px',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}>Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VehicleRoster;
