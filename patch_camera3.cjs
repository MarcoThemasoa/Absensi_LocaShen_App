const fs = require('fs');
let code = fs.readFileSync('src/pages/CameraAbsen.tsx', 'utf8');

code = code.replace(
  "Anda berada di radius Kantor Pusat",
  "{`Anda berada di radius ${mockLocations.find(l => l.id === user?.locationId)?.name || 'Kantor Pusat'}`}"
);

fs.writeFileSync('src/pages/CameraAbsen.tsx', code);
console.log('Patched CameraAbsen.tsx radius text');
