const fs = require('fs');
let txt = fs.readFileSync('./components/TradeModule.tsx', 'utf8');

const exportIdx = txt.indexOf('export default TradeModule;');
if (exportIdx !== -1) {
    const validTxt = txt.substring(0, exportIdx + 'export default TradeModule;'.length);
    fs.writeFileSync('./components/TradeModule.tsx', validTxt, 'utf8');
    console.log("Stripped garbage after export default.");
} else {
    console.log("export default not found!");
}
