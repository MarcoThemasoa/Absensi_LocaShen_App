import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { mockAttendance, mockLocations, mockUsers } from '../lib/mockData';
import { Combobox } from '../components/ui/combobox';

// Fix for default marker icon in leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const weeklyData = [
  { name: 'Sen', hadir: 120, telat: 10, alpha: 2 },
  { name: 'Sel', hadir: 130, telat: 8, alpha: 1 },
  { name: 'Rab', hadir: 125, telat: 12, alpha: 3 },
  { name: 'Kam', hadir: 140, telat: 5, alpha: 0 },
  { name: 'Jum', hadir: 135, telat: 7, alpha: 2 },
];

export default function AdminDashboard() {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('semua');

  const today = new Date().toISOString().split('T')[0];
  
  const stats = useMemo(() => {
    const todaysAttendance = mockAttendance.filter(a => a.date === today && (selectedLocationId === 'semua' || a.locationId === selectedLocationId));
    
    const hadir = todaysAttendance.filter(a => a.status === 'hadir').length;
    const telat = todaysAttendance.filter(a => a.status === 'telat').length;
    const cuti = todaysAttendance.filter(a => a.status === 'cuti').length;
    
    let alpha = todaysAttendance.filter(a => a.status === 'alpha').length;
    if (selectedLocationId === 'semua') {
      const activeEmployees = mockUsers.filter(u => u.role === 'employee' && u.status === 'active');
      const absentEmployeesCount = activeEmployees.filter(u => !mockAttendance.find(a => a.userId === u.id && a.date === today)).length;
      alpha += absentEmployeesCount;
    }

    return { hadir, telat, cuti, alpha };
  }, [selectedLocationId, today]);

  const locationOptions = [
    { label: 'Semua Cabang', value: 'semua' },
    ...mockLocations.map(l => ({ label: l.name, value: l.id }))
  ];

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 drop-shadow-sm">Dashboard Utama</h1>
          <p className="text-gray-500 font-medium mt-1">Ringkasan metrik absensi harian ({format(new Date(), 'dd MMMM yyyy', { locale: id })})</p>
        </div>
        <div>
          <Combobox
            options={locationOptions}
            value={selectedLocationId}
            onChange={setSelectedLocationId}
            placeholder="Pilih lokasi..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <Link to={`/admin/karyawan?status=hadir&location=${selectedLocationId}`} className="block">
          <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">Jumlah Hadir</CardTitle>
              <div className="p-2 bg-[#10B981]/10 rounded-xl">
                <CheckCircle className="text-[#10B981] w-6 h-6" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-gray-900 tracking-tighter">{stats.hadir}</div>
              <p className="text-sm text-[#10B981] font-bold mt-2">Karyawan</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link to={`/admin/karyawan?status=telat&location=${selectedLocationId}`} className="block">
          <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">Telat</CardTitle>
              <div className="p-2 bg-yellow-400/10 rounded-xl">
                <AlertCircle className="text-yellow-500 w-6 h-6" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-gray-900 tracking-tighter">{stats.telat}</div>
              <p className="text-sm text-gray-400 mt-2 font-medium">Karyawan</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={`/admin/karyawan?status=alpha&location=${selectedLocationId}`} className="block">
          <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">Alpha</CardTitle>
              <div className="p-2 bg-[#EF4444]/10 rounded-xl">
                <AlertCircle className="text-[#EF4444] w-6 h-6" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-gray-900 tracking-tighter">{stats.alpha}</div>
              <p className="text-sm text-gray-400 mt-2 font-medium">Karyawan</p>
            </CardContent>
          </Card>
        </Link>

        <Link to={`/admin/karyawan?status=cuti&location=${selectedLocationId}`} className="block">
          <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">Cuti</CardTitle>
              <div className="p-2 bg-[#113129]/10 rounded-xl">
                <Calendar className="text-[#113129] w-6 h-6" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-gray-900 tracking-tighter">{stats.cuti}</div>
              <p className="text-sm text-gray-400 mt-2 font-medium">Karyawan</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] col-span-1 h-96 flex flex-col p-6">
           <h3 className="font-bold text-lg text-gray-900 mb-4">Grafik Kehadiran Mingguan</h3>
           <div className="flex-1 w-full mt-4">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                 <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="hadir" fill="#10B981" radius={[4, 4, 0, 0]} stackId="a" name="Hadir" />
                  <Bar dataKey="telat" fill="#FACC15" radius={[4, 4, 0, 0]} stackId="a" name="Telat" />
                  <Bar dataKey="alpha" fill="#EF4444" radius={[4, 4, 0, 0]} stackId="a" name="Alpha" />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </Card>
        <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] col-span-1 h-96 flex flex-col p-6">
           <h3 className="font-bold text-lg text-gray-900 mb-4">Distribusi Lokasi</h3>
           <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 relative z-0">
             <MapContainer center={[-7.250445, 112.768845]} zoom={10} style={{ height: '100%', width: '100%', zIndex: 0 }}>
               <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
               <Marker position={[-7.250445, 112.768845]} />
               <Marker position={[-7.445214, 112.716186]} />
             </MapContainer>
           </div>
        </Card>
      </div>
    </div>
  );
}
