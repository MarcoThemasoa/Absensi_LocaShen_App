const fs = require('fs');
let code = fs.readFileSync('src/lib/mockData.ts', 'utf8');

// Update Budi in mockUsers
code = code.replace(
  "{ id: '1', name: 'Budi Santoso', role: 'employee', position: 'Staf Administrasi', locationId: 'loc1', status: 'active' }",
  "{ id: '1', name: 'Budi Santoso', role: 'employee', position: 'Staf Administrasi', locationId: 'loc-current', status: 'active' }"
);

// Update Budi's attendance locations to loc-current
code = code.replace(
  /userId: '1',\n    userName: 'Budi Santoso',\n    date: formatDate\(yesterday\),\n    timeIn: '07:50',\n    timeOut: '17:10',\n    status: 'hadir',\n    location: { lat: -7\.250445, lng: 112\.768845 },\n    locationId: 'loc1'/g,
  "userId: '1',\n    userName: 'Budi Santoso',\n    date: formatDate(yesterday),\n    timeIn: '07:50',\n    timeOut: '17:10',\n    status: 'hadir',\n    location: { lat: -6.200000, lng: 106.816666 },\n    locationId: 'loc-current'"
);

code = code.replace(
  /userId: '1',\n    userName: 'Budi Santoso',\n    date: formatDate\(today\),\n    timeIn: '08:15',\n    status: 'telat',\n    location: { lat: -7\.250445, lng: 112\.768845 },\n    locationId: 'loc1'/g,
  "userId: '1',\n    userName: 'Budi Santoso',\n    date: formatDate(today),\n    timeIn: '08:15',\n    status: 'telat',\n    location: { lat: -6.200000, lng: 106.816666 },\n    locationId: 'loc-current'"
);

fs.writeFileSync('src/lib/mockData.ts', code);
