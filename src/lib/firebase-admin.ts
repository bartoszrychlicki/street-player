import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: App | undefined;

function escapeControlCharactersInsideJsonStrings(value: string) {
    let result = '';
    let inString = false;
    let escaped = false;

    for (const char of value) {
        if (escaped) {
            result += char;
            escaped = false;
            continue;
        }

        if (char === '\\') {
            result += char;
            escaped = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            result += char;
            continue;
        }

        if (inString && char === '\n') {
            result += '\\n';
            continue;
        }

        if (inString && char === '\r') {
            result += '\\r';
            continue;
        }

        if (inString && char === '\t') {
            result += '\\t';
            continue;
        }

        result += char;
    }

    return result;
}

function parseServiceAccount() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) return undefined;

    try {
        return JSON.parse(raw);
    } catch {
        return JSON.parse(escapeControlCharactersInsideJsonStrings(raw));
    }
}

function getAdminApp() {
    if (!app) {
        if (getApps().length) {
            app = getApps()[0];
        } else {
            const serviceAccount = parseServiceAccount();

            if (serviceAccount) {
                app = initializeApp({
                    credential: cert(serviceAccount)
                });
            }
        }
    }
    return app;
}

export function getAdminAuth() {
    const app = getAdminApp();
    if (!app) throw new Error('Firebase Admin not initialized');
    return getAuth(app);
}

export function getAdminDb() {
    const app = getAdminApp();
    if (!app) throw new Error('Firebase Admin not initialized');
    return getFirestore(app);
}
