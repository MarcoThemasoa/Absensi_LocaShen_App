import { useState } from 'react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { LogOut, Edit2, Check, X, ShieldCheck, Mail, Calendar } from 'lucide-react';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { indonesianLocale } from '../lib/date-locale';

export default function AdminSettings() {
  const { user, logout, updateUserProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editName.trim()) {
      toast.error('Nama tidak boleh kosong');
      return;
    }
    setIsSaving(true);
    try {
      await updateUserProfile({ name: editName.trim() });
      setIsEditing(false);
      toast.success('Profil berhasil diperbarui');
    } catch {
      toast.error('Gagal menyimpan. Coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(user?.name || '');
    setIsEditing(false);
  };

  const formattedDate = user?.createdAt
    ? format(new Date(user.createdAt), 'dd MMMM yyyy', { locale: indonesianLocale })
    : '-';

  return (
    <div className="flex flex-col min-h-full bg-[#F9FAFB] pb-10">
      {/* Top Header with Gradient — full-bleed */}
      {/* Outer wrapper - relative, no overflow-hidden here */}
      <div className="relative -mx-6 md:-mx-10 -mt-18 md:-mt-10 shrink-0">

        {/* Header - has overflow-hidden to clip the glow circles */}
        <div className="bg-gradient-to-br from-[#113129] via-[#1a4a3d] to-[#0d2922] text-white rounded-b-[40px] relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 w-64 h-64 rounded-full bg-[#113129]/30 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-yellow-400/20 blur-3xl pointer-events-none"></div>

          <div className="pt-20 pb-14 px-6" />
        </div>

        {/* Avatar - now a sibling of the header, not clipped */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
          <div className="w-28 h-28 shrink-0 bg-white rounded-full flex items-center justify-center text-4xl font-bold text-[#113129] border-[3px] border-white shadow-lg">
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 mt-20 space-y-5 flex-1 w-full max-w-lg mx-auto">
        {/* Nama Admin + Role Badge */}
        <div className="text-center -mt-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{user?.name || 'Admin'}</h1>
          <div className="inline-flex items-center gap-1.5 mt-2 bg-[#113129]/10 text-[#113129] text-xs font-bold px-3 py-1.5 rounded-full tracking-wide">
            <ShieldCheck size={14} />
            Administrator
          </div>
        </div>

        {/* Informasi Akun — settings style */}
        <div className="mt-10 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-lg">Informasi Akun</h3>
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[#113129] hover:text-[#0d2922] hover:bg-[#113129]/10 rounded-full h-8 px-3"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 size={14} className="mr-1.5" /> Edit
              </Button>
            )}
          </div>

          <div className="border-b border-gray-200/70 pb-5">
            <Label className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Nama Lengkap</Label>
            {isEditing ? (
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-white border-[#113129]/30 focus-visible:ring-[#113129] font-medium text-gray-900 h-11 rounded-xl flex-1"
                  autoFocus
                  disabled={isSaving}
                />
                <Button
                  size="icon"
                  className="h-11 w-11 rounded-xl bg-[#113129] hover:bg-[#0d2922] text-white shrink-0"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check size={18} />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-11 w-11 rounded-xl border-gray-200 text-gray-500 hover:bg-gray-100 shrink-0"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X size={18} />
                </Button>
              </div>
            ) : (
              <p className="text-gray-900 font-medium mt-1.5 text-sm sm:text-base">{user?.name || 'Admin'}</p>
            )}
          </div>

          <div className="border-b border-gray-200/70 pb-5">
            <Label className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Email</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Mail size={16} className="text-gray-400 shrink-0" />
              <span className="text-gray-900 font-medium text-sm sm:text-base">{user?.email || '-'}</span>
            </div>
          </div>

          <div className="border-b border-gray-200/70 pb-5">
            <Label className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Peran</Label>
            <p className="text-gray-900 font-medium mt-1.5 text-sm sm:text-base">Administrator</p>
          </div>

          <div className="pb-5">
            <Label className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Bergabung Sejak</Label>
            <div className="flex items-center gap-2 mt-1.5">
              <Calendar size={16} className="text-gray-400 shrink-0" />
              <span className="text-gray-900 font-medium text-sm sm:text-base">{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Logout */}
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
