import React, { useState, useEffect, useRef } from 'react';
import { safeToDate } from '../../lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AdminAttendance from '../admin/AdminAttendance';
import { 
  Camera, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  RefreshCw,
  XCircle,
  Eye
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  setDoc,
  serverTimestamp,
  doc,
  getDoc,
  Timestamp
} from '../../lib/firebase';
import { db, auth } from '../../lib/firebase';
import { calculateDistance, formatDate, cn } from '../../lib/utils';
import ImageModal from '../ui/ImageModal';

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
  console.error('Firestore Error Detailed: ', JSON.stringify(errInfo, null, 2));
  throw new Error(JSON.stringify(errInfo));
}
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet marker fix
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const AttendanceSystem: React.FC = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  // If Admin or Supervisor, show the management view
  if (profile?.role === 'admin' || profile?.role === 'supervisor') {
    return <AdminAttendance />;
  }

  const [assignment, setAssignment] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<any>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // Image Modal State
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];

        // 1. Get student assignment
        // Try looking up by UID first
        let assignmentsQuery = query(
          collection(db, 'assignments'), 
          where('studentId', '==', user?.uid),
          where('status', '==', 'active')
        );
        let assignmentsSnap = await getDocs(assignmentsQuery);
        
        // If not found, try looking up by email (pre-registered accounts)
        if (assignmentsSnap.empty && user?.email) {
          assignmentsQuery = query(
            collection(db, 'assignments'),
            where('studentId', '==', user.email.toLowerCase()),
            where('status', '==', 'active')
          );
          assignmentsSnap = await getDocs(assignmentsQuery);
        }
        
        if (assignmentsSnap.empty) {
          setError('Anda belum ditugaskan di tempat magang manapun.');
          setLoading(false);
          return;
        }

        const docData = assignmentsSnap.docs[0].data();
        const assignData = { id: assignmentsSnap.docs[0].id, ...docData } as any;
        setAssignment(assignData);

        // 2. Get location details
        const locRef = doc(db, 'locations', assignData.locationId);
        const locSnap = await getDoc(locRef);
        if (locSnap.exists()) {
          setLocation({ id: locSnap.id, ...locSnap.data() });
        }

        // 3. Check for today's existing attendance
        let attendanceQuery = query(
          collection(db, 'attendance'),
          where('studentId', '==', user?.uid),
          where('date', '==', today)
        );
        let attendanceSnap = await getDocs(attendanceQuery);
        
        if (attendanceSnap.empty && user?.email) {
          attendanceQuery = query(
            collection(db, 'attendance'),
            where('studentId', '==', user.email.toLowerCase()),
            where('date', '==', today)
          );
          attendanceSnap = await getDocs(attendanceQuery);
        }

        if (!attendanceSnap.empty) {
          // Find the primary attendance record (prefer 'present' for check-in/out flow)
          const docs = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
          const presentDoc = docs.find(d => d.type === 'present');
          setExistingAttendance(presentDoc || docs[0]);
        }

        // 4. Get current GPS
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCoords(currentCoords);
            
            if (locSnap.exists()) {
              const locData = locSnap.data();
              const dist = calculateDistance(
                currentCoords.lat, 
                currentCoords.lng, 
                locData.latitude, 
                locData.longitude
              );
              setDistance(dist);
            }
            setLoading(false);
          },
          (err) => {
            setError('Gagal mendapatkan lokasi. Pastikan GPS aktif.');
            setLoading(false);
          }
        );
      } catch (err) {
        console.error(err);
        setError('Terjadi kesalahan saat memuat data.');
        setLoading(false);
      }
    };

    init();
  }, [user]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      console.error('Camera Error:', err);
      setError('Kamera tidak dapat diakses. Mohon izinkan akses kamera.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && isCameraActive) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // Scale down the image to prevent 1MB Firestore limit issues
        const maxWidth = 400;
        const scale = maxWidth / videoRef.current.videoWidth;
        const width = maxWidth;
        const height = videoRef.current.videoHeight * scale;

        canvasRef.current.width = width;
        canvasRef.current.height = height;

        // Apply mirror effect to the canvas drawn image
        context.translate(width, 0);
        context.scale(-1, 1);
        context.drawImage(videoRef.current, 0, 0, width, height);
        
        // Reset transformation matrix
        context.setTransform(1, 0, 0, 1, 0, 0);
        
        // Use lower quality to further reduce size
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.6);
        setPhoto(dataUrl);
        
        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        setIsCameraActive(false);
      }
    }
  };

  const handleAttendance = async (type: 'present' | 'permit' | 'sick') => {
    if (!user || !location || !coords) {
      console.error('Missing required data:', { user: !!user, location: !!location, coords: !!coords });
      setError('Data tidak lengkap (Lokasi/GPS). Harap segarkan halaman.');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const isRadiusValid = (distance !== null && distance <= location.radius) ? 'valid' : 'invalid';
      
      const attendancePayload = {
        time: serverTimestamp(),
        photoURL: photo || '',
        latitude: coords.lat,
        longitude: coords.lng,
        status: isRadiusValid
      };

      console.log('Attempting attendance submission...', { type, date: today });

      if (type === 'present') {
        if (existingAttendance && existingAttendance.type === 'present') {
          // Check-out (Pulang)
          const docRef = doc(db, 'attendance', existingAttendance.id);
          try {
            await setDoc(docRef, {
              checkOut: attendancePayload,
              updatedAt: serverTimestamp()
            }, { merge: true });
            console.log('Successfully recorded Check-out');
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `attendance/${existingAttendance.id}`);
          }
        } else if (existingAttendance) {
          setError('Anda sudah memiliki catatan absensi (Izin/Sakit) hari ini.');
          setSubmitting(false);
          return;
        } else {
          // Check-in (Datang)
          const newDoc = {
            studentId: user.uid,
            locationId: location.id,
            date: today,
            type,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            checkIn: attendancePayload
          };
          
          try {
            const colRef = collection(db, 'attendance');
            const docRef = await addDoc(colRef, newDoc);
            console.log('Successfully recorded Check-in', docRef.id);
            setExistingAttendance({ id: docRef.id, ...newDoc });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'attendance');
          }
        }
      } else {
        // Permit or Sick
        try {
          await addDoc(collection(db, 'attendance'), {
            studentId: user.uid,
            locationId: location.id,
            date: today,
            type,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log('Successfully recorded permit/sick');
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'attendance');
        }
      }
      
      setSuccess(true);
    } catch (err) {
      console.error('Attendance System error block:', err);
      let errorMessage = 'Gagal menyimpan absensi.';
      
      try {
        const parsed = JSON.parse((err as Error).message);
        if (parsed.error.includes('permission-denied')) {
          errorMessage = 'Akses ditolak. Hubungi admin untuk verifikasi peran "Siswa" Anda.';
        } else {
          errorMessage = parsed.error;
        }
      } catch {
        errorMessage = (err as Error).message;
      }
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-slate-500 font-medium">Memverifikasi lokasi...</p>
      </div>
    );
  }

  const alreadyCheckedOut = existingAttendance?.checkOut;
  const alreadyPresentToday = existingAttendance?.checkIn;

    if (success || (alreadyCheckedOut)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center p-8 bg-white rounded-3xl border border-emerald-100 shadow-xl"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {alreadyCheckedOut ? 'Absensi Selesai!' : 'Berhasil Tercatat!'}
          </h2>
          <p className="text-slate-500 mb-8">
            {alreadyCheckedOut 
              ? 'Anda sudah melakukan absensi datang dan pulang hari ini. Selamat beristirahat!' 
              : 'Terima kasih, kehadiran Anda telah tercatat dalam sistem.'}
          </p>
          <div className="flex flex-col gap-4">
            {existingAttendance?.checkIn?.photoURL && (
              <button 
                onClick={() => setPreviewImage({
                  url: existingAttendance.checkIn.photoURL,
                  title: 'Foto Absensi Datang',
                  subtitle: `${location?.name} • ${safeToDate(existingAttendance.checkIn.time).toLocaleTimeString('id-ID')}`
                })}
                className="w-full py-3 px-4 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
              >
                <Eye className="w-4 h-4" /> Lihat Foto Datang
              </button>
            )}
            {existingAttendance?.checkOut?.photoURL && (
              <button 
                onClick={() => setPreviewImage({
                  url: existingAttendance.checkOut.photoURL,
                  title: 'Foto Absensi Pulang',
                  subtitle: `${location?.name} • ${safeToDate(existingAttendance.checkOut.time).toLocaleTimeString('id-ID')}`
                })}
                className="w-full py-3 px-4 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
              >
                <Eye className="w-4 h-4" /> Lihat Foto Pulang
              </button>
            )}
            <button 
              onClick={() => navigate('/')}
              className="w-full py-4 px-6 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
            >
              Selesai
            </button>
          </div>
          
          {previewImage && (
            <ImageModal
              isOpen={!!previewImage}
              onClose={() => setPreviewImage(null)}
              imageSrc={previewImage.url}
              title={previewImage.title}
              subtitle={previewImage.subtitle}
            />
          )}
        </motion.div>
      </div>
    );
  }

  const isWithinRadius = distance !== null && location && distance <= location.radius;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Absensi Harian</h1>
          <p className="text-slate-500">{formatDate(new Date())}</p>
        </div>
        <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-brand-primary" />
          <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">
            {location?.name || 'Mencari lokasi...'}
          </span>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification Status */}
        <div className="space-y-6">
          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Verifikasi Otomatis
            </h3>

            <div className="space-y-4">
              <div className={cn(
                "p-4 rounded-xl flex items-center justify-between",
                coords ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", coords ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                  <span className="text-sm font-bold">GPS Koordinat</span>
                </div>
                {coords && <span className="text-xs font-mono">{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>}
              </div>

              <div className={cn(
                "p-4 rounded-xl flex items-center justify-between",
                isWithinRadius ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", isWithinRadius ? "bg-emerald-500" : "bg-amber-500")} />
                  <span className="text-sm font-bold">Radius Lokasi</span>
                </div>
                <span className="text-xs font-bold">
                  {distance ? `${Math.round(distance)}m` : '---'} dari pusat
                </span>
              </div>
            </div>

            {!isWithinRadius && location && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  Anda berada di luar radius {location.radius}m dari {location.name}. 
                  Absensi tetap bisa dilakukan namun akan ditandai dengan status "Tidak Valid".
                </p>
              </div>
            )}
          </div>

          <div className="h-[300px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
            {coords && location && (
              <MapContainer 
                center={[coords.lat, coords.lng]} 
                zoom={16} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[coords.lat, coords.lng]} />
                <Circle 
                  center={[location.latitude, location.longitude]} 
                  radius={location.radius} 
                  pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.1 }}
                />
              </MapContainer>
            )}
          </div>
        </div>

        {/* Action / Camera */}
        <div className="space-y-6">
          <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
            <h3 className="font-bold text-slate-900 mb-6">Verifikasi Wajah (Selfie)</h3>
            
            <div className="relative aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden shadow-inner mb-6">
              {!photo ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  <div className="absolute inset-0 border-2 border-dashed border-white/20 pointer-events-none rounded-2xl m-4" />
                  <div className="absolute bottom-6 inset-x-0 flex justify-center">
                    <button 
                      onClick={isCameraActive ? capturePhoto : startCamera}
                      className={cn(
                        "p-4 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all",
                        isCameraActive ? "bg-red-500 text-white" : "bg-white text-slate-900"
                      )}
                    >
                      {isCameraActive ? <Camera className="w-6 h-6" /> : <RefreshCw className="w-6 h-6" />}
                    </button>
                  </div>
                  {!isCameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px]">
                      <button 
                        onClick={startCamera}
                        className="px-6 py-2 bg-white text-slate-900 rounded-full font-bold shadow-xl hover:scale-105 active:scale-95 transition-all"
                      >
                        Aktifkan Kamera
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="relative w-full h-full">
                  <img src={photo} alt="Selfie" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
                  <button 
                    onClick={() => {
                      setPhoto(null);
                      startCamera();
                    }}
                    className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-md rounded-lg text-white hover:bg-white/40 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="flex flex-col gap-4">
              <button 
                disabled={submitting || alreadyCheckedOut || !photo}
                onClick={() => {
                  if (!photo) {
                    setError('Harap ambil foto selfie terlebih dahulu.');
                    return;
                  }
                  handleAttendance('present');
                }}
                className={cn(
                  "w-full flex flex-col items-center gap-3 p-6 rounded-2xl transition-all font-bold border shadow-md",
                  (submitting || alreadyCheckedOut || !photo)
                    ? "bg-slate-50 text-slate-400 border-slate-100 shadow-none cursor-not-allowed"
                    : "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700 shadow-emerald-200 active:scale-95"
                )}
              >
                <div className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors",
                  (submitting || alreadyCheckedOut || !photo) ? "bg-slate-200 text-slate-400" : "bg-white text-emerald-600"
                )}>
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-lg uppercase tracking-widest">
                    {alreadyPresentToday ? 'Kirim Hadir Pulang' : 'Kirim Hadir Datang'}
                  </span>
                  {!photo ? (
                    <span className="text-[10px] text-amber-500 font-bold">Ambil foto untuk mengaktifkan</span>
                  ) : (
                    <span className="text-[10px] opacity-70 font-normal">
                      {alreadyPresentToday ? 'Selesaikan hari magang Anda' : 'Mulai hari magang Anda'}
                    </span>
                  )}
                </div>
              </button>

              {alreadyCheckedOut && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-sm text-center font-medium">
                  Anda sudah menyelesaikan absensi untuk hari ini.
                </div>
              )}
            </div>
            
            {submitting && (
              <div className="mt-4 flex items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-medium">Menyimpan absensi...</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {previewImage && (
        <ImageModal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          imageSrc={previewImage.url}
          title={previewImage.title}
          subtitle={previewImage.subtitle}
        />
      )}
    </div>
  );
};

export default AttendanceSystem;
