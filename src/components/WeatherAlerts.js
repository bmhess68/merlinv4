// src/components/WeatherAlerts.js
import React, { useEffect } from 'react';
import { toast } from 'react-toastify';
import io from 'socket.io-client';

const WeatherAlerts = () => {
    useEffect(() => {
        const socket = io(process.env.REACT_APP_SERVER_URL);

        socket.on('weatherAlerts', (alerts) => {
            alerts.forEach(alert => {
                toast.warning(
                    <div>
                        <h4>{alert.event}</h4>
                        <p>{alert.description}</p>
                        <small>Until: {new Date(alert.end * 1000).toLocaleString()}</small>
                    </div>,
                    {
                        position: "top-center",
                        autoClose: 10000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                    }
                );
            });
        });

        // Initial fetch of alerts
        fetch('/api/weather/alerts')
            .then(res => res.json())
            .then(alerts => {
                alerts.forEach(alert => {
                    toast.info(
                        <div>
                            <h4>{alert.event}</h4>
                            <p>{alert.description}</p>
                            <small>Until: {new Date(alert.end * 1000).toLocaleString()}</small>
                        </div>
                    );
                });
            });

        return () => socket.disconnect();
    }, []);

    return null; // This component doesn't render anything visible
};

export default WeatherAlerts;