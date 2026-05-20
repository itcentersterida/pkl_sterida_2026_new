import React, { useState, useEffect } from 'react';
import { safeToDate } from '../../lib/dateUtils';
import { 
  collection, 
  query, 
  where,
  getDocs, 
  orderBy, 
  limit, 
  onSnapshot,
  doc,
  getDoc
} from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  Activity, 
  UserCheck, 
  BookOpen, 
  Clock, 
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Calendar
} from 'lucide-react';
import { formatDate, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ActivityItem {
  id: string;
  type: 'attendance' | 'journal' | 'supervisor_action';
  content: string;
  studentName: string;
  studentId: string;
  timestamp: any;
  date?: string;
  status?: string;
  locationName?: string;
  metadata: any;
  userName?: string;
  action?: string;
}

const ActivityLog: React.FC = () => {
  const { profile } = useAuth();
  const [attendance, setAttendance] = useState<ActivityItem[]>([]);
  const [journals, setJournals] = useState<ActivityItem[]>([]);
  const [supervisorActivities, setSupervisorActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'attendance' | 'journal' | 'supervisor'>('all');
  const [search, setSearch] = useState('');

  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [locationMap, setLocationMap] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch users and locations for enrichment
    const fetchMetadata = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const uMap: Record<string, string> = {};
        usersSnap.docs.forEach(d => {
          uMap[d.id] = d.data().name || 'Pengguna';
        });
        
        // Also map emails for pre-registered users who logged attendance
        usersSnap.docs.forEach(d => {
          if (d.data().email) {
            uMap[d.data().email.toLowerCase()] = d.data().name || 'Siswa';
          }
        });
        setUserMap(uMap);

        const locsSnap = await getDocs(collection(db, 'locations'));
        const lMap: Record<string, string> = {};
        locsSnap.docs.forEach(d => {
          lMap[d.id] = d.data().name || 'Tempat Magang';
        });
        setLocationMap(lMap);
      } catch (err) {
        console.error('Error fetching metadata for activity log', err);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    let unsubAssign: () => void = () => {};
    let unsubAtt: () => void = () => {};
    let unsubJour: () => void = () => {};
    let unsubAct: () => void = () => {};

    const setupListeners = async () => {
      setLoading(true);
      try {
        let studentIds: string[] = [];
        
        if (profile?.role === 'supervisor') {
          // Listen to assignments to get current student IDs
          const assignmentsQuery = query(
            collection(db, 'assignments'),
            where('supervisorId', '==', profile.uid),
            where('status', '==', 'active')
          );

          unsubAssign = onSnapshot(assignmentsQuery, (snap) => {
            studentIds = snap.docs.map(d => d.data().studentId);
            
            if (studentIds.length > 0) {
              // Now setup collection listeners with specific student IDs
              setupCollectionListeners(studentIds);
            } else {
              setAttendance([]);
              setJournals([]);
              setSupervisorActivities([]);
              setLoading(false);
            }
          });
        } else {
          // Admin sees everything
          setupCollectionListeners();
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    const setupCollectionListeners = (studentIds?: string[]) => {
      // Clear existing listeners
      if (unsubAtt) unsubAtt();
      if (unsubJour) unsubJour();
      if (unsubAct) unsubAct();

      let attQuery, jourQuery, actQuery;

      if (studentIds) {
        attQuery = query(
          collection(db, 'attendance'),
          where('studentId', 'in', studentIds),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        jourQuery = query(
          collection(db, 'journals'),
          where('studentId', 'in', studentIds),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        actQuery = query(
          collection(db, 'activities'),
          where('userId', '==', profile?.uid),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
      } else {
        attQuery = query(collection(db, 'attendance'), orderBy('createdAt', 'desc'), limit(50));
        jourQuery = query(collection(db, 'journals'), orderBy('createdAt', 'desc'), limit(50));
        actQuery = query(collection(db, 'activities'), orderBy('timestamp', 'desc'), limit(50));
      }

      unsubAtt = onSnapshot(attQuery, (snap) => {
        const data: ActivityItem[] = snap.docs.map(d => {
          const dData = d.data() as any;
          return {
            id: d.id,
            type: 'attendance',
            content: dData.type === 'present' ? 'Melakukan absensi kehadiran' : (dData.type === 'permit' ? 'Mengajukan izin' : 'Melaporkan sakit'),
            studentName: dData.studentName || 'Siswa',
            studentId: dData.studentId,
            timestamp: dData.createdAt,
            date: dData.date,
            status: dData.checkIn?.status || 'recorded',
            locationName: dData.locationName,
            metadata: dData
          };
        });
        setAttendance(data);
        setLoading(false);
      });

      unsubJour = onSnapshot(jourQuery, (snap) => {
        const data: ActivityItem[] = snap.docs.map(d => {
          const dData = d.data() as any;
          return {
            id: d.id,
            type: 'journal',
            content: 'Mengisi jurnal kegiatan harian',
            studentName: dData.studentName || 'Siswa',
            studentId: dData.studentId,
            timestamp: dData.createdAt,
            date: dData.date,
            status: dData.status,
            locationName: dData.locationName,
            metadata: dData
          };
        });
        setJournals(data);
        setLoading(false);
      });

      unsubAct = onSnapshot(actQuery, (snap) => {
        const data: ActivityItem[] = snap.docs.map(d => {
          const dData = d.data() as any;
          let actionLabel = 'Melakukan aksi sistem';
          if (dData.action === 'approve_journal') actionLabel = 'Menyetujui jurnal siswa';
          if (dData.action === 'reject_journal') actionLabel = 'Menolak jurnal siswa';
          if (dData.action === 'verify_attendance') actionLabel = 'Memverifikasi absensi';
          if (dData.action === 'delete_attendance') actionLabel = 'Menghapus absensi siswa';
          
          return {
            id: d.id,
            type: 'supervisor_action',
            content: actionLabel,
            studentName: dData.targetName || 'Siswa',
            studentId: dData.targetId || '',
            timestamp: dData.timestamp,
            date: '',
            status: 'verified',
            metadata: dData,
            userName: dData.userName
          };
        });
        setSupervisorActivities(data);
        setLoading(false);
      });
    };

    setupListeners();

    return () => {
      unsubAssign();
      unsubAtt();
      unsubJour();
      unsubAct();
    };
  }, [profile]);

  const activities = React.useMemo(() => {
    return [...attendance, ...journals, ...supervisorActivities].map(a => {
      // Enrich with maps
      const enrichedStudentName = userMap[a.studentId] || a.studentName || 'Siswa';
      const enrichedLocationName = a.metadata?.locationId ? (locationMap[a.metadata.locationId] || a.locationName || 'Tempat Magang') : (a.locationName || 'Tempat Magang');
      const enrichedUserName = a.metadata?.userId ? (userMap[a.metadata.userId] || a.userName) : a.userName;
      
      return {
        ...a,
        studentName: enrichedStudentName,
        locationName: enrichedLocationName,
        userName: enrichedUserName
      };
    }).sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });
  }, [attendance, journals, supervisorActivities, userMap, locationMap]);

  const filteredActivities = activities.filter(a => {
    const matchesFilter = 
      filter === 'all' || 
      (filter === 'attendance' && a.type === 'attendance') ||
      (filter === 'journal' && a.type === 'journal') ||
      (filter === 'supervisor' && a.type === 'supervisor_action');
    
    const matchesSearch = 
      a.studentName.toLowerCase().includes(search.toLowerCase()) || 
      a.content.toLowerCase().includes(search.toLowerCase()) ||
      (a.userName && a.userName.toLowerCase().includes(search.toLowerCase()));
    
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Log Aktivitas Siswa</h1>
          <p className="text-slate-500">Memantau seluruh kegiatan absensi dan jurnal secara real-time.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari siswa atau aktivitas..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-primary/20 w-full md:w-64"
            />
          </div>
          <div className="flex bg-white border border-slate-200 rounded-xl p-1">
            <button 
              onClick={() => setFilter('all')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                filter === 'all' ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              Semua
            </button>
            <button 
              onClick={() => setFilter('attendance')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                filter === 'attendance' ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              Absensi
            </button>
            <button 
              onClick={() => setFilter('journal')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                filter === 'journal' ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              Jurnal
            </button>
            <button 
              onClick={() => setFilter('supervisor')}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                filter === 'supervisor' ? "bg-amber-600 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              Pembimbing
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700">Timeline Aktivitas</h3>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {filteredActivities.length} Entri Ditemukan
          </span>
        </div>
        
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              <p className="text-sm text-slate-500">Memuat aktivitas...</p>
            </div>
          ) : filteredActivities.length > 0 ? (
            filteredActivities.map((activity, index) => (
              <motion.div 
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 hover:bg-slate-50 transition-all flex items-start gap-5 group"
              >
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-110",
                  activity.type === 'attendance' ? "bg-indigo-50 text-indigo-600" : 
                  activity.type === 'journal' ? "bg-emerald-50 text-emerald-600" :
                  "bg-amber-50 text-amber-600"
                )}>
                  {activity.type === 'attendance' && <UserCheck className="w-6 h-6" />}
                  {activity.type === 'journal' && <BookOpen className="w-6 h-6" />}
                  {activity.type === 'supervisor_action' && <UserCheck className="w-6 h-6" />}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900">
                      {activity.type === 'supervisor_action' ? activity.userName : activity.studentName}
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {activity.timestamp ? safeToDate(activity.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </span>
                  </div>
                  
                  {activity.type === 'supervisor_action' ? (
                    <p className="text-sm text-slate-600">
                      {activity.content} <span className="font-medium text-slate-400">milik</span> <span className="font-bold text-slate-700">{activity.studentName}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600">
                      {activity.content} <span className="font-medium text-slate-400">di</span> <span className="font-bold text-slate-700">{activity.locationName || 'Tempat Magang'}</span>
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 pt-2">
                    {activity.date && (
                      <>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <Calendar className="w-3 h-3" /> {formatDate(activity.date)}
                        </span>
                        <span className="text-slate-300">•</span>
                      </>
                    )}
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
                      activity.status === 'valid' || activity.status === 'approved' || activity.status === 'verified'
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                        : "bg-amber-50 text-amber-600 border border-amber-100"
                    )}>
                      {activity.status === 'valid' ? 'Lokasi Valid' : 
                       activity.status === 'approved' || activity.status === 'verified' ? 'Terverifikasi' : 
                       activity.status === 'pending' ? 'Menunggu' :
                       activity.status === 'rejected' ? 'Ditolak' : 'Tercatat'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="p-20 text-center text-slate-400">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="text-sm font-medium">Tidak ada aktivitas ditemukan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;
