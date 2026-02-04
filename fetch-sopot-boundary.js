/* eslint-disable @typescript-eslint/no-require-imports */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function fetchSopotBoundary() {
    console.log('Fetching Sopot boundary from Nominatim...');

    try {
        const response = await axios.get(
            'https://nominatim.openstreetmap.org/search',
            {
                params: {
                    q: 'Sopot, Poland',
                    format: 'json',
                    polygon_geojson: 1,
                    limit: 1
                },
                headers: {
                    'User-Agent': 'StreetPlayer/1.0 (https://github.com/street-player)'
                }
            }
        );

        const data = response.data;

        if (!data || data.length === 0) {
            throw new Error('No results found for Sopot');
        }

        const sopot = data[0];
        console.log('Found:', sopot.display_name);
        console.log('Bounding box:', sopot.boundingbox);

        if (!sopot.geojson) {
            throw new Error('No geojson in response');
        }

        // Create GeoJSON FeatureCollection
        const boundaryGeoJSON = {
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                properties: {
                    NAZWA: 'Sopot',
                    name: 'Sopot',
                    osm_id: sopot.osm_id,
                    osm_type: sopot.osm_type
                },
                geometry: sopot.geojson
            }]
        };

        const outputPath = path.join(__dirname, 'public', 'sopot-boundary.geojson');
        fs.writeFileSync(outputPath, JSON.stringify(boundaryGeoJSON, null, 2));
        console.log('Saved Sopot boundary to', outputPath);

        return boundaryGeoJSON;

    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    }
}

fetchSopotBoundary();
