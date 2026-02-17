    // --- True File Sharing ---
    const handleNativeShare = async (msg: ChatMessage) => {
        const fileUrl = msg.attachment?.url || msg.audioUrl;
        if (!fileUrl) return;

        // Try to fetch blob for file sharing
        try {
            // Need absolute URL for fetch if it's relative
            const fetchUrl = fileUrl.startsWith('http') ? fileUrl : `${window.location.origin}${fileUrl}`;
            
            const response = await fetch(fetchUrl);
            const blob = await response.blob();
            
            const fileName = msg.attachment?.fileName || `file_${Date.now()}.${blob.type.split('/')[1] || 'bin'}`;
            const file = new File([blob], fileName, { type: blob.type });

            // Check if can share files
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'اشتراک‌گذاری',
                    text: msg.message || 'فایل ارسال شده'
                });
            } else {
                throw new Error("Cannot share file directly");
            }

        } catch (error: any) {
            console.log("File sharing failed, falling back to link share:", error);
            // Fallback to Link Share
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'اشتراک‌گذاری فایل',
                        text: `فایل ارسالی از طرف ${msg.sender}`,
                        url: fileUrl.startsWith('http') ? fileUrl : `${window.location.origin}${fileUrl}`
                    });
                } catch(e: any) { console.log('Link share failed', e); }
            } else {
                // Last resort: Open in new tab
                window.open(fileUrl, '_blank');
            }
        }
    };