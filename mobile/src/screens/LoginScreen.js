import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../services/firebase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID', // from Firebase
});

const handleGoogleSignIn = async () => {
  try {
    await GoogleSignin.hasPlayServices();
    const userInfo = await GoogleSignin.signIn();
    const googleCredential = GoogleAuthProvider.credential(userInfo.idToken);
    await signInWithCredential(auth, googleCredential);
  } catch (error) {
    console.error(error);
  }
};

const handleEmailLogin = async (email, password) => {
  await signInWithEmailAndPassword(auth, email, password);
};