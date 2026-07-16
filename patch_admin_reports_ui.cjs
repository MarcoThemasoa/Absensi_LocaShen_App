const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

const exportDialogTarget = `<DialogContent className="sm:max-w-md rounded-3xl border-white/60 bg-white/90 backdrop-blur-2xl shadow-[0_20px_60px_rgb(0,0,0,0.1)] p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">Ekspor Laporan</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label className="text-sm font-bold text-gray-700">Pilih Cabang (Opsional)</label>
                <Combobox
                  options={[{ label: 'Semua Cabang', value: '' }, ...mockLocations.map(l => ({ label: l.name, value: l.id }))]}
                  value={exportLocation}
                  onChange={setExportLocation}
                  placeholder="Semua Cabang"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-bold text-gray-700">Waktu (Opsional)</label>
                <div className="flex gap-2 items-center">
                  <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  <span className="text-gray-500">-</span>
                  <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleExportCSV} className="w-full bg-teal-950 hover:bg-teal-900 text-white rounded-xl h-11 font-bold">Unduh CSV</Button>
            </DialogFooter>
          </DialogContent>`;

const exportDialogReplacement = `<DialogContent className="sm:max-w-md rounded-3xl border-white/60 bg-white shadow-xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">Ekspor Laporan</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-5 py-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Pilih Cabang (Opsional)</label>
                <Combobox
                  options={[{ label: 'Semua Cabang', value: '' }, ...mockLocations.map(l => ({ label: l.name, value: l.id }))]}
                  value={exportLocation}
                  onChange={setExportLocation}
                  placeholder="Semua Cabang"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Waktu (Opsional)</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="w-full min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                  <span className="text-gray-400 font-medium">-</span>
                  <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="w-full min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
                </div>
              </div>
            </div>
            <Button onClick={handleExportCSV} className="w-full bg-teal-950 hover:bg-teal-900 text-white rounded-xl h-12 font-bold mt-2">Unduh CSV</Button>
          </DialogContent>`;

code = code.replace(exportDialogTarget, exportDialogReplacement);

const paginationTarget = `<div className="p-4 border-t border-gray-100/50 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/30">
              <p className="text-sm text-gray-500 font-medium">
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredReports.length)} dari {filteredReports.length} data
              </p>
              <div className="flex items-center gap-2">`;

const paginationReplacement = `<div className="p-4 border-t border-gray-100/50 flex items-center justify-between gap-4 bg-gray-50/30">
              <p className="text-sm text-gray-500 font-medium hidden sm:block">
                Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredReports.length)} dari {filteredReports.length} data
              </p>
              <p className="text-sm text-gray-500 font-medium sm:hidden">
                {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredReports.length)} dari {filteredReports.length}
              </p>
              <div className="flex items-center gap-1 sm:gap-2">`;

code = code.replace(paginationTarget, paginationReplacement);

fs.writeFileSync('src/pages/AdminReports.tsx', code);
console.log("Patched AdminReports.tsx UI");
