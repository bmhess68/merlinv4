// Permission types/constants
export const PERMISSIONS = {
    POLICE_GPS: 'policeGPS',
    FIRE_GPS: 'fireGPS',
    STARCHASE: 'starchase',
    MAKE_INCIDENTS: 'makeIncidents',
    ADMIN: 'admin'
};

// Helper function to check if user has permission
export const hasPermission = (user, permission) => {
    if (!user || !user.permissions) return false;
    return user.permissions[permission] === true;
};

// Helper function to check if user is admin
export const isAdmin = (user) => {
    return hasPermission(user, PERMISSIONS.ADMIN);
};