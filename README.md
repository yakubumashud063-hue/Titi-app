# Titi Family Chat

This repository contains the codebase to turn the Titi HTML prototype into a real cross-platform application.

## Web Application (`/web` and `/backend`)
Provides the desktop/browser experience of Titi Family Chat.

## Mobile Application (`/mobile`)
Built using React Native and Expo.

### Getting Started with Mobile

1. Make sure you have Node.js installed.
2. Navigate to the mobile directory:
   ```bash
   cd titi-app/mobile
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Configure Firebase:
   - Go to `src/firebase-config.js` and add your Firebase credentials.
5. Configure Video Calling:
   - Go to `src/services/zegocloud.js` and add your ZEGOCLOUD `appID` and `appSign`.
6. Start the app:
   ```bash
   npm start
   ```

### Features Implemented
- Real-time Chat with Firebase Firestore
- `react-native-gifted-chat` integration
- ZEGOCLOUD Video Call SDK integration
- Family Members list/Admin controls skeleton
- Navigation with React Navigation (Tabs + Stack)
# Titi
