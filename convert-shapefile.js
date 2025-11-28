/* eslint-disable @typescript-eslint/no-require-imports */
const shapefile = require('shapefile');
const proj4 = require('proj4');
const fs = require('fs');
const path = require('path');

// Define EPSG:2180 (Polish CS2000 Zone 6) projection
proj4.defs('EPSG:2180', '+proj=tmerc +lat_0=0 +lon_0=18 +k=0.999923 +x_0=6500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

// EPSG:4326 is WGS84 (standard lat/lon)
const transform = proj4('EPSG:2180', 'EPSG:4326');

async function convertShapefileToGeoJSON() {
    const shpPath = path.join(__dirname, 'temp', 'Dzielnice.shp');
    const outputPath = path.join(__dirname, 'public', 'dzielnice.geojson');

    try {
        const source = await shapefile.open(shpPath);
        const features = [];

        let result = await source.read();
        while (!result.done) {
            const feature = result.value;

            // Transform coordinates
            if (feature.geometry && feature.geometry.coordinates) {
                feature.geometry.coordinates = transformCoordinates(feature.geometry.coordinates, feature.geometry.type);
            }

            features.push(feature);
            result = await source.read();
        }

        const geojson = {
            type: 'FeatureCollection',
            features: features
        };

        fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
        console.log(`✓ Converted successfully to ${outputPath}`);
        console.log(`✓ Found ${features.length} districts`);

        // Print first district name as sample
        if (features.length > 0) {
            console.log(`✓ Sample district: ${features[0].properties.NAZWA}`);
            console.log(`✓ Sample coordinates (first point):`, features[0].geometry.coordinates[0][0]);
        }
    } catch (error) {
        console.error('Error converting shapefile:', error);
        process.exit(1);
    }
}

function transformCoordinates(coords, type) {
    if (type === 'Polygon') {
        return coords.map(ring => ring.map(point => transform.forward(point)));
    } else if (type === 'MultiPolygon') {
        return coords.map(polygon => polygon.map(ring => ring.map(point => transform.forward(point))));
    } else if (type === 'LineString') {
        return coords.map(point => transform.forward(point));
    } else if (type === 'Point') {
        return transform.forward(coords);
    }
    return coords;
}

convertShapefileToGeoJSON();
