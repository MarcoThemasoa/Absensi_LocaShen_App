const fs = require('fs');
let code = fs.readFileSync('src/pages/CameraAbsen.tsx', 'utf8');

// Add gpsSlow state
if (!code.includes("gpsSlow")) {
  code = code.replace(
    "const [gpsLoading, setGpsLoading] = useState(true);",
    "const [gpsLoading, setGpsLoading] = useState(true);\n  const [gpsSlow, setGpsSlow] = useState(false);"
  );
  
  // Add useEffect for gpsSlow
  const useEffectLoc = "const [distanceInfo, setDistanceInfo] = useState<number | null>(null);";
  const newUseEffectLoc = `const [distanceInfo, setDistanceInfo] = useState<number | null>(null);

  useEffect(() => {
    let slowTimer;
    if (step === 'location' && gpsLoading) {
      slowTimer = setTimeout(() => {
        setGpsSlow(true);
      }, 5000);
    }
    return () => clearTimeout(slowTimer);
  }, [step, gpsLoading]);`;
  
  code = code.replace(useEffectLoc, newUseEffectLoc);
}

// Modify loading UI
const loadingUI = `{gpsLoading ? (
                <div className="flex flex-col items-center animate-pulse">
                  <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-6">
                    <MapPinned size={40} className="text-teal-600" />
                  </div>
                  <h3 className="font-bold text-xl mb-2">Mencari Lokasi...</h3>
                  <p className="text-gray-500 text-sm">Mengakses GPS perangkat Anda</p>
                </div>
              )`;
              
const newLoadingUI = `{gpsLoading ? (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center mb-6 relative">
                    <MapPinned size={40} className="text-teal-600 animate-bounce" />
                    <div className="absolute inset-0 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                  </div>
                  <h3 className="font-bold text-xl mb-2">{gpsSlow ? 'Membutuhkan waktu...' : 'Mencari Lokasi...'}</h3>
                  <p className="text-gray-500 text-sm px-4 text-center">
                    {gpsSlow ? 'Sinyal GPS mungkin lemah atau belum diizinkan. Pastikan lokasi perangkat aktif.' : 'Mengakses GPS perangkat Anda'}
                  </p>
                </div>
              )`;

if (code.includes('Mencari Lokasi...')) {
  code = code.replace(loadingUI, newLoadingUI);
}

fs.writeFileSync('src/pages/CameraAbsen.tsx', code);
console.log('Patched CameraAbsen.tsx for GPS loading UX');
