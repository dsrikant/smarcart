# SmartCart — Local Dev Setup

## Prerequisites

### Node.js
- **Required:** Node.js 20.x LTS (`engines.node >= 20.0.0` enforced in `package.json`)
- Install via [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20`
- Verify: `node --version` → `v20.x.x`

### Android Studio
- **Required version:** Android Studio Hedgehog (2023.1.1) or newer
- Required SDK tools:
  - Android SDK Platform 34 (compileSdkVersion)
  - Android SDK Build-Tools 34.x
  - Android Emulator (API 26+ image — Pixel 6 recommended)
  - Android SDK Platform-Tools (adb)
- Set `ANDROID_HOME` in your shell profile:
  ```bash
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=$PATH:$ANDROID_HOME/emulator
  export PATH=$PATH:$ANDROID_HOME/platform-tools
  ```

### EAS CLI (for builds)
```bash
npm install -g eas-cli
eas login          # authenticate with your Expo account
```

---

## Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Run Expo prebuild (required — WatermelonDB is a native module)
#    This generates /android and /ios native project directories
npm run prebuild
# or directly:
expo prebuild --platform android --clean
```

> **Important:** `expo prebuild` must be run any time you add or update a native module,
> change `app.json` plugins, or update the Expo SDK version.

---

## Running the App

### On a physical device (recommended for Phase 1)
expo-secure-store requires Android Keystore which is **not available in Expo Go**.
You must run a development build:

```bash
# Build and install a debug APK on a connected device/emulator
npx expo run:android

# Or start the JS bundler and attach to an existing build
npx expo start --dev-client
```

### On an emulator
Ensure you have an AVD with **API 26+** running, then:
```bash
npx expo run:android
```

### Why not Expo Go?
- `expo-secure-store` requires Android Keystore — not available in Expo Go sandbox
- WatermelonDB requires native SQLite bindings not included in Expo Go

---

## EAS Build (cloud build — recommended for distribution)

```bash
# Development build (installs on device, includes dev menu)
eas build --profile development --platform android

# Preview build (production-like APK, no dev menu)
eas build --profile preview --platform android
```

See `eas.json` for profile definitions.

---

## Running Tests

```bash
# Unit tests (Jest + React Native Testing Library)
npm test

# Watch mode
npm run test:watch
```

Tests live in `__tests__/` or co-located `*.test.ts(x)` files.

---

## Environment Variables

No `.env` file is needed for Phase 1 — all secrets are stored at runtime via
`expo-secure-store` (Android Keystore). No build-time secrets required.

For Phase 2+ EAS builds, you will add secrets via:
```bash
eas secret:create --scope project --name MY_SECRET --value "value"
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `expo-secure-store` returns null | Run on physical device or API 26+ emulator, not Expo Go |
| WatermelonDB import error | Re-run `expo prebuild --platform android --clean` |
| Metro bundler cache issue | `npx expo start --clear` |
| Gradle build failure | Check Android Studio SDK tools are installed; run `cd android && ./gradlew clean` |
| NativeWind styles not applied | Ensure `import '../global.css'` is in `app/_layout.tsx` and metro.config.js uses `withNativeWind` |
