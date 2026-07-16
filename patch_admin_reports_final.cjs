const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

// 1. Add new state for Log Aktivitas
const stateTarget = `const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');`;

const stateReplacement = `const [exportStartDate, setExportStartDate] = useState<string>('');
  const [exportEndDate, setExportEndDate] = useState<string>('');

  // Log Aktivitas State
  const [logTimeFilter, setLogTimeFilter] = useState<'1hari' | '7hari' | '1bulan' | 'semua'>('semua');
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const logsPerPage = 15;

  const filteredLogs = useMemo(() => {
    const today = startOfDay(new Date());
    return mockAdminLogs.filter(log => {
      const logDate = startOfDay(parseISO(log.timestamp));
      if (logTimeFilter === '1hari') {
        if (!isAfter(logDate, subDays(today, 1))) return false;
      } else if (logTimeFilter === '7hari') {
        if (!isAfter(logDate, subDays(today, 6))) return false;
      } else if (logTimeFilter === '1bulan') {
        if (!isAfter(logDate, subDays(today, 29))) return false;
      }
      return true;
    });
  }, [logTimeFilter]);

  useMemo(() => {
    setLogCurrentPage(1);
  }, [logTimeFilter]);

  const logTotalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const paginatedLogs = filteredLogs.slice(
    (logCurrentPage - 1) * logsPerPage,
    logCurrentPage * logsPerPage
  );`;
code = code.replace(stateTarget, stateReplacement);

// 2. Fix Top Buttons (DialogTrigger asChild)
const btnGroupTarget = `<div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Dialog>
            <DialogTrigger render={<button className="inline-flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl h-11 px-6 shadow-sm transition-all w-full md:w-auto font-medium" />}>
              <Activity size={20} className="mr-2 text-teal-600" /> Log Aktivitas
            </DialogTrigger>`;

const btnGroupReplacement = `<div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl h-11 px-6 shadow-sm border-gray-200 hover:bg-gray-50 text-gray-700 font-medium w-full md:w-auto">
                <Activity size={20} className="mr-2 text-teal-600" /> Log Aktivitas
              </Button>
            </DialogTrigger>`;
code = code.replace(btnGroupTarget, btnGroupReplacement);

const exportBtnTarget = `<Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger render={<button className="inline-flex items-center justify-center bg-teal-950 hover:bg-teal-900 text-white rounded-xl h-11 px-6 shadow-md transition-all w-full md:w-auto font-medium" />}>
              <Download size={20} className="mr-2" /> Ekspor CSV
            </DialogTrigger>`;
const exportBtnReplacement = `<Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl h-11 px-6 shadow-md bg-teal-950 hover:bg-teal-900 text-white font-medium w-full md:w-auto">
                <Download size={20} className="mr-2" /> Ekspor CSV
              </Button>
            </DialogTrigger>`;
code = code.replace(exportBtnTarget, exportBtnReplacement);

// 3. Fix Log Aktivitas Content (Filters and Pagination)
const logContentTarget = `<DialogHeader className="p-6 pb-4 shrink-0">
                <DialogTitle className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                  <Activity className="text-teal-600" size={24} /> Log Aktivitas Admin
                </DialogTitle>
              </DialogHeader>
              <div className="overflow-y-auto flex-1 px-1">
                <Table className="w-full min-w-[500px]">
                  <TableHeader className="bg-gray-50/50 sticky top-0 z-10">
                    <TableRow className="border-b border-gray-100/50 hover:bg-transparent">
                      <TableHead className="font-bold text-gray-900 h-10 w-40 pl-6">Waktu</TableHead>
                      <TableHead className="font-bold text-gray-900">Tindakan</TableHead>
                      <TableHead className="font-bold text-gray-900 pr-6">Lokasi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockAdminLogs.map((log) => (
                      <TableRow key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <TableCell className="font-medium text-gray-600 text-xs pl-6">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-teal-600 shrink-0" />
                            <span className="whitespace-nowrap">{format(parseISO(log.timestamp), 'dd MMM yy HH:mm', { locale: id })}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-gray-900 text-sm">{log.action}</TableCell>
                        <TableCell className="font-medium text-gray-600 pr-6">
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1 text-teal-700 text-[10px] font-bold bg-teal-50 w-fit px-1.5 py-0.5 rounded mb-0.5 whitespace-nowrap">
                              <MapPin size={10} /> {log.locationName}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="p-4 shrink-0 border-t border-gray-100">
                <Button className="w-full bg-teal-950 hover:bg-teal-900 text-white rounded-xl h-11 font-bold" onClick={() => {
                   // In a real app we would download here
                   alert('Mendownload Log Aktivitas...');
                }}>
                  <Download size={18} className="mr-2" /> Unduh CSV Log Aktivitas
                </Button>
              </div>`;

const logContentReplacement = `<DialogHeader className="p-6 pb-2 shrink-0 border-b border-gray-100/50">
                <DialogTitle className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                  <Activity className="text-teal-600" size={24} /> Log Aktivitas Admin
                </DialogTitle>
                <div className="flex flex-wrap gap-2 items-center mt-4 pt-2">
                  <Button variant={logTimeFilter === '1hari' ? 'default' : 'outline'} className={logTimeFilter === '1hari' ? 'bg-teal-950 text-white rounded-xl' : 'rounded-xl'} size="sm" onClick={() => setLogTimeFilter('1hari')}>1 Hari</Button>
                  <Button variant={logTimeFilter === '7hari' ? 'default' : 'outline'} className={logTimeFilter === '7hari' ? 'bg-teal-950 text-white rounded-xl' : 'rounded-xl'} size="sm" onClick={() => setLogTimeFilter('7hari')}>7 Hari</Button>
                  <Button variant={logTimeFilter === '1bulan' ? 'default' : 'outline'} className={logTimeFilter === '1bulan' ? 'bg-teal-950 text-white rounded-xl' : 'rounded-xl'} size="sm" onClick={() => setLogTimeFilter('1bulan')}>1 Bulan</Button>
                  <Button variant={logTimeFilter === 'semua' ? 'default' : 'outline'} className={logTimeFilter === 'semua' ? 'bg-teal-950 text-white rounded-xl' : 'rounded-xl'} size="sm" onClick={() => setLogTimeFilter('semua')}>Semua</Button>
                </div>
              </DialogHeader>
              <div className="overflow-y-auto flex-1">
                <Table className="w-full min-w-[500px]">
                  <TableHeader className="bg-gray-50/50 sticky top-0 z-10">
                    <TableRow className="border-b border-gray-100/50 hover:bg-transparent">
                      <TableHead className="font-bold text-gray-900 h-10 w-40 pl-6">Waktu</TableHead>
                      <TableHead className="font-bold text-gray-900">Tindakan</TableHead>
                      <TableHead className="font-bold text-gray-900 pr-6">Lokasi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.length > 0 ? paginatedLogs.map((log) => (
                      <TableRow key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <TableCell className="font-medium text-gray-600 text-xs pl-6">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-teal-600 shrink-0" />
                            <span className="whitespace-nowrap">{format(parseISO(log.timestamp), 'dd MMM yy HH:mm', { locale: id })}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-gray-900 text-sm">{log.action}</TableCell>
                        <TableCell className="font-medium text-gray-600 pr-6">
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1 text-teal-700 text-[10px] font-bold bg-teal-50 w-fit px-1.5 py-0.5 rounded mb-0.5 whitespace-nowrap">
                              <MapPin size={10} /> {log.locationName}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center text-gray-500 font-medium">
                          Tidak ada log aktivitas yang sesuai dengan filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Controls for Logs */}
              {logTotalPages > 1 && (
                <div className="p-3 border-t border-gray-100/50 flex items-center justify-between gap-4 bg-gray-50/30 shrink-0">
                  <p className="text-xs text-gray-500 font-medium hidden sm:block">
                    Menampilkan {(logCurrentPage - 1) * logsPerPage + 1} - {Math.min(logCurrentPage * logsPerPage, filteredLogs.length)} dari {filteredLogs.length} data
                  </p>
                  <p className="text-xs text-gray-500 font-medium sm:hidden">
                    {(logCurrentPage - 1) * logsPerPage + 1}-{Math.min(logCurrentPage * logsPerPage, filteredLogs.length)} dari {filteredLogs.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-lg w-8 h-8 border-gray-200"
                      onClick={() => setLogCurrentPage(p => Math.max(1, p - 1))}
                      disabled={logCurrentPage === 1}
                    >
                      <ChevronLeft size={14} />
                    </Button>
                    <div className="text-xs font-bold text-gray-700 px-2 flex items-center whitespace-nowrap">
                      {logCurrentPage} / {logTotalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-lg w-8 h-8 border-gray-200"
                      onClick={() => setLogCurrentPage(p => Math.min(logTotalPages, p + 1))}
                      disabled={logCurrentPage === logTotalPages}
                    >
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="p-4 shrink-0 border-t border-gray-100">
                <Button className="w-full bg-teal-950 hover:bg-teal-900 text-white rounded-xl h-11 font-bold" onClick={() => {
                   const headers = ['ID,Waktu,Tindakan,Lokasi'];
                   const csvData = filteredLogs.map(l => \`\${l.id},\${l.timestamp},"\${l.action}","\${l.locationName}"\`);
                   const csvString = headers.concat(csvData).join('\\n');
                   const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                   const url = URL.createObjectURL(blob);
                   const a = document.createElement('a');
                   a.href = url;
                   const dateStr = format(new Date(), 'dd-MMM-yyyy', { locale: id });
                   a.download = \`Log_Aktivitas_\${dateStr}.csv\`;
                   document.body.appendChild(a);
                   a.click();
                   document.body.removeChild(a);
                   URL.revokeObjectURL(url);
                }}>
                  <Download size={18} className="mr-2" /> Unduh CSV Log Aktivitas
                </Button>
              </div>`;

code = code.replace(logContentTarget, logContentReplacement);

// 4. Fix Photo DialogTrigger
const photoTarget = `<DialogTrigger render={<button className="relative w-12 h-12 rounded-xl overflow-hidden cursor-pointer group shadow-sm border border-gray-200" />}>
                            <img src={report.photoUrl} alt="Bukti" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                              <Maximize2 size={18} className="text-white" />
                            </div>
                          </DialogTrigger>`;

const photoReplacement = `<DialogTrigger asChild>
                            <button className="relative w-12 h-12 rounded-xl overflow-hidden cursor-pointer group shadow-sm border border-gray-200">
                              <img src={report.photoUrl} alt="Bukti" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                                <Maximize2 size={18} className="text-white" />
                              </div>
                            </button>
                          </DialogTrigger>`;

code = code.replace(photoTarget, photoReplacement);

fs.writeFileSync('src/pages/AdminReports.tsx', code);
console.log("Patched AdminReports.tsx successfully.");
