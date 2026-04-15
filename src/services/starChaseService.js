import axios from 'axios';
import { toast } from 'react-toastify'; // Assuming you're using react-toastify for notifications

const API_KEY = process.env.REACT_APP_STARCHASE_API_KEY;
const BASE_URL = 'https://dev-signalapi.starchase.com/v1';

class StarChaseService {
    constructor() {
        this.failedAttempts = 0;
        this.maxFailedAttempts = 12;
        this.pollingInterval = 10000; // 10 seconds
    }

    async getDeviceData() {
        try {
            const response = await axios.get(`${BASE_URL}/devices`, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            this.failedAttempts = 0;
            return this.formatDeviceData(response.data);
        } catch (error) {
            this.handleError(error);
            return null;
        }
    }

    formatDeviceData(data) {
        // Ensure data is in the expected format
        return data.map(device => ({
            entityId: device.imei || device.entityId,
            name: device.name || `Device ${device.imei}`,
            location: {
                latitude: device.location?.latitude || 0,
                longitude: device.location?.longitude || 0
            },
            deployment: device.deployment || 'unconfirmed',
            timestamp: device.timestamp || new Date().toISOString(),
            customAttributes: [
                {
                    name: 'Speed',
                    val: `${device.speed || 0} k/h`,
                    value: device.speed?.toString() || '0',
                    type: 'string'
                },
                {
                    name: 'Battery',
                    val: device.battery?.toString() || '0',
                    value: device.battery?.toString() || '0',
                    type: 'string'
                },
                {
                    name: 'Bearing',
                    val: `${device.bearing || 0}°`,
                    value: device.bearing?.toString() || '0',
                    type: 'string'
                }
            ]
        }));
    }

    async stopDeployment(imei) {
        try {
            const response = await axios.post(`${BASE_URL}/devices/${imei}/deployment-stop`, {}, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            toast.success('Deployment stopped successfully');
            return response.data;
        } catch (error) {
            toast.error('Failed to stop deployment');
            console.error('Error stopping deployment:', error);
            throw error;
        }
    }

    handleError(error) {
        this.failedAttempts++;
        console.error('StarChase API Error:', error);
        
        if (this.failedAttempts >= this.maxFailedAttempts) {
            // Send email notification to admin
            this.notifyAdmin();
            toast.error('StarChase service is currently unavailable');
        }
    }

    async notifyAdmin() {
        try {
            await axios.post('/api/notifications/email', {
                subject: 'StarChase API Error',
                message: '12 consecutive StarChase API failures detected',
                type: 'STARCHASE_ERROR'
            });
        } catch (error) {
            console.error('Failed to send admin notification:', error);
        }
    }
}

export default new StarChaseService();