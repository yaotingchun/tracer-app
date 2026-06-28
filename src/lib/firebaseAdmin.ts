// src/lib/firebaseAdmin.ts
// Server-side Firebase Admin SDK — only import in API routes / Server Components
import { getApps, initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../../credentials/google.json';

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount as ServiceAccount),
    databaseURL: 'https://advisoralliancegroup-default-rtdb.firebaseio.com',
  });
}

export const adminDb = getFirestore();

