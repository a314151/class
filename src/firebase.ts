import { deleteApp, initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  getFirestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { getStudentAuthEmail } from './authConfig';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore with custom databaseId if configured
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId) 
  : getFirestore(app);

export const createManagedAuthUser = async (studentId: string, password: string) => {
  const secondaryApp = initializeApp(
    firebaseConfig,
    `member-provision-${Date.now()}-${crypto.randomUUID()}`
  );
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const email = getStudentAuthEmail(studentId);
    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      return credential.user;
    } catch (error) {
      if ((error as { code?: string }).code !== 'auth/email-already-in-use') throw error;
      const credential = await signInWithEmailAndPassword(secondaryAuth, email, password);
      return credential.user;
    }
  } finally {
    if (secondaryAuth.currentUser) {
      await signOut(secondaryAuth).catch(() => undefined);
    }
    await deleteApp(secondaryApp);
  }
};

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
};
