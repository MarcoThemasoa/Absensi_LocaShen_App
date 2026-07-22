import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside & scroll
  useEffect(() => {
    if (!open) return;
    function handleClose(e: MouseEvent) {
      const target = e.target as Node;
      const isButton = btnRef.current?.contains(target);
      const isDropdown = dropdownRef.current?.contains(target);
      if (!isButton && !isDropdown) setOpen(false);
    }
    function handleScroll() { setOpen(false); }
    // Small delay so the toggle click itself doesn't close
    const tid = setTimeout(() => document.addEventListener('mousedown', handleClose), 0);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      clearTimeout(tid);
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  const toggle = useCallback(() => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen(o => !o);
    setSearch("");
  }, [open]);

  const select = useCallback((optValue: string) => {
    onChange(optValue);
    setOpen(false);
    setSearch("");
  }, [onChange]);

  const selectedOption = options.find((opt) => opt.value === value);
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={cn("relative w-full md:w-64", className)} ref={containerRef}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="flex items-center justify-between w-full px-4 py-2 text-sm font-semibold bg-white border border-gray-200 rounded-xl text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 99999 }}
          className="bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden"
        >
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
              <div className="px-3 py-4 text-sm text-center text-gray-500">Tidak ditemukan.</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg hover:bg-teal-50/50 hover:text-teal-900 transition-colors",
                    value === opt.value ? "bg-teal-50 text-teal-900 font-semibold" : "text-gray-700"
                  )}
                  onClick={() => select(opt.value)}
                >
                  <span className="truncate">{opt.label}</span>
                  {value === opt.value && <Check className="w-4 h-4 text-teal-600 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
