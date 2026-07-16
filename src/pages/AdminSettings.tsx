import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';

export default function AdminSettings() {
  const { user, logout } = useAuth();
  
  return (
    <div className="flex flex-col min-h-full bg-slate-50 pb-32">
      {/* Top Header with Gradient */}
      <div className="bg-gradient-to-br from-teal-900 via-teal-800 to-teal-950 text-white pt-16 pb-12 px-6 flex flex-col items-center text-center rounded-b-[40px] drop-shadow-xl relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-teal-500/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-yellow-400/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 w-20 h-20 shrink-0 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-3xl font-bold mb-4 border-2 border-white/20 shadow-xl mt-2">
          A
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-wide">Admin</h1>
        <p className="text-teal-200 mt-1 font-medium bg-white/10 px-4 py-1 rounded-full text-xs sm:text-sm">ID: {user?.id}</p>
      </div>

      <div className="p-4 sm:p-6 -mt-6 relative z-20 space-y-4 flex-1 w-full max-w-lg mx-auto">
        <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl drop-shadow-lg shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <CardContent className="p-5 space-y-5">
            <h3 className="font-bold text-gray-800 text-lg mb-2">Informasi Akun</h3>
            
            <div className="space-y-1.5">
              <Label className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Nama Lengkap</Label>
              <Input readOnly value="Admin" className="bg-gray-50/50 border-gray-100 font-medium text-gray-900 h-11 rounded-xl" />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Peran</Label>
              <Input readOnly value="Administrator" className="bg-gray-50/50 border-gray-100 font-medium text-gray-900 h-11 rounded-xl" />
            </div>

            <div className="pt-2">
              <Label className="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2 block">Status Akun</Label>
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-green-50 border-green-100">
                <ShieldCheck size={20} className="text-green-600" />
                <span className="font-semibold text-sm text-green-700">
                  Aktif & Terverifikasi
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

