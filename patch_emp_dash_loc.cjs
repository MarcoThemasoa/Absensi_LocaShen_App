const fs = require('fs');
let code = fs.readFileSync('src/pages/EmployeeDashboard.tsx', 'utf8');

// Target the MapPin and location rendering
const target = `<MapPin size={14} className="text-teal-600"/> {mockLocations.find(l => l.id === user?.locationId)?.name || 'Kantor Pusat'}`;
const replacement = `<MapPin size={14} className="text-teal-600 shrink-0"/> {
                    (() => {
                      const name = mockLocations.find(l => l.id === user?.locationId)?.name || 'Kantor Pusat';
                      return name.split(' ').slice(0, 2).join(' ');
                    })()
                  }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/pages/EmployeeDashboard.tsx', code);
  console.log("Patched EmployeeDashboard.tsx");
} else {
  console.log("Could not find target in EmployeeDashboard.tsx");
}
