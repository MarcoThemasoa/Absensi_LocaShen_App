import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminLogin() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/admin/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(id, password, 'admin');
      toast.success('Login Admin berhasil');
      navigate('/admin/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Gagal login admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm drop-shadow-sm border-0">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-teal-950 p-3 rounded-xl w-14 h-14 flex items-center justify-center mb-2">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-bold">Admin Portal</CardTitle>
          <CardDescription>Masuk untuk mengelola sistem</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="adminId">Admin ID / Email</Label>
                <Input 
                  id="adminId" 
                  placeholder="Masukkan ID Admin / Email" 
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password"
                  placeholder="Masukkan Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end mt-1">
                <button type="button" onClick={() => { setId('admin1'); setPassword('admin123'); }} className="text-xs text-teal-600 font-medium hover:underline">Gunakan Demo (admin1)</button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-teal-950 hover:bg-teal-900 text-white" 
              disabled={loading}
            >
              {loading ? 'Memproses...' : 'Masuk sebagai Admin'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <Link to="/auth/login" className="text-gray-500 hover:text-gray-700 font-medium">
              Kembali ke Login Karyawan
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
