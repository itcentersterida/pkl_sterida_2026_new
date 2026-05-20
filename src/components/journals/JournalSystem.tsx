import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Plus, 
  Send, 
  CheckCircle2, 
  Clock, 
  Image as ImageIcon, 
  X,
  FileText,
  Search,
  ChevronRight,
  UserCheck,
  Signature,
  Sparkles
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  orderBy,
  updateDoc,
  doc,
  getDoc
} from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { cn, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ImageModal from '../ui/ImageModal';
import { logActivity } from '../../lib/activityLogger';

const JournalSystem: React.FC = () => {
  const { profile, user } = useAuth();
  const [journals, setJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [assignment, setAssignment] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  
  // Form State
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // AI Assistant State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const handleAIAssistance = async () => {
    if (!content.trim()) {
      setAiError('Silakan tulis draf kegiatan harian Anda terlebih dahulu di kolom input sebelum menggunakan Bantuan AI.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      setAiError(
        'Asisten AI belum aktif karena konfigurasi API Key "GEMINI_API_KEY" kosong atau belum diset. Silakan daftarkan atau simpan GEMINI_API_KEY Anda di workspace melalui menu Settings > Secrets.'
      );
      setAiLoading(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Kamu adalah asisten penulisan laporan jurnal Praktek Kerja Lapangan (PKL) / Magang. Bantu merapikan draf kegiatan berikut agar terlihat lebih formal, profesional, runut, dan menggunakan bahasa Indonesia baku yang sesuai dengan laporan akademis/industri.

Draf awal siswa:
"${content}"

Berikan draf yang sudah dirapikan dengan gaya bahasa yang profesional dan sopan, lalu berikan list 2-3 poin saran singkat agar laporan magang mereka selanjutnya semakin baik. Pisahkan draf hasil perbaikan dan saran dengan jelas agar menarik dan mudah dibaca.`,
      });

      if (response && response.text) {
        setAiSuggestion(response.text);
      } else {
        setAiError('Gagal menerima hasil optimasi draf jurnal dari asisten AI. Silakan coba kembali.');
      }
    } catch (err: any) {
      console.error('Gemini API Error details:', err);
      setAiError(`Gagal menghubungkan ke asisten AI Gemini: ${err.message || err.toString()}`);
    } finally {
      setAiLoading(false);
    }
  };
  
  // Approval state
  const [selectedJournal, setSelectedJournal] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);
  const signaturePadRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [user, profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Limit to 3 photos
    const remainingSlots = 3 - photos.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);

    filesToAdd.forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Create an image element to resize the photo before converting to base64
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600;
          const scale = MAX_WIDTH / img.width;
          const width = MAX_WIDTH;
          const height = img.height * scale;

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
          setPhotos(prev => [...prev, compressedBase64]);
        };
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const fetchData = async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      let q;
      if (profile.role === 'student') {
        q = query(
          collection(db, 'journals'), 
          where('studentId', '==', user.uid),
          orderBy('date', 'desc')
        );
        
        // Also get assignment
        const assignmentsQuery = query(
          collection(db, 'assignments'), 
          where('studentId', '==', user.uid),
          where('status', '==', 'active')
        );
        const assignSnap = await getDocs(assignmentsQuery);
        if (!assignSnap.empty) {
          const assignData = assignSnap.docs[0].data();
          
          // Fetch location name
          const locRef = doc(db, 'locations', assignData.locationId);
          const locSnap = await getDoc(locRef);
          const locationName = locSnap.exists() ? (locSnap.data() as any).name : 'Tempat Magang';

          setAssignment({ 
            id: assignSnap.docs[0].id, 
            ...assignData,
            locationName 
          });
        }
      } else if (profile.role === 'supervisor') {
        // 1. Get assignments for this supervisor
        const assignmentsQuery = query(
          collection(db, 'assignments'),
          where('supervisorId', '==', user.uid),
          where('status', '==', 'active')
        );
        const assignSnap = await getDocs(assignmentsQuery);
        const studentIds = assignSnap.docs.map(d => d.data().studentId);

        if (studentIds.length === 0) {
          setJournals([]);
          setLoading(false);
          return;
        }

        // 2. Fetch journals for these students
        // Firestore 'in' matches up to 30 elements
        const chunks = [];
        for (let i = 0; i < studentIds.length; i += 30) {
          chunks.push(studentIds.slice(i, i + 30));
        }

        const allJournals: any[] = [];
        await Promise.all(chunks.map(async (chunk) => {
          const journalQuery = query(
            collection(db, 'journals'),
            where('studentId', 'in', chunk),
            orderBy('date', 'desc')
          );
          const jSnap = await getDocs(journalQuery);
          jSnap.forEach(d => allJournals.push({ id: d.id, ...d.data() }));
        }));

        setJournals(allJournals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setLoading(false);
        return;
      } else {
        q = query(collection(db, 'journals'), orderBy('date', 'desc'));
      }

      const snap = await getDocs(q);
      setJournals(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || !assignment || !user) return;

    setSubmitting(true);
    try {
      const journalData = {
        studentId: user.uid,
        studentName: profile?.name || 'Siswa',
        locationId: assignment.locationId,
        locationName: assignment.locationName || 'Tempat Magang',
        date: new Date().toISOString().split('T')[0],
        content,
        photos,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'journals'), journalData);
      setContent('');
      setPhotos([]);
      setShowForm(false);
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedJournal || !profile) return;
    
    // Simple signature capture
    const signature = signaturePadRef.current?.toDataURL() || `Digisigned by ${profile.name}`;

    try {
      await updateDoc(doc(db, 'journals', selectedJournal.id), {
        status: 'approved',
        supervisorSignature: signature,
        updatedAt: serverTimestamp(),
      });

      // Log the activity
      if (user && profile) {
        await logActivity({
          type: 'supervisor_action',
          action: 'approve_journal',
          userId: user.uid,
          userName: profile.name,
          targetId: selectedJournal.studentId,
          targetName: selectedJournal.studentName || 'Siswa',
          metadata: {
            journalId: selectedJournal.id,
            date: selectedJournal.date
          }
        });
      }

      setSelectedJournal(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!selectedJournal || !profile) return;

    try {
      await updateDoc(doc(db, 'journals', selectedJournal.id), {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });

      // Log the activity
      if (user && profile) {
        await logActivity({
          type: 'supervisor_action',
          action: 'reject_journal',
          userId: user.uid,
          userName: profile.name,
          targetId: selectedJournal.studentId,
          targetName: selectedJournal.studentName || 'Siswa',
          metadata: {
            journalId: selectedJournal.id,
            date: selectedJournal.date
          }
        });
      }

      setSelectedJournal(null);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredJournals = journals.filter(j => {
    if (filterStatus === 'all') return true;
    return j.status === filterStatus;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Jurnal Kegiatan</h1>
          <p className="text-slate-500">Catat dan pantau aktivitas harian magang.</p>
        </div>
        {profile?.role === 'student' && !showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold shadow-lg shadow-brand-primary/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5" /> Buat Jurnal Baru
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main List */}
        <div className="lg:col-span-2 space-y-4 text-slate-800">
          <AnimatePresence mode="wait">
            {showForm ? (
              <motion.form 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                onSubmit={handleSubmit}
                className="p-6 bg-white border border-brand-primary/20 rounded-2xl shadow-xl shadow-brand-primary/5 space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-brand-primary" /> Jurnal Baru
                  </h3>
                  <button type="button" onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Kegiatan Hari Ini</label>
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all placeholder:text-slate-400"
                    placeholder="Apa saja yang telah kamu kerjakan hari ini?"
                    required
                  />
                  
                  {/* AI Assistant Button & Output */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleAIAssistance}
                      disabled={aiLoading}
                      className={cn(
                        "inline-flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg border transition-all shadow-sm",
                        aiLoading 
                          ? "bg-indigo-50 border-indigo-200 text-indigo-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-indigo-100 text-indigo-700 active:scale-98"
                      )}
                    >
                      <Sparkles className={cn("w-3.5 h-3.5", aiLoading && "animate-pulse text-indigo-500")} />
                      {aiLoading ? "Menganalisis & Menyempurnakan..." : "Rapikan Draf dengan AI"}
                    </button>

                    {aiError && (
                      <div className="mt-2.5 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs leading-relaxed">
                        <p className="font-bold flex items-center gap-1.5 mb-1.5 text-rose-800">
                          <span>⚠️</span> Asisten AI Tidak Tersedia
                        </p>
                        <p>{aiError}</p>
                        <p className="mt-2 text-[10px] text-rose-500 font-medium leading-normal">
                          Tips: Jika Anda melihat status error "failed to gemini API key", harap konfigurasikan key Anda di AI Studio di menu paling kiri bawah (lingkaran roda gigi <strong>Settings &gt; Secrets</strong>) dengan nama bervariabel <strong>GEMINI_API_KEY</strong>.
                        </p>
                      </div>
                    )}

                    {aiSuggestion && (
                      <div className="mt-3 p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-slate-700 text-xs space-y-3 shadow-inner">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-indigo-805 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Hasil Pengoptimalan Jurnal:
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              // Extract first part which is typically the improved content before suggestions
                              const parts = aiSuggestion.split(/saran/i);
                              const cleanedDraft = parts[0]
                                .replace(/^(berikut draf yang sudah dirapikan:|^draf hasil perbaikan:|^hasil perbaikan:)/gi, '')
                                .replace(/^[:\-\s\n]+/i, '')
                                .trim();
                              setContent(cleanedDraft);
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:underline hover:text-indigo-800 cursor-pointer bg-white px-2 py-1 rounded shadow-sm border border-indigo-100"
                          >
                            Terapkan ke Input Jurnal
                          </button>
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed font-sans prose max-w-none text-slate-705">
                          {aiSuggestion}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-slate-800">
                  <label className="text-sm font-bold text-slate-700">Foto Dokumentasi (Maks. 3)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative aspect-[4/3] rounded-xl overflow-hidden group">
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {photos.length < 3 && (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-[4/3] border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-brand-primary/50 hover:text-brand-primary hover:bg-brand-primary/5 transition-all cursor-pointer"
                      >
                        <ImageIcon className="w-6 h-6" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Tambah</span>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    multiple
                    className="hidden" 
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowForm(false)}
                    className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    disabled={submitting}
                    className="px-8 py-2.5 bg-brand-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-primary/20 flex items-center gap-2"
                  >
                    {submitting ? <Clock className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Kirim Jurnal
                  </button>
                </div>
              </motion.form>
            ) : (
              <div className="space-y-4">
                {filteredJournals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                    <FileText className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-medium">Tidak ada jurnal ditemukan untuk kategori ini.</p>
                  </div>
                ) : (
                  filteredJournals.map((journal) => (
                    <motion.div 
                      key={journal.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => profile?.role !== 'student' && setSelectedJournal(journal)}
                      className={cn(
                        "p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-brand-primary/30 transition-all cursor-pointer group flex flex-col sm:flex-row gap-4 sm:gap-6",
                        selectedJournal?.id === journal.id && "border-brand-primary ring-2 ring-brand-primary/10"
                      )}
                    >
                      {journal.photos && journal.photos.length > 0 && (
                        <div className="shrink-0 w-full sm:w-32 aspect-[4/3] sm:aspect-square">
                          <img 
                            src={journal.photos[0]} 
                            alt={`Dokumentasi ${formatDate(journal.date)}`} 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage({
                                url: journal.photos[0],
                                title: `Dokumentasi: ${formatDate(journal.date)}`,
                                subtitle: `Oleh: ${journal.studentName || 'Siswa'}`
                              });
                            }}
                            className="w-full h-full rounded-xl object-cover border border-slate-100 cursor-zoom-in hover:opacity-90 transition-opacity shadow-sm" 
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                              journal.status === 'approved' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                            )}>
                              {journal.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{formatDate(journal.date)}</p>
                              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Status: {journal.status}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-primary transition-all shrink-0" />
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 mb-0">
                          {journal.content}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Info Column */}
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 text-white rounded-3xl shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-4">Ringkasan Jurnal</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
                  <p className="text-xs text-slate-400 mb-1">Total</p>
                  <p className="text-xl font-bold">{journals.length}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-2xl backdrop-blur-sm border border-emerald-500/20">
                  <p className="text-xs text-emerald-400 mb-1">Disetujui</p>
                  <p className="text-xl font-bold">{journals.filter(j => j.status === 'approved').length}</p>
                </div>
                {profile?.role === 'supervisor' && (
                  <div className="col-span-2 p-3 mt-2 bg-amber-500/10 rounded-2xl backdrop-blur-sm border border-amber-500/20">
                    <p className="text-xs text-amber-400 mb-1">Menunggu Review</p>
                    <p className="text-xl font-bold">{journals.filter(j => j.status === 'pending').length}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" /> Filter Jurnal
            </h3>
            <div className="space-y-2">
              <button 
                onClick={() => setFilterStatus('all')}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-all",
                  filterStatus === 'all' ? "bg-brand-primary/10 text-brand-primary font-bold border border-brand-primary/20" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                Semua Jurnal
              </button>
              <button 
                onClick={() => setFilterStatus('pending')}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-all",
                  filterStatus === 'pending' ? "bg-amber-50 text-amber-600 font-bold border border-amber-200" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                Menunggu Approval
              </button>
              <button 
                onClick={() => setFilterStatus('approved')}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-all",
                  filterStatus === 'approved' ? "bg-emerald-50 text-emerald-600 font-bold border border-emerald-200" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                Disetujui
              </button>
              <button 
                onClick={() => setFilterStatus('rejected')}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-all",
                  filterStatus === 'rejected' ? "bg-red-50 text-red-600 font-bold border border-red-200" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                Ditolak
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Approval Modal */}
      <AnimatePresence>
        {selectedJournal && profile?.role !== 'student' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                <div className="flex items-center justify-between sticky top-0 bg-white z-10 pb-2">
                  <div>
                    <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-lg uppercase tracking-wider mb-2 inline-block">Approval Jurnal</span>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight">Verifikasi Jurnal</h3>
                  </div>
                  <button onClick={() => setSelectedJournal(null)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-4 p-4 md:p-6 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold text-xs uppercase">
                      {selectedJournal.studentName?.[0] || 'S'}
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Siswa</p>
                      <p className="text-sm font-bold text-slate-900">{selectedJournal.studentName || 'Tidak diketahui'}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Kegiatan</p>
                    <p className="text-sm text-slate-600 leading-relaxed italic mb-4 whitespace-pre-wrap">
                      "{selectedJournal.content}"
                    </p>
                    
                    {selectedJournal.photos && selectedJournal.photos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {selectedJournal.photos.map((photo: string, idx: number) => (
                          <div 
                            key={idx} 
                            className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 cursor-pointer"
                            onClick={() => setPreviewImage({
                              url: photo,
                              title: `Detail Dokumentasi`,
                              subtitle: `Foto ke-${idx + 1}`
                            })}
                          >
                            <img src={photo} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Signature className="w-4 h-4 text-brand-primary" /> Bubuhkan Tanda-tangan Digital (Paraf)
                  </p>
                  <div className="h-40 bg-white border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center relative overflow-hidden touch-none">
                    <canvas 
                      ref={signaturePadRef}
                      width={600}
                      height={200}
                      className="absolute inset-0 w-full h-full cursor-crosshair"
                      onMouseDown={(e) => {
                        const ctx = signaturePadRef.current?.getContext('2d');
                        if (ctx) {
                          ctx.beginPath();
                          const rect = signaturePadRef.current?.getBoundingClientRect();
                          if (rect) {
                            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                          }
                        }
                      }}
                      onMouseMove={(e) => {
                        if (e.buttons === 1) {
                          const ctx = signaturePadRef.current?.getContext('2d');
                          const rect = signaturePadRef.current?.getBoundingClientRect();
                          if (ctx && rect) {
                            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                            ctx.strokeStyle = '#4F46E5';
                            ctx.lineWidth = 3;
                            ctx.lineCap = 'round';
                            ctx.lineJoin = 'round';
                            ctx.stroke();
                          }
                        }
                      }}
                      onTouchStart={(e) => {
                        const ctx = signaturePadRef.current?.getContext('2d');
                        const touch = e.touches[0];
                        const rect = signaturePadRef.current?.getBoundingClientRect();
                        if (ctx && rect) {
                          ctx.beginPath();
                          ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                        }
                      }}
                      onTouchMove={(e) => {
                        const ctx = signaturePadRef.current?.getContext('2d');
                        const touch = e.touches[0];
                        const rect = signaturePadRef.current?.getBoundingClientRect();
                        if (ctx && rect) {
                          ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
                          ctx.strokeStyle = '#4F46E5';
                          ctx.lineWidth = 3;
                          ctx.lineCap = 'round';
                          ctx.lineJoin = 'round';
                          ctx.stroke();
                        }
                      }}
                    />
                    <div className="pointer-events-none text-slate-300 text-xs font-medium uppercase tracking-widest text-center px-4">
                      Tanda tangan di sini
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <button 
                      onClick={() => {
                        const ctx = signaturePadRef.current?.getContext('2d');
                        ctx?.clearRect(0, 0, 600, 200);
                      }}
                      className="text-xs font-bold text-brand-primary hover:bg-brand-primary/5 px-2 py-1 rounded transition-all"
                    >
                      Bersihkan Paraf
                    </button>
                    <p className="text-[10px] text-slate-400">Gunakan jari atau mouse</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                  <button 
                    onClick={handleReject}
                    className="py-3 px-6 text-sm font-bold text-slate-500 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all"
                  >
                    Tolak
                  </button>
                  <button 
                    onClick={handleApprove}
                    className="py-3 px-6 bg-slate-900 text-white text-sm font-bold rounded-xl shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    <UserCheck className="w-5 h-5" /> Setujui
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      {previewImage && (
        <ImageModal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          imageSrc={previewImage.url}
          title={previewImage.title}
          subtitle={previewImage.subtitle}
          infoText="Foto ini diambil saat kegiatan PKL dan dapat dipertanggung jawabkan."
        />
      )}
    </div>
  );
};

export default JournalSystem;
