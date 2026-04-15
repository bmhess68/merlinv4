import { useEffect } from 'react';

const VehicleTracker = ({ vehicles, vehicleType }) => {
  useEffect(() => {
    const sendVehicleData = async () => {
      try {
        const endpoint = vehicleType === 'fd' 
          ? 'https://merlin.westchesterrtc.com/fdvehicle'
          : 'https://merlin.westchesterrtc.com/vehicle';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            vehicles,
            vehicleType // Include vehicle type in payload
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to send ${vehicleType} vehicle data to server: ${errorText}`);
        }
      } catch (error) {
        console.error(`Error sending ${vehicleType} vehicle data to server:`, error.message);
      }
    };

    const intervalId = setInterval(sendVehicleData, 30000);
    return () => clearInterval(intervalId);
  }, [vehicles, vehicleType]);

  return null;
};

export default VehicleTracker;
