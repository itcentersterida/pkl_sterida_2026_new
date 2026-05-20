import React, { useState, useEffect } from 'react';
import { safeToDate } from '../../lib/dateUtils';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  Timestamp,
  doc,
  getDoc,
  deleteDoc,
  db
} from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';
import { logActivity } from '../../lib/activityLogger';
import { 
  Users, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Eye,
  Trash2
} from 'lucide-react';
import { formatDate, cn } from '../../lib/utils';
import { motion } from 'motion/react';
import ImageModal from '../ui/ImageModal';

interface AttendanceRecord {
  id: string;
  studentId: string;
  locationId: string;
  date: string;
  type: 'present' | 'permit' | 'sick';
  createdAt: any;
  checkIn?: {
    time: any;
    photoURL: string;
    latitude: number;
    longitude: number;
    status: 'valid' | 'invalid';
  };
  checkOut?: {
    time: any;
    photoURL: string;
    latitude: number;
    longitude: number;
    status: 'valid' | 'invalid';
  };
  studentName?: string;
  locationName?: string;
}

const AdminAttendance: React.FC = () => {
  const { profile } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [today] = useState(new Date().toISOString().split('T')[0]);

  // Image Modal State
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
    subtitle?: string;
  } | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      let studentIds: string[] = [];
      if (profile?.role === 'supervisor') {
        const assignmentsQuery = query(
          collection(db, 'assignments'),
          where('supervisorId', '==', profile.uid),
          where('status', '==', 'active')
        );
        const assignSnap = await getDocs(assignmentsQuery);
        studentIds = assignSnap.docs.map(d => d.data().studentId);
        
        if (studentIds.length === 0) {
          setRecords([]);
          setLoading(false);
          return;
        }
      }

      // 1. Get all attendance for today
      let attendanceQuery;
      if (profile?.role === 'supervisor') {
        attendanceQuery = query(
          collection(db, 'attendance'),
          where('date', '==', today),
          where('studentId', 'in', studentIds)
        );
      } else {
        attendanceQuery = query(
          collection(db, 'attendance'),
          where('date', '==', today)
        );
      }
      
      const snap = await getDocs(attendanceQuery);
      const rawRecords = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as AttendanceRecord));

      // Sort in-memory to avoid composite index requirement
      rawRecords.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      // 2. Fetch metadata (student names and location names)
      // For performance in a small app, we can cache these lookups
      const studentMap: { [key: string]: string } = {};
      const locationMap: { [key: string]: string } = {};

      const enrichedRecords = await Promise.all(rawRecords.map(async (record) => {
        let studentName = studentMap[record.studentId];
        if (!studentName) {
          const studentDoc = await getDoc(doc(db, 'users', record.studentId));
          studentName = studentDoc.exists() ? (studentDoc.data() as UserProfile).name : 'Unknown Student';
          studentMap[record.studentId] = studentName;
        }

        let locationName = locationMap[record.locationId];
        if (!locationName) {
          const locDoc = await getDoc(doc(db, 'locations', record.locationId));
          locationName = locDoc.exists() ? locDoc.data()?.name : 'Unknown Location';
          locationMap[record.locationId] = locationName;
        }

        return {
          ...record,
          studentName,
          locationName
        };
      }));

      setRecords(enrichedRecords);
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!recordToDelete) return;
    try {
      await deleteDoc(doc(db, 'attendance', recordToDelete.id));
      
      // Log the activity
      if (profile) {
        await logActivity({
          type: 'supervisor_action',
          action: 'delete_attendance',
          userId: profile.uid,
          userName: profile.name,
          targetId: recordToDelete.studentId,
          targetName: recordToDelete.studentName || 'Siswa',
          metadata: {
            attendanceId: recordToDelete.id,
            date: recordToDelete.date
          }
        });
      }

      setRecords(prev => prev.filter(r => r.id !== recordToDelete.id));
      setShowDeleteModal(false);
      setRecordToDelete(null);
    } catch (err) {
      console.error('Error deleting attendance:', err);
      alert('Gagal menghapus absensi.');
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [today]);

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.studentName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || record.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (type: string, status?: string) => {
    if (type === 'permit') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (type === 'sick') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'valid') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'present': return 'Hadir';
      case 'permit': return 'Izin';
      case 'sick': return 'Sakit';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monitor Absensi Hari Ini</h1>
          <p className="text-slate-500">Melihat semua kehadiran siswa untuk tanggal {formatDate(new Date())}</p>
        </div>
        <button 
          onClick={fetchAttendance}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm font-medium"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Segarkan Data
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Cari nama siswa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <div>
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium text-slate-700"
          >
            <option value="all">Semua Status</option>
            <option value="present">Hadir</option>
            <option value="permit">Izin</option>
            <option value="sick">Sakit</option>
          </select>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-indigo-700">Total Hari Ini</span>
          <span className="text-lg font-bold text-indigo-900">{filteredRecords.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Siswa</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Lokasi</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Datang</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Pulang</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Foto</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <div className="h-4 bg-slate-100 rounded w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold border border-slate-200">
                          {record.studentName?.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{record.studentName}</span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> 
                            {record.createdAt ? formatDate(safeToDate(record.createdAt)) : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                          {record.locationName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col italic">
                        <span className="text-sm font-bold text-emerald-600">
                          {record.checkIn?.time ? safeToDate(record.checkIn.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </span>
                        {record.checkIn && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {record.checkIn.status === 'invalid' ? '(Luar Radius)' : '(Valid)'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col italic">
                        <span className="text-sm font-bold text-amber-600">
                          {record.checkOut?.time ? safeToDate(record.checkOut.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </span>
                        {record.checkOut && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {record.checkOut.status === 'invalid' ? '(Luar Radius)' : '(Valid)'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider",
                        getStatusColor(record.type, record.checkIn?.status)
                      )}>
                        {record.type === 'present' ? (
                          record.checkIn?.status === 'valid' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        {getTypeLabel(record.type)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        {record.checkIn?.photoURL && (
                          <div 
                            className="relative group/photo cursor-pointer"
                            onClick={() => setPreviewImage({
                              url: record.checkIn!.photoURL,
                              title: `Foto Datang: ${record.studentName}`,
                              subtitle: `${record.locationName} • ${safeToDate(record.checkIn!.time).toLocaleTimeString('id-ID')}`
                            })}
                          >
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 group-hover:border-indigo-400 transition-all relative">
                              <img 
                                src={record.checkIn.photoURL} 
                                alt="Datang" 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                              <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </div>
                            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-600 opacity-60 group-hover:opacity-100 whitespace-nowrap">DATANG</span>
                          </div>
                        )}
                        {record.checkOut?.photoURL && (
                          <div 
                            className="relative group/photo cursor-pointer"
                            onClick={() => setPreviewImage({
                              url: record.checkOut!.photoURL,
                              title: `Foto Pulang: ${record.studentName}`,
                              subtitle: `${record.locationName} • ${safeToDate(record.checkOut!.time).toLocaleTimeString('id-ID')}`
                            })}
                          >
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 group-hover:border-amber-400 transition-all relative">
                              <img 
                                src={record.checkOut.photoURL} 
                                alt="Pulang" 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                              <div className="absolute inset-0 bg-amber-600/0 group-hover:bg-amber-600/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </div>
                            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-amber-600 opacity-60 group-hover:opacity-100 whitespace-nowrap">PULANG</span>
                          </div>
                        )}
                        {!record.checkIn?.photoURL && !record.checkOut?.photoURL && (
                          <span className="text-xs text-slate-400 italic">Tanpa Foto</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          setRecordToDelete(record);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Hapus Absensi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Users className="w-8 h-8 opacity-20" />
                      <p className="font-medium text-slate-500">Belum ada data absensi untuk hari ini</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Image Preview Modal */}
      {previewImage && (
        <ImageModal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          imageSrc={previewImage.url}
          title={previewImage.title}
          subtitle={previewImage.subtitle}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl space-y-6 text-center"
          >
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Hapus Absensi?</h3>
              <p className="text-sm text-slate-500">
                Apakah Anda yakin ingin menghapus catatan absensi <span className="font-bold text-slate-900">{recordToDelete?.studentName}</span> pada tanggal <span className="font-bold text-slate-900">{recordToDelete?.date}</span>?
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button 
                onClick={() => {
                  setShowDeleteModal(false);
                  setRecordToDelete(null);
                }}
                className="flex-1 py-3 px-6 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
              >
                Batal
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 py-3 px-6 text-sm font-bold bg-red-600 text-white hover:bg-red-700 rounded-xl transition-all shadow-lg shadow-red-200"
              >
                Ya, Hapus
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminAttendance;
