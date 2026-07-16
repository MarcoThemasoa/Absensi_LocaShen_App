const fs = require('fs');
let code = fs.readFileSync('src/pages/EmployeeHistory.tsx', 'utf8');

code = code.replace(/  \);\n}\n}$/g, '  );\n}');
fs.writeFileSync('src/pages/EmployeeHistory.tsx', code);
