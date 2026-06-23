const fs = require('fs');
let content = fs.readFileSync('components/PrintExitPermit.tsx', 'utf8');

const stampTarget = `  const Stamp = ({ title, name, date, time, isSecurity }: { title: string, name: string, date?: string, time?: string, isSecurity?: boolean }) => (
      <div className={\`border-2 \${isSecurity ? 'border-black text-black' : 'border-blue-800 text-blue-800'} rounded-xl p-2 rotate-[-5deg] opacity-90 inline-block glass-panel/80 print:bg-transparent shadow-sm min-w-[90px]\`}>
          <div className="text-[10px] font-bold border-b border-current mb-1 pb-1 text-center">{title}</div>
          <div className="text-sm font-black text-center px-2">{name}</div>
          {date && <div className="text-[10px] text-center mt-1">{date}</div>}
          {time && (
              <div className="mt-2 border-t border-dashed border-gray-400 pt-1">
                  <div className="text-[9px] font-bold text-center">ساعت خروج:</div>
                  <div className="text-2xl font-black text-center font-mono">{time}</div>
              </div>
          )}
      </div>
  );`;

const stampRep = `  const Stamp = ({ title, name, date, time, isSecurity }: { title: string, name: string, date?: string, time?: string, isSecurity?: boolean }) => {
      const dbUser = staffUsers.find(u => u.fullName === name || u.username === name);
      const signature = dbUser?.signatureBase64;
      return (
      <div className={\`border-2 \${isSecurity ? 'border-black text-black' : 'border-blue-800 text-blue-800'} rounded-xl p-2 rotate-[-5deg] opacity-90 inline-block glass-panel/80 print:bg-transparent shadow-sm min-w-[90px]\`}>
          <div className="text-[10px] font-bold border-b border-current mb-0.5 pb-0.5 text-center">{title}</div>
          {signature ? (
             <img src={signature} className="h-10 mx-auto object-contain mix-blend-multiply" alt={name} />
          ) : (
             <div className="text-sm font-black text-center px-2">{name}</div>
          )}
          {date && <div className="text-[10px] text-center mt-0.5">{date}</div>}
          {time && (
              <div className="mt-1 border-t border-dashed border-gray-400 pt-1">
                  <div className="text-[9px] font-bold text-center">ساعت خروج:</div>
                  <div className="text-2xl font-black text-center font-mono">{time}</div>
              </div>
          )}
      </div>
      );
  };`;

content = content.replace(stampTarget.replace(/\r\n/g, '\\n'), stampRep);
content = content.replace(stampTarget, stampRep);
fs.writeFileSync('components/PrintExitPermit.tsx', content);
