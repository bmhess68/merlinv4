import React, { useState, useCallback, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { toast } from 'react-hot-toast';

const EditMarkersModal = ({ show, onClose, markers, setLayerEditing }) => {
    const [selectedMarkers, setSelectedMarkers] = useState([]);

    // Set editing state when modal opens/closes
    useEffect(() => {
        if (show) {
            setLayerEditing(true);
        } else {
            setLayerEditing(false);
        }
    }, [show, setLayerEditing]);

    // Reset selected markers when modal opens/closes or markers change
    useEffect(() => {
        setSelectedMarkers([]);
    }, [show, markers]);

    const handleMarkerChange = useCallback((event) => {
        const markerId = parseInt(event.target.value, 10);
        setSelectedMarkers(prevState =>
            prevState.includes(markerId)
                ? prevState.filter(id => id !== markerId)
                : [...prevState, markerId]
        );
    }, []);

    const handleDelete = useCallback(async () => {
        try {
            if (selectedMarkers.length === 0) {
                return;
            }

            // Make DELETE request for each selected marker
            const deletePromises = selectedMarkers.map(markerId =>
                fetch(`${process.env.REACT_APP_API_URL}/api/drawn-items/${markerId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
            );

            await Promise.all(deletePromises);
            
            toast.success('Items deleted successfully');
            setSelectedMarkers([]);
            onClose();
            
            // Force a refresh of the parent component
            window.dispatchEvent(new CustomEvent('refreshMarkers'));
            
        } catch (error) {
            console.error('Error deleting markers:', error);
            toast.error('Failed to delete markers');
        }
    }, [selectedMarkers, onClose]);

    return (
        <Modal show={show} onHide={onClose}>
            <Modal.Header closeButton>
                <Modal.Title>Edit Markers</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {markers && markers.length > 0 ? (
                    <Form>
                        {markers.map((marker) => (
                            <Form.Check
                                key={marker.id}
                                type="checkbox"
                                id={`marker-${marker.id}`}
                                label={marker.geojson?.properties?.name || `Marker ${marker.id}`}
                                value={marker.id}
                                onChange={handleMarkerChange}
                                checked={selectedMarkers.includes(marker.id)}
                            />
                        ))}
                    </Form>
                ) : (
                    <p>No markers available</p>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
                <Button
                    variant="danger"
                    onClick={handleDelete}
                    disabled={selectedMarkers.length === 0}
                >
                    Delete Selected
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default EditMarkersModal;
