import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, Edit2, ShieldCheck, Clock as ClockIcon, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';

export default function EmployeeProfile() {
  const { user, logout, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');

  const isActive = user?.status === 'active';

  const handleSave = () => {
    if (!editName.trim()) {
      toast.error('Nama tidak boleh kosong');
      return;
    }
    updateUser({ name: editName.trim() });
    setIsEditing(false);
    toast.success('Profil berhasil diperbarui');
  };

  const handleCancel = () => {
    setEditName(user?.name || '');
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-32">
      {/* Top Header with Gradient */}
      <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-teal-950 text-white pt-16 pb-12 px-6 flex flex-col items-center text-center rounded-b-[40px] drop-shadow-xl relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-yellow-400/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 w-20 h-20 shrink-0 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-3xl font-bold mb-4 border-2 border-white/20 shadow-xl mt-2">
          {user?.name.charAt(0)}
          {/* Status Badge Overlaid on Avatar */}
          <div className="absolute bottom-0 right-0 w-6 h-6 shrink-0 rounded-full border-[3px] border-teal-950 bg-white flex items-center justify-center">
             <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          </div>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-wide">{user?.name}</h1>
        <p className="text-teal-200 mt-1 font-medium bg-white/10 px-4 py-1 rounded-full text-xs sm:text-sm">ID: {user?.id}</p>
      </div>

      <div className="p-4 sm:p-6 -mt-6 relative z-20 space-y-4 flex-1 w-full max-w-lg mx-auto">
        <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl drop-shadow-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardContent className="p-5 space-y-5">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-800 text-lg">Informasi Akun</h3>
              {!isEditing && (
                <Button variant="ghost" size="sm" className="text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-full h-8 px-3" onClick={() => setIsEditing(true)}>
                  <Edit2 size={14} className="mr-1.5" /> Edit
                </Button>
              )}
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Nama Lengkap</Label>
              {isEditing ? (
                <div className="flex gap-2">
                  <Input 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)} 
                    className="bg-white border-teal-200 focus-visible:ring-teal-500 font-medium text-gray-900 h-11 rounded-xl flex-1" 
                    autoFocus
                  />
                  <Button size="icon" className="h-11 w-11 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shrink-0" onClick={handleSave}>
                    <Check size={18} />
                  </Button>
                  <Button size="icon" variant="outline" className="h-11 w-11 rounded-xl border-gray-200 text-gray-500 hover:bg-gray-100 shrink-0" onClick={handleCancel}>
                    <X size={18} />
                  </Button>
                </div>
              ) : (
                <Input readOnly value={user?.name || ''} className="bg-gray-50/50 border-gray-100 font-medium text-gray-900 h-11 rounded-xl" />
              )}
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Peran</Label>
              <Input readOnly value={user?.role === 'employee' ? 'Karyawan' : 'Admin'} className="bg-gray-50/50 border-gray-100 font-medium text-gray-900 h-11 rounded-xl" />
            </div>

            <div className="pt-2">
              <Label className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2 block">Status Akun</Label>
              <div className={`flex items-center gap-3 p-3 rounded-xl border ${isActive ? 'bg-green-50 border-green-100' : 'bg-yellow-50 border-yellow-100'}`}>
                {isActive ? <ShieldCheck size={20} className="text-green-600" /> : <ClockIcon size={20} className="text-yellow-600" />}
                <span className={`font-semibold text-sm ${isActive ? 'text-green-700' : 'text-yellow-700'}`}>
                  {isActive ? 'Aktif & Terverifikasi' : 'Menunggu Persetujuan HRD'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button 
          variant="ghost" 
          className="w-full flex items-center gap-2 rounded-2xl py-6 bg-white border border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 drop-shadow-sm font-bold text-base mt-8"
          onClick={logout}
        >
          <LogOut size={20} />
          Keluar dari Aplikasi
        </Button>
      </div>
    </div>
  );
}
