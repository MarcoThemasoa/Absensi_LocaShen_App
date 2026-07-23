import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { indonesianLocale } from '../lib/date-locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cachedQuery } from '../lib/supabaseCache';
import { Combobox } from '../components/ui/combobox';

const DashboardMap = lazy(() => import('../components/DashboardMap'));

interface DailyStat {
  name: string;
  hadir: number;
  telat: number;
  alpha: number;
}

/** Skeleton placeholder for stat cards — prevents layout shift while loading */
function StatCardSkeleton() {
  return (
    <div className="block">
      <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="h-4 w-24 bg-gray-200 rounded-full animate-pulse" />
          <div className="p-2 rounded-xl bg-gray-100">
            <div className="size-6" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-10 w-16 bg-gray-200 rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-20 bg-gray-200 rounded-full animate-pulse" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const { locations } = useAuth();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('semua');
  const [stats, setStats] = useState({ hadir: 0, telat: 0, cuti: 0, alpha: 0 });
  const [weeklyChart, setWeeklyChart] = useState<DailyStat[]>([]);
  const [chartRange, setChartRange] = useState<'7hari' | '30hari'>('7hari');
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Build date range for chart (needed for the chart query cache key)
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const rangeDays = chartRange === '30hari' ? 29 : 6;
    const days: { name: string; date: string }[] = [];
    for (let i = rangeDays; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ name: dayNames[d.getDay()], date: format(d, 'yyyy-MM-dd') });
    }

    // ── FIRE ALL INDEPENDENT QUERIES IN PARALLEL ──
    // Previously these ran sequentially, creating a 3.8s waterfall.
    // Now they run concurrently — total time = slowest single query.
    const [todayResult, userResult, chartResult] = await Promise.all([
      // 1. Today's attendance (user_id + status for stats)
      cachedQuery<any[]>(`dashboard:today:${today}`, () =>
        supabase
          .from('attendance_records')
          .select('user_id, status')
          .eq('date', today),
      ),

      // 2. Active employee IDs (by location or all)
      selectedLocationId !== 'semua'
        ? cachedQuery<any[]>('dashboard:locUsers:' + selectedLocationId, () =>
            supabase
              .from('users')
              .select('id')
              .eq('location_id', selectedLocationId),
          )
        : cachedQuery<any[]>('dashboard:allEmp', () =>
            supabase
              .from('users')
              .select('id')
              .eq('role', 'employee')
              .eq('status', 'active'),
          ),

      // 3. Chart data for the selected range (date + status) — filter by location too
      cachedQuery<any[]>(
        `dashboard:chart:${days[0].date}:${days[days.length - 1].date}:loc${selectedLocationId}`,
        () => {
          let query = supabase
            .from('attendance_records')
            .select('date, status, user_id')
            .gte('date', days[0].date)
            .lte('date', days[days.length - 1].date);
          return query;
        },
      ),
    ]);

    // ── PROCESS RESULTS ──
    const allTodayAtt = todayResult.data || [];
    const users = userResult.data || [];
    const chartAtt = chartResult.data || [];

    // Filter today's attendance by selected location
    const activeEmployeeIds: string[] = users.map((u: any) => u.id);
    const todayAtt =
      selectedLocationId !== 'semua'
        ? allTodayAtt.filter((a: any) => activeEmployeeIds.includes(a.user_id))
        : allTodayAtt;

    // Calculate stats
    const hadir = todayAtt.filter((a: any) => a.status === 'hadir').length;
    const telat = todayAtt.filter((a: any) => a.status === 'telat').length;
    const cuti = todayAtt.filter((a: any) => a.status === 'cuti').length;
    const alphaRecorded = todayAtt.filter(
      (a: any) => a.status === 'alpha',
    ).length;
    const hadirUserIds = todayAtt
      .filter(
        (a: any) => a.status === 'hadir' || a.status === 'telat',
      )
      .map((a: any) => a.user_id);
    const absentCount = activeEmployeeIds.filter(
      (id) => !hadirUserIds.includes(id),
    ).length;
    const alpha = alphaRecorded + absentCount;

    setStats({ hadir, telat, cuti, alpha });

    // Build chart data — filter by location's employees if a specific branch is selected
    const locationUserIds = selectedLocationId !== 'semua'
      ? new Set(activeEmployeeIds)
      : null;
    const chartMap = new Map(
      days.map((d) => [d.date, { name: d.name, hadir: 0, telat: 0, alpha: 0 }]),
    );
    for (const r of chartAtt) {
      // Skip records not belonging to the selected location's employees
      if (locationUserIds && !locationUserIds.has(r.user_id)) continue;
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const locationOptions = [
    { label: 'Semua Cabang', value: 'semua' },
    ...locations.map((l) => ({ label: l.name, value: l.id })),
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* ── HEADER — renders immediately, never blocked by data ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 drop-shadow-sm">
            Dashboard Utama
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            Ringkasan metrik absensi harian (
            {format(new Date(), 'dd MMMM yyyy', {
              locale: indonesianLocale,
            })}
            )
          </p>
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

      {/* ── STAT CARDS — skeleton placeholder while loading, real cards when ready ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {loading
          ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          )
          : (
            <>
              <Link
                to={`/admin/karyawan?status=hadir&location=${selectedLocationId}`}
                className="block"
              >
                <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                      Jumlah Hadir
                    </CardTitle>
                    <div className="p-2 bg-[#10B981]/10 rounded-xl">
                      <CheckCircle className="text-[#10B981] w-6 h-6" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-black text-gray-900 tracking-tighter">
                      {stats.hadir}
                    </div>
                    <p className="text-sm text-[#10B981] font-bold mt-2">
                      Karyawan
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link
                to={`/admin/karyawan?status=telat&location=${selectedLocationId}`}
                className="block"
              >
                <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                      Telat
                    </CardTitle>
                    <div className="p-2 bg-yellow-400/10 rounded-xl">
                      <AlertCircle className="text-yellow-500 w-6 h-6" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-black text-gray-900 tracking-tighter">
                      {stats.telat}
                    </div>
                    <p className="text-sm text-gray-400 mt-2 font-medium">
                      Karyawan
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link
                to={`/admin/karyawan?status=alpha&location=${selectedLocationId}`}
                className="block"
              >
                <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                      Alpha
                    </CardTitle>
                    <div className="p-2 bg-[#EF4444]/10 rounded-xl">
                      <AlertCircle className="text-[#EF4444] w-6 h-6" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-black text-gray-900 tracking-tighter">
                      {stats.alpha}
                    </div>
                    <p className="text-sm text-gray-400 mt-2 font-medium">
                      Karyawan
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link
                to={`/admin/karyawan?status=cuti&location=${selectedLocationId}`}
                className="block"
              >
                <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                      Cuti
                    </CardTitle>
                    <div className="p-2 bg-[#113129]/10 rounded-xl">
                      <Calendar className="text-[#113129] w-6 h-6" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-black text-gray-900 tracking-tighter">
                      {stats.cuti}
                    </div>
                    <p className="text-sm text-gray-400 mt-2 font-medium">
                      Karyawan
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </>
          )}
      </div>

      {/* ── CHART + MAP — always rendered with reserved space (min-h prevents CLS) ── */}
      <div className="grid grid-cols-1 gap-8 mt-8">
        <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] col-span-1 min-h-96 flex flex-col p-6">
          <div className="mb-2">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-bold text-2xl text-gray-900 tracking-tight">
                Grafik Kehadiran
              </h3>
              <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                <button
                  onClick={() => setChartRange('7hari')}
                  className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${
                    chartRange === '7hari'
                      ? 'bg-[#113129] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  7 Hari
                </button>
                <button
                  onClick={() => setChartRange('30hari')}
                  className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${
                    chartRange === '30hari'
                      ? 'bg-[#113129] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  30 Hari
                </button>
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-3 font-medium leading-relaxed">
              {selectedLocationId === 'semua'
                ? 'Menampilkan data dari semua cabang'
                : `Menampilkan data dari: ${locations.find((l) => l.id === selectedLocationId)?.name || '-'}`}
            </p>
          </div>
          <div className="flex-1 w-full mt-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={weeklyChart}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                />
                <Tooltip
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Line
                  type="monotone"
                  dataKey="hadir"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={isMobile ? false : { fill: '#10B981', r: 4 }}
                  name="Hadir"
                />
                <Line
                  type="monotone"
                  dataKey="telat"
                  stroke="#FACC15"
                  strokeWidth={2}
                  dot={isMobile ? false : { fill: '#FACC15', r: 4 }}
                  name="Telat"
                />
                <Line
                  type="monotone"
                  dataKey="alpha"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={isMobile ? false : { fill: '#EF4444', r: 4 }}
                  name="Alpha"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] col-span-1 min-h-96 flex flex-col p-6">
          <h3 className="font-bold text-2xl text-gray-900 tracking-tight mb-4">
            Distribusi Lokasi
          </h3>
          <div className="flex-1 rounded-2xl overflow-hidden border border-gray-200 relative z-0">
            <Suspense
              fallback={
                <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-2xl">
                  <div className="size-6 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                </div>
              }
            >
              <DashboardMap locations={locations} />
            </Suspense>
          </div>
        </Card>
      </div>
    </div>
  );
}
