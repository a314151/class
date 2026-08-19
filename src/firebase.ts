import { deleteApp, initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  deleteUser,
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { getStudentAuthEmail } from './authConfig';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Some mobile carriers and in-app browsers buffer Firestore's streaming transport
// indefinitely. Long polling trades a little throughput for predictable responses
// on coarse-pointer mobile devices while desktop clients keep the default transport.
const shouldUseMobileLongPolling = typeof window !== 'undefined'
  && window.matchMedia('(pointer: coarse)').matches;

export const db = initializeFirestore(
  app,
  shouldUseMobileLongPolling ? { experimentalForceLongPolling: true } : {},
  firebaseConfig.firestoreDatabaseId || undefined
);

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
  deleteUser,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
};
