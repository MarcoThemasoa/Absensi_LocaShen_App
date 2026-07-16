import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { mockUsers } from '../lib/mockData';

interface TodayAttendance {
  date: string; // YYYY-MM-DD
  checkInTime?: string; // HH:mm:ss
  checkOutTime?: string; // HH:mm:ss
  isLate?: boolean;
}

interface AuthContextType {
  user: User | null;
  todayAttendance: TodayAttendance | null;
  login: (id: string, password: string, role: 'employee' | 'admin') => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  recordCheckIn: (time: string) => void;
  recordCheckOut: (time: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  useEffect(() => {
    // Check local storage for mock session
    const storedUserId = localStorage.getItem('mockUserId');
    if (storedUserId) {
      const foundUser = mockUsers.find(u => u.id === storedUserId);
      if (foundUser) {
        setUser(foundUser);
      }
    }

    // Initialize today's attendance from localStorage
    const storedAttendance = localStorage.getItem('todayAttendance');
    if (storedAttendance) {
      const parsed = JSON.parse(storedAttendance);
      // Reset if it's a different day
      if (parsed.date === getTodayDate()) {
        setTodayAttendance(parsed);
      } else {
        localStorage.removeItem('todayAttendance');
      }
    }
  }, []);

  const login = async (id: string, password: string, role: 'employee' | 'admin') => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In a real app, this would verify credentials
    const foundUser = mockUsers.find(u => u.id === id && u.role === role);
    
    if (foundUser) {
      if (foundUser.status === 'pending') {
        throw new Error('Akun Anda masih menunggu persetujuan Admin.');
      }
      setUser(foundUser);
      localStorage.setItem('mockUserId', foundUser.id);
    } else {
      throw new Error('ID atau Password tidak valid.');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mockUserId');
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
    // Check if it's past 08:00 (assuming work starts at 08:00)
    const [hours] = time.split(':').map(Number);
    const isLate = hours > 8 || (hours === 8 && parseInt(time.split(':')[1]) > 0);

    const newAttendance: TodayAttendance = {
      date: today,
      checkInTime: time,
      isLate,
    };
    setTodayAttendance(newAttendance);
    localStorage.setItem('todayAttendance', JSON.stringify(newAttendance));
  };

  const recordCheckOut = (time: string) => {
    if (todayAttendance) {
      const updated = {
        ...todayAttendance,
        checkOutTime: time,
      };
      setTodayAttendance(updated);
      localStorage.setItem('todayAttendance', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        todayAttendance,
        login,
        logout,
        updateUser,
        recordCheckIn,
        recordCheckOut,
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
