const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

// Update Combobox in the filter section
code = code.replace(
  `onChange={setLocationFilter}\n                  placeholder="Filter Cabang"\n                />`,
  `onChange={setLocationFilter}\n                  placeholder="Filter Cabang"\n                  className="!w-full md:!w-48"\n                />`
);

// Update Combobox in the export dialog
code = code.replace(
  `onChange={setExportLocation}\n                  placeholder="Semua Cabang"\n                />`,
  `onChange={setExportLocation}\n                  placeholder="Semua Cabang"\n                  className="!w-full"\n                />`
);

fs.writeFileSync('src/pages/AdminReports.tsx', code);
console.log("Patched AdminReports.tsx Combobox");
