import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  UserCheck, 
  BookOpen, 
  MapPin, 
  Users, 
  ClipboardList,
  FileText,
  Settings,
  Activity,
  Briefcase
} from 'lucide-react';
import { cn } from '../lib/utils';

const Sidebar: React.FC = () => {
  const { profile } = useAuth();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['admin', 'supervisor', 'student'] },
    { icon: UserCheck, label: 'Absensi', path: '/attendance', roles: ['student', 'supervisor', 'admin'] },
    { icon: BookOpen, label: 'Jurnal Harian', path: '/journals', roles: ['student', 'supervisor', 'admin'] },
    { icon: Activity, label: 'Log Aktivitas', path: '/activities', roles: ['admin', 'supervisor'] },
    { icon: FileText, label: 'Laporan', path: '/reports', roles: ['admin', 'supervisor'] },
    { icon: MapPin, label: 'Lokasi Magang', path: '/locations', roles: ['admin'] },
    { icon: Users, label: 'Kelola User', path: '/users', roles: ['admin'] },
    { icon: ClipboardList, label: 'Penugasan', path: '/assignments', roles: ['admin'] },
    { icon: Settings, label: 'Pengaturan', path: '/maintenance', roles: ['admin'] },
  ];

  const filteredMenu = menuItems.filter(item => profile && item.roles.includes(profile.role));

  return (
    <aside className="fixed inset-y-0 left-0 hidden md:flex flex-col w-64 bg-white border-r border-slate-200">
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-200">
        <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center text-white font-bold">
          <Briefcase className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Sim<span className="text-brand-primary">PKL</span>
        </h1>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {filteredMenu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              isActive 
                ? "bg-brand-primary/10 text-brand-primary" 
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <div className="p-3 bg-slate-50 rounded-xl">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">Sekolah</p>
          <p className="text-xs font-semibold text-slate-700 truncate">SMKS PGRI 2 Ponorogo</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
