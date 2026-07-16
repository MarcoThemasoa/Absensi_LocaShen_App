const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const target = `import './index.css';`;
const replacement = `import './index.css';

// Filter out harmless Mediapipe WASM logs that are incorrectly output to console.error
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('INFO: Created TensorFlow Lite XNNPACK delegate')) {
    // Redirect to console.log or ignore
    console.log(...args);
    return;
  }
  originalConsoleError(...args);
};`;

code = code.replace(target, replacement);
fs.writeFileSync('src/main.tsx', code);
