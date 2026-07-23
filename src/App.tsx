import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { Toaster } from './components/ui/sonner';
import { AnimatePresence, motion } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

const EmployeeLogin = lazy(() => import('./pages/EmployeeLogin'));
const EmployeeRegister = lazy(() => import('./pages/EmployeeRegister'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));

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

/** Each route wraps its own motion.div + Suspense so AnimatePresence transitions work properly */
function PageWrapper({ children, className = "h-full" }: { children: React.ReactNode; className?: string }) {
  return (
    <Suspense fallback={PAGES_FALLBACK}>
      {children}
    </Suspense>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  // Use full pathname as key so AnimatePresence detects EVERY route change
  const routeKey = location.pathname;

  const springTransition = { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.8 };
  const fadeTransition = { duration: 0.25 };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={routeKey}>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/auth/login" replace />} />
        <Route path="/auth/login" element={
          <PageWrapper>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={springTransition}
              className="h-full"
            >
              <EmployeeLogin />
            </motion.div>
          </PageWrapper>
        } />
        <Route path="/auth/register" element={
          <PageWrapper>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={springTransition}
              className="h-full"
            >
              <EmployeeRegister />
            </motion.div>
          </PageWrapper>
        } />
        <Route path="/admin/login" element={
          <PageWrapper>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={springTransition}
              className="h-full"
            >
              <AdminLogin />
            </motion.div>
          </PageWrapper>
        } />

        {/* Employee Protected Routes */}
        <Route element={<EmployeeLayout />}>
          <Route path="/dashboard" element={<PageWrapper><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={fadeTransition} className="h-full"><EmployeeDashboard /></motion.div></PageWrapper>} />
          <Route path="/absen/kamera" element={<PageWrapper><motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={fadeTransition} className="h-full"><CameraAbsen /></motion.div></PageWrapper>} />
          <Route path="/riwayat" element={<PageWrapper><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={fadeTransition} className="h-full"><EmployeeHistory /></motion.div></PageWrapper>} />
          <Route path="/profil" element={<PageWrapper><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={fadeTransition} className="h-full"><EmployeeProfile /></motion.div></PageWrapper>} />
        </Route>

        {/* Admin Protected Routes */}
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<PageWrapper><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={fadeTransition} className="h-full"><AdminDashboard /></motion.div></PageWrapper>} />
          <Route path="/admin/karyawan" element={<PageWrapper><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={fadeTransition} className="h-full"><AdminEmployees /></motion.div></PageWrapper>} />
          <Route path="/admin/lokasi" element={<PageWrapper><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={fadeTransition} className="h-full"><AdminLocations /></motion.div></PageWrapper>} />
          <Route path="/admin/laporan" element={<PageWrapper><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={fadeTransition} className="h-full"><AdminReports /></motion.div></PageWrapper>} />
          <Route path="/admin/pengaturan" element={<PageWrapper><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={fadeTransition} className="h-full"><AdminSettings /></motion.div></PageWrapper>} />
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
      <Analytics />
      <SpeedInsights />
    </AuthProvider>
  );
}
