const fs = require('fs');
let code = fs.readFileSync('src/pages/EmployeeHistory.tsx', 'utf8');

// Increase padding top for the header
code = code.replace(
  'className="bg-white px-5 pt-10 pb-5 shadow-sm border-b border-gray-100 sticky top-0 z-10 flex flex-col gap-5"',
  'className="bg-white px-5 pt-14 pb-6 shadow-sm border-b border-gray-100 sticky top-0 z-10 flex flex-col gap-6"'
);

// Increase gap for the filter buttons
code = code.replace(
  'className="flex flex-wrap gap-3"',
  'className="flex flex-wrap gap-4"'
);

// Increase text size of the title further
code = code.replace(
  '<h1 className="text-2xl font-bold text-gray-900">Riwayat Absensi</h1>',
  '<h1 className="text-3xl font-extrabold text-gray-900">Riwayat Absensi</h1>'
);

fs.writeFileSync('src/pages/EmployeeHistory.tsx', code);
console.log("Patched EmployeeHistory UI More");
