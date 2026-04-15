import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '';

export const drawnItemService = {
    // Get all drawn items
    getDrawnItems: async () => {
        try {
            const response = await axios.get(`${API_URL}/api/drawn-items`);
            return response.data;
        } catch (error) {
            console.error('Error fetching drawn items:', error);
            throw error;
        }
    },

    // Create new drawn item
    createDrawnItem: async (itemData) => {
        try {
            const response = await axios.post(`${API_URL}/api/drawn-items`, itemData);
            return response.data;
        } catch (error) {
            console.error('Error creating drawn item:', error);
            throw error;
        }
    },

    // Update drawn item
    updateDrawnItem: async (id, itemData) => {
        try {
            const response = await axios.put(`${API_URL}/api/drawn-items/${id}`, itemData);
            return response.data;
        } catch (error) {
            console.error('Error updating drawn item:', error);
            throw error;
        }
    },

    // Soft delete/restore drawn item
    toggleDrawnItemActive: async (id, active, updatedBy) => {
        try {
            const response = await axios.patch(`${API_URL}/api/drawn-items/${id}`, {
                active,
                updated_by: updatedBy
            });
            return response.data;
        } catch (error) {
            console.error('Error toggling drawn item active state:', error);
            throw error;
        }
    }
};

export default drawnItemService; 