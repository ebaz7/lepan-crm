const fs = require('fs');
let content = fs.readFileSync('components/ManageExitPermits.tsx', 'utf8');

// 1. Add handleManualResend
const handleManualTarget = `    const sendCancellationNotification = async (permit: ExitPermit, prevStatus: ExitPermitStatus, reason: string) => {`;
const handleManualReplacement = `    const handleManualResend = async (p: ExitPermit) => {
        if(!confirm('آیا قصد ارسال مجدد پیام ربات به گروه‌ها برای این مرحله را دارید؟')) return;
        setProcessingId(p.id);
        setActiveAutoSends(prev => [...prev, p]);
        
        let prevStatus: any = p.status;
        if (p.status === ExitPermitStatus.PENDING_CEO) prevStatus = 'CREATE';
        else if (p.status === ExitPermitStatus.PENDING_FACTORY) prevStatus = ExitPermitStatus.PENDING_CEO;
        else if (p.status === ExitPermitStatus.PENDING_WAREHOUSE) prevStatus = ExitPermitStatus.PENDING_FACTORY;
        else if (p.status === ExitPermitStatus.PENDING_SECURITY) prevStatus = ExitPermitStatus.PENDING_WAREHOUSE;
        else if (p.status === ExitPermitStatus.PENDING_FACTORY_FINAL) prevStatus = ExitPermitStatus.PENDING_SECURITY;
        else if (p.status === ExitPermitStatus.EXITED) prevStatus = ExitPermitStatus.PENDING_FACTORY_FINAL;
        
        setTimeout(async () => {
            await sendNotification(p, prevStatus);
            setProcessingId(null);
            setActiveAutoSends(prev => prev.filter(x => x.id !== p.id));
            alert('درخواست ارسال دستی به ربات‌ها ارسال شد.');
        }, 2500);
    };

    const sendCancellationNotification = async (permit: ExitPermit, prevStatus: ExitPermitStatus, reason: string) => {`;

content = content.replace(handleManualTarget, handleManualReplacement);


// 2. modify sendNotification check for CREATE
const sendNotifTarget1 = `const g1StatusArray = settings?.exitPermitFirstGroupConfig?.activeStatuses || [];
            const isG1Active = g1StatusArray.includes(configOptionStr1) || g1StatusArray.includes(fallbackOptionStr);
            
            const g2StatusArray = settings?.exitPermitSecondGroupConfig?.activeStatuses || [];
            const isG2Active = g2StatusArray.includes(configOptionStr1) || g2StatusArray.includes(fallbackOptionStr);`;

const sendNotifRep1 = `const g1StatusArray = settings?.exitPermitFirstGroupConfig?.activeStatuses || [];
            const isG1Active = g1StatusArray.includes(configOptionStr1) || g1StatusArray.includes(fallbackOptionStr) || (prevStatus === 'CREATE' && g1StatusArray.includes('CREATE'));
            
            const g2StatusArray = settings?.exitPermitSecondGroupConfig?.activeStatuses || [];
            const isG2Active = g2StatusArray.includes(configOptionStr1) || g2StatusArray.includes(fallbackOptionStr) || (prevStatus === 'CREATE' && g2StatusArray.includes('CREATE'));`;

content = content.replace(sendNotifTarget1.replace(/\r\n/g, '\\n'), sendNotifRep1);
content = content.replace(sendNotifTarget1, sendNotifRep1);

// 3. Add CREATE to Caption
const sendNotifTarget2 = `let captionTitle = '';
            if (prevStatus === ExitPermitStatus.PENDING_CEO) {`;
const sendNotifRep2 = `let captionTitle = '';
            if (prevStatus === 'CREATE') {
                captionTitle = 'در انتظار بررسی و تایید مدیرعامل';
            } else if (prevStatus === ExitPermitStatus.PENDING_CEO) {`;

content = content.replace(sendNotifTarget2.replace(/\r\n/g, '\\n'), sendNotifRep2);
content = content.replace(sendNotifTarget2, sendNotifRep2);

fs.writeFileSync('components/ManageExitPermits.tsx', content);
