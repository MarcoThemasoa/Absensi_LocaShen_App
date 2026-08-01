import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import {
  ArrowLeft,
  CheckCircle2,
  ScanFace,
  Loader2,
  Camera,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ArrowLeft as ArrowLeftIcon,
  ArrowUp,
  ArrowDown,
  Eye,
  Check,
} from 'lucide-react';
import {
  getFaceLandmarker,
  isFaceLandmarkerReady,
  estimateHeadPose,
  isBlinking,
  POSE_YAW_THRESHOLD,
  POSE_PITCH_THRESHOLD,
  getDetectionIntervalMs,
  isLowEndDevice,
} from '../lib/faceLandmarker';
import {
  initFaceApi,
  extractFaceDescriptor,
  averageDescriptors,
  isFaceApiReady,
  captureFaceSnapshot,
} from '../lib/faceApi';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { useAuth } from '../context/AuthContext';
import { saveFaceDescriptor, getFaceEnrollmentInfo, canReEnroll } from '../lib/faceMatcher';
import { toast } from 'sonner';

// ── Guided pose sequence ──
type PoseId = 'right' | 'left' | 'up' | 'down' | 'blink';

/** Pose harus DITAHAN selama ini sebelum di-capture (ms) —
 *  mencegah 1 frame noise/kedutan langsung dianggap valid.
 *  Kedip (holdMs: 0) dikecualikan karena mata menutup hanya ~100-300ms. */
const POSE_HOLD_MS = 800;

// Ambang "wajah cukup frontal" — HANYA frame dalam rentang ini yang boleh
// masuk buffer template. Pose ekstrem tetap di-capture untuk liveness,
// tapi tidak boleh mencemari template wajah (lihat komentar frontalBuffer).
const FRONTAL_YAW_MAX = 0.35;
const FRONTAL_PITCH_MAX = 0.30;
const FRONTAL_BUFFER_MAX = 30;

interface PoseDef {
  id: PoseId;
  icon: typeof ArrowRight;
  instruction: string;
  hint: string;
  /** Lama pose harus ditahan (ms) sebelum di-capture. 0 = instan (kedip). */
  holdMs: number;
  check: (pose: ReturnType<typeof estimateHeadPose>, blendshapes: { categoryName: string; score: number }[]) => boolean;
}

const POSE_SEQUENCE: PoseDef[] = [
  {
    id: 'right',
    icon: ArrowRight,
    instruction: 'Tengok ke Kanan',
    hint: 'Hadapkan wajah perlahan ke arah kanan Anda',
    holdMs: POSE_HOLD_MS,
    check: (pose) => pose.yaw > POSE_YAW_THRESHOLD,
  },
  {
    id: 'left',
    icon: ArrowLeftIcon,
    instruction: 'Tengok ke Kiri',
    hint: 'Hadapkan wajah perlahan ke arah kiri Anda',
    holdMs: POSE_HOLD_MS,
    check: (pose) => pose.yaw < -POSE_YAW_THRESHOLD,
  },
  {
    id: 'up',
    icon: ArrowUp,
    instruction: 'Lihat ke Atas',
    hint: 'Angkat wajah Anda perlahan ke atas (mendongak)',
    holdMs: POSE_HOLD_MS,
    check: (pose) => pose.pitch > POSE_PITCH_THRESHOLD,
  },
  {
    id: 'down',
    icon: ArrowDown,
    instruction: 'Tengok ke Bawah',
    hint: 'Turunkan wajah Anda perlahan ke bawah (menunduk)',
    holdMs: POSE_HOLD_MS,
    check: (pose) => pose.pitch < -POSE_PITCH_THRESHOLD,
  },
  {
    id: 'blink',
    icon: Eye,
    instruction: 'Kedipkan Mata',
    hint: 'Kedipkan kedua mata Anda untuk verifikasi',
    holdMs: 0, // kedip instan — tidak perlu ditahan (mata menutup hanya ~100-300ms)
    check: (_pose, blendshapes) => isBlinking(blendshapes),
  },
];

type EnrollStep = 'prepare' | 'capturing' | 'success' | 'error';

export default function FaceEnrollment() {
  const { user, refreshFaceStatus } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') === 'update' ? 'update' : 'enroll';

  const webcamRef = useRef<Webcam>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastVideoTime = useRef<number>(-1);
  const lastDetectionTime = useRef<number>(0);
  const capturedFrames = useRef<HTMLCanvasElement[]>([]);
  // Buffer SNAPSHOT HANYA frame frontal — dipakai untuk template wajah.
  // Frame pose ekstrem (tengok kanan/kiri/atas/bawah) TIDAK boleh masuk template:
  // rata-rata pose-posa yang sangat berbeda menciptakan "wajah generik" yang
  // kebetulan cocok dengan siapa pun (skor hijau palsu). Lihat handleSave.
  //
  // Snapshot disimpan sebagai canvas crop wajah (bukan descriptor) karena
  // extraction face-api bersifat async + berat — extraction dilakukan sekali
  // di handleSave, bukan per-frame di dalam RAF loop.
  const frontalBuffer = useRef<HTMLCanvasElement[]>([]);
  // Guard: cegah dua extraction face-api berjalan bersamaan.
  const isExtractingRef = useRef(false);
  const poseCapturedRef = useRef<Set<PoseId>>(new Set());
  const currentPoseIdxRef = useRef<number>(0);
  const stepRef = useRef<EnrollStep>('prepare');
  const detectionLogicRef = useRef<() => void>(undefined);
  const meshCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Pose harus DITAHAN selama ini sebelum di-capture (ms) —
  // mencegah 1 frame noise/kedutan langsung dianggap valid.
  const poseHoldStartRef = useRef(0);

  /**
   * Cek apakah SELURUH wajah terbaca (tidak terpotong tepi bingkai).
   * Kalau wajah terlalu dekat/terlalu besar, bagian kepala (dahi/dagu)
   * terpotong → data wajah tidak lengkap. Margin dihitung dari ukuran
   * landmark wajah (bukan posisi di video) biar konsisten di jarak mana pun.
   */
  const isFaceFullyVisible = (
    landmarks: { x: number; y: number }[]
  ): boolean => {
    if (!landmarks || landmarks.length === 0) return false;
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const lm of landmarks) {
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
    }
    // Margin minimal dari tepi video (normalized 0–1).
    // Bisa disesuaikan: makin besar → makin jauh dari tepi yang diminta.
    const MARGIN = 0.05;
    return minX >= MARGIN && maxX <= 1 - MARGIN && minY >= MARGIN && maxY <= 1 - MARGIN;
  };

  const [isModelLoading, setIsModelLoading] = useState(!isFaceLandmarkerReady());
  const [step, setStep] = useState<EnrollStep>('prepare');
  const [faceDetected, setFaceDetected] = useState(false);
  const [facePartiallyVisible, setFacePartiallyVisible] = useState(false);
  const [currentPoseIdx, setCurrentPoseIdx] = useState(0);
  const [capturedPoses, setCapturedPoses] = useState<Set<PoseId>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const currentPose = POSE_SEQUENCE[currentPoseIdx];
  const allCaptured = capturedPoses.size >= POSE_SEQUENCE.length;

  // Cek cooldown — hanya untuk info, tidak blocking (warning dihapus sesuai permintaan)
  useEffect(() => {
    if (mode === 'update' && user?.id) {
      getFaceEnrollmentInfo(user.id)
        .then((info) => {
          if (info.updatedAt) {
            const status = canReEnroll(info.updatedAt);
            if (!status.allowed) {
              console.info(`[FaceEnrollment] Cooldown: ${status.daysLeft} hari sejak update terakhir.`);
            }
          }
        })
        .catch(console.error);
    }
  }, [mode, user?.id]);

  // Inisialisasi FaceLandmarker
  useEffect(() => {
    getFaceLandmarker()
      .then((landmarker) => {
        faceLandmarkerRef.current = landmarker;
        setIsModelLoading(false);
      })
      .catch((err) => {
        console.error('[FaceEnrollment] Gagal init FaceLandmarker:', err);
        setIsModelLoading(false);
        toast.error('Gagal memuat model wajah');
      });

    // Preload face-api (descriptor 128-d) di background biar siap saat simpan
    if (!isFaceApiReady()) {
      initFaceApi().catch((err) =>
        console.error('[FaceEnrollment] Gagal init face-api:', err),
      );
    }
  }, []);

  // Keep stepRef in sync with state
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // ── Face mesh overlay — gambar 478 titik landmark di atas video ──
  // Canvas diset seukuran video asli (videoWidth × videoHeight), lalu diberi
  // CSS yang SAMA dengan <Webcam> (object-cover + scaleX(-1)) supaya titik
  // yang digambar di koordinat normalized tadi jatuh persis di wajah.
  const drawFaceMesh = (
    landmarks: { x: number; y: number; z: number }[]
  ) => {
    const canvas = meshCanvasRef.current;
    const video = webcamRef.current?.video;
    if (!canvas || !video || !video.videoWidth || !video.videoHeight) return;

    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks || landmarks.length === 0) return;

    // Titik kecil & transparan — biar tidak menutupi wajah
    ctx.fillStyle = 'rgba(94, 234, 212, 0.35)'; // teal-300, opacity rendah
    const radius = Math.max(1, canvas.width / 640); // ~1px untuk video 640px

    for (const lm of landmarks) {
      ctx.beginPath();
      ctx.arc(lm.x * canvas.width, lm.y * canvas.height, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ── Detection logic — stored in ref to avoid stale closure in RAF ──
  // This effect runs on every render, keeping detectionLogicRef.current up-to-date.
  useEffect(() => {
    detectionLogicRef.current = () => {
      if (stepRef.current !== 'capturing') return;

      if (!faceLandmarkerRef.current || !webcamRef.current?.video || webcamRef.current.video.readyState < 2) {
        drawFaceMesh([]); // kosongkan mesh kalau webcam/model belum siap
        return; // tick() will reschedule
      }

      const now = performance.now();
      if (now - lastDetectionTime.current < getDetectionIntervalMs(40)) { // ~25fps di device normal, lebih hemat di low-end
        return;
      }
      lastDetectionTime.current = now;

      const video = webcamRef.current.video;
      if (video.videoWidth <= 0 || video.currentTime === lastVideoTime.current) {
        return;
      }
      lastVideoTime.current = video.currentTime;

      try {
        const results = faceLandmarkerRef.current.detectForVideo(video, performance.now());
        const hasFace = results.faceLandmarks && results.faceLandmarks.length > 0;
        setFaceDetected(!!hasFace);

        // Wajah terdeteksi tapi terpotong tepi → beri tahu user untuk mundur
        if (hasFace) {
          setFacePartiallyVisible(!isFaceFullyVisible(results.faceLandmarks[0]));
        } else {
          setFacePartiallyVisible(false);
        }

        // ── Gambar titik landmark setiap frame ──
        drawFaceMesh(results.faceLandmarks?.[0] ?? []);

        const idx = currentPoseIdxRef.current;
        const poseDef = POSE_SEQUENCE[idx];
        const allDone = poseCapturedRef.current.size >= POSE_SEQUENCE.length;

        if (hasFace && !allDone && poseDef) {
          const landmarks = results.faceLandmarks[0];
          const blendshapes = results.faceBlendshapes?.[0]?.categories ?? [];
          const headPose = estimateHeadPose(landmarks);
          const captured = poseCapturedRef.current.has(poseDef.id);
          const faceFullyVisible = isFaceFullyVisible(landmarks);

          // ── Isi buffer TEMPLATE frontal setiap frame ──
          // Hanya frame wajah frontal (yaw/pitch kecil) yang boleh jadi template.
          // Frame pose ekstrem menciptakan "wajah generik" → skor hijau palsu
          // untuk orang berbeda. Pose ekstrem tetap di-capture (liveness),
          // tapi tidak ikut rata-rata template.
          // Snapshot disimpan sebagai canvas crop (extraction face-api async
          // dilakukan di handleSave, bukan per-frame).
          if (faceFullyVisible
            && Math.abs(headPose.yaw) <= FRONTAL_YAW_MAX
            && Math.abs(headPose.pitch) <= FRONTAL_PITCH_MAX) {
            const snap = captureFaceSnapshot(video, landmarks);
            if (snap) {
              frontalBuffer.current.push(snap);
              if (frontalBuffer.current.length > FRONTAL_BUFFER_MAX) {
                frontalBuffer.current.shift(); // buang frame paling lama
              }
            }
          }

          // ── Wajah harus terbaca PENUH (tidak terpotong tepi) ──
          // Kalau wajah terlalu dekat sehingga dahi/dagu terpotong, pose
          // tidak dianggap valid — dorong pengguna mundur sedikit.
          if (!faceFullyVisible) {
            poseHoldStartRef.current = 0; // jangan pernah capture kalau kepotong
          }

          if (!captured && faceFullyVisible && poseDef.check(headPose, blendshapes)) {
            // ── Syarat pose ditahan: cegah 1 frame noise langsung valid ──
            // Pose harus dipertahankan selama POSE_HOLD_MS berturut-turut
            // sebelum di-capture. Kalau bergerak balik di tengah, hitungan reset.
            // KECUALI kedip (holdMs=0): mata menutup hanya ~100-300ms, jadi
            // harus di-capture seketika saat kedip terdeteksi.
            const nowMs = performance.now();
            const heldEnough = poseDef.holdMs === 0
              || (poseHoldStartRef.current !== 0
                && nowMs - poseHoldStartRef.current >= poseDef.holdMs);

            if (poseDef.holdMs > 0 && poseHoldStartRef.current === 0) {
              poseHoldStartRef.current = nowMs; // mulai hitung tahan
            }

            if (heldEnough) {
              // Capture this pose — simpan snapshot canvas utk fallback template
              const snap = captureFaceSnapshot(video, landmarks);
              if (snap) {
                capturedFrames.current.push(snap);
                poseCapturedRef.current.add(poseDef.id);
                setCapturedPoses(new Set(poseCapturedRef.current));
                poseHoldStartRef.current = 0; // reset utk pose berikutnya

                // Move to next pose
                const nextIdx = idx + 1;
                if (nextIdx < POSE_SEQUENCE.length) {
                  currentPoseIdxRef.current = nextIdx;
                  setCurrentPoseIdx(nextIdx);
                } else {
                  // All done!
                  setTimeout(() => handleSave(), 400);
                }
              }
            }
          } else {
            // Pose tidak terpenuhi → reset hitungan tahan (harus mulai dari nol)
            poseHoldStartRef.current = 0;
          }
        }
      } catch (err) {
        console.error('[FaceEnrollment] detect error:', err);
      }
    };
  });

  // ── Stable RAF tick — selalu membaca logic terbaru dari ref ──
  useEffect(() => {
    if (step !== 'capturing') return;

    const tick = () => {
      detectionLogicRef.current?.();
      if (stepRef.current === 'capturing') {
        requestRef.current = requestAnimationFrame(tick);
      }
    };
    requestRef.current = requestAnimationFrame(tick);

    return () => {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, [step]);

  const handleStartCapture = () => {
    capturedFrames.current = [];
    frontalBuffer.current = [];
    poseCapturedRef.current = new Set();
    currentPoseIdxRef.current = 0;
    poseHoldStartRef.current = 0;
    setCurrentPoseIdx(0);
    setCapturedPoses(new Set());
    setFaceDetected(false);
    setStep('capturing');
  };

  /** Simpan descriptor ke database */
  const handleSave = async () => {
    if (!user?.id) return;
    setIsSaving(true);

    try {
      // ── Template wajah = rata-rata descriptor frame FRONTAL saja ──
      // Rata-rata pose ekstrem (kanan/kiri/atas/bawah) menciptakan vektor
      // "wajah generik" yang cocok dengan siapa pun → skor hijau palsu.
      // Pakai buffer frontal; fallback ke capturedFrames kalau terlalu sedikit
      // (misal low-end device yang jarang kena frame frontal).
      const snapshots = frontalBuffer.current.length >= 3
        ? frontalBuffer.current
        : capturedFrames.current;
      if (snapshots.length < 2) {
        toast.error('Data wajah kurang. Silakan coba lagi.', { id: 'enroll-error-few' });
        setStep('prepare');
        setIsSaving(false);
        return;
      }

      // ── Pastikan model face-api siap sebelum ekstraksi ──
      await initFaceApi();

      // Ekstrak descriptor dari tiap snapshot (async, berat — throttle otomatis
      // karena di-loop berurutan, bukan tiap frame). Guard mencegah overlap.
      if (isExtractingRef.current) {
        toast.error('Pemrosesan masih berjalan. Tunggu sebentar.', { id: 'enroll-error-busy' });
        setStep('prepare');
        setIsSaving(false);
        return;
      }
      isExtractingRef.current = true;
      const descriptors: number[][] = [];
      try {
        // Batasi jumlah snapshot yang diproses (ambil terbaru) biar tidak lambat
        const MAX_PROCESS = 8;
        const toProcess = snapshots.slice(-MAX_PROCESS);
        for (const snap of toProcess) {
          const desc = await extractFaceDescriptor(snap);
          if (desc) descriptors.push(desc);
        }
      } finally {
        isExtractingRef.current = false;
      }

      if (descriptors.length < 2) {
        toast.error('Gagal memproses data wajah. Silakan coba lagi.', { id: 'enroll-error-process' });
        setStep('prepare');
        setIsSaving(false);
        return;
      }

      const avgDescriptor = averageDescriptors(descriptors);
      if (!avgDescriptor) {
        toast.error('Gagal memproses data wajah.', { id: 'enroll-error-process' });
        setStep('prepare');
        setIsSaving(false);
        return;
      }

      await saveFaceDescriptor(user.id, avgDescriptor);

      toast.success(
        mode === 'enroll' ? 'Wajah berhasil didaftarkan!' : 'Wajah berhasil diperbarui!',
        { id: 'enroll-success' }
      );

      setStep('success');

      if (refreshFaceStatus) {
        await refreshFaceStatus();
      }
    } catch (err) {
      console.error('[FaceEnrollment] Gagal simpan:', err);
      toast.error('Gagal menyimpan data wajah. Coba lagi.', { id: 'enroll-error-save' });
      setStep('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDone = () => {
    navigate(mode === 'update' ? '/profil' : '/dashboard');
  };

  const handleBack = () => {
    if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    navigate(mode === 'update' ? '/profil' : '/dashboard');
  };

  // ── Cooldown blocking dihapus — hanya warning toast di atas ──

  return (
    <div className="relative bg-black text-white h-full w-full overflow-hidden">
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 px-4 pt-16 pb-6 z-30 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={handleBack} className="p-2 rounded-full bg-white/20 backdrop-blur-md">
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-bold text-lg tracking-wide drop-shadow-md">
          {mode === 'update' ? 'Perbarui Wajah' : 'Daftarkan Wajah'}
        </h2>
        <div className="w-10" />
      </div>

      {/* ── PREPARE STEP ── */}
      {step === 'prepare' && (
        <div className="absolute inset-0 bg-slate-50 text-gray-900 p-6 flex flex-col justify-center items-center overflow-y-auto">
          <Card className="w-full max-w-sm rounded-[32px] drop-shadow-2xl border-0 text-center py-10 bg-white/90 backdrop-blur-2xl">
            <CardContent className="space-y-5">
              {mode === 'enroll' ? (
                <>
                  <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
                    <ShieldCheck size={40} className="text-teal-600" />
                  </div>
                  <h3 className="font-bold text-xl">Verifikasi Wajah Diperlukan</h3>
                  <p className="text-gray-500 text-sm">
                    Untuk dapat melakukan absen, Anda harus mendaftarkan wajah terlebih dahulu.
                    Proses ini hanya perlu dilakukan <strong>satu kali</strong>.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
                    <RefreshCw size={40} className="text-teal-600" />
                  </div>
                  <h3 className="font-bold text-xl">Perbarui Data Wajah</h3>
                  <p className="text-gray-500 text-sm">
                    Pastikan pencahayaan cukup dan wajah terlihat jelas.
                  </p>
                </>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-3">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                  ✦ Anda akan diminta melakukan 5 gerakan:
                </p>
                <div className="space-y-2">
                  {POSE_SEQUENCE.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs text-amber-700">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <p.icon size={12} className="text-amber-700" />
                      </div>
                      {p.instruction}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-1">
                   Ini untuk keamanan deteksi wajah yang akurat.
                </p>
              </div>

              <Button
                size="lg"
                className="w-full h-14 bg-teal-950 hover:bg-teal-900 rounded-2xl text-lg font-bold"
                onClick={handleStartCapture}
                disabled={isModelLoading}
              >
                {isModelLoading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat Model...</>
                ) : 'Mulai Pemindaian'}
              </Button>

              {mode === 'enroll' && (
                <Button variant="ghost" className="w-full text-gray-400 hover:text-gray-600" onClick={handleBack}>
                  Nanti Saja
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── CAPTURING STEP ── */}
      {step === 'capturing' && (
        <div className="absolute inset-0 overflow-hidden bg-black">
          {/* @ts-ignore react-webcam types issue */}
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              facingMode: 'user',
              // Resolusi lebih rendah di HP low-end → lebih ringan buat MediaPipe
              width: { ideal: isLowEndDevice() ? 480 : 640 },
              height: { ideal: isLowEndDevice() ? 360 : 480 },
            }}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Face mesh overlay — titik landmark real-time (mirror-aware) */}
          <canvas
            ref={meshCanvasRef}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none z-[15]"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Overlay oval */}
          <div className="absolute inset-0 pointer-events-none z-10" aria-hidden="true">
            <div className="absolute inset-0 bg-black/60" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-[3/4] w-[65%] max-w-[280px] rounded-[50%] bg-transparent border-[3px] border-teal-300/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-[3/4] w-[65%] max-w-[280px]">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-teal-300/60 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-teal-300/60 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-teal-300/60 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-teal-300/60 rounded-br-lg" />
            </div>
          </div>

          {/* Progress dots */}
          <div className="absolute top-28 left-0 right-0 z-20 flex justify-center gap-2 px-6">
            {POSE_SEQUENCE.map((p, idx) => {
              const done = capturedPoses.has(p.id);
              const active = idx === currentPoseIdx && !done;
              const Icon = p.icon;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    done
                      ? 'bg-green-500/30 text-green-200 border border-green-400/40'
                      : active
                        ? 'bg-teal-500/30 text-teal-100 border border-teal-400/60 animate-pulse'
                        : 'bg-white/10 text-gray-400 border border-white/10'
                  }`}
                >
                  {done ? <Check size={12} /> : <Icon size={12} />}
                  <span className="hidden sm:inline">{p.instruction}</span>
                </div>
              );
            })}
          </div>

          {/* Pose instruction overlay */}
          <div className="absolute bottom-24 left-0 right-0 px-6 text-center z-20 space-y-3">
            {!allCaptured && (
              <div className={`bg-black/40 p-5 rounded-2xl border backdrop-blur-sm transition-colors ${
                faceDetected ? 'border-teal-500/50' : 'border-red-500/30'
              }`}>
                {currentPose && (
                  <>
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <currentPose.icon size={28} className="text-teal-400" />
                      <p className="text-xl font-bold tracking-wide">{currentPose.instruction}</p>
                    </div>
                    <p className="text-sm text-gray-300">{currentPose.hint}</p>
                  </>
                )}

                {!faceDetected && (
                  <p className="text-red-300 text-xs mt-2 font-medium">
                    ⚠ Wajah tidak terdeteksi. Posisikan wajah di dalam bingkai.
                  </p>
                )}

                {faceDetected && facePartiallyVisible && (
                  <p className="text-amber-300 text-xs mt-2 font-medium">
                    ⚠ Wajah terpotong — mundurlah sedikit agar seluruh wajah terbaca.
                  </p>
                )}
              </div>
            )}

            {allCaptured && !isSaving && (
              <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-2xl">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-green-300" />
                  <p className="font-semibold text-green-200">Memproses data wajah...</p>
                </div>
              </div>
            )}

            {isSaving && (
              <div className="flex items-center justify-center gap-2 text-teal-300">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Menyimpan data wajah...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUCCESS STEP ── */}
      {step === 'success' && (
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900 to-teal-950 text-white p-6 flex flex-col justify-center items-center">
          <div className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center mb-8 animate-bounce shadow-[0_0_40px_rgba(34,197,94,0.4)]">
            <CheckCircle2 size={56} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-3 tracking-wide text-center">
            {mode === 'enroll' ? 'Wajah Berhasil Didaftarkan!' : 'Wajah Berhasil Diperbarui!'}
          </h2>
          <p className="text-teal-100 text-center mb-8 text-lg opacity-90">
            {mode === 'enroll'
              ? 'Anda sekarang dapat melakukan absen menggunakan wajah.'
              : 'Data wajah Anda telah diperbarui.'}
          </p>
          <Button
            className="w-full max-w-sm h-14 bg-yellow-400 hover:bg-yellow-500 text-teal-950 font-bold rounded-2xl text-lg shadow-xl"
            onClick={handleDone}
          >
            {mode === 'enroll' ? 'Mulai Absen' : 'Kembali ke Profil'}
          </Button>
        </div>
      )}

      {/* ── ERROR STEP ── */}
      {step === 'error' && (
        <div className="absolute inset-0 bg-slate-50 text-gray-900 p-6 flex flex-col justify-center items-center">
          <Card className="w-full max-w-sm rounded-[32px] drop-shadow-2xl border-0 text-center py-10 bg-white">
            <CardContent className="space-y-5">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={40} className="text-red-600" />
              </div>
              <h3 className="font-bold text-xl">Gagal Menyimpan</h3>
              <p className="text-gray-500 text-sm">
                Terjadi kesalahan saat menyimpan data wajah. Silakan coba lagi.
              </p>
              <Button
                size="lg"
                className="w-full h-14 bg-teal-950 hover:bg-teal-900 rounded-2xl font-bold"
                onClick={() => {
                  setStep('prepare');
                  capturedFrames.current = [];
                  frontalBuffer.current = [];
                  poseCapturedRef.current = new Set();
                  currentPoseIdxRef.current = 0;
                  poseHoldStartRef.current = 0;
                  setCurrentPoseIdx(0);
                  setCapturedPoses(new Set());
                }}
              >
                Coba Lagi
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
