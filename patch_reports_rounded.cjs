const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

// Ensure the top div has rounded-t-3xl
code = code.replace(
  "className=\"p-5 border-b border-gray-100/50 flex flex-col xl:flex-row justify-between gap-4 bg-white/50 backdrop-blur-sm\"",
  "className=\"p-5 border-b border-gray-100/50 flex flex-col xl:flex-row justify-between gap-4 bg-white/50 backdrop-blur-sm rounded-t-3xl\""
);

// Ensure the table area div has rounded-b-3xl
code = code.replace(
  "className=\"overflow-x-auto px-4 md:px-6 py-0 min-h-[400px]\"",
  "className=\"overflow-x-auto px-4 md:px-6 py-0 min-h-[400px] rounded-b-3xl\""
);

fs.writeFileSync('src/pages/AdminReports.tsx', code);
