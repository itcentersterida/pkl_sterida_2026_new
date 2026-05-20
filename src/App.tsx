import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { 
  Loader2, 
  Mail, 
  Lock, 
  User as UserIcon, 
  ShieldAlert, 
  CheckCircle, 
  Smartphone 
} from 'lucide-react';

// Components (to be implemented)
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AttendanceSystem from './components/attendance/AttendanceSystem';
import JournalSystem from './components/journals/JournalSystem';
import LocationManager from './components/locations/LocationManager';
import UserManager from './components/admin/UserManager';
import AssignmentManager from './components/admin/AssignmentManager';
import DatabaseMaintenance from './components/admin/DatabaseMaintenance';
import ReportSystem from './components/reports/ReportSystem';
import ActivityLog from './components/admin/ActivityLog';

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

const Login = () => {
  const { login, loginWithEmail, registerWithEmail, user, loading } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'supervisor' | 'admin'>('student');
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (loading) return null;
  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          setError('Nama lengkap wajib diisi');
          setFormLoading(false);
          return;
        }
        await registerWithEmail(email, password, name, role);
        setSuccess('Pendaftaran berhasil! Akun Anda siap digunakan.');
        setTimeout(() => {
          setFormLoading(false);
        }, 1500);
      } else {
        await loginWithEmail(email, password);
        setFormLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Terjadi kesalahan. Silakan coba lagi.';
      if (err.code === 'auth/email-already-in-use') {
        errMsg = 'Email sudah digunakan oleh akun lain.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Format email tidak valid.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Kata sandi minimal berisi 6 karakter.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = 'Email atau kata sandi tidak sesuai.';
      }
      setError(errMsg);
      setFormLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setFormLoading(true);
    setError(null);
    try {
      await login();
    } catch (err: any) {
      console.error('Google login error:', err);
      if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
        setError(
          <div className="space-y-1 text-left">
            <span className="font-semibold block text-red-800">Domain Tidak Diizinkan (Unauthorized Domain)</span>
            <span className="block text-xs text-red-600 leading-normal">
              Domain <strong>{window.location.hostname}</strong> belum diotorisasi di Firebase. Silakan tambahkan domain ini ke <strong>Authorized Domains</strong> di Firebase Console Anda:
            </span>
            <ol className="list-decimal list-inside text-[11px] text-red-600 space-y-1 mt-1 font-medium">
              <li>Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold hover:text-red-800">Firebase Console</a></li>
              <li>Pilih menu <strong>Authentication</strong> &gt; tab <strong>Settings</strong></li>
              <li>Klik <strong>Authorized domains</strong> di panel kiri atau bagian bawah</li>
              <li>Klik <strong>Add domain</strong> dan masukkan: <code className="bg-red-100 px-1 py-0.5 rounded font-mono text-[10px] break-all select-all font-bold text-red-850">{window.location.hostname}</code></li>
            </ol>
          </div>
        );
      } else {
        setError('Gagal masuk menggunakan Google. Silakan coba lagi.');
      }
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-6 border border-slate-100">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            Sim<span className="text-brand-primary">PKL</span>
          </h1>
          <p className="text-slate-500 text-sm">Monitor kegiatan magang dengan mudah dan transparan.</p>
        </div>

        {/* Toggle Mode */}
        <div className="flex p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
              !isSignUp ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setError(null);
              setSuccess(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${
              isSignUp ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Daftar
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100">
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start gap-2.5 p-3.5 bg-green-50 text-green-700 text-sm rounded-xl border border-green-100">
            <CheckCircle className="w-5 h-5 shrink-0 text-green-500 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Nama Lengkap</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none text-slate-800 placeholder-slate-400"
                  placeholder="Masukkan nama lengkap Anda"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Alamat Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none text-slate-800 placeholder-slate-400"
                placeholder="pembimbing@smk.id / siswa@smk.id"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none text-slate-800 placeholder-slate-400"
                placeholder="••••••"
              />
            </div>
          </div>

          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Peran Pengguna (Role)</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none text-slate-800 cursor-pointer"
              >
                <option value="student">Siswa (Student)</option>
                <option value="supervisor">Pembimbing / Supervisor</option>
                <option value="admin">Administrator / Admin</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={formLoading}
            className="w-full py-3.5 bg-brand-primary text-white rounded-xl font-semibold shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/95 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {formLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <span>{isSignUp ? 'Daftar Sekarang' : 'Masuk ke Akun'}</span>
            )}
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-100"></div>
          <span className="flex-shrink mx-4 text-xs text-slate-400 uppercase font-medium tracking-wider">atau</span>
          <div className="flex-grow border-t border-slate-100"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={formLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all font-medium text-sm text-slate-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          Masuk dengan Google
        </button>

        <p className="text-xs text-slate-400 text-center leading-normal">
          Gunakan akun sekolah atau buat akun baru dengan Email & password untuk mengakses SimPKL SMKS PGRI 2 Ponorogo.
        </p>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="attendance" element={<AttendanceSystem />} />
            <Route path="journals" element={<JournalSystem />} />
            <Route path="activities" element={
              <ProtectedRoute roles={['admin', 'supervisor']}>
                <ActivityLog />
              </ProtectedRoute>
            } />
            
            {/* Supervisor & Admin Routes */}
            <Route path="reports" element={
              <ProtectedRoute roles={['admin', 'supervisor']}>
                <ReportSystem />
              </ProtectedRoute>
            } />
            
            {/* Admin Only Routes */}
            <Route path="locations" element={
              <ProtectedRoute roles={['admin']}>
                <LocationManager />
              </ProtectedRoute>
            } />
            <Route path="users" element={
              <ProtectedRoute roles={['admin']}>
                <UserManager />
              </ProtectedRoute>
            } />
            <Route path="assignments" element={
              <ProtectedRoute roles={['admin']}>
                <AssignmentManager />
              </ProtectedRoute>
            } />
            <Route path="maintenance" element={
              <ProtectedRoute roles={['admin']}>
                <DatabaseMaintenance />
              </ProtectedRoute>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
