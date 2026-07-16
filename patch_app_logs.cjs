const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace("import AdminLogs from './pages/AdminLogs';\n", "");
code = code.replace(`          <Route path="/admin/logs" element={<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-full"><AdminLogs /></motion.div>} />\n`, "");

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx for AdminLogs");
