const fs = require('fs');
let code = fs.readFileSync('src/pages/EmployeeHistory.tsx', 'utf8');

const logicTarget = `    if (filter === '7') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      records = records.filter(r => new Date(r.date) >= past);
    } else if (filter === '30') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      records = records.filter(r => new Date(r.date) >= past);
    }`;

const logicReplacement = `    if (filter === '7') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      past.setHours(0, 0, 0, 0);
      records = records.filter(r => new Date(r.date).getTime() > past.getTime());
    } else if (filter === '30') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      past.setHours(0, 0, 0, 0);
      records = records.filter(r => new Date(r.date).getTime() > past.getTime());
    }`;

code = code.replace(logicTarget, logicReplacement);
fs.writeFileSync('src/pages/EmployeeHistory.tsx', code);
console.log("Patched EmployeeHistory filters");
