import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import socket from '../services/socket';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import './CADAlerts.css';

const CADAlerts = () => {
    // Temporarily disable CAD alerts
    return null;  // Component will not render anything

    /* Original code commented out
    const [alerts, setAlerts] = useState([]);
    const processedAlertsRef = useRef(new Set());
    const map = useMap();
    ...
    */
};

export default CADAlerts;