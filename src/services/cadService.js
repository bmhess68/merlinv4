const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { pool } = require('../db');
const moment = require('moment');
const fs = require('fs').promises;
const path = require('path');

// IMAP setup
const imapConfig = {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    host: process.env.EMAIL_SERVER,
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
};

// Add function to expire old alerts
const expireOldAlerts = async () => {
    try {
        await pool.query(`
            UPDATE cad_alerts 
            SET is_active = false 
            WHERE expires_at < NOW() 
            AND is_active = true
        `);
    } catch (error) {
        console.error('Error expiring old alerts:', error);
    }
};

// Parse CAD alert email content
const parseCADEmail = (content) => {
    // Initialize data object with default values
    const data = {
        address: '',
        cross_street: '',
        call_type: '',
        time_out: null,
        area: '',
        alarm_level: 0,
        comments: '',
        latitude: null,
        longitude: null,
        event_number: '',
        expires_at: new Date(Date.now() + 30 * 60000)
    };

    try {
        // More flexible regex patterns
        const patterns = {
            address: /^(.*?)(?:(?:_T:|:|\n))/i,
            cross: /Cross:\s*([^,\n]*)/i,
            type: /Type:\s*([^,\n]*)/i,
            timeOut: /Time out:\s*(\d{1,2}:\d{1,2}:\d{1,2})/i,
            area: /Area:\s*([^,\n]*)/i,
            alarmLevel: /Alarm lev:\s*(\d+)/i,
            comments: /Comments:\s*([^,]*?)(?=\s*(?:http|Event|$))/i,
            coordinates: /(?:maps\.google\.com\/\?q=|@)(-?\d+\.?\d*)[,\-](-?\d+\.?\d*)/i,
            eventNumber: /Event Number:\s*([A-Z]\d+)/i
        };

        // Extract data using regex patterns
        Object.entries(patterns).forEach(([key, pattern]) => {
            const match = content.match(pattern);
            if (match) {
                switch(key) {
                    case 'address':
                        data.address = match[1].trim();
                        break;
                    case 'cross':
                        data.cross_street = match[1].trim();
                        break;
                    case 'type':
                        data.call_type = match[1].trim();
                        break;
                    case 'timeOut':
                        const timeStr = match[1];
                        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
                        // Create time in local timezone
                        const timeOut = new Date();
                        timeOut.setHours(hours, minutes, seconds);
                        data.time_out = timeOut;
                        // Set expires_at to 30 minutes after time_out
                        data.expires_at = new Date(timeOut.getTime() + 30 * 60000);
                        break;
                    case 'area':
                        data.area = match[1].trim();
                        break;
                    case 'alarmLevel':
                        data.alarm_level = parseInt(match[1]) || 0;
                        break;
                    case 'comments':
                        data.comments = match[1].trim();
                        break;
                    case 'coordinates':
                        data.latitude = parseFloat(match[1]);
                        data.longitude = parseFloat(match[2]);
                        break;
                    case 'eventNumber':
                        data.event_number = match[1].trim();
                        break;
                }
            }
        });

        // Remove the default expires_at from initial data setup
        return data;
    } catch (error) {
        console.error('Error parsing CAD email:', error);
        return null;
    }
};

// Save CAD alert to database
const saveCADAlert = async (data) => {
    try {
        // First check if we already have this alert
        const existing = await pool.query(
            'SELECT id FROM cad_alerts WHERE event_number = $1 AND time_out = $2',
            [data.event_number, data.time_out]
        );

        if (existing.rows.length > 0) {
            console.log('Alert already exists:', data.event_number);
            return null;
        }

        const result = await pool.query(`
            INSERT INTO cad_alerts (
                address, cross_street, call_type, time_out, 
                area, alarm_level, comments, latitude, longitude, 
                event_number, expires_at, is_active, processed
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, false)
            RETURNING id
        `, [
            data.address, data.cross_street, data.call_type, data.time_out,
            data.area, data.alarm_level, data.comments, data.latitude, data.longitude,
            data.event_number, data.expires_at
        ]);

        console.log('CAD alert saved:', result.rows[0]);
        return result.rows[0];
    } catch (error) {
        console.error('Error saving CAD alert:', error);
        return null;
    }
};

// Add logging function
const logEmailProcessing = async (emailContent, parsedData, error = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        emailContent,
        parsedData,
        error,
        success: !!parsedData
    };

    try {
        // Ensure logs directory exists
        const logsDir = path.join(__dirname, '../../logs');
        await fs.mkdir(logsDir, { recursive: true });

        // Write to daily log file
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(logsDir, `cad_emails_${date}.log`);
        
        await fs.appendFile(
            logFile,
            JSON.stringify(logEntry, null, 2) + '\n---\n',
            'utf8'
        );

        // If parsing failed, also log to console
        if (!parsedData) {
            console.error('Failed to parse CAD email:', {
                timestamp,
                content: emailContent,
                error: error?.message || 'Unknown error'
            });
        }
    } catch (logError) {
        console.error('Error writing to log file:', logError);
    }
};

// Check for new emails and process them
const checkEmails = async (io) => {
    const imap = new Imap(imapConfig);

    return new Promise((resolve, reject) => {
        imap.once('ready', () => {
            imap.openBox('INBOX', false, async (err, box) => {
                if (err) {
                    console.error('Error opening inbox:', err);
                    imap.end();
                    return reject(err);
                }

                const searchDate = moment().subtract(1, 'hour').format('LL');
                const searchCriteria = [
                    'UNSEEN',
                    ['SINCE', searchDate],
                    ['OR',
                        ['FROM', '_IPAGE@westchestergov.com'],
                        ['FROM', 'bhess03@gmail.com']
                    ]
                ];

                imap.search(searchCriteria, (err, results) => {
                    if (err) {
                        console.error('Error searching emails:', err);
                        imap.end();
                        return reject(err);
                    }

                    if (!results || !results.length) {
                        imap.end();
                        return resolve();
                    }

                    const f = imap.fetch(results, { bodies: '' });

                    f.on('message', (msg) => {
                        msg.on('body', async (stream) => {
                            try {
                                const parsed = await simpleParser(stream);
                                const isValidSender = parsed.from.text.includes('_IPAGE@westchestergov.com') || 
                                                    parsed.from.text.includes('bhess03@gmail.com');

                                if (isValidSender) {
                                    const parsedData = parseCADEmail(parsed.text);
                                    await logEmailProcessing(parsed.text, parsedData);

                                    if (parsedData) {
                                        const savedAlert = await saveCADAlert(parsedData);
                                        if (savedAlert && io) {
                                            io.emit('new-cad-alert', {
                                                ...parsedData,
                                                id: savedAlert.id,
                                                type: 'CAD_ALERT'
                                            });
                                        }
                                    }
                                }

                                msg.once('attributes', (attrs) => {
                                    const uid = attrs.uid;
                                    imap.addFlags(uid, ['\\Seen'], () => {});
                                });
                            } catch (error) {
                                await logEmailProcessing(parsed?.text || 'Error reading email', null, error);
                                console.error('Error processing email:', error);
                            }
                        });
                    });

                    f.once('error', (err) => {
                        console.error('Fetch error:', err);
                        reject(err);
                    });

                    f.once('end', () => {
                        imap.end();
                        resolve();
                    });
                });
            });
        });

        imap.once('error', (err) => {
            console.error('IMAP error:', err);
            reject(err);
        });

        imap.connect();
    });
};

module.exports = {
    checkEmails,
    parseCADEmail,
    saveCADAlert
};