import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Replace these with actual Firebase configuration later
const firebaseConfig = {
    apiKey: "AIzaSyC-qi1YtLTpQPvOULKMs-2v5nrSujgFLzg",
  authDomain: "titi-3a3b4.firebaseapp.com",
  projectId: "titi-3a3b4",
  storageBucket: "titi-3a3b4.firebasestorage.app",
  messagingSenderId: "436831475221",
  appId: "1:436831475221:web:38fc67d4dc45285155201c",
  measurementId: "G-JK172GEGKR"
};
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
