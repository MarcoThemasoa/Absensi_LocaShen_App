import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Option {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Combobox({ options, value, onChange, placeholder = "Pilih opsi...", className }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);
  
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn("relative w-full md:w-64", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-semibold bg-white border border-gray-200 rounded-xl text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg animate-in fade-in zoom-in-95 overflow-hidden">
          <div className="flex items-center px-3 py-2 border-b border-gray-50">
            <Search className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
            <input
              type="text"
              className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder:text-gray-400"
              placeholder="Cari..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center text-gray-500">
                Tidak ditemukan.
              </div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg hover:bg-teal-50/50 hover:text-teal-900 transition-colors",
                    value === opt.value ? "bg-teal-50 text-teal-900 font-semibold" : "text-gray-700"
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                  {value === opt.value && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
