import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { CheckCircle, AlertCircle, Calendar, Bell, Smartphone, Clock, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { indonesianLocale } from '../lib/date-locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cachedQuery } from '../lib/supabaseCache';
import { Combobox } from '../components/ui/combobox';
import { Button } from '../components/ui/button';

const DashboardMap = lazy(() => import('../components/DashboardMap'));

interface DailyStat {
  name: string;
  hadir: number;
  telat: number;
  alpha: number;
}

interface AdminNotification {
  id: string;
  type: 'device_change' | 'late_checkin';
  message: string;
  createdAt: string;
  userName?: string;
}

/** Ikon per tipe notifikasi */
function NotificationIcon({ type }: { type: AdminNotification['type'] }) {
  return type === 'device_change'
    ? <Smartphone className="text-red-500 w-5 h-5 shrink-0" />
    : <Clock className="text-yellow-500 w-5 h-5 shrink-0" />;
}

/** Potong pesan notifikasi biar tidak terlalu panjang (mobile/desktop) */
function truncateMessage(msg: string, max = 72): string {
  return msg.length > max ? msg.slice(0, max).trimEnd() + '…' : msg;
}

/** Potong nama karyawan — maksimal 10 karakter, sisanya diganti '…' */
function truncateName(name: string, max = 10): string {
  return name.length > max ? name.slice(0, max).trimEnd() + '…' : name;
}

/** Skeleton loading untuk daftar notifikasi terbaru */
function NotificationSkeleton() {
  return (
    <div className="divide-y divide-gray-100/70">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3 py-2.5">
          <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-3/4 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-3 w-1/3 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-3 w-1/4 bg-gray-200 rounded-full animate-pulse" />
          </div>
          <div className="w-12 h-4 bg-gray-200 rounded-md animate-pulse shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton placeholder for chart area */
function ChartSkeleton() {
  const heights = [45, 65, 35, 55, 70, 40, 50];
  return (
    <div className="flex-1 w-full mt-5 flex items-end justify-around gap-2 px-4">
      {heights.map((h, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full bg-gray-100 rounded-t-lg animate-pulse" style={{ height: `${h}%` }} />
          <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

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
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Fetch notifikasi admin: 48 jam terakhir (tanpa cache supaya selalu segar) ──
  const fetchNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data } = await supabase
      .from('admin_notifications')
      .select('id, type, message, created_at, user_id, users(name)')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(
      (data || []).map((n: any) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        createdAt: n.created_at,
        userName: n.users?.name || undefined,
      }))
    );
    setNotificationsLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Polling ringan — notifikasi baru (device change / absen telat) muncul
    // otomatis di dashboard tanpa perlu reload manual.
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

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

      {/* ── NOTIFIKASI / PESAN TERBARU — 48 jam terakhir ── */}
      <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-400/10 rounded-xl">
              <Bell className="text-yellow-500 w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                Pesan Terbaru
              </CardTitle>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Notifikasi 48 jam terakhir
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50 shrink-0 w-full md:w-auto"
            onClick={() => navigate('/admin/laporan?log=1')}
          >
            Lihat Semua Pesan <ChevronRight size={16} className="ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {notificationsLoading ? (
            <NotificationSkeleton />
          ) : notifications.length === 0 ? (
            <p className="text-sm text-gray-400 font-medium py-2">
              Tidak ada notifikasi dalam 48 jam terakhir.
            </p>
          ) : (
            <div className="divide-y divide-gray-100/70 max-h-72 overflow-y-auto pr-1">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 py-2.5">
                  <NotificationIcon type={n.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 leading-snug">
                      {truncateMessage(n.message)}
                    </p>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                      {format(parseISO(n.createdAt), 'dd MMM yy HH:mm', {
                        locale: indonesianLocale,
                      })}
                    </p>
                    {/* Nama karyawan — kiri bawah card, dipotong jika > 10 karakter */}
                    {n.userName && (
                      <p className="text-[11px] text-teal-700 font-semibold mt-1">
                        Oleh: {truncateName(n.userName)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase rounded-md px-2 py-0.5 ring-1 ring-inset ${
                      n.type === 'device_change'
                        ? 'bg-red-50 text-red-700 ring-red-600/20'
                        : 'bg-yellow-50 text-yellow-700 ring-yellow-600/20'
                    }`}
                  >
                    {n.type === 'device_change' ? 'Device' : 'Telat'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
          {loading ? (
            <>
              <div className="h-6 w-48 bg-gray-200 rounded-full animate-pulse mb-2" />
              <div className="flex gap-2">
                <div className="h-8 w-16 bg-gray-100 rounded-xl animate-pulse" />
                <div className="h-8 w-16 bg-gray-100 rounded-xl animate-pulse" />
              </div>
              <div className="h-4 w-64 bg-gray-100 rounded-full animate-pulse mt-3" />
              <ChartSkeleton />
            </>
          ) : (
            <>
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
            </>
          )}
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
