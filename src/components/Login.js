// src/components/Login.js
import React from 'react';

function Login() {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundImage: 'url(/images/background.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative'
        }}>
            <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                padding: '40px',
                borderRadius: '8px',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
                textAlign: 'center',
                color: '#fff',
                zIndex: 2,
                position: 'relative'
            }}>
                <img src="/images/logo.png" alt="Logo" style={{ width: '200px', marginBottom: '20px' }} />
                <h1 style={{ marginBottom: '20px' }}>Westchester/Putnam MERLIN Mobile</h1>
                <a href={`https://slack.com/openid/connect/authorize?scope=openid%20email%20profile&response_type=code&redirect_uri=${encodeURIComponent('https://merlin.westchesterrtc.com/oauth/callback')}&client_id=298551854944.7499556740369`}
                    style={{
                        alignItems: 'center',
                        color: '#000',
                        backgroundColor: '#fff',
                        border: 'none',
                        borderRadius: '56px',
                        display: 'inline-flex',
                        fontFamily: 'Lato, sans-serif',
                        fontSize: '18px',
                        fontWeight: '600',
                        height: '56px',
                        justifyContent: 'center',
                        textDecoration: 'none',
                        width: '296px',
                        padding: '0 15px',
                        boxSizing: 'border-box',
                        marginTop: '20px',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '24px', width: '24px', marginRight: '12px' }} viewBox="0 0 122.8 122.8">
                        <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a"></path>
                        <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0"></path>
                        <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d"></path>
                        <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e"></path>
                    </svg>
                    Sign in with Slack
                </a>
                <p style={{
                    fontSize: '12px',
                    color: '#ddd',
                    maxWidth: '300px',
                    textAlign: 'center',
                    marginTop: '20px'
                }}>
                    Unauthorized use of this system is prohibited and may result in disciplinary action and criminal prosecution.
                </p>
            </div>
        </div>
    );
}

export default Login;
