import React, { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

const WeatherOverlay = ({ enabled, onToggle }) => {
    const map = useMap();
    const [weatherLayer, setWeatherLayer] = useState(null);

    useEffect(() => {
        if (enabled && !weatherLayer) {
            fetch('/api/weather/apikey', {
                credentials: 'include'
            })
            .then(response => response.json())
            .then(data => {
                const layer = L.tileLayer(
                    `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${data.apiKey}`,
                    {
                        maxZoom: 19,
                        opacity: 0.5
                    }
                );
                setWeatherLayer(layer);
                layer.addTo(map);
            })
            .catch(error => {
                console.error('Error loading weather API key:', error);
            });
        } else if (!enabled && weatherLayer) {
            weatherLayer.remove();
            setWeatherLayer(null);
        }
    }, [enabled, map, weatherLayer]);

    return enabled ? (
        <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '100px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '3px',
            zIndex: 1000,
            fontFamily: 'Arial, sans-serif',
            fontSize: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
        }}>
            <span>Precipitation:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ 
                    width: '15px', 
                    height: '8px', 
                    backgroundColor: '#87CEEB',
                    border: '1px solid white' 
                }}></div>
                <span>Light</span>
                
                <div style={{ 
                    width: '15px', 
                    height: '8px', 
                    backgroundColor: '#4682B4',
                    border: '1px solid white'  
                }}></div>
                <span>Moderate</span>
                
                <div style={{ 
                    width: '15px', 
                    height: '8px', 
                    backgroundColor: '#000080',
                    border: '1px solid white'  
                }}></div>
                <span>Heavy</span>
            </div>
        </div>
    ) : null;
};

export default WeatherOverlay;