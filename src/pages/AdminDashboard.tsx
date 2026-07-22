import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from '../lib/supabaseCache';
import { Combobox } from '../components/ui/combobox';

// Fix for default marker icon in leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface DailyStat { name: string; hadir: number; telat: number; alpha: number; }

export default function AdminDashboard() {
  const { locations } = useAuth();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('semua');
  const [stats, setStats] = useState({ hadir: 0, telat: 0, cuti: 0, alpha: 0 });
  const [weeklyChart, setWeeklyChart] = useState<DailyStat[]>([]);
  const [chartRange, setChartRange] = useState<'7hari' | '30hari'>('7hari');
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    setLoading(true);

    // ——— Ambil semua attendance hari ini ———
    let attQuery = supabase
      .from('attendance_records')
      .select('user_id, status')
      .eq('date', today);

    const { data: allTodayAtt } = await cachedQuery<any[]>(`dashboard:today:${today}`, () => attQuery);
    let todayAtt = allTodayAtt || [];

    // ——— Filter berdasarkan lokasi jika dipilih ———
    let activeEmployeeIds: string[] = [];
    if (selectedLocationId !== 'semua') {
      const { data: locUsers } = await cachedQuery<any[]>(`dashboard:locUsers:${selectedLocationId}`, () =>
        supabase.from('users').select('id').eq('location_id', selectedLocationId)
      );
      const locUserIds = (locUsers || []).map(u => u.id);
      todayAtt = todayAtt.filter(a => locUserIds.includes(a.user_id));
      activeEmployeeIds = locUserIds;
    } else {
      const { data: allEmp } = await cachedQuery<any[]>('dashboard:allEmp', () =>
        supabase.from('users').select('id').eq('role', 'employee').eq('status', 'active')
      );
      activeEmployeeIds = (allEmp || []).map(u => u.id);
    }

    // ——— Hitung stats ———
    const hadir = todayAtt.filter(a => a.status === 'hadir').length;
    const telat = todayAtt.filter(a => a.status === 'telat').length;
    const cuti = todayAtt.filter(a => a.status === 'cuti').length;
    const alphaStatus = todayAtt.filter(a => a.status === 'alpha').length;
    const hadirUserIds = todayAtt.filter(a => a.status === 'hadir' || a.status === 'telat').map(a => a.user_id);
    const absentCount = activeEmployeeIds.filter(id => !hadirUserIds.includes(id)).length;
    const alpha = alphaStatus + absentCount;

    setStats({ hadir, telat, cuti, alpha });

    // ——— Grafik (7 atau 30 hari terakhir) ———
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const rangeDays = chartRange === '30hari' ? 29 : 6;
    const days: { name: string; date: string }[] = [];
    for (let i = rangeDays; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ name: dayNames[d.getDay()], date: format(d, 'yyyy-MM-dd') });
    }

    const { data: chartAtt } = await cachedQuery<any[]>(
      `dashboard:chart:${days[0].date}:${days[days.length - 1].date}`,
      () => supabase
        .from('attendance_records')
        .select('date, status')
        .gte('date', days[0].date)
        .lte('date', days[days.length - 1].date)
    );

    const chartMap = new Map(days.map(d => [d.date, { name: d.name, hadir: 0, telat: 0, alpha: 0 }]));
    for (const r of chartAtt || []) {
      const row = chartMap.get(r.date);
      if (row && r.status !== 'cuti') {
        if (r.status === 'hadir') row.hadir++;
        else if (r.status === 'telat') row.telat++;
        else if (r.status === 'alpha') row.alpha++;
      }
    }
    setWeeklyChart(Array.from(chartMap.values()));

    setLoading(false);
  }, [selectedLocationId, today, chartRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const locationOptions = [
    { label: 'Semua Cabang', value: 'semua' },
    ...locations.map(l => ({ label: l.name, value: l.id }))
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
            <p className="text-sm text-gray-500 font-medium">Memuat data...</p>
          </div>
        </div>
      ) : (
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
      )}

      <div className="grid grid-cols-1 gap-8 mt-8">
        <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] col-span-1 h-96 flex flex-col p-6">
           <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h3 className="font-bold text-2xl text-gray-900 tracking-tight">Grafik Kehadiran</h3>
                <p className="text-gray-400 text-sm mt-1.5 font-medium">
                  {selectedLocationId === 'semua'
                    ? 'Menampilkan data dari semua cabang'
                    : `Menampilkan data dari: ${locations.find(l => l.id === selectedLocationId)?.name || '-'}`}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setChartRange('7hari')} className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${chartRange === '7hari' ? 'bg-[#113129] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>7 Hari</button>
                <button onClick={() => setChartRange('30hari')} className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${chartRange === '30hari' ? 'bg-[#113129] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>30 Hari</button>
              </div>
           </div>
         <div className="flex-1 w-full mt-5">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={weeklyChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="top" height={36} />
                   <Line type="monotone" dataKey="hadir" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} name="Hadir" />
                   <Line type="monotone" dataKey="telat" stroke="#FACC15" strokeWidth={2} dot={{ fill: '#FACC15', r: 4 }} name="Telat" />
                   <Line type="monotone" dataKey="alpha" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', r: 4 }} name="Alpha" />
                </LineChart>
              </ResponsiveContainer>
            </div>
        </Card>
        <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] col-span-1 h-96 flex flex-col p-6">
           <h3 className="font-bold text-2xl text-gray-900 tracking-tight mb-4">Distribusi Lokasi</h3>
            <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 relative z-0">
              <MapContainer center={locations.length > 0 ? [locations[0].lat, locations[0].lng] : [-7.250445, 112.768845]} zoom={10} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                {locations.filter(l => l.lat && l.lng).map(loc => (
                  <Marker key={loc.id} position={[loc.lat, loc.lng]}>
                    <Popup>
                      <div className="font-bold text-sm">{loc.name}</div>
                      {loc.address && <div className="text-xs text-gray-500">{loc.address}</div>}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
        </Card>
      </div>
    </div>
  );
}
