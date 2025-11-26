import { NextResponse } from 'next/server';

export async function GET() {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/strava-callback`;

    if (!clientId) {
        return NextResponse.json({ error: 'Strava Client ID not configured' }, { status: 500 });
    }

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        approval_prompt: 'force',
        scope: 'activity:read_all',
    });

    return NextResponse.json({ url: `https://www.strava.com/oauth/authorize?${params.toString()}` });
}
