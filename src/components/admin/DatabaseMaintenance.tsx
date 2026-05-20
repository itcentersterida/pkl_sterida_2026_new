import React, { useState } from 'react';
import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  where,
  writeBatch,
  db
} from '../../lib/firebase';
import { Database, AlertTriangle, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const DatabaseMaintenance: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const [confirmText, setConfirmText] = useState('');

  const collectionsToDelete = ['attendance', 'journals', 'assignments', 'locations'];

  const handleResetDatabase = async () => {
    if (confirmText !== 'RESET DATABASE') {
      alert('Silakan ketik "RESET DATABASE" untuk konfirmasi.');
      return;
    }

    setLoading(true);
    setStatus({ type: 'idle', message: 'Memulai pembersihan database...' });

    try {
      // 1. Delete specified collections
      for (const colName of collectionsToDelete) {
        setStatus({ type: 'idle', message: `Menghapus koleksi: ${colName}...` });
        const snapshot = await getDocs(collection(db, colName));
        const chunks = [];
        const docs = snapshot.docs;
        
        // Firestore batches have a limit of 500 operations
        for (let i = 0; i < docs.length; i += 500) {
          chunks.push(docs.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }

      // 2. Delete non-admin users
      setStatus({ type: 'idle', message: 'Membersihkan data user non-admin...' });
      const usersQuery = query(collection(db, 'users'), where('role', '!=', 'admin'));
      const usersSnap = await getDocs(usersQuery);
      
      const userChunks = [];
      const userDocs = usersSnap.docs;
      for (let i = 0; i < userDocs.length; i += 500) {
        userChunks.push(userDocs.slice(i, i + 500));
      }

      for (const chunk of userChunks) {
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      setStatus({ type: 'success', message: 'Database berhasil dikosongkan. Hanya akun Admin yang tersisa.' });
      setConfirmText('');
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Terjadi kesalahan saat membersihkan database.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pemeliharaan Database</h1>
          <p className="text-slate-500">Alat bantu untuk mengelola dan membersihkan data sistem.</p>
        </div>
        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
          <Database className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 space-y-6">
        <div className="flex gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-red-900">Reset Seluruh Data</h3>
            <p className="text-red-700 text-sm leading-relaxed">
              Tindakan ini akan menghapus <strong>SEMUA</strong> data dalam sistem termasuk:
              Absensi, Jurnal, Penugasan, Lokasi, dan semua akun User (Siswa/Pembimbing). 
              Hanya akun Admin yang sedang login yang akan tetap dipertahankan.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-red-100 rounded-xl p-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Ketik <span className="font-bold text-red-600 underline">RESET DATABASE</span> untuk konfirmasi:
            </label>
            <input 
              type="text" 
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESET DATABASE"
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all uppercase"
            />
          </div>

          <button
            onClick={handleResetDatabase}
            disabled={loading || confirmText !== 'RESET DATABASE'}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 disabled:opacity-50 disabled:grayscale transition-all"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
            Reset Database & Hapus Semua Data
          </button>

          {status.type !== 'idle' && (
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${
              status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
            }`}>
              {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              <p className="text-sm font-medium">{status.message}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-slate-400" />
          Informasi Status
        </h3>
        <ul className="space-y-4">
          {collectionsToDelete.map(col => (
            <li key={col} className="flex items-center justify-between text-sm">
              <span className="text-slate-600 capitalize">{col}</span>
              <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-mono">Will be cleared</span>
            </li>
          ))}
          <li className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Users (Non-Admin)</span>
            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-mono">Will be cleared</span>
          </li>
          <li className="flex items-center justify-between text-sm border-t border-slate-100 pt-4">
            <span className="font-bold text-emerald-600">Admin Account</span>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-mono">PROTECTED</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default DatabaseMaintenance;
