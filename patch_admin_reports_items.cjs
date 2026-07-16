const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

code = code.replace("const itemsPerPage = 5;", "const itemsPerPage = 10;");

fs.writeFileSync('src/pages/AdminReports.tsx', code);
console.log("Patched AdminReports items per page");
