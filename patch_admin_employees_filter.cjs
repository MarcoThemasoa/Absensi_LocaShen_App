const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminEmployees.tsx', 'utf8');

const targetEffect = `  useEffect(() => {
    if (searchParams.get('status')) setFilterStatus(searchParams.get('status')!);
    if (searchParams.get('location') && searchParams.get('location') !== 'semua') {
      setFilterLocationAll(searchParams.get('location')!);
    } else if (filterLocationAll === 'semua') {
      // Auto-detect closest location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            let closest = mockLocations[0];
            let minDistance = Infinity;
            
            mockLocations.forEach(loc => {
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
              setFilterLocationAll(closest.id);
            }
          },
          () => {
            if (mockLocations.length > 0) setFilterLocationAll(mockLocations[0].id);
          }
        );
      } else if (mockLocations.length > 0) {
        setFilterLocationAll(mockLocations[0].id);
      }
    }
  }, [searchParams]);`;

const newEffect = `  useEffect(() => {
    if (searchParams.get('status')) setFilterStatus(searchParams.get('status')!);
    if (searchParams.get('location') && searchParams.get('location') !== 'semua') {
      setFilterLocationAll(searchParams.get('location')!);
    }
  }, [searchParams]);`;

if (code.includes('if (navigator.geolocation) {') && code.includes('const p = 0.017453292519943295;')) {
  code = code.replace(targetEffect, newEffect);
  fs.writeFileSync('src/pages/AdminEmployees.tsx', code);
  console.log("Patched AdminEmployees.tsx successfully");
} else {
  console.log("Target effect not found in AdminEmployees.tsx");
}
