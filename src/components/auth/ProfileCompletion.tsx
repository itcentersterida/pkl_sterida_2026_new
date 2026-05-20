import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, doc, updateDoc } from '../../lib/firebase';
import { Loader2, GraduationCap, School, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MAJORS = [
  'TPM',
  'TPL',
  'TKR',
  'TSM',
  'TBKR',
  'TAB',
  'TKJ',
  'RPL',
  'DKV'
];

const ProfileCompletion: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    class: '',
    major: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.class || !formData.major) return;

    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        name: formData.name,
        class: formData.class,
        major: formData.major,
      });
      setSuccess(true);
      // The modal will disappear automatically via Layout.tsx because profile state updates via onSnapshot
    } catch (error) {
      console.error('Error updating profile:', error);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.div 
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-8"
            >
              <div className="w-12 h-12 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary mb-6">
                <GraduationCap className="w-6 h-6" />
              </div>
              
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Lengkapi Profil</h2>
              <p className="text-slate-500 mb-8">Silakan lengkapi data diri Anda untuk melanjutkan ke Dashboard.</p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Kelas</label>
                    <input
                      type="text"
                      required
                      value={formData.class}
                      onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none"
                      placeholder="Contoh: XII"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Jurusan</label>
                    <select
                      required
                      value={formData.major}
                      onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none appearance-none"
                    >
                      <option value="">Pilih Jurusan</option>
                      {MAJORS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-brand-primary text-white rounded-xl font-semibold shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan & Lanjutkan'
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 text-center"
            >
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Data Tersimpan!</h2>
              <p className="text-slate-500">Profil Anda telah diperbarui. Mengalihkan ke Dashboard...</p>
            </motion.div>
          )}
        </AnimatePresence>
        
        {!success && (
          <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center gap-3">
            <School className="w-5 h-5 text-slate-400" />
            <p className="text-xs text-slate-500">Data ini akan digunakan untuk laporan jurnal magang SMKS PGRI 2 Ponorogo.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ProfileCompletion;
