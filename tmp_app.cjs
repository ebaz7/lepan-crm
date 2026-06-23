const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const importsTarget = `import { Tickets } from './components/Tickets';
import KnowledgeBaseModule from './components/KnowledgeBaseModule';
import { CustomerBalanceModule } from './components/CustomerBalanceModule';
import CctiConverter from './components/CctiConverter';
import SayanReports from './components/SayanReports';`;

const importsRep = `import { Tickets } from './components/Tickets';
import KnowledgeBaseModule from './components/KnowledgeBaseModule';
import { CustomerBalanceModule } from './components/CustomerBalanceModule';
import CctiConverter from './components/CctiConverter';
import SayanReports from './components/SayanReports';
import SecretariatModule from './components/SecretariatModule';`;

content = content.replace(importsTarget, importsRep);

const tabTarget = `{activeTab === 'purchase' && <div className="page-transition flex flex-col flex-1 min-h-0"><PurchaseModule currentUser={currentUser} settings={settings || undefined} initialTab={purchaseInitialTab} /></div>}`;
const tabRep = `{activeTab === 'purchase' && <div className="page-transition flex flex-col flex-1 min-h-0"><PurchaseModule currentUser={currentUser} settings={settings || undefined} initialTab={purchaseInitialTab} /></div>}
               {activeTab === 'secretariat' && <div className="page-transition flex flex-col flex-1 min-h-0"><SecretariatModule currentUser={currentUser} /></div>}`;

content = content.replace(tabTarget, tabRep);

fs.writeFileSync('App.tsx', content);
