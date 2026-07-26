import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Webcam from 'react-webcam';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { ArrowLeft, CheckCircle2, ScanFace, MapPinned, XCircle, Loader2, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import { getFaceLandmarker, isFaceLandmarkerReady, extractDescriptor, matchDescriptor, FACE_MATCH_THRESHOLD } from '../lib/faceLandmarker';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { useAuth } from '../context/AuthContext';
import { getCachedPosition } from '../lib/locationCache';
import { CheckInRequiredDialog } from '../components/CheckInRequiredDialog';
import { supabase } from '../lib/supabase';
import { fmtHHmm } from '../lib/utils';
import { toast } from 'sonner';
import { loadFaceDescriptor } from '../lib/faceMatcher';

export default function CameraAbsen() {
  const { user, todayAttendance, locations, recordCheckIn, recordCheckOut, clearTodayAttendance } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const webcamRef = useRef<Webcam>(null);
  
  const isCheckOut = new URLSearchParams(location.search).get('type') === 'keluar';
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);
  const [showOutOfHoursDialog, setShowOutOfHoursDialog] = useState(false);

  const [step, setStep] = useState<'location' | 'face' | 'liveness' | 'success' | 'error'>('location');
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsSlow, setGpsSlow] = useState(false);
  const [inRange, setInRange] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isLate, setIsLate] = useState(false);
  const [attendanceTime, setAttendanceTime] = useState<string>('');
  
  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(!isFaceLandmarkerReady());
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastVideoTime = useRef<number>(-1);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
  const [forgotConfirmed, setForgotConfirmed] = useState(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDetectionTime = useRef<number>(0);
  const DETECTION_INTERVAL = 150; // ms — throttle biar nggak tiap frame
  const liveDescriptorRef = useRef<number[] | null>(null);
  const [faceMatchScore, setFaceMatchScore] = useState<number | null>(null);
  const [faceMatchPass, setFaceMatchPass] = useState<boolean | null>(null);
  const [isFaceMatching, setIsFaceMatching] = useState(false);

  // ── Continuous pre-check: deteksi wajah real-time di step 'face' ──
  const storedDescriptorRef = useRef<number[] | null>(null);
  const faceCheckFrameRef = useRef(0);
  const [facePreCheckScore, setFacePreCheckScore] = useState<number | null>(null);
  const [facePreCheckPass, setFacePreCheckPass] = useState<boolean | null>(null);
  const [facePreChecking, setFacePreChecking] = useState(true);
  const [facePreCheckFaceDetected, setFacePreCheckFaceDetected] = useState(false);

  // Continuous face detection loop untuk step 'face'
  const faceCheckLoop = useCallback(() => {
    // Hanya stop kalau step berubah (bukan 'face')
    if (step !== 'face') return;

    // Kalau model/webcam belum siap → polling lagi
    if (!faceLandmarker || !webcamRef.current?.video || webcamRef.current.video.readyState < 2) {
      requestRef.current = requestAnimationFrame(faceCheckLoop);
      return;
    }

    // Throttle deteksi biar tidak tiap frame
    const now = performance.now();
    if (now - lastDetectionTime.current < 200) {
      requestRef.current = requestAnimationFrame(faceCheckLoop);
      return;
    }
    lastDetectionTime.current = now;

    const video = webcamRef.current.video;
    if (video.videoWidth <= 0 || video.currentTime === lastVideoTime.current) {
      requestRef.current = requestAnimationFrame(faceCheckLoop);
      return;
    }
    lastVideoTime.current = video.currentTime;

    try {
      const results = faceLandmarker.detectForVideo(video, performance.now());
      const hasFace = results.faceLandmarks && results.faceLandmarks.length > 0;
      setFacePreCheckFaceDetected(!!hasFace);

      if (hasFace && user?.id) {
        const desc = extractDescriptor(results.faceLandmarks[0]);
        if (desc && storedDescriptorRef.current) {
          // Update skor setiap beberapa frame (biar halus)
          faceCheckFrameRef.current++;
          if (faceCheckFrameRef.current % 3 === 0) { // setiap ~600ms
            const score = matchDescriptor(desc, storedDescriptorRef.current);
            setFacePreCheckScore(score);
            setFacePreCheckPass(score < FACE_MATCH_THRESHOLD);
            setFacePreChecking(false);
          }
        } else if (desc && !storedDescriptorRef.current) {
          // Belum ada stored — coba load sekali
          setFacePreChecking(true);
          loadFaceDescriptor(user.id)
            .then((stored) => {
              if (stored) {
                storedDescriptorRef.current = stored;
                const score = matchDescriptor(desc, stored);
                setFacePreCheckScore(score);
                setFacePreCheckPass(score < FACE_MATCH_THRESHOLD);
              } else {
                // Belum enrollment — izinkan
                setFacePreCheckPass(true);
                setFacePreCheckScore(null);
              }
            })
            .catch(() => {
              setFacePreCheckPass(true); // fallback: izinkan
            })
            .finally(() => {
              setFacePreChecking(false);
            });
        }
      }
    } catch (err) {
      console.error('[FaceCheckLoop] error:', err);
    }

    // Always schedule next frame
    requestRef.current = requestAnimationFrame(faceCheckLoop);
  }, [step, faceLandmarker, user?.id]);

  // Start/stop face check loop
  useEffect(() => {
    if (step === 'face') {
      // Mulai load stored descriptor di background
      storedDescriptorRef.current = null;
      faceCheckFrameRef.current = 0;
      setFacePreCheckScore(null);
      setFacePreCheckPass(null);
      setFacePreChecking(true);
      setFacePreCheckFaceDetected(false);

      requestRef.current = requestAnimationFrame(faceCheckLoop);
    }
    return () => {
      if (requestRef.current !== null && step !== 'liveness') {
        // Jangan cancel kalau mau pindah ke liveness (detectBlink akan pakai RAF sendiri)
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [step, faceCheckLoop]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Reset face state saat kembali ke location
  useEffect(() => {
    if (step === 'location') {
      liveDescriptorRef.current = null;
      setFaceMatchScore(null);
      setFaceMatchPass(null);
      setIsFaceMatching(false);
    }
  }, [step]);

  const SCHEDULE_END_HOUR = 17;
  const GRACE_END_HOUR = 20;
  const GRACE_END_TOTAL_MIN = GRACE_END_HOUR * 60;

  // Check if trying to check-out without check-in
  useEffect(() => {
    if (isCheckOut && !todayAttendance?.checkInTime) {
      setShowCheckInDialog(true);
    }
  }, [isCheckOut, todayAttendance]);

  // Check working hours for check-in (allowed: 07:00 - 17:00)
  useEffect(() => {
    if (!isCheckOut && !todayAttendance?.checkInTime) {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const totalMinutes = hour * 60 + minute;
      const startAllowed = 7 * 60;   // 07:00
      const endAllowed = 17 * 60;    // 17:00
      if (totalMinutes < startAllowed || totalMinutes > endAllowed) {
        setShowOutOfHoursDialog(true);
      }
    }
  }, [isCheckOut, todayAttendance]);

  useEffect(() => {
    // Gunakan singleton — model sudah di-preload atau akan di-load sekali saja
    setModelLoadError(null);
    setIsModelLoading(true);

    // Timeout 20 detik — tampilkan opsi skip kalau terlalu lama
    const timeoutId = setTimeout(() => {
      if (!isFaceLandmarkerReady()) {
        setModelLoadError('Memuat model wajah terlalu lama. Periksa koneksi internet atau coba lagi.');
        setIsModelLoading(false);
      }
    }, 20000);

    getFaceLandmarker()
      .then((landmarker) => {
        clearTimeout(timeoutId);
        setFaceLandmarker(landmarker);
        setIsModelLoading(false);
        setModelLoadError(null);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error('Error initializing FaceLandmarker', error);
        setIsModelLoading(false);
        setModelLoadError(
          'HP ini tidak mendukung deteksi wajah. Anda tetap bisa absen tanpa verifikasi wajah.'
        );
      });

    return () => clearTimeout(timeoutId);
  }, []);

  const detectBlink = useCallback(async () => {
    if (step !== 'liveness' || !faceLandmarker || !webcamRef.current?.video || blinkDetected) return;

    // Throttle: skip deteksi kalo belum waktunya
    const now = performance.now();
    if (now - lastDetectionTime.current < DETECTION_INTERVAL) {
      requestRef.current = requestAnimationFrame(detectBlink);
      return;
    }
    lastDetectionTime.current = now;

    const video = webcamRef.current.video;
    
    // Ensure video is ready
    if (video.readyState >= 2 && video.videoWidth > 0) {
      if (video.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = video.currentTime;
        
        try {
          const results = faceLandmarker.detectForVideo(video, performance.now());
          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            const blendshapes = results.faceBlendshapes[0].categories;
            const eyeBlinkLeft = blendshapes.find(shape => shape.categoryName === 'eyeBlinkLeft')?.score || 0;
            const eyeBlinkRight = blendshapes.find(shape => shape.categoryName === 'eyeBlinkRight')?.score || 0;
            
            // If both eyes are blinked (threshold > 0.35)
            if (eyeBlinkLeft > 0.35 && eyeBlinkRight > 0.35) {
               setBlinkDetected(true);
               const imageSrc = webcamRef.current.getScreenshot();
               if (imageSrc) setPhoto(imageSrc);

               // Extract face descriptor for matching
               if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                 liveDescriptorRef.current = extractDescriptor(results.faceLandmarks[0]);
               }

               // Start face matching in background
               if (user?.id) {
                 setIsFaceMatching(true);
                 loadFaceDescriptor(user.id)
                   .then((storedDesc) => {
                     if (storedDesc && liveDescriptorRef.current) {
                       const score = matchDescriptor(liveDescriptorRef.current, storedDesc);
                       setFaceMatchScore(score);
                       setFaceMatchPass(score < FACE_MATCH_THRESHOLD);
                       if (score >= FACE_MATCH_THRESHOLD) {
                         console.warn(`[FaceMatch] Wajah tidak cocok! Score: ${score.toFixed(4)} (threshold: ${FACE_MATCH_THRESHOLD})`);
                       } else {
                         console.log(`[FaceMatch] Wajah cocok. Score: ${score.toFixed(4)}`);
                       }
                     }
                   })
                   .catch((err) => {
                     console.error('[FaceMatch] Gagal load descriptor:', err);
                     // Jika tidak ada descriptor (belum enroll), abaikan saja
                   })
                   .finally(() => {
                     setIsFaceMatching(false);
                   });
               }

               // Small delay before moving to success
               successTimeoutRef.current = setTimeout(() => setStep('success'), 500);
               return; 
            }
          }
        } catch (error) {
          console.error(error);
        }
      }
    }
    
    if (step === 'liveness' && !blinkDetected) {
      requestRef.current = requestAnimationFrame(detectBlink);
    }
  }, [step, faceLandmarker, blinkDetected]);

  useEffect(() => {
    if (step === 'liveness' && !blinkDetected) {
      requestRef.current = requestAnimationFrame(detectBlink);
    }
    return () => {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, [step, detectBlink, blinkDetected]);

  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [distanceInfo, setDistanceInfo] = useState<number | null>(null);

  useEffect(() => {
    let slowTimer: ReturnType<typeof setTimeout> | null = null;
    if (step === 'location' && gpsLoading) {
      slowTimer = setTimeout(() => {
        setGpsSlow(true);
      }, 5000);
    }
    return () => {
      if (slowTimer !== null) {
        clearTimeout(slowTimer);
      }
    };
  }, [step, gpsLoading]);

  useEffect(() => {
    if (step !== 'location') return;

    const handlePosition = (lat: number, lng: number) => {
      setUserLat(lat);
      setUserLng(lng);
      let isAnyInRange = false;
      let closestDist = Infinity;

      const assignedLoc = locations.find(l => l.id === user?.locationId);
      if (assignedLoc) {
        const R = 6371e3;
        const lat1 = lat * Math.PI / 180;
        const lat2 = assignedLoc.lat * Math.PI / 180;
        const dLat = (assignedLoc.lat - lat) * Math.PI / 180;
        const dLng = (assignedLoc.lng - lng) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        closestDist = R * c;
        isAnyInRange = closestDist <= assignedLoc.radius;
      }

      setDistanceInfo(Math.round(closestDist));
      setInRange(isAnyInRange);
      setGpsLoading(false);
    };

    // Cek cache GPS dulu — biar langsung tanpa nunggu
    const cached = getCachedPosition();
    if (cached.isReady && cached.position) {
      handlePosition(cached.position.lat, cached.position.lng);
      return;
    }

    // Cache belum siap — fallback ke live GPS
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handlePosition(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setInRange(false);
          setGpsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setInRange(false);
      setGpsLoading(false);
    }
  }, [step, locations, user?.locationId]);

  const handleNextStep = () => {
    if (step === 'location') setStep('face');
    else if (step === 'face') {
      if (!faceLandmarker) {
        alert("Model deteksi wajah sedang dimuat, mohon tunggu sebentar.");
        return;
      }
      setStep('liveness');
    }
    else if (step === 'liveness') {
      // Fallback manual click for demo if blink detection fails
      const imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc) {
        setPhoto(imageSrc);
      }
      successTimeoutRef.current = setTimeout(() => setStep('success'), 1000); 
    }
  };

  const handleSuccessConfirm = async (isForgot?: boolean) => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeString = `${hours}:${minutes}:${seconds}`;
    setAttendanceTime(timeString);

    if (isCheckOut) {
      recordCheckOut(timeString, isForgot ?? forgotConfirmed);
      toast.success('Absen keluar tercatat');
    } else {
      const hourNum = now.getHours();
      const minNum = now.getMinutes();
      const isLateTime = hourNum > 8 || (hourNum === 8 && minNum > 0);
      setIsLate(isLateTime);
      recordCheckIn(timeString);
      if (isLateTime) {
        toast.warning('Perhatian: Anda telah absen masuk dengan terlambat!');
      } else {
        toast.success('Absen masuk tercatat tepat waktu');
      }
    }

    // Simpan ke Supabase (tunggu sampai selesai)
    await doSupabaseSave(timeString, isForgot ?? forgotConfirmed);
  };

  /** Simpan data absen ke Supabase */
  const doSupabaseSave = async (timeStr: string, isForgot: boolean) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      if (isCheckOut) {
        const updateData: Record<string, any> = { time_out: timeStr };
        if (isForgot) {
          updateData.is_forgot_clock_out = true;
        }
        // Simpan face_match_score kalau ada hasil matching-nya
        if (faceMatchScore !== null) {
          updateData.face_match_score = faceMatchScore;
        }
        console.log('[doSupabaseSave] Mencoba UPDATE attendance_records:', { userId: user?.id, date: today, updateData });
        const { data: updatedData, error } = await supabase
          .from('attendance_records')
          .update(updateData)
          .eq('user_id', user?.id)
          .eq('date', today)
          .select('id, user_id, date, time_out, is_forgot_clock_out');
        console.log('[doSupabaseSave] Hasil UPDATE:', { updatedData, error });
        if (error) {
          console.error('[doSupabaseSave] Error Supabase:', error);
          toast.error('Gagal menyimpan absen keluar: ' + error.message);
          return;
        }
        if (!updatedData || updatedData.length === 0) {
          console.warn('[doSupabaseSave] Tidak ada record yang terupdate!');
          toast.error('Data absen masuk tidak ditemukan. Mungkin RLS memblokir.');
          return;
        }
        console.log('[doSupabaseSave] Berhasil update', updatedData.length, 'record');
        clearTodayAttendance();
      } else if (user?.id) {
        const now = new Date();
        const hourNum = now.getHours();
        const minNum = now.getMinutes();
        const isLateTime = hourNum > 8 || (hourNum === 8 && minNum > 0);
        console.log('[doSupabaseSave] Mencoba INSERT attendance_records:', { userId: user.id, date: today, time_in: timeStr });
          const insertPayload: Record<string, any> = {
            user_id: user.id,
            date: today,
            time_in: timeStr,
            status: isLateTime ? 'telat' : 'hadir',
            location_lat: userLat,
            location_lng: userLng,
            photo_url: photo,
          };
          // Simpan face_match_score kalau ada hasil matching-nya
          if (faceMatchScore !== null) {
            insertPayload.face_match_score = faceMatchScore;
          }
          const { data: insertedData, error } = await supabase
            .from('attendance_records')
            .insert(insertPayload)
            .select('id, user_id, date, time_in, status');
        console.log('[doSupabaseSave] Hasil INSERT:', { insertedData, error });
        if (error) {
          console.error('Gagal insert absen masuk:', error);
          toast.error('Gagal menyimpan absen masuk ke database: ' + error.message);
        } else if (!insertedData || insertedData.length === 0) {
          console.warn('[doSupabaseSave] INSERT tidak mengembalikan data! Mungkin RLS memblokir.');
          toast.error('Absen masuk gagal disimpan. Cek RLS policy Supabase.');
        } else {
          console.log('[doSupabaseSave] Berhasil insert', insertedData.length, 'record');
        }
      }
    } catch (e) {
      console.error('Gagal simpan absen ke database:', e);
      toast.error('Gagal terhubung ke database');
    }
  };

  const videoConstraints = {
    facingMode: "user",
    width: { ideal: 640 },
    height: { ideal: 480 },
  };

  if (showOutOfHoursDialog) {
    return (
      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Di Luar Jam Kerja</h2>
            <p className="text-gray-500 text-sm mb-1">
              Absen masuk hanya dapat dilakukan pada pukul <span className="font-semibold">07:00 - 17:00</span>.
            </p>
            <p className="text-gray-400 text-xs mb-6">
              Jam kerja dimulai pukul 08:00 dengan toleransi 1 jam sebelumnya.
            </p>
          </div>
          <Button 
            className="w-full h-12 bg-teal-950 hover:bg-teal-900 text-white rounded-2xl font-bold"
            onClick={() => navigate('/dashboard')}
          >
            Kembali ke Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (showCheckInDialog) {
    return (
      <CheckInRequiredDialog
        open={showCheckInDialog}
        onClose={() => navigate('/dashboard')}
        onNavigateCheckIn={() => {
          setShowCheckInDialog(false);
          navigate('/absen/kamera');
        }}
      />
    );
  }

  return (
    <div className="relative bg-black text-white h-full w-full overflow-hidden">
      {/* Camera view — full screen dari ujung atas */}
      {(step === 'face' || step === 'liveness') && (
        <div className="absolute inset-0 overflow-hidden bg-black">
          {/* @ts-ignore react-webcam types issue */}
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {/* Face guide overlay — cutout oval di tengah */}
          <div className="absolute inset-0 pointer-events-none z-10" aria-hidden="true">
            <div className="absolute inset-0 bg-black/60" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-[3/4] w-[65%] max-w-[280px] rounded-[50%] bg-transparent border-[3px] border-teal-300/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"></div>
            {/* Corner guides */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-[3/4] w-[65%] max-w-[280px]">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-teal-300/60 rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-teal-300/60 rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-teal-300/60 rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-teal-300/60 rounded-br-lg"></div>
            </div>
          </div>
          
          <div className="absolute bottom-24 left-0 right-0 px-6 text-center z-20">
            {step === 'face' && (
              <div className={`bg-black/40 p-4 rounded-2xl mb-4 border backdrop-blur-sm transition-colors ${
                !facePreCheckFaceDetected
                  ? 'border-red-500/30'
                  : facePreCheckPass === null
                    ? 'border-white/10'
                    : facePreCheckPass
                      ? 'border-green-500/50'
                      : 'border-amber-500/50'
              }`}>
                <ScanFace size={32} className="mx-auto mb-2 text-teal-400" />
                <p className="font-medium text-sm">
                  {!facePreCheckFaceDetected
                    ? 'Wajah tidak terdeteksi — posisikan di dalam bingkai'
                    : 'Posisikan wajah Anda di dalam bingkai'}
                </p>

                {/* Face not detected warning */}
                {!facePreCheckFaceDetected && (
                  <p className="mt-2 text-[11px] text-red-300/80">
                    Pastikan wajah terlihat jelas dan pencahayaan cukup
                  </p>
                )}

                {/* Checking spinner */}
                {facePreCheckFaceDetected && facePreChecking && facePreCheckScore === null && (
                  <div className="mt-2 flex items-center justify-center gap-2 text-xs text-teal-300">
                    <Loader2 size={12} className="animate-spin" />
                    Memverifikasi data wajah...
                  </div>
                )}

                {/* Result: cocok */}
                {facePreCheckFaceDetected && !facePreChecking && facePreCheckPass === true && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-green-300">
                    <ShieldCheck size={14} />
                    Wajah terverifikasi {facePreCheckScore !== null && `(skor ${facePreCheckScore.toFixed(3)})`}
                  </div>
                )}

                {/* Result: tidak cocok */}
                {facePreCheckFaceDetected && !facePreChecking && facePreCheckPass === false && (
                  <div className="mt-2">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-300">
                      <ShieldCheck size={14} />
                      Wajah tidak cocok (skor {facePreCheckScore?.toFixed(3) ?? '-'})
                    </div>
                    <p className="mt-1 text-[10px] text-amber-400/70">
                      Anda tetap bisa lanjut — admin akan mendapat notifikasi
                    </p>
                  </div>
                )}
              </div>
            )}
            {step === 'liveness' && (
              <div className="bg-black/30 p-4 rounded-2xl mb-6 animate-pulse border border-yellow-500/30">
                <p className="font-bold text-yellow-400 text-xl tracking-wide">Kedipkan Mata Anda</p>
                <p className="text-sm mt-2 text-gray-300">Sistem sedang mendeteksi liveness...</p>
              </div>
            )}
            
            {step === 'face' && (
              <>
                {/* Model error: HP tidak support */}
                {modelLoadError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-900/40 border border-red-500/30 text-center">
                    <p className="text-xs text-red-200">{modelLoadError}</p>
                    <Button
                      size="sm"
                      className="mt-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-semibold"
                      onClick={() => {
                        // Model gagal — skip face + liveness, langsung foto
                        const imageSrc = webcamRef.current?.getScreenshot();
                        if (imageSrc) setPhoto(imageSrc);
                        setStep('success');
                      }}
                    >
                      Lewati Verifikasi Wajah
                    </Button>
                  </div>
                )}

                <Button 
                  size="lg" 
                  className={`w-full rounded-2xl font-bold h-16 text-xl transition-all ${
                    !facePreCheckFaceDetected
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-teal-600 hover:bg-teal-500 text-white'
                  }`}
                  onClick={handleNextStep}
                  disabled={isModelLoading || !facePreCheckFaceDetected}
                >
                  {isModelLoading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat Model...</>
                  ) : !facePreCheckFaceDetected ? (
                    'Tunggu Wajah Terdeteksi'

                  ) : (
                    'Lanjutkan Absen'
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header — absolute overlay di atas video */}
      <div className="absolute top-0 left-0 right-0 px-4 pt-16 pb-6 z-30 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/20 backdrop-blur-md">
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-bold text-lg tracking-wide drop-shadow-md">{isCheckOut ? 'Absen Keluar' : 'Absen Masuk'}</h2>
        
        {/* ── Real-time face match score (step 'face' saja) ── */}
        {step === 'face' && (
          <div className="flex items-center gap-2">
            {facePreChecking && !facePreCheckFaceDetected && (
              <span className="text-[11px] text-gray-400 bg-black/30 px-2 py-1 rounded-full">
                Cari wajah...
              </span>
            )}
            {facePreChecking && facePreCheckFaceDetected && facePreCheckScore === null && (
              <span className="flex items-center gap-1 text-[11px] text-teal-300 bg-black/30 px-2 py-1 rounded-full">
                <Loader2 size={10} className="animate-spin" />
                Memeriksa...
              </span>
            )}
            {!facePreChecking && facePreCheckScore !== null && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                facePreCheckPass
                  ? 'bg-green-500/30 text-green-200 border border-green-400/40'
                  : 'bg-red-500/30 text-red-200 border border-red-400/40'
              }`}>
                Skor: {facePreCheckScore.toFixed(3)}
              </span>
            )}
            {!facePreChecking && facePreCheckPass === true && facePreCheckScore === null && (
              <span className="text-xs font-bold text-teal-300 bg-teal-500/20 px-2.5 py-1 rounded-full border border-teal-400/30">
                Siap
              </span>
            )}
          </div>
        )}
      </div>

      {step === 'location' && (
        <div className="absolute inset-0 bg-slate-50 text-gray-900 p-6 flex flex-col justify-center items-center overflow-y-auto">
          <Card className="w-full max-w-sm rounded-[32px] drop-shadow-2xl shadow-[0_20px_50px_rgb(0,0,0,0.1)] border-0 text-center py-10 bg-white/90 backdrop-blur-2xl">
            <CardContent>
              {gpsLoading ? (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-6 relative">
                    <MapPinned size={40} className="text-teal-600 animate-bounce" />
                    <div className="absolute inset-0 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                  </div>
                  <h3 className="font-bold text-xl mb-2">{gpsSlow ? 'Membutuhkan waktu...' : 'Mencari Lokasi...'}</h3>
                  <p className="text-gray-500 text-sm px-4 text-center">
                    {gpsSlow ? 'Sinyal GPS mungkin lemah atau belum diizinkan. Pastikan lokasi perangkat aktif.' : 'Mengakses GPS perangkat Anda'}
                  </p>
                  {gpsSlow && (
                    <Button 
                      variant="outline" 
                      onClick={() => { setInRange(true); setGpsLoading(false); }} 
                      className="mt-4 border-teal-200 text-teal-700 hover:bg-teal-50"
                    >
                      Bypass Lokasi (Demo)
                    </Button>
                  )}
                </div>
              ) : inRange ? (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 ring-8 ring-green-50">
                    <CheckCircle2 size={40} />
                  </div>
                  <h3 className="font-bold text-xl mb-2">Lokasi Valid</h3>
                  <p className="text-gray-500 text-sm mb-8">{`Anda berada di radius ${locations.find(l => l.id === user?.locationId)?.name || '-'}`}</p>
                  {todayAttendance?.checkInTime && (
                    <div className="flex items-center justify-center gap-5 mb-6 bg-teal-50/60 rounded-2xl py-3 px-5 w-full border border-teal-100/50">
                      <div className="text-center">
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Masuk</p>
                        <p className="text-lg font-bold text-teal-700">{todayAttendance.checkInTime.slice(0, 5)}</p>
                      </div>
                      <div className="text-gray-300 text-xl font-light">—</div>
                      <div className="text-center">
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Keluar</p>
                        <p className="text-lg font-bold text-teal-700">{todayAttendance.checkOutTime ? todayAttendance.checkOutTime.slice(0, 5) : '— : —'}</p>
                      </div>
                    </div>
                  )}
                  <Button onClick={handleNextStep} className="w-full h-14 bg-teal-950 hover:bg-teal-900 rounded-2xl text-lg font-bold">Lanjutkan Absen</Button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 ring-8 ring-red-50">
                    <XCircle size={40} />
                  </div>
                  <h3 className="font-bold text-xl text-red-600 mb-2">Di Luar Jangkauan</h3>
                  <p className="text-gray-500 text-sm px-4">Anda berada di luar radius kantor yang diizinkan.</p>
                  {distanceInfo !== null && <p className="text-red-700 mt-3 font-semibold bg-red-50 py-1.5 px-3 rounded-full text-xs border border-red-100">Jarak saat ini: {distanceInfo.toLocaleString('id-ID')} meter</p>}
                  <Button onClick={() => setInRange(true)} className="w-full mt-4 h-14 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-lg">Bypass (Mode Demo)</Button>
                  <Button variant="outline" onClick={() => navigate(-1)} className="w-full mt-3 h-14 rounded-2xl font-bold text-lg border-gray-200">Kembali</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Forgot clock-out confirmation dialog */}
      <Dialog open={showForgotConfirm} onOpenChange={setShowForgotConfirm}>
        <DialogContent className="sm:max-w-md rounded-3xl border-gray-100 bg-white shadow-xl p-6 mx-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <DialogTitle className="text-lg font-bold text-gray-900">Absen Keluar Larut Malam</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-gray-600 text-sm mt-2">
            Anda melakukan absen keluar setelah pukul {GRACE_END_HOUR.toString().padStart(2, '0')}:00.
            Apakah Anda <strong className="text-gray-900">lupa absen keluar</strong> sebelumnya?
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Jika "Ya", sistem akan menandai hari ini sebagai <strong>lupa absen keluar</strong>.
            Jika "Tidak", ini dianggap lembur / kerja larut malam.
          </p>
          <DialogFooter className="mt-6 flex gap-3 sm:justify-end">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={async () => {
                setForgotConfirmed(false);
                setShowForgotConfirm(false);
                await handleSuccessConfirm(false);
                navigate('/dashboard');
              }}
            >
              Tidak (Saya Lembur)
            </Button>
            <Button
              className="rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
              onClick={async () => {
                setForgotConfirmed(true);
                setShowForgotConfirm(false);
                await handleSuccessConfirm(true);
                navigate('/dashboard');
              }}
            >
              Ya, Saya Lupa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {step === 'success' && (
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900 to-teal-950 text-white p-6 flex flex-col justify-center items-center overflow-y-auto">
          <div className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center mb-8 animate-bounce shadow-[0_0_40px_rgba(34,197,94,0.4)]">
            <CheckCircle2 size={56} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-3 tracking-wide">Absen Berhasil!</h2>
          <p className="text-teal-100 text-center mb-2 text-lg opacity-90">Tercatat pada pukul <span className="font-bold">{attendanceTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span></p>
          
          {!isCheckOut && isLate && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-3 mb-6 w-full max-w-xs flex items-start gap-3">
              <AlertCircle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="font-bold text-yellow-300 text-sm">Perhatian: Absen Terlambat!</p>
                <p className="text-yellow-200 text-xs mt-1">Anda masuk setelah jam 08:00</p>
              </div>
            </div>
          )}

          {todayAttendance?.checkInTime && isCheckOut && (
            <div className="bg-teal-500/20 border border-teal-500/50 rounded-xl p-3 mb-6 w-full max-w-xs flex items-start gap-3">
              <Clock size={20} className="text-teal-200 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="font-bold text-teal-100 text-sm">Durasi Kerja</p>
                <p className="text-teal-200 text-xs mt-1">Masuk: {fmtHHmm(todayAttendance.checkInTime)}</p>
              </div>
            </div>
          )}

          {/* Small warning only when face doesn't match */}
          {faceMatchPass === false && (
            <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 rounded-xl px-3 py-2 mb-4">
              <ShieldCheck size={14} className="text-amber-300 flex-shrink-0" />
              <p className="text-xs text-amber-200">
                Wajah tidak cocok (skor {faceMatchScore?.toFixed(2) ?? '-'})
              </p>
            </div>
          )}
          
          {photo && (
            <div className="mb-10 rounded-3xl overflow-hidden border-4 border-white/20 w-56 h-56 shadow-2xl">
              <img src={photo} alt="Bukti absen" className="w-full h-full object-cover" />
            </div>
          )}

          <Button 
            className="w-full max-w-sm h-14 bg-yellow-400 hover:bg-yellow-500 text-teal-950 font-bold rounded-2xl text-lg shadow-xl"
            onClick={async () => {
              const now = new Date();

              // Grace period check: jika check-out setelah GRACE_END_HOUR → tanya konfirmasi
              const totalMin = now.getHours() * 60 + now.getMinutes();
              if (isCheckOut && totalMin > GRACE_END_TOTAL_MIN) {
                setShowForgotConfirm(true);
                return;
              }

              await handleSuccessConfirm();
              navigate('/dashboard');
            }}
          >
            Selesai
          </Button>
        </div>
      )}
    </div>
  );
}
