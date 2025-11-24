import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DOMParser } from 'xmldom';
import { gpx } from '@tmcw/togeojson';
import * as turf from '@turf/turf';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const content = buffer.toString('utf-8');

        // Parse GPX
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(content, 'text/xml');
        const geojson = gpx(gpxDoc);

        // Load existing grid
        const gridPath = path.join(process.cwd(), 'public', 'oliwa-grid.geojson');
        const gridData = JSON.parse(fs.readFileSync(gridPath, 'utf8'));

        // Create a map for fast lookup by ID
        const gridMap = new Map();
        gridData.features.forEach((f: any) => {
            gridMap.set(f.properties.id, f);
        });

        let capturedCount = 0;

        // Process each feature in the uploaded GPX
        for (const feature of geojson.features) {
            if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                const pathGeom = feature.geometry;

                // We need to find which grid cells this path intersects.
                // Iterating 53k cells is too slow.
                // We can use the grid logic to narrow it down, or use spatial index.
                // Given the grid is regular, we can calculate candidate cells.

                // Re-derive grid parameters from the first feature (assuming uniform grid)
                // Or just iterate all for now if we want to be 100% sure, but let's try to be smart.
                // Actually, for 50k features, a simple bbox check + point-in-poly might be slow but acceptable for a single upload.
                // Let's try a slightly optimized approach: iterate grid, check bbox overlap, then distance.

                // Better: Iterate the PATH points and find which cell they are in.
                // But a path might cross a cell without having a point in it (if segments are long).
                // However, GPX usually has frequent points.
                // Let's try: Buffer the path by ~5-10m and find intersecting grid centers.

                const pathBbox = turf.bbox(feature);

                // Filter grid cells that are within the path's bbox (plus some buffer)
                const candidates = gridData.features.filter((cell: any) => {
                    // Simple bbox check
                    // Cell coords are small, so just check if cell center is in expanded path bbox
                    const cLat = cell.properties.centerLat;
                    const cLon = cell.properties.centerLon;
                    return cLat >= pathBbox[1] - 0.001 && cLat <= pathBbox[3] + 0.001 &&
                        cLon >= pathBbox[0] - 0.001 && cLon <= pathBbox[2] + 0.001;
                });

                // For candidates, check actual intersection/distance
                // We consider a cell captured if the path goes through it or very close (e.g. 5m)
                // The grid generation used ~9m threshold from center.
                // Let's use the same logic: if distance(cellCenter, path) <= threshold

                const gridSizeMeters = 10;
                const diagonalMeters = Math.sqrt(2) * gridSizeMeters;
                const thresholdKm = (diagonalMeters / 2 + 2) / 1000;

                for (const cell of candidates) {
                    if (cell.properties.captured) continue;

                    const centerPoint = turf.point([cell.properties.centerLon, cell.properties.centerLat]);
                    const nearestPoint = turf.nearestPointOnLine(pathGeom as any, centerPoint);
                    const distance = turf.distance(centerPoint, nearestPoint, { units: 'kilometers' });

                    if (distance <= thresholdKm) {
                        cell.properties.captured = true;
                        capturedCount++;
                    }
                }
            }
        }

        // Save updated grid
        fs.writeFileSync(gridPath, JSON.stringify(gridData, null, 2));

        return NextResponse.json({
            success: true,
            captured: capturedCount,
            totalCaptured: gridData.features.filter((f: any) => f.properties.captured).length
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
