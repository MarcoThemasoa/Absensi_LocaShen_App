const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminLocations.tsx', 'utf8');

const target = `export default function AdminLocations() {
  const [locations, setLocations] = useState(mockLocations);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLoc, setNewLoc] = useState({ name: '', address: '', lat: '-7.250445', lng: '112.768845', radius: '50' });
  const [addressQuery, setAddressQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const handleSearchAddress = async () => {`;

const replacement = `import { useEffect } from 'react';

export default function AdminLocations() {
  const [locations, setLocations] = useState(mockLocations);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLoc, setNewLoc] = useState({ name: '', address: '', lat: '-7.250445', lng: '112.768845', radius: '50' });
  const [addressQuery, setAddressQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Set default synchronously to the first location if available to avoid blank state
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    mockLocations.length > 0 ? mockLocations[0].id : null
  );

  useEffect(() => {
    // Attempt to auto-select the closest location
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

  const handleSearchAddress = async () => {`;

code = code.replace(target, replacement);

const targetDetails = `const locationDetails = useMemo(() => {
    if (!selectedLocationId) return null;
    const locAttendances = mockAttendance.filter(a => a.locationId === selectedLocationId && a.date === today);
    return {
      totalEmployees: locAttendances.length,
      hadir: locAttendances.filter(a => a.status === 'hadir').length,
      telat: locAttendances.filter(a => a.status === 'telat').length,
      cuti: locAttendances.filter(a => a.status === 'cuti').length,
      attendances: locAttendances
    };
  }, [selectedLocationId, today]);`;

const replacementDetails = `const locationDetails = useMemo(() => {
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
  }, [selectedLocationId, today]);`;

code = code.replace(targetDetails, replacementDetails);

fs.writeFileSync('src/pages/AdminLocations.tsx', code);
