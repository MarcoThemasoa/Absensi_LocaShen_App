const fs = require('fs');
let code = fs.readFileSync('src/pages/EmployeeHistory.tsx', 'utf8');

// Update header padding and title size
code = code.replace(
  'className="bg-white px-5 pt-5 pb-4 shadow-sm border-b border-gray-100 sticky top-0 z-10 flex flex-col gap-4"',
  'className="bg-white px-5 pt-10 pb-5 shadow-sm border-b border-gray-100 sticky top-0 z-10 flex flex-col gap-5"'
);

// Update filter container gap
code = code.replace(
  'className="flex flex-wrap gap-2"',
  'className="flex flex-wrap gap-3"'
);

// Update button padding to be a bit larger maybe?
code = code.replace(/px-4 py-2/g, 'px-5 py-2.5');

fs.writeFileSync('src/pages/EmployeeHistory.tsx', code);
console.log('Patched EmployeeHistory UI 2');
