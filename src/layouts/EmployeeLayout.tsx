import { Navigate, useLocation, useOutlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { History, UserCircle, Home, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React from 'react';
import { GlassNavbar } from '../components/GlassNavbar';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
  { name: 'Beranda', path: '/dashboard', icon: Home },
  { name: 'Riwayat', path: '/riwayat', icon: History },
  { name: 'Profil', path: '/profil', icon: UserCircle },
];

export function EmployeeLayout() {
  const { user, isAuthReady, logout } = useAuth();
  const outlet = useOutlet();
  const location = useLocation();

  const navBar = (
    <GlassNavbar
      leftItems={[{ name: 'Riwayat', path: '/riwayat', icon: History }]}
      centerItem={{ name: 'Beranda', path: '/dashboard', icon: Home }}
      rightItems={[{ name: 'Profil', path: '/profil', icon: UserCircle }]}
      equalSpacing
    />
  );

  const isCameraView = location.pathname.includes('/absen/kamera');

  // ── Loading state ──
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#113129]" />
          <p className="text-sm text-gray-500 font-medium">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'employee') {
    return <Navigate to="/auth/login" />;
  }

  // ── Desktop nav link ──
  const renderDesktopLink = (item: typeof NAV_ITEMS[0]) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold",
          isActive
            ? "bg-white/15 text-yellow-400 border border-white/10 shadow-[0_4px_12px_rgba(0,0,0,0.1)] backdrop-blur-md"
            : "hover:bg-white/10 text-[#c8e6d9]/80 hover:text-white"
        )}
      >
        <Icon size={18} className={isActive ? "text-yellow-400" : "opacity-80"} />
        {item.name}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      {/* ═══════ DESKTOP SIDEBAR ═══════ */}
      <aside className="hidden md:flex w-64 bg-[#113129] text-white flex-col fixed inset-y-0 z-50 shadow-2xl border-r border-[#1a4a3d]/50">
        {/* Logo */}
        <div className="px-8 pt-10 pb-6 flex flex-col items-center">
          <h1 className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold tracking-[0.15em] text-yellow-400 leading-tight">GEOFACE</span>
            <span className="text-[11px] font-normal tracking-[0.3em] text-yellow-200/60">KARYAWAN</span>
          </h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 space-y-2 mt-2">
          {NAV_ITEMS.map(renderDesktopLink)}
        </nav>

        {/* User info + Logout */}
        <div className="px-4 py-4 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-sm font-bold text-yellow-400">
              {user.name.charAt(0)}
            </div>
            <div className="text-xs min-w-0">
              <p className="text-white/90 font-semibold truncate max-w-[140px]">{user.name}</p>
              <p className="text-yellow-200/60">Karyawan</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-red-300/80 hover:text-red-300 hover:bg-white/5 transition-colors"
          >
            <LogOut size={16} />
            Keluar
          </button>
        </div>
      </aside>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <main className="flex-1 md:ml-64 relative">
        {/* ── MOBILE: phone-frame ── */}
        <div className={`md:hidden ${isCameraView ? 'h-dvh' : 'min-h-dvh'} bg-gray-200 flex flex-col`}>
          <div className="flex-1 w-full max-w-[400px] mx-auto bg-slate-50 flex flex-col relative">
            <div className={`flex-1 ${isCameraView ? 'overflow-hidden relative' : 'overflow-y-auto'}`}>
              <AnimatePresence mode="wait">
                {outlet && React.cloneElement(outlet, { key: location.pathname })}
              </AnimatePresence>
            </div>
          </div>
          {!isCameraView && navBar}
        </div>

        {/* ── DESKTOP: full-width ── */}
        <div className="hidden md:block min-h-screen">
          {/* Top bar */}
          <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-30">
            <div>
              <h2 className="text-lg font-bold text-gray-800">
                {NAV_ITEMS.find(i => i.path === location.pathname)?.name || 'Beranda'}
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                {user.name} • Karyawan
              </p>
            </div>
            <p className="text-xs text-gray-400 font-medium">{user.position || 'Karyawan'}</p>
          </div>

          {/* Page content — wider container */}
          <div className="max-w-6xl mx-auto px-6 md:px-10 py-6">
            <AnimatePresence mode="wait">
              {outlet && React.cloneElement(outlet, { key: location.pathname })}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
