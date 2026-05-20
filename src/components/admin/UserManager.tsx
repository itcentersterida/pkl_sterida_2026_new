import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  UserPlus, 
  UserCheck, 
  X,
  User as UserIcon,
  ShieldCheck,
  Edit2
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc, 
  query, 
  where,
  addDoc,
  serverTimestamp,
  setDoc,
  db
} from '../../lib/firebase';
import { UserProfile, UserRole } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

const UserManager: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<UserRole | 'all'>('all');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UserProfile | null>(null);
  
  // Get current logged in user to prevent self-deletion
  const { profile: currentUserProfile } = useAuth();
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [studentClass, setStudentClass] = useState('');
  const [studentMajor, setStudentMajor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Assignment data for student list
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, any>>({});
  const [locationsMap, setLocationsMap] = useState<Record<string, any>>({});
  const [supervisorsMap, setSupervisorsMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUsers();
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const [assignSnap, locSnap, userSnap] = await Promise.all([
        getDocs(collection(db, 'assignments')),
        getDocs(collection(db, 'locations')),
        getDocs(query(collection(db, 'users'), where('role', '==', 'supervisor')))
      ]);

      const lMap = locSnap.docs.reduce((acc, d) => ({ ...acc, [d.id]: d.data().name }), {});
      const sMap = userSnap.docs.reduce((acc, d) => ({ ...acc, [d.id]: d.data().name }), {});
      const aMap = assignSnap.docs.reduce((acc, d) => {
        const data = d.data();
        return { ...acc, [data.studentId]: data };
      }, {});

      setAllAssignments(assignSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLocationsMap(lMap);
      setSupervisorsMap(sMap);
      setAssignmentsMap(aMap);
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const fetchedUsers = snap.docs.map(d => {
        const data = d.data();
        return { 
          ...data,
          uid: d.id 
        } as UserProfile;
      });
      console.log('Fetched users:', fetchedUsers);
      setUsers(fetchedUsers);
    } catch (err) {
      console.error(err);
      alert('Gagal mengambil data pengguna');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
        if (editingUser) {
          // Update
          const userDocRef = doc(db, 'users', editingUser.uid);
          await setDoc(userDocRef, {
            name,
            email,
            role,
            class: role === 'student' ? studentClass : '',
            major: role === 'student' ? studentMajor : '',
            updatedAt: serverTimestamp(),
          }, { merge: true });
          alert('Berhasil memperbarui pengguna');
        } else {
          // Create - Use email as document ID for pre-registration linking
          const userDocRef = doc(db, 'users', email.toLowerCase());
          const newProfile: UserProfile = {
            uid: email.toLowerCase(), // Use email temporarily as UID
            name,
            email: email.toLowerCase(),
            role,
            class: role === 'student' ? studentClass : '',
            major: role === 'student' ? studentMajor : '',
            status: 'active',
            createdAt: serverTimestamp(),
          };
          await setDoc(userDocRef, newProfile);
          alert('Berhasil mendaftarkan pengguna');
        }
      
      setShowModal(false);
      resetForm();
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan data: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setStudentClass(user.class || '');
    setStudentMajor(user.major || '');
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    const uid = deleteConfirm.uid;
    console.log('Finalizing deletion for UID:', uid);
    
    if (uid === currentUserProfile?.uid) {
      alert('Anda tidak dapat menghapus akun Anda sendiri.');
      setDeleteConfirm(null);
      return;
    }

    setSubmitting(true);
    try {
      const userDocRef = doc(db, 'users', uid);
      await deleteDoc(userDocRef);
      console.log('User deleted successfully:', uid);
      alert('User berhasil dihapus');
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert('Gagal menghapus user: ' + errorMessage);
    } finally {
      setSubmitting(false);
      setDeleteConfirm(null);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setRole('student');
    setStudentClass('');
    setStudentMajor('');
    setEditingUser(null);
  };

  const filteredUsers = filter === 'all' ? users : users.filter(u => u.role === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola Pengguna</h1>
          <p className="text-slate-500">Daftar siswa, guru pembimbing, dan administrator.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:brightness-110 transition-all"
        >
          <UserPlus className="w-5 h-5" /> Daftarkan User
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['all', 'admin', 'supervisor', 'student'].map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r as any)}
            className={cn(
              "px-4 py-2 text-sm font-bold rounded-xl transition-all border capitalize",
              filter === r 
                ? "bg-slate-900 text-white border-slate-900" 
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {r === 'all' ? 'Semua' : r}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Detail User</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Detail Kelas</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Penugasan Lokasi</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 animate-pulse">
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    Tidak ada pengguna ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const assignment = assignmentsMap[user.uid] || (user.email ? assignmentsMap[user.email.toLowerCase()] : null);
                  const locationName = assignment ? locationsMap[assignment.locationId] : null;
                  const supervisorName = assignment ? supervisorsMap[assignment.supervisorId] : null;

                  // Get assigned locations for supervisor
                  const isSupervisor = user.role === 'supervisor';
                  let supervisorLocations: string[] = [];
                  if (isSupervisor) {
                    const assignedLocationIds = allAssignments
                      .filter(a => a.supervisorId === user.uid || (user.email && a.supervisorId === user.email.toLowerCase()))
                      .map(a => a.locationId);
                    const uniqueLocIds = [...new Set(assignedLocationIds)];
                    supervisorLocations = uniqueLocIds
                      .map(lid => locationsMap[lid])
                      .filter((name): name is string => typeof name === 'string' && name !== '');
                  }

                  return (
                    <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white shadow-sm shrink-0">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <UserIcon className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                              <span className={cn(
                                "px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter rounded border leading-none",
                                user.role === 'admin' ? "bg-red-50 text-red-600 border-red-100" :
                                user.role === 'supervisor' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                "bg-emerald-50 text-emerald-600 border-emerald-100"
                              )}>
                                {user.role}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono italic truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {user.role === 'student' ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {user.class && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md">Kelas: {user.class}</span>}
                              {user.major && <span className="px-2 py-0.5 bg-violet-50 text-violet-600 text-[10px] font-bold rounded-md">Jurusan: {user.major}</span>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Bukan Siswa</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {user.role === 'student' ? (
                          <div className="space-y-1">
                            {locationName ? (
                              <>
                                <p className="text-xs font-bold text-slate-700 leading-tight">📍 {locationName}</p>
                                <p className="text-[10px] text-slate-400">👤 Pembimbing: {supervisorName || 'Belum dipilih'}</p>
                              </>
                            ) : (
                              <span className="text-[10px] text-amber-500 font-medium italic">Belum ditugaskan</span>
                            )}
                          </div>
                        ) : user.role === 'supervisor' ? (
                          <div className="space-y-1">
                            {supervisorLocations.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lokasi Binaan:</span>
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {supervisorLocations.map((loc, idx) => (
                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md border border-indigo-100">
                                      {loc}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] text-amber-500 font-medium italic">Belum dibebani lokasi</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleEdit(user)}
                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-white border border-slate-200 rounded-lg shadow-sm"
                            title="Edit User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirm(user)}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-white border border-slate-200 rounded-lg shadow-sm"
                            title="Hapus User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Konfirmasi Hapus</h3>
                <p className="text-slate-500">
                  Anda yakin ingin menghapus <span className="font-bold text-slate-900">{deleteConfirm.name}</span>? 
                  Tindakan ini tidak dapat dibatalkan.
                </p>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  disabled={submitting}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    {editingUser ? (
                      <Edit2 className="w-5 h-5 text-indigo-600" />
                    ) : (
                      <UserPlus className="w-5 h-5 text-indigo-600" />
                    )}
                    {editingUser ? 'Edit Pengguna' : 'Daftarkan Pengguna'}
                  </h3>
                  <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Lengkap</label>
                    <input 
                      value={name} 
                      onChange={e => setName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/10 outline-none"
                      required 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email (Akun Google)</label>
                    <input 
                      type="email"
                      value={email} 
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/10 outline-none"
                      required 
                    />
                  </div>

                  {role === 'student' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kelas</label>
                        <input 
                          value={studentClass} 
                          onChange={e => setStudentClass(e.target.value)}
                          placeholder="Contoh: XII RPL 1"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/10 outline-none"
                          required={role === 'student'} 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jurusan</label>
                        <input 
                          value={studentMajor} 
                          onChange={e => setStudentMajor(e.target.value)}
                          placeholder="Contoh: PPLG"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600/10 outline-none"
                          required={role === 'student'} 
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Peran Pengguna</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['student', 'supervisor', 'admin'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r as any)}
                          className={cn(
                            "py-2.5 text-xs font-bold rounded-xl border transition-all capitalize",
                            role === r ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 italic">
                    Catatan: User yang didaftarkan harus masuk menggunakan email yang sesuai agar profil terhubung secara otomatis.
                  </div>

                  <button 
                    disabled={submitting}
                    className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 mt-4 h-14"
                  >
                    {submitting ? 'Memproses...' : (editingUser ? 'Simpan Perubahan' : 'Konfirmasi Pendaftaran')}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManager;
