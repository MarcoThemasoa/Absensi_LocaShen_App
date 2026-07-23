import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a time string (HH:mm:ss or HH:mm) → HH:mm (24 jam, leading zero) */
export function fmtHHmm(time: string | null | undefined): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  return `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;
}
