const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

// Update filename logic
const targetExport = "a.download = `laporan_absensi_${new Date().toISOString().split('T')[0]}.csv`;";
const replacementExport = "const filterName = exportTime === 'semua' ? 'semua' : exportTime;\n    a.download = `laporan_absensi_${filterName}_${new Date().toISOString().split('T')[0]}.csv`;";
code = code.replace(targetExport, replacementExport);

// Remove overflow-hidden from Card
code = code.replace(
  "Card className=\"rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden p-0\"",
  "Card className=\"rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-visible p-0\""
);

// Update z-index for combobox container
code = code.replace(
  "className=\"w-full md:w-56 z-10\"",
  "className=\"w-full md:w-56 relative z-50\""
);

fs.writeFileSync('src/pages/AdminReports.tsx', code);
