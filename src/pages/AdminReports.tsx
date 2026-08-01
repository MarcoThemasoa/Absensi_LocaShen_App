import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cachedQuery } from '../lib/supabaseCache';
import { Download, Search, Maximize2, ChevronLeft, ChevronRight, Activity, Clock, MapPin, ShieldAlert, ShieldCheck, Smartphone, Bell } from 'lucide-react';
import { FACE_MATCH_DISTANCE } from '../lib/faceApi';
import { format, parseISO } from 'date-fns';
import { indonesianLocale } from '../lib/date-locale';
import { Combobox } from '../components/ui/combobox';
import { AttendanceRecord } from '../types';
import { useSearchParams } from 'react-router-dom';

/** Format time string → HH:mm (24 jam, leading zero) */
function fmtTime(t: string | null | undefined): string {
  if (!t) return '-';
  const [h, m] = t.split(':');
  return `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;
}

/** Download CSV helper — reusable untuk reports & logs */
function downloadCSV(headers: string[], rows: string[], filename: string) {
  const csvString = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Status badge — 3 varian: compact (card mobile), dialog, table */
function StatusBadge({ status, isForgotClockOut, variant = 'table' }: {
  status: string;
  isForgotClockOut?: boolean;
  variant?: 'compact' | 'dialog' | 'table';
}) {
  const colors: Record<string, { bg: string; text: string; ring: string }> = {
    hadir: { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20' },
    telat: { bg: 'bg-yellow-50', text: 'text-yellow-700', ring: 'ring-yellow-600/20' },
    cuti: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-600/20' },
    alpha: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20' },
  };
  const c = colors[status] || colors.alpha;

  const cls = variant === 'compact'
    ? { badge: 'rounded-md px-2 py-0.5 text-[10px]', forgot: 'rounded-md px-1.5 py-0.5 text-[10px]' }
    : variant === 'dialog'
    ? { badge: 'rounded-lg px-2.5 py-1 text-xs', forgot: 'rounded-lg px-2.5 py-1 text-xs' }
    : { badge: 'rounded-xl px-3 py-1.5 text-xs shadow-sm tracking-wider', forgot: 'rounded-xl px-2 py-1 text-xs shadow-sm tracking-wider' };

  const label = variant === 'compact'
    ? (status === 'hadir' ? 'H' : status === 'telat' ? 'T' : status === 'cuti' ? 'C' : 'A')
    : (status === 'hadir' ? 'Hadir' : status === 'telat' ? 'Telat' : status === 'cuti' ? 'Cuti' : 'Alpha');

  return (
    <div className="flex items-center justify-center gap-1.5">
      {isForgotClockOut && (
        <span className={`inline-flex items-center ${cls.forgot} font-bold uppercase bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20`}>
          {variant === 'compact' ? 'LK' : 'Lupa'}
        </span>
      )}
      <span className={`inline-flex items-center ${cls.badge} font-bold uppercase ${c.bg} ${c.text} ${c.ring}`}>
        {label}
      </span>
    </div>
  );
}

/** Badge absen mencurigakan — lapisan verifikasi (wajah/liveness/device). */
function SuspiciousBadge({ isSuspicious, variant = 'table' }: {
  isSuspicious?: boolean;
  variant?: 'compact' | 'dialog' | 'table';
}) {
  if (!isSuspicious) return null;
  const cls = variant === 'compact'
    ? 'rounded-md px-2 py-0.5 text-[10px]'
    : variant === 'dialog'
    ? 'rounded-lg px-2.5 py-1 text-xs'
    : 'rounded-xl px-3 py-1.5 text-xs shadow-sm tracking-wider';
  const label = variant === 'compact' ? 'Mencurigakan' : 'Mencurigakan';
  return (
    <span className={`inline-flex items-center gap-1 ${cls} font-bold uppercase bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/30`}>
      <ShieldAlert size={variant === 'compact' ? 10 : 12} />
      {label}
    </span>
  );
}

/** Pagination controls — reusable untuk reports & logs */
function PaginationControls({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange, size = 'md' }: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  size?: 'sm' | 'md';
}) {
  if (totalPages <= 1) return null;
  const isSm = size === 'sm';
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={`${isSm ? 'p-3' : 'p-4'} border-t border-gray-100/50 flex items-center justify-between gap-4 bg-gray-50/30 ${isSm ? 'shrink-0' : ''}`}>
      <p className={`${isSm ? 'text-xs' : 'text-sm'} text-gray-500 font-medium hidden sm:block`}>
        Menampilkan {start} - {end} dari {totalItems} data
      </p>
      <p className={`${isSm ? 'text-xs' : 'text-sm'} text-gray-500 font-medium sm:hidden`}>
        {start}-{end} dari {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className={`${isSm ? 'rounded-lg w-8 h-8' : 'rounded-xl w-9 h-9'} border-gray-200`} onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
          <ChevronLeft size={isSm ? 14 : 16} />
        </Button>
        <div className={`${isSm ? 'text-xs' : 'text-sm'} font-bold text-gray-700 px-2 flex items-center whitespace-nowrap`}>
          {currentPage} / {totalPages}
        </div>
        <Button variant="outline" size="icon" className={`${isSm ? 'rounded-lg w-8 h-8' : 'rounded-xl w-9 h-9'} border-gray-200`} onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
          <ChevronRight size={isSm ? 14 : 16} />
        </Button>
      </div>
    </div>
  );
}

interface AdminActivityLog {
  id: string; adminId: string; adminName: string; action: string;
  timestamp: string; location: { lat: number; lng: number }; locationName: string;
  source: 'admin' | 'device' | 'late';
  adminCabang?: string; // nama cabang user (dari users.location_id)
  device?: string;      // jenis perangkat: Windows / Android / dll
}

export default function AdminReports() {
  const { locations } = useAuth();
  const [reports, setReports] = useState<AttendanceRecord[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'1hari' | '7hari' | '1bulan' | 'semua'>('semua');
  const [locationFilter, setLocationFilter] = useState<string>('');
  const [searchParams] = useSearchParams();
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Export Dialog State
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportLocation, setExportLocation] = useState<string>('');
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');

  // Log Aktivitas State — default hari ini (sesuai permintaan admin)
  const [logTimeFilter, setLogTimeFilter] = useState<'1hari' | '7hari' | '1bulan' | 'semua'>('1hari');
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const logsPerPage = 15;

  // Auto-buka dialog Log Aktivitas kalau URL ada ?log=1
  // (dipakai tombol "Lihat Semua Pesan" di Dashboard admin)
  useEffect(() => {
    if (searchParams.get('log') === '1') {
      setIsLogDialogOpen(true);
    }
  }, [searchParams]);

  /** Hitung tanggal awal berdasarkan filter */
  function getStartDate(filter: '1hari' | '7hari' | '1bulan' | 'semua'): string | null {
    if (filter === 'semua') return null;
    const days = filter === '1hari' ? 1 : filter === '7hari' ? 7 : 30;
    return new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  }

  // Fetch attendance & logs from Supabase (cached + server-side filter)
  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      setLogLoading(true);

      const startDate = getStartDate(timeFilter);
      const logStartDate = getStartDate(logTimeFilter);

      const attCacheKey = `reports:attendance:${timeFilter}`;
      const logCacheKey = `reports:logs:${logTimeFilter}`;

      const [attResult, userResult, logResult, notifResult] = await Promise.all([
        cachedQuery<any[]>(attCacheKey, () => {
          let query = supabase
            .from('attendance_records')
            .select('id, user_id, date, time_in, time_out, status, location_lat, location_lng, photo_url, is_forgot_clock_out, face_match_score, liveness_passed, is_suspicious')
            .order('date', { ascending: false })
            .limit(200);
          if (startDate) query = query.gte('date', startDate);
          return query;
        }, 180_000),
        cachedQuery<any[]>('reports:users', () =>
          supabase.from('users').select('id, name, role, status, location_id')
        ),
        cachedQuery<any[]>(logCacheKey, () => {
          let query = supabase
            .from('admin_activity_logs')
            .select('id, admin_id, action, action_timestamp, location_lat, location_lng, location_name, device')
            .order('action_timestamp', { ascending: false })
            .limit(200);
          if (logStartDate) query = query.gte('action_timestamp', logStartDate);
          return query;
        }),
        // Notifikasi admin (device change / absen telat) — digabung ke timeline log
        cachedQuery<any[]>(`reports:notifs:${logTimeFilter}`, () => {
          let query = supabase
            .from('admin_notifications')
            .select('id, type, user_id, message, created_at')
            .order('created_at', { ascending: false })
            .limit(200);
          if (logStartDate) query = query.gte('created_at', logStartDate);
          return query;
        }, 30_000),
      ]);

      const userData = userResult.data || [];
      const userMap = new Map(userData.map((u: any) => [u.id, u]));
      // Map lokasi: location_id → nama cabang (untuk format "Oleh {Nama} - {Cabang}")
      const locationNameById = new Map(locations.map((loc) => [loc.id, loc.name]));

      const resolveCabang = (user: any): string => {
        if (!user?.location_id) return '';
        return locationNameById.get(user.location_id) || '';
      };

      if (attResult.data && attResult.data.length > 0) {
        setReports(attResult.data.map((a: any) => {
          const user = userMap.get(a.user_id);
          return {
            id: a.id, userId: a.user_id, userName: user?.name || '',
            date: a.date, timeIn: a.time_in || '', timeOut: a.time_out || '',
            status: a.status, location: { lat: a.location_lat || -7.250445, lng: a.location_lng || 112.768845 },
            locationId: user?.location_id || undefined,
            photoUrl: a.photo_url || undefined,
            isForgotClockOut: a.is_forgot_clock_out || false,
            faceMatchScore: a.face_match_score ?? null,
            livenessPassed: a.liveness_passed ?? null,
            isSuspicious: a.is_suspicious || false,
          };
        }));
      } else {
        setReports([]);
      }

      const logData = logResult.data || [];
      if (logData.length > 0) {
        setAdminLogs(logData.map((l: any) => {
          const admin = userMap.get(l.admin_id);
          return {
            id: l.id, adminId: l.admin_id, adminName: admin?.name || '',
            action: l.action, timestamp: l.action_timestamp,
            location: { lat: l.location_lat || 0, lng: l.location_lng || 0 },
            locationName: l.location_name || '',
            source: 'admin' as const,
            adminCabang: resolveCabang(admin),
            device: l.device || undefined,
          };
        }));
      } else {
        setAdminLogs([]);
      }

      // Gabung notifikasi admin (device change / absen telat) ke timeline log,
      // lalu urutkan dari yang terbaru.
      const notifData = notifResult.data || [];
      const notifLogs: AdminActivityLog[] = notifData.map((n: any) => {
        const emp = userMap.get(n.user_id);
        return {
          id: n.id, adminId: '', adminName: emp?.name || '',
          action: n.message, timestamp: n.created_at,
          location: { lat: 0, lng: 0 }, locationName: '',
          source: n.type === 'device_change' ? 'device' as const : 'late' as const,
          adminCabang: resolveCabang(emp),
        };
      });

      if (notifLogs.length > 0) {
        setAdminLogs(prev => [...prev, ...notifLogs].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ));
      }

      setLogLoading(false);
      setLoading(false);
    }
    fetchReports();
  }, [timeFilter, logTimeFilter, locations]);

  useEffect(() => {
    setLogCurrentPage(1);
  }, [logTimeFilter]);

  const logTotalPages = Math.ceil(adminLogs.length / logsPerPage);
  const paginatedLogs = adminLogs.slice(
    (logCurrentPage - 1) * logsPerPage,
    logCurrentPage * logsPerPage
  );

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      if (searchQuery && !report.userName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (locationFilter && report.locationId !== locationFilter) return false;
      return true;
    });
  }, [reports, searchQuery, locationFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, timeFilter, locationFilter]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExportCSV = () => {
    // Log export action
    setAdminLogs(prev => [{
      id: 'log' + Date.now(),
      adminId: 'admin1',
      adminName: 'Admin HRD',
      action: 'Mengekspor data laporan absensi',
      timestamp: new Date().toISOString(),
      location: { lat: -6.200000, lng: 106.816666 },
      locationName: 'Lokasi Perangkat Admin',
      source: 'admin'
    }, ...prev]);

    const reportsToExport = reports.filter(report => {
      if (exportLocation && report.locationId !== exportLocation) return false;
      if (exportStartDate && new Date(report.date) < new Date(exportStartDate)) return false;
      if (exportEndDate) {
        const end = new Date(exportEndDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(report.date) > end) return false;
      }
      return true;
    });

    const headers = ['ID', 'Tanggal', 'Nama', 'Jam Masuk', 'Jam Keluar', 'Status', 'Lokasi', 'Kecocokan Wajah', 'Verifikasi'];
    const rows = reportsToExport.map(r => {
      const locName = locations.find(l => l.id === r.locationId)?.name || '';
      const faceStr = (r.faceMatchScore !== null && r.faceMatchScore !== undefined)
        ? (r.faceMatchScore < FACE_MATCH_DISTANCE ? 'Cocok' : `Mencurigakan (${r.faceMatchScore.toFixed(3)})`)
        : '-';
      const verifyStr = r.isSuspicious ? 'Mencurigakan' : 'Normal';
      return `${r.id},${r.date},"${r.userName}",${r.timeIn},${r.timeOut || ''},${r.status},"${locName}","${faceStr}","${verifyStr}"`;
    });
    const dateStr = format(new Date(), 'dd-MMM-yyyy', { locale: indonesianLocale });
    const filterName = (exportStartDate && exportEndDate) ? `${exportStartDate}_to_${exportEndDate}` : 'custom';
    downloadCSV(headers, rows, `Laporan_Absensi_${filterName}_${dateStr}.csv`);
    setIsExportDialogOpen(false);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 drop-shadow-sm">Laporan & Audit Absensi</h1>
          <p className="text-gray-500 font-medium mt-1">Log absensi seluruh karyawan dan verifikasi foto bukti.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
            <DialogTrigger>
              <Button variant="outline" className="rounded-xl h-11 px-6 shadow-sm border-gray-200 hover:bg-gray-50 text-gray-700 font-medium w-full md:w-auto">
                <Activity size={20} className="mr-2 text-[#113129]" /> Log Aktivitas
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[800px] w-[calc(100vw-32px)] rounded-3xl border-gray-100 bg-white shadow-xl p-0 overflow-hidden mx-auto h-[80vh] flex flex-col">
              <DialogHeader className="p-6 pb-2 shrink-0 border-b border-gray-100/50">
                <DialogTitle className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                  <Activity className="text-yellow-400" size={24} /> Log Aktivitas Admin
                </DialogTitle>
                <div className="flex flex-wrap gap-2 items-center mt-4 pt-2">
                  <Button variant={logTimeFilter === '1hari' ? 'default' : 'outline'} className={logTimeFilter === '1hari' ? 'bg-[#113129] text-white rounded-xl' : 'rounded-xl'} size="default" onClick={() => setLogTimeFilter('1hari')}>1 Hari</Button>
                  <Button variant={logTimeFilter === '7hari' ? 'default' : 'outline'} className={logTimeFilter === '7hari' ? 'bg-[#113129] text-white rounded-xl' : 'rounded-xl'} size="default" onClick={() => setLogTimeFilter('7hari')}>7 Hari</Button>
                  <Button variant={logTimeFilter === '1bulan' ? 'default' : 'outline'} className={logTimeFilter === '1bulan' ? 'bg-[#113129] text-white rounded-xl' : 'rounded-xl'} size="default" onClick={() => setLogTimeFilter('1bulan')}>1 Bulan</Button>
                  <Button variant={logTimeFilter === 'semua' ? 'default' : 'outline'} className={logTimeFilter === 'semua' ? 'bg-[#113129] text-white rounded-xl' : 'rounded-xl'} size="default" onClick={() => setLogTimeFilter('semua')}>Semua</Button>
                </div>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {logLoading ? (
                  // Skeleton loading — tampilkan placeholder shimmer sambil fetch
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="h-3.5 w-3/5 bg-gray-200 rounded-full animate-pulse" />
                        <div className="h-5 w-14 bg-gray-200 rounded-md animate-pulse" />
                      </div>
                      <div className="h-3 w-1/4 bg-gray-100 rounded-full animate-pulse mb-3" />
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-24 bg-gray-100 rounded-full animate-pulse" />
                        <div className="h-3 w-20 bg-gray-100 rounded-full animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : paginatedLogs.length > 0 ? paginatedLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{log.action}</h3>
                      {log.source !== 'admin' && (
                        <span className={`shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${
                          log.source === 'device'
                            ? 'bg-red-50 text-red-700 ring-red-600/20'
                            : 'bg-yellow-50 text-yellow-700 ring-yellow-600/20'
                        }`}>
                          {log.source === 'device'
                            ? <><Smartphone size={10} /> Device</>
                            : <><Bell size={10} /> Telat</>}
                        </span>
                      )}
                    </div>
                    {log.adminName && (
                      <p className="text-xs text-gray-500 font-medium mb-1.5">
                        Oleh {log.adminName}
                        {log.adminCabang ? ` - ${log.adminCabang}` : ''}
                        {log.device ? ` (${log.device})` : ''}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-[#113129] shrink-0" />
                        {format(parseISO(log.timestamp), 'dd MMM yy HH:mm', { locale: indonesianLocale })}
                      </span>
                      {log.locationName && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-[#113129] shrink-0" />
                          {log.locationName}
                        </span>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="h-32 flex items-center justify-center text-center text-gray-500 font-medium">
                    Tidak ada log aktivitas yang sesuai dengan filter.
                  </div>
                )}
              </div>
              
              <PaginationControls
                currentPage={logCurrentPage}
                totalPages={logTotalPages}
                totalItems={adminLogs.length}
                itemsPerPage={logsPerPage}
                onPageChange={setLogCurrentPage}
                size="sm"
              />
              
              <div className="p-4 shrink-0 border-t border-gray-100">
                <Button className="w-full bg-[#113129] hover:bg-[#1a4a3d] text-white rounded-xl h-11 font-bold" onClick={() => {
                  const dateStr = format(new Date(), 'dd-MMM-yyyy', { locale: indonesianLocale });
                  downloadCSV(
                    ['ID', 'Waktu', 'Oleh', 'Cabang', 'Perangkat', 'Tindakan', 'Lokasi'],
                    adminLogs.map(l => `${l.id},${l.timestamp},"Oleh ${l.adminName}","${l.adminCabang || ''}","${l.device || ''}","${l.action}","${l.locationName}"`),
                    `Log_Aktivitas_${dateStr}.csv`
                  );
                }}>
                  <Download size={18} className="mr-2" /> Unduh CSV Log Aktivitas
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger>
              <Button className="rounded-xl h-11 px-6 shadow-md bg-[#113129] hover:bg-[#1a4a3d] text-white font-medium w-full md:w-auto">
                <Download size={20} className="mr-2" /> Ekspor CSV
              </Button>
            </DialogTrigger>
          <DialogContent className="w-[calc(100vw-32px)] max-w-md rounded-3xl border-gray-100 bg-white shadow-xl p-6 overflow-hidden mx-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">Ekspor Laporan</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-5 py-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Pilih Cabang (Opsional)</label>
                <Combobox
                  options={[{ label: 'Semua Cabang', value: '' }, ...locations.map(l => ({ label: l.name, value: l.id }))]}
                  value={exportLocation}
                  onChange={setExportLocation}
                  placeholder="Semua Cabang"
                />
              </div>
              <div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-gray-700">Rentang Waktu (Opsional)</label>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-gray-500 font-medium">Dari Tanggal</span>
                    <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#113129] bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-gray-500 font-medium">Sampai Tanggal</span>
                    <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#113129] bg-white" />
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={handleExportCSV} className="w-full bg-[#113129] hover:bg-[#1a4a3d] text-white rounded-xl h-12 font-bold mt-2">Unduh CSV</Button>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-visible p-0">
          <CardContent className="p-0">
            <div className="p-5 border-b border-gray-100/50">
              <div className="flex flex-col xl:flex-row gap-4">
                <div className="h-10 w-full md:w-64 bg-gray-100 rounded-xl animate-pulse" />
                <div className="h-10 w-full md:w-64 bg-gray-100 rounded-xl animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-10 w-20 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="h-10 w-20 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="h-10 w-20 bg-gray-100 rounded-xl animate-pulse" />
                  <div className="h-10 w-20 bg-gray-100 rounded-xl animate-pulse" />
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6 space-y-3">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="h-24 bg-gray-50 rounded-2xl animate-pulse" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
      <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-visible p-0">
        <CardContent className="p-0">
          <div className="p-5 border-b border-gray-100/50 flex flex-col xl:flex-row justify-between gap-4 bg-white/50 backdrop-blur-sm rounded-t-3xl relative z-50">
            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Cari nama karyawan..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#113129] transition-all shadow-sm h-10" 
                />
              </div>
              <div className="w-full md:w-64 relative">
                <Combobox
                  options={[{ label: 'Semua Cabang', value: '' }, ...locations.map(l => ({ label: l.name, value: l.id }))]}
                  value={locationFilter}
                  onChange={setLocationFilter}
                  placeholder="Filter Cabang"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant={timeFilter === '1hari' ? 'default' : 'outline'} className={timeFilter === '1hari' ? 'bg-[#113129] text-white rounded-xl' : 'rounded-xl'} size="default" onClick={() => setTimeFilter('1hari')}>1 Hari</Button>
              <Button variant={timeFilter === '7hari' ? 'default' : 'outline'} className={timeFilter === '7hari' ? 'bg-[#113129] text-white rounded-xl' : 'rounded-xl'} size="default" onClick={() => setTimeFilter('7hari')}>7 Hari</Button>
              <Button variant={timeFilter === '1bulan' ? 'default' : 'outline'} className={timeFilter === '1bulan' ? 'bg-[#113129] text-white rounded-xl' : 'rounded-xl'} size="default" onClick={() => setTimeFilter('1bulan')}>1 Bulan</Button>
              <Button variant={timeFilter === 'semua' ? 'default' : 'outline'} className={timeFilter === 'semua' ? 'bg-[#113129] text-white rounded-xl' : 'rounded-xl'} size="default" onClick={() => setTimeFilter('semua')}>Semua</Button>
            </div>
          </div>
          {/* Card List - mobile */}
          <div className="flex flex-col gap-3 p-4 md:p-6 xl:hidden">
            {paginatedReports.length > 0 ? paginatedReports.map((report) => {
              const locationName = locations.find(l => l.id === report.locationId)?.name || '-';
              return (
                <Dialog key={report.id}>
                  <DialogTrigger>
                    <div className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-gray-900">{report.userName}</span>
                        <span className="shrink-0 text-[10px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1 whitespace-nowrap">
                          {format(parseISO(report.date), 'dd MMM yyyy', { locale: indonesianLocale })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-[#113129] min-w-0">
                          <MapPin size={14} className="shrink-0" />
                          <span className="truncate max-w-[15ch]">{locationName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={report.status} isForgotClockOut={report.isForgotClockOut} variant="compact" />
                          <SuspiciousBadge isSuspicious={report.isSuspicious} variant="compact" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock size={13} className="shrink-0 text-[#113129]" />
                        <span>{fmtTime(report.timeIn)}</span>
                        {report.timeOut && <span>— {fmtTime(report.timeOut)}</span>}
                      </div>
                      {report.faceMatchScore !== null && report.faceMatchScore !== undefined && (
                        <div className="flex items-center gap-1 mt-1">
                          {report.faceMatchScore < FACE_MATCH_DISTANCE ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-green-700">
                              <ShieldCheck size={10} /> Wajah Cocok
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-700">
                              <ShieldAlert size={10} /> Wajah Mencurigakan
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-3xl border-white/60 bg-white/90 backdrop-blur-2xl shadow-[0_20px_60px_rgb(0,0,0,0.1)] p-6">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">{report.userName}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 mt-2">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-400 font-medium text-xs">Tanggal</p>
                          <p className="font-bold text-gray-900">{format(parseISO(report.date), 'dd MMM yyyy', { locale: indonesianLocale })}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium text-xs">Status</p>
                          <StatusBadge status={report.status} isForgotClockOut={report.isForgotClockOut} variant="dialog" />
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium text-xs">Jam Masuk</p>
                          <p className="font-bold text-gray-900">{fmtTime(report.timeIn)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium text-xs">Jam Keluar</p>
                          <p className="font-bold text-gray-900">{fmtTime(report.timeOut)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-400 font-medium text-xs">Cabang</p>
                          <p className="font-bold text-gray-900">{locationName}</p>
                        </div>
                        {report.faceMatchScore !== null && report.faceMatchScore !== undefined && (
                          <div className="col-span-2">
                            <p className="text-gray-400 font-medium text-xs">Kecocokan Wajah</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {report.faceMatchScore < FACE_MATCH_DISTANCE ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                  <ShieldCheck size={12} /> Cocok (skor: {report.faceMatchScore.toFixed(3)})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                  <ShieldAlert size={12} /> Mencurigakan (skor: {report.faceMatchScore.toFixed(3)})
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {report.livenessPassed !== null && report.livenessPassed !== undefined && (
                          <div className="col-span-2">
                            <p className="text-gray-400 font-medium text-xs">Verifikasi Liveness</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {report.livenessPassed ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                  <ShieldCheck size={12} /> Lolos
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                  <ShieldAlert size={12} /> Gagal
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {report.isSuspicious && (
                          <div className="col-span-2">
                            <p className="text-gray-400 font-medium text-xs">Keputusan Sistem</p>
                            <SuspiciousBadge isSuspicious variant="dialog" />
                          </div>
                        )}
                      </div>
                      {report.photoUrl && (
                        <div className="w-full mt-1 rounded-2xl overflow-hidden shadow-md">
                          <img src={report.photoUrl} alt="Bukti" className="w-full h-auto object-cover" />
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              );
            }) : (
              <div className="h-32 flex items-center justify-center text-center text-gray-500 font-medium">
                Tidak ada laporan yang sesuai dengan filter.
              </div>
            )}
          </div>
          {/* Table - desktop */}
          <div className="hidden xl:block overflow-x-auto px-4 md:px-6 py-0 rounded-b-3xl relative z-10">
            <Table className="w-full min-w-[800px]">
              <TableHeader className="bg-gray-50/50 rounded-t-xl">
                <TableRow className="border-b border-gray-100/50 hover:bg-transparent">
                  <TableHead className="font-bold text-gray-900 text-center h-12">Tanggal</TableHead>
                  <TableHead className="font-bold text-gray-900 text-center">Nama</TableHead>
                  <TableHead className="font-bold text-gray-900 text-center">Cabang</TableHead>
                  <TableHead className="font-bold text-gray-900 text-center">Jam Masuk</TableHead>
                  <TableHead className="font-bold text-gray-900 text-center">Jam Keluar</TableHead>
                  <TableHead className="font-bold text-gray-900 text-center">Status</TableHead>
                  <TableHead className="font-bold text-gray-900 text-center">Wajah</TableHead>
                  <TableHead className="font-bold text-gray-900 text-center">Verifikasi</TableHead>
                  <TableHead className="font-bold text-gray-900 text-center">Bukti Foto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReports.length > 0 ? paginatedReports.map((report) => (
                  <TableRow key={report.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="font-bold text-gray-900 text-center">
                      {format(parseISO(report.date), 'dd MMM yyyy', { locale: indonesianLocale })}
                    </TableCell>
                    <TableCell className="font-medium text-gray-900 text-center">{report.userName}</TableCell>
                    <TableCell className="font-medium text-gray-600 text-center text-xs max-w-[15ch] truncate">
                      {locations.find(l => l.id === report.locationId)?.name || '-'}
                    </TableCell>
                    <TableCell className="font-medium text-gray-600 text-center">{fmtTime(report.timeIn)}</TableCell>
                    <TableCell className="font-medium text-gray-600 text-center">{fmtTime(report.timeOut)}</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={report.status} isForgotClockOut={report.isForgotClockOut} variant="table" />
                    </TableCell>
                    <TableCell className="text-center">
                      {report.faceMatchScore !== null && report.faceMatchScore !== undefined ? (
                        report.faceMatchScore < FACE_MATCH_DISTANCE ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-200">
                            <ShieldCheck size={12} />
                            Cocok
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-1 rounded-full border border-red-200" title={`Skor: ${report.faceMatchScore.toFixed(3)} (threshold: ${FACE_MATCH_DISTANCE})`}>
                            <ShieldAlert size={12} />
                            Mencurigakan
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <SuspiciousBadge isSuspicious={report.isSuspicious} variant="table" />
                      {!report.isSuspicious && <span className="text-gray-400 text-xs">Normal</span>}
                    </TableCell>
                    <TableCell className="text-center flex justify-center items-center py-3">
                      {report.photoUrl ? (
                        <Dialog>
                          <DialogTrigger render={<button className="relative w-12 h-12 rounded-xl overflow-hidden cursor-pointer group shadow-sm border border-gray-200" />}>
                            <img src={report.photoUrl} alt="Bukti" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                              <Maximize2 size={18} className="text-white" />
                            </div>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md rounded-3xl border-white/60 bg-white/90 backdrop-blur-2xl shadow-[0_20px_60px_rgb(0,0,0,0.1)] p-6">
                            <DialogHeader>
                              <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">Bukti Foto Absen - {report.userName}</DialogTitle>
                            </DialogHeader>
                            <div className="w-full mt-4 rounded-2xl overflow-hidden shadow-md">
                              <img src={report.photoUrl} alt="Bukti" className="w-full h-auto object-cover" />
                            </div>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-gray-500 font-medium">
                      Tidak ada laporan yang sesuai dengan filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredReports.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            size="md"
          />
        </CardContent>
      </Card>
      )}
    </div>
  );
}