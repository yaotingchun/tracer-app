// src/lib/firebase.ts
// Client-side Firebase singleton — safe to import in Client Components
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../credentials/firebase';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db  = getFirestore(app);
export default app;
