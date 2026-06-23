const fs = require('fs');
let txt = fs.readFileSync('./components/TradeModule.tsx', 'utf8');

const target = /<CurrencyReport\s*records=\{/;
const repl = `<CurrencyReport 
                        onUpdateRecord={updateTradeRecord}
                        records={`;
txt = txt.replace(target, repl);

fs.writeFileSync('./components/TradeModule.tsx', txt, 'utf8');
console.log("Updated TradeModule to inject onUpdateRecord prop.");
