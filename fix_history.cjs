const fs = require('fs');
let code = fs.readFileSync('src/pages/EmployeeHistory.tsx', 'utf8');

if (code.endsWith("}\n}")) {
  code = code.slice(0, -2);
} else if (code.endsWith("}}")) {
  code = code.slice(0, -1);
}

fs.writeFileSync('src/pages/EmployeeHistory.tsx', code);
