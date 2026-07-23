import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { validateRegisterForm } from '../lib/validators';
import { supabase } from '../lib/supabase';

export default function EmployeeRegister() {
  const { locations } = useAuth();
  const [name, setName] = useState('');
  const [division, setDivision] = useState('');
  const [position, setPosition] = useState('');
  const [age, setAge] = useState('');
  const [locationId, setLocationId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validation = validateRegisterForm(
      name,
      division,
      position,
      age,
      locationId,
      email,
      password
    );

    // Check password confirmation
    const errors = [...validation.errors];
    if (!validation.isValid || errors.length > 0) {
      setValidationErrors(errors);
      errors.forEach(error => toast.error(error));
      return;
    }

    if (password !== confirmPassword) {
      const confirmError = 'Password dan konfirmasi password tidak cocok';
      setValidationErrors([confirmError]);
      toast.error(confirmError);
      return;
    }

    setValidationErrors([]);
    setLoading(true);

    try {
      // 1. Daftarkan user ke Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
            division,
            position: position.trim(),
            age: Number(age),
            location_id: locationId,
          },
        },
      });

      if (error) {
        if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
          throw new Error('Email ini sudah terdaftar. Gunakan email lain.');
        }
        throw error;
      }

      if (!data.user) {
        throw new Error('Gagal mendaftarkan akun. Silakan coba lagi.');
      }

      // 2. Setelah user dibuat oleh trigger, update data tambahan ke public.users
      // (Trigger handle_new_user hanya mengisi name, role=employee, status=pending)
      const { error: updateError } = await supabase
        .from('users')
        .update({
          email: email.trim(),
          division,
          position: position.trim(),
          age: Number(age),
          location_id: locationId,
        })
        .eq('id', data.user.id);

      if (updateError) {
        console.warn('[Register] Update detail tambahan gagal (mungkin RLS):', updateError.message);
        // Tidak masalah — data dasar user sudah tersimpan, admin bisa melengkapi nanti.
      }

      toast.success('Pendaftaran berhasil, menunggu persetujuan Admin.');
      navigate('/auth/login');
    } catch (error: any) {
      const errorMessage = error.message || 'Gagal mendaftar';
      setValidationErrors([errorMessage]);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="rounded-2xl drop-shadow-sm border-0 bg-white">
          <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-teal-950 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-2">
            <UserPlus className="text-yellow-400 w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-bold">Daftar Akun Baru</CardTitle>
          <CardDescription>Pendaftaran butuh persetujuan admin</CardDescription>
        </CardHeader>
        <CardContent>
          {validationErrors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg space-y-1">
              {validationErrors.map((error, idx) => (
                <p key={idx} className="text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </p>
              ))}
            </div>
          )}
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input 
                  id="name" 
                  placeholder="Contoh: Budi Santoso" 
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setValidationErrors([]);
                  }}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  placeholder="contoh@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setValidationErrors([]);
                  }}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="division">Divisi</Label>
                <Input 
                  id="division" 
                  placeholder="Contoh: Marketing" 
                  value={division}
                  onChange={(e) => {
                    setDivision(e.target.value);
                    setValidationErrors([]);
                  }}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="position">Posisi / Jabatan</Label>
                <Input 
                  id="position" 
                  placeholder="Contoh: Staf Administrasi"
                  value={position}
                  onChange={(e) => {
                    setPosition(e.target.value);
                    setValidationErrors([]);
                  }}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="age">Usia</Label>
                <Input 
                  id="age" 
                  type="number"
                  placeholder="Contoh: 25" 
                  value={age}
                  onChange={(e) => {
                    setAge(e.target.value);
                    setValidationErrors([]);
                  }}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="location">Cabang</Label>
                <select
                  id="location"
                  value={locationId}
                  onChange={(e) => {
                    setLocationId(e.target.value);
                    setValidationErrors([]);
                  }}
                  disabled={loading}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>Pilih Cabang</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 5 karakter, uppercase, angka, spesial" 
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setValidationErrors([]);
                    }}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Password: 5+ karakter, huruf besar, huruf kecil, angka, 1+ karakter spesial (!@#$%^&*)
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                <div className="relative">
                  <Input 
                    id="confirmPassword" 
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Ulangi password" 
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setValidationErrors([]);
                    }}
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-teal-950 hover:bg-teal-900 text-white" 
              disabled={loading}
            >
              {loading ? 'Memproses...' : 'Daftar'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm text-gray-500">
          <div>
            Sudah punya akun? <Link to="/auth/login" className="text-teal-700 font-semibold hover:underline">Masuk</Link>
          </div>
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}
