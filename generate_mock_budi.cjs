const fs = require('fs');
let code = fs.readFileSync('src/lib/mockData.ts', 'utf8');

const additionalRecords = [];
for (let i = 1; i <= 15; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i - 2); // To avoid overlap with today/yesterday
  const dateStr = d.toISOString().split('T')[0];
  
  additionalRecords.push(`  {
    id: 'att-budi-${i}',
    userId: '1',
    userName: 'Budi Santoso',
    date: '${dateStr}',
    timeIn: '07:5${(i%9)}',
    timeOut: '17:1${(i%9)}',
    status: 'hadir',
    location: { lat: -6.200000, lng: 106.816666 },
    locationId: 'loc-current',
  }`);
}

const recordsStr = additionalRecords.join(',\n');
code = code.replace(
  "export const mockAttendance: AttendanceRecord[] = [",
  "export const mockAttendance: AttendanceRecord[] = [\n" + recordsStr + ","
);

fs.writeFileSync('src/lib/mockData.ts', code);
console.log('Added 15 records for Budi to mockData');
