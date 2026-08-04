import { motion, AnimatePresence } from 'motion/react';
import { Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { useModelLoading, describeModel } from '../lib/modelLoading';

/**
 * Indikator global saat model wajah (MediaPipe / face-api) sedang di-download.
 * Muncul di semua halaman sebagai notifikasi kecil mengambang di atas (top
 * center) — termasuk sebelum user membuka halaman kamera (preload terjadi
 * sejak app mount di AuthContext).
 *
 * Style: minimalis, rounded (pill), opacity TIDAK 100% (semi-transparan +
 * backdrop blur) agar tidak menghalangi konten.
 *
 * Progress indeterminate (animasi spinner) karena library tidak expose
 * persentase download. Otomatis hilang saat semua model siap, dan bisa ditutup
 * manual (dismissible) — diingat per sesi.
 */
export function ModelLoadingIndicator() {
  const snapshot = useModelLoading();
  const [dismissed, setDismissed] = useState(false);

  const isLoading =
    snapshot.landmarker.state === 'loading' ||
    snapshot.faceApi.state === 'loading';

  const hasError =
    snapshot.landmarker.state === 'error' ||
    snapshot.faceApi.state === 'error';

  const label = describeModel(snapshot);

  if (!isLoading || dismissed || !label) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -12, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
      >
        <div
          className={`pointer-events-auto flex items-center gap-2.5 rounded-full border px-4 py-2 text-xs shadow-lg backdrop-blur-md ${
            hasError
              ? 'bg-amber-600/80 border-amber-400/30 text-white'
              : 'bg-teal-950/80 border-white/10 text-teal-50'
          }`}
        >
          <Loader2 size={14} className="shrink-0 animate-spin" />
          <span className="font-medium whitespace-nowrap">{label}</span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 -mr-1 p-0.5 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Tutup indikator"
          >
            <X size={13} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
