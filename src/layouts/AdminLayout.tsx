import { Outlet, Navigate, Link, useLocation, useOutlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, MapPin, FileSpreadsheet, UserCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React from 'react';
import { cn } from '../lib/utils';
import { GlassNavbar } from '../components/GlassNavbar';

export function AdminLayout() {
  const { user, isAuthReady } = useAuth();
  const outlet = useOutlet();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Karyawan', path: '/admin/karyawan', icon: Users },
    { name: 'Lokasi', path: '/admin/lokasi', icon: MapPin },
    { name: 'Laporan', path: '/admin/laporan', icon: FileSpreadsheet },
    { name: 'Akun', path: '/admin/pengaturan', icon: UserCircle },
  ];

  // 🔄 Tunggu auth — tetap tampilkan sidebar/header + navbar, spinner di konten
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col md:flex-row relative">
        {/* Desktop Sidebar — tetap terlihat selama loading */}
        <aside className="hidden md:flex w-64 bg-[#113129] text-white flex-col fixed inset-y-0 z-50 shadow-2xl border-r border-[#1a4a3d]/50">
          <div className="px-8 pt-10 pb-6 flex flex-col items-center">
            <h1 className="flex flex-col items-center gap-1 ">
              <span className="text-2xl font-bold tracking-[0.15em] text-yellow-400 leading-tight">GEOFACE</span>
              <span className="text-[11px] font-normal tracking-[0.3em] text-yellow-200/60">ADMIN</span>
            </h1>
          </div>
          <nav className="flex-1 px-4 space-y-2 mt-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.path} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-[#c8e6d9]/40">
                  <Icon size={18} className="opacity-40" />
                  {item.name}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Main — spinner di tengah area putih */}
        <main className="flex-1 md:ml-64 min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#113129]" />
        </main>

        {/* Mobile Header */}
        <div className="md:hidden absolute top-0 left-0 right-0 bg-[#113129] text-white px-8 pt-5 pb-4 z-40 shadow-xl flex justify-center items-center rounded-b-[32px] border-b border-white/10">
          <h1 className="flex flex-col items-center gap-0.5">
            <span className="text-base font-bold tracking-[0.15em] text-yellow-400 leading-tight">GEOFACE</span>
            <span className="text-[10px] font-normal tracking-[0.3em] text-yellow-200/60">ADMIN</span>
          </h1>
        </div>

        <GlassNavbar
          leftItems={navItems.filter((i) => ['Karyawan', 'Lokasi'].includes(i.name))}
          centerItem={navItems.find((i) => i.name === 'Dashboard')}
          rightItems={navItems.filter((i) => ['Laporan', 'Akun'].includes(i.name))}
        />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login" />;
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col md:flex-row relative">
      {/* Decorative background elements */}
      <div className="hidden md:block absolute top-0 left-64 right-0 h-96 bg-gradient-to-br from-[#113129]/5 via-[#113129]/5 to-[#113129]/10 pointer-events-none rounded-b-[40px]"></div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#113129] text-white flex-col fixed inset-y-0 z-50 shadow-2xl border-r border-[#1a4a3d]/50">
        <div className="px-8 pt-10 pb-6 flex flex-col items-center">
          <h1 className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold tracking-[0.15em] text-yellow-400 leading-tight">
              GEOFACE
            </span>
            <span className="text-[11px] font-normal tracking-[0.3em] text-yellow-200/60">
              ADMIN
            </span>
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
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
          })}
        </nav>
      </aside>

      {/* Main Content — layout stabil, tidak berubah antar route */}
      <main className="flex-1 overflow-auto md:ml-64 pb-32 md:pb-12 relative z-10">
        {/* Mobile Header */}
        <div className="md:hidden bg-[#113129] text-white px-8 pt-5 pb-4 sticky top-0 z-40 shadow-xl flex justify-center items-center rounded-b-[32px] mb-4 border-b border-white/10">
          <h1 className="flex flex-col items-center gap-0.5">
            <span className="text-base font-bold tracking-[0.15em] text-yellow-400 leading-tight">
              GEOFACE
            </span>
            <span className="text-[10px] font-normal tracking-[0.3em] text-yellow-200/60">
              ADMIN
            </span>
          </h1>
        </div>

        <div className="max-w-7xl mx-auto space-y-6 p-6 md:p-10">
          <AnimatePresence mode="wait">
            {outlet && React.cloneElement(outlet, { key: location.pathname })}
          </AnimatePresence>
        </div>
      </main>

      <GlassNavbar
        leftItems={navItems.filter((i) => ['Karyawan', 'Lokasi'].includes(i.name))}
        centerItem={navItems.find((i) => i.name === 'Dashboard')}
        rightItems={navItems.filter((i) => ['Laporan', 'Akun'].includes(i.name))}
      />
    </div>
  );
}
