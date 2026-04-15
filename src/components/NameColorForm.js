import React, { useState, useEffect } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import './NameColorForm.css';

const NameColorForm = ({ show, onClose, onSubmit, user }) => {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#3388ff');

    const colors = [
        { name: 'Blue', value: '#0000FF' },
        { name: 'Red', value: '#FF0000' },
        { name: 'Yellow', value: '#FFFF00' },
        { name: 'Orange', value: '#FFA500' },
        { name: 'Green', value: '#008000' },
        { name: 'Violet', value: '#EE82EE' },
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        const user = JSON.parse(decodeURIComponent(new URLSearchParams(window.location.search).get('user')));
        onSubmit({ 
            name, 
            color,
            created_by_name: user.userName,
            created_by_userid: user.userId
        });
        setName('');
        setColor('#3388ff');
    };

    return (
        <Modal 
            show={show} 
            onHide={onClose} 
            centered
            className="name-color-modal"
        >
            <Modal.Header closeButton>
                <Modal.Title>Enter Name and Select Color</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleSubmit}>
                    <Form.Group controlId="formName">
                        <Form.Label>Name</Form.Label>
                        <Form.Control
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </Form.Group>
                    <Form.Group controlId="formColor" className="mt-3">
                        <Form.Label>Color</Form.Label>
                        <div className="color-options">
                            {colors.map((colorOption) => (
                                <div
                                    key={colorOption.value}
                                    onClick={() => setColor(colorOption.value)}
                                    style={{
                                        backgroundColor: colorOption.value,
                                        width: '30px',
                                        height: '30px',
                                        display: 'inline-block',
                                        margin: '5px',
                                        cursor: 'pointer',
                                        border: color === colorOption.value ? '2px solid black' : 'none',
                                    }}
                                ></div>
                            ))}
                        </div>
                    </Form.Group>
                    <Button variant="primary" type="submit" className="mt-3">
                        Submit
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

export default NameColorForm;
