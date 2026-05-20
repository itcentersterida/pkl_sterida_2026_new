import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon, Camera } from 'lucide-react';
import ProfileCompletion from './auth/ProfileCompletion';
import { ProfileModal } from './profile/ProfileModal';

const Layout: React.FC = () => {
  const { profile, logout } = useAuth();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const isProfileIncomplete = profile?.role === 'student' && (!profile.class || !profile.major);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col md:ml-64">
        {/* Profile Completion Modal for Students */}
        {isProfileIncomplete && <ProfileCompletion />}
        {/* Profile Modal for Viewing & Editing Photo */}
        <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white border-b border-slate-200">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-slate-800 md:hidden">SimPKL</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-3 hover:bg-slate-50 p-1.5 rounded-xl transition-all text-left group cursor-pointer"
              title="Ganti Foto Profil / Lihat Profil"
            >
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-medium text-slate-900 group-hover:text-brand-primary transition-colors">{profile?.name}</span>
                <span className="text-xs text-slate-500 capitalize">{profile?.role}</span>
              </div>
              <div className="relative w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 group-hover:border-brand-primary group-hover:ring-2 group-hover:ring-brand-primary/15 transition-all shrink-0">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt={profile.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <UserIcon className="w-5 h-5 text-slate-400" />
                )}
                <div className="absolute -bottom-0.5 -right-0.5 bg-brand-primary text-white p-1 rounded-full border border-white shrink-0 shadow-sm group-hover:scale-115 transition-transform">
                  <Camera className="w-2.5 h-2.5" />
                </div>
              </div>
            </button>
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
