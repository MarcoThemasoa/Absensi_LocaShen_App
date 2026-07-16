const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(
  "position?: string;",
  "position?: string;\n  division?: string;\n  age?: string | number;"
);

fs.writeFileSync('src/types.ts', code);
console.log("Patched types.ts");
