import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const clientId = process.env.STRAVA_CLIENT_ID;

    // Get the origin from the request headers
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'http://localhost:3000';
    const redirectUri = `${origin}/strava-callback`;

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
