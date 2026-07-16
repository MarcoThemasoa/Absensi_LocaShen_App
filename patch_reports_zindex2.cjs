const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

// Ensure table wrapper has low z-index
code = code.replace(
  "className=\"overflow-x-auto px-4 md:px-6 py-0 min-h-[400px] rounded-b-3xl\"",
  "className=\"overflow-x-auto px-4 md:px-6 py-0 min-h-[400px] rounded-b-3xl relative z-10\""
);

// Ensure the top controls have high z-index
code = code.replace(
  "className=\"p-5 border-b border-gray-100/50 flex flex-col xl:flex-row justify-between gap-4 bg-white/50 backdrop-blur-sm rounded-t-3xl relative z-20\"",
  "className=\"p-5 border-b border-gray-100/50 flex flex-col xl:flex-row justify-between gap-4 bg-white/50 backdrop-blur-sm rounded-t-3xl relative z-50\""
);

// Add export log
const handleExportStr = "const handleExportCSV = () => {";
const handleExportReplace = `const handleExportCSV = () => {
    // Log export action
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const newLog = {
          id: 'log' + Date.now(),
          adminId: 'admin1',
          adminName: 'Admin HRD',
          action: 'Mengekspor data laporan absensi',
          timestamp: new Date().toISOString(),
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          locationName: 'Lokasi Perangkat Admin'
        };
        mockAdminLogs.unshift(newLog);
      });
    } else {
      mockAdminLogs.unshift({
        id: 'log' + Date.now(),
        adminId: 'admin1',
        adminName: 'Admin HRD',
        action: 'Mengekspor data laporan absensi',
        timestamp: new Date().toISOString(),
        location: { lat: -6.200000, lng: 106.816666 },
        locationName: 'Lokasi Tidak Diketahui'
      });
    }
`;
code = code.replace(handleExportStr, handleExportReplace);

// Fix file export name
const exportNameTarget = "a.download = `laporan_absensi_${filterName}_${new Date().toISOString().split('T')[0]}.csv`;";
const exportNameReplace = `
    const dateStr = format(new Date(), 'dd-MMM-yyyy', { locale: id });
    a.download = \`Laporan_Absensi_\${filterName}_\${dateStr}.csv\`;
`;
if (code.includes(exportNameTarget)) {
  code = code.replace(exportNameTarget, exportNameReplace);
}

// ensure mockAdminLogs is imported
if (!code.includes("mockAdminLogs")) {
  code = code.replace("import { mockAttendance, mockLocations } from '../lib/mockData';", "import { mockAttendance, mockLocations, mockAdminLogs } from '../lib/mockData';");
}

fs.writeFileSync('src/pages/AdminReports.tsx', code);
