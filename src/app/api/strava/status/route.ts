import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
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

        const doc = await db.collection('users').doc(uid).collection('integrations').doc('strava').get();

        if (doc.exists) {
            const data = doc.data();
            return NextResponse.json({
                connected: true,
                athleteId: data?.athleteId
            });
        }

        return NextResponse.json({ connected: false });
    } catch (error) {
        console.error('Error checking Strava status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
