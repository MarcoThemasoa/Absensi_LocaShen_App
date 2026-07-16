const fs = require('fs');
let code = fs.readFileSync('src/layouts/EmployeeLayout.tsx', 'utf8');

const targetNavbar = `        {!isCameraView && (
          <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 px-8 py-3 flex justify-around items-center z-40" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
            <Link to="/dashboard" className={\`flex flex-col items-center gap-1 \${location.pathname === '/dashboard' ? 'text-teal-700' : 'text-gray-400 hover:text-teal-700'}\`}>
              <Clock size={24} />
              <span className="text-[10px] font-medium">Absen</span>
            </Link>
            <Link to="/riwayat" className={\`flex flex-col items-center gap-1 \${location.pathname === '/riwayat' ? 'text-teal-700' : 'text-gray-400 hover:text-teal-700'}\`}>
              <History size={24} />
              <span className="text-[10px] font-medium">Riwayat</span>
            </Link>
            <Link to="/profil" className={\`flex flex-col items-center gap-1 \${location.pathname === '/profil' ? 'text-teal-700' : 'text-gray-400 hover:text-teal-700'}\`}>
              <UserCircle size={24} />
              <span className="text-[10px] font-medium">Profil</span>
            </Link>
          </div>
        )}`;

const replacementNavbar = `        {!isCameraView && (
          <div className="absolute bottom-0 left-0 right-0 z-40">
            {/* Curved Background / Blur Layer */}
            <div className="absolute inset-0 bg-white/90 backdrop-blur-xl border-t border-gray-100/50 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.1)]"></div>
            
            <div className="relative px-8 py-2 flex justify-between items-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}>
              <Link to="/riwayat" className={\`relative z-10 flex flex-col items-center gap-1 w-16 \${location.pathname === '/riwayat' ? 'text-teal-700' : 'text-gray-400 hover:text-teal-600'}\`}>
                <History size={24} strokeWidth={location.pathname === '/riwayat' ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Riwayat</span>
              </Link>

              {/* Floating Center Button */}
              <div className="relative z-20 flex flex-col items-center -mt-10">
                <Link to="/dashboard" className="w-16 h-16 rounded-full bg-teal-950 flex items-center justify-center text-white shadow-xl shadow-teal-900/40 border-4 border-white transform transition-transform hover:scale-105 active:scale-95">
                  <Home size={28} strokeWidth={2.5} />
                </Link>
                <span className="text-[10px] font-bold text-gray-700 mt-1">Beranda</span>
              </div>

              <Link to="/profil" className={\`relative z-10 flex flex-col items-center gap-1 w-16 \${location.pathname === '/profil' ? 'text-teal-700' : 'text-gray-400 hover:text-teal-600'}\`}>
                <UserCircle size={24} strokeWidth={location.pathname === '/profil' ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Profil</span>
              </Link>
            </div>
          </div>
        )}`;

code = code.replace(targetNavbar, replacementNavbar);
code = code.replace("import { Clock, History, UserCircle } from 'lucide-react';", "import { Clock, History, UserCircle, Home } from 'lucide-react';");

fs.writeFileSync('src/layouts/EmployeeLayout.tsx', code);
console.log("Patched EmployeeLayout.tsx");
