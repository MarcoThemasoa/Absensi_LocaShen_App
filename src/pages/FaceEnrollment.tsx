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
  extractDescriptor,
  averageDescriptors,
  estimateHeadPose,
  isBlinking,
  POSE_YAW_THRESHOLD,
  POSE_PITCH_THRESHOLD,
} from '../lib/faceLandmarker';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { useAuth } from '../context/AuthContext';
import { saveFaceDescriptor, getFaceEnrollmentInfo, canReEnroll } from '../lib/faceMatcher';
import { toast } from 'sonner';

// ── Guided pose sequence ──
type PoseId = 'right' | 'left' | 'up' | 'down' | 'blink';

interface PoseDef {
  id: PoseId;
  icon: typeof ArrowRight;
  instruction: string;
  hint: string;
  check: (pose: ReturnType<typeof estimateHeadPose>, blendshapes: { categoryName: string; score: number }[]) => boolean;
}

const POSE_SEQUENCE: PoseDef[] = [
  {
    id: 'right',
    icon: ArrowRight,
    instruction: 'Tengok ke Kanan',
    hint: 'Hadapkan wajah perlahan ke arah kanan Anda',
    check: (pose) => pose.yaw > POSE_YAW_THRESHOLD,
  },
  {
    id: 'left',
    icon: ArrowLeftIcon,
    instruction: 'Tengok ke Kiri',
    hint: 'Hadapkan wajah perlahan ke arah kiri Anda',
    check: (pose) => pose.yaw < -POSE_YAW_THRESHOLD,
  },
  {
    id: 'up',
    icon: ArrowUp,
    instruction: 'Lihat ke Atas',
    hint: 'Angkat wajah Anda perlahan ke atas (mendongak)',
    check: (pose) => pose.pitch > POSE_PITCH_THRESHOLD,
  },
  {
    id: 'down',
    icon: ArrowDown,
    instruction: 'Tengok ke Bawah',
    hint: 'Turunkan wajah Anda perlahan ke bawah (menunduk)',
    check: (pose) => pose.pitch < -POSE_PITCH_THRESHOLD,
  },
  {
    id: 'blink',
    icon: Eye,
    instruction: 'Kedipkan Mata',
    hint: 'Kedipkan kedua mata Anda untuk verifikasi',
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
  const capturedFrames = useRef<number[][]>([]);
  const poseCapturedRef = useRef<Set<PoseId>>(new Set());
  const currentPoseIdxRef = useRef<number>(0);
  const stepRef = useRef<EnrollStep>('prepare');
  const detectionLogicRef = useRef<() => void>();

  const [isModelLoading, setIsModelLoading] = useState(!isFaceLandmarkerReady());
  const [step, setStep] = useState<EnrollStep>('prepare');
  const [faceDetected, setFaceDetected] = useState(false);
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
  }, []);

  // Keep stepRef in sync with state
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  // ── Detection logic — stored in ref to avoid stale closure in RAF ──
  // This effect runs on every render, keeping detectionLogicRef.current up-to-date.
  useEffect(() => {
    detectionLogicRef.current = () => {
      if (stepRef.current !== 'capturing') return;

      if (!faceLandmarkerRef.current || !webcamRef.current?.video || webcamRef.current.video.readyState < 2) {
        return; // tick() will reschedule
      }

      const now = performance.now();
      if (now - lastDetectionTime.current < 40) { // ~25 fps — lebih responsif
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

        const idx = currentPoseIdxRef.current;
        const poseDef = POSE_SEQUENCE[idx];
        const allDone = poseCapturedRef.current.size >= POSE_SEQUENCE.length;

        if (hasFace && !allDone && poseDef) {
          const landmarks = results.faceLandmarks[0];
          const blendshapes = results.faceBlendshapes?.[0]?.categories ?? [];
          const headPose = estimateHeadPose(landmarks);
          const captured = poseCapturedRef.current.has(poseDef.id);

          if (!captured && poseDef.check(headPose, blendshapes)) {
            // Capture this pose
            const desc = extractDescriptor(landmarks);
            if (desc) {
              capturedFrames.current.push(desc);
              poseCapturedRef.current.add(poseDef.id);
              setCapturedPoses(new Set(poseCapturedRef.current));

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
    poseCapturedRef.current = new Set();
    currentPoseIdxRef.current = 0;
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
      const frames = capturedFrames.current;
      if (frames.length < 2) {
        toast.error('Data wajah kurang. Silakan coba lagi.', { id: 'enroll-error-few' });
        setStep('prepare');
        setIsSaving(false);
        return;
      }

      const avgDescriptor = averageDescriptors(frames);
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
            videoConstraints={{ facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }}
            className="absolute inset-0 h-full w-full object-cover"
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
                  poseCapturedRef.current = new Set();
                  currentPoseIdxRef.current = 0;
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
