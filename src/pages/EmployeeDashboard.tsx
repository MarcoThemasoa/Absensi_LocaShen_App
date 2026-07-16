import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Clock, MapPin, History, UserCircle, Play, Square, ChevronRight, ScanFace, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { mockAttendance, mockLocations } from '../lib/mockData';

export default function EmployeeDashboard() {
  const { user, todayAttendance } = useAuth();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  const myRecentRecords = mockAttendance
    .filter(r => r.userId === user?.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 2);

  // Calculate elapsed time
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);

      if (todayAttendance?.checkInTime) {
        // Parse check-in time
        const [checkInHours, checkInMinutes, checkInSeconds] = todayAttendance.checkInTime
          .split(':')
          .map(Number);
        const checkInDate = new Date(now);
        checkInDate.setHours(checkInHours, checkInMinutes, checkInSeconds || 0);

        // Calculate elapsed time
        const diff = now.getTime() - checkInDate.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setElapsedTime(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [todayAttendance]);

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
        {/* Attendance Status Card */}
        {todayAttendance?.checkInTime && (
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
                  {todayAttendance.isLate && (
                    <div className="flex items-center gap-1 bg-yellow-500/20 px-3 py-1.5 rounded-full">
                      <AlertCircle size={16} className="text-yellow-700" />
                      <span className="text-xs font-bold text-yellow-700">TERLAMBAT</span>
                    </div>
                  )}
                </div>

                {/* Elapsed Time */}
                <div className="pt-3 border-t border-teal-200/30">
                  <p className="text-xs text-teal-600 font-semibold uppercase tracking-wider mb-2">Durasi Kerja</p>
                  <p className="font-bold text-3xl text-teal-900 tracking-wider font-mono">{elapsedTime}</p>
                </div>

                {/* Check-out Status */}
                {todayAttendance.checkOutTime ? (
                  <div className="pt-3 border-t border-teal-200/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-500/20 rounded-full flex items-center justify-center">
                        <CheckCircle2 size={20} className="text-gray-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider">Absen Keluar</p>
                        <p className="font-bold text-gray-900">{todayAttendance.checkOutTime}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-teal-200/30 text-center">
                    <div className="inline-block px-3 py-1 bg-teal-200/30 rounded-full">
                      <p className="text-xs font-bold text-teal-700 flex items-center gap-1 justify-center">
                        <Loader2 size={14} className="animate-spin" />
                        Masih Bekerja
                      </p>
                    </div>
                  </div>
                )}
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
                      const name = mockLocations.find(l => l.id === user?.locationId)?.name || 'Kantor Pusat';
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
                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                  record.status === 'hadir' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {record.status}
                </span>
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
