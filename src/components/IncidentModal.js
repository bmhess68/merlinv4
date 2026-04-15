import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { formatDate } from './utils';
import EditIncModal from './EditIncModal';

function IncidentModal({ incident, isActive, onClick }) {
    const [isEditModalOpen, setEditModalOpen] = useState(false);

    const handleDoubleClick = useCallback(() => {
        console.log('Opening Edit Modal for Incident ID:', incident.incident_id);
        setEditModalOpen(true);
    }, [incident.incident_id]);

    const handleClick = useCallback(() => {
        onClick(incident);
    }, [incident, onClick]);

    return (
        <div 
            className={`incident-modal ${isActive ? 'active' : ''}`} 
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            style={{ 
                backgroundColor: isActive ? '#0567f7' : '#333',
                cursor: 'pointer',
                padding: '10px',
                borderRadius: '5px',
                marginBottom: '5px'
            }}
        >
            <div className="incident-modal-header">
                <strong>{incident.name}</strong>
            </div>
            {isActive && (
                <div className="incident-modal-body">
                    {incident.type_incident && <p>Type: {incident.type_incident}</p>}
                    
                    {/* Show address if available, otherwise show coordinates */}
                    {incident.location_address ? (
                        <p>Location: {incident.location_address}</p>
                    ) : (
                        incident.location_lat && incident.location_long && (
                            <p>Location: {incident.location_lat.toFixed(3)}, {incident.location_long.toFixed(3)}</p>
                        )
                    )}
                    
                    {incident.date && <p>Date: {formatDate(incident.date)}</p>}
                    {incident.time && <p>Time: {incident.time}</p>}
                    {incident.incident_commander && <p>Incident Commander: {incident.incident_commander}</p>}
                    {incident.staging_manager && <p>Staging Manager: {incident.staging_manager}</p>}
                    {incident.communications && <p>Communications: {incident.communications}</p>}
                </div>
            )}
            {isEditModalOpen && (
                <EditIncModal
                    incidentId={incident.incident_id}
                    onClose={() => setEditModalOpen(false)}
                />
            )}
        </div>
    );
}

IncidentModal.propTypes = {
    incident: PropTypes.shape({
        incident_id: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
        type_incident: PropTypes.string,
        location_lat: PropTypes.number,
        location_long: PropTypes.number,
        location_address: PropTypes.string,
        date: PropTypes.string,
        time: PropTypes.string,
        incident_commander: PropTypes.string,
        staging_manager: PropTypes.string,
        communications: PropTypes.string,
    }).isRequired,
    isActive: PropTypes.bool.isRequired,
    onClick: PropTypes.func.isRequired,
};

export default IncidentModal;
