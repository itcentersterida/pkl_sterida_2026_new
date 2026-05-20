import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Trash2, 
  Edit2,
  X, 
  Loader2,
  Calendar,
  MapPin,
  User,
  Shield
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  doc, 
  deleteDoc, 
  addDoc, 
  updateDoc,
  query, 
  where,
  serverTimestamp,
  db,
  auth
} from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error Details:', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}

const AssignmentManager: React.FC = () => {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [detailAssignment, setDetailAssignment] = useState<any>(null);
  
  // Form State
  const [studentId, setStudentId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    console.log('AssignmentManager loaded. Current profile:', profile);
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignSnap, userSnap, locSnap] = await Promise.all([
        getDocs(collection(db, 'assignments')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'locations'))
      ]);

      const allUsers = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allLocations = locSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setStudents(allUsers.filter((u: any) => u.role === 'student'));
      setSupervisors(allUsers.filter((u: any) => u.role === 'supervisor'));
      setLocations(allLocations);
      
      setAssignments(assignSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          student: allUsers.find((u: any) => u.uid === data.studentId),
          supervisor: allUsers.find((u: any) => u.uid === data.supervisorId),
          location: allLocations.find((l: any) => l.id === data.locationId)
        };
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !locationId || !supervisorId) {
      alert('Harap lengkapi semua data');
      return;
    }
    
    setSubmitting(true);
    try {
      const payload = {
        studentId,
        locationId,
        supervisorId,
        updatedAt: serverTimestamp(),
      };

      if (editingAssignment) {
        console.log('Updating assignment:', editingAssignment.id, payload);
        await updateDoc(doc(db, 'assignments', editingAssignment.id), payload);
        alert('Penugasan berhasil diperbarui');
      } else {
        console.log('Creating new assignment:', payload);
        await addDoc(collection(db, 'assignments'), {
          ...payload,
          status: 'active',
          startDate: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
        alert('Penugasan berhasil dibuat');
      }
      
      closeModal();
      await fetchData();
    } catch (err) {
      console.error('Error in handleSave:', err);
      alert('Terjadi kesalahan: ' + (err instanceof Error ? err.message : 'Gagal menyimpan data'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (assign: any) => {
    setEditingAssignment(assign);
    setStudentId(assign.studentId);
    setLocationId(assign.locationId || '');
    setSupervisorId(assign.supervisorId || '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAssignment(null);
    setStudentId('');
    setLocationId('');
    setSupervisorId('');
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    
    setSubmitting(true);
    try {
      console.log('Attempting to delete assignment:', confirmDeleteId);
      const docRef = doc(db, 'assignments', confirmDeleteId);
      await deleteDoc(docRef);
      console.log('Assignment successfully deleted from Firestore');
      alert('Penugasan berhasil dihapus');
      setConfirmDeleteId(null);
      await fetchData();
    } catch (err) {
      console.error('Error in handleDelete operation:', err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `assignments/${confirmDeleteId}`);
      } catch (wrappedErr: any) {
        let errorDetail = 'Gagal menghapus penugasan.';
        try {
          const parsed = JSON.parse(wrappedErr.message);
          if (parsed.error.includes('permission-denied')) {
            errorDetail = 'Akses ditolak. Anda tidak memiliki izin untuk menghapus penugasan ini.';
          } else {
            errorDetail = parsed.error;
          }
        } catch {
          errorDetail = wrappedErr.message;
        }
        alert(errorDetail);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Penugasan Magang</h1>
          <p className="text-slate-500">Atur penempatan siswa dan guru pembimbing.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:brightness-110 transition-all"
        >
          <Plus className="w-5 h-5" /> Buat Penugasan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))
        ) : assignments.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white border border-dashed border-slate-200 rounded-2xl">
            <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Belum ada penugasan aktif.</p>
          </div>
        ) : (
          assignments.map((assign) => (
            <div 
              key={assign.id} 
              className="group bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer"
              onClick={() => setDetailAssignment(assign)}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-brand-primary">
                  <User className="w-6 h-6" />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEdit(assign); }}
                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 rounded-lg"
                    title="Edit Penugasan"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(assign.id); }}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 rounded-lg"
                    title="Hapus Penugasan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Siswa</p>
                  <p className="text-sm font-bold text-slate-900">{assign.student?.name || '---'}</p>
                  {assign.student?.class && (
                    <p className="text-[10px] text-indigo-600 font-medium">
                      {assign.student.class} - {assign.student.major}
                    </p>
                  )}
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lokasi</p>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <MapPin className="w-3 h-3" />
                      {assign.location?.name || '---'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pembimbing</p>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <Shield className="w-3 h-3" />
                      {assign.supervisor?.name || '---'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

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
                    <ClipboardList className="w-5 h-5 text-indigo-600" /> 
                    {editingAssignment ? 'Edit Penugasan' : 'Buat Penugasan Baru'}
                  </h3>
                  <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Siswa</label>
                    <select 
                      value={studentId} 
                      onChange={e => setStudentId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      required
                    >
                      <option value="">Pilih Siswa...</option>
                      {students.map(s => <option key={s.uid} value={s.uid}>{s.name} ({s.email})</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Lokasi Magang</label>
                    <select 
                      value={locationId} 
                      onChange={e => setLocationId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      required
                    >
                      <option value="">Pilih Lokasi...</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pilih Guru Pembimbing</label>
                    <select 
                      value={supervisorId} 
                      onChange={e => setSupervisorId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                      required
                    >
                      <option value="">Pilih Guru...</option>
                      {supervisors.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
                    </select>
                  </div>

                  <button 
                    disabled={submitting}
                    className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 mt-4 h-14"
                  >
                    {submitting ? 'Memproses...' : editingAssignment ? 'Simpan Perubahan' : 'Buat Penugasan'}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Hapus Penugasan?</h3>
              <p className="text-slate-500 mb-8 text-sm">
                Tindakan ini tidak dapat dibatalkan. Semua data terkait penugasan ini akan dihapus permanen.
              </p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailAssignment && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
               onClick={() => setDetailAssignment(null)}>
            <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               onClick={(e) => e.stopPropagation()}
               className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 items-center">
                     <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
                       <User className="w-7 h-7" />
                     </div>
                     <div>
                       <h3 className="text-2xl font-bold text-slate-900">{detailAssignment.student?.name || 'Siswa Tidak Ditemukan'}</h3>
                       <p className="text-indigo-600 font-medium">Siswa Magang</p>
                     </div>
                  </div>
                  <button onClick={() => setDetailAssignment(null)} className="p-2 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Info Siswa */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold tracking-wider text-slate-400 uppercase">Informasi Siswa</h4>
                    <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Email</p>
                        <p className="text-sm font-semibold text-slate-900">{detailAssignment.student?.email || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Kelas</p>
                        <p className="text-sm font-semibold text-slate-900">{detailAssignment.student?.class || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Jurusan</p>
                        <p className="text-sm font-semibold text-slate-900">{detailAssignment.student?.major || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Info Lokasi & Pembimbing */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold tracking-wider text-slate-400 uppercase">Penempatan</h4>
                    <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                      <div className="flex gap-3">
                         <MapPin className="w-5 h-5 text-emerald-500 shrink-0" />
                         <div>
                            <p className="text-xs text-slate-500 mb-1">Lokasi Magang</p>
                            <p className="text-sm font-semibold text-slate-900">{detailAssignment.location?.name || '-'}</p>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{detailAssignment.location?.address || '-'}</p>
                         </div>
                      </div>
                      
                      <div className="h-px w-full bg-slate-200"></div>

                      <div className="flex gap-3">
                         <Shield className="w-5 h-5 text-blue-500 shrink-0" />
                         <div>
                            <p className="text-xs text-slate-500 mb-1">Guru Pembimbing</p>
                            <p className="text-sm font-semibold text-slate-900">{detailAssignment.supervisor?.name || '-'}</p>
                            <p className="text-xs text-slate-500 mt-1">{detailAssignment.supervisor?.email || '-'}</p>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-end">
                   <button 
                     onClick={() => setDetailAssignment(null)}
                     className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                   >
                     Tutup
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssignmentManager;
