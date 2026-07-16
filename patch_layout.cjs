const fs = require('fs');
let layoutCode = fs.readFileSync('src/layouts/AdminLayout.tsx', 'utf8');

layoutCode = layoutCode.replace(
  "import { LayoutDashboard, Users, MapPin, FileSpreadsheet, UserCircle } from 'lucide-react';",
  "import { LayoutDashboard, Users, MapPin, FileSpreadsheet, UserCircle, Activity } from 'lucide-react';"
);

layoutCode = layoutCode.replace(
  "{ name: 'Laporan', path: '/admin/laporan', icon: FileSpreadsheet },",
  "{ name: 'Laporan', path: '/admin/laporan', icon: FileSpreadsheet },\n    { name: 'Log Aktivitas', path: '/admin/logs', icon: Activity },"
);
fs.writeFileSync('src/layouts/AdminLayout.tsx', layoutCode);

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(
  "import AdminSettings from './pages/AdminSettings';",
  "import AdminSettings from './pages/AdminSettings';\nimport AdminLogs from './pages/AdminLogs';"
);

appCode = appCode.replace(
  "<Route path=\"/admin/pengaturan\" element={<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className=\"h-full\"><AdminSettings /></motion.div>} />",
  "<Route path=\"/admin/pengaturan\" element={<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className=\"h-full\"><AdminSettings /></motion.div>} />\n          <Route path=\"/admin/logs\" element={<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className=\"h-full\"><AdminLogs /></motion.div>} />"
);
fs.writeFileSync('src/App.tsx', appCode);
