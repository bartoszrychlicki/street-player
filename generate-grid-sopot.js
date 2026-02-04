/* eslint-disable @typescript-eslint/no-require-imports */
const turf = require('@turf/turf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Get grid size from command line argument, default to 10m
const gridSizeMeters = parseInt(process.argv[2]) || 10;
console.log(`Using grid size: ${gridSizeMeters}m x ${gridSizeMeters}m`);

// Sopot boundary query - city without districts
const SOPOT_BOUNDARY_QUERY = `
[out:json][timeout:180];
relation["name"="Sopot"]["admin_level"="8"]["boundary"="administrative"];
out geom;
`;

// Overpass API query to get paths for a given bbox
function buildOverpassQuery(bbox) {
    return `
[out:json][timeout:180];
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
}

async function fetchSopotBoundary() {
    console.log('Loading Sopot city boundary...');

    const boundaryPath = path.join(__dirname, 'public', 'sopot-boundary.geojson');

    if (fs.existsSync(boundaryPath)) {
        console.log('Loading cached Sopot boundary...');
        return JSON.parse(fs.readFileSync(boundaryPath, 'utf8'));
    }

    throw new Error('Sopot boundary file not found. Run fetch-sopot-boundary.js first.');
}

async function fetchPaths(bbox) {
    console.log('Fetching paths for Sopot from OpenStreetMap...');

    // Use alternative Overpass servers if main is busy
    const servers = [
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass-api.de/api/interpreter',
        'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ];

    for (const server of servers) {
        try {
            console.log(`Trying server: ${server}`);
            const response = await axios.post(
                server,
                buildOverpassQuery(bbox),
                {
                    headers: { 'Content-Type': 'text/plain' },
                    timeout: 300000 // 5 minutes
                }
            );

            console.log(`Fetched ${response.data.elements.length} path elements for Sopot`);
            return response.data.elements;
        } catch (error) {
            console.error(`Error with ${server}:`, error.message);
            if (server === servers[servers.length - 1]) {
                throw error;
            }
            console.log('Trying next server...');
        }
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

function generateGridForSopot(boundaryFeature, pathsGeoJSON, gridSizeMeters) {
    const districtName = 'Sopot';
    console.log(`\nGenerating ${gridSizeMeters}x${gridSizeMeters}m grid for ${districtName}...`);

    // Get bounding box of Sopot
    const bbox = turf.bbox(boundaryFeature);

    // Calculate grid cell size in degrees
    const latStep = gridSizeMeters / 111000; // degrees
    const lonStep = gridSizeMeters / 64000;  // degrees

    console.log(`Grid cell size: ${latStep.toFixed(8)} lat x ${lonStep.toFixed(8)} lon`);

    // Align grid to round coordinates
    const gridOriginLat = Math.floor(bbox[1] / latStep) * latStep;
    const gridOriginLon = Math.floor(bbox[0] / lonStep) * lonStep;

    const gridSquares = new Map(); // Use Map to store unique squares by key "row_col"

    // Distance threshold: half diagonal of square + small buffer
    const diagonalMeters = Math.sqrt(2) * gridSizeMeters;
    const thresholdKm = (diagonalMeters / 2 + 2) / 1000;

    console.log('Using exact intersection logic with 0.5m path buffer');
    console.log(`Processing ${pathsGeoJSON.features.length} paths...`);

    let processedPaths = 0;
    const totalPaths = pathsGeoJSON.features.length;

    // Pre-calculate degree deltas for the threshold to expand bbox
    const latBuffer = thresholdKm / 111;
    const lonBuffer = thresholdKm / 64;

    for (const pathFeature of pathsGeoJSON.features) {
        processedPaths++;
        if (processedPaths % 500 === 0) {
            console.log(`  Processed ${processedPaths}/${totalPaths} paths (${Math.round(processedPaths / totalPaths * 100)}%)...`);
        }

        const pathHighway = pathFeature.properties.highway || 'unknown';

        // Buffer the path by 0.5m
        const bufferedPath = turf.buffer(pathFeature, 0.0005, { units: 'kilometers' });
        const pathBbox = turf.bbox(bufferedPath);

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

                // Calculate cell corners
                const cellLat = gridOriginLat + row * latStep;
                const cellLon = gridOriginLon + col * lonStep;

                // Create square polygon for intersection check
                // Round coordinates to 6 decimal places to save space
                const p1 = [Number(cellLon.toFixed(6)), Number(cellLat.toFixed(6))];
                const p2 = [Number((cellLon + lonStep).toFixed(6)), Number(cellLat.toFixed(6))];
                const p3 = [Number((cellLon + lonStep).toFixed(6)), Number((cellLat + latStep).toFixed(6))];
                const p4 = [Number(cellLon.toFixed(6)), Number((cellLat + latStep).toFixed(6))];

                const square = turf.polygon([[p1, p2, p3, p4, p1]]);

                // Check EXACT intersection
                if (turf.booleanIntersects(square, bufferedPath)) {
                    // Check if in Sopot boundary
                    if (turf.booleanPointInPolygon(centerPoint, boundaryFeature)) {
                        if (gridSquares.has(key)) {
                            // Square already exists, add this road type to it
                            const existingSquare = gridSquares.get(key);
                            if (!existingSquare.properties.rt.includes(pathHighway)) {
                                existingSquare.properties.rt.push(pathHighway);
                            }
                        } else {
                            // Create new square
                            const districtId = 'sopot';

                            // Move ID to top-level for feature-state support
                            square.id = `${districtId}_${row}_${col}`;

                            square.properties = {
                                d: districtName, // district name
                                cLat: Number(centerLat.toFixed(6)),
                                cLon: Number(centerLon.toFixed(6)),
                                rt: [pathHighway] // road types array
                            };

                            gridSquares.set(key, square);
                        }
                    }
                }
            }
        }
    }

    console.log(`Generated ${gridSquares.size} grid cells for ${districtName}`);

    return Array.from(gridSquares.values());
}

async function main() {
    try {
        console.log('\n' + '='.repeat(60));
        console.log('Processing Sopot (entire city, no districts)');
        console.log('='.repeat(60));

        // Fetch or load Sopot boundary
        const boundaryGeoJSON = await fetchSopotBoundary();
        const boundaryFeature = boundaryGeoJSON.features[0];

        if (!boundaryFeature) {
            throw new Error('No boundary feature found for Sopot');
        }

        console.log('Sopot boundary loaded successfully');

        // Get bounding box
        const bbox = turf.bbox(boundaryFeature);
        console.log('Bounding box:', bbox);

        // Fetch or load paths
        const pathsOutputPath = path.join(__dirname, 'public', 'sopot-paths.geojson');
        let pathsGeoJSON;

        if (fs.existsSync(pathsOutputPath)) {
            console.log(`Loading cached paths from ${pathsOutputPath}`);
            pathsGeoJSON = JSON.parse(fs.readFileSync(pathsOutputPath, 'utf8'));
        } else {
            // Fetch paths from OSM
            const osmElements = await fetchPaths(bbox);

            // Convert to GeoJSON
            pathsGeoJSON = osmToGeoJSON(osmElements);

            fs.writeFileSync(pathsOutputPath, JSON.stringify(pathsGeoJSON, null, 2));
            console.log(`Saved paths to ${pathsOutputPath}`);
        }

        // Generate grid
        const gridSquares = generateGridForSopot(boundaryFeature, pathsGeoJSON, gridSizeMeters);

        // Save grid
        const gridOutput = {
            type: 'FeatureCollection',
            features: gridSquares
        };
        const gridOutputPath = path.join(__dirname, 'public', 'grid-sopot.geojson');
        fs.writeFileSync(gridOutputPath, JSON.stringify(gridOutput, null, 2));
        console.log(`\nSaved grid to ${gridOutputPath}`);

        console.log('\n Grid generation complete!');
        console.log(`   Total squares: ${gridSquares.length}`);

        // Print road type breakdown
        const roadTypeCount = {};
        gridSquares.forEach(sq => {
            sq.properties.rt.forEach(rt => {
                roadTypeCount[rt] = (roadTypeCount[rt] || 0) + 1;
            });
        });

        console.log('\n Road type breakdown:');
        Object.entries(roadTypeCount).sort((a, b) => b[1] - a[1]).forEach(([rt, count]) => {
            console.log(`   ${rt}: ${count} squares`);
        });

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
