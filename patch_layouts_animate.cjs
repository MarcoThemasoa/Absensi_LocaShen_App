const fs = require('fs');

// Patch EmployeeLayout
let emp = fs.readFileSync('src/layouts/EmployeeLayout.tsx', 'utf8');
emp = emp.replace("import { Outlet, Navigate, useLocation } from 'react-router-dom';", "import { Outlet, Navigate, useLocation, useOutlet } from 'react-router-dom';");
emp = emp.replace("import { AnimatePresence } from 'motion/react';", ""); // just in case
emp = emp.replace("import { Clock, History, UserCircle, Home } from 'lucide-react';\nimport { motion } from 'motion/react';", "import { Clock, History, UserCircle, Home } from 'lucide-react';\nimport { motion, AnimatePresence } from 'motion/react';\nimport React from 'react';");

emp = emp.replace("const { user } = useAuth();", "const { user } = useAuth();\n  const outlet = useOutlet();");

emp = emp.replace(
  "<Outlet />",
  `<AnimatePresence mode="wait">
            {outlet && React.cloneElement(outlet, { key: location.pathname })}
          </AnimatePresence>`
);
fs.writeFileSync('src/layouts/EmployeeLayout.tsx', emp);

// Patch AdminLayout
let adm = fs.readFileSync('src/layouts/AdminLayout.tsx', 'utf8');
adm = adm.replace("import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';", "import { Outlet, Navigate, Link, useLocation, useOutlet } from 'react-router-dom';");
adm = adm.replace("import { LayoutDashboard, Users, MapPin, FileSpreadsheet, UserCircle, Activity } from 'lucide-react';\nimport { motion } from 'motion/react';", "import { LayoutDashboard, Users, MapPin, FileSpreadsheet, UserCircle, Activity } from 'lucide-react';\nimport { motion, AnimatePresence } from 'motion/react';\nimport React from 'react';");

adm = adm.replace("const { user } = useAuth();", "const { user } = useAuth();\n  const outlet = useOutlet();");

adm = adm.replace(
  "<Outlet />",
  `<AnimatePresence mode="wait">
            {outlet && React.cloneElement(outlet, { key: location.pathname })}
          </AnimatePresence>`
);
fs.writeFileSync('src/layouts/AdminLayout.tsx', adm);

console.log("Patched layouts for AnimatePresence");
