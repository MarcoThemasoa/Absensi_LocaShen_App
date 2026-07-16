const fs = require('fs');

// Patch EmployeeLayout
let emp = fs.readFileSync('src/layouts/EmployeeLayout.tsx', 'utf8');

const empNavTarget = `<div className="relative px-8 pt-4 pb-6 flex justify-between items-end h-[96px]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}>
              <Link to="/riwayat" className={\`relative z-10 flex flex-col items-center justify-center gap-1 w-16 h-12 \${location.pathname === '/riwayat' ? 'text-teal-700' : 'text-gray-400 hover:text-teal-600'}\`}>
                {location.pathname === '/riwayat' && (
                  <motion.div
                    layoutId="employeeMobileNavActive"
                    className="absolute inset-0 bg-teal-100/60 backdrop-blur-md rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                )}
                <History size={24} strokeWidth={location.pathname === '/riwayat' ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Riwayat</span>
              </Link>

              {/* Center Button */}
              <div className="relative z-20 flex flex-col items-center pb-2">
                <Link to="/dashboard" className="w-14 h-14 rounded-full bg-teal-950 flex items-center justify-center text-white shadow-xl shadow-teal-900/30 transform transition-transform hover:scale-105 active:scale-95 mb-1">
                  <Home size={28} strokeWidth={2.5} />
                </Link>
                <span className="text-[10px] font-bold text-gray-700">Beranda</span>
              </div>

              <Link to="/profil" className={\`relative z-10 flex flex-col items-center justify-center gap-1 w-16 h-12 \${location.pathname === '/profil' ? 'text-teal-700' : 'text-gray-400 hover:text-teal-600'}\`}>
                {location.pathname === '/profil' && (
                  <motion.div
                    layoutId="employeeMobileNavActive"
                    className="absolute inset-0 bg-teal-100/60 backdrop-blur-md rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                )}
                <UserCircle size={24} strokeWidth={location.pathname === '/profil' ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Profil</span>
              </Link>
            </div>`;

const empNavReplacement = `<div className="relative px-8 pt-6 pb-8 flex justify-between items-center h-[100px]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}>
              <Link to="/riwayat" className={\`relative z-10 flex flex-col items-center justify-center gap-1 w-16 h-12 \${location.pathname === '/riwayat' ? 'text-teal-700' : 'text-gray-400 hover:text-teal-600'}\`}>
                {location.pathname === '/riwayat' && (
                  <motion.div
                    layoutId="employeeMobileNavActive"
                    className="absolute inset-0 bg-teal-100/60 backdrop-blur-md rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                )}
                <History size={24} strokeWidth={location.pathname === '/riwayat' ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Riwayat</span>
              </Link>

              {/* Center Button */}
              <div className="relative z-20 flex flex-col items-center mt-2">
                <Link to="/dashboard" className="w-14 h-14 rounded-2xl bg-teal-950 flex items-center justify-center text-white shadow-lg shadow-teal-900/20 transform transition-transform hover:scale-105 active:scale-95 mb-1">
                  <Home size={28} strokeWidth={2.5} />
                </Link>
                <span className="text-[10px] font-bold text-gray-700">Beranda</span>
              </div>

              <Link to="/profil" className={\`relative z-10 flex flex-col items-center justify-center gap-1 w-16 h-12 \${location.pathname === '/profil' ? 'text-teal-700' : 'text-gray-400 hover:text-teal-600'}\`}>
                {location.pathname === '/profil' && (
                  <motion.div
                    layoutId="employeeMobileNavActive"
                    className="absolute inset-0 bg-teal-100/60 backdrop-blur-md rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  />
                )}
                <UserCircle size={24} strokeWidth={location.pathname === '/profil' ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Profil</span>
              </Link>
            </div>`;
emp = emp.replace(empNavTarget, empNavReplacement);
fs.writeFileSync('src/layouts/EmployeeLayout.tsx', emp);

// Patch AdminLayout
let adm = fs.readFileSync('src/layouts/AdminLayout.tsx', 'utf8');

const admNavTarget = `<div className="relative px-4 pt-4 pb-6 flex justify-between items-end h-[96px]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}>
          {/* Left Items */}
          <div className="flex flex-1 justify-around h-full items-end pb-2">
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

          {/* Center Button (Dashboard) */}
          <div className="relative z-20 flex flex-col items-center px-2 pb-2">
            <Link to="/admin/dashboard" className="w-14 h-14 rounded-full bg-teal-950 flex items-center justify-center text-white shadow-xl shadow-teal-900/30 transform transition-transform hover:scale-105 active:scale-95 mb-1">
              <LayoutDashboard size={28} strokeWidth={2.5} />
            </Link>
            <span className="text-[10px] font-bold text-gray-700 mt-1">Dashboard</span>
          </div>

          {/* Right Items */}
          <div className="flex flex-1 justify-around h-full items-end pb-2">
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
        </div>`;

const admNavReplacement = `<div className="relative px-2 pt-6 pb-8 flex justify-between items-center h-[100px]" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}>
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

          {/* Center Button (Dashboard) */}
          <div className="relative z-20 flex flex-col items-center px-1 mt-2">
            <Link to="/admin/dashboard" className="w-14 h-14 rounded-2xl bg-teal-950 flex items-center justify-center text-white shadow-lg shadow-teal-900/20 transform transition-transform hover:scale-105 active:scale-95 mb-1">
              <LayoutDashboard size={28} strokeWidth={2.5} />
            </Link>
            <span className="text-[10px] font-bold text-gray-700">Dashboard</span>
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
        </div>`;

adm = adm.replace(admNavTarget, admNavReplacement);
fs.writeFileSync('src/layouts/AdminLayout.tsx', adm);
console.log("Patched layout spacing and center buttons.");
