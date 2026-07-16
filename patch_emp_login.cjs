const fs = require('fs');
let code = fs.readFileSync('src/pages/EmployeeLogin.tsx', 'utf8');

const stateTarget = `  const [id, setId] = useState('');
  const [loading, setLoading] = useState(false);`;
const stateReplacement = `  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);`;
code = code.replace(stateTarget, stateReplacement);

const loginTarget = `await login(id, 'employee');`;
const loginReplacement = `await login(id, password, 'employee');`;
code = code.replace(loginTarget, loginReplacement);

const formTarget = `            <div className="space-y-2">
              <Label htmlFor="employeeId">ID Karyawan</Label>
              <Input 
                id="employeeId" 
                placeholder="Masukkan ID" 
                value={id}
                onChange={(e) => setId(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2 mt-1">
                <button type="button" onClick={() => setId('1')} className="text-xs text-teal-600 font-medium hover:underline">Demo Budi (1)</button>
                <button type="button" onClick={() => setId('3')} className="text-xs text-teal-600 font-medium hover:underline">Demo Agus (3)</button>
              </div>
            </div>`;
const formReplacement = `            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="employeeId">ID Karyawan / Email</Label>
                <Input 
                  id="employeeId" 
                  placeholder="Masukkan ID / Email" 
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
              <div className="flex justify-end gap-2 mt-1">
                <button type="button" onClick={() => { setId('1'); setPassword('password123'); }} className="text-xs text-teal-600 font-medium hover:underline">Demo Budi (1)</button>
                <button type="button" onClick={() => { setId('3'); setPassword('password123'); }} className="text-xs text-teal-600 font-medium hover:underline">Demo Agus (3)</button>
              </div>
            </div>`;
code = code.replace(formTarget, formReplacement);

fs.writeFileSync('src/pages/EmployeeLogin.tsx', code);
console.log("Patched EmployeeLogin.tsx");
