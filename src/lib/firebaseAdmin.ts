import * as admin from "firebase-admin"
import type { ServiceAccount } from "firebase-admin"

if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
  throw new Error('Missing Firebase Admin credentials - check your .env.local file')
}

const cert: ServiceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(cert),
  })
}

export const firebaseAdmin = admin
export const db = admin.firestore()