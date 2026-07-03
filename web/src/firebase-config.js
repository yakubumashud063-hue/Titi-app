// =============================================
// Firebase Configuration for Titi Family Chat
// =============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

const currentHost = window.location.hostname;
const firebaseHostingAuthDomain = /(^|\.)titi-3a3b4\.(firebaseapp\.com|web\.app)$/.test(currentHost)
  ? currentHost
  : "titi-3a3b4.firebaseapp.com";

// IMPORTANT: Replace with your Firebase config from Firebase Console
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC-qi1YtLTpQPvOULKMs-2v5nrSujgFLzg",
  authDomain: firebaseHostingAuthDomain,
  projectId: "titi-3a3b4",
  storageBucket: "titi-3a3b4.firebasestorage.app",
  messagingSenderId: "436831475221",
  appId: "1:436831475221:web:38fc67d4dc45285155201c",
  measurementId: "G-JK172GEGKR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google Auth
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Development: Connect to emulator (optional, comment out for production)
// connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
// connectFirestoreEmulator(db, 'localhost', 8080);
// connectStorageEmulator(storage, 'localhost', 9199);

console.log("✅ Firebase initialized successfully");
