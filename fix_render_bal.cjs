const fs = require('fs');
let code = fs.readFileSync('components/SayanReports.tsx', 'utf8');

const jsxRegex = /runningBalance \+= \(deb - cred\);\s*return \(\s*<tr key=\{idx\} className="hover:bg-slate-50 transition-colors">\s*<td className="px-6 py-3 whitespace-nowrap text-slate-600" dir="ltr">\{formatDate\(\(row\.Date \|\| ''\)\.substring\(0, 10\)\)\}<\/td>\s*<td className="px-6 py-3 whitespace-nowrap font-sans text-slate-800">\{row\.Description \|\| '-'\}<\/td>\s*<td className="px-6 py-3 whitespace-nowrap text-emerald-600" dir="ltr">\{deb > 0 \? deb\.toLocaleString\(\) : '-'\}<\/td>\s*<td className="px-6 py-3 whitespace-nowrap text-rose-600" dir="ltr">\{cred > 0 \? cred\.toLocaleString\(\) : '-'\}<\/td>\s*<td className="px-6 py-3 whitespace-nowrap font-bold text-indigo-700" dir="ltr">\{runningBalance\.toLocaleString\(\)\} \{runningBalance > 0 \? '\(بد\)' : runningBalance < 0 \? '\(بس\)' : ''\}<\/td>\s*<\/tr>/g;

const jsxReplacement = `return (
                                    <tr key={idx} className={\`hover:bg-slate-50 transition-colors \${row.isOpening ? 'bg-slate-100 font-bold' : ''}\`}>
                                        <td className="px-6 py-3 whitespace-nowrap text-slate-600" dir="ltr">{formatDate((row.Date || '').substring(0, 10))}</td>
                                        <td className="px-6 py-3 whitespace-nowrap font-sans text-slate-800">{row.Description || '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-emerald-600" dir="ltr">{deb > 0 ? deb.toLocaleString() : '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap text-rose-600" dir="ltr">{cred > 0 ? cred.toLocaleString() : '-'}</td>
                                        <td className="px-6 py-3 whitespace-nowrap font-bold text-indigo-700" dir="ltr">{Math.abs(row.Balance).toLocaleString()} {row.Balance > 0 ? '(بد)' : row.Balance < 0 ? '(بس)' : ''}</td>
                                    </tr>`;

const htmlRegex = /printRunningBalance \+= \(deb - cred\);\s*return `\s*<tr>\s*<td>\$\{idx \+ 1\}<\/td>\s*<td>\$\{formatDate\(\(row\.Date \|\| ''\)\.substring\(0, 10\)\)\}<\/td>\s*<td>\$\{row\.Description \|\| '-'\}<\/td>\s*<td dir="ltr">\$\{deb > 0 \? deb\.toLocaleString\(\) : '-'\}<\/td>\s*<td dir="ltr">\$\{cred > 0 \? cred\.toLocaleString\(\) : '-'\}<\/td>\s*<td dir="ltr">\$\{printRunningBalance\.toLocaleString\(\)\} \$\{printRunningBalance > 0 \? '\(بد\)' : printRunningBalance < 0 \? '\(بس\)' : ''\}<\/td>\s*<\/tr>\s*`;/g;

const htmlReplacement = `return \`
                              <tr \${row.isOpening ? 'style="background:#f1f5f9;font-weight:bold"' : ''}>
                                  <td>\${idx + 1}</td>
                                  <td>\${formatDate((row.Date || '').substring(0, 10))}</td>
                                  <td>\${row.Description || '-'}</td>
                                  <td dir="ltr">\${deb > 0 ? deb.toLocaleString() : '-'}</td>
                                  <td dir="ltr">\${cred > 0 ? cred.toLocaleString() : '-'}</td>
                                  <td dir="ltr">\${Math.abs(row.Balance).toLocaleString()} \${row.Balance > 0 ? '(بد)' : row.Balance < 0 ? '(بس)' : ''}</td>
                              </tr>
                              \`;`;

if (code.match(jsxRegex)) {
    code = code.replace(jsxRegex, jsxReplacement);
    code = code.replace(htmlRegex, htmlReplacement);
    fs.writeFileSync('components/SayanReports.tsx', code);
    console.log("Replaced UI logic");
} else {
    console.log("Could not match UI logic");
}
