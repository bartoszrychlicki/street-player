import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: App | undefined;

function getAdminApp() {
    if (!app) {
        if (getApps().length) {
            app = getApps()[0];
        } else {
            const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
                ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
                : undefined;

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
