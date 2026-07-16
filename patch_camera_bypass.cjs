const fs = require('fs');
let code = fs.readFileSync('src/pages/CameraAbsen.tsx', 'utf8');

const targetUI = `{gpsSlow ? 'Sinyal GPS mungkin lemah atau belum diizinkan. Pastikan lokasi perangkat aktif.' : 'Mengakses GPS perangkat Anda'}
                  </p>
                </div>
              ) : inRange ?`;

const replacementUI = `{gpsSlow ? 'Sinyal GPS mungkin lemah atau belum diizinkan. Pastikan lokasi perangkat aktif.' : 'Mengakses GPS perangkat Anda'}
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
              ) : inRange ?`;

if (code.includes('Mengakses GPS perangkat Anda')) {
  code = code.replace(targetUI, replacementUI);
}

const outRangeTarget = `<Button variant="outline" onClick={() => navigate(-1)} className="w-full mt-8 h-14 rounded-2xl font-bold text-lg">Kembali</Button>`;
const outRangeReplacement = `<Button onClick={() => setInRange(true)} className="w-full mt-4 h-14 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-lg">Bypass (Mode Demo)</Button>
                  <Button variant="outline" onClick={() => navigate(-1)} className="w-full mt-3 h-14 rounded-2xl font-bold text-lg border-gray-200">Kembali</Button>`;

if (code.includes('Kembali</Button>')) {
  code = code.replace(outRangeTarget, outRangeReplacement);
}

fs.writeFileSync('src/pages/CameraAbsen.tsx', code);
console.log('Patched CameraAbsen.tsx for bypass');
