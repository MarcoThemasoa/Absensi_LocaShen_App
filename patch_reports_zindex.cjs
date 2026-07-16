const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

code = code.replace(
  "className=\"p-5 border-b border-gray-100/50 flex flex-col xl:flex-row justify-between gap-4 bg-white/50 backdrop-blur-sm rounded-t-3xl\"",
  "className=\"p-5 border-b border-gray-100/50 flex flex-col xl:flex-row justify-between gap-4 bg-white/50 backdrop-blur-sm rounded-t-3xl relative z-20\""
);

fs.writeFileSync('src/pages/AdminReports.tsx', code);
