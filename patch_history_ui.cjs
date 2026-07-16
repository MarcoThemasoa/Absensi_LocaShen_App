const fs = require('fs');
let code = fs.readFileSync('src/pages/EmployeeHistory.tsx', 'utf8');

// Update header padding and title size
code = code.replace(
  'className="bg-white p-6 shadow-sm border-b border-gray-100 sticky top-0 z-10 flex flex-col gap-4"',
  'className="bg-white px-5 pt-5 pb-4 shadow-sm border-b border-gray-100 sticky top-0 z-10 flex flex-col gap-4"'
);

code = code.replace(
  '<h1 className="text-xl font-bold text-gray-900">Riwayat Absensi</h1>',
  '<h1 className="text-2xl font-bold text-gray-900">Riwayat Absensi</h1>'
);

// Update filter container
code = code.replace(
  'className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"',
  'className="flex flex-wrap gap-2"'
);

fs.writeFileSync('src/pages/EmployeeHistory.tsx', code);
console.log('Patched EmployeeHistory UI');
