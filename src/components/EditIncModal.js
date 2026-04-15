import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Modal, Button, Form } from 'react-bootstrap';

const EditIncModal = ({ incidentId, onClose }) => {
    const API_URL = process.env.REACT_APP_API_URL || 'https://merlin.westchesterrtc.com';
    const [formData, setFormData] = useState({
        name: '',
        type_incident: '',
        incident_commander: '',
        staging_manager: '',
        communications: '',
        location_address: '',
    });

    useEffect(() => {
        const source = axios.CancelToken.source();

        const fetchIncidentData = async () => {
            try {
                const response = await axios.get(`${API_URL}/api/incidents/${incidentId}`, {
                    cancelToken: source.token
                });
                setFormData(response.data);
                console.log('Fetched incident data:', response.data);
            } catch (error) {
                if (!axios.isCancel(error)) {
                    console.error('Error fetching incident data:', error);
                }
            }
        };

        fetchIncidentData();

        return () => {
            source.cancel("Component unmounted and request cancelled");
        };
    }, [incidentId]);

    const handleChange = (e) => {
        setFormData(prevData => ({
            ...prevData,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.put(`${API_URL}/api/incidents/${incidentId}`, formData);
            console.log('Incident updated successfully:', response.data);
            onClose();
        } catch (error) {
            console.error('Error updating incident:', error);
        }
    };

    return (
        <Modal show={true} onHide={onClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>Edit Incident</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleSubmit}>
                    <Form.Group controlId="formName">
                        <Form.Label>Name</Form.Label>
                        <Form.Control
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </Form.Group>
                    <Form.Group controlId="formTypeIncident" className="mt-3">
                        <Form.Label>Incident Type</Form.Label>
                        <Form.Control
                            type="text"
                            name="type_incident"
                            value={formData.type_incident}
                            onChange={handleChange}
                        />
                    </Form.Group>
                    <Form.Group controlId="formLocationAddress" className="mt-3">
                        <Form.Label>Location Address</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            name="location_address"
                            value={formData.location_address || ''}
                            onChange={handleChange}
                        />
                    </Form.Group>
                    <Form.Group controlId="formIncidentCommander" className="mt-3">
                        <Form.Label>Incident Commander</Form.Label>
                        <Form.Control
                            type="text"
                            name="incident_commander"
                            value={formData.incident_commander}
                            onChange={handleChange}
                        />
                    </Form.Group>
                    <Form.Group controlId="formStagingManager" className="mt-3">
                        <Form.Label>Staging Manager</Form.Label>
                        <Form.Control
                            type="text"
                            name="staging_manager"
                            value={formData.staging_manager}
                            onChange={handleChange}
                        />
                    </Form.Group>
                    <Form.Group controlId="formCommunications" className="mt-3">
                        <Form.Label>Communications</Form.Label>
                        <Form.Control
                            type="text"
                            name="communications"
                            value={formData.communications}
                            onChange={handleChange}
                        />
                    </Form.Group>
                    <Button variant="primary" type="submit" className="mt-3">
                        Update
                    </Button>
                    <Button variant="secondary" onClick={onClose} className="mt-3 ms-2">
                        Cancel
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

export default EditIncModal;
