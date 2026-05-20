import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { 
  X, 
  Camera, 
  Upload, 
  User, 
  Mail, 
  BookOpen, 
  Award, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Photo states
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync photo preview with current profile photo
  useEffect(() => {
    if (profile?.photoURL) {
      setPhotoPreview(profile.photoURL);
    } else {
      setPhotoPreview(null);
    }
  }, [profile, isOpen]);

  // Handle file selection (and canvas resizing/compression)
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Harap masukkan berkas gambar saja.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Compact image size suitable for profile profile pic
        const MAX_DIMENSION = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Highly-compressed JPEG
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        setPhotoPreview(compressedBase64);
        setErrorMsg(null);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  // Drag and drop support
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  if (!isOpen || !profile) return null;

  // Camera capture methods
  async function startCamera() {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 400 },
          height: { ideal: 400 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('Camera Access Error:', err);
      setErrorMsg('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }

  // Cleanup camera stream when modal closes
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function capturePhoto() {
    if (videoRef.current && canvasRef.current && isCameraActive) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        const video = videoRef.current;
        const size = Math.min(video.videoWidth, video.videoHeight);
        
        // Let's crop to a perfect square center
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;

        const canvasSize = 300;
        canvasRef.current.width = canvasSize;
        canvasRef.current.height = canvasSize;

        // Apply mirror effect for webcam familiarity
        context.translate(canvasSize, 0);
        context.scale(-1, 1);
        context.drawImage(video, sx, sy, size, size, 0, 0, canvasSize, canvasSize);
        // Reset transform
        context.setTransform(1, 0, 0, 1, 0, 0);

        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.75);
        setPhotoPreview(dataUrl);
        stopCamera();
        setErrorMsg(null);
      }
    }
  }

  // Save functionality
  const handleSaveProfile = async () => {
    if (!profile) return;
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const userDocRef = doc(db, 'users', profile.uid);
      await updateDoc(userDocRef, {
        photoURL: photoPreview || ''
      });
      
      setSuccessMsg('Foto profil Anda berhasil diperbarui!');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error updating profile photo:', err);
      setErrorMsg('Gagal memperbarui foto profil. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        {/* Modal Body */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Profil Pengguna</h2>
              <p className="text-xs text-slate-500">Kelola dan ganti foto profil Anda.</p>
            </div>
            <button 
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Notifications */}
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-sm font-medium"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}

            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-sm font-medium"
              >
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            <div className="flex flex-col md:flex-row gap-6 items-center">
              {/* Photo Area */}
              <div className="flex flex-col items-center space-y-3">
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative w-36 h-36 rounded-full flex items-center justify-center border-2 border-dashed overflow-hidden group transition-all ${
                    dragActive 
                      ? 'border-brand-primary bg-brand-primary/5 ring-4 ring-brand-primary/10' 
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {isCameraActive ? (
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover scale-x-[-1]" 
                    />
                  ) : photoPreview ? (
                    <img 
                      src={photoPreview} 
                      alt="Pratinjau Foto" 
                      className="w-full h-full object-cover rounded-full" 
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <User className="w-10 h-10 text-slate-300 mb-1" />
                      <span className="text-[10px] font-medium text-slate-400">Belum ada foto</span>
                    </div>
                  )}

                  {/* Dark hover overlay for photo upload click when camera is not running */}
                  {!isCameraActive && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-center p-2 rounded-full"
                    >
                      <Upload className="w-5 h-5 mb-1 text-slate-100" />
                      <span className="text-[9px] font-semibold text-slate-200 uppercase tracking-wider">Unggah File</span>
                    </button>
                  )}
                </div>

                {/* Sub-upload tools */}
                <div className="flex items-center gap-2">
                  {isCameraActive ? (
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Ambil Foto
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                      Kamera
                    </button>
                  )}

                  {isCameraActive ? (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      Batal
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Pilih File
                    </button>
                  )}

                  {/* Hidden inputs */}
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="hidden" 
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              </div>

              {/* Readonly info / Profile Details */}
              <div className="flex-1 space-y-3.5 w-full">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Lengkap</p>
                      <p className="text-sm font-semibold text-slate-800">{profile.name}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alamat Email</p>
                      <p className="text-sm font-semibold text-slate-800 truncate">{profile.email}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-start gap-2.5">
                      <Award className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</p>
                        <p className="text-xs font-semibold text-slate-800 capitalize">{profile.role}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-start gap-2.5">
                      <BookOpen className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800 capitalize mt-0.5">
                          {profile.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {profile.role === 'student' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Kelas</p>
                      <p className="text-xs font-semibold text-slate-800 truncate">{profile.class || '-'}</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Jurusan</p>
                      <p className="text-xs font-semibold text-slate-800 truncate">{profile.major || '-'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={loading || photoPreview === profile.photoURL}
              onClick={handleSaveProfile}
              className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-semibold rounded-xl text-xs shadow-md shadow-brand-primary/10 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Perubahan</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
