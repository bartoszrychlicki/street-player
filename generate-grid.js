const turf = require('@turf/turf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Get grid size from command line argument, default to 20m
const gridSizeMeters = parseInt(process.argv[2]) || 20;
console.log(`Using grid size: ${gridSizeMeters}m x ${gridSizeMeters}m`);

// Load Oliwa district boundary
const districtsData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'public', 'dzielnice.geojson'), 'utf8')
);

const oliwa = districtsData.features.find(f =>
    f.properties.NAZWA === 'Oliwa'
);

if (!oliwa) {
    console.error('Oliwa district not found!');
    process.exit(1);
}

console.log('✓ Found Oliwa district');

// Get bounding box for Oliwa
const bbox = turf.bbox(oliwa);
console.log('✓ Bounding box:', bbox);

// Overpass API query to get paths in Oliwa
const overpassQuery = `
[out:json][timeout:60];
(
  way["highway"="footway"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
  way["highway"="path"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
  way["highway"="cycleway"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
  way["highway"="pedestrian"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
  way["highway"="track"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
  way["highway"="steps"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
  way["highway"="service"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
  way["highway"="unclassified"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
  way["highway"="residential"](${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]});
);
out geom;
`;

async function fetchPaths() {
    console.log('Fetching paths from OpenStreetMap...');

    try {
        const response = await axios.post(
            'https://overpass-api.de/api/interpreter',
            overpassQuery,
            {
                headers: { 'Content-Type': 'text/plain' }
            }
        );

        console.log(`✓ Fetched ${response.data.elements.length} path elements from OSM`);
        return response.data.elements;
    } catch (error) {
        console.error('Error fetching from Overpass API:', error.message);
        process.exit(1);
    }
}

function osmToGeoJSON(elements) {
    const features = [];

    for (const element of elements) {
        if (element.type === 'way' && element.geometry) {
            const coordinates = element.geometry.map(node => [node.lon, node.lat]);

            features.push({
                type: 'Feature',
                properties: {
                    highway: element.tags?.highway || 'unknown',
                    name: element.tags?.name || null
                },
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates
                }
            });
        }
    }

    return {
        type: 'FeatureCollection',
        features: features
    };
}

function generateUniformGridFast(pathsGeoJSON, gridSizeMeters = 20) {
    console.log(`Generating optimized ${gridSizeMeters}x${gridSizeMeters}m grid for Oliwa...`);

    // Get bounding box of Oliwa district
    const districtBbox = turf.bbox(oliwa);

    // Calculate grid cell size in degrees
    const latStep = gridSizeMeters / 111000; // degrees
    const lonStep = gridSizeMeters / 64000;  // degrees

    console.log(`Grid cell size: ${latStep.toFixed(8)}° lat x ${lonStep.toFixed(8)}° lon`);

    // Align grid to round coordinates
    const gridOriginLat = Math.floor(districtBbox[1] / latStep) * latStep;
    const gridOriginLon = Math.floor(districtBbox[0] / lonStep) * lonStep;

    const gridSquares = new Map(); // Use Map to store unique squares by key "row_col"

    // Distance threshold: half diagonal of square + small buffer
    const diagonalMeters = Math.sqrt(2) * gridSizeMeters;
    const thresholdKm = (diagonalMeters / 2 + 1) / 1000; // +1m buffer is enough if we check strictly
    // Note: User wanted coverage. A slightly larger buffer ensures no gaps on turns.
    // Let's stick to the previous logic roughly: 
    // If distance(center, path) <= threshold, then include.
    // Threshold was ~12m for 10m grid.

    console.log(`Distance threshold: ${thresholdKm * 1000}m`);
    console.log(`Processing ${pathsGeoJSON.features.length} paths...`);

    let processedPaths = 0;

    // Pre-calculate degree deltas for the threshold to expand bbox
    const latBuffer = thresholdKm / 111;
    const lonBuffer = thresholdKm / 64; // approx

    for (const pathFeature of pathsGeoJSON.features) {
        processedPaths++;
        if (processedPaths % 500 === 0) process.stdout.write('.');

        const pathGeom = pathFeature.geometry;
        const pathBbox = turf.bbox(pathFeature);
        const pathHighway = pathFeature.properties.highway || 'unknown';

        // Expand bbox by threshold to find candidate grid cells
        const minLat = pathBbox[1] - latBuffer;
        const maxLat = pathBbox[3] + latBuffer;
        const minLon = pathBbox[0] - lonBuffer;
        const maxLon = pathBbox[2] + lonBuffer;

        // Convert to grid indices
        const minRow = Math.floor((minLat - gridOriginLat) / latStep);
        const maxRow = Math.floor((maxLat - gridOriginLat) / latStep);
        const minCol = Math.floor((minLon - gridOriginLon) / lonStep);
        const maxCol = Math.floor((maxLon - gridOriginLon) / lonStep);

        // Iterate over candidate cells
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const key = `${row}_${col}`;

                // Calculate center
                const centerLat = gridOriginLat + (row + 0.5) * latStep;
                const centerLon = gridOriginLon + (col + 0.5) * lonStep;
                const centerPoint = turf.point([centerLon, centerLat]);

                // Check distance to THIS path
                const nearestPoint = turf.nearestPointOnLine(pathGeom, centerPoint);
                const distance = turf.distance(centerPoint, nearestPoint, { units: 'kilometers' });

                if (distance <= thresholdKm) {
                    // Check if in Oliwa
                    if (turf.booleanPointInPolygon(centerPoint, oliwa)) {
                        if (gridSquares.has(key)) {
                            // Square already exists, add this road type to it
                            const existingSquare = gridSquares.get(key);
                            if (!existingSquare.properties.roadTypes.includes(pathHighway)) {
                                existingSquare.properties.roadTypes.push(pathHighway);
                            }
                        } else {
                            // Create new square
                            const cellLat = gridOriginLat + row * latStep;
                            const cellLon = gridOriginLon + col * lonStep;

                            const square = turf.polygon([[
                                [cellLon, cellLat],
                                [cellLon + lonStep, cellLat],
                                [cellLon + lonStep, cellLat + latStep],
                                [cellLon, cellLat + latStep],
                                [cellLon, cellLat]
                            ]]);

                            square.properties = {
                                id: `oliwa_${row}_${col}`,
                                district: 'Oliwa',
                                captured: false,
                                centerLat: centerLat,
                                centerLon: centerLon,
                                gridRow: row,
                                gridCol: col,
                                roadTypes: [pathHighway]
                            };

                            gridSquares.set(key, square);
                        }
                    }
                }
            }
        }
    }

    console.log('\n');
    console.log(`✓ Generated ${gridSquares.size} grid cells covering paths`);

    return {
        type: 'FeatureCollection',
        features: Array.from(gridSquares.values())
    };
}

async function main() {
    try {
        // Fetch paths from OSM
        const osmElements = await fetchPaths();

        // Convert to GeoJSON
        const pathsGeoJSON = osmToGeoJSON(osmElements);

        // Save paths for reference
        const pathsOutputPath = path.join(__dirname, 'public', 'oliwa-paths.geojson');
        fs.writeFileSync(pathsOutputPath, JSON.stringify(pathsGeoJSON, null, 2));
        console.log(`✓ Saved paths to ${pathsOutputPath}`);

        // Generate fast uniform grid
        const gridGeoJSON = generateUniformGridFast(pathsGeoJSON, gridSizeMeters);

        // Save grid
        const gridOutputPath = path.join(__dirname, 'public', 'oliwa-grid.geojson');
        fs.writeFileSync(gridOutputPath, JSON.stringify(gridGeoJSON, null, 2));
        console.log(`✓ Saved grid to ${gridOutputPath}`);

        console.log('\n✅ Grid generation complete!');
        console.log(`   Total squares on paths: ${gridGeoJSON.features.length}`);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
