const turf = require('@turf/turf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Get grid size from command line argument, default to 10m
const gridSizeMeters = parseInt(process.argv[2]) || 10;
console.log(`Using grid size: ${gridSizeMeters}m x ${gridSizeMeters}m`);

// Districts to process - using exact names as they appear in the file (with encoding issues)
const DISTRICTS = ['Oliwa', 'VII DwÃ³r', 'StrzyÅ¼a', 'Pieckiâ€“Migowo', 'Wrzeszcz GÃ³rny'];

// Mapping from broken encoding to proper Polish names
const DISTRICT_NAME_FIX = {
    'Oliwa': 'Oliwa',
    'VII DwÃ³r': 'VII Dwór',
    'StrzyÅ¼a': 'Strzyża',
    'Pieckiâ€“Migowo': 'Piecki-Migowo',
    'Wrzeszcz GÃ³rny': 'Wrzeszcz Górny'
};

// Load districts boundary data
const districtsData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'public', 'dzielnice.geojson'), 'utf8')
);

console.log('✓ Loaded districts data');

// Overpass API query to get paths for a given bbox
function buildOverpassQuery(bbox) {
    return `
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
}

async function fetchPaths(bbox, districtName) {
    console.log(`Fetching paths for ${districtName} from OpenStreetMap...`);

    try {
        const response = await axios.post(
            'https://overpass-api.de/api/interpreter',
            buildOverpassQuery(bbox),
            {
                headers: { 'Content-Type': 'text/plain' }
            }
        );

        console.log(`✓ Fetched ${response.data.elements.length} path elements for ${districtName}`);
        return response.data.elements;
    } catch (error) {
        console.error(`Error fetching from Overpass API for ${districtName}:`, error.message);
        throw error;
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

function generateGridForDistrict(districtFeature, pathsGeoJSON, gridSizeMeters) {
    const districtNameRaw = districtFeature.properties.NAZWA;
    const districtName = DISTRICT_NAME_FIX[districtNameRaw] || districtNameRaw;
    console.log(`\nGenerating ${gridSizeMeters}x${gridSizeMeters}m grid for ${districtName}...`);

    // Get bounding box of district
    const districtBbox = turf.bbox(districtFeature);

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
    const thresholdKm = (diagonalMeters / 2 + 2) / 1000;

    console.log(`Using exact intersection logic with 0.5m path buffer`);
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

                // Create square polygon for intersection check
                const cellLat = gridOriginLat + row * latStep;
                const cellLon = gridOriginLon + col * lonStep;

                const square = turf.polygon([[
                    [cellLon, cellLat],
                    [cellLon + lonStep, cellLat],
                    [cellLon + lonStep, cellLat + latStep],
                    [cellLon, cellLat + latStep],
                    [cellLon, cellLat]
                ]]);

                // Check EXACT intersection
                if (turf.booleanIntersects(square, bufferedPath)) {
                    // Check if in district
                    if (turf.booleanPointInPolygon(centerPoint, districtFeature)) {
                        if (gridSquares.has(key)) {
                            // Square already exists, add this road type to it
                            const existingSquare = gridSquares.get(key);
                            if (!existingSquare.properties.roadTypes.includes(pathHighway)) {
                                existingSquare.properties.roadTypes.push(pathHighway);
                            }
                        } else {
                            // Create new square properties
                            // Use a safe district ID (lowercase, no spaces/special chars)
                            const districtId = districtName.toLowerCase()
                                .replace(/\s+/g, '_')
                                .replace(/-/g, '_') // Replace hyphens with underscores
                                .replace(/ó/g, 'o')
                                .replace(/ą/g, 'a')
                                .replace(/ć/g, 'c')
                                .replace(/ę/g, 'e')
                                .replace(/ł/g, 'l')
                                .replace(/ń/g, 'n')
                                .replace(/ś/g, 's')
                                .replace(/ź/g, 'z')
                                .replace(/ż/g, 'z');

                            square.properties = {
                                id: `${districtId}_${row}_${col}`,
                                district: districtName,
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

    console.log(`✓ Generated ${gridSquares.size} grid cells for ${districtName}`);

    return Array.from(gridSquares.values());
}

async function main() {
    try {
        const allGridSquares = [];

        for (const districtName of DISTRICTS) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`Processing district: ${districtName}`);
            console.log('='.repeat(60));

            // Find district in data
            const district = districtsData.features.find(f =>
                f.properties.NAZWA === districtName
            );

            if (!district) {
                console.error(`❌ District "${districtName}" not found in dzielnice.geojson`);
                continue;
            }

            console.log(`✓ Found ${districtName} district`);

            // Get the fixed district name first
            const districtNameFixed = DISTRICT_NAME_FIX[districtName] || districtName;

            // Get bounding box
            const bbox = turf.bbox(district);
            console.log('✓ Bounding box:', bbox);

            // Fetch paths from OSM
            const osmElements = await fetchPaths(bbox, districtNameFixed);

            // Convert to GeoJSON
            const pathsGeoJSON = osmToGeoJSON(osmElements);

            // Calculate clean district ID from the FIXED name
            const districtId = districtNameFixed.toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/-/g, '_') // Replace hyphens with underscores
                .replace(/ó/g, 'o')
                .replace(/ą/g, 'a')
                .replace(/ć/g, 'c')
                .replace(/ę/g, 'e')
                .replace(/ł/g, 'l')
                .replace(/ń/g, 'n')
                .replace(/ś/g, 's')
                .replace(/ź/g, 'z')
                .replace(/ż/g, 'z');

            const pathsOutputPath = path.join(__dirname, 'public', `${districtId}-paths.geojson`);
            // fs.writeFileSync(pathsOutputPath, JSON.stringify(pathsGeoJSON, null, 2));
            // console.log(`✓ Saved paths to ${pathsOutputPath}`);

            // Generate grid
            const gridSquares = generateGridForDistrict(district, pathsGeoJSON, gridSizeMeters);

            // Save individual district grid
            const districtGrid = {
                type: 'FeatureCollection',
                features: gridSquares
            };
            const districtGridPath = path.join(__dirname, 'public', `grid-${districtId}.geojson`);
            fs.writeFileSync(districtGridPath, JSON.stringify(districtGrid, null, 2));
            console.log(`✓ Saved grid for ${districtNameFixed} to ${districtGridPath}`);

            // Add to combined collection (optional, but good for stats)
            allGridSquares.push(...gridSquares);

            // Add delay to avoid rate limiting
            if (DISTRICTS.indexOf(districtName) < DISTRICTS.length - 1) {
                console.log('\nWaiting 3 seconds before next district...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // We can skip saving the massive combined grid now, or save it as backup
        // const combinedGrid = {
        //     type: 'FeatureCollection',
        //     features: allGridSquares
        // };
        // const gridOutputPath = path.join(__dirname, 'public', 'city-grid.geojson');
        // fs.writeFileSync(gridOutputPath, JSON.stringify(combinedGrid, null, 2));
        // console.log(`\n✓ Saved combined grid to ${gridOutputPath}`);

        console.log('\n✅ Grid generation complete!');
        console.log(`   Total squares across all districts: ${allGridSquares.length}`);

        // Print breakdown by district
        const breakdown = {};
        allGridSquares.forEach(sq => {
            const dist = sq.properties.district;
            breakdown[dist] = (breakdown[dist] || 0) + 1;
        });

        console.log('\n📊 Breakdown by district:');
        Object.entries(breakdown).forEach(([dist, count]) => {
            console.log(`   ${dist}: ${count} squares`);
        });

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
