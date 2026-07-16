const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

const importTarget = "import { Search, Download, Calendar, Filter, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';";
const importReplacement = "import { Search, Download, Calendar, Filter, Maximize2, ChevronLeft, ChevronRight, Activity, Clock, MapPin } from 'lucide-react';\nimport { mockAdminLogs } from '../lib/mockData';";
code = code.replace(importTarget, importReplacement);

// Let's find the button group to insert the Activity button
const btnGroupTarget = `<Dialog>
          <DialogTrigger render={<button className="inline-flex items-center justify-center bg-teal-950 hover:bg-teal-900 text-white rounded-xl h-11 px-6 shadow-md transition-all w-full md:w-auto font-medium" />}>
            <Download size={20} className="mr-2" /> Ekspor CSV
          </DialogTrigger>`;

const activityLogsTable = `<Dialog>
          <DialogTrigger render={<button className="inline-flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl h-11 px-6 shadow-sm transition-all w-full md:w-auto font-medium" />}>
            <Activity size={20} className="mr-2 text-teal-600" /> Log Aktivitas
          </DialogTrigger>
          <DialogContent className="max-w-[800px] w-[calc(100vw-32px)] rounded-3xl border-gray-100 bg-white shadow-xl p-0 overflow-hidden mx-auto h-[80vh] flex flex-col">
            <DialogHeader className="p-6 pb-4 shrink-0">
              <DialogTitle className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                <Activity className="text-teal-600" size={24} /> Log Aktivitas Admin
              </DialogTitle>
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
               {/* Could add download log button here if needed */}
               <Button className="w-full bg-teal-950 hover:bg-teal-900 text-white rounded-xl h-11 font-bold" onClick={() => {
                  // Mock download logs
                  toast.success("Log Aktivitas berhasil diunduh");
               }}>Unduh CSV Log Aktivitas</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger render={<button className="inline-flex items-center justify-center bg-teal-950 hover:bg-teal-900 text-white rounded-xl h-11 px-6 shadow-md transition-all w-full md:w-auto font-medium" />}>
            <Download size={20} className="mr-2" /> Ekspor CSV
          </DialogTrigger>`;

code = code.replace(btnGroupTarget, activityLogsTable);

// Ensure the Dialog container doesn't get messed up if multiple dialogs are there. We already have 2 Dialogs. But it's okay, Radix UI Dialog is self-contained.

// Fix export dialog to be contained
code = code.replace(
  `<DialogContent className="sm:max-w-md rounded-3xl border-white/60 bg-white shadow-xl p-6">`,
  `<DialogContent className="w-[calc(100vw-32px)] max-w-md rounded-3xl border-gray-100 bg-white shadow-xl p-6 overflow-hidden mx-auto">`
);

fs.writeFileSync('src/pages/AdminReports.tsx', code);
console.log("Patched AdminReports logs and dialog container");
