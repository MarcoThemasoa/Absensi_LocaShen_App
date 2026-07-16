import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Fingerprint, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { validateLoginForm } from '../lib/validators';

export default function EmployeeLogin() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role === 'employee') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validation = validateLoginForm(id, password);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      validation.errors.forEach(error => toast.error(error));
      return;
    }

    setValidationErrors([]);
    setLoading(true);
    try {
      await login(id, password, 'employee');
      toast.success('Login berhasil');
      navigate('/dashboard');
    } catch (error: any) {
      const errorMessage = error.message || 'Gagal login';
      setValidationErrors([errorMessage]);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col sm:items-center sm:justify-center sm:py-8">
      <div className="w-full sm:max-w-[400px] h-[100dvh] sm:h-auto bg-gray-50 flex items-center justify-center p-4 sm:rounded-[2.5rem] sm:shadow-2xl relative overflow-hidden sm:border-[8px] sm:border-gray-900">
        <Card className="w-full max-w-sm rounded-2xl drop-shadow-sm border-0 bg-white">
          <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-teal-950 p-3 rounded-full w-14 h-14 flex items-center justify-center mb-2">
            <Fingerprint className="text-yellow-400 w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-bold">Absensi Digital</CardTitle>
          <CardDescription>Masuk untuk memulai absensi</CardDescription>
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
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="employeeId">ID Karyawan / Email</Label>
                <Input 
                  id="employeeId" 
                  placeholder="Masukkan ID / Email" 
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value);
                    setValidationErrors([]);
                  }}
                  disabled={loading}
                />
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
                  Password harus: 5+ karakter, huruf besar, angka, karakter spesial (!@#$%^&* dll)
                </p>
              </div>
              <div className="flex justify-end gap-2 mt-1">
                <button type="button" onClick={() => { setId('1'); setPassword('password123'); }} className="text-xs text-teal-600 font-medium hover:underline" disabled={loading}>Demo Budi (1)</button>
                <button type="button" onClick={() => { setId('3'); setPassword('password123'); }} className="text-xs text-teal-600 font-medium hover:underline" disabled={loading}>Demo Agus (3)</button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-teal-950 hover:bg-teal-900 text-white" 
              disabled={loading}
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2 justify-center text-sm text-gray-500 pb-6">
          <div>
            Belum punya akun? <Link to="/auth/register" className="text-teal-700 font-semibold ml-1 hover:underline">Daftar</Link>
          </div>
          <div className="mt-2 text-xs">
            <Link to="/admin/login" className="text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
              Masuk sebagai Admin Portal
            </Link>
          </div>
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}
