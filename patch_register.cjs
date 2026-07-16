const fs = require('fs');
let code = fs.readFileSync('src/pages/EmployeeRegister.tsx', 'utf8');

const importTarget = `import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';`;

const newImport = `import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { mockLocations } from '../lib/mockData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';`;

code = code.replace(importTarget, newImport);

const stateTarget = `  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);`;

const newState = `  const [name, setName] = useState('');
  const [division, setDivision] = useState('');
  const [age, setAge] = useState('');
  const [locationId, setLocationId] = useState('');
  const [loading, setLoading] = useState(false);`;

code = code.replace(stateTarget, newState);

const formTarget = `          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input 
                id="name" 
                placeholder="Masukkan nama lengkap" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button`;

const newForm = `          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input 
                  id="name" 
                  placeholder="Contoh: Budi Santoso" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="division">Divisi</Label>
                <Input 
                  id="division" 
                  placeholder="Contoh: Marketing" 
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age">Usia</Label>
                <Input 
                  id="age" 
                  type="number"
                  placeholder="Contoh: 25" 
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="location">Cabang</Label>
                <Select value={locationId} onValueChange={setLocationId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Cabang" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockLocations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button`;

code = code.replace(formTarget, newForm);

fs.writeFileSync('src/pages/EmployeeRegister.tsx', code);
console.log("Patched EmployeeRegister.tsx successfully");
