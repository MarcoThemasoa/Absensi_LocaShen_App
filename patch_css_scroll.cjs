const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

const target = `/* Elegant Scrollbar */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(15, 118, 110, 0.2);
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(15, 118, 110, 0.4);
}
.dark ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

`;

if (code.includes(target)) {
  code = code.replace(target, '');
  fs.writeFileSync('src/index.css', code);
  console.log("Patched index.css");
} else {
  console.log("Target not found in index.css");
}
