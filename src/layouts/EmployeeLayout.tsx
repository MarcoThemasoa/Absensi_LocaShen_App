import { Outlet, Navigate, useLocation, useOutlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { History, UserCircle, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React from 'react';
import { GlassNavbar } from '../components/GlassNavbar';

export function EmployeeLayout() {
  const { user, isAuthReady } = useAuth();
  const outlet = useOutlet();
  const location = useLocation();

  // 🔄 Tunggu auth selesai di-load (session check) sebelum redirect
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#113129]" />
      </div>
    );
  }

  if (!user || user.role !== 'employee') {
    return <Navigate to="/auth/login" />;
  }

  const isCameraView = location.pathname.includes('/absen/kamera');

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col sm:items-center sm:justify-center sm:py-8">
      <div className="w-full sm:max-w-[400px] h-[100dvh] sm:h-[800px] bg-slate-50 flex flex-col sm:rounded-[2.5rem] sm:shadow-2xl relative overflow-hidden sm:border-[8px] sm:border-gray-900">
        <main className="flex-1 overflow-y-auto relative flex flex-col">
          <AnimatePresence mode="wait">
            {outlet && React.cloneElement(outlet, { key: location.pathname })}
          </AnimatePresence>
        </main>
        
        {/* Bottom Navigation Wrapper inside the phone frame */}
        {!isCameraView && (
          <GlassNavbar
            leftItems={[{ name: 'Riwayat', path: '/riwayat', icon: History }]}
            centerItem={{ name: 'Beranda', path: '/dashboard', icon: Home }}
            rightItems={[{ name: 'Profil', path: '/profil', icon: UserCircle }]}
          />
        )}
      </div>
    </div>
  );
}
