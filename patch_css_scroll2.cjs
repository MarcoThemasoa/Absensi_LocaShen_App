const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

// find index of /* Elegant Scrollbar */
const idx1 = code.indexOf('/* Elegant Scrollbar */');
const idx2 = code.indexOf('/* Custom Scrollbar Logic */');

if (idx1 !== -1 && idx2 !== -1) {
  code = code.substring(0, idx1) + code.substring(idx2);
  fs.writeFileSync('src/index.css', code);
  console.log("Patched index.css successfully");
} else {
  console.log("Indexes not found");
}
