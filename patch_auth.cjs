const fs = require('fs');
let code = fs.readFileSync('src/context/AuthContext.tsx', 'utf8');

code = code.replace(
  "login: (id: string, role: 'employee' | 'admin') => Promise<void>;",
  "login: (id: string, password: string, role: 'employee' | 'admin') => Promise<void>;"
);

code = code.replace(
  "const login = async (id: string, role: 'employee' | 'admin') => {",
  "const login = async (id: string, password: string, role: 'employee' | 'admin') => {"
);

code = code.replace(
  "throw new Error('Kredensial tidak valid.');",
  "throw new Error('ID atau Password tidak valid.');"
);

fs.writeFileSync('src/context/AuthContext.tsx', code);
console.log("Patched AuthContext.tsx");
