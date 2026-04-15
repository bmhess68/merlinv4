import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasPermission, PERMISSIONS } from '../utils/permissions';
import UserPermissions from './UserPermissions';
import DatabaseManager from './DatabaseManager';

const AdminPage = () => {
    const [email, setEmail] = useState('');
    const [csvFile, setCsvFile] = useState(null);
    const [logsMerlin, setLogsMerlin] = useState('');
    const [logsZello, setLogsZello] = useState('');
    const [logsFDLocations, setLogsFDLocations] = useState('');
    const [authorizedEmails, setAuthorizedEmails] = useState([]);
    const [auditTrail, setAuditTrail] = useState([]);
    const [merlinStatus, setMerlinStatus] = useState('unknown');
    const [zelloStatus, setZelloStatus] = useState('unknown');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [mobileFollowLogs, setMobileFollowLogs] = useState([]);
    const [isLoadingMobileLogs, setIsLoadingMobileLogs] = useState(false);
    const [isRestarting, setIsRestarting] = useState({
        merlin: false,
        zello: false
    });
    const navigate = useNavigate();

    useEffect(() => {
        const checkAdminAccess = async () => {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const userData = JSON.parse(decodeURIComponent(urlParams.get('user')));
                
                if (!hasPermission(userData, PERMISSIONS.ADMIN)) {
                    navigate('/');
                    return;
                }

                // Fetch initial data (excluding logs)
                fetchServiceStatus();
                fetchLogs();
                fetchAuditTrail();
                fetchMobileFollowLogs();
            } catch (error) {
                console.error('Error checking admin access:', error);
                navigate('/');
            }
        };

        checkAdminAccess();
    }, [navigate]);

    const fetchMobileFollowLogs = async () => {
        setIsLoadingMobileLogs(true);
        try {
            const response = await fetch('/api/admin/logs/mobile-follows');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setMobileFollowLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to fetch mobile follow logs:', error);
        } finally {
            setIsLoadingMobileLogs(false);
        }
    };

    const fetchAuditTrail = async () => {
        try {
            const response = await fetch('/api/admin/audit-trail');
            const data = await response.json();
            setAuditTrail(data);
        } catch (error) {
            console.error('Failed to fetch audit trail:', error);
        }
    };

    const fetchServiceStatus = async () => {
        try {
            const [merlinRes, zelloRes] = await Promise.all([
                fetch('/api/admin/status/merlin'),
                fetch('/api/admin/status/zello')
            ]);
            const merlinData = await merlinRes.json();
            const zelloData = await zelloRes.json();
            setMerlinStatus(merlinData.status);
            setZelloStatus(zelloData.status);
        } catch (error) {
            console.error('Failed to fetch service status:', error);
        }
    };

    const fetchLogs = async () => {
        setIsRefreshing(true);
        try {
            const [merlinRes, zelloRes, fdLocationsRes] = await Promise.all([
                fetch('/api/admin/logs/merlin'),
                fetch('/api/admin/logs/zello'),
                fetch('/api/admin/logs/fdlocations')
            ]);
            
            const [merlinLogs, zelloLogs, fdLocationsLogs] = await Promise.all([
                merlinRes.text(),
                zelloRes.text(),
                fdLocationsRes.text()
            ]);

            setLogsMerlin(merlinLogs);
            setLogsZello(zelloLogs);
            setLogsFDLocations(fdLocationsLogs);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleUploadCSV = async (e) => {
        e.preventDefault();
        if (!csvFile) {
            return;
        }

        const formData = new FormData();
        formData.append('csvFile', csvFile);

        try {
            const response = await fetch('/api/admin/upload-csv', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to upload CSV');
            }

            // Clear the file input after successful upload
            setCsvFile(null);
            // Optional: Add success message
            alert('CSV uploaded successfully');
        } catch (error) {
            console.error('Failed to upload CSV:', error);
            alert('Failed to upload CSV file');
        }
    };

    const handleServiceRestart = async (service) => {
        try {
            setIsRestarting(prev => ({ ...prev, [service]: true }));
            
            const response = await fetch(`/api/admin/restart/${service}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to restart ${service}`);
            }

            // Refresh service status after restart
            await fetchServiceStatus();
            alert(`${service.toUpperCase()} service restarted successfully`);
            
        } catch (error) {
            console.error(`Failed to restart ${service}:`, error);
            alert(`Failed to restart ${service} service`);
        } finally {
            setIsRestarting(prev => ({ ...prev, [service]: false }));
        }
    };

    // Format date string to a readable format in Eastern time
    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown time';
        
        const date = new Date(dateString);
        // Check if the date is valid
        if (isNaN(date.getTime())) return 'Invalid date';
        
        // Options to format in US Eastern Time (ET)
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'America/New_York',
            hour12: true
        };
        
        return new Intl.DateTimeFormat('en-US', options).format(date) + ' ET';
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.heading}>Admin Dashboard</h2>
                
                <div style={styles.serviceControls}>
                    <div style={styles.serviceSection}>
                        <div style={styles.statusContainer}>
                            <div style={{ ...styles.statusLight, backgroundColor: merlinStatus === 'active' ? 'green' : 'red' }}></div>
                            <p style={styles.statusText}>Merlin Service: {merlinStatus}</p>
                        </div>
                        <button 
                            onClick={() => handleServiceRestart('merlin')}
                            disabled={isRestarting.merlin}
                            style={styles.restartButton}
                        >
                            {isRestarting.merlin ? 'Restarting...' : 'Restart Merlin'}
                        </button>
                    </div>

                    <div style={styles.serviceSection}>
                        <div style={styles.statusContainer}>
                            <div style={{ ...styles.statusLight, backgroundColor: zelloStatus === 'active' ? 'green' : 'red' }}></div>
                            <p style={styles.statusText}>Zello Service: {zelloStatus}</p>
                        </div>
                        <button 
                            onClick={() => handleServiceRestart('zello')}
                            disabled={isRestarting.zello}
                            style={styles.restartButton}
                        >
                            {isRestarting.zello ? 'Restarting...' : 'Restart Zello'}
                        </button>
                    </div>
                </div>

                <div style={styles.section}>
                    <UserPermissions />
                </div>

                <div style={styles.section}>
                    <h3 style={styles.subheading}>Upload CSV</h3>
                    <input 
                        type="file" 
                        accept=".csv" 
                        onChange={(e) => setCsvFile(e.target.files[0])} 
                        style={styles.inputFile}
                    />
                    <button onClick={handleUploadCSV} style={styles.button}>Upload CSV</button>
                </div>

                {/* Mobile Follow Logs Section */}
                <div style={styles.section}>
                    <div style={styles.logHeader}>
                        <h3 style={styles.subheading}>Mobile Follow Logs</h3>
                        <div style={styles.buttonGroup}>
                            <button 
                                onClick={fetchMobileFollowLogs} 
                                disabled={isLoadingMobileLogs}
                                style={styles.refreshButton}
                            >
                                {isLoadingMobileLogs ? 'Loading...' : 'Refresh Logs'}
                            </button>
                            <a 
                                href="/api/admin/logs/mobile-follows/export" 
                                style={styles.exportButton}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Export CSV
                            </a>
                        </div>
                    </div>
                    <div style={styles.tableContainer}>
                        {mobileFollowLogs.length > 0 ? (
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.tableHeader}>Time (EST)</th>
                                        <th style={styles.tableHeader}>User</th>
                                        <th style={styles.tableHeader}>Email</th>
                                        <th style={styles.tableHeader}>Followed Vehicle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mobileFollowLogs.map((log, index) => (
                                        <tr key={log.id || index} style={index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd}>
                                            <td style={styles.tableCell}>{formatDate(log.timestamp)}</td>
                                            <td style={styles.tableCell}>{log.follower_name}</td>
                                            <td style={styles.tableCell}>{log.follower_email}</td>
                                            <td style={styles.tableCell}>{log.followed_vehicle}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={styles.noDataMessage}>
                                {isLoadingMobileLogs ? 'Loading mobile follow logs...' : 'No mobile follow logs available'}
                            </div>
                        )}
                    </div>
                </div>

                <div style={styles.section}>
                    <div style={styles.logHeader}>
                        <h3 style={styles.subheading}>Service Logs</h3>
                        <button 
                            onClick={fetchLogs} 
                            disabled={isRefreshing}
                            style={styles.refreshButton}
                        >
                            {isRefreshing ? 'Refreshing...' : 'Refresh Logs'}
                        </button>
                    </div>

                    <div style={styles.section}>
                        <h4 style={styles.logHeader}>Merlin Service Logs</h4>
                        <pre style={styles.logBox}>
                            {logsMerlin || 'Click refresh to load logs'}
                        </pre>
                    </div>

                    <div style={styles.section}>
                        <h4 style={styles.logHeader}>Zello Service Logs</h4>
                        <pre style={styles.logBox}>
                            {logsZello || 'Click refresh to load logs'}
                        </pre>
                    </div>

                    <div style={styles.section}>
                        <h4 style={styles.logHeader}>FDLocations Service Logs</h4>
                        <pre style={styles.logBox}>
                            {logsFDLocations || 'Click refresh to load logs'}
                        </pre>
                    </div>
                </div>

                <div style={styles.section}>
                    <h3 style={styles.subheading}>Audit Trail (Last 50 Entries)</h3>
                    <pre style={styles.logBox}>
                        {Array.isArray(auditTrail) && auditTrail.map((entry, index) => (
                            <div key={index} style={styles.auditEntry}>
                                {new Date(entry.timestamp).toLocaleString()} - 
                                {entry.user_email} - 
                                {entry.action} - 
                                {entry.additional_info}
                            </div>
                        ))}
                    </pre>
                </div>

                <div style={styles.section}>
                    <DatabaseManager />
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundImage: 'url(/images/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: '20px'
    },
    card: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: '30px',
        borderRadius: '10px',
        width: '100%',
        maxWidth: '1200px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.5)',
        color: '#fff'
    },
    heading: {
        fontSize: '28px',
        fontWeight: 'bold',
        marginBottom: '20px',
        textAlign: 'center'
    },
    statusContainer: {
        display: 'flex',
        alignItems: 'center',
        marginBottom: '15px'
    },
    statusLight: {
        width: '15px',
        height: '15px',
        borderRadius: '50%',
        marginRight: '10px'
    },
    statusText: {
        fontSize: '18px'
    },
    section: {
        marginBottom: '30px'
    },
    subheading: {
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '10px'
    },
    input: {
        width: '100%',
        padding: '10px',
        marginBottom: '10px',
        borderRadius: '5px',
        border: '1px solid #ccc',
        fontSize: '16px'
    },
    inputFile: {
        marginBottom: '10px'
    },
    button: {
        width: '100%',
        padding: '10px',
        borderRadius: '5px',
        backgroundColor: '#007bff',
        color: '#fff',
        fontSize: '16px',
        cursor: 'pointer',
        border: 'none',
        marginTop: '10px'
    },
    scrollableBox: {
        maxHeight: '200px',
        overflowY: 'scroll',
        backgroundColor: '#333',
        padding: '10px',
        borderRadius: '5px'
    },
    emailList: {
        listStyleType: 'none',
        padding: 0,
        margin: 0
    },
    emailItem: {
        padding: '5px 0',
        borderBottom: '1px solid #444'
    },
    logBox: {
        backgroundColor: '#222',
        color: '#fff',
        padding: '10px',
        borderRadius: '5px',
        maxHeight: '200px',
        overflowY: 'scroll'
    },
    auditEntry: {
        marginBottom: '5px'
    },
    logHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
    },
    refreshButton: {
        padding: '5px 10px',
        borderRadius: '5px',
        backgroundColor: '#007bff',
        color: '#fff',
        fontSize: '16px',
        cursor: 'pointer',
        border: 'none'
    },
    serviceControls: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '20px',
        marginBottom: '30px'
    },
    serviceSection: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        padding: '15px',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    restartButton: {
        padding: '8px 15px',
        borderRadius: '5px',
        backgroundColor: '#dc3545',
        color: '#fff',
        fontSize: '14px',
        cursor: 'pointer',
        border: 'none',
        transition: 'background-color 0.2s',
        ':hover': {
            backgroundColor: '#c82333'
        },
        ':disabled': {
            backgroundColor: '#6c757d',
            cursor: 'not-allowed'
        }
    },
    tableContainer: {
        backgroundColor: '#222',
        borderRadius: '5px',
        padding: '10px',
        overflowX: 'auto',
        maxHeight: '400px',
        overflowY: 'auto'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        color: '#fff',
        fontSize: '14px'
    },
    tableHeader: {
        textAlign: 'left',
        padding: '8px 12px',
        borderBottom: '2px solid #444',
        position: 'sticky',
        top: 0,
        backgroundColor: '#333',
        fontWeight: 'bold'
    },
    tableRowEven: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)'
    },
    tableRowOdd: {
        backgroundColor: 'rgba(0, 0, 0, 0.1)'
    },
    tableCell: {
        padding: '8px 12px',
        borderBottom: '1px solid #444'
    },
    noDataMessage: {
        textAlign: 'center',
        padding: '20px',
        color: '#aaa',
        fontStyle: 'italic'
    },
    buttonGroup: {
        display: 'flex',
        gap: '10px'
    },
    exportButton: {
        padding: '5px 10px',
        borderRadius: '5px',
        backgroundColor: '#007bff',
        color: '#fff',
        fontSize: '16px',
        cursor: 'pointer',
        border: 'none',
        textDecoration: 'none'
    }
};

export default AdminPage;
