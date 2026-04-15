// src/App.js
import React, { useEffect, useContext } from 'react';
import { BrowserRouter as Router, Route, Switch, Redirect, useLocation } from 'react-router-dom';
import './App.css';
import SlackLoginButton from './SlackLoginButton';
import MapPage from './MapPage';
import { AuthContext, AuthProvider } from './AuthContext';

function AppContent() {
    const { authToken, login } = useContext(AuthContext);
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        if (token) {
            login(token);
            // Remove the token from the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [location, login]);

    if (!authToken) {
        return <SlackLoginButton />;
    }

    return <MapPage />;
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="App">
                    <header className="App-header">
                        <h1>Welcome to Our App</h1>
                        <AppContent />
                    </header>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;
