import React from 'react';
import { Modal } from 'react-bootstrap';
import './LayerControlModal.css';

const LayerControlModal = ({ 
    isOpen, 
    onClose,
    selectedMapType,
    onMapTypeChange,
    user,
    showPoliceGPS,
    setShowPoliceGPS,
    showFireGPS,
    setShowFireGPS,
    showStarChase,
    setShowStarChase,
    csvFiles,
    selectedLayers,
    handleLayerToggle,
    showTooltips,
    setShowTooltips,
    tooltipFontSize,
    setTooltipFontSize,
    weatherEnabled,
    onWeatherToggle,
    slackNotificationsEnabled,
    onSlackNotificationsToggle
}) => {
    const mapTypes = [
        { id: 'openStreetMap', label: 'Street' },
        { id: 'googleMaps', label: 'Google Road' },
        { id: 'googleSatellite', label: 'Satellite' },
        { id: 'googleHybrid', label: 'Hybrid' }
    ];

    const fontSizes = [
        { id: '8', label: 'Sm' },
        { id: '10', label: 'Med' },
        { id: '12', label: 'Lg' }
    ];

    return (
        <Modal 
            show={isOpen} 
            onHide={onClose} 
            centered
            className="dark-theme-modal"
        >
            <div className="modal-header">
                <h2>Layer Control</h2>
                <button onClick={onClose} className="close-button">×</button>
            </div>
            <div className="modal-body">
                {/* Map Type Selection */}
                <div className="control-section">
                    <h3>Map Type</h3>
                    <div className="map-type-options">
                        {mapTypes.map(type => (
                            <div
                                key={type.id}
                                className={`map-type-option ${selectedMapType === type.id ? 'active' : ''}`}
                                onClick={() => onMapTypeChange(type.id)}
                            >
                                {type.label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Weather Toggle */}
                <div className="control-section">
                    <div className="switch-container">
                        <span className="switch-label">Weather</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={weatherEnabled}
                                onChange={(e) => onWeatherToggle(e.target.checked)}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                </div>

                {/* Slack Notifications Toggle */}
                <div className="control-section">
                    <div className="switch-container">
                        <span className="switch-label">Slack Notifications</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={slackNotificationsEnabled}
                                onChange={(e) => onSlackNotificationsToggle(e.target.checked)}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                </div>

                {/* GPS Options */}
                <div className="control-section">
                    <h3>GPS Tracking</h3>
                    {user?.permissions?.policeGPS && (
                        <div className="switch-container">
                            <span className="switch-label">Police GPS</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={showPoliceGPS}
                                    onChange={(e) => setShowPoliceGPS(e.target.checked)}
                                />
                                <span className="slider"></span>
                            </label>
                        </div>
                    )}
                    {user?.permissions?.fireGPS && (
                        <div className="switch-container">
                            <span className="switch-label">Fire/EMS GPS</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={showFireGPS}
                                    onChange={(e) => setShowFireGPS(e.target.checked)}
                                />
                                <span className="slider"></span>
                            </label>
                        </div>
                    )}
                    {user?.permissions?.starchase && (
                        <div className="switch-container">
                            <span className="switch-label">StarChase</span>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    checked={showStarChase}
                                    onChange={(e) => setShowStarChase(e.target.checked)}
                                />
                                <span className="slider"></span>
                            </label>
                        </div>
                    )}
                </div>

                {/* User Layers */}
                {csvFiles && csvFiles.length > 0 && (
                    <div className="control-section">
                        <h3>User Layers</h3>
                        {csvFiles.map((file, index) => (
                            <div key={index} className="switch-container">
                                <span className="switch-label">{file}</span>
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={selectedLayers.includes(file)}
                                        onChange={() => handleLayerToggle(file)}
                                    />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        ))}
                    </div>
                )}

                {/* Display Options */}
                <div className="control-section">
                    <h3>Display Options</h3>
                    <div className="switch-container">
                        <span className="switch-label">Show Tooltips</span>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={showTooltips}
                                onChange={(e) => setShowTooltips(e.target.checked)}
                            />
                            <span className="slider"></span>
                        </label>
                    </div>
                    
                    {showTooltips && (
                        <div className="font-size-selector">
                            {fontSizes.map(size => (
                                <div
                                    key={size.id}
                                    className={`font-size-option ${tooltipFontSize === size.id ? 'active' : ''}`}
                                    onClick={() => setTooltipFontSize(size.id)}
                                >
                                    {size.label}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default LayerControlModal;
