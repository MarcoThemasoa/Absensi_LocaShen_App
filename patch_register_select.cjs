const fs = require('fs');
let code = fs.readFileSync('src/pages/EmployeeRegister.tsx', 'utf8');

const importTarget = `import { mockLocations } from '../lib/mockData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';`;

const newImport = `import { mockLocations } from '../lib/mockData';`;

code = code.replace(importTarget, newImport);

const formTarget = `<Select value={locationId} onValueChange={setLocationId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Cabang" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockLocations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>`;

const newForm = `<select
                  id="location"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>Pilih Cabang</option>
                  {mockLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>`;

code = code.replace(formTarget, newForm);

fs.writeFileSync('src/pages/EmployeeRegister.tsx', code);
console.log("Patched EmployeeRegister.tsx successfully");
