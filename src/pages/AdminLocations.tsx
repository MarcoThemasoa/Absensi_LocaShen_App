import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from '../lib/supabaseCache';
import { AttendanceRecord, User } from '../types';
import { MapPin, Plus, Users, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle, useMap, Popup } from 'react-leaflet';
import { Combobox } from '../components/ui/combobox';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

function LocationPicker({ position, setPosition }: {
  position: { lat: number; lng: number };
  setPosition: (pos: { lat: number; lng: number; address?: string }) => void;
}) {
  useMapEvents({
    async click(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      setPosition({ lat, lng, address: 'Mengambil alamat...' });
      
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        if (data && data.display_name) {
          setPosition({ lat, lng, address: data.display_name });
        } else {
          setPosition({ lat, lng, address: 'Alamat tidak ditemukan' });
        }
      } catch (err) {
        setPosition({ lat, lng, address: 'Gagal mengambil alamat' });
      }
    },
  });
  return position.lat && position.lng ? <Marker position={[position.lat, position.lng]} /> : null;
}

import { useEffect, useCallback } from 'react';

export default function AdminLocations() {
  const { user, locations: authLocations, refreshLocations } = useAuth();
  const [locations, setLocations] = useState(authLocations);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [emplUsers, setEmplUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [attendancePage, setAttendancePage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0); // 🔄 trigger re-fetch
  const attendancesPerPage = 6;
  const [newLoc, setNewLoc] = useState({ name: '', address: '', lat: '-7.250445', lng: '112.768845', radius: '50' });
  const [addressQuery, setAddressQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{lat: string; lng: string; display_name: string}[]>([]);
  const [userCoords, setUserCoords] = useState<{lat: number; lng: number} | null>(null);
  const [selectedSearchIdx, setSelectedSearchIdx] = useState<number | null>(null);

  // Edit location state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', address: '', lat: '', lng: '', radius: '' });
  const [editSearchQuery, setEditSearchQuery] = useState('');
  const [editSearchResults, setEditSearchResults] = useState<{lat: string; lng: string; display_name: string}[]>([]);
  const [editSelectedSearchIdx, setEditSelectedSearchIdx] = useState<number | null>(null);
  const [isEditSearching, setIsEditSearching] = useState(false);

  // Ambil posisi GPS user saat membuka dialog
  useEffect(() => {
    if (isDialogOpen && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => setUserCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => setUserCoords(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [isDialogOpen]);

  // Haversine distance in km
  const haversine = useCallback((a: {lat: number; lng: number}, b: {lat: number; lng: number}) => {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const a2 = Math.sin(dLat/2)**2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
  }, []);

  // 🔄 Re-fetch: manual refresh atau saat authLocations / refreshKey berubah
  const fetchEmployeesAndAttendance = useCallback(async () => {
    try {
      // Fetch attendance + users in parallel (cached)
      const [attResult, userResult] = await Promise.all([
        cachedQuery<any[]>('locations:attendance', () =>
          supabase.from('attendance_records').select('*').order('date', { ascending: false })
        ),
        cachedQuery<any[]>('locations:users', () =>
          supabase.from('users').select('*').eq('role', 'employee')
        ),
      ]);

      if (userResult.error) {
        console.error('Gagal fetch users:', userResult.error);
        return;
      }
      if (attResult.error) {
        console.error('Gagal fetch attendance:', attResult.error);
        return;
      }

      // Build user lookup: userId → user data
      const userData = userResult.data || [];
      const userMap = new Map(userData.map((u: any) => [u.id, u]));

      if (userData.length > 0) {
        setEmplUsers(userData.map((u: any) => ({
          id: u.id, name: u.name, email: '',
          role: u.role, status: u.status,
          locationId: u.location_id || undefined,
        })));

        // 🔍 Debug: log jumlah karyawan per lokasi
        const countByLoc: Record<string, number> = {};
        userData.forEach((u: any) => {
          const locId = u.location_id || '__null__';
          countByLoc[locId] = (countByLoc[locId] || 0) + 1;
        });
        console.log('[AdminLocations] Jumlah karyawan per location_id:', countByLoc);
      } else {
        console.warn('[AdminLocations] Tidak ada data karyawan! Mungkin RLS memblokir?');
        setEmplUsers([]);
      }

      // Enrich attendance records with userName + locationId from users table
      if (attResult.data && attResult.data.length > 0) {
        setAttendances(attResult.data.map((a: any) => {
          const user = userMap.get(a.user_id);
          return {
            id: a.id,
            userId: a.user_id,
            userName: user?.name || '',
            date: a.date,
            timeIn: a.time_in || '',
            timeOut: a.time_out || '',
            status: a.status,
            location: { lat: a.location_lat || -7.250445, lng: a.location_lng || 112.768845 },
            locationId: user?.location_id || undefined,
          };
        }));
      } else {
        setAttendances([]);
      }
    } catch (e) {
      console.error('Exception saat fetch data lokasi:', e);
    }
  }, []);

  // ── Fetch real data dari Supabase ──
  useEffect(() => {
    if (authLocations.length > 0) setLocations(authLocations);
    fetchEmployeesAndAttendance();
  }, [authLocations, refreshKey, fetchEmployeesAndAttendance]);

  // Simpan pilihan combobox ke localStorage
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => {
    const saved = localStorage.getItem('adminSelectedLocationId');
    if (saved && locations.some(l => l.id === saved)) return saved;
    return locations.length > 0 ? locations[0].id : null;
  });

  useEffect(() => {
    if (selectedLocationId) {
      localStorage.setItem('adminSelectedLocationId', selectedLocationId);
    }
    // Reset halaman setiap ganti lokasi
    setAttendancePage(0);
  }, [selectedLocationId]);

  const handleSearchAddress = async () => {
    if (!addressQuery) return;
    setIsSearching(true);
    setSelectedSearchIdx(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=10&q=${encodeURIComponent(addressQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setSearchResults(data.map((d: any) => ({ lat: d.lat, lng: d.lon, display_name: d.display_name })));
        // Auto-pilih hasil pertama
        handlePickSearchResult(0, data);
      } else {
        setSearchResults([]);
        alert('Alamat tidak ditemukan');
      }
    } catch (e) {
      console.error(e);
      alert('Gagal mencari alamat');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePickSearchResult = (idx: number, results?: any[]) => {
    const list = results || searchResults;
    if (!list || idx < 0 || idx >= list.length) return;
    setSelectedSearchIdx(idx);
    const item = list[idx];
    setNewLoc(prev => ({
      ...prev,
      address: item.display_name,
      lat: parseFloat(item.lat).toFixed(6),
      lng: parseFloat(item.lng).toFixed(6)
    }));
  };

  const handleAddLocation = async () => {
    if (!newLoc.name || !newLoc.address || !newLoc.lat || !newLoc.lng || !newLoc.radius) return;
    try {
      // 1. Insert ke Supabase
      const { data: inserted, error: insErr } = await supabase
        .from('office_locations')
        .insert({
          name: newLoc.name,
          address: newLoc.address,
          lat: parseFloat(newLoc.lat),
          lng: parseFloat(newLoc.lng),
          radius: parseInt(newLoc.radius, 10),
        })
        .select()
        .single();

      if (insErr) throw insErr;

      // 2. Log aktivitas
      await supabase.from('admin_activity_logs').insert({
        admin_id: user?.id || 'c0000000-0000-0000-0000-000000000001',
        action: `Menambahkan lokasi baru: ${newLoc.name}`,
        action_timestamp: new Date().toISOString(),
        location_lat: parseFloat(newLoc.lat),
        location_lng: parseFloat(newLoc.lng),
        location_name: newLoc.name,
      });

      // 3. Update state lokal + refresh AuthContext + pilih lokasi baru
      if (inserted) {
        setLocations(prev => [...prev, {
          id: inserted.id,
          name: inserted.name,
          address: inserted.address,
          lat: inserted.lat,
          lng: inserted.lng,
          radius: inserted.radius,
        }]);
        invalidateCache('locations:'); // refresh cache lokasi
        // Refresh authLocations agar konsisten antar tab
        refreshLocations();
        // Langsung pilih lokasi yang baru dibuat
        setSelectedLocationId(inserted.id);
      }

      setNewLoc({ name: '', address: '', lat: '-7.250445', lng: '112.768845', radius: '50' });
      setAddressQuery('');
      setSearchResults([]);
      setSelectedSearchIdx(null);
      setIsDialogOpen(false);
    } catch (e) {
      console.error('Gagal menambah lokasi:', e);
      alert('Gagal menyimpan lokasi. Coba lagi.');
    }
  };

  const handleMapClick = (pos: {lat: number, lng: number, address?: string}) => {
    setNewLoc(prev => ({
      ...prev,
      lat: pos.lat.toFixed(6),
      lng: pos.lng.toFixed(6),
      address: pos.address || prev.address
    }));
  };

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const defaultCenter = locations.length > 0 ? [locations[0].lat, locations[0].lng] : [-7.250445, 112.768845];

  const today = new Date().toISOString().split('T')[0];
  const locationDetails = useMemo(() => {
    if (!selectedLocationId) return null;
    const locUsers = emplUsers.filter(u => u.locationId === selectedLocationId);
    const todayAttendances = attendances.filter(a => a.date === today);

    // 🔄 Gabung semua karyawan + status absensi hari ini
    const employeeList = locUsers
      .map(user => {
        const todayAtt = todayAttendances.find(a => a.userId === user.id && a.locationId === selectedLocationId);
        return {
          userId: user.id,
          userName: user.name,
          timeIn: todayAtt?.timeIn || null,
          status: todayAtt?.status || 'belum_absen',
        };
      })
      .sort((a, b) => a.userName.localeCompare(b.userName));

    const hadirCount = employeeList.filter(e => e.status === 'hadir').length;
    const telatCount = employeeList.filter(e => e.status === 'telat').length;
    const cutiCount = employeeList.filter(e => e.status === 'cuti').length;
    const alphaCount = employeeList.filter(e => e.status === 'alpha').length;
    const belumAbsenCount = employeeList.filter(e => e.status === 'belum_absen').length;

    return {
      totalEmployees: locUsers.length,
      hadir: hadirCount,
      telat: telatCount,
      cuti: cutiCount,
      absen: alphaCount + belumAbsenCount,
      employeeList,
    };
  }, [selectedLocationId, today, attendances, emplUsers]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 px-1">
          <div className="ml-2 mt-2">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 drop-shadow-sm">Manajemen Lokasi</h1>
            <p className="text-gray-500 font-medium mt-1">Daftar lokasi kantor dan pengaturan radius (Geotagging).</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setSearchResults([]); setSelectedSearchIdx(null); } }}>
              <DialogTrigger render={<button className="inline-flex shrink-0 items-center justify-center bg-[#113129] hover:bg-[#1a4a3d] text-white font-medium rounded-xl h-11 px-6 shadow-md transition-all w-full md:w-auto text-sm" />}>
                <Plus size={20} className="mr-2" /> Tambah Lokasi
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] rounded-3xl border-white/60 bg-white/90 backdrop-blur-2xl shadow-[0_20px_60px_rgb(0,0,0,0.1)] p-6 z-[100]">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">Tambah Lokasi Baru</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-sm font-bold text-gray-700">Nama Lokasi</Label>
                    <Input id="name" value={newLoc.name} onChange={(e) => setNewLoc({...newLoc, name: e.target.value})} placeholder="Kantor Pusat" className="h-11" />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="address" className="text-sm font-bold text-gray-700">Cari Alamat</Label>
                    <div className="flex gap-2">
                      <Input id="address" value={addressQuery} onChange={(e) => setAddressQuery(e.target.value)} placeholder="Contoh: Jl. Sudirman, Surabaya" className="h-11 flex-1" />
                      <Button type="button" onClick={handleSearchAddress} disabled={isSearching || !addressQuery} className="bg-[#113129] hover:bg-[#1a4a3d] text-white rounded-xl h-11 px-4">
                        {isSearching ? 'Mencari...' : 'Cari'}
                      </Button>
                    </div>
                    {searchResults.length > 0 && (
                      <div className="mt-2 max-h-[180px] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                        {searchResults.map((r, i) => {
                          const dist = userCoords ? haversine(userCoords, {lat: parseFloat(r.lat), lng: parseFloat(r.lng)}) : null;
                          const distLabel = dist !== null ? (dist < 1 ? `${(dist*1000).toFixed(0)} m` : `${dist.toFixed(2)} km`) : '';
                          return (
                            <button key={i} type="button" onClick={() => handlePickSearchResult(i)} className={`w-full text-left px-3 py-2.5 text-xs hover:bg-teal-50/60 transition-colors ${i === selectedSearchIdx ? 'bg-teal-50 border-l-2 border-teal-600' : ''}`}>
                              <div className="flex items-start justify-between gap-2">
                                <span className="line-clamp-2 text-gray-700 flex-1">{r.display_name}</span>
                                {distLabel && <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-gray-400 mt-0.5">{distLabel}</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {newLoc.address && searchResults.length === 0 && <p className="text-xs text-gray-500 mt-1 line-clamp-2">Alamat terpilih: {newLoc.address}</p>}
                  </div>

                  <div className="h-[200px] rounded-xl overflow-hidden border border-gray-200 relative z-0">
                    <MapContainer center={[-7.250445, 112.768845]} zoom={13} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                      <MapUpdater center={[parseFloat(newLoc.lat) || -7.250445, parseFloat(newLoc.lng) || 112.768845]} />
                      <LocationPicker position={{lat: parseFloat(newLoc.lat), lng: parseFloat(newLoc.lng)}} setPosition={handleMapClick} />
                      <Circle center={[parseFloat(newLoc.lat) || -7.250445, parseFloat(newLoc.lng) || 112.768845]} radius={parseInt(newLoc.radius) || 50} pathOptions={{ color: '#113129', fillColor: '#113129' }} />
                    </MapContainer>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="radius" className="text-sm font-bold text-gray-700">Radius (meter)</Label>
                    <Input id="radius" type="number" value={newLoc.radius} onChange={(e) => setNewLoc({...newLoc, radius: e.target.value})} placeholder="50" className="h-11" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddLocation} disabled={!newLoc.name || !newLoc.address} className="w-full bg-[#113129] hover:bg-[#1a4a3d] text-white rounded-xl h-11 font-bold disabled:opacity-50 disabled:cursor-not-allowed">Simpan Lokasi</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* ─── Edit Lokasi Dialog ─── */}
          <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setEditSearchResults([]); setEditSelectedSearchIdx(null); } }}>
            <DialogContent className="sm:max-w-[425px] rounded-3xl border-white/60 bg-white/90 backdrop-blur-2xl shadow-[0_20px_60px_rgb(0,0,0,0.1)] p-6 z-[100]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">Edit Lokasi</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name" className="text-sm font-bold text-gray-700">Nama Lokasi</Label>
                  <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} placeholder="Kantor Pusat" className="h-11" />
                </div>

                <div className="grid gap-2">
                  <Label className="text-sm font-bold text-gray-700">Cari Alamat</Label>
                  <div className="flex gap-2">
                    <Input value={editSearchQuery} onChange={(e) => setEditSearchQuery(e.target.value)} placeholder="Contoh: Jl. Sudirman, Surabaya" className="h-11 flex-1" />
                    <Button type="button" onClick={async () => {
                      if (!editSearchQuery) return;
                      setIsEditSearching(true);
                      setEditSelectedSearchIdx(null);
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=10&q=${encodeURIComponent(editSearchQuery)}`);
                        const data = await res.json();
                        if (data && data.length > 0) {
                          setEditSearchResults(data.map((d: any) => ({ lat: d.lat, lng: d.lon, display_name: d.display_name })));
                          const item = data[0];
                          setEditForm(prev => ({ ...prev, address: item.display_name, lat: parseFloat(item.lat).toFixed(6), lng: parseFloat(item.lng).toFixed(6) }));
                          setEditSelectedSearchIdx(0);
                        } else { setEditSearchResults([]); alert('Alamat tidak ditemukan'); }
                      } catch (e) { console.error(e); alert('Gagal mencari alamat'); }
                      finally { setIsEditSearching(false); }
                    }} disabled={isEditSearching || !editSearchQuery} className="bg-[#113129] hover:bg-[#1a4a3d] text-white rounded-xl h-11 px-4">
                      {isEditSearching ? 'Mencari...' : 'Cari'}
                    </Button>
                  </div>
                  {editSearchResults.length > 0 && (
                    <div className="mt-2 max-h-[180px] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                      {editSearchResults.map((r, i) => (
                        <button key={i} type="button" onClick={() => {
                          setEditSelectedSearchIdx(i);
                          setEditForm(prev => ({ ...prev, address: r.display_name, lat: parseFloat(r.lat).toFixed(6), lng: parseFloat(r.lng).toFixed(6) }));
                        }} className={`w-full text-left px-3 py-2.5 text-xs hover:bg-teal-50/60 transition-colors ${i === editSelectedSearchIdx ? 'bg-teal-50 border-l-2 border-teal-600' : ''}`}>
                          <span className="line-clamp-2 text-gray-700">{r.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {editForm.address && editSearchResults.length === 0 && <p className="text-xs text-gray-500 mt-1 line-clamp-2">Alamat: {editForm.address}</p>}
                </div>

                <div className="h-[200px] rounded-xl overflow-hidden border border-gray-200 relative z-0">
                  <MapContainer center={[-7.250445, 112.768845]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                    <MapUpdater center={[parseFloat(editForm.lat) || -7.250445, parseFloat(editForm.lng) || 112.768845]} />
                    <LocationPicker position={{lat: parseFloat(editForm.lat), lng: parseFloat(editForm.lng)}} setPosition={(pos: {lat: number; lng: number; address?: string}) => setEditForm(prev => ({ ...prev, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6), address: pos.address || prev.address }))} />
                    <Circle center={[parseFloat(editForm.lat) || -7.250445, parseFloat(editForm.lng) || 112.768845]} radius={parseInt(editForm.radius) || 50} pathOptions={{ color: '#113129', fillColor: '#113129' }} />
                  </MapContainer>
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-bold text-gray-700">Radius (meter)</Label>
                  <Input type="number" value={editForm.radius} onChange={(e) => setEditForm({...editForm, radius: e.target.value})} placeholder="50" className="h-11" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={async () => {
                  if (!selectedLocation || !editForm.name || !editForm.address) return;
                  try {
                    await supabase.from('office_locations').update({
                      name: editForm.name, address: editForm.address,
                      lat: parseFloat(editForm.lat), lng: parseFloat(editForm.lng),
                      radius: parseInt(editForm.radius) || 50,
                    }).eq('id', selectedLocation.id);
                    await supabase.from('admin_activity_logs').insert({
                      admin_id: user?.id || 'c0000000-0000-0000-0000-000000000001',
                      action: `Mengubah data lokasi: ${editForm.name}`,
                      action_timestamp: new Date().toISOString(),
                      location_lat: parseFloat(editForm.lat), location_lng: parseFloat(editForm.lng),
                      location_name: editForm.name,
                    });
                    setLocations(prev => prev.map(l => l.id === selectedLocation.id ? {
                      ...l, name: editForm.name, address: editForm.address,
                      lat: parseFloat(editForm.lat), lng: parseFloat(editForm.lng),
                      radius: parseInt(editForm.radius) || 50,
                    } : l));
                    invalidateCache('locations:'); // refresh cache lokasi
                    setEditDialogOpen(false);
                  } catch (e) { console.error('Gagal update lokasi:', e); alert('Gagal menyimpan perubahan.'); }
                }} disabled={!editForm.name || !editForm.address} className="w-full bg-[#113129] hover:bg-[#1a4a3d] text-white rounded-xl h-11 font-bold disabled:opacity-50 disabled:cursor-not-allowed">Simpan Perubahan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="mb-2 z-10 relative">
          <Combobox
            options={locations.map(l => ({ label: l.name, value: l.id }))}
            value={selectedLocationId || ''}
            onChange={setSelectedLocationId}
            placeholder="Pilih lokasi..."
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {selectedLocation && locationDetails && (
          <>
            <Card className="rounded-3xl border border-teal-100 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <CardHeader className="border-b border-[#113129]/10 px-6 sm:px-8 pt-6 pb-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <CardTitle className="text-lg font-bold text-[#113129] flex items-center gap-2">
                    <Users size={24} className="text-[#113129] shrink-0" />
                    <span>Detail Karyawan: {selectedLocation.name}</span>
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="default"
                    className="rounded-xl border-[#113129]/20 text-[#113129] hover:bg-[#113129]/5 shrink-0"
                    onClick={() => {
                      setEditForm({
                        name: selectedLocation.name,
                        address: selectedLocation.address || '',
                        lat: String(selectedLocation.lat),
                        lng: String(selectedLocation.lng),
                        radius: String(selectedLocation.radius),
                      });
                      setEditSearchQuery('');
                      setEditSearchResults([]);
                      setEditSelectedSearchIdx(null);
                      setEditDialogOpen(true);
                    }}
                  >
                    Edit Lokasi
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-1 px-6 sm:px-8 pb-8">
                <div className="grid grid-cols-5 gap-2 sm:gap-3 mb-6">
                  <div className="bg-gray-50 rounded-xl p-3 sm:p-5 flex flex-col items-center justify-center text-center border border-gray-100">
                    <p className="text-xs sm:text-sm font-bold text-gray-500 mb-1">Total</p>
                    <p className="text-lg sm:text-2xl font-black text-gray-900">{locationDetails.totalEmployees}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 sm:p-5 flex flex-col items-center justify-center text-center border border-green-100">
                    <p className="text-xs sm:text-sm font-bold text-green-700 mb-1">Hadir</p>
                    <p className="text-lg sm:text-2xl font-black text-green-700">{locationDetails.hadir}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-3 sm:p-5 flex flex-col items-center justify-center text-center border border-yellow-100">
                    <p className="text-xs sm:text-sm font-bold text-yellow-700 mb-1">Telat</p>
                    <p className="text-lg sm:text-2xl font-black text-yellow-700">{locationDetails.telat}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 sm:p-5 flex flex-col items-center justify-center text-center border border-blue-100">
                    <p className="text-xs sm:text-sm font-bold text-blue-700 mb-1">Cuti</p>
                    <p className="text-lg sm:text-2xl font-black text-blue-700">{locationDetails.cuti}</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3 sm:p-5 flex flex-col items-center justify-center text-center border border-red-100">
                    <p className="text-xs sm:text-sm font-bold text-red-700 mb-1">Absen</p>
                    <p className="text-lg sm:text-2xl font-black text-red-700">{locationDetails.absen}</p>
                  </div>
                </div>

                {locationDetails.employeeList.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <div>
                      <Table className="w-full">
                        <TableHeader className="bg-gray-50">
                          <TableRow className="border-b border-gray-100">
                            <TableHead className="font-bold text-gray-900 text-left pl-3">Nama</TableHead>
                            <TableHead className="font-bold text-gray-900 text-center">Waktu</TableHead>
                            <TableHead className="font-bold text-gray-900 text-center pr-3">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {locationDetails.employeeList
                            .slice(attendancePage * attendancesPerPage, (attendancePage + 1) * attendancesPerPage)
                            .map(emp => (
                            <TableRow key={emp.userId} className="border-b border-gray-50 hover:bg-gray-50/50">
                              <TableCell className="font-bold text-gray-900 text-left pl-3">{emp.userName}</TableCell>
                              <TableCell className="text-gray-600 text-center">{emp.timeIn || '-'}</TableCell>
                              <TableCell className="text-center pr-3">
                                {emp.status === 'hadir' && <span className="inline-flex items-center rounded-lg bg-green-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-green-700">Hadir</span>}
                                {emp.status === 'telat' && <span className="inline-flex items-center rounded-lg bg-yellow-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-yellow-700">Telat</span>}
                                {emp.status === 'cuti' && <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">Cuti</span>}
                                {emp.status === 'alpha' && <span className="inline-flex items-center rounded-lg bg-red-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-red-700">Alpha</span>}
                                {emp.status === 'belum_absen' && <span className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-gray-500">Belum Absen</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 font-medium py-4">Belum ada karyawan yang terdaftar di lokasi ini.</p>
                )}
                {locationDetails.employeeList.length > attendancesPerPage && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-xl h-8 w-8"
                      onClick={() => setAttendancePage(p => Math.max(0, p - 1))}
                      disabled={attendancePage === 0}
                    >
                      <ChevronRight size={14} className="rotate-180" />
                    </Button>
                    <span className="text-sm font-medium text-gray-500">
                      {attendancePage + 1} / {Math.ceil(locationDetails.employeeList.length / attendancesPerPage)}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-xl h-8 w-8"
                      onClick={() => setAttendancePage(p => Math.min(Math.ceil(locationDetails.employeeList.length / attendancesPerPage) - 1, p + 1))}
                      disabled={attendancePage >= Math.ceil(locationDetails.employeeList.length / attendancesPerPage) - 1}
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <CardHeader className="border-b border-[#113129]/10 px-6 sm:px-8 pt-6 pb-1">
                <CardTitle className="text-lg font-bold text-[#113129] flex items-center gap-2">
                  <MapPin size={24} className="text-[#113129] shrink-0" />
                  <span>Peta Lokasi</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6 sm:px-8 pb-8 pt-4">
                <div className="w-full h-[400px] md:h-[500px] rounded-2xl overflow-hidden border border-gray-200 relative">
                  <MapContainer center={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : [defaultCenter[0], defaultCenter[1]]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
                    <MapUpdater center={selectedLocation ? [selectedLocation.lat, selectedLocation.lng] : [defaultCenter[0], defaultCenter[1]]} />
                    {locations.map(loc => (
                      <React.Fragment key={loc.id}>
                        <Marker position={[loc.lat, loc.lng]} eventHandlers={{
                          click: () => setSelectedLocationId(loc.id)
                        }}>
                          <Popup>
                            <div className="font-bold">{loc.name}</div>
                            <div className="text-xs text-gray-500">{loc.address}</div>
                          </Popup>
                        </Marker>
                        <Circle center={[loc.lat, loc.lng]} radius={loc.radius} pathOptions={{ color: selectedLocationId === loc.id ? '#113129' : '#94a3b8', fillColor: selectedLocationId === loc.id ? '#113129' : '#94a3b8' }} />
                      </React.Fragment>
                    ))}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
