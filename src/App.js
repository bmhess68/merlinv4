import React, { useEffect, useState, useMemo } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation, Navigate } from 'react-router-dom';
import MapPage from './components/MapPage';
import LoginPage from './components/Login';
import AdminPage from './components/AdminPage';
import VehicleRoster from './components/VehicleRoster';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MobileMap from './components/MapboxMobileMap';
import axios from 'axios';
import notificationService from './services/notificationService';
import 'bootstrap/dist/css/bootstrap.min.css';

function useQuery() {
    const location = useLocation();
    return useMemo(() => new URLSearchParams(location.search), [location]);
}

function ProtectedRoute({ isAuthenticated, children }) {
    const navigate = useNavigate();

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    return isAuthenticated ? children : null;
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [userData, setUserData] = useState(null);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const navigate = useNavigate();
    const query = useQuery();
    const [mobileMode, setMobileMode] = useState(false);
    const [authCheckComplete, setAuthCheckComplete] = useState(false);

    useEffect(() => {
        notificationService.initialize();
        
        return () => {
            notificationService.disconnect();
        };
    }, []);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const response = await axios.get('/api/user/current', {
                    withCredentials: true
                });
                
                setUserData(response.data);
                setIsAuthenticated(true);
                setAuthCheckComplete(true);
                
                const storedMobileMode = localStorage.getItem('mobileMode') === 'true';
                setMobileMode(storedMobileMode);
            } catch (error) {
                console.error('Failed to fetch user:', error);
                setIsAuthenticated(false);
                setUserData(null);
                setAuthCheckComplete(true);
                if (error.response && error.response.status === 401) {
                    navigate('/login');
                }
            }
        };

        fetchUser();
    }, [navigate]);

    // Auto-refresh if stuck in blank screen state
    useEffect(() => {
        if (authCheckComplete && !userData && !isAuthenticated) {
            const timer = setTimeout(() => {
                window.location.reload();
            }, 1000); // Auto-refresh after 1 second

            return () => clearTimeout(timer);
        }
    }, [authCheckComplete, userData, isAuthenticated]);

    const toggleMobileMode = () => {
        const newMode = !mobileMode;
        setMobileMode(newMode);
        localStorage.setItem('mobileMode', newMode.toString());
    };

    if (!authCheckComplete || (!userData && !isAuthenticated)) {
        return null;
    }

    return (
        <>
            <Routes>
                <Route
                    path="/map"
                    element={
                        userData ? (
                            mobileMode ? 
                                <MobileMap user={userData} toggleMobileMode={toggleMobileMode} /> : 
                                <MapPage user={userData} toggleMobileMode={toggleMobileMode} setSelectedIncident={setSelectedIncident} />
                        ) : <Navigate to="/login" />
                    }
                />
                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute isAuthenticated={isAuthenticated}>
                            <AdminPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/roster"
                    element={
                        <ProtectedRoute isAuthenticated={isAuthenticated}>
                            <VehicleRoster selectedIncident={selectedIncident} />
                        </ProtectedRoute>
                    }
                />
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={<LoginPage />} />
            </Routes>
            <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={true}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
                limit={5}
                toastClassName="notification-toast-container"
                bodyClassName="notification-toast-body"
                style={{
                    zIndex: 9999,
                    width: 'auto',
                    maxWidth: '500px'
                }}
            />
        </>
    );
}

function AppWrapper() {
    return (
        <Router>
            <App />
        </Router>
    );
}

export default AppWrapper;
