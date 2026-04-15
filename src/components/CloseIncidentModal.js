import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import './NameColorForm.css';
import incidentService from '../services/incidentService';

const CloseIncidentModal = ({ show, onClose, onSubmit, incidentId }) => {
    const [dispositions, setDispositions] = useState([]);
    const [selectedDisposition, setSelectedDisposition] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const fetchDispositions = async () => {
            try {
                const data = await incidentService.getDispositions();
                setDispositions(data);
            } catch (error) {
                console.error('Error fetching dispositions:', error);
                setDispositions([]);
            }
        };
        
        fetchDispositions();
    }, []);

    const handleSubmit = (event) => {
        event.preventDefault();
        const urlParams = new URLSearchParams(window.location.search);
        const user = JSON.parse(urlParams.get('user'));

        const closeData = {
            incident_id: incidentId,
            disposition: selectedDisposition,
            notes: notes,
            closed_by_name: user.userName || 'Unknown',
            closed_by_userid: user.userId || 'Unknown'
        };
        onSubmit(closeData);
        onClose();
    };

    return (
        <Modal 
            show={show} 
            onHide={onClose} 
            centered
            className="name-color-modal"
        >
            <Modal.Header closeButton>
                <Modal.Title>Close Incident</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleSubmit}>
                    <Form.Group controlId="formDisposition">
                        <Form.Label>Disposition</Form.Label>
                        <Form.Control
                            as="select"
                            value={selectedDisposition}
                            onChange={(e) => setSelectedDisposition(e.target.value)}
                            required
                        >
                            <option value="">Select Disposition</option>
                            {dispositions.map((disposition) => (
                                <option key={disposition.id} value={disposition.name}>
                                    {disposition.name}
                                </option>
                            ))}
                        </Form.Control>
                    </Form.Group>
                    <Form.Group controlId="formNotes" className="mt-3">
                        <Form.Label>Notes</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </Form.Group>
                    <Form.Group controlId="formNotification" className="mt-3">
                        <Form.Text className="text-muted">
                            Report will be sent to you on SLACK direct message. If you do not have access, please contact the Ops desk and they will email it to you.
                        </Form.Text>
                    </Form.Group>
                    <div className="mt-3">
                        <Button variant="primary" type="submit">
                            Submit
                        </Button>
                        <Button variant="secondary" onClick={onClose} className="ms-2">
                            Close
                        </Button>
                    </div>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

export default CloseIncidentModal;
