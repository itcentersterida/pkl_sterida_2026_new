/**
 * Mock Firestore Implementation
 * Operates on standard browser localStorage instead of live Cloud Firestore.
 */

console.log('Firebase Mock Firestore loaded');

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach(l => {
    try {
      l();
    } catch (e) {
      console.error('onSnapshot notify error', e);
    }
  });
}

interface LocalDB {
  [path: string]: any;
}

function getLocalDB(): LocalDB {
  try {
    const raw = localStorage.getItem('intern_log_db');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Error loading localStorage mock DB:', e);
    return {};
  }
}

function saveLocalDB(db: LocalDB) {
  try {
    localStorage.setItem('intern_log_db', JSON.stringify(db));
    notifyListeners();
  } catch (e) {
    console.error('Error saving localStorage mock DB:', e);
  }
}

export class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now() {
    const now = new Date();
    return new Timestamp(Math.floor(now.getTime() / 1000), (now.getTime() % 1000) * 1e6);
  }

  static fromDate(date: Date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1e6);
  }

  toDate() {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
  }

  toISOString() {
    return this.toDate().toISOString();
  }

  valueOf() {
    return this.seconds * 1000 + this.nanoseconds / 1e6;
  }
}

export function serverTimestamp() {
  return Timestamp.now();
}

// Seed initial values if empty
const INITIAL_LOCATIONS = [
  {
    id: 'loc1',
    name: 'SMKS PGRI 2 Ponorogo',
    address: 'Jl. Soekarno Hatta No.21, Ponorogo',
    latitude: -7.8667,
    longitude: 111.4667,
    radius: 100,
    supervisorIds: ['sup1'],
    createdAt: serverTimestamp()
  },
  {
    id: 'loc2',
    name: 'PT Jasa Prima Solusi',
    address: 'Jl. Diponegoro No.10, Ponorogo',
    latitude: -7.8701,
    longitude: 111.4623,
    radius: 150,
    supervisorIds: ['sup1'],
    createdAt: serverTimestamp()
  }
];

const INITIAL_USERS = [
  {
    uid: 'sup1',
    name: 'Bp. Irfan Priyono, S.Pd',
    email: 'irfanpriyono68@guru.smk.belajar.id',
    role: 'supervisor',
    status: 'active',
    createdAt: serverTimestamp()
  },
  {
    uid: 'admin1',
    name: 'Administrator',
    email: 'itcentersterida@gmail.com',
    role: 'admin',
    status: 'active',
    createdAt: serverTimestamp()
  }
];

if (!localStorage.getItem('intern_log_db')) {
  const initialDB: LocalDB = {};
  INITIAL_LOCATIONS.forEach(loc => {
    initialDB[`locations/${loc.id}`] = loc;
  });
  INITIAL_USERS.forEach(user => {
    initialDB[`users/${user.uid}`] = user;
  });
  localStorage.setItem('intern_log_db', JSON.stringify(initialDB));
}

export function getFirestore(app?: any, databaseId?: string) {
  return { type: 'firestore', databaseId };
}

export function collection(db: any, collectionPath: string) {
  return { type: 'collection', path: collectionPath };
}

export function doc(dbOrCol: any, ...paths: string[]) {
  let fullPath = '';
  if (dbOrCol && dbOrCol.type === 'collection') {
    fullPath = dbOrCol.path + '/' + paths.join('/');
  } else {
    fullPath = paths.join('/');
  }
  
  const segments = fullPath.split('/');
  const collectionPath = segments.slice(0, -1).join('/');
  const docId = segments[segments.length - 1];
  
  return {
    type: 'doc',
    path: fullPath,
    collectionPath,
    id: docId
  };
}

export async function getDoc(docRef: any) {
  const db = getLocalDB();
  const data = db[docRef.path] || null;
  return {
    id: docRef.id,
    exists: () => data !== null,
    ref: docRef,
    data: () => data
  };
}

export async function getDocFromServer(docRef: any) {
  return getDoc(docRef);
}

export async function getDocFromCache(docRef: any) {
  return getDoc(docRef);
}

export async function setDoc(docRef: any, data: any, options?: any) {
  const db = getLocalDB();
  const existingDoc = db[docRef.path] || {};
  let updated;
  if (options && options.merge) {
    updated = { ...existingDoc, ...data };
  } else {
    updated = { ...data };
  }
  
  if (typeof updated === 'object' && updated !== null) {
    if (!updated.id && docRef.id) {
      updated.id = docRef.id;
    }
  }
  db[docRef.path] = updated;
  saveLocalDB(db);
}

export async function addDoc(colRef: any, data: any) {
  const db = getLocalDB();
  const id = Math.random().toString(36).substring(2, 15);
  const path = `${colRef.path}/${id}`;
  const docData = { ...data, id };
  db[path] = docData;
  saveLocalDB(db);
  return {
    type: 'doc',
    path,
    collectionPath: colRef.path,
    id
  };
}

export async function updateDoc(docRef: any, data: any) {
  const db = getLocalDB();
  if (db[docRef.path]) {
    db[docRef.path] = { ...db[docRef.path], ...data };
  } else {
    db[docRef.path] = data;
  }
  saveLocalDB(db);
}

export async function deleteDoc(docRef: any) {
  const db = getLocalDB();
  delete db[docRef.path];
  saveLocalDB(db);
}

export function query(colRef: any, ...constraints: any[]) {
  return {
    type: 'query',
    collectionPath: colRef.path,
    constraints
  };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function limit(v: number) {
  return { type: 'limit', value: v };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export async function getDocs(queryOrCol: any) {
  const collectionPath = queryOrCol.collectionPath || queryOrCol.path;
  const db = getLocalDB();
  
  let docs = Object.keys(db)
    .filter(k => k.startsWith(collectionPath + '/'))
    .map(k => db[k]);
    
  if (queryOrCol.constraints) {
    for (const constraint of queryOrCol.constraints) {
      if (!constraint) continue;
      
      if (constraint.type === 'where') {
        const { field, op, value } = constraint;
        docs = docs.filter(doc => {
          if (!doc) return false;
          const docVal = doc[field];
          if (op === '==') return docVal === value;
          if (op === '!=') return docVal !== value;
          if (op === '>=') return docVal >= value;
          if (op === '<=') return docVal <= value;
          if (op === '>') return docVal > value;
          if (op === '<') return docVal < value;
          if (op === 'array-contains') {
            return Array.isArray(docVal) && docVal.includes(value);
          }
          if (op === 'in') {
            return Array.isArray(value) && value.includes(docVal);
          }
          return true;
        });
      } else if (constraint.type === 'orderBy') {
        const { field, direction } = constraint;
        docs.sort((a, b) => {
          if (!a || !b) return 0;
          let valA = a[field];
          let valB = b[field];
          if (valA && typeof valA.valueOf === 'function') valA = valA.valueOf();
          if (valB && typeof valB.valueOf === 'function') valB = valB.valueOf();
          
          if (valA === undefined && valB === undefined) return 0;
          if (valA === undefined) return 1;
          if (valB === undefined) return -1;
          if (valA < valB) return direction === 'asc' ? -1 : 1;
          if (valA > valB) return direction === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }
    
    const limitConstraint = queryOrCol.constraints.find((c: any) => c && c.type === 'limit');
    if (limitConstraint) {
      docs = docs.slice(0, limitConstraint.value);
    }
  }
  
  const allDocs = docs.map(doc => {
    const docId = doc.id || doc.uid || '';
    return {
      id: docId,
      exists: () => true,
      ref: {
        type: 'doc',
        path: `${collectionPath}/${docId}`,
        collectionPath,
        id: docId
      },
      data: () => doc
    };
  });

  return {
    empty: allDocs.length === 0,
    size: allDocs.length,
    docs: allDocs,
    forEach: (callback: (doc: any) => void) => {
      allDocs.forEach(callback);
    }
  };
}

export type CollectionReference = any;
export type DocumentReference = any;
export type Query = any;
export type WriteBatch = any;

export function onSnapshot(ref: any, onNext: (snapshot: any) => void, onError?: (error: any) => void) {
  const handler = async () => {
    try {
      if (ref.type === 'doc') {
        const snap = await getDoc(ref);
        onNext(snap);
      } else {
        const snap = await getDocs(ref);
        onNext(snap);
      }
    } catch (e) {
      if (onError) onError(e);
    }
  };
  
  listeners.add(handler);
  handler();
  
  return () => {
    listeners.delete(handler);
  };
}

export function writeBatch(db: any) {
  const operations: (() => void)[] = [];
  return {
    set: (docRef: any, data: any) => {
      operations.push(() => {
        const localDB = getLocalDB();
        localDB[docRef.path] = data;
        saveLocalDB(localDB);
      });
    },
    update: (docRef: any, data: any) => {
      operations.push(() => {
        const localDB = getLocalDB();
        localDB[docRef.path] = { ...localDB[docRef.path], ...data };
        saveLocalDB(localDB);
      });
    },
    delete: (docRef: any) => {
      operations.push(() => {
        const localDB = getLocalDB();
        delete localDB[docRef.path];
        saveLocalDB(localDB);
      });
    },
    commit: async () => {
      operations.forEach(op => op());
      notifyListeners();
    }
  };
}
