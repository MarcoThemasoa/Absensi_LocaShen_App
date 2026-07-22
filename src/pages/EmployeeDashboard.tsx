import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { MapPin, ChevronRight, ScanFace, CheckCircle2, AlertCircle, Loader2, Clock, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { supabase } from '../lib/supabase';

export default function EmployeeDashboard() {
  const { user, todayAttendance, locations, yesterdayForgotClockOut, dismissYesterdayAlert } = useAuth();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isTodayAttendance = todayAttendance?.date === todayStr;

  // Fetch recent records from Supabase
  const [myRecentRecords, setMyRecentRecords] = useState<any[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(2)
      .then(({ data }) => {
        if (data) setMyRecentRecords(data.map((a: any) => ({
          id: a.id, userId: a.user_id, userName: a.user_name,
          date: a.date, timeIn: a.time_in, timeOut: a.time_out,
          status: a.status, locationId: a.location_id, photoUrl: a.photo_url,
          is_forgot_clock_out: a.is_forgot_clock_out,
        })));
      });
  }, [user?.id]);

  // Clock ticker — always runs to update the current time display
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate elapsed working time (background-safe via checkInTimestamp)
  useEffect(() => {
    if (!todayAttendance?.checkInTime) return;

    // Jika sudah check-out → hide card, jangan hitung durasi
    if (todayAttendance.checkOutTime) return;

    // Gunakan timestamp jika ada, fallback ke parse checkInTime
    const startMs = todayAttendance.checkInTimestamp ?? (() => {
      const [h, m, s] = todayAttendance.checkInTime!.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, s || 0);
      return d.getTime();
    })();

    const tick = () => {
      const diff = Date.now() - startMs;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setElapsedTime(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    tick(); // Setel segera tanpa nunggu 1 detik
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [todayAttendance?.checkInTime, todayAttendance?.checkInTimestamp, todayAttendance?.checkOutTime]);

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-32 relative">
      {/* Top Section with Gradient & Glassmorphism */}
      <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-teal-950 text-white p-6 pb-24 rounded-b-[40px] drop-shadow-xl relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-yellow-400/20 blur-3xl"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-2xl font-bold border border-white/10 shadow-inner">
              {user?.name.charAt(0)}
            </div>
            <div>
              <p className="text-teal-100 text-sm font-medium">Selamat datang kembali,</p>
              <h2 className="text-xl font-bold">{user?.name}</h2>
            </div>
          </div>
          
          <div className="text-center py-2">
            <p className="text-sm font-medium text-teal-200 mb-1">{format(time, 'EEEE, d MMMM yyyy', { locale: id })}</p>
            <p className="text-6xl font-bold tracking-tighter drop-shadow-md">{format(time, 'HH:mm')}</p>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-16 relative z-20 flex-1 flex flex-col">
        {/* Yesterday forgot clock-out notification */}
        {yesterdayForgotClockOut && (
          <Card className="rounded-3xl border border-yellow-300/60 bg-yellow-50/90 backdrop-blur-xl drop-shadow-xl mb-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={20} className="text-yellow-700" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-yellow-800 text-sm">Lupa Absen Keluar Kemarin</p>
                  <p className="text-yellow-700 text-xs mt-0.5">
                    Sistem mendeteksi Anda belum absen keluar kemarin. Data telah diperbarui otomatis dengan jam keluar 17:00.
                  </p>
                </div>
                <button
                  onClick={dismissYesterdayAlert}
                  className="shrink-0 w-7 h-7 rounded-full bg-yellow-200/50 flex items-center justify-center hover:bg-yellow-300/50 transition-colors"
                >
                  <X size={14} className="text-yellow-700" />
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendance Status Card — hanya tampil selama bekerja (check-in tanpa check-out) */}
        {isTodayAttendance && todayAttendance?.checkInTime && !todayAttendance?.checkOutTime && (
          <Card className="rounded-3xl border border-teal-200/40 bg-teal-50/70 backdrop-blur-xl drop-shadow-xl mb-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <CardContent className="p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={24} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-teal-600 font-semibold uppercase tracking-wider">Absen Masuk</p>
                      <p className="font-bold text-teal-900 text-lg">{todayAttendance.checkInTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {todayAttendance.isLate && (
                      <div className="flex items-center gap-1 bg-yellow-500/20 px-3 py-1.5 rounded-full">
                        <AlertCircle size={16} className="text-yellow-700" />
                        <span className="text-xs font-bold text-yellow-700">TERLAMBAT</span>
                      </div>
                    )}
                    {todayAttendance.isForgotClockOut && (
                      <div className="flex items-center gap-1 bg-orange-500/20 px-3 py-1.5 rounded-full">
                        <Clock size={16} className="text-orange-700" />
                        <span className="text-xs font-bold text-orange-700">LUPA ABSEN KELUAR</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Elapsed Time — live dari background */}
                <div className="pt-3 border-t border-teal-200/30">
                  <p className="text-xs text-teal-600 font-semibold uppercase tracking-wider mb-2">Durasi Kerja</p>
                  <p className="font-bold text-3xl text-teal-900 tracking-wider font-mono">{elapsedTime}</p>
                </div>

                <div className="pt-3 border-t border-teal-200/30 text-center">
                  <div className="inline-block px-3 py-1 bg-teal-200/30 rounded-full">
                    <p className="text-xs font-bold text-teal-700 flex items-center gap-1 justify-center">
                      <Loader2 size={14} className="animate-spin" />
                      Masih Bekerja
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Glassmorphism Schedule Card */}
        <Card className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur-xl drop-shadow-xl mb-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardContent className="p-5">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Jadwal Hari Ini</p>
                <p className="font-bold text-gray-900 text-lg">08:00 - 17:00</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Lokasi</p>
                <p className="font-bold text-gray-900 text-sm flex items-center gap-1.5 justify-end bg-teal-50 px-3 py-1.5 rounded-full">
                  <MapPin size={14} className="text-teal-600 shrink-0"/> {
                    (() => {
                      const loc = locations.find(l => l.id === user?.locationId);
                      const name = loc?.name || '-';
                      return name.split(' ').slice(0, 2).join(' ');
                    })()
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Button 
            className="h-14 flex items-center justify-center gap-2 rounded-xl bg-teal-950 hover:bg-teal-900 text-white shadow-md transition-all disabled:opacity-50"
            onClick={() => navigate('/absen/kamera')}
            disabled={todayAttendance?.checkInTime ? true : false}
          >
            <ScanFace size={20} />
            <span className="font-bold text-sm">{todayAttendance?.checkInTime ? 'Sudah Masuk' : 'Absen Masuk'}</span>
          </Button>

          <Button 
            className="h-14 flex items-center justify-center gap-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => navigate('/absen/kamera?type=keluar')}
            disabled={!todayAttendance?.checkInTime || todayAttendance?.checkOutTime ? true : false}
          >
            <ScanFace size={20} className={todayAttendance?.checkInTime ? 'text-teal-600' : 'text-gray-400'} />
            <span className="font-bold text-sm">{todayAttendance?.checkOutTime ? 'Sudah Keluar' : 'Absen Keluar'}</span>
          </Button>
        </div>

        {/* Recent History Small View */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="font-bold text-gray-800 text-lg">Aktivitas Terakhir</h3>
            <Link to="/riwayat" className="text-sm text-teal-600 font-bold flex items-center hover:underline">
              Lihat Semua <ChevronRight size={16} className="ml-1" />
            </Link>
          </div>
          <div className="space-y-3">
            {myRecentRecords.length > 0 ? myRecentRecords.map((record) => (
              <div key={record.id} className="bg-white p-4 rounded-2xl drop-shadow-sm border border-gray-100 flex items-center justify-between shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{format(parseISO(record.date), 'dd MMM yyyy', { locale: id })}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium">Masuk: {record.timeIn} {record.timeOut ? `• Keluar: ${record.timeOut}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  {record.is_forgot_clock_out && (
                    <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-700">
                      Lupa
                    </span>
                  )}
                  <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                    record.status === 'hadir' ? 'bg-green-100 text-green-700' : record.status === 'telat' ? 'bg-yellow-100 text-yellow-700' : record.status === 'cuti' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {record.status}
                  </span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-500 text-center py-6 bg-white rounded-2xl border border-gray-100 shadow-sm">Belum ada aktivitas</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
