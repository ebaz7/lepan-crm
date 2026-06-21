const fs = require('fs');
let file = './components/reports/CurrencyReport.tsx';
let txt = fs.readFileSync(file, 'utf8');

const regex = /row\.eachCell\(\(cell\) => \{\s*cell\.border = \{\s*top: \{style: 'thin'\},[\s\S]*?\}\);\n.*?\}\);/m;

const replacement = `row.eachCell((cell) => {
                                cell.border = {
                                    top: {style: 'thin'},
                                    left: {style: 'thin'},
                                    bottom: {style: 'thin'},
                                    right: {style: 'thin'}
                                };
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                                cell.fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: globalIdx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF' } // Zebra striping (slate-50 vs white)
                                };
                            });
                        });`;

if(txt.match(regex)) {
    txt = txt.replace(regex, replacement);
    fs.writeFileSync(file, txt, 'utf8');
    console.log("Excel export zebra striping added.");
} else {
    // maybe it is slightly different
    console.log("Did not match cell styling logic");
}
