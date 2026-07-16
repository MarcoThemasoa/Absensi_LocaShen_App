export interface User {
  id: string;
  name: string;
  role: 'employee' | 'admin';
  position?: string;
  division?: string;
  age?: string | number;
  locationId?: string;
  status: 'active' | 'pending';
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  timeIn: string; // HH:mm
  timeOut?: string; // HH:mm
  status: 'hadir' | 'telat' | 'alpha' | 'cuti';
  location: { lat: number; lng: number };
  locationId?: string;
  photoUrl?: string;
}

export interface OfficeLocation {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  radius: number; // in meters
}
