/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { Toaster } from './components/ui/sonner';
import { AnimatePresence, motion } from 'motion/react';

import EmployeeLogin from './pages/EmployeeLogin';
import EmployeeRegister from './pages/EmployeeRegister';
import AdminLogin from './pages/AdminLogin';

import EmployeeDashboard from './pages/EmployeeDashboard';
import CameraAbsen from './pages/CameraAbsen';
import EmployeeHistory from './pages/EmployeeHistory';
import EmployeeProfile from './pages/EmployeeProfile';

import AdminDashboard from './pages/AdminDashboard';
import AdminEmployees from './pages/AdminEmployees';
import AdminLocations from './pages/AdminLocations';
import AdminReports from './pages/AdminReports';
import AdminSettings from './pages/AdminSettings';

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait" initial={false}>
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
    </AuthProvider>
  );
}
