import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { mockLocations, mockAttendance, mockUsers } from '../lib/mockData';
import { MapPin, Plus, Users } from 'lucide-react';
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

function LocationPicker({ position, setPosition }: any) {
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

import { useEffect } from 'react';

export default function AdminLocations() {
  const [locations, setLocations] = useState(mockLocations);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLoc, setNewLoc] = useState({ name: '', address: '', lat: '-7.250445', lng: '112.768845', radius: '50' });
  const [addressQuery, setAddressQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Simpan pilihan combobox ke localStorage — biar gak hilang pas refresh / ganti tab
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(() => {
    const saved = localStorage.getItem('adminSelectedLocationId');
    if (saved && locations.some(l => l.id === saved)) return saved;
    return mockLocations.length > 0 ? mockLocations[0].id : null;
  });

  useEffect(() => {
    if (selectedLocationId) {
      localStorage.setItem('adminSelectedLocationId', selectedLocationId);
    }
  }, [selectedLocationId]);

  useEffect(() => {
    // Attempt to auto-select the closest location (hanya jika belum ada pilihan tersimpan)
    const saved = localStorage.getItem('adminSelectedLocationId');
    if (saved && locations.some(l => l.id === saved)) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          let closest = locations[0];
          let minDistance = Infinity;
          
          locations.forEach(loc => {
            const p = 0.017453292519943295;
            const c = Math.cos;
            const a = 0.5 - c((loc.lat - lat) * p)/2 + 
                    c(lat * p) * c(loc.lat * p) * 
                    (1 - c((loc.lng - lng) * p))/2;
            const dist = 12742 * Math.asin(Math.sqrt(a));
            if (dist < minDistance) {
              minDistance = dist;
              closest = loc;
            }
          });
          
          if (closest) {
            setSelectedLocationId(closest.id);
          }
        },
        () => {
          // Fallback to first if GPS fails
          if (locations.length > 0 && !selectedLocationId) {
             setSelectedLocationId(locations[0].id);
          }
        },
        { timeout: 5000 }
      );
    }
  }, []);

  const handleSearchAddress = async () => {
    if (!addressQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setNewLoc(prev => ({
          ...prev,
          address: data[0].display_name,
          lat: parseFloat(data[0].lat).toFixed(6),
          lng: parseFloat(data[0].lon).toFixed(6)
        }));
      } else {
        alert('Alamat tidak ditemukan');
      }
    } catch (e) {
      console.error(e);
      alert('Gagal mencari alamat');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddLocation = () => {
    if (newLoc.name && newLoc.address && newLoc.lat && newLoc.lng && newLoc.radius) {
      setLocations([...locations, {
        id: Math.random().toString(),
        name: newLoc.name,
        address: newLoc.address,
        lat: parseFloat(newLoc.lat),
        lng: parseFloat(newLoc.lng),
        radius: parseInt(newLoc.radius, 10)
      }]);
      setNewLoc({ name: '', address: '', lat: '-7.250445', lng: '112.768845', radius: '50' });
      setAddressQuery('');
      setIsDialogOpen(false);
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
    const locAttendances = mockAttendance.filter(a => a.locationId === selectedLocationId && a.date === today);
    const locUsers = mockUsers.filter(u => u.locationId === selectedLocationId);
    return {
      totalEmployees: locUsers.length,
      hadir: locAttendances.filter(a => a.status === 'hadir').length,
      telat: locAttendances.filter(a => a.status === 'telat').length,
      cuti: locAttendances.filter(a => a.status === 'cuti').length,
      attendances: locAttendances
    };
  }, [selectedLocationId, today]);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 drop-shadow-sm">Manajemen Lokasi</h1>
            <p className="text-gray-500 font-medium mt-1">Daftar lokasi kantor dan pengaturan radius (Geotagging).</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                  {newLoc.address && <p className="text-xs text-gray-500 mt-1 line-clamp-2">Alamat terpilih: {newLoc.address}</p>}
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
        <div className="mb-2 z-10 relative">
          <Combobox
            options={locations.map(l => ({ label: l.name, value: l.id }))}
            value={selectedLocationId || ''}
            onChange={setSelectedLocationId}
            placeholder="Pilih lokasi..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {selectedLocation && locationDetails && (
            <Card className="rounded-3xl border border-teal-100 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <CardHeader className="border-b border-[#113129]/10">
                <CardTitle className="text-lg font-bold text-[#113129] flex items-center justify-between gap-2">
                  <span>Detail Karyawan: {selectedLocation.name}</span>
                  <Users size={20} className="text-[#113129] shrink-0" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-xl p-4 flex flex-col items-center justify-center text-center border border-gray-100">
                    <p className="text-sm font-bold text-gray-500 mb-1">Total</p>
                    <p className="text-2xl font-black text-gray-900">{locationDetails.totalEmployees}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 flex flex-col items-center justify-center text-center border border-green-100">
                    <p className="text-sm font-bold text-green-700 mb-1">Hadir</p>
                    <p className="text-2xl font-black text-green-700">{locationDetails.hadir}</p>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-4 flex flex-col items-center justify-center text-center border border-yellow-100">
                    <p className="text-sm font-bold text-yellow-700 mb-1">Telat</p>
                    <p className="text-2xl font-black text-yellow-700">{locationDetails.telat}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 flex flex-col items-center justify-center text-center border border-blue-100">
                    <p className="text-sm font-bold text-blue-700 mb-1">Cuti</p>
                    <p className="text-2xl font-black text-blue-700">{locationDetails.cuti}</p>
                  </div>
                </div>

                {locationDetails.attendances.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <Table className="w-full">
                      <TableHeader className="bg-gray-50">
                        <TableRow className="border-b border-gray-100">
                          <TableHead className="font-bold text-gray-900 text-center">ID</TableHead>
                          <TableHead className="font-bold text-gray-900 text-center">Nama</TableHead>
                          <TableHead className="font-bold text-gray-900 text-center">Waktu</TableHead>
                          <TableHead className="font-bold text-gray-900 text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locationDetails.attendances.map(att => (
                          <TableRow key={att.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <TableCell className="font-medium text-gray-500 text-center">{att.userId}</TableCell>
                            <TableCell className="font-bold text-gray-900 text-center">{att.userName}</TableCell>
                            <TableCell className="text-gray-600 text-center">{att.timeIn || '-'}</TableCell>
                            <TableCell className="text-center">
                              {att.status === 'hadir' && <span className="inline-flex items-center rounded-lg bg-green-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-green-700">Hadir</span>}
                              {att.status === 'telat' && <span className="inline-flex items-center rounded-lg bg-yellow-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-yellow-700">Telat</span>}
                              {att.status === 'cuti' && <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-blue-700">Cuti</span>}
                              {att.status === 'alpha' && <span className="inline-flex items-center rounded-lg bg-red-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-red-700">Alpha</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 font-medium py-4">Belum ada karyawan yang tercatat di lokasi ini hari ini.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
        <div className="md:col-span-1">
          <Card className="rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-[500px] md:h-full min-h-[500px] flex flex-col items-center justify-center p-4 sticky top-24">
            <div className="flex-1 w-full rounded-2xl overflow-hidden border border-gray-200 relative">
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
          </Card>
        </div>
      </div>
    </div>
  );
}
