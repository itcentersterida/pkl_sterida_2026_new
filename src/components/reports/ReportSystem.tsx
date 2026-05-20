import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  Calendar, 
  User, 
  Loader2,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  doc,
  getDoc
} from '../../lib/firebase';
import { db } from '../../lib/firebase';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDate, cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

const ReportSystem: React.FC = () => {
  const { profile } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [recap, setRecap] = useState<any>(null);

  useEffect(() => {
    if (profile) fetchStudents();
  }, [profile]);

  const fetchStudents = async () => {
    try {
      if (profile?.role === 'supervisor') {
        const assignQ = query(collection(db, 'assignments'), where('supervisorId', '==', profile.uid));
        const assignSnap = await getDocs(assignQ);
        const studentIds = new Set(assignSnap.docs.map(d => d.data().studentId));
        
        const q = query(collection(db, 'users'), where('role', '==', 'student'));
        const snap = await getDocs(q);
        const allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        setStudents(allStudents.filter(s => studentIds.has(s.id)));
      } else {
        const q = query(collection(db, 'users'), where('role', '==', 'student'));
        const snap = await getDocs(q);
        setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const generateReport = async () => {
    if (!selectedStudent || !startDate || !endDate) return;
    
    setLoading(true);
    try {
      const q = query(
        collection(db, 'journals'),
        where('studentId', '==', selectedStudent),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );

      const attQ = query(
        collection(db, 'attendance'),
        where('studentId', '==', selectedStudent),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );
      
      const [snap, attSnap] = await Promise.all([getDocs(q), getDocs(attQ)]);
      const journalData = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const attendanceData = attSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      
      setReports(journalData);

      // Setup recap
      setRecap({
        present: attendanceData.filter(a => a.type === 'present').length,
        permit: attendanceData.filter(a => a.type === 'permit').length,
        sick: attendanceData.filter(a => a.type === 'sick').length,
        totalJournals: journalData.length,
        approvedJournals: journalData.filter(j => j.status === 'approved').length,
      });

      // Fetch assignment info for header
      const assignQuery = query(collection(db, 'assignments'), where('studentId', '==', selectedStudent));
      const assignSnap = await getDocs(assignQuery);
      if (!assignSnap.empty) {
        const assign = assignSnap.docs[0].data();
        const [locDoc, supDoc] = await Promise.all([
          getDoc(doc(db, 'locations', assign.locationId)),
          getDoc(doc(db, 'users', assign.supervisorId))
        ]);
        const headerInfo = {
          location: locDoc.exists() ? locDoc.data().name : '---',
          supervisor: supDoc.exists() ? supDoc.data().name : '---'
        };
        setReports(prev => prev.map(r => ({ ...r, ...headerInfo })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    const element = document.getElementById('report-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Laporan_Magang_${selectedStudent}_${startDate}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ekspor Laporan</h1>
          <p className="text-slate-500">Buat laporan jurnal harian dalam format PDF.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters */}
        <div className="lg:col-span-1 p-6 bg-white border border-slate-200 rounded-2xl h-fit space-y-6">
          <h3 className="font-bold text-slate-900 text-sm uppercase tracking-widest">Parameter Laporan</h3>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Pilih Siswa</label>
              <select 
                value={selectedStudent}
                onChange={e => setSelectedStudent(e.target.value)}
                className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none"
              >
                <option value="">Pilih Siswa...</option>
                {students.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Rentang Tanggal</label>
              <div className="space-y-2">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                />
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none" 
                />
              </div>
            </div>

            <button 
              onClick={generateReport}
              disabled={loading || !selectedStudent}
              className="w-full py-3 bg-slate-900 text-white text-sm font-bold rounded-xl shadow-lg hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Tampilkan Data
            </button>
          </div>
        </div>

        {/* Preview / Results */}
        <div className="lg:col-span-3 space-y-6">
          {reports.length > 0 ? (
            <>
              <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <p className="text-sm font-medium text-indigo-700">Ditemukan {reports.length} jurnal dalam rentang tersebut.</p>
                <button 
                  onClick={exportToPDF}
                  disabled={exporting}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow hover:bg-indigo-700 transition-all"
                >
                  {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  Ekspor PDF
                </button>
              </div>

              {/* PDF Container - Hidden from normal view or styled specifically */}
              <div id="report-content" className="p-12 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-800">
                <div className="text-center mb-12 border-b-2 border-slate-900 pb-8">
                  <h1 className="text-2xl font-bold uppercase tracking-widest">Laporan Jurnal Magang Siswa</h1>
                  <p className="text-sm font-medium text-slate-500 mt-2">SMKS PGRI 2 PONOROGO</p>
                  <p className="text-xs text-slate-400">Tahun Pelajaran 2025/2026</p>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-12">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Siswa</p>
                      <p className="text-lg font-bold text-slate-900">{students.find(s => s.uid === selectedStudent)?.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kelas</p>
                        <p className="text-sm font-bold text-slate-700">{students.find(s => s.uid === selectedStudent)?.class || '-'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jurusan</p>
                        <p className="text-sm font-bold text-slate-700">{students.find(s => s.uid === selectedStudent)?.major || '-'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Periode</p>
                      <p className="text-lg font-bold text-slate-900">{formatDate(startDate)} - {formatDate(endDate)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tempat Magang & Pembimbing</p>
                      <p className="text-sm font-bold text-slate-700">{reports[0]?.location || '-'} ({reports[0]?.supervisor || '-'})</p>
                    </div>
                  </div>
                </div>

                {recap && (
                  <div className="mb-12">
                    <h3 className="text-md font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">Rekapitulasi Kehadiran & Jurnal</h3>
                    <div className="grid grid-cols-5 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hadir</p>
                        <p className="text-xl font-bold text-slate-900">{recap.present}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Izin</p>
                        <p className="text-xl font-bold text-slate-900">{recap.permit}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sakit</p>
                        <p className="text-xl font-bold text-slate-900">{recap.sick}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Jurnal</p>
                        <p className="text-xl font-bold text-slate-900">{recap.totalJournals}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jurnal Disetujui</p>
                        <p className="text-xl font-bold text-emerald-600">{recap.approvedJournals}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-8">
                  {reports.map((report, idx) => (
                    <div key={report.id} className="pb-8 border-b border-slate-100 last:border-0">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                            {idx + 1}
                          </span>
                          <h4 className="font-bold text-slate-900">{formatDate(report.date)}</h4>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                          <CheckCircle2 className="w-3 h-3" /> Disetujui
                        </div>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-600 pl-11 mb-4 whitespace-pre-wrap">
                        {report.content}
                      </p>

                      {report.photos && report.photos.length > 0 && (
                        <div className="pl-11 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {report.photos.map((photo: string, i: number) => (
                            <div 
                              key={i}
                              className="rounded-lg w-full aspect-[4/3] border border-slate-200 bg-slate-100"
                              style={{
                                backgroundImage: `url(${photo})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat'
                              }}
                            />
                          ))}
                        </div>
                      )}
                      
                      {report.supervisorSignature && (
                         <div className="flex justify-end mt-4">
                            <div className="text-center">
                               <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Paraf Pembimbing</p>
                               {report.supervisorSignature.startsWith('data:image') ? (
                                  <img src={report.supervisorSignature} alt="Paraf" className="h-12 mx-auto grayscale" />
                               ) : (
                                  <p className="text-xs font-bold text-slate-900 italic underline">{report.supervisorSignature.replace('Digisigned by ', '')}</p>
                               )}
                            </div>
                         </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-20 pt-12 border-t border-slate-100 flex justify-between items-end">
                   <div className="text-xs text-slate-400 italic font-medium">
                      Dicetak otomatis oleh SimPKL System pada {formatDate(new Date())}
                   </div>
                   <div className="text-center w-48">
                      <p className="text-xs font-bold text-slate-900 mb-16">Guru Pembimbing</p>
                      <div className="border-t border-slate-900 pt-1">
                         <p className="text-sm font-bold text-slate-900">{reports[0]?.supervisor || profile?.name}</p>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">NIP. .........................</p>
                      </div>
                   </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-20 bg-white border border-dashed border-slate-200 rounded-2xl text-slate-400">
              <FileText className="w-16 h-16 mb-6 opacity-10" />
              <h4 className="text-lg font-bold text-slate-500">Belum Ada Data</h4>
              <p className="text-sm max-w-xs text-center mt-2">Silakan pilih siswa dan rentang tanggal untuk menampilkan ringkasan jurnal.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportSystem;
