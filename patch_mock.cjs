const fs = require('fs');
let code = fs.readFileSync('src/lib/mockData.ts', 'utf8');

const targetUsers = `export const mockUsers: User[] = [
  { id: '1', name: 'Budi Santoso', role: 'employee', position: 'Staf Kantor', locationId: 'loc1', status: 'active' },
  { id: '2', name: 'Siti Aminah', role: 'employee', position: 'Tim Marketing', locationId: 'loc1', status: 'pending' },
  { id: '3', name: 'Agus Pratama', role: 'employee', position: 'Teknisi Lapangan', locationId: 'loc2', status: 'active' },
  { id: '4', name: 'Rina Melati', role: 'employee', position: 'Staf Kantor', locationId: 'loc1', status: 'active' },
  { id: '5', name: 'Joko Widodo', role: 'employee', position: 'Teknisi Lapangan', locationId: 'loc2', status: 'active' },
  { id: 'admin1', name: 'Admin HRD', role: 'admin', position: 'HR Manager', locationId: 'loc1', status: 'active' },
];`;

const replacementUsers = `export const mockUsers: User[] = [
  { id: '1', name: 'Budi Santoso', role: 'employee', position: 'Staf Administrasi', locationId: 'loc1', status: 'active' },
  { id: '2', name: 'Siti Aminah', role: 'employee', position: 'Tim Marketing', locationId: 'loc1', status: 'pending' },
  { id: '3', name: 'Agus Pratama', role: 'employee', position: 'Teknisi Lapangan', locationId: 'loc2', status: 'active' },
  { id: '4', name: 'Rina Melati', role: 'employee', position: 'Staf Keuangan', locationId: 'loc1', status: 'active' },
  { id: '5', name: 'Joko Widodo', role: 'employee', position: 'Teknisi Lapangan', locationId: 'loc2', status: 'active' },
  { id: '6', name: 'Rudi Hermawan', role: 'employee', position: 'Customer Service', locationId: 'loc1', status: 'active' },
  { id: '7', name: 'Maya Sari', role: 'employee', position: 'HR Staff', locationId: 'loc1', status: 'active' },
  { id: '8', name: 'Bambang Pamungkas', role: 'employee', position: 'Security', locationId: 'loc1', status: 'active' },
  { id: '9', name: 'Diana Putri', role: 'employee', position: 'Staf IT', locationId: 'loc1', status: 'active' },
  { id: '10', name: 'Andi Saputra', role: 'employee', position: 'Kurir', locationId: 'loc2', status: 'active' },
  { id: '11', name: 'Nina Wati', role: 'employee', position: 'Sales', locationId: 'loc2', status: 'active' },
  { id: '12', name: 'Eko Prasetyo', role: 'employee', position: 'Gudang', locationId: 'loc2', status: 'active' },
  { id: '13', name: 'Dewi Lestari', role: 'employee', position: 'Admin Gudang', locationId: 'loc2', status: 'active' },
  { id: '14', name: 'Fajar Nugraha', role: 'employee', position: 'Quality Control', locationId: 'loc2', status: 'active' },
  { id: '15', name: 'Ahmad Dahlan', role: 'employee', position: 'Staf Tester', locationId: 'loc-current', status: 'active' },
  { id: 'admin1', name: 'Admin HRD', role: 'admin', position: 'HR Manager', locationId: 'loc1', status: 'active' },
];`;

const targetLocations = `export const mockLocations: OfficeLocation[] = [
  { id: 'loc1', name: 'Kantor Pusat Surabaya', address: 'Gedung Sate, Surabaya', lat: -7.250445, lng: 112.768845, radius: 100 },
  { id: 'loc2', name: 'Cabang Sidoarjo', address: 'Alun-alun Sidoarjo', lat: -7.445214, lng: 112.716186, radius: 200 },
];`;

const replacementLocations = `export const mockLocations: OfficeLocation[] = [
  { id: 'loc1', name: 'Kantor Pusat Surabaya', address: 'Gedung Sate, Surabaya', lat: -7.250445, lng: 112.768845, radius: 100 },
  { id: 'loc2', name: 'Cabang Sidoarjo', address: 'Alun-alun Sidoarjo', lat: -7.445214, lng: 112.716186, radius: 200 },
  { id: 'loc-current', name: 'Lokasi Anda Saat Ini (Tester GPS)', address: 'Lokasi Dinamis (Otomatis menyesuaikan GPS)', lat: -6.200000, lng: 106.816666, radius: 200 },
];

if (typeof navigator !== 'undefined' && navigator.geolocation) {
  navigator.geolocation.getCurrentPosition((pos) => {
    const testerLoc = mockLocations.find(l => l.id === 'loc-current');
    if (testerLoc) {
      testerLoc.lat = pos.coords.latitude;
      testerLoc.lng = pos.coords.longitude;
    }
  }, (err) => console.log('Geolocation error (mockData):', err));
}`;

const targetAttendance = `export const mockAttendance: AttendanceRecord[] = [
  {
    id: 'att1',
    userId: '1',
    userName: 'Budi Santoso',`;

const replacementAttendance = `export const mockAttendance: AttendanceRecord[] = [
  {
    id: 'att-test',
    userId: '15',
    userName: 'Ahmad Dahlan',
    date: formatDate(today),
    timeIn: '08:00',
    status: 'hadir',
    location: { lat: -6.200000, lng: 106.816666 },
    locationId: 'loc-current',
  },
  {
    id: 'att1',
    userId: '1',
    userName: 'Budi Santoso',`;

code = code.replace(targetUsers, replacementUsers);
code = code.replace(targetLocations, replacementLocations);
code = code.replace(targetAttendance, replacementAttendance);
fs.writeFileSync('src/lib/mockData.ts', code);
