# Street Player iOS Native Walk App

## Summary

Street Player now has a native iOS v1 implementation plan and starter implementation focused on reliable walk recording. The web app remains the primary public app and backend host. The iOS app records walks with Core Location, keeps recording state locally, shows the route on a MapLibre map, estimates newly captured grid squares locally, and syncs completed walks to authenticated Next.js API routes.

## iOS Scope

- Minimum target: iOS 17.
- UI: one map-first SwiftUI screen with sheets for history and settings.
- Recording: Core Location with background updates, high accuracy, no automatic pause, foreground idle-timer disable, and Live Activity status.
- Offline: active and completed walks are persisted locally until sync succeeds.
- Auth: Firebase Auth through Apple, Google, and email/password.
- Excluded from v1: native Strava OAuth and native GPX import.

## Server Contract

- `GET /api/mobile/bootstrap`
  - Requires `Authorization: Bearer <Firebase ID token>`.
  - Returns user progress, grid version, grid file manifest, supported districts, road types, and app config.
- `GET /api/mobile/walks`
  - Returns the latest server-confirmed walk summaries for the signed-in user.
- `POST /api/mobile/walks`
  - Accepts `clientWalkId`, `startedAt`, `endedAt`, GPS `points`, tentative square IDs, and device metadata.
  - Recomputes captured squares server-side using a 3 meter route buffer.
  - Updates `users/{uid}.capturedSquares`.
  - Stores a walk summary under `users/{uid}/walks/{walkId}` and GPS points under `point_chunks`.
  - Is idempotent by `clientWalkId`.
- `GET /api/mobile/walks/:id`
  - Returns one walk summary with full chunked GPS points.

## Data Notes

`users/{uid}.capturedSquares` remains the compatibility source used by the existing web app. Full iOS route history is server-backed under the user document and written only by Admin SDK route handlers. Long GPS routes are chunked to avoid Firestore document size problems.

## Local Development

Generate the Xcode project from `ios/StreetPlayer/project.yml` with XcodeGen:

```bash
cd ios/StreetPlayer
xcodegen generate
open StreetPlayer.xcodeproj
```

Add a real `GoogleService-Info.plist` to `ios/StreetPlayer/StreetPlayer/Resources/` before running on device. The API base URL defaults to the `StreetPlayerAPIBaseURL` value in `Info.plist` and can be overridden from the app settings screen.
