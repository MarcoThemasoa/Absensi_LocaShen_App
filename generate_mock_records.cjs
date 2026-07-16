const fs = require('fs');
let code = fs.readFileSync('src/lib/mockData.ts', 'utf8');

const additionalRecords = [];
for (let i = 1; i <= 15; i++) {
  const d = new Date();
  d.setDate(d.getDate() - i);
  const dateStr = d.toISOString().split('T')[0];
  
  additionalRecords.push(`  {
    id: 'att-agus-${i}',
    userId: '3',
    userName: 'Agus Pratama',
    date: '${dateStr}',
    timeIn: '08:0${(i%9)+1}',
    timeOut: '17:0${(i%9)+1}',
    status: 'hadir',
    location: { lat: -7.445214, lng: 112.716186 },
    locationId: 'loc2',
  }`);
}

const recordsStr = additionalRecords.join(',\n');
code = code.replace(
  "export const mockAttendance: AttendanceRecord[] = [",
  "export const mockAttendance: AttendanceRecord[] = [\n" + recordsStr + ","
);

fs.writeFileSync('src/lib/mockData.ts', code);
console.log('Added 15 records to mockData');
