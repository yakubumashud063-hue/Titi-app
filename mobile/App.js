import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC-qi1YtLTpQPvOULKMs-2v5nrSujgFLzg",
  authDomain: "titi-3a3b4.firebaseapp.com",
  projectId: "titi-3a3b4",
  storageBucket: "titi-3a3b4.firebasestorage.app",
  messagingSenderId: "436831475221",
  appId: "1:436831475221:web:38fc67d4dc45285155201c",
  measurementId: "G-JK172GEGKR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
// App.js or AuthScreen
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const signIn = async () => {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
};