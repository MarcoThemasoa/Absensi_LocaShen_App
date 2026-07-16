const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminEmployees.tsx', 'utf8');

const target = `<div className="text-sm font-medium text-gray-500 mt-0.5">
                        {user.position || 'Karyawan'} • ID: {user.id}
                      </div>`;
const replacement = `<div className="text-sm font-medium text-gray-500 mt-0.5">
                        Divisi: {user.division || '-'} • Usia: {user.age || '-'}
                      </div>`;

code = code.replace(target, replacement);

fs.writeFileSync('src/pages/AdminEmployees.tsx', code);
console.log("Patched AdminEmployees.tsx UI");
