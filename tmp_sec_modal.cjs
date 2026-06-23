const fs = require('fs');
let s = fs.readFileSync('components/SecretariatModule.tsx', 'utf8');

const importTgt = `import PrintLetter from './print/PrintLetter';
import { apiCall } from '../services/apiService';`;
const importRep = `import PrintLetter from './print/PrintLetter';
import { apiCall } from '../services/apiService';
import CreateLetterModal from './secretariat/CreateLetterModal';
import LetterViewModal from './secretariat/LetterViewModal';`;
s = s.replace(importTgt, importRep);

const returnTgt = `    return (
        <div className="space-y-6 animate-fade-in pb-20">`;
const returnRep = `    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {isCreating && <CreateLetterModal currentUser={currentUser} settings={settings} allUsers={users} onClose={() => setIsCreating(false)} onSuccess={() => { setIsCreating(false); getLetters().then(setLetters); }} />}
            {viewingLetter && <LetterViewModal letter={viewingLetter} currentUser={currentUser} settings={settings} onClose={() => setViewingLetter(null)} onUpdate={() => getLetters().then(setLetters)} />}`;
s = s.replace(returnTgt, returnRep);

fs.writeFileSync('components/SecretariatModule.tsx', s);
