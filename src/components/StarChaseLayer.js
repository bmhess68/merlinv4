import React, { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import starChaseService from '../services/starChaseService';

const StarChaseLayer = () => {
    const map = useMap();
    const markersRef = useRef({});
    const [devices, setDevices] = useState([]);
    const intervalRef = useRef(null);

    // Icon definitions based on status
    const icons = {
        green: L.icon({
            iconUrl: '/images/icons/starchase/green.png',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        blue: L.icon({
            iconUrl: '/images/icons/starchase/blue.png',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        yellow: L.icon({
            iconUrl: '/images/icons/starchase/yellow.png',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        red: L.icon({
            iconUrl: '/images/icons/starchase/red.png',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        }),
        gray: L.icon({
            iconUrl: '/images/icons/starchase/gray.png',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        })
    };

    const getIconForDevice = (device) => {
        if (!device.deployment || device.deployment === 'unconfirmed') {
            return icons.red;
        }

        const speed = parseFloat(device.customAttributes.find(attr => attr.name === 'Speed')?.value || '0');
        const idleTime = calculateIdleTime(device.timestamp);

        if (speed > 5) return icons.green;
        if (speed <= 5 && speed > 0) return icons.blue;
        if (idleTime > 180 && idleTime < 3600) return icons.yellow;
        if (idleTime >= 3600 && idleTime < 2592000) return icons.red;
        return icons.gray;
    };

    const calculateIdleTime = (timestamp) => {
        const deviceTime = new Date(timestamp).getTime();
        const currentTime = new Date().getTime();
        return Math.floor((currentTime - deviceTime) / 1000);
    };

    useEffect(() => {
        const fetchData = async () => {
            const data = await starChaseService.getDeviceData();
            if (data && Array.isArray(data)) {
                setDevices(data);
            }
        };

        // Initial fetch
        fetchData();

        // Set up polling interval
        intervalRef.current = setInterval(fetchData, starChaseService.pollingInterval);

        // Cleanup function
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            // Remove all markers when component unmounts
            Object.values(markersRef.current).forEach(marker => {
                if (marker && map) {
                    map.removeLayer(marker);
                }
            });
            markersRef.current = {};
        };
    }, [map]);

    useEffect(() => {
        if (!map) return;

        // Update markers
        devices.forEach(device => {
            const { entityId, location, name, customAttributes, deployment } = device;
            
            if (!location?.latitude || !location?.longitude) return;

            const popupContent = `
                <div class="starchase-popup">
                    <h3>${name}</h3>
                    <p>Status: ${deployment}</p>
                    <p>Speed: ${customAttributes.find(attr => attr.name === 'Speed')?.val || '0 k/h'}</p>
                    <p>Battery: ${customAttributes.find(attr => attr.name === 'Battery')?.val || '0%'}</p>
                    <p>Bearing: ${customAttributes.find(attr => attr.name === 'Bearing')?.val || '0°'}</p>
                    ${deployment === 'confirmed' ? 
                        `<button class="starchase-stop-btn" onclick="window.stopDeployment('${entityId}')">Stop Deployment</button>` 
                        : ''}
                </div>
            `;

            try {
                if (markersRef.current[entityId]) {
                    markersRef.current[entityId]
                        .setLatLng([location.latitude, location.longitude])
                        .setIcon(getIconForDevice(device))
                        .getPopup().setContent(popupContent);
                } else {
                    markersRef.current[entityId] = L.marker([location.latitude, location.longitude], {
                        icon: getIconForDevice(device)
                    })
                        .bindPopup(popupContent)
                        .addTo(map);
                }
            } catch (error) {
                console.error(`Error updating marker for device ${entityId}:`, error);
            }
        });

        // Clean up removed devices
        Object.keys(markersRef.current).forEach(id => {
            if (!devices.some(device => device.entityId === id)) {
                map.removeLayer(markersRef.current[id]);
                delete markersRef.current[id];
            }
        });
    }, [devices, map]);

    // Add global function for the popup button
    useEffect(() => {
        window.stopDeployment = async (imei) => {
            try {
                await starChaseService.stopDeployment(imei);
                // Refresh data after stopping deployment
                const data = await starChaseService.getDeviceData();
                if (data) {
                    setDevices(data);
                }
            } catch (error) {
                console.error('Error stopping deployment:', error);
            }
        };

        return () => {
            delete window.stopDeployment;
        };
    }, []);

    return null;
};

export default StarChaseLayer;