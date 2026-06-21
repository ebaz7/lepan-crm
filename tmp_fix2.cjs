const fs = require('fs');
let file = './components/TradeModule.tsx';
let txt = fs.readFileSync(file, 'utf8');

const regex = /{selectedTrancheForDeliveries && \(\(\) => \{[\s\S]*?\n\s*\}\)\(\)\}/sm;

txt = txt.replace(regex, '{renderTrancheDeliveriesModal()}');
fs.writeFileSync(file, txt, 'utf8');
console.log('Fixed TradeModule modal invocation.');
