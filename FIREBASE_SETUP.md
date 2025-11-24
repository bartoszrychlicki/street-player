# Firebase Setup Instructions

## Problem
The app is showing "Failed to get document because the client is offline" error when trying to upload GPX files.

## Solution
You need to configure Firestore Security Rules in the Firebase Console.

### Steps:

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `street-player-8f78f`
3. **Navigate to Firestore Database**:
   - Click on "Firestore Database" in the left sidebar
   - If you haven't created a database yet, click "Create database"
     - Choose "Start in production mode" (we'll add rules next)
     - Select a location (europe-west3 is closest to Poland)
4. **Set Security Rules**:
   - Click on the "Rules" tab
   - Replace the existing rules with:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

5. **Publish the rules**: Click "Publish"

### Verify Setup:

After setting up the rules, try uploading a GPX file again. The error should be gone and your progress should be saved to Firestore.

### For Vercel Deployment:

Don't forget to add the Firebase environment variables in Vercel:
- Go to your project settings in Vercel
- Navigate to "Environment Variables"
- Add all variables from `.env.local`:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
- Redeploy the app
