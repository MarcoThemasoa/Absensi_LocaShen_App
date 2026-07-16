const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `    <AnimatePresence mode="wait">
      {/* @ts-expect-error - key is a valid react prop */}
      <Routes location={location} key={location.pathname}>`;
const replacement = `    <AnimatePresence mode="wait" initial={false}>
      {/* @ts-expect-error - key is a valid react prop */}
      <Routes location={location} key={location.pathname.split('/')[1] === 'admin' && !location.pathname.includes('login') ? 'admin' : (location.pathname.includes('/auth') ? location.pathname : 'employee')}>`;

code = code.replace(target, replacement);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx route keys");
