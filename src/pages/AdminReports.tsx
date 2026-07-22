import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from '../lib/supabaseCache';
import { Download, Search, Maximize2, ChevronLeft, ChevronRight, Activity, Clock, MapPin } from 'lucide-react';
import { format, parseISO, subDays, isAfter, startOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { Combobox } from '../components/ui/combobox';
import { AttendanceRecord } from '../types';

interface AdminActivityLog {
  id: string; adminId: string; adminName: string; action: string;
  timestamp: string; location: { lat: number; lng: number }; locationName: string;
}

export default function AdminReports() {
  const { locations } = useAuth();
  const [reports, setReports] = useState<AttendanceRecord[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'1hari' | '7hari' | '1bulan' | 'semua'>('semua');
  const [locationFilter, setLocationFilter] = useState<string>('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Export Dialog State
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportLocation, setExportLocation] = useState<string>('');
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');

  // Log Aktivitas State
  const [logTimeFilter, setLogTimeFilter] = useState<'1hari' | '7hari' | '1bulan' | 'semua'>('semua');
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const logsPerPage = 15;

  // Fetch attendance & logs from Supabase (cached)
  useEffect(() => {
    async function fetchReports() {
      const [attResult, userResult, logResult] = await Promise.all([
        cachedQuery<any[]>('reports:attendance', () =>
          supabase.from('attendance_records').select('*').order('date', { ascending: false }).limit(500)
        ),
        cachedQuery<any[]>('reports:users', () =>
          supabase.from('users').select('*').eq('role', 'employee')
        ),
        cachedQuery<any[]>('reports:logs', () =>
          supabase.from('admin_activity_logs').select('*').order('action_timestamp', { ascending: false }).limit(500)
        ),
      ]);

      const userData = userResult.data || [];
      const userMap = new Map(userData.map((u: any) => [u.id, u]));

      // Enrich attendance records with userName + locationId from users table
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
          };
        }));
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
          };
        }));
      }
    }
    fetchReports();
  }, []);

  const filteredLogs = useMemo(() => {
    const today = startOfDay(new Date());
    return adminLogs.filter(log => {
      const logDate = startOfDay(parseISO(log.timestamp));
      if (logTimeFilter === '1hari') {
        if (!isAfter(logDate, subDays(today, 1))) return false;
      } else if (logTimeFilter === '7hari') {
        if (!isAfter(logDate, subDays(today, 6))) return false;
      } else if (logTimeFilter === '1bulan') {
        if (!isAfter(logDate, subDays(today, 29))) return false;
      }
      return true;
    });
  }, [logTimeFilter, adminLogs]);

  useEffect(() => {
    setLogCurrentPage(1);
  }, [logTimeFilter]);

  const logTotalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (logCurrentPage - 1) * logsPerPage,
    logCurrentPage * logsPerPage
  );

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      // Name filter
      if (searchQuery && !report.userName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Location filter
      if (locationFilter && report.locationId !== locationFilter) {
        return false;
      }
      
      // Time filter
      const reportDate = startOfDay(parseISO(report.date));
      const today = startOfDay(new Date());
      
      if (timeFilter === '1hari') {
        if (!isAfter(reportDate, subDays(today, 1))) return false;
      } else if (timeFilter === '7hari') {
        if (!isAfter(reportDate, subDays(today, 6))) return false;
      } else if (timeFilter === '1bulan') {
        if (!isAfter(reportDate, subDays(today, 29))) return false;
      }
      
      return true;
    });
  }, [reports, searchQuery, timeFilter, locationFilter]);

  // Reset pagination when filters change
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
    const newLog = {
      id: 'log' + Date.now(),
      adminId: 'admin1',
      adminName: 'Admin HRD',
      action: 'Mengekspor data laporan absensi',
      timestamp: new Date().toISOString(),
      location: { lat: -6.200000, lng: 106.816666 },
      locationName: 'Lokasi Perangkat Admin'
    };
    setAdminLogs(prev => [newLog, ...prev]);

    const reportsToExport = reports.filter(report => {
      if (exportLocation && report.locationId !== exportLocation) return false;
      
      if (exportStartDate) {
        if (new Date(report.date) < new Date(exportStartDate)) return false;
      }
      if (exportEndDate) {
        const end = new Date(exportEndDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(report.date) > end) return false;
      }
      return true;
    });

    const headers = ['ID,Tanggal,Nama,Jam Masuk,Jam Keluar,Status,Lokasi'];
    const csvData = reportsToExport.map(r => {
      const locName = locations.find(l => l.id === r.locationId)?.name || '';
      return `${r.id},${r.date},"${r.userName}",${r.timeIn},${r.timeOut || ''},${r.status},"${locName}"`;
    });

    const csvString = headers.concat(csvData).join('\n');
    
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filterName = (exportStartDate && exportEndDate) ? `${exportStartDate}_to_${exportEndDate}` : 'custom';
    
    const dateStr = format(new Date(), 'dd-MMM-yyyy', { locale: id });
    a.download = `Laporan_Absensi_${filterName}_${dateStr}.csv`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          <Dialog>
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
                {paginatedLogs.length > 0 ? paginatedLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 hover:shadow-md transition-shadow">
                    <h3 className="font-bold text-gray-900 text-sm mb-2 leading-snug line-clamp-2">{log.action}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} className="text-[#113129] shrink-0" />
                        {format(parseISO(log.timestamp), 'dd MMM yy HH:mm', { locale: id })}
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
              
              {/* Pagination Controls for Logs */}
              {logTotalPages > 1 && (
                <div className="p-3 border-t border-gray-100/50 flex items-center justify-between gap-4 bg-gray-50/30 shrink-0">
                  <p className="text-xs text-gray-500 font-medium hidden sm:block">
                    Menampilkan {(logCurrentPage - 1) * logsPerPage + 1} - {Math.min(logCurrentPage * logsPerPage, filteredLogs.length)} dari {filteredLogs.length} data
                  </p>
                  <p className="text-xs text-gray-500 font-medium sm:hidden">
                    {(logCurrentPage - 1) * logsPerPage + 1}-{Math.min(logCurrentPage * logsPerPage, filteredLogs.length)} dari {filteredLogs.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-lg w-8 h-8 border-gray-200"
                      onClick={() => setLogCurrentPage(p => Math.max(1, p - 1))}
                      disabled={logCurrentPage === 1}
                    >
                      <ChevronLeft size={14} />
                    </Button>
                    <div className="text-xs font-bold text-gray-700 px-2 flex items-center whitespace-nowrap">
                      {logCurrentPage} / {logTotalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-lg w-8 h-8 border-gray-200"
                      onClick={() => setLogCurrentPage(p => Math.min(logTotalPages, p + 1))}
                      disabled={logCurrentPage === logTotalPages}
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="p-4 shrink-0 border-t border-gray-100">
                <Button className="w-full bg-[#113129] hover:bg-[#1a4a3d] text-white rounded-xl h-11 font-bold" onClick={() => {
                   const headers = ['ID,Waktu,Tindakan,Lokasi'];
                   const csvData = filteredLogs.map(l => `${l.id},${l.timestamp},"${l.action}","${l.locationName}"`);
                   const csvString = headers.concat(csvData).join('\n');
                   const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                   const url = URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   const dateStr = format(new Date(), 'dd-MMM-yyyy', { locale: id });
                   a.download = `Log_Aktivitas_${dateStr}.csv`;
                   document.body.appendChild(a);
                   a.click();
                   document.body.removeChild(a);
                   URL.revokeObjectURL(url);
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
          {/* Card List - tampil di layar kecil/menengah, meniru desain app */}
          <div className="flex flex-col gap-3 p-4 md:p-6 xl:hidden">
            {paginatedReports.length > 0 ? paginatedReports.map((report) => {
              const locationName = locations.find(l => l.id === report.locationId)?.name || '-';
              const isOutside = locationName.toLowerCase().includes('luar');
              return (
                <Dialog key={report.id}>
                  <DialogTrigger>
                    <div className="w-full text-left p-4 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-gray-900">{report.userName}</span>
                        <span className="shrink-0 text-[10px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1 whitespace-nowrap">
                          {format(parseISO(report.date), 'dd MMM yyyy', { locale: id })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-[#113129]">
                          <MapPin size={14} className="shrink-0" />
                          <span className="truncate">{locationName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {report.timeIn && <span className="text-xs text-gray-500">{report.timeIn}</span>}
                          <div className="flex items-center gap-1">
                            {report.isForgotClockOut && (
                              <span className="inline-flex items-center rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-700 ring-1 ring-inset ring-orange-600/20">LK</span>
                            )}
                            {report.status === 'hadir' ? (
                              <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase text-green-700 ring-1 ring-inset ring-green-600/20">H</span>
                            ) : report.status === 'telat' ? (
                              <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-700 ring-1 ring-inset ring-yellow-600/20">T</span>
                            ) : report.status === 'cuti' ? (
                              <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 ring-1 ring-inset ring-blue-600/20">C</span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700 ring-1 ring-inset ring-red-600/20">A</span>
                            )}
                          </div>
                        </div>
                      </div>
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
                          <p className="font-bold text-gray-900">{format(parseISO(report.date), 'dd MMM yyyy', { locale: id })}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium text-xs">Status</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {report.isForgotClockOut && (
                              <span className="inline-flex items-center rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-bold uppercase text-orange-700 ring-1 ring-inset ring-orange-600/20">Lupa Keluar</span>
                            )}
                            {report.status === 'hadir' ? (
                              <span className="inline-flex items-center rounded-lg bg-green-50 px-2.5 py-1 text-xs font-bold uppercase text-green-700 ring-1 ring-inset ring-green-600/20">Hadir</span>
                            ) : report.status === 'telat' ? (
                              <span className="inline-flex items-center rounded-lg bg-yellow-50 px-2.5 py-1 text-xs font-bold uppercase text-yellow-700 ring-1 ring-inset ring-yellow-600/20">Telat</span>
                            ) : report.status === 'cuti' ? (
                              <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold uppercase text-blue-700 ring-1 ring-inset ring-blue-600/20">Cuti</span>
                            ) : (
                              <span className="inline-flex items-center rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold uppercase text-red-700 ring-1 ring-inset ring-red-600/20">Alpha</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium text-xs">Jam Masuk</p>
                          <p className="font-bold text-gray-900">{report.timeIn || '-'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-medium text-xs">Jam Keluar</p>
                          <p className="font-bold text-gray-900">{report.timeOut || '-'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-400 font-medium text-xs">Cabang</p>
                          <p className="font-bold text-gray-900">{locationName}</p>
                        </div>
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
                  <TableHead className="font-bold text-gray-900 text-center">Bukti Foto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReports.length > 0 ? paginatedReports.map((report) => (
                  <TableRow key={report.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="font-bold text-gray-900 text-center">
                      {format(parseISO(report.date), 'dd MMM yyyy', { locale: id })}
                    </TableCell>
                    <TableCell className="font-medium text-gray-900 text-center">{report.userName}</TableCell>
                    <TableCell className="font-medium text-gray-600 text-center text-xs">
                      {locations.find(l => l.id === report.locationId)?.name || '-'}
                    </TableCell>
                    <TableCell className="font-medium text-gray-600 text-center">{report.timeIn || '-'}</TableCell>
                    <TableCell className="font-medium text-gray-600 text-center">{report.timeOut || '-'}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {report.isForgotClockOut && (
                          <span className="inline-flex items-center rounded-xl bg-orange-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-orange-700 ring-1 ring-inset ring-orange-600/20 shadow-sm">Lupa</span>
                        )}
                        {report.status === 'hadir' ? (
                          <span className="inline-flex items-center rounded-xl bg-green-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-green-700 ring-1 ring-inset ring-green-600/20 shadow-sm">Hadir</span>
                        ) : report.status === 'telat' ? (
                          <span className="inline-flex items-center rounded-xl bg-yellow-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-yellow-700 ring-1 ring-inset ring-yellow-600/20 shadow-sm">Telat</span>
                        ) : report.status === 'cuti' ? (
                          <span className="inline-flex items-center rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 ring-1 ring-inset ring-blue-600/20 shadow-sm">Cuti</span>
                        ) : (
                          <span className="inline-flex items-center rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-red-700 ring-1 ring-inset ring-red-600/20 shadow-sm">Alpha</span>
                        )}
                      </div>
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
                    <TableCell colSpan={7} className="h-32 text-center text-gray-500 font-medium">
                      Tidak ada laporan yang sesuai dengan filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100/50 flex items-center justify-between gap-4 bg-gray-50/30">
              <p className="text-sm text-gray-500 font-medium hidden sm:block">
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredReports.length)} dari {filteredReports.length} data
              </p>
              <p className="text-sm text-gray-500 font-medium sm:hidden">
                {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredReports.length)} dari {filteredReports.length}
              </p>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl w-9 h-9 border-gray-200"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </Button>
                <div className="text-sm font-bold text-gray-700 px-2 flex items-center whitespace-nowrap">
                  {currentPage} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl w-9 h-9 border-gray-200"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
