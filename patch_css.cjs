const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

const targetCSS = `::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.4);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 9999px;
  transition: all 0.2s ease-in-out;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 0.6);
  border: 1px solid transparent;
  background-clip: padding-box;
}

::-webkit-scrollbar-thumb:active {
  background: rgba(75, 85, 99, 0.8);
  border: 0px solid transparent;
  background-clip: padding-box;
}`;

const newCSS = `::-webkit-scrollbar {
  width: 14px;
  height: 14px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.5);
  border: 4px solid transparent;
  background-clip: padding-box;
  border-radius: 9999px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: rgba(107, 114, 128, 0.8);
  border: 3px solid transparent;
  background-clip: padding-box;
}

::-webkit-scrollbar-thumb:active {
  background-color: rgba(75, 85, 99, 1);
  border: 2px solid transparent;
  background-clip: padding-box;
}`;

code = code.replace(targetCSS, newCSS);
fs.writeFileSync('src/index.css', code);
