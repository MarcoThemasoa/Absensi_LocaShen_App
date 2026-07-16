const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminReports.tsx', 'utf8');

const exportTarget = `      const reportDate = startOfDay(parseISO(report.date));
      const today = startOfDay(new Date());
      
      if (exportTime === '1hari') {
        if (!isAfter(reportDate, subDays(today, 1))) return false;
      } else if (exportTime === '7hari') {
        if (!isAfter(reportDate, subDays(today, 7))) return false;
      } else if (exportTime === '1bulan') {
        if (!isAfter(reportDate, subMonths(today, 1))) return false;
      }`;

const exportReplacement = `      if (exportStartDate) {
        if (new Date(report.date) < new Date(exportStartDate)) return false;
      }
      if (exportEndDate) {
        const end = new Date(exportEndDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(report.date) > end) return false;
      }`;
code = code.replace(exportTarget, exportReplacement);

const filenameTarget = `const filterName = exportTime === 'semua' ? 'semua' : exportTime;`;
const filenameReplacement = `const filterName = (exportStartDate && exportEndDate) ? \`\${exportStartDate}_to_\${exportEndDate}\` : 'custom';`;
code = code.replace(filenameTarget, filenameReplacement);

fs.writeFileSync('src/pages/AdminReports.tsx', code);
console.log("Patched AdminReports.tsx export logic");
