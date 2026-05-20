import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  auth, 
  db, 
  googleProvider, 
  doc, 
  onSnapshot, 
  setDoc, 
  serverTimestamp, 
  getDoc,
  deleteDoc,
  query,
  collection,
  where,
  getDocs,
  updateDoc
} from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string, role: 'admin' | 'supervisor' | 'student') => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAILS = ['itcentersterida@gmail.com', 'irfanpriyono68@guru.smk.belajar.id']; // Added current user email

const migrateUserCollections = async (oldId: string, newId: string) => {
  try {
    // 1. Move/Update assignments where studentId/supervisorId equals oldId
    const qAssignmentsStudent = query(
      collection(db, 'assignments'),
      where('studentId', '==', oldId)
    );
    const assignStudentSnap = await getDocs(qAssignmentsStudent);
    const updatePromises = assignStudentSnap.docs.map(item => 
      updateDoc(doc(db, 'assignments', item.id), { studentId: newId })
    );

    const qAssignmentsSupervisor = query(
      collection(db, 'assignments'),
      where('supervisorId', '==', oldId)
    );
    const assignSupervisorSnap = await getDocs(qAssignmentsSupervisor);
    const supervisorPromises = assignSupervisorSnap.docs.map(item => 
      updateDoc(doc(db, 'assignments', item.id), { supervisorId: newId })
    );

    // 2. Move/Update attendance
    const qAttendance = query(
      collection(db, 'attendance'),
      where('studentId', '==', oldId)
    );
    const attSnap = await getDocs(qAttendance);
    const attPromises = attSnap.docs.map(item => 
      updateDoc(doc(db, 'attendance', item.id), { studentId: newId })
    );

    // 3. Move/Update journals
    const qJournals = query(
      collection(db, 'journals'),
      where('studentId', '==', oldId)
    );
    const journalSnap = await getDocs(qJournals);
    const journalPromises = journalSnap.docs.map(item => 
      updateDoc(doc(db, 'journals', item.id), { studentId: newId })
    );

    await Promise.all([
      ...updatePromises,
      ...supervisorPromises,
      ...attPromises,
      ...journalPromises
    ]);
    console.log(`Successfully migrated linked collections from ${oldId} to ${newId}`);
  } catch (err) {
    console.error('Error in migrateUserCollections:', err);
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (authUser) {
        const userDocRef = doc(db, 'users', authUser.uid);
        
        // Use onSnapshot for real-time updates
        unsubscribeProfile = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
            setLoading(false);
          } else {
            // Profile doesn't exist by UID, check for email pre-registration
            if (authUser.email) {
              const emailDocRef = doc(db, 'users', authUser.email.toLowerCase());
              const emailDoc = await getDoc(emailDocRef);
              
              if (emailDoc.exists()) {
                console.log('Found pre-registered account, migrating to UID profile...');
                const data = emailDoc.data();
                const migratedProfile = {
                  ...data,
                  uid: authUser.uid,
                  updatedAt: serverTimestamp(),
                  photoURL: data.photoURL || authUser.photoURL || ''
                };
                await setDoc(userDocRef, migratedProfile);
                await deleteDoc(emailDocRef);
                await migrateUserCollections(authUser.email.toLowerCase(), authUser.uid);
                // The next snapshot on userDocRef will trigger the setProfile
                return;
              }
            }

            // Create default profile if absolutely nothing found
            const newProfile: UserProfile = {
              uid: authUser.uid,
              name: authUser.displayName || authUser.email?.split('@')[0] || 'User',
              email: authUser.email || '',
              role: ADMIN_EMAILS.includes(authUser.email || '') ? 'admin' : 'student',
              status: 'active',
              class: '',
              major: '',
              createdAt: serverTimestamp(),
              photoURL: authUser.photoURL || '',
            };
            await setDoc(userDocRef, newProfile);
            // The snapshot will handle setting the profile
          }
        }, (error) => {
          console.error("Profile sync error:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Email login failed', error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string, name: string, role: 'admin' | 'supervisor' | 'student') => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const authUser = userCredential.user;
      
      const userDocRef = doc(db, 'users', authUser.uid);
      const emailDocRef = doc(db, 'users', email.toLowerCase());
      const emailDoc = await getDoc(emailDocRef);

      if (emailDoc.exists()) {
        const data = emailDoc.data();
        const migratedProfile = {
          ...data,
          uid: authUser.uid,
          name: name || data.name,
          updatedAt: serverTimestamp(),
        };
        await setDoc(userDocRef, migratedProfile);
        await deleteDoc(emailDocRef);
        await migrateUserCollections(email.toLowerCase(), authUser.uid);
      } else {
        const newProfile: UserProfile = {
          uid: authUser.uid,
          name: name,
          email: email.toLowerCase(),
          role: role,
          status: 'active',
          class: '',
          major: '',
          createdAt: serverTimestamp(),
          photoURL: '',
        };
        await setDoc(userDocRef, newProfile);
      }
    } catch (error) {
      console.error('Email registration failed', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, loginWithEmail, registerWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
