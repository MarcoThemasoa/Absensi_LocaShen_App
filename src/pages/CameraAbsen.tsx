import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Webcam from 'react-webcam';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { ArrowLeft, CheckCircle2, ScanFace, MapPinned, XCircle, Loader2, Clock, AlertCircle } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useAuth } from '../context/AuthContext';
import { getCachedPosition } from '../lib/locationCache';
import { CheckInRequiredDialog } from '../components/CheckInRequiredDialog';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

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
  const [isModelLoading, setIsModelLoading] = useState(false);
  const requestRef = useRef<number | null>(null);
  const lastVideoTime = useRef<number>(-1);
  const [blinkDetected, setBlinkDetected] = useState(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
  const [forgotConfirmed, setForgotConfirmed] = useState(false);

  const SCHEDULE_END_HOUR = 17; // jam kerja selesai 17:00
  const GRACE_END_HOUR = 20;    // grace period sampe 20:00 (3 jam setelah jadwal)
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
    const initFaceLandmarker = async () => {
      try {
        setIsModelLoading(true);
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
        setFaceLandmarker(landmarker);
        setIsModelLoading(false);
      } catch (error) {
        console.error("Error initializing FaceLandmarker", error);
        setIsModelLoading(false);
      }
    };
    initFaceLandmarker();
  }, []);

  const detectBlink = useCallback(async () => {
    if (step !== 'liveness' || !faceLandmarker || !webcamRef.current?.video || blinkDetected) return;

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
               
               // Small delay before moving to success
               setTimeout(() => setStep('success'), 500);
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
  }, [step]);

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
      setTimeout(() => setStep('success'), 1000); 
    }
  };

  const handleSuccessConfirm = (isForgot?: boolean) => {
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
      // Check if late (after 08:00)
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
  };

  const videoConstraints = {
    facingMode: "user"
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
    <div className="absolute inset-0 bg-black text-white flex flex-col z-50 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pt-8 pb-12">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-white/20 backdrop-blur-md">
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-bold text-lg tracking-wide">{isCheckOut ? 'Absen Keluar' : 'Absen Masuk'}</h2>
        <div className="w-10"></div>
      </div>

      {(step === 'face' || step === 'liveness') && (
        <div className="flex-1 relative overflow-hidden bg-black flex flex-col justify-center h-full w-full">
          {/* @ts-ignore react-webcam types issue */}
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Overlay mask for face */}
          <div className="absolute inset-0 border-[16px] md:border-[24px] border-black/60 rounded-[80px] pointer-events-none z-10 transition-all duration-500"></div>
          
          <div className="absolute bottom-20 left-0 right-0 px-6 text-center z-20">
            {step === 'face' && (
              <div className="bg-black/60 p-4 rounded-2xl backdrop-blur-md mb-6 border border-white/10">
                <ScanFace size={36} className="mx-auto mb-3 text-teal-400" />
                <p className="font-medium">Posisikan wajah Anda di dalam bingkai</p>
              </div>
            )}
            {step === 'liveness' && (
              <div className="bg-black/60 p-4 rounded-2xl backdrop-blur-md mb-6 animate-pulse border border-yellow-500/30">
                <p className="font-bold text-yellow-400 text-xl tracking-wide">Kedipkan Mata Anda</p>
                <p className="text-sm mt-2 text-gray-300">Sistem sedang mendeteksi liveness...</p>
              </div>
            )}
            
            {step === 'face' && (
              <Button 
                size="lg" 
                className="w-full bg-teal-600 hover:bg-teal-500 rounded-2xl font-bold h-16 text-xl"
                onClick={handleNextStep}
                disabled={isModelLoading}
              >
                {isModelLoading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat Model...</>
                ) : 'Mulai Pemindaian'}
              </Button>
            )}
          </div>
        </div>
      )}

      {step === 'location' && (
        <div className="flex-1 bg-slate-50 text-gray-900 p-6 flex flex-col justify-center items-center h-full absolute inset-0 z-30">
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
                  <Button onClick={handleNextStep} className="w-full h-14 bg-teal-950 hover:bg-teal-900 rounded-2xl text-lg font-bold">Lanjut ke Kamera</Button>
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
              onClick={() => {
                setForgotConfirmed(false);
                setShowForgotConfirm(false);
                handleSuccessConfirm(false);
              }}
            >
              Tidak (Saya Lembur)
            </Button>
            <Button
              className="rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
              onClick={() => {
                setForgotConfirmed(true);
                setShowForgotConfirm(false);
                handleSuccessConfirm(true);
              }}
            >
              Ya, Saya Lupa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {step === 'success' && (
        <div className="flex-1 bg-gradient-to-br from-teal-900 to-teal-950 text-white p-6 flex flex-col justify-center items-center absolute inset-0 z-40">
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
                <p className="text-teal-200 text-xs mt-1">Masuk: {todayAttendance.checkInTime}</p>
              </div>
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
              const hrs = String(now.getHours()).padStart(2, '0');
              const mins = String(now.getMinutes()).padStart(2, '0');
              const secs = String(now.getSeconds()).padStart(2, '0');
              const timeStr = `${hrs}:${mins}:${secs}`;

              // Grace period check: jika check-out setelah GRACE_END_HOUR → tanya konfirmasi
              const totalMin = now.getHours() * 60 + now.getMinutes();
              if (isCheckOut && totalMin > GRACE_END_TOTAL_MIN) {
                setShowForgotConfirm(true);
                return;
              }

              handleSuccessConfirm();

              // Simpan ke Supabase
              try {
                const today = now.toISOString().split('T')[0];
                if (isCheckOut) {
                  const updateData: Record<string, any> = { time_out: timeStr };
                  if (forgotConfirmed) {
                    updateData.is_forgot_clock_out = true;
                  }
                  await supabase
                    .from('attendance_records')
                    .update(updateData)
                    .eq('user_id', user?.id)
                    .eq('date', today);
                  clearTodayAttendance();
                } else if (user?.id) {
                  const hourNum = now.getHours();
                  const minNum = now.getMinutes();
                  const isLateTime = hourNum > 8 || (hourNum === 8 && minNum > 0);
                  await supabase
                    .from('attendance_records')
                    .insert({
                      user_id: user.id,
                      date: today,
                      time_in: timeStr,
                      status: isLateTime ? 'telat' : 'hadir',
                      location_lat: userLat,
                      location_lng: userLng,
                      photo_url: photo,
                    });
                }
              } catch (e) {
                console.error('Gagal simpan absen ke database:', e);
              }

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
