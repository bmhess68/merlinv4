const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Hardcoded database connection (delete this file after use!)
const pool = new Pool({
    user: 'wcpd',
    host: 'localhost',
    database: 'incidentdb',
    password: process.env.DB_PASSWORD,
    port: 5432
});

async function importEmails() {
    try {
        const emailsFile = path.join(__dirname, '..', 'authorized_emails.txt');
        const emailContent = fs.readFileSync(emailsFile, 'utf8');
        
        const emails = emailContent
            .split(',')
            .map(email => email.trim())
            .filter(email => email && email.includes('@'));

        const uniqueEmails = [...new Set(emails)];
        
        console.log(`Found ${uniqueEmails.length} unique emails to process`);

        const defaultPermissions = {
            policeGPS: true,
            fireGPS: true,
            starchase: true,
            makeIncidents: true,
            admin: false
        };

        for (const email of uniqueEmails) {
            try {
                await pool.query(
                    `INSERT INTO users (email, permissions) 
                     VALUES ($1, $2)
                     ON CONFLICT (email) 
                     DO UPDATE SET permissions = $2`,
                    [email, defaultPermissions]
                );
                console.log(`Processed: ${email}`);
            } catch (err) {
                console.error(`Error processing email ${email}:`, err.message);
            }
        }

        console.log('Email import completed');
        await pool.end(); // Properly close the pool
        process.exit(0);
    } catch (error) {
        console.error('Import failed:', error);
        await pool.end(); // Properly close the pool
        process.exit(1);
    }
}

importEmails();
