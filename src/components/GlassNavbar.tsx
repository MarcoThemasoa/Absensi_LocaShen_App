import { Link, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

export interface GlassNavbarItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

interface GlassNavbarProps {
  leftItems: GlassNavbarItem[];
  centerItem?: GlassNavbarItem;
  rightItems: GlassNavbarItem[];
}

export function GlassNavbar({ leftItems, centerItem, rightItems }: GlassNavbarProps) {
  const location = useLocation();
  const activePath = location.pathname;

  const renderButton = (item: GlassNavbarItem, isCenter = false) => {
    const isActive = activePath === item.path;
    const Icon = item.icon;

    return (
      <Link key={item.path} to={item.path} className="relative flex flex-col items-center justify-center">
        {isActive && (
          <motion.span
            layoutId="glass-navbar-active"
            className={`absolute rounded-full bg-white/30 ring-1 ring-white/40 shadow-[0_20px_120px_-50px_rgba(255,255,255,0.35)] backdrop-blur-xl ${
              isCenter
                ? 'opacity-0'
                : 'w-16 h-16 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 c'
            }`}
          />
        )}
        <div
          className={`relative z-10 flex items-center justify-center transition-all duration-200 ease-out ${
            isCenter
              ? 'w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-emerald-500 via-emerald-600 to-lime-500 border border-white/20 shadow-2xl shadow-emerald-600/30 text-slate-950'
              : 'w-16 h-14 flex-col gap-1 text-slate-950/95 hover:text-slate-950'
          } ${isActive ? 'scale-105' : 'scale-100'}`}
        >
          <Icon size={isCenter ? 24 : 20} strokeWidth={isActive ? 2.5 : 2} color={isCenter ? 'white' : undefined} />
          {!isCenter && <span className="text-[10px] font-semibold tracking-wide text-center w-full">{item.name}</span>}
        </div>
        {isCenter && <span className="mt-2 text-[10px] font-bold text-slate-950 tracking-wide">{item.name}</span>}
      </Link>
    );
  };

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 md:hidden pointer-events-none">
      <div className="relative w-full max-w-[720px] pointer-events-auto rounded-full border border-white/20 bg-white/10 px-4 py-3 shadow-[0_30px_80px_-35px_rgba(15,23,42,0.45)] backdrop-blur-3xl">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/20 via-white/10 to-white/15 opacity-90" />
        <div className="absolute inset-0 rounded-full border border-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 px-1">{leftItems.map((item) => renderButton(item))}</div>
          {centerItem && <div className="flex items-center justify-center px-1">{renderButton(centerItem, true)}</div>}
          <div className="flex items-center gap-2 px-1">{rightItems.map((item) => renderButton(item))}</div>
        </div>
      </div>
    </div>
  );
}
