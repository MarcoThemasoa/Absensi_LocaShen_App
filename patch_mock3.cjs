const fs = require('fs');
let code = fs.readFileSync('src/lib/mockData.ts', 'utf8');

const logInterface = `export interface AdminActivityLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  timestamp: string;
  location: { lat: number; lng: number };
  locationName: string;
}

export const mockAdminLogs: AdminActivityLog[] = [
  {
    id: 'log1',
    adminId: 'admin1',
    adminName: 'Admin HRD',
    action: 'Menambahkan lokasi absensi baru: Cabang Malang',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    location: { lat: -7.250445, lng: 112.768845 },
    locationName: 'Kantor Pusat Surabaya'
  },
  {
    id: 'log2',
    adminId: 'admin1',
    adminName: 'Admin HRD',
    action: 'Mengekspor data laporan absensi',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    location: { lat: -6.200000, lng: 106.816666 },
    locationName: 'Lokasi Anda Saat Ini (Tester GPS)'
  },
  {
    id: 'log3',
    adminId: 'admin1',
    adminName: 'Admin HRD',
    action: 'Menyetujui pendaftaran akun: Siti Aminah',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    location: { lat: -7.250445, lng: 112.768845 },
    locationName: 'Kantor Pusat Surabaya'
  }
];`;

code = code.replace("export const mockAttendance: AttendanceRecord[] = [", logInterface + "\n\nexport const mockAttendance: AttendanceRecord[] = [");
fs.writeFileSync('src/lib/mockData.ts', code);
