const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

const filterTarget = `      // Time filter
      const reportDate = startOfDay(parseISO(report.date));
      const today = startOfDay(new Date());
      
      if (timeFilter === '1hari') {
        if (!isAfter(reportDate, subDays(today, 1))) return false;
      } else if (timeFilter === '7hari') {
        if (!isAfter(reportDate, subDays(today, 7))) return false;
      } else if (timeFilter === '1bulan') {
        if (!isAfter(reportDate, subMonths(today, 1))) return false;
      }`;

const filterReplacement = `      // Time filter
      const reportDate = startOfDay(parseISO(report.date));
      const today = startOfDay(new Date());
      
      if (timeFilter === '1hari') {
        if (!isAfter(reportDate, subDays(today, 1))) return false;
      } else if (timeFilter === '7hari') {
        if (!isAfter(reportDate, subDays(today, 6))) return false;
      } else if (timeFilter === '1bulan') {
        if (!isAfter(reportDate, subDays(today, 29))) return false;
      }`;

code = code.replace(filterTarget, filterReplacement);

const tableTarget = `<div className="overflow-x-auto px-4 md:px-6 py-0 min-h-[400px] rounded-b-3xl relative z-10">`;
const tableReplacement = `<div className="overflow-x-auto px-4 md:px-6 py-0 rounded-b-3xl relative z-10">`;
code = code.replace(tableTarget, tableReplacement);

const paginationTarget = `<div className="p-4 border-t border-gray-100/50 flex items-center justify-between bg-gray-50/30">
              <p className="text-sm text-gray-500 font-medium">
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredReports.length)} dari {filteredReports.length} data
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl w-9 h-9 border-gray-200"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </Button>
                <div className="text-sm font-bold text-gray-700 px-2">
                  {currentPage} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl w-9 h-9 border-gray-200"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>`;

const paginationReplacement = `<div className="p-4 border-t border-gray-100/50 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/30">
              <p className="text-sm text-gray-500 font-medium">
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredReports.length)} dari {filteredReports.length} data
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl w-9 h-9 border-gray-200"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </Button>
                <div className="text-sm font-bold text-gray-700 px-2 flex items-center whitespace-nowrap">
                  {currentPage} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-xl w-9 h-9 border-gray-200"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>`;

code = code.replace(paginationTarget, paginationReplacement);

const exportStateTarget = `  const [exportLocation, setExportLocation] = useState<string>('');
  const [exportTime, setExportTime] = useState<'1hari' | '7hari' | '1bulan' | 'semua'>('semua');`;
const exportStateReplacement = `  const [exportLocation, setExportLocation] = useState<string>('');
  const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');`;
code = code.replace(exportStateTarget, exportStateReplacement);

const exportDialogTarget = `<div className="grid gap-2">
                <label className="text-sm font-bold text-gray-700">Waktu</label>
                <div className="flex flex-wrap gap-2">
                  <Button variant={exportTime === '1hari' ? 'default' : 'outline'} className={exportTime === '1hari' ? 'bg-teal-950 text-white' : ''} size="sm" onClick={() => setExportTime('1hari')}>1 Hari</Button>
                  <Button variant={exportTime === '7hari' ? 'default' : 'outline'} className={exportTime === '7hari' ? 'bg-teal-950 text-white' : ''} size="sm" onClick={() => setExportTime('7hari')}>7 Hari</Button>
                  <Button variant={exportTime === '1bulan' ? 'default' : 'outline'} className={exportTime === '1bulan' ? 'bg-teal-950 text-white' : ''} size="sm" onClick={() => setExportTime('1bulan')}>1 Bulan</Button>
                  <Button variant={exportTime === 'semua' ? 'default' : 'outline'} className={exportTime === 'semua' ? 'bg-teal-950 text-white' : ''} size="sm" onClick={() => setExportTime('semua')}>Semua</Button>
                </div>
              </div>`;

const exportDialogReplacement = `<div className="grid gap-2">
                <label className="text-sm font-bold text-gray-700">Waktu (Opsional)</label>
                <div className="flex gap-2 items-center">
                  <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  <span className="text-gray-500">-</span>
                  <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>`;
code = code.replace(exportDialogTarget, exportDialogReplacement);

fs.writeFileSync('src/pages/AdminReports.tsx', code);
console.log("Patched AdminReports.tsx complete");
