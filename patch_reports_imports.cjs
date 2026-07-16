const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

code = code.replace("import { mockAttendance, mockLocations } from '../lib/mockData';", "import { mockAttendance, mockLocations, mockAdminLogs } from '../lib/mockData';");
code = code.replace("import { Download, Search, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';", "import { Download, Search, Maximize2, ChevronLeft, ChevronRight, Activity, Clock, MapPin } from 'lucide-react';");

fs.writeFileSync('src/pages/AdminReports.tsx', code);
console.log("Patched AdminReports.tsx imports");
