# Street Player iOS

Native iOS v1 for reliable Street Player walk recording.

## Requirements

- Xcode 16 or newer
- iOS 17 deployment target
- XcodeGen
- Firebase iOS app configured for bundle id `com.bartoszrychlicki.streetplayer`
- Apple Sign in enabled for the app id
- Google sign-in URL scheme from `GoogleService-Info.plist`

## Generate the project

```bash
cd ios/StreetPlayer
xcodegen generate
open StreetPlayer.xcodeproj
```

The project uses Swift Package Manager dependencies for Firebase Auth/Core, Google Sign-In, and MapLibre.

For a reproducible CLI build, keep SwiftPM checkouts in a local ignored directory:

```bash
cd ios/StreetPlayer
xcodebuild -resolvePackageDependencies \
  -project StreetPlayer.xcodeproj \
  -scheme StreetPlayer \
  -clonedSourcePackagesDirPath .xcode-packages

xcodebuild \
  -project StreetPlayer.xcodeproj \
  -scheme StreetPlayer \
  -destination 'generic/platform=iOS Simulator' \
  -clonedSourcePackagesDirPath .xcode-packages \
  build
```

## Firebase setup

1. Add the iOS app in Firebase with bundle id `com.bartoszrychlicki.streetplayer`.
2. Download `GoogleService-Info.plist`.
3. Put it in `ios/StreetPlayer/StreetPlayer/Resources/GoogleService-Info.plist`.
4. Keep the example file committed, but do not commit the real Firebase plist if it contains project secrets you do not want in git.

## API setup

The bundled default API base URL is configured in `StreetPlayer/App/Info.plist` under `StreetPlayerAPIBaseURL`.

For local testing:

1. Run the web server with Firebase Admin credentials.
2. Open the iOS app Settings sheet.
3. Set the API base URL to your LAN-accessible Next.js server, for example `http://192.168.1.20:3000`.

## Device testing checklist

- Grant Always Location permission.
- Start a walk, lock the phone, and confirm GPS points keep arriving.
- Confirm Live Activity appears during an active walk.
- Finish a walk offline, relaunch the app, and confirm the pending walk remains.
- Restore network and sync the walk.
- Open the web app and confirm `capturedSquares` progress still reflects the synced walk.
