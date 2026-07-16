const fs = require('fs');
let code = fs.readFileSync('src/lib/mockData.ts', 'utf8');

const target = `export const mockUsers: User[] = [`;
// just add division and age into the map or string replacements for the array items
// we can do a simple regex replace on the mockUsers array
// wait, the easiest is to just write a short script that parses the file or uses regex

code = code.replace(/{ id: '1', name: 'Budi Santoso', role: 'employee', position: 'Staf Administrasi', locationId: 'loc-current', status: 'active' },/g,
  "{ id: '1', name: 'Budi Santoso', role: 'employee', position: 'Staf Administrasi', division: 'Administrasi', age: 28, locationId: 'loc-current', status: 'active' },");

code = code.replace(/{ id: '3', name: 'Agus Pratama', role: 'employee', position: 'Teknisi Lapangan', locationId: 'loc2', status: 'active' },/g,
  "{ id: '3', name: 'Agus Pratama', role: 'employee', position: 'Teknisi Lapangan', division: 'Teknisi', age: 32, locationId: 'loc2', status: 'active' },");

fs.writeFileSync('src/lib/mockData.ts', code);
console.log("Patched mockData.ts users partially");
