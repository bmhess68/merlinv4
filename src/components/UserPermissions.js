import React, { useState, useEffect } from 'react';
import axios from 'axios';

const UserPermissions = () => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const usersPerPage = 10;

    useEffect(() => {
        fetchUsers();
    }, [currentPage, searchTerm]);

    const fetchUsers = async () => {
        try {
            const response = await axios.get('/api/admin/users/permissions', {
                params: {
                    page: currentPage,
                    limit: usersPerPage,
                    search: searchTerm
                }
            });
            setUsers(response.data.users);
            setTotalUsers(response.data.total);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    const handlePermissionChange = async (userId, permission) => {
        try {
            const user = users.find(u => u.id === userId);
            const newValue = !user.permissions[permission];
            
            const response = await axios.post('/api/admin/users/permissions', {
                userId,
                permission,
                value: newValue
            });
            
            if (response.data.success) {
                // Update the local state immediately
                setUsers(users.map(u => {
                    if (u.id === userId) {
                        return {
                            ...u,
                            permissions: {
                                ...u.permissions,
                                [permission]: newValue
                            }
                        };
                    }
                    return u;
                }));
            } else {
                console.error('Failed to update permission:', response.data.error);
            }
        } catch (error) {
            console.error('Failed to update permission:', error);
        }
    };

    const totalPages = Math.ceil(totalUsers / usersPerPage);

    return (
        <div>
            <h3 style={styles.subheading}>User Management</h3>
            
            {/* Search Bar */}
            <div style={styles.searchContainer}>
                <input
                    type="text"
                    placeholder="Search by email or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={styles.searchInput}
                />
            </div>

            {/* Users Table */}
            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Email</th>
                            <th style={styles.th}>Name</th>
                            <th style={styles.th}>Police GPS</th>
                            <th style={styles.th}>Fire GPS</th>
                            <th style={styles.th}>StarChase</th>
                            <th style={styles.th}>Make Incidents</th>
                            <th style={styles.th}>Admin</th>
                            <th style={styles.th}>Last Login</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td style={styles.td}>{user.email}</td>
                                <td style={styles.td}>{user.name || '-'}</td>
                                <td style={styles.td}>
                                    <input
                                        type="checkbox"
                                        checked={user.permissions?.policeGPS || false}
                                        onChange={() => handlePermissionChange(user.id, 'policeGPS')}
                                    />
                                </td>
                                <td style={styles.td}>
                                    <input
                                        type="checkbox"
                                        checked={user.permissions?.fireGPS || false}
                                        onChange={() => handlePermissionChange(user.id, 'fireGPS')}
                                    />
                                </td>
                                <td style={styles.td}>
                                    <input
                                        type="checkbox"
                                        checked={user.permissions?.starchase || false}
                                        onChange={() => handlePermissionChange(user.id, 'starchase')}
                                    />
                                </td>
                                <td style={styles.td}>
                                    <input
                                        type="checkbox"
                                        checked={user.permissions?.makeIncidents || false}
                                        onChange={() => handlePermissionChange(user.id, 'makeIncidents')}
                                    />
                                </td>
                                <td style={styles.td}>
                                    <input
                                        type="checkbox"
                                        checked={user.permissions?.admin || false}
                                        onChange={() => handlePermissionChange(user.id, 'admin')}
                                    />
                                </td>
                                <td style={styles.td}>
                                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div style={styles.pagination}>
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={styles.pageButton}
                >
                    Previous
                </button>
                <span style={styles.pageInfo}>
                    Page {currentPage} of {totalPages}
                </span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={styles.pageButton}
                >
                    Next
                </button>
            </div>
        </div>
    );
};

const styles = {
    subheading: {
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '15px',
        color: '#fff'
    },
    searchContainer: {
        marginBottom: '20px'
    },
    searchInput: {
        width: '100%',
        padding: '10px',
        borderRadius: '5px',
        border: '1px solid #444',
        backgroundColor: '#333',
        color: '#fff',
        fontSize: '16px'
    },
    tableContainer: {
        overflowX: 'auto',
        backgroundColor: '#333',
        borderRadius: '5px',
        padding: '15px',
        marginBottom: '20px'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        color: '#fff'
    },
    th: {
        padding: '12px 20px',
        textAlign: 'left',
        borderBottom: '2px solid #444',
        fontWeight: 'bold'
    },
    td: {
        padding: '12px 20px',
        textAlign: 'left',
        borderBottom: '1px solid #444'
    },
    pagination: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
        marginTop: '20px'
    },
    pageButton: {
        padding: '8px 16px',
        borderRadius: '5px',
        backgroundColor: '#007bff',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        ':disabled': {
            backgroundColor: '#444',
            cursor: 'not-allowed'
        }
    },
    pageInfo: {
        color: '#fff'
    }
};

export default UserPermissions;
