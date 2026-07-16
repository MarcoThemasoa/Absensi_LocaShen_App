const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminEmployees.tsx', 'utf8');

const target = `<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1 sm:mt-0">
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 py-1.5 px-3 rounded-full w-fit">
                      {!todayAtt && <span className="text-gray-500 text-xs font-medium">Belum Absen Hari Ini</span>}
                      {todayAtt?.status === 'hadir' && <><CheckCircle2 size={14} className="text-green-600" /><span className="text-green-700 text-xs font-bold">Hadir Hari Ini</span></>}
                      {todayAtt?.status === 'telat' && <><Clock size={14} className="text-yellow-600" /><span className="text-yellow-700 text-xs font-bold">Telat Hari Ini</span></>}
                      {todayAtt?.status === 'cuti' && <><Calendar size={14} className="text-blue-600" /><span className="text-blue-700 text-xs font-bold">Cuti Hari Ini</span></>}
                      {todayAtt?.status === 'alpha' && <><XCircle size={14} className="text-red-600" /><span className="text-red-700 text-xs font-bold">Absen Hari Ini</span></>}
                  </div>
                  <div className="flex sm:hidden items-center gap-1.5 text-xs font-bold">
                    <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">H: {stats.hadir}</span>
                    <span className="text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-md">T: {stats.telat}</span>
                    <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">A: {stats.alpha}</span>
                  </div>
                </div>`;

const replacement = `<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 sm:mt-0">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 py-1.5 px-3 rounded-full w-fit">
                        {!todayAtt && <span className="text-gray-500 text-xs font-medium">Belum Absen Hari Ini</span>}
                        {todayAtt?.status === 'hadir' && <><CheckCircle2 size={14} className="text-green-600" /><span className="text-green-700 text-xs font-bold">Hadir Hari Ini</span></>}
                        {todayAtt?.status === 'telat' && <><Clock size={14} className="text-yellow-600" /><span className="text-yellow-700 text-xs font-bold">Telat Hari Ini</span></>}
                        {todayAtt?.status === 'cuti' && <><Calendar size={14} className="text-blue-600" /><span className="text-blue-700 text-xs font-bold">Cuti Hari Ini</span></>}
                        {todayAtt?.status === 'alpha' && <><XCircle size={14} className="text-red-600" /><span className="text-red-700 text-xs font-bold">Absen Hari Ini</span></>}
                    </div>
                    <div className="flex sm:hidden items-center gap-1.5 text-xs font-bold mt-1">
                      <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md">H: {stats.hadir}</span>
                      <span className="text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-md">T: {stats.telat}</span>
                      <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md">A: {stats.alpha}</span>
                    </div>
                  </div>
                </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/AdminEmployees.tsx', code);
