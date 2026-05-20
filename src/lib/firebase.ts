/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore,
  collection, 
  query, 
  getDocs, 
  where, 
  limit, 
  orderBy, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp, 
  getDoc,
  writeBatch,
  Timestamp,
  type CollectionReference,
  type DocumentReference,
  type Query,
  type WriteBatch
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDrVS9_2hZmqSf5AtaOr76iFKduFc9jxNI",
  authDomain: "itcentersterida2026.firebaseapp.com",
  projectId: "itcentersterida2026",
  storageBucket: "itcentersterida2026.firebasestorage.app",
  messagingSenderId: "211035540305",
  appId: "1:211035540305:web:c8f938a7cac01a05bca170",
  measurementId: "G-H2F14VBKTV"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export { 
  collection, 
  query, 
  getDocs, 
  where, 
  limit, 
  orderBy, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp, 
  getDoc,
  writeBatch,
  Timestamp
};
export const googleProvider = new GoogleAuthProvider();

export type { 
  CollectionReference, 
  DocumentReference, 
  Query, 
  WriteBatch 
};

// Initialize analytics safely
let analytics = null;
import('firebase/analytics').then(({ getAnalytics, isSupported }) => {
  isSupported().then(supported => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}).catch(err => {
  console.log('Firebase Analytics load deferred or not supported:', err);
});

export { analytics };

