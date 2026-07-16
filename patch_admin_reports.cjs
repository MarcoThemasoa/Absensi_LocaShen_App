const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

code = code.replace(
  '<Table className="w-full">',
  '<Table className="w-full min-w-[800px]">'
);

fs.writeFileSync('src/pages/AdminReports.tsx', code);
console.log("Patched AdminReports.tsx");
