import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, History, UserCircle, CheckCircle2, AlertCircle, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { mockAttendance } from '../lib/mockData';
import { useAuth } from '../context/AuthContext';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '../lib/utils';

export default function EmployeeHistory() {
  const { user } = useAuth();
  
  const [filter, setFilter] = useState<'7' | '30' | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const filteredRecords = useMemo(() => {
    let records = mockAttendance.filter(r => r.userId === user?.id);
    records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (filter === '7') {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      past.setHours(0, 0, 0, 0);
      records = records.filter(r => new Date(r.date).getTime() > past.getTime());
    } else if (filter === '30') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      past.setHours(0, 0, 0, 0);
      records = records.filter(r => new Date(r.date).getTime() > past.getTime());
    }
    
    return records;
  }, [user?.id, filter]);
  
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / itemsPerPage));
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleFilterChange = (newFilter: '7' | '30' | 'all') => {
    setFilter(newFilter);
    setCurrentPage(1);
  };


    return (
    <div className="flex flex-col min-h-full bg-gray-50 pb-32">
      <div className="bg-white px-5 pt-14 pb-6 shadow-sm border-b border-gray-100 sticky top-0 z-10 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">Riwayat Absensi</h1>
          <p className="text-gray-500 text-sm">Lihat aktivitas absensi Anda</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => handleFilterChange('7')}
            className={cn("px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors", filter === '7' ? 'bg-teal-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            7 Hari Terakhir
          </button>
          <button 
            onClick={() => handleFilterChange('30')}
            className={cn("px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors", filter === '30' ? 'bg-teal-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            30 Hari Terakhir
          </button>
          <button 
            onClick={() => handleFilterChange('all')}
            className={cn("px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors", filter === 'all' ? 'bg-teal-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            Semua
          </button>
        </div>
      </div>
      
      <div className="p-4 space-y-3">
        {paginatedRecords.length > 0 ? paginatedRecords.map((record) => (
          <div key={record.id} className="bg-white p-4 rounded-2xl drop-shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                record.status === 'hadir' ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
              )}>
                {record.status === 'hadir' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
              </div>
              <div>
                <p className="font-bold text-gray-900">{format(parseISO(record.date), 'dd MMM yyyy', { locale: id })}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  <span className="flex items-center gap-1 font-medium"><Clock size={14} className="text-teal-600" /> {record.timeIn}</span>
                  {record.timeOut && <span className="flex items-center gap-1 font-medium">— {record.timeOut}</span>}
                </div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className={cn(
                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider",
                record.status === 'hadir' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                {record.status}
              </span>
            </div>
          </div>
        )) : (
          <div className="text-center py-10">
            <p className="text-gray-500">Tidak ada riwayat absensi ditemukan.</p>
          </div>
        )}
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 px-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-full bg-white shadow-sm border border-gray-200 disabled:opacity-50 text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-bold text-gray-600">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-full bg-white shadow-sm border border-gray-200 disabled:opacity-50 text-gray-700 hover:bg-gray-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
