const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const csvDirectory = path.join(__dirname, '..', 'csv'); // Points to src/csv directory

// Ensure CSV directory exists
if (!fs.existsSync(csvDirectory)) {
    fs.mkdirSync(csvDirectory);
}

const convertCSVToGeoJSON = (csvData) => {
    const features = csvData.map((row) => {
        console.log('Processing row:', row);
        return {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
            },
            properties: { ...row }
        };
    });

    return {
        type: 'FeatureCollection',
        features
    };
};

const getCSVFiles = async () => {
    try {
        const files = await fs.promises.readdir(csvDirectory);
        return files.filter(file => file.endsWith('.csv'));
    } catch (error) {
        console.error('Error reading CSV directory:', error);
        throw error;
    }
};

const processCSVFile = (filename) => {
    return new Promise((resolve, reject) => {
        const filePath = path.join(csvDirectory, filename);
        
        if (!fs.existsSync(filePath)) {
            reject(new Error('CSV file not found'));
            return;
        }

        const csvData = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                csvData.push(row);
            })
            .on('end', () => {
                const geoJSON = convertCSVToGeoJSON(csvData);
                console.log('Generated GeoJSON:', geoJSON);
                resolve(geoJSON);
            })
            .on('error', (err) => {
                console.error('Error reading CSV file:', err);
                reject(err);
            });
    });
};

module.exports = {
    getCSVFiles,
    processCSVFile,
    csvDirectory
}; 