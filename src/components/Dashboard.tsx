import React, { useEffect, useState } from 'react';
import { safeToDate, formatSafeTime, formatSafeDate } from '../lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  Users,
  GraduationCap,
  MapPin, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Calendar,
  XCircle,
  AlertTriangle,
  Bell,
  FileText,
  ChevronRight,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { 
  collection, 
  query, 
  getDocs, 
  where, 
  limit, 
  orderBy,
  db 
} from '../lib/firebase';
import { motion } from 'motion/react';
import { Attendance, Journal } from '../types';

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalLocations: 0,
    todayAttendance: 0,
    pendingJournals: 0,
  });
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [statusChart, setStatusChart] = useState<any[]>([]);
  const [journalChart, setJournalChart] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Student specific state
  const [studentStats, setStudentStats] = useState({
    todayAttendance: null as Attendance | null,
    todayJournal: null as Journal | null,
    attendanceStreak: 0,
    approvedJournals: 0,
  });
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        
        if (profile?.role === 'admin' || profile?.role === 'supervisor') {
          let studentIds: string[] = [];
          if (profile.role === 'supervisor') {
            const assignmentsQuery = query(
              collection(db, 'assignments'),
              where('supervisorId', '==', profile.uid),
              where('status', '==', 'active')
            );
            const assignSnap = await getDocs(assignmentsQuery);
            studentIds = assignSnap.docs.map(d => d.data().studentId);
            
            if (studentIds.length === 0) {
              setStats({
                totalStudents: 0,
                totalLocations: 0,
                todayAttendance: 0,
                pendingJournals: 0,
              });
              setLoading(false);
              return;
            }
          }

          // 1. Basic Queries
          let studentsQuery;
          if (profile.role === 'supervisor') {
            // Firestore limit 30 for 'in'. Assuming supervisors guide < 30 students for now.
            // If they guide more, we'd need chunks.
            studentsQuery = query(collection(db, 'users'), where('uid', 'in', studentIds));
          } else {
            studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
          }

          const locationsQuery = collection(db, 'locations');
          
          let journalsPendingQuery;
          let todayAttQuery;
          let allJournalsQuery;

          if (profile.role === 'supervisor') {
            journalsPendingQuery = query(
              collection(db, 'journals'), 
              where('studentId', 'in', studentIds),
              where('status', '==', 'pending')
            );
            todayAttQuery = query(
              collection(db, 'attendance'), 
              where('studentId', 'in', studentIds),
              where('date', '==', today)
            );
            allJournalsQuery = query(
              collection(db, 'journals'),
              where('studentId', 'in', studentIds)
            );
          } else {
            journalsPendingQuery = query(collection(db, 'journals'), where('status', '==', 'pending'));
            todayAttQuery = query(collection(db, 'attendance'), where('date', '==', today));
            allJournalsQuery = query(collection(db, 'journals'));
          }
          
          const [studentsSnap, locationsSnap, journalsSnap, todaySnap, allJournalsSnap] = await Promise.all([
            getDocs(studentsQuery),
            getDocs(locationsQuery),
            getDocs(journalsPendingQuery),
            getDocs(todayAttQuery),
            getDocs(allJournalsQuery)
          ]);

          const presentCount = todaySnap.docs.filter(d => (d.data() as any).type === 'present').length;
          const totalStudents = studentsSnap.size;
          const attendanceRate = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

          setStats({
            totalStudents: studentsSnap.size,
            totalLocations: locationsSnap.size,
            todayAttendance: attendanceRate,
            pendingJournals: journalsSnap.size,
          });

          // 2. Status Distribution (Today)
          const typeCounts = todaySnap.docs.reduce((acc: any, doc) => {
            const type = (doc.data() as any).type;
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {});

          const colorsMap: any = { present: '#10B981', permit: '#F59E0B', sick: '#3B82F6' };
          const labelMap: any = { present: 'Hadir', permit: 'Izin', sick: 'Sakit' };

          const statusDistribution = Object.keys(typeCounts).map(type => ({
            name: labelMap[type] || type,
            value: typeCounts[type],
            color: colorsMap[type] || '#CBD5E1'
          }));
          
          setStatusChart(statusDistribution.length > 0 ? statusDistribution : [
            { name: 'Hadir', value: 0, color: '#10B981' },
            { name: 'Belum Absen', value: totalStudents - todaySnap.size, color: '#E2E8F0' }
          ]);

          // 2.1 Journal Verification Distribution
          const journalStatusCounts = allJournalsSnap.docs.reduce((acc: any, doc) => {
            const status = (doc.data() as any).status;
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});

          const journalStatusData = [
            { name: 'Terverifikasi', value: journalStatusCounts['approved'] || 0, color: '#10B981' },
            { name: 'Menunggu', value: journalStatusCounts['pending'] || 0, color: '#F59E0B' },
            { name: 'Ditolak', value: journalStatusCounts['rejected'] || 0, color: '#EF4444' }
          ];
          setJournalChart(journalStatusData);

          // 3. Weekly Trends (Last 5 Days)
          const last5Days = [...Array(5)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (4 - i));
            return d.toISOString().split('T')[0];
          });

          let weeklyQuery;
          if (profile.role === 'supervisor') {
            weeklyQuery = query(
              collection(db, 'attendance'), 
              where('date', 'in', last5Days),
              where('studentId', 'in', studentIds)
            );
          } else {
            weeklyQuery = query(collection(db, 'attendance'), where('date', 'in', last5Days));
          }
          const weeklySnap = await getDocs(weeklyQuery);
          
          const dayMap: any = { 0: 'Min', 1: 'Sen', 2: 'Sel', 3: 'Rab', 4: 'Kam', 5: 'Jum', 6: 'Sab' };
          const trendData = last5Days.map(date => {
            const count = weeklySnap.docs.filter(d => (d.data() as any).date === date && (d.data() as any).type === 'present').length;
            const d = new Date(date);
            return { name: dayMap[d.getDay()], count };
          });
          setWeeklyData(trendData);

          // 4. Recent Activity
          let recentAttQuery;
          if (profile.role === 'supervisor') {
            recentAttQuery = query(
              collection(db, 'attendance'), 
              where('studentId', 'in', studentIds),
              orderBy('createdAt', 'desc'), 
              limit(10)
            );
          } else {
            recentAttQuery = query(collection(db, 'attendance'), orderBy('createdAt', 'desc'), limit(10)); 
          }
          const recentAttSnap = await getDocs(recentAttQuery);
          const usersSnap2 = await getDocs(collection(db, 'users'));
          const userNames = usersSnap2.docs.reduce((acc: any, d) => ({ ...acc, [d.id]: d.data().name }), {});

          const latestActivities = recentAttSnap.docs
            .map(d => ({ id: d.id, ...(d.data() as any) } as any))
            .map(a => ({
              id: a.id,
              userName: userNames[a.studentId] || 'Siswa',
              action: a.type === 'present' ? 'Check-in' : (a.type === 'permit' ? 'Izin' : 'Sakit'),
              time: formatSafeTime(a.createdAt),
              status: a.checkIn?.status === 'valid' ? 'Berhasil Diverifikasi' : 'Di Luar Radius'
            }))
            .slice(0, 5);
          
          setRecentActivities(latestActivities);
        } else if (profile?.role === 'student') {
          // Student Dashboard Logic
          const studentId = profile.uid;
          
          // 1. Today's Attendance
          const todayAttQuery = query(
            collection(db, 'attendance'), 
            where('studentId', '==', studentId),
            where('date', '==', today)
          );
          
          // 2. Today's Journal
          const todayJournalQuery = query(
            collection(db, 'journals'),
            where('studentId', '==', studentId),
            where('date', '==', today)
          );
          
          // 3. Approved Journals Count
          const approvedJournalsQuery = query(
            collection(db, 'journals'),
            where('studentId', '==', studentId),
            where('status', '==', 'approved')
          );

          // 4. Recent personal activities
          const personalAttQuery = query(
            collection(db, 'attendance'),
            where('studentId', '==', studentId),
            orderBy('createdAt', 'desc'),
            limit(5)
          );

          const [attSnap, journalSnap, approvedSnap, personalAttSnap] = await Promise.all([
            getDocs(todayAttQuery),
            getDocs(todayJournalQuery),
            getDocs(approvedJournalsQuery),
            getDocs(personalAttQuery)
          ]);

          const todayAtt = attSnap.docs[0]?.data() as Attendance;
          const todayJournal = journalSnap.docs[0]?.data() as Journal;

          setStudentStats({
            todayAttendance: todayAtt || null,
            todayJournal: todayJournal || null,
            attendanceStreak: 0, // Simplified for now
            approvedJournals: approvedSnap.size,
          });

          const activities = personalAttSnap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              userName: 'Anda',
              action: data.type === 'present' ? 'Absensi' : (data.type === 'permit' ? 'Izin' : 'Sakit'),
              time: formatSafeTime(data.createdAt),
              status: data.checkIn?.status === 'valid' ? 'Valid' : (data.type === 'present' ? 'Luar Radius' : 'Tercatat')
            };
          });
          setRecentActivities(activities);

          // Build Notifications
          const newNotifications = [];
          const now = new Date();
          const hour = now.getHours();

          if (!todayAtt) {
            newNotifications.push({
              id: 'notif-checkin',
              type: 'warning',
              title: 'Belum Absen Datang',
              message: 'Jangan lupa untuk melakukan absensi kedatangan hari ini.',
              icon: Clock,
              color: 'text-amber-600',
              bg: 'bg-amber-50'
            });
          } else if (todayAtt.type === 'present' && !todayAtt.checkOut && hour >= 15) {
            newNotifications.push({
              id: 'notif-checkout',
              type: 'warning',
              title: 'Waktunya Absen Pulang',
              message: 'Sudah waktunya pulang? Jangan lupa lakukan absensi pulang.',
              icon: Clock,
              color: 'text-blue-600',
              bg: 'bg-blue-50'
            });
          }

          if (!todayJournal && hour >= 12) {
            newNotifications.push({
              id: 'notif-journal',
              type: 'info',
              title: 'Jurnal Belum Diisi',
              message: 'Pastikan Anda mengisi jurnal kegiatan hari ini sebelum pulang.',
              icon: FileText,
              color: 'text-indigo-600',
              bg: 'bg-indigo-50'
            });
          }

          if (todayJournal?.status === 'rejected') {
            newNotifications.push({
              id: 'notif-journal-rejected',
              type: 'error',
              title: 'Jurnal Ditolak',
              message: 'Jurnal Anda ditolak oleh pembimbing. Segera perbaiki jurnal Anda.',
              icon: AlertTriangle,
              color: 'text-red-600',
              bg: 'bg-red-50'
            });
          }

          setNotifications(newNotifications);
        }
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile]);

  const StatCard = ({ title, value, icon: Icon, color, delay, suffix = "" }: any) => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-xl ${color} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
        </div>
        <TrendingUp className="w-4 h-4 text-emerald-500" />
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}{suffix}</h3>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-medium">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Selamat datang, {profile?.name}</h1>
        <p className="text-slate-500">
          {profile?.role === 'student' 
            ? "Semangat magang untuk hari ini! Jangan lupa lengkapi tugas Anda." 
            : "Berikut adalah ringkasan kegiatan magang hari ini."}
        </p>
      </div>

      {profile?.role === 'student' && notifications.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-4 rounded-2xl flex items-start gap-4 border ${notif.bg} border-opacity-50`}
            >
              <div className={`p-2 rounded-xl bg-white shadow-sm`}>
                <notif.icon className={`w-5 h-5 ${notif.color}`} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-slate-900">{notif.title}</h4>
                <p className="text-sm text-slate-600 mt-0.5">{notif.message}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {profile?.role === 'student' ? (
        <>
          {/* Student Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <UserCheck className="w-6 h-6" />
                </div>
                {studentStats.todayAttendance ? (
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">Sudah Absen</span>
                ) : (
                  <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">Belum Absen</span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-500">Status Absensi Hari Ini</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                {studentStats.todayAttendance?.type === 'present' ? 'Hadir' : (studentStats.todayAttendance?.type || 'Belum Tercatat')}
              </h3>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <FileText className="w-6 h-6" />
                </div>
                {studentStats.todayJournal ? (
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">Sudah Diisi</span>
                ) : (
                  <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">Belum Diisi</span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-500">Jurnal Kegiatan Hari Ini</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                {studentStats.todayJournal ? (
                  <span className={`capitalize ${
                    studentStats.todayJournal.status === 'approved' ? "text-emerald-600" : 
                    studentStats.todayJournal.status === 'rejected' ? "text-red-600" : "text-amber-600"
                  }`}>
                    {studentStats.todayJournal.status === 'pending' ? 'Menunggu Verifikasi' : 
                     studentStats.todayJournal.status === 'approved' ? 'Terverifikasi' : 'Ditolak'}
                  </span>
                ) : 'Belum Ada Entri'}
              </h3>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500">Total Jurnal Terverifikasi</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{studentStats.approvedJournals}</h3>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Detail Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" /> Detail Kehadiran Hari Ini
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${studentStats.todayAttendance?.checkIn ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Absensi Datang</h4>
                      <p className="text-xs text-slate-500">
                        {studentStats.todayAttendance?.checkIn?.time 
                          ? formatSafeTime(studentStats.todayAttendance.checkIn.time)
                          : 'Belum dilakukan'}
                      </p>
                    </div>
                  </div>
                  {studentStats.todayAttendance?.checkIn && (
                    <span className={`px-2 py-1 text-[10px] font-bold rounded-lg uppercase ${studentStats.todayAttendance.checkIn.status === 'valid' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {studentStats.todayAttendance.checkIn.status === 'valid' ? 'Valid' : 'Luar Radius'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${studentStats.todayAttendance?.checkOut ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Absensi Pulang</h4>
                      <p className="text-xs text-slate-500">
                        {studentStats.todayAttendance?.checkOut?.time 
                          ? formatSafeTime(studentStats.todayAttendance.checkOut.time)
                          : 'Belum dilakukan'}
                      </p>
                    </div>
                  </div>
                  {studentStats.todayAttendance?.checkOut && (
                    <span className={`px-2 py-1 text-[10px] font-bold rounded-lg uppercase ${studentStats.todayAttendance.checkOut.status === 'valid' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {studentStats.todayAttendance.checkOut.status === 'valid' ? 'Valid' : 'Luar Radius'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
              <h3 className="text-lg font-bold mb-4">Aksi Cepat</h3>
              <div className="grid grid-cols-1 gap-3">
                {!studentStats.todayAttendance && (
                  <button 
                    onClick={() => navigate('/attendance')}
                    className="flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all group w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white text-indigo-600 rounded-lg">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm">Lakukan Absensi Datang</span>
                    </div>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
                {studentStats.todayAttendance?.type === 'present' && !studentStats.todayAttendance.checkOut && (
                  <button 
                    onClick={() => navigate('/attendance')}
                    className="flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all group w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white text-amber-600 rounded-lg">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm">Lakukan Absensi Pulang</span>
                    </div>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
                {!studentStats.todayJournal && (
                  <button 
                    onClick={() => navigate('/journals')}
                    className="flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-xl transition-all group w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white text-emerald-600 rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm">Isi Jurnal Hari Ini</span>
                    </div>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
                {studentStats.todayAttendance && studentStats.todayJournal && (
                  <div className="text-center py-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-sm font-medium opacity-80">Tugas hari ini sudah selesai!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Admin/Supervisor Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Siswa" value={stats.totalStudents} icon={GraduationCap} color="bg-indigo-500" delay={0.1} />
            <StatCard title="Tempat Magang" value={stats.totalLocations} icon={MapPin} color="bg-emerald-500" delay={0.2} />
            <StatCard title="Kehadiran Hari Ini" value={stats.todayAttendance} suffix="%" icon={CheckCircle2} color="bg-blue-500" delay={0.3} />
            <StatCard title="Jurnal Pending" value={stats.pendingJournals} icon={AlertCircle} color="bg-amber-500" delay={0.4} />
          </div>

          {/* Admin/Supervisor Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900">Tren Kehadiran Mingguan</h3>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
                    <Calendar className="w-3 h-3" /> {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748B', fontSize: 12 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748B', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="count" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-6">Status Kehadiran</h3>
                <div className="h-[180px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChart}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusChart.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-slate-900">
                      {statusChart.reduce((a: number, b: any) => a + (b.value || 0), 0)}
                    </span>
                    <span className="text-[10px] text-slate-400">Total</span>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  {statusChart.map((s: any) => (
                    <div key={s.name} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-slate-600">{s.name}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-6">Status Verifikasi Jurnal</h3>
                <div className="h-[180px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={journalChart}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {journalChart.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-slate-900">
                      {journalChart.reduce((a: number, b: any) => a + (b.value || 0), 0)}
                    </span>
                    <span className="text-[10px] text-slate-400">Total Jurnal</span>
                  </div>
                </div>
                <div className="mt-4 space-y-1">
                  {journalChart.map((s: any) => (
                    <div key={s.name} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-slate-600">{s.name}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Activity List (Common for all roles, but data differs) */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900">
            {profile?.role === 'student' ? 'Riwayat Aktivitas Anda' : 'Aktivitas Terbaru'}
          </h3>
          {(profile?.role === 'admin' || profile?.role === 'supervisor') && (
            <button 
              onClick={() => navigate('/activities')}
              className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1"
            >
              Lihat Semua <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="space-y-6">
          {recentActivities.length > 0 ? recentActivities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4 pb-6 border-b border-slate-100 last:border-0 last:pb-0">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                {activity.userName.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    {activity.userName} melakukan {activity.action}
                  </h4>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">{activity.time}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <span className={`px-2 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${
                    activity.status === 'Berhasil Diverifikasi' || activity.status === 'Valid' || activity.status === 'Tercatat'
                      ? "bg-emerald-50 text-emerald-600" 
                      : "bg-red-50 text-red-600"
                  }`}>
                    {activity.status}
                  </span>
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-8 text-slate-500">Belum ada aktivitas hari ini.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
