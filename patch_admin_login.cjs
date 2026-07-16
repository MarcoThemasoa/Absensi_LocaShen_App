const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminLogin.tsx', 'utf8');

const stateTarget = `  const [id, setId] = useState('');
  const [loading, setLoading] = useState(false);`;
const stateReplacement = `  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);`;
code = code.replace(stateTarget, stateReplacement);

const loginTarget = `await login(id, 'admin');`;
const loginReplacement = `await login(id, password, 'admin');`;
code = code.replace(loginTarget, loginReplacement);

const formTarget = `            <div className="space-y-2">
              <Label htmlFor="adminId">Admin ID</Label>
              <Input 
                id="adminId" 
                placeholder="Masukkan ID Admin" 
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
              />
              <div className="flex justify-end mt-1">
                <button type="button" onClick={() => setId('admin1')} className="text-xs text-teal-600 font-medium hover:underline">Gunakan Demo (admin1)</button>
              </div>
            </div>`;
const formReplacement = `            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="adminId">Admin ID / Email</Label>
                <Input 
                  id="adminId" 
                  placeholder="Masukkan ID Admin / Email" 
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password"
                  placeholder="Masukkan Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end mt-1">
                <button type="button" onClick={() => { setId('admin1'); setPassword('admin123'); }} className="text-xs text-teal-600 font-medium hover:underline">Gunakan Demo (admin1)</button>
              </div>
            </div>`;
code = code.replace(formTarget, formReplacement);

fs.writeFileSync('src/pages/AdminLogin.tsx', code);
console.log("Patched AdminLogin.tsx");
