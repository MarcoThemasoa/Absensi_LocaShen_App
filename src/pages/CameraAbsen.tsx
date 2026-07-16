import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Webcam from 'react-webcam';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { ArrowLeft, CheckCircle2, ScanFace, MapPinned, XCircle, Loader2, Clock, AlertCircle } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { mockLocations } from '../lib/mockData';
import { useAuth } from '../context/AuthContext';
import { CheckInRequiredDialog } from '../components/CheckInRequiredDialog';
import { toast } from 'sonner';

export default function CameraAbsen() {
  const { user, todayAttendance, recordCheckIn, recordCheckOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const webcamRef = useRef<Webcam>(null);
  
  const isCheckOut = new URLSearchParams(location.search).get('type') === 'keluar';
  const [showCheckInDialog, setShowCheckInDialog] = useState(false);

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

  // Check if trying to check-out without check-in
  useEffect(() => {
    if (isCheckOut && !todayAttendance?.checkInTime) {
      setShowCheckInDialog(true);
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

  const [distanceInfo, setDistanceInfo] = useState<number | null>(null);

  useEffect(() => {
    let slowTimer;
    if (step === 'location' && gpsLoading) {
      slowTimer = setTimeout(() => {
        setGpsSlow(true);
      }, 5000);
    }
    return () => clearTimeout(slowTimer);
  }, [step, gpsLoading]);

  useEffect(() => {
    if (step === 'location') {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            
            let isAnyInRange = false;
            let closestDist = Infinity;

            const assignedLoc = mockLocations.find(l => l.id === user?.locationId);
            if (assignedLoc) {
              const R = 6371e3;
              const lat1 = userLat * Math.PI/180;
              const lat2 = assignedLoc.lat * Math.PI/180;
              const dLat = (assignedLoc.lat - userLat) * Math.PI/180;
              const dLng = (assignedLoc.lng - userLng) * Math.PI/180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              closestDist = R * c;
              isAnyInRange = closestDist <= assignedLoc.radius;
            } else {
              isAnyInRange = false;
            }

            setDistanceInfo(Math.round(closestDist));
            setInRange(isAnyInRange);
            setGpsLoading(false);
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

  const handleSuccessConfirm = () => {
    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAttendanceTime(timeString);

    if (isCheckOut) {
      recordCheckOut(timeString);
      toast.success('Absen keluar tercatat');
    } else {
      // Check if late (after 08:00)
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const isLateTime = hours > 8 || (hours === 8 && minutes > 0);
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
          <div className="absolute inset-0 border-[40px] md:border-[80px] border-black/60 rounded-[120px] pointer-events-none z-10 transition-all duration-500"></div>
          
          <div className="absolute bottom-12 left-0 right-0 px-6 text-center z-20">
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
                className="w-full bg-teal-600 hover:bg-teal-500 rounded-2xl font-bold h-14 text-lg"
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
                  <p className="text-gray-500 text-sm mb-8">{`Anda berada di radius ${mockLocations.find(l => l.id === user?.locationId)?.name || 'Kantor Pusat'}`}</p>
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
            onClick={() => {
              handleSuccessConfirm();
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

  const [distanceInfo, setDistanceInfo] = useState<number | null>(null);

  useEffect(() => {
    let slowTimer;
    if (step === 'location' && gpsLoading) {
      slowTimer = setTimeout(() => {
        setGpsSlow(true);
      }, 5000);
    }
    return () => clearTimeout(slowTimer);
  }, [step, gpsLoading]);

  useEffect(() => {
    if (step === 'location') {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            
            let isAnyInRange = false;
            let closestDist = Infinity;

            const assignedLoc = mockLocations.find(l => l.id === user?.locationId);
            if (assignedLoc) {
              const R = 6371e3;
              const lat1 = userLat * Math.PI/180;
              const lat2 = assignedLoc.lat * Math.PI/180;
              const dLat = (assignedLoc.lat - userLat) * Math.PI/180;
              const dLng = (assignedLoc.lng - userLng) * Math.PI/180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              closestDist = R * c;
              isAnyInRange = closestDist <= assignedLoc.radius;
            } else {
              isAnyInRange = false;
            }

            setDistanceInfo(Math.round(closestDist));
            setInRange(isAnyInRange);
            setGpsLoading(false);
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

  const videoConstraints = {
    facingMode: "user"
  };

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
          <div className="absolute inset-0 border-[40px] md:border-[80px] border-black/60 rounded-[120px] pointer-events-none z-10 transition-all duration-500"></div>
          
          <div className="absolute bottom-12 left-0 right-0 px-6 text-center z-20">
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
                className="w-full bg-teal-600 hover:bg-teal-500 rounded-2xl font-bold h-14 text-lg"
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
                  <p className="text-gray-500 text-sm mb-8">{`Anda berada di radius ${mockLocations.find(l => l.id === user?.locationId)?.name || 'Kantor Pusat'}`}</p>
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

      {step === 'success' && (
        <div className="flex-1 bg-gradient-to-br from-teal-900 to-teal-950 text-white p-6 flex flex-col justify-center items-center absolute inset-0 z-40">
          <div className="w-28 h-28 bg-green-500 rounded-full flex items-center justify-center mb-8 animate-bounce shadow-[0_0_40px_rgba(34,197,94,0.4)]">
            <CheckCircle2 size={56} className="text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-3 tracking-wide">Absen Berhasil!</h2>
          <p className="text-teal-100 text-center mb-10 text-lg opacity-90">Tercatat pada pukul <span className="font-bold">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span></p>
          
          {photo && (
            <div className="mb-10 rounded-3xl overflow-hidden border-4 border-white/20 w-56 h-56 shadow-2xl">
              <img src={photo} alt="Bukti absen" className="w-full h-full object-cover" />
            </div>
          )}

          <Button 
            className="w-full max-w-sm h-14 bg-yellow-400 hover:bg-yellow-500 text-teal-950 font-bold rounded-2xl text-lg shadow-xl"
            onClick={() => navigate('/dashboard')}
          >
            Selesai
          </Button>
        </div>
      )}
    </div>
  );
}
