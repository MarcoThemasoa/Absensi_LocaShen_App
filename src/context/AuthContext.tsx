import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User, OfficeLocation } from '../types';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { initLocationCache } from '../lib/locationCache';


interface TodayAttendance {
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm:ss
  checkOutTime?: string; // HH:mm:ss
  checkInTimestamp?: number; // Date.now() saat absen masuk — biar timer akurat di background
  isLate?: boolean;
  isForgotClockOut?: boolean;
}

interface AuthContextType {
  user: User | null;
  todayAttendance: TodayAttendance | null;
  yesterdayForgotClockOut: boolean;
  locations: OfficeLocation[];
  isAuthReady: boolean;
  login: (email: string, password: string, role: 'employee' | 'admin') => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  recordCheckIn: (time: string) => void;
  recordCheckOut: (time: string, forgotClockOut?: boolean) => void;
  clearTodayAttendance: () => void;
  refreshLocations: () => Promise<void>;
  dismissYesterdayAlert: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [yesterdayForgotClockOut, setYesterdayForgotClockOut] = useState(false);
  const [, setSession] = useState<Session | null>(null);
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getYesterdayDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  const fetchLocations = useCallback(async () => {
    const { data } = await supabase
      .from('office_locations')
      .select('*');
    if (data && data.length > 0) {
      setLocations(data.map((loc: any) => ({
        id: loc.id, name: loc.name,
        address: loc.address || undefined,
        lat: loc.lat, lng: loc.lng, radius: loc.radius,
      })));
    } else {
      setLocations([]);
    }
  }, []);

  const fetchProfile = async (userId: string): Promise<User | null> => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      role: data.role,
      status: data.status,
      position: data.position || undefined,
      division: data.division || undefined,
      age: data.age ?? undefined,
      locationId: data.location_id || undefined,
    };
  };

  const checkYesterdayForgotClockOut = useCallback(async (userId: string) => {
    const yesterday = getYesterdayDate();
    const { data } = await supabase
      .from('attendance_records')
      .select('id, time_in, time_out, is_forgot_clock_out')
      .eq('user_id', userId)
      .eq('date', yesterday)
      .single();

    if (data && data.time_in && !data.time_out && !data.is_forgot_clock_out) {
      // Auto-fix: set time_out ke 17:00 + flag forgot clock out
      await supabase
        .from('attendance_records')
        .update({ time_out: '17:00:00', is_forgot_clock_out: true })
        .eq('id', data.id);
      setYesterdayForgotClockOut(true);
    }
  }, []);

  const restoreTodayAttendance = useCallback(async (userId: string) => {
    const today = getTodayDate();
    const { data } = await supabase
      .from('attendance_records')
      .select('time_in, time_out, is_forgot_clock_out')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (data?.time_in) {
      const [h] = data.time_in.split(':').map(Number);
      const isLate = h > 8 || (h === 8 && parseInt(data.time_in.split(':')[1]) > 0);
      const restored: TodayAttendance = {
        date: today,
        checkInTime: data.time_in,
        checkOutTime: data.time_out || undefined,
        isLate,
        isForgotClockOut: data.is_forgot_clock_out || undefined,
      };
      // Set timestamp based on checkInTime for accurate elapsed timer
      if (data.time_in && !data.time_out) {
        const [hour, min, sec] = data.time_in.split(':').map(Number);
        const d = new Date();
        d.setHours(hour, min, sec || 0);
        restored.checkInTimestamp = d.getTime();
      }
      setTodayAttendance(restored);
      localStorage.setItem('todayAttendance', JSON.stringify(restored));
      return true;
    }
    return false;
  }, []);

  const initializeAttendance = useCallback(async (userId: string) => {
    // 1. Cek lupa absen keluar kemarin → auto-fix
    await checkYesterdayForgotClockOut(userId);
    // 2. Restore today's session from DB (overrides localStorage)
    await restoreTodayAttendance(userId);
  }, [checkYesterdayForgotClockOut, restoreTodayAttendance]);

  useEffect(() => {
    initLocationCache();

    // Restore session on mount — fetch locations dulu baru profile
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await fetchLocations();
      setSession(session);
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (profile) {
          setUser(profile);
          await initializeAttendance(session.user.id);
        }
      }
      // Auth sudah siap — beri tahu layout agar tidak redirect ke login
      setIsAuthReady(true);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          await fetchLocations();
          const profile = await fetchProfile(session.user.id);
          setUser(profile);
          if (profile) {
            await initializeAttendance(session.user.id);
          }
        } else {
          setUser(null);
        }
        setIsAuthReady(true);
      }
    );

    // Fallback: restore dari localStorage (kalau DB blum siap)
    const storedAttendance = localStorage.getItem('todayAttendance');
    if (storedAttendance) {
      try {
        const parsed = JSON.parse(storedAttendance);
        if (parsed.date === getTodayDate() && !todayAttendance) {
          setTodayAttendance(parsed);
        } else {
          localStorage.removeItem('todayAttendance');
        }
      } catch {
        localStorage.removeItem('todayAttendance');
      }
    }

    return () => subscription.unsubscribe();
  }, [fetchLocations, initializeAttendance]);

  const login = async (email: string, password: string, role: 'employee' | 'admin') => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message === 'Invalid login credentials') {
        throw new Error('Email atau password salah.');
      }
      throw error;
    }

    if (!data.user) throw new Error('Gagal login');

    // Pastikan lokasi sudah terfetch sebelum set user
    await fetchLocations();

    // Fetch profile to validate role & status
    const profile = await fetchProfile(data.user.id);
    if (!profile) throw new Error('Profil tidak ditemukan.');

    if (profile.role !== role) {
      await supabase.auth.signOut();
      throw new Error(
        role === 'admin'
          ? 'Akun ini bukan admin. Gunakan halaman login karyawan.'
          : 'Akun ini bukan karyawan. Gunakan portal admin.'
      );
    }

    if (profile.status === 'pending') {
      await supabase.auth.signOut();
      throw new Error('Akun Anda masih menunggu persetujuan Admin.');
    }

    setUser(profile);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTodayAttendance(null);
    localStorage.removeItem('todayAttendance');
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...data });
    }
  };

  const recordCheckIn = (time: string) => {
    const today = getTodayDate();
    const [hours] = time.split(':').map(Number);
    const isLate = hours > 8 || (hours === 8 && parseInt(time.split(':')[1]) > 0);

    const newAttendance: TodayAttendance = {
      date: today,
      checkInTime: time,
      checkInTimestamp: Date.now(),
      isLate,
    };
    setTodayAttendance(newAttendance);
    localStorage.setItem('todayAttendance', JSON.stringify(newAttendance));
  };

  const recordCheckOut = (time: string, forgotClockOut?: boolean) => {
    if (todayAttendance) {
      const updated = {
        ...todayAttendance,
        checkOutTime: time,
        isForgotClockOut: forgotClockOut ?? todayAttendance.isForgotClockOut,
      };
      setTodayAttendance(updated);
      localStorage.setItem('todayAttendance', JSON.stringify(updated));
    }
  };

  const clearTodayAttendance = () => {
    setTodayAttendance(null);
    localStorage.removeItem('todayAttendance');
  };

  const dismissYesterdayAlert = () => {
    setYesterdayForgotClockOut(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        todayAttendance,
        yesterdayForgotClockOut,
        locations,
        isAuthReady,
        login,
        logout,
        updateUser,
        recordCheckIn,
        recordCheckOut,
        clearTodayAttendance,
        refreshLocations: fetchLocations,
        dismissYesterdayAlert,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
