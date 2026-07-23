import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from '../lib/supabaseCache';
import { Check, X, Edit, Trash2, Clock, UserCog, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MapPin, CheckCircle2, XCircle, Calendar, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { User, AttendanceRecord } from '../types';

import { Combobox } from '../components/ui/combobox';

export default function AdminEmployees() {
  const { locations } = useAuth();
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'semua');
  const [filterLocationAll, setFilterLocationAll] = useState<string>('semua');
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean, userId: string | null, type: 'approve' | 'reject' | null }>({ open: false, userId: null, type: null });
  
  const [editAttendanceDialog, setEditAttendanceDialog] = useState<{ open: boolean, userId: string | null, status: string }>({ open: false, userId: null, status: 'hadir' });
  const [editAccountDialog, setEditAccountDialog] = useState<{ open: boolean, user: User | null }>({ open: false, user: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, userId: string | null }>({ open: false, userId: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchName, setSearchName] = useState('');
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const itemsPerPage = 5;

  // Fetch users & attendance from Supabase (cached)
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const { data: supabaseUsers } = await cachedQuery<any[]>('employees:users', () =>
        supabase.from('users').select('*').eq('role', 'employee')
      );
      
      const { data: supabaseAtt } = await cachedQuery<any[]>('employees:attendance', () =>
        supabase.from('attendance_records').select('*').limit(1000)
      );

      if (supabaseUsers) {
        setUsers(supabaseUsers.map((u: any) => ({
          id: u.id, name: u.name, email: u.email || '',
          role: u.role, status: u.status,
          position: u.position || undefined,
          division: u.division || undefined,
          age: u.age ?? undefined,
          locationId: u.location_id || undefined,
        })));
      }
      if (supabaseAtt) {
        setAttendances(supabaseAtt.map((a: any) => ({
          id: a.id, userId: a.user_id, userName: a.user_name || '',
          date: a.date, timeIn: a.time_in || '', timeOut: a.time_out || '',
          status: a.status, location: a.location || { lat: 0, lng: 0 },
          locationId: a.location_id || undefined,
          photoUrl: a.photo_url || undefined,
          isForgotClockOut: a.is_forgot_clock_out || false,
        })));
      }
      setLoading(false);
    }
    fetchAll();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterLocationAll]);

  useEffect(() => {
    if (searchParams.get('status')) setFilterStatus(searchParams.get('status')!);
    if (searchParams.get('location') && searchParams.get('location') !== 'semua') {
      setFilterLocationAll(searchParams.get('location')!);
    }
  }, [searchParams]);

  const today = new Date().toISOString().split('T')[0];
  const todaysAttendance = useMemo(() => attendances.filter(a => a.date === today), [today, attendances]);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (filterStatus !== 'semua') {
      result = result.filter(user => {
        const att = todaysAttendance.find(a => a.userId === user.id);
        if (filterStatus === 'alpha') {
           return !att || att.status === 'alpha';
        }
        if (!att) return false;
        return att.status === filterStatus;
      });
    }

    if (filterLocationAll !== 'semua') {
      result = result.filter(user => user.locationId === filterLocationAll);
    }

    if (searchName.trim()) {
      result = result.filter(user =>
        user.name.toLowerCase().includes(searchName.toLowerCase().trim())
      );
    }
    
    // Sort so pending users are at the top
    return [...result].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return 0;
    });
  }, [users, filterStatus, todaysAttendance, filterLocationAll, searchName]);

  const userStats = useMemo(() => {
    const stats: Record<string, { hadir: number, telat: number, alpha: number, cuti: number }> = {};
    users.forEach(u => {
      stats[u.id] = { hadir: 0, telat: 0, alpha: 0, cuti: 0 };
    });
    attendances.forEach(a => {
      if (stats[a.userId]) {
        if (a.status === 'hadir') stats[a.userId].hadir++;
        if (a.status === 'telat') stats[a.userId].telat++;
        if (a.status === 'alpha') stats[a.userId].alpha++;
        if (a.status === 'cuti') stats[a.userId].cuti++;
      }
    });
    return stats;
  }, [users, attendances]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const currentUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleApprove = async () => {
    if (confirmDialog.userId) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ status: 'active' })
          .eq('id', confirmDialog.userId);

        if (error) throw error;

        setUsers(users.map(u => u.id === confirmDialog.userId ? { ...u, status: 'active' } : u));
        invalidateCache('employees:');
        toast.success('Karyawan telah disetujui dan dapat mengakses aplikasi');
      } catch (e: any) {
        toast.error('Gagal menyetujui: ' + (e.message || 'Terjadi kesalahan'));
      }
      setConfirmDialog({ open: false, userId: null, type: null });
    }
  };

  const handleReject = async () => {
    if (confirmDialog.userId) {
      try {
        // Hapus user secara total via RPC (public.users + auth.users + attendance)
        const { error: rpcError } = await supabase.rpc('admin_delete_user', {
          p_user_id: confirmDialog.userId,
        });

        if (rpcError) {
          console.warn('[Reject] RPC gagal, fallback ke delete manual:', rpcError.message);
          // Fallback: hapus manual dari public.users
          const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', confirmDialog.userId);

          if (error) throw error;
        }

        setUsers(users.filter(u => u.id !== confirmDialog.userId));
        invalidateCache('employees:');
        toast.success('Karyawan ditolak dan dihapus dari sistem');
      } catch (e: any) {
        toast.error('Gagal menolak: ' + (e.message || 'Terjadi kesalahan'));
      }
      setConfirmDialog({ open: false, userId: null, type: null });
    }
  };

  const handleDeleteUser = async () => {
    if (deleteDialog.userId) {
      try {
        // Hapus user secara total via RPC (public.users + auth.users + attendance)
        const { error: rpcError } = await supabase.rpc('admin_delete_user', {
          p_user_id: deleteDialog.userId,
        });

        if (rpcError) {
          console.warn('[Delete] RPC gagal, fallback ke delete manual:', rpcError.message);
          // Fallback: hapus manual dari public.users
          const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', deleteDialog.userId);

          if (error) throw error;
        }

        setUsers(users.filter(u => u.id !== deleteDialog.userId));
        invalidateCache('employees:');
        toast.success('Karyawan berhasil dihapus dari sistem');
      } catch (e: any) {
        toast.error('Gagal menghapus: ' + (e.message || 'Terjadi kesalahan'));
      }
      setDeleteDialog({ open: false, userId: null });
    }
  };

  const handleSaveAttendance = () => {
    if (editAttendanceDialog.userId) {
      const existingRecordIndex = attendances.findIndex(a => a.userId === editAttendanceDialog.userId && a.date === today);
      const user = users.find(u => u.id === editAttendanceDialog.userId);
      
      if (existingRecordIndex >= 0) {
        const newAttendances = [...attendances];
        newAttendances[existingRecordIndex] = { 
          ...newAttendances[existingRecordIndex], 
          status: editAttendanceDialog.status as any 
        };
        setAttendances(newAttendances);
      } else if (user) {
        setAttendances([...attendances, {
          id: `att_${Date.now()}`,
          userId: user.id,
          userName: user.name,
          date: today,
          timeIn: '08:00',
          status: editAttendanceDialog.status as any,
          location: { lat: 0, lng: 0 }
        }]);
      }
      toast.success('Status absensi berhasil diubah');
      setEditAttendanceDialog({ open: false, userId: null, status: 'hadir' });
    }
  };

  const handleSaveAccount = async () => {
    if (editAccountDialog.user) {
      const updatedUser = editAccountDialog.user;
      
      // Update ke Supabase dulu — baru update state lokal kalau sukses
      try {
        const { error } = await supabase
          .from('users')
          .update({ 
            name: updatedUser.name, 
            position: updatedUser.position || null,
            location_id: updatedUser.locationId || null
          })
          .eq('id', updatedUser.id);

        if (error) {
          console.error('Supabase error saat update akun:', error);
          toast.error('Gagal menyimpan: ' + error.message);
          return;
        }
      } catch (e) {
        console.error('Exception saat update akun:', e);
        toast.error('Gagal menyimpan data. Coba lagi.');
        return;
      }
      
      // Update state lokal hanya jika Supabase sukses
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      invalidateCache('employees:'); // refresh cache
      toast.success('Data akun berhasil disimpan');
      setEditAccountDialog({ open: false, user: null });
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 drop-shadow-sm">Manajemen Karyawan</h1>
          <p className="text-gray-500 font-medium mt-1">Persetujuan pendaftar baru dan daftar seluruh karyawan.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Combobox
            options={[{ label: 'Semua Cabang', value: 'semua' }, ...locations.map(l => ({ label: `Lokasi: ${l.name}`, value: l.id }))]}
            value={filterLocationAll}
            onChange={setFilterLocationAll}
            placeholder="Pilih Cabang"
          />
          <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 gap-2 hide-scrollbar w-full sm:w-auto">
            <Button variant={filterStatus === 'semua' ? 'default' : 'outline'} className={`rounded-xl shrink-0 ${filterStatus === 'semua' ? 'bg-[#113129] text-white' : ''}`} size="sm" onClick={() => setFilterStatus('semua')}>Semua</Button>
            <Button variant={filterStatus === 'hadir' ? 'default' : 'outline'} className={`rounded-xl shrink-0 ${filterStatus === 'hadir' ? 'bg-[#10B981] text-white' : 'text-[#10B981]'}`} size="sm" onClick={() => setFilterStatus('hadir')}>Hadir</Button>
            <Button variant={filterStatus === 'telat' ? 'default' : 'outline'} className={`rounded-xl shrink-0 ${filterStatus === 'telat' ? 'bg-[#FACC15] text-[#113129]' : 'text-yellow-600'}`} size="sm" onClick={() => setFilterStatus('telat')}>Telat</Button>
            <Button variant={filterStatus === 'alpha' ? 'default' : 'outline'} className={`rounded-xl shrink-0 ${filterStatus === 'alpha' ? 'bg-[#EF4444] text-white' : 'text-[#EF4444]'}`} size="sm" onClick={() => setFilterStatus('alpha')}>Absen</Button>
            <Button variant={filterStatus === 'cuti' ? 'default' : 'outline'} className={`rounded-xl shrink-0 ${filterStatus === 'cuti' ? 'bg-[#113129] text-white' : 'text-[#113129]'}`} size="sm" onClick={() => setFilterStatus('cuti')}>Cuti</Button>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchName}
          onChange={(e) => { setSearchName(e.target.value); setCurrentPage(1); }}
          placeholder="Cari nama karyawan..."
          className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
        />
      </div>

      <div className="flex flex-col gap-4">
        {currentUsers.map((user) => {
          const todayAtt = todaysAttendance.find(a => a.userId === user.id);
          const stats = userStats[user.id] || { hadir: 0, telat: 0, alpha: 0, cuti: 0 };
          const userLocation = locations.find(l => l.id === user.locationId)?.name || '-';
          const isActiveCard = activeCardId === user.id;

          return (
            <Card 
              key={user.id} 
              className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-300 hover:shadow-md cursor-pointer flex flex-col"
              onClick={() => user.status !== 'pending' && setActiveCardId(isActiveCard ? null : user.id)}
            >
              <div className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#113129]/20 to-[#113129]/30 rounded-full flex items-center justify-center font-bold text-[#113129] text-xl shadow-inner shrink-0">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-lg flex items-center gap-2 flex-wrap">
                        {user.name}
                        {user.status === 'pending' && <span className="px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-800 text-xs font-bold uppercase">Pending</span>}
                      </div>
                      <div className="text-sm font-medium text-gray-500 mt-0.5">
                        Divisi: {user.division || '-'} • Usia: {user.age || '-'}
                      </div>
                      <div className="text-xs text-[#113129] mt-1 flex items-center gap-1.5">
                        <MapPin size={12} /> {userLocation}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold">
                      <span className="text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded-md">H: {stats.hadir}</span>
                      <span className="text-yellow-600 bg-yellow-400/10 px-1.5 py-0.5 rounded-md">T: {stats.telat}</span>
                      <span className="text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded-md">A: {stats.alpha}</span>
                    </div>
                    {user.status !== 'pending' && (
                      <div className="mt-0 sm:mt-2 text-gray-400">
                        {isActiveCard ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 sm:mt-0">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 py-1.5 px-3 rounded-full w-fit">
                        {!todayAtt && <span className="text-gray-500 text-xs font-medium">Belum Absen Hari Ini</span>}
                        {todayAtt?.status === 'hadir' && <><CheckCircle2 size={14} className="text-[#10B981]" /><span className="text-[#10B981] text-xs font-bold">Hadir Hari Ini</span></>}
                        {todayAtt?.status === 'telat' && <><Clock size={14} className="text-yellow-500" /><span className="text-yellow-600 text-xs font-bold">Telat Hari Ini</span></>}
                        {todayAtt?.status === 'cuti' && <><Calendar size={14} className="text-[#113129]" /><span className="text-[#113129] text-xs font-bold">Cuti Hari Ini</span></>}
                        {todayAtt?.status === 'alpha' && <><XCircle size={14} className="text-[#EF4444]" /><span className="text-[#EF4444] text-xs font-bold">Absen Hari Ini</span></>}
                        {todayAtt?.isForgotClockOut && <><Clock size={14} className="text-orange-500" /><span className="text-orange-600 text-xs font-bold">Lupa Absen Keluar</span></>}
                    </div>
                    <div className="flex sm:hidden items-center gap-1.5 text-xs font-bold mt-1">
                      <span className="text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded-md">H: {stats.hadir}</span>
                      <span className="text-yellow-600 bg-yellow-400/10 px-1.5 py-0.5 rounded-md">T: {stats.telat}</span>
                      <span className="text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded-md">A: {stats.alpha}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Extra Controls / Info */}
              <div className={`bg-gray-50/50 transition-all duration-300 ease-in-out ${isActiveCard || user.status === 'pending' ? 'opacity-100 max-h-40 p-4 border-t border-gray-100' : 'opacity-0 max-h-0 overflow-hidden m-0 p-0 border-0'}`}>
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
                  {user.status === 'pending' ? (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button size="sm" className="bg-[#113129] hover:bg-[#1a4a3d] rounded-xl font-semibold shadow-sm flex-1 sm:flex-none" onClick={(e) => { e.stopPropagation(); setConfirmDialog({ open: true, userId: user.id, type: 'approve' }); }}>
                        <Check size={16} className="mr-1.5" /> Setujui
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-xl border border-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/10 hover:text-[#EF4444] font-semibold flex-1 sm:flex-none" onClick={(e) => { e.stopPropagation(); setConfirmDialog({ open: true, userId: user.id, type: 'reject' }); }}>
                        <X size={16} className="mr-1.5" /> Tolak
                      </Button>
                    </div>
                  ) : isActiveCard ? (
                    <div className="flex gap-2 w-full sm:w-auto flex-wrap justify-end">
                      <Button size="sm" variant="outline" className="rounded-xl h-9 px-3 text-[#113129] hover:text-[#1a4a3d] hover:bg-[#113129]/10 font-medium flex-1 sm:flex-none" onClick={(e) => { e.stopPropagation(); setEditAttendanceDialog({ open: true, userId: user.id, status: todayAtt?.status || 'hadir' }); }}>
                        Absensi <Clock size={16} className="ml-1.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl h-9 px-3 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-400/10 font-medium flex-1 sm:flex-none" onClick={(e) => { e.stopPropagation(); setEditAccountDialog({ open: true, user }); }}>
                        Akun <UserCog size={16} className="ml-1.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl h-9 w-9 p-0 text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10 shrink-0" title="Hapus Karyawan" onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, userId: user.id }); }}>
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
        
        {filteredUsers.length === 0 && (
          <div className="text-center py-10 text-gray-500 font-medium bg-white/50 rounded-3xl border border-dashed border-gray-200">
            Tidak ada data karyawan yang sesuai dengan filter.
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-xl"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="text-sm font-medium text-gray-600">
              Halaman {currentPage} dari {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-xl"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* Approve/Reject Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Konfirmasi Tindakan</DialogTitle>
            <DialogDescription className="text-gray-500">
              {confirmDialog.type === 'approve' 
                ? 'Apakah Anda yakin ingin menyetujui karyawan ini? Mereka akan mendapatkan akses ke aplikasi.' 
                : 'Apakah Anda yakin ingin menolak karyawan ini? Data mereka akan dihapus dari sistem.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-3 sm:justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setConfirmDialog({ open: false, userId: null, type: null })}>Batal</Button>
            <Button 
              className={`rounded-xl text-white font-bold ${confirmDialog.type === 'approve' ? 'bg-[#113129] hover:bg-[#1a4a3d]' : 'bg-[#EF4444] hover:bg-[#dc2626]'}`} 
              onClick={confirmDialog.type === 'approve' ? handleApprove : handleReject}
            >
              {confirmDialog.type === 'approve' ? 'Setujui Karyawan' : 'Tolak Karyawan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#EF4444]">Hapus Akun Karyawan</DialogTitle>
            <DialogDescription className="text-gray-500">
              Apakah Anda yakin ingin menghapus akun ini secara permanen? Data riwayat absensi tidak dapat dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex gap-3 sm:justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setDeleteDialog({ open: false, userId: null })}>Batal</Button>
            <Button className="rounded-xl text-white font-bold bg-[#EF4444] hover:bg-[#dc2626]" onClick={handleDeleteUser}>
              Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Attendance Dialog */}
      <Dialog open={editAttendanceDialog.open} onOpenChange={(open) => setEditAttendanceDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Modifikasi Absensi Hari Ini</DialogTitle>
            <DialogDescription className="text-gray-500">
              Ubah status absensi karyawan ini untuk hari ini.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-sm font-bold text-gray-700">Status Absensi</Label>
              <Combobox
                options={[
                  { label: 'Hadir', value: 'hadir' },
                  { label: 'Telat', value: 'telat' },
                  { label: 'Cuti', value: 'cuti' },
                  { label: 'Absen/Alpha', value: 'alpha' }
                ]}
                value={editAttendanceDialog.status}
                onChange={(value) => setEditAttendanceDialog(prev => ({ ...prev, status: value }))}
                placeholder="Pilih status"
              />
            </div>
          </div>
          <DialogFooter className="mt-6 flex gap-3 sm:justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditAttendanceDialog({ open: false, userId: null, status: 'hadir' })}>Batal</Button>
            <Button className="rounded-xl text-white font-bold bg-[#113129] hover:bg-[#1a4a3d]" onClick={handleSaveAttendance}>
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={editAccountDialog.open} onOpenChange={(open) => setEditAccountDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">Edit Akun Karyawan</DialogTitle>
            <DialogDescription className="text-gray-500">
              Ubah detail dan tipe/divisi akun karyawan.
            </DialogDescription>
          </DialogHeader>
          {editAccountDialog.user && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name" className="text-sm font-bold text-gray-700">Nama Lengkap</Label>
                <Input 
                  id="edit-name" 
                  value={editAccountDialog.user.name} 
                  onChange={(e) => setEditAccountDialog(prev => prev.user ? { ...prev, user: { ...prev.user, name: e.target.value } } : prev)} 
                  className="h-11 rounded-xl" 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-position" className="text-sm font-bold text-gray-700">Tipe / Divisi</Label>
                <Input 
                  id="edit-position" 
                  value={editAccountDialog.user.position || ''} 
                  onChange={(e) => setEditAccountDialog(prev => prev.user ? { ...prev, user: { ...prev.user, position: e.target.value } } : prev)} 
                  placeholder="Contoh: Tim Marketing, Teknisi Pipa..."
                  className="h-11 rounded-xl" 
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-bold text-gray-700">Lokasi</Label>
                <Combobox
                  options={locations.map(l => ({ label: l.name, value: l.id }))}
                  value={editAccountDialog.user.locationId || ''}
                  onChange={(value) => setEditAccountDialog(prev => prev.user ? { ...prev, user: { ...prev.user, locationId: value } } : prev)}
                  placeholder="Pilih lokasi..."
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-6 flex gap-3 sm:justify-end">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditAccountDialog({ open: false, user: null })}>Batal</Button>
            <Button className="rounded-xl text-white font-bold bg-[#113129] hover:bg-[#1a4a3d]" onClick={handleSaveAccount}>
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
