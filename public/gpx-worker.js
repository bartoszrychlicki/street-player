// GPX Processing Web Worker
// This runs in a separate thread to keep the UI responsive

// Import libraries from CDN (since we can't use npm imports in workers directly)
importScripts('https://cdn.jsdelivr.net/npm/@tmcw/togeojson@5.8.1/dist/togeojson.umd.js');
importScripts('https://cdn.jsdelivr.net/npm/@turf/turf@7.1.0/turf.min.js');
importScripts('https://cdn.jsdelivr.net/npm/@xmldom/xmldom@0.8.10/lib/dom-parser.js');

self.addEventListener('message', async (e) => {
    const { type, gpxText, gridData, currentCaptured } = e.data;

    if (type === 'process') {
        try {
            // Parse GPX using xmldom (works in workers)
            const DOMParser = self.DOMParser || self.xmldom.DOMParser;
            const parser = new DOMParser();
            const gpxDoc = parser.parseFromString(gpxText, "text/xml");
            const geojson = toGeoJSON.gpx(gpxDoc);

            let newCapturedCount = 0;
            const newCapturedIds = [];
            const currentCapturedSet = new Set(currentCaptured);

            let processedFeatures = 0;
            const totalFeatures = geojson.features.length;

            // Process each track
            for (const feature of geojson.features) {
                if (feature.geometry?.type === 'LineString' || feature.geometry?.type === 'MultiLineString') {
                    // Buffer path by 0.5m (same as generation)
                    const bufferedPath = turf.buffer(feature, 0.0005, { units: 'kilometers' });
                    const pathBbox = turf.bbox(bufferedPath);

                    // Filter candidates by bbox
                    const candidates = gridData.features.filter((cell) => {
                        const cLat = cell.properties.centerLat;
                        const cLon = cell.properties.centerLon;
                        return cLat >= pathBbox[1] - 0.0002 && cLat <= pathBbox[3] + 0.0002 &&
                            cLon >= pathBbox[0] - 0.0002 && cLon <= pathBbox[2] + 0.0002;
                    });

                    // Check intersection
                    for (const cell of candidates) {
                        if (currentCapturedSet.has(cell.properties.id)) continue;

                        if (turf.booleanIntersects(cell, bufferedPath)) {
                            newCapturedIds.push(cell.properties.id);
                            currentCapturedSet.add(cell.properties.id);
                            newCapturedCount++;
                        }
                    }
                }

                processedFeatures++;

                // Send progress update every 10 features
                if (processedFeatures % 10 === 0 || processedFeatures === totalFeatures) {
                    self.postMessage({
                        type: 'progress',
                        processed: processedFeatures,
                        total: totalFeatures
                    });
                }
            }

            // Send final result
            self.postMessage({
                type: 'result',
                newCapturedIds,
                count: newCapturedCount
            });

        } catch (error) {
            self.postMessage({
                type: 'error',
                message: error.message
            });
        }
    }
});
