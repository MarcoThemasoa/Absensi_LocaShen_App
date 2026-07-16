const fs = require('fs');
let code = fs.readFileSync('src/pages/CameraAbsen.tsx', 'utf8');

// Modify the location checking logic
const locCheckLogic = `            mockLocations.forEach(loc => {
              // Haversine formula
              const R = 6371e3; // Earth radius in metres
              const lat1 = userLat * Math.PI/180;
              const lat2 = loc.lat * Math.PI/180;
              const dLat = (loc.lat - userLat) * Math.PI/180;
              const dLng = (loc.lng - userLng) * Math.PI/180;

              const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(lat1) * Math.cos(lat2) *
                        Math.sin(dLng/2) * Math.sin(dLng/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              const dist = R * c; // in metres
              
              if (dist < closestDist) {
                closestDist = dist;
              }
              if (dist <= loc.radius) {
                isAnyInRange = true;
              }
            });`;

const newLocCheckLogic = `            const assignedLoc = mockLocations.find(l => l.id === user?.locationId);
            if (assignedLoc) {
              const R = 6371e3;
              const lat1 = userLat * Math.PI/180;
              const lat2 = assignedLoc.lat * Math.PI/180;
              const dLat = (assignedLoc.lat - userLat) * Math.PI/180;
              const dLng = (assignedLoc.lng - userLng) * Math.PI/180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              closestDist = R * c;
              isAnyInRange = closestDist <= assignedLoc.radius;
            } else {
              isAnyInRange = false;
            }`;

if (code.includes('mockLocations.forEach(loc => {')) {
  code = code.replace(locCheckLogic, newLocCheckLogic);
  fs.writeFileSync('src/pages/CameraAbsen.tsx', code);
  console.log('Patched CameraAbsen.tsx');
} else {
  console.log('Target not found in CameraAbsen.tsx');
}
