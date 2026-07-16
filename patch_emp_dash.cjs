const fs = require('fs');
let code = fs.readFileSync('src/pages/EmployeeDashboard.tsx', 'utf8');

// Add import for mockLocations if missing
if (!code.includes('mockLocations')) {
  code = code.replace(
    "import { mockAttendance } from '../lib/mockData';",
    "import { mockAttendance, mockLocations } from '../lib/mockData';"
  );
}

// target hardcoded location
const target = `<p className="font-bold text-gray-900 text-sm flex items-center gap-1.5 justify-end bg-teal-50 px-3 py-1.5 rounded-full">
                  <MapPin size={14} className="text-teal-600"/> Kantor Pusat
                </p>`;

const replacement = `<p className="font-bold text-gray-900 text-sm flex items-center gap-1.5 justify-end bg-teal-50 px-3 py-1.5 rounded-full">
                  <MapPin size={14} className="text-teal-600"/> {mockLocations.find(l => l.id === user?.locationId)?.name || 'Kantor Pusat'}
                </p>`;

code = code.replace(target, replacement);

fs.writeFileSync('src/pages/EmployeeDashboard.tsx', code);
