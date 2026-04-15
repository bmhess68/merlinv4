import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

const incidentService = {
    // Get all incidents
    getIncidents: async () => {
        try {
            const response = await axios.get(`${API_URL}/api/incidents`, {
                withCredentials: true
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching incidents:', error);
            throw error;
        }
    },

    // Get single incident
    getIncident: async (id) => {
        try {
            const response = await axios.get(`${API_URL}/api/incidents/${id}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching incident:', error);
            throw error;
        }
    },

    // Create new incident
    createIncident: async (incidentData) => {
        try {
            const response = await axios.post(`${API_URL}/api/incidents`, incidentData);
            return response.data;
        } catch (error) {
            console.error('Error creating incident:', error);
            throw error;
        }
    },

    // Update incident
    updateIncident: async (id, incidentData) => {
        try {
            const response = await axios.put(`${API_URL}/api/incidents/${id}`, incidentData);
            return response.data;
        } catch (error) {
            console.error('Error updating incident:', error);
            throw error;
        }
    },

    // Close incident
    closeIncident: async (id, closeData) => {
        try {
            const response = await axios.post(`${API_URL}/api/incidents/${id}/close`, closeData);
            return response.data;
        } catch (error) {
            console.error('Error closing incident:', error);
            throw error;
        }
    },

    // Get incident types
    getIncidentTypes: async () => {
        try {
            const response = await axios.get(`${API_URL}/api/incidents/types`, {
                withCredentials: true
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching incident types:', error);
            throw error;
        }
    },

    // Get dispositions
    getDispositions: async () => {
        try {
            const response = await axios.get(`${API_URL}/api/incidents/dispositions`, {
                withCredentials: true
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching dispositions:', error);
            throw error;
        }
    }
};

export default incidentService; 