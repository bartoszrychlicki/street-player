import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import * as turf from '@turf/turf';

async function getValidAccessToken(uid: string) {
    const db = getAdminDb();
    const docRef = db.collection('users').doc(uid).collection('integrations').doc('strava');
    const doc = await docRef.get();

    if (!doc.exists) return null;

    const data = doc.data();
    if (!data) return null;

    // Check if expired (add 5 minute buffer)
    if (data.expiresAt < (Date.now() / 1000) + 300) {
        // Refresh token
        const response = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: data.refreshToken,
            }),
        });

        const newData = await response.json();
        if (!response.ok) {
            console.error("Failed to refresh token", newData);
            return null;
        }

        await docRef.update({
            accessToken: newData.access_token,
            refreshToken: newData.refresh_token,
            expiresAt: newData.expires_at,
            updatedAt: new Date().toISOString(),
        });

        return newData.access_token;
    }

    return data.accessToken;
}

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const auth = getAdminAuth();
        const db = getAdminDb();

        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        const accessToken = await getValidAccessToken(uid);
        if (!accessToken) {
            return NextResponse.json({ error: 'Strava not connected or token expired' }, { status: 400 });
        }

        // Fetch activities (last 5 to keep it fast)
        const activitiesResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        const activities = await activitiesResponse.json();
        if (!activitiesResponse.ok) {
            return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
        }

        const newActivities = [];

        // Filter for Walks and process
        for (const activity of activities) {
            if (activity.type === 'Walk') {
                // Check if already processed (you might want to store processed activity IDs in Firestore)
                // For now, we'll return all and let the client deduplicate or we can check here.
                // Let's check if we have this activity ID stored
                const activityDoc = await db.collection('users').doc(uid).collection('strava_activities').doc(activity.id.toString()).get();

                if (!activityDoc.exists) {
                    // Fetch stream (lat/lng)
                    const streamResponse = await fetch(`https://www.strava.com/api/v3/activities/${activity.id}/streams?keys=latlng&key_by_type=true`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });

                    if (streamResponse.ok) {
                        const streamData = await streamResponse.json();
                        if (streamData.latlng && streamData.latlng.data) {
                            // Convert to GeoJSON LineString
                            // Strava returns [lat, lng], GeoJSON needs [lng, lat]
                            const coordinates = streamData.latlng.data.map((p: number[]) => [p[1], p[0]]);

                            const geojson = {
                                type: 'Feature',
                                geometry: {
                                    type: 'LineString',
                                    coordinates: coordinates
                                },
                                properties: {
                                    name: activity.name,
                                    time: activity.start_date,
                                    stravaId: activity.id
                                }
                            };

                            newActivities.push(geojson);

                            // Mark as processed
                            await db.collection('users').doc(uid).collection('strava_activities').doc(activity.id.toString()).set({
                                processedAt: new Date().toISOString(),
                                name: activity.name
                            });
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            newActivities: {
                type: 'FeatureCollection',
                features: newActivities
            }
        });

    } catch (error) {
        console.error('Error in Strava sync:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
