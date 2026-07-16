const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

const target = `<div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Waktu (Opsional)</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="w-full min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                  <span className="text-gray-400 font-medium">-</span>
                  <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="w-full min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                </div>
              </div>`;

const replacement = `<div className="flex flex-col gap-3">
                <label className="text-sm font-bold text-gray-700">Rentang Waktu (Opsional)</label>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-gray-500 font-medium">Dari Tanggal</span>
                    <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-gray-500 font-medium">Sampai Tanggal</span>
                    <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                  </div>
                </div>
              </div>`;

code = code.replace(target, replacement);

fs.writeFileSync('src/pages/AdminReports.tsx', code);
console.log("Patched AdminReports.tsx dates");
