import React, { useState, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';

// MarkerNameModal component
const MarkerNameModal = ({ show, onClose, onSave }) => {
    const [name, setName] = useState('');
    
    // Reset the name field when modal opens
    useEffect(() => {
        if (show) {
            setName('');
        }
    }, [show]);
    
    const handleSave = () => {
        if (name.trim()) {
            onSave(name);
            setName('');
        }
    };
    
    return (
        <Modal 
            show={show} 
            onHide={onClose}
            centered
            backdrop="static"
            style={{
                zIndex: 2000 // Ensure it's above other map elements
            }}
            size="sm" // Make the modal smaller
        >
            <Modal.Header closeButton>
                <Modal.Title>Name Your Marker</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Form.Group>
                        <Form.Label>Marker Name</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="Enter a name for this marker"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '10px 15px',
                borderTop: '1px solid #dee2e6'
            }}>
                <Button 
                    variant="secondary" 
                    onClick={onClose}
                    size="sm"
                >
                    Cancel
                </Button>
                <Button 
                    variant="primary" 
                    onClick={handleSave}
                    disabled={!name.trim()}
                    size="sm"
                >
                    Save Marker
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default MarkerNameModal; 