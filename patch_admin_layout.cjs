const fs = require('fs');
let code = fs.readFileSync('src/layouts/AdminLayout.tsx', 'utf8');

const importTarget = "import { LayoutDashboard, Users, MapPin, FileSpreadsheet, UserCircle, Activity } from 'lucide-react';";
const importReplacement = "import { LayoutDashboard, Users, MapPin, FileSpreadsheet, UserCircle, Activity } from 'lucide-react';\nimport { motion } from 'motion/react';";
code = code.replace(importTarget, importReplacement);

const mobileNavTarget = `      {/* Mobile Bottom Navigation with Glassmorphism */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/85 backdrop-blur-xl border-t border-gray-100/50 px-4 py-3 flex justify-between items-center z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1.5 p-2 rounded-xl flex-1 transition-all",
                isActive ? "text-teal-700 bg-teal-50/50" : "text-gray-400 hover:text-teal-600"
              )}
            >
              <Icon size={22} className={isActive ? "scale-110 transition-transform" : ""} />
              <span className="text-[10px] font-bold tracking-wide truncate w-full text-center">{item.name}</span>
            </Link>
          );
        })}
      </div>`;

const mobileNavReplacement = `      {/* Mobile Bottom Navigation with Glassmorphism */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="absolute inset-0 bg-white/90 backdrop-blur-xl border-t border-gray-100/50 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.1)]"></div>
        
        <div className="relative px-4 pb-2 pt-2 flex justify-between items-end h-[72px]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}>
          {/* Left Items */}
          <div className="flex flex-1 justify-around h-full items-center">
            {navItems.filter(i => ['Karyawan', 'Lokasi'].includes(i.name)).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 w-14 h-12 z-10",
                    isActive ? "text-teal-700" : "text-gray-400 hover:text-teal-600"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="adminMobileNavActive"
                      className="absolute inset-0 bg-teal-100/60 backdrop-blur-md rounded-xl -z-10"
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    />
                  )}
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] font-bold tracking-wide truncate w-full text-center">{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Center FAB (Dashboard) */}
          <div className="relative z-20 flex flex-col items-center px-2" style={{ transform: 'translateY(-16px)' }}>
            <Link to="/admin/dashboard" className="w-16 h-16 rounded-full bg-teal-950 flex items-center justify-center text-white shadow-xl shadow-teal-900/40 transform transition-transform hover:scale-105 active:scale-95">
              <LayoutDashboard size={28} strokeWidth={2.5} />
            </Link>
            <span className="text-[10px] font-bold text-gray-700 mt-2">Dashboard</span>
          </div>

          {/* Right Items */}
          <div className="flex flex-1 justify-around h-full items-center">
            {navItems.filter(i => ['Laporan', 'Akun'].includes(i.name)).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 w-14 h-12 z-10",
                    isActive ? "text-teal-700" : "text-gray-400 hover:text-teal-600"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="adminMobileNavActive"
                      className="absolute inset-0 bg-teal-100/60 backdrop-blur-md rounded-xl -z-10"
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    />
                  )}
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-[10px] font-bold tracking-wide truncate w-full text-center">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>`;

code = code.replace(mobileNavTarget, mobileNavReplacement);
fs.writeFileSync('src/layouts/AdminLayout.tsx', code);
console.log("Patched AdminLayout.tsx");
