import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { UserPlus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { validateRegisterForm } from '../lib/validators';

export default function EmployeeRegister() {
  const { locations } = useAuth();
  const [name, setName] = useState('');
  const [division, setDivision] = useState('');
  const [age, setAge] = useState('');
  const [locationId, setLocationId] = useState('');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const registerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (registerTimeoutRef.current) clearTimeout(registerTimeoutRef.current);
    };
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validation = validateRegisterForm(
      name,
      division,
      age,
      locationId,
      id,
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
    registerTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      toast.success('Pendaftaran berhasil, menunggu persetujuan Admin.');
      navigate('/auth/login');
    }, 1000);
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
                <Label htmlFor="id">ID Karyawan</Label>
                <Input 
                  id="id" 
                  placeholder="Contoh: 123 atau name"
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value);
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
                <Input 
                  id="password" 
                  type="password"
                  placeholder="Min 5 karakter, uppercase, angka, spesial" 
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setValidationErrors([]);
                  }}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Password harus: 5+ karakter, huruf besar, huruf kecil, angka, karakter spesial (!@#$%^&* dll)
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                <Input 
                  id="confirmPassword" 
                  type="password"
                  placeholder="Ulangi password" 
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setValidationErrors([]);
                  }}
                  disabled={loading}
                />
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
