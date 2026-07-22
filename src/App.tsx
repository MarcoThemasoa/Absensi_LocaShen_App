import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { Toaster } from './components/ui/sonner';
import { AnimatePresence, motion } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

import EmployeeLogin from './pages/EmployeeLogin';
import EmployeeRegister from './pages/EmployeeRegister';
import AdminLogin from './pages/AdminLogin';

const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard'));
const CameraAbsen = lazy(() => import('./pages/CameraAbsen'));
const EmployeeHistory = lazy(() => import('./pages/EmployeeHistory'));
const EmployeeProfile = lazy(() => import('./pages/EmployeeProfile'));

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminEmployees = lazy(() => import('./pages/AdminEmployees'));
const AdminLocations = lazy(() => import('./pages/AdminLocations'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));

const PAGES_FALLBACK = (
  <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
    <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
  </div>
);

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Suspense fallback={PAGES_FALLBACK}>
        <Routes location={location} key={location.pathname.split('/')[1] === 'admin' && !location.pathname.includes('login') ? 'admin' : (location.pathname.includes('/auth') ? location.pathname : 'employee')}>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/auth/login" replace />} />
          <Route path="/auth/login" element={
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <EmployeeLogin />
            </motion.div>
          } />
          <Route path="/auth/register" element={
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <EmployeeRegister />
            </motion.div>
          } />
          <Route path="/admin/login" element={
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full">
              <AdminLogin />
            </motion.div>
          } />

          {/* Employee Protected Routes */}
          <Route element={<EmployeeLayout />}>
            <Route path="/dashboard" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full"><EmployeeDashboard /></motion.div>} />
            <Route path="/absen/kamera" element={<motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="h-full"><CameraAbsen /></motion.div>} />
            <Route path="/riwayat" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full"><EmployeeHistory /></motion.div>} />
            <Route path="/profil" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full"><EmployeeProfile /></motion.div>} />
          </Route>

          {/* Admin Protected Routes */}
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full"><AdminDashboard /></motion.div>} />
            <Route path="/admin/karyawan" element={<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full"><AdminEmployees /></motion.div>} />
            <Route path="/admin/lokasi" element={<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full"><AdminLocations /></motion.div>} />
            <Route path="/admin/laporan" element={<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full"><AdminReports /></motion.div>} />
            <Route path="/admin/pengaturan" element={<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full"><AdminSettings /></motion.div>} />
          </Route>
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AnimatedRoutes />
      </Router>
      <Toaster />
      <Analytics />
      <SpeedInsights />
    </AuthProvider>
  );
}
