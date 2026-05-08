
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChatMessage, ChatGroup, GroupTask, UserRole } from '../types';
import { sendMessage, deleteMessage, getGroups, createGroup, updateGroup, deleteGroup, getTasks, createTask, updateTask, deleteTask, uploadFile, updateMessage } from '../services/storageService';
import { getUsers } from '../services/authService';
import { generateUUID, formatDate } from '../constants';
import { 
    Send, User as UserIcon, MessageSquare, Users, Plus, ListTodo, Paperclip, 
    CheckSquare, Square, X, Trash2, Reply, Edit2, ArrowRight, Mic, 
    Play, Pause, Loader2, Search, MoreVertical, File, Image as ImageIcon,
    Check, CheckCheck, DownloadCloud, StopCircle, Share2, Copy, Forward, Eye, CornerUpLeft, Bell,
    Shield, UserMinus, UserPlus, BellOff, Camera
} from 'lucide-react';
import { sendNotification } from '../services/notificationService';

interface ChatRoomProps { 
    currentUser: User; 
    preloadedMessages: ChatMessage[]; 
    onRefresh: () => void; 
}

type TabType = 'CHATS' | 'GROUPS' | 'TASKS';

interface ChannelItem {
    type: 'public' | 'private' | 'group';
    id: string;
    name: string;
    avatar: string | null;
    isOnline: boolean;
    lastSeen?: number;
    lastMsg: ChatMessage | null;
    unread: number;
}

const AudioPlayer: React.FC<{ url: string; isMe: boolean; duration?: number }> = ({ url, isMe, duration: propDuration }) => {
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(propDuration || 0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    
    // Generate random waveform bars (stable per instance)
    const waveform = useMemo(() => Array.from({ length: 25 }, () => Math.floor(Math.random() * 60) + 20), []);

    useEffect(() => {
        let absoluteUrl = url;
        // Fix for Desktop: Ensure URL is absolute if it's a relative path from server
        if (!url.startsWith('http') && !url.startsWith('blob')) {
            // Remove leading slash if present to avoid double slash, then add base
            const cleanPath = url.startsWith('/') ? url : `/${url}`;
            absoluteUrl = `${window.location.origin}${cleanPath}`;
        }
        
        const audio = new Audio();
        audio.src = absoluteUrl;
        audioRef.current = audio;
        
        audio.onloadedmetadata = () => {
            const d = audio.duration;
            if (d && d !== Infinity && !isNaN(d)) {
                setDuration(d);
            }
        };
        audio.ontimeupdate = () => {
            if (audio.duration && audio.duration !== Infinity) {
                setProgress((audio.currentTime / audio.duration) * 100);
            } else if (duration > 0) {
                 setProgress((audio.currentTime / duration) * 100);
            }
        };
        audio.onended = () => { setPlaying(false); setProgress(0); };
        
        return () => {
            audio.pause();
            audio.src = '';
        };
    }, [url, duration]);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (playing) audioRef.current.pause();
        else audioRef.current.play();
        setPlaying(!playing);
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00';
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className="flex items-center gap-3 flex-1 px-1">
            <button 
                onClick={togglePlay}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform active:scale-90 shadow-sm ${isMe ? 'bg-green-600' : 'bg-blue-600'}`}
            >
                {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
            </button>
            
            {/* Waveform Visualization */}
            <div className="flex items-center gap-[2px] h-8 flex-1 mx-2" dir="ltr">
                {waveform.map((height, i) => {
                    const barPercent = (i / waveform.length) * 100;
                    const isPlayed = barPercent <= progress;
                    return (
                        <div 
                            key={i}
                            className={`w-[3px] rounded-full transition-colors duration-200 ${isPlayed ? (isMe ? 'bg-green-700' : 'bg-blue-700') : (isMe ? 'bg-green-300/50' : 'bg-blue-300/50')}`}
                            style={{ height: `${height}%` }}
                        />
                    );
                })}
            </div>

            <span className="text-[10px] font-mono opacity-80 min-w-[35px] text-right">
                {playing ? formatTime(audioRef.current?.currentTime || 0) : formatTime(duration)}
            </span>
        </div>
    );
};

const ChatRoom: React.FC<ChatRoomProps> = ({ currentUser, preloadedMessages, onRefresh }) => {
    // --- Data State ---
    const [messages, setMessages] = useState<ChatMessage[]>(preloadedMessages || []);
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<ChatGroup[]>([]);
    const [tasks, setTasks] = useState<GroupTask[]>([]);
    
    // --- UI State ---
    const [activeTab, setActiveTab] = useState<TabType>('CHATS');
    const [activeChannel, setActiveChannel] = useState<{type: 'public' | 'private' | 'group', id: string | null} | null>(null);
    const [searchTerm, setSearchTerm] = useState(''); // Main List Search
    const [innerSearchTerm, setInnerSearchTerm] = useState(''); // Inside Chat Search
    const [showInnerSearch, setShowInnerSearch] = useState(false);
    
    // --- File Progress & Management ---
    const [fileProgress, setFileProgress] = useState<{ [key: string]: number }>({});
    const [showGroupInfo, setShowGroupInfo] = useState<ChatGroup | null>(null);
    const [showContactInfo, setShowContactInfo] = useState<User | null>(null);
    const [isDownloading, setIsDownloading] = useState<{ [key: string]: boolean }>({});
    
    // --- Selection & Actions ---
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [forwardNoQuote, setForwardNoQuote] = useState(false);
    const [showImageViewer, setShowImageViewer] = useState<string | null>(null);
    const [contextMenuMsg, setContextMenuMsg] = useState<{msg: ChatMessage, x: number, y: number} | null>(null);

    // --- Input & Recording ---
    const [inputText, setInputText] = useState('');
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<any>(null);
    const recordedMimeTypeRef = useRef<string>('');
    const recordingStartTimeRef = useRef<number>(0);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // --- Refs ---
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const inputAreaRef = useRef<HTMLTextAreaElement>(null);

    // --- Modals ---
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [mutedChannels, setMutedChannels] = useState<Set<string>>(new Set());
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);

    // --- Effects ---
    useEffect(() => { if (preloadedMessages) setMessages(preloadedMessages); }, [preloadedMessages]);

    useEffect(() => { 
        loadMeta();
        const interval = setInterval(loadMeta, 5000); 
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // Auto scroll with timeout to ensure rendering is done (Fix for Desktop)
        if (activeChannel && !showInnerSearch) {
            // Immediate scroll for better UX
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
            }
            // Follow up with smooth scroll to catch any layout shifts
            setTimeout(scrollToBottom, 150); 
        }
    }, [activeChannel, messages.length]);

    // Handle Mobile Back Button Logic (Browser History)
    useEffect(() => {
        if (activeChannel) {
            // Push a state so "Back" button closes chat instead of exiting app
            const state = { chatOpen: true };
            window.history.pushState(state, '', window.location.pathname + '#chat');
            
            const handlePopState = (event: PopStateEvent) => {
                if (!event.state?.chatOpen) {
                    setActiveChannel(null);
                }
            };

            window.addEventListener('popstate', handlePopState);
            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    }, [activeChannel]);

    // Handle Document Visibility for Notifications
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) return;
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // Notification Trigger
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            const channelId = lastMsg.groupId || lastMsg.senderUsername;
            
            if (lastMsg.senderUsername !== currentUser.username && document.hidden && !mutedChannels.has(channelId)) {
                let title = lastMsg.sender;
                if (lastMsg.groupId) {
                    const grp = groups.find(g => g.id === lastMsg.groupId);
                    if (grp) title = `${lastMsg.sender} @ ${grp.name}`;
                }
                sendNotification(title, lastMsg.message || 'پیام جدید');
            }
        }
    }, [messages.length, mutedChannels]);

    const loadMeta = async () => {
        try {
            const usrList = await getUsers();
            setUsers(usrList.filter(u => u.username !== currentUser.username));
            
            const grpList = await getGroups();
            const isManager = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CEO].includes(currentUser.role as UserRole);
            const visibleGroups = grpList.filter(g => isManager || g.members.includes(currentUser.username) || g.createdBy === currentUser.username);
            setGroups(visibleGroups);
            
            const tskList = await getTasks();
            setTasks(tskList);
        } catch (e) { console.error("Chat load error", e); }
    };

    const formatLastSeen = (timestamp: number | undefined) => {
        if (!timestamp) return 'نامشخص';
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'همین الان';
        if (diff < 3600000) return `لحظاتی پیش (${Math.floor(diff/60000)} دقیقه)`;
        
        const date = new Date(timestamp);
        if (diff < 86400000) {
            return `امروز ساعت ${date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
        }
        
        // Over 24 hours: Shamsi Date + Time
        const shamsiDate = date.toLocaleDateString('fa-IR-u-nu-latn');
        const shamsiTime = date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        return `${shamsiDate} ساعت ${shamsiTime}`;
    };

    // --- Helpers ---
    const getUnreadCount = (channelId: string, type: 'private' | 'group' | 'public') => {
        return messages.filter(m => {
            if (m.senderUsername === currentUser.username) return false;
            const isRead = m.readBy?.includes(currentUser.username);
            if (isRead) return false;
            
            if (type === 'private') {
                return (m.senderUsername === channelId && m.recipient === currentUser.username);
            } else if (type === 'group') {
                return m.groupId === channelId;
            }
            return false;
        }).length;
    };

    const getLastMessage = (channelId: string, type: 'private' | 'group' | 'public') => {
        const relevant = messages.filter(m => {
            if (type === 'public') return !m.recipient && !m.groupId;
            if (type === 'private') return (m.senderUsername === channelId && m.recipient === currentUser.username) || (m.senderUsername === currentUser.username && m.recipient === channelId);
            if (type === 'group') return m.groupId === channelId;
            return false;
        });
        return relevant.length > 0 ? relevant[relevant.length - 1] : null;
    };

    const markAsRead = async (channelId: string, type: 'private' | 'group' | 'public') => {
        const unreadMsgs = messages.filter(m => {
            if (m.senderUsername === currentUser.username) return false;
            if (m.readBy?.includes(currentUser.username)) return false;
            
            if (type === 'public') return !m.recipient && !m.groupId;
            if (type === 'private') return (m.senderUsername === channelId && m.recipient === currentUser.username);
            if (type === 'group') return m.groupId === channelId;
            return false;
        });

        if (unreadMsgs.length > 0) {
            const updatedIds = new Set(unreadMsgs.map(m => m.id));
            setMessages(prev => prev.map(m => updatedIds.has(m.id) ? { ...m, readBy: [...(m.readBy || []), currentUser.username] } : m));
            
            for (const msg of unreadMsgs) {
                const reads = msg.readBy || [];
                if (!reads.includes(currentUser.username)) {
                    await updateMessage({ ...msg, readBy: [...reads, currentUser.username] });
                }
            }
        }
    };

    // --- Render Logic ---
    const getAllChannelsForForward = (): ChannelItem[] => {
        const list: ChannelItem[] = [];
        
        list.push({ type: 'public', id: 'public', name: 'کانال عمومی', avatar: null, isOnline: true, lastMsg: null, unread: 0 });
        
        users.forEach(u => {
            list.push({ type: 'private', id: u.username, name: u.fullName, avatar: u.avatar || null, isOnline: false, lastMsg: null, unread: 0 });
        });
        
        groups.forEach(g => {
            list.push({ type: 'group', id: g.id, name: g.name, avatar: null, isOnline: false, lastMsg: null, unread: 0 });
        });
        
        return list;
    };

    const getSortedChannels = (): ChannelItem[] => {
        const list: ChannelItem[] = [];

        if (activeTab === 'CHATS') {
            const lastPub = getLastMessage('public', 'public');
            list.push({
                type: 'public', id: 'public', name: 'کانال عمومی', 
                avatar: null, isOnline: true, 
                lastMsg: lastPub, unread: getUnreadCount('public', 'public')
            });

            users.forEach(u => {
                const last = getLastMessage(u.username, 'private');
                const isOnline = u.lastSeen ? (Date.now() - u.lastSeen) < 5 * 60 * 1000 : false;
                list.push({
                    type: 'private', id: u.username, name: u.fullName,
                    avatar: u.avatar || null, isOnline, lastSeen: u.lastSeen,
                    lastMsg: last, unread: getUnreadCount(u.username, 'private')
                });
            });
        } else if (activeTab === 'GROUPS') {
            groups.forEach(g => {
                const last = getLastMessage(g.id, 'group');
                list.push({
                    type: 'group', id: g.id, name: g.name,
                    avatar: null, isOnline: false,
                    lastMsg: last, unread: getUnreadCount(g.id, 'group')
                });
            });
        }

        return list.filter(item => item.name.includes(searchTerm)).sort((a, b) => {
            const timeA = a.lastMsg?.timestamp || 0;
            const timeB = b.lastMsg?.timestamp || 0;
            return timeB - timeA;
        });
    };

    // --- Actions ---
    const handleSendMessage = async () => {
        if ((!inputText.trim()) || isUploading) return;

        if (editingMessageId) {
            const msgToUpdate = messages.find(m => m.id === editingMessageId);
            if (msgToUpdate) {
                try {
                    await updateMessage({ ...msgToUpdate, message: inputText, isEdited: true });
                    setEditingMessageId(null);
                    setInputText('');
                    onRefresh();
                } catch(e: any) { alert("خطا در ویرایش پیام"); }
            }
            return;
        }

        const newMsg: ChatMessage = {
            id: generateUUID(),
            sender: currentUser.fullName,
            senderUsername: currentUser.username,
            role: currentUser.role,
            message: inputText,
            timestamp: Date.now(),
            recipient: activeChannel?.type === 'private' ? activeChannel.id! : undefined,
            groupId: activeChannel?.type === 'group' ? activeChannel.id! : undefined,
            replyTo: replyingTo ? {
                id: replyingTo.id,
                sender: replyingTo.sender,
                message: replyingTo.message || (replyingTo.audioUrl ? 'پیام صوتی' : 'فایل')
            } : undefined,
            readBy: []
        };

        // Optimistic UI Update
        setMessages(prev => [...prev, newMsg]);
        setInputText('');
        setReplyingTo(null);
        setTimeout(scrollToBottom, 50);

        try {
            await sendMessage(newMsg);
            onRefresh();
        } catch (e: any) { 
            console.error("Send Error:", e);
            // Optionally remove message or show error state here
            alert("خطا در ارسال پیام");
        }
    };

    const getBestMimeType = () => {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/aac'
        ];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return '';
    };

    const startRecording = async () => {
        if (isRecording) return; 
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            const mimeType = getBestMimeType();
            const options = mimeType ? { mimeType } : undefined;
            recordedMimeTypeRef.current = mimeType || '';

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => { 
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data); 
                }
            };
            
            mediaRecorder.onstop = async () => {
                const tracks = stream.getTracks();
                tracks.forEach(track => track.stop());

                const durationSec = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);

                if (audioChunksRef.current.length === 0) {
                    setIsRecording(false);
                    return;
                }

                // Construct blob with correct type
                const finalMime = recordedMimeTypeRef.current || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: finalMime });
                
                // Only send if substantial data
                if (audioBlob.size < 100) { 
                    setIsUploading(false); 
                    setIsRecording(false);
                    return; 
                }
                
                setIsUploading(true);
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64 = (reader.result || '') as string;
                    
                    // Optimistic UI for Voice
                    const tempId = generateUUID();
                    const tempUrl = URL.createObjectURL(audioBlob);
                    
                    const tempMsg: ChatMessage = {
                        id: tempId,
                        sender: currentUser.fullName,
                        senderUsername: currentUser.username,
                        role: currentUser.role,
                        message: '',
                        timestamp: Date.now(),
                        recipient: activeChannel?.type === 'private' ? activeChannel.id! : undefined,
                        groupId: activeChannel?.type === 'group' ? activeChannel.id! : undefined,
                        audioUrl: tempUrl,
                        audioDuration: durationSec,
                        readBy: []
                    };
                    
                    setMessages(prev => [...prev, tempMsg]);
                    setTimeout(scrollToBottom, 50);
                    setIsUploading(false); // Hide spinner, show message immediately
                    setIsRecording(false);
                    audioChunksRef.current = [];

                    try {
                        let ext = 'webm';
                        if (finalMime.includes('mp4') || finalMime.includes('aac')) ext = 'm4a';
                        else if (finalMime.includes('ogg')) ext = 'ogg';

                        const result = await uploadFile(`voice_${Date.now()}.${ext}`, base64);
                        
                        // Update with real URL
                        const realMsg = { ...tempMsg, id: generateUUID(), audioUrl: result.url };
                        await sendMessage(realMsg);
                        
                        // Remove temp, add real (or just refresh)
                        onRefresh();
                    } catch (e: any) { 
                        alert('خطا در ارسال ویس'); 
                        // Revert optimistic update if needed
                    }
                };
            };

            // Start WITHOUT timeslice to let browser manage buffer and headers correctly.
            // This prevents corruption in some browsers (Safari/Mobile Chrome).
            mediaRecorder.start(); 
            recordingStartTimeRef.current = Date.now();
            setIsRecording(true);
            setRecordingTime(0);
            if(recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        } catch (err: any) { alert("دسترسی به میکروفون امکان‌پذیر نیست."); }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            if(recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
        }
    };

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
            const file = new (window as any).File([blob], fileName, { type: blob.type });

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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Size check: > 500MB (500 * 1024 * 1024 bytes)
        if (file.size > 500 * 1024 * 1024) {
            if (!confirm(`⚠️ حجم فایل ${Math.round(file.size / (1024 * 1024))} مگابایت است. آیا از ارسال این فایل حجیم اطمینان دارید؟`)) {
                e.target.value = '';
                return;
            }
        }

        setIsUploading(true);
        const reader = new FileReader();
        
        // Tracking progress using a custom upload if storageService allowed it,
        // but since we use base64 over custom storageService, we'll simulate the "progress"
        // based on the reader loading for better UX.
        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setFileProgress(prev => ({ ...prev, uploading: percent }));
            }
        };

        reader.onload = async (ev) => {
            try {
                setFileProgress(prev => ({ ...prev, uploading: 90 })); // Processing...
                const base64 = reader.result as string;
                const safeName = file.name || `unknown_${Date.now()}`;
                const result = await uploadFile(safeName, base64);
                
                const newMsg: ChatMessage = {
                    id: generateUUID(),
                    sender: currentUser.fullName,
                    senderUsername: currentUser.username,
                    role: currentUser.role,
                    message: '',
                    timestamp: Date.now(),
                    recipient: activeChannel?.type === 'private' ? activeChannel.id! : undefined,
                    groupId: activeChannel?.type === 'group' ? activeChannel.id! : undefined,
                    attachment: { fileName: result.fileName, url: result.url },
                    readBy: []
                };
                await sendMessage(newMsg);
                onRefresh();
                setTimeout(scrollToBottom, 150);
            } catch (error: any) { 
                alert('خطا در ارسال فایل. حجم فایل ممکن است زیاد باشد.'); 
            } finally { 
                setIsUploading(false); 
                setFileProgress(prev => { const n = {...prev}; delete n.uploading; return n; });
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleDelete = async (forEveryone: boolean) => {
        const ids = Array.from(selectedMessages);
        if (ids.length === 0) return;

        // Check permission if trying to delete for everyone
        const canDeleteForEveryone = ids.every(id => {
            const msg = messages.find(m => m.id === id);
            return msg && (msg.senderUsername === currentUser.username || [UserRole.ADMIN, UserRole.MANAGER, UserRole.CEO].includes(currentUser.role as UserRole));
        });

        if (forEveryone && !canDeleteForEveryone) {
            alert("شما اجازه حذف دو طرفه برخی پیام‌های انتخاب شده را ندارید.");
            return;
        }

        const confirmMsg = forEveryone 
            ? `آیا از حذف ${ids.length > 1 ? 'پیام‌های انتخاب شده' : 'این پیام'} برای همه اطمینان دارید؟`
            : `آیا از حذف ${ids.length > 1 ? 'پیام‌های انتخاب شده' : 'این پیام'} برای خودتان اطمینان دارید؟ (این عمل محلی است)`;

        if (!confirm(confirmMsg)) return;
        
        for (const id of ids) {
            try {
                await deleteMessage(id, forEveryone);
                setMessages(prev => prev.filter(m => m.id !== id));
            } catch (e) {
                console.error("Delete failed", e);
            }
        }
        setSelectionMode(false);
        setSelectedMessages(new Set());
        onRefresh();
    };

    // Corrected Forward Logic
    const handleForward = async (targetId: string, targetType: 'private' | 'group' | 'public') => {
        const ids = Array.from(selectedMessages);
        for (const id of ids) {
            const original = messages.find(m => m.id === id);
            if (original) {
                const newMsg: ChatMessage = {
                    id: generateUUID(),
                    sender: currentUser.fullName,
                    senderUsername: currentUser.username,
                    role: currentUser.role,
                    message: original.message,
                    timestamp: Date.now(),
                    recipient: targetType === 'private' ? targetId : undefined,
                    groupId: targetType === 'group' ? targetId : undefined,
                    attachment: original.attachment,
                    audioUrl: original.audioUrl,
                    isForwarded: true,
                    // Use flag from modal
                    forwardFrom: forwardNoQuote ? undefined : original.sender,
                    readBy: []
                };
                await sendMessage(newMsg);
            }
        }
        setSelectionMode(false);
        setSelectedMessages(new Set());
        setShowForwardModal(false);
        setForwardNoQuote(false); // Reset flag
        
        // Navigate to target chat
        setActiveChannel({ type: targetType, id: targetId });
        onRefresh();
        setTimeout(scrollToBottom, 150);
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedMessages);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedMessages(newSet);
        if (newSet.size === 0) setSelectionMode(false);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return;
        try {
            const newGroup: ChatGroup = {
                id: generateUUID(),
                name: newGroupName.trim(),
                members: [...selectedGroupMembers, currentUser.username],
                admins: [currentUser.username],
                createdBy: currentUser.username,
                createdAt: Date.now(),
                avatar: null
            };
            await createGroup(newGroup);
            setGroups(prev => [...prev, newGroup]);
            setShowGroupModal(false);
            setNewGroupName('');
            setSelectedGroupMembers([]);
            setActiveChannel({ type: 'group', id: newGroup.id });
        } catch (e) {
            alert('خطا در ساخت گروه');
        }
    };

    const handleUpdateGroup = async (groupId: string, updates: Partial<ChatGroup>) => {
        try {
            const group = groups.find(g => g.id === groupId);
            if (!group) return;
            const updatedGroup = { ...group, ...updates };
            await updateGroup(updatedGroup);
            setGroups(prev => prev.map(g => g.id === groupId ? updatedGroup : g));
            if (showGroupInfo && showGroupInfo.id === groupId) {
                setShowGroupInfo(updatedGroup);
            }
        } catch (e) {
            alert('خطا در بروزرسانی گروه');
        }
    };

    const handleAddMemberToGroup = async (groupId: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        
        const availableUsers = users.filter(u => !group.members.includes(u.username));
        // Simple UI for member selection - in a real app this should be a modal
        const username = prompt('نام کاربری کاربر جدید را وارد کنید:');
        if (username && users.find(u => u.username === username)) {
            const newMembers = [...group.members, username];
            await handleUpdateGroup(groupId, { members: newMembers });
        } else if (username) {
            alert('کاربر یافت نشد');
        }
    };

    const handleRemoveMemberFromGroup = async (groupId: string, memberUsername: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group || group.createdBy === memberUsername) {
            alert('نمی‌توان سازنده گروه را حذف کرد');
            return;
        }
        
        if (confirm(`آیا از حذف ${memberUsername} اطمینان دارید؟`)) {
            const newMembers = group.members.filter(m => m !== memberUsername);
            const newAdmins = (group.admins || []).filter(a => a !== memberUsername);
            await handleUpdateGroup(groupId, { members: newMembers, admins: newAdmins });
        }
    };

    const handleToggleAdminStatus = async (groupId: string, memberUsername: string) => {
        const group = groups.find(g => g.id === groupId);
        if (!group) return;
        
        const admins = group.admins || [];
        const isCurrentlyAdmin = admins.includes(memberUsername);
        
        let newAdmins;
        if (isCurrentlyAdmin) {
            newAdmins = admins.filter(a => a !== memberUsername);
        } else {
            newAdmins = [...admins, memberUsername];
        }
        
        await handleUpdateGroup(groupId, { admins: newAdmins });
    };

    // --- Render Logic ---
    if (!currentUser) return null;

    const displayMessages = messages.filter(msg => {
        if (!activeChannel) return false;
        let match = false;
        if (activeChannel.type === 'public') match = !msg.recipient && !msg.groupId;
        else if (activeChannel.type === 'private') match = (msg.senderUsername === activeChannel.id && msg.recipient === currentUser.username) || (msg.senderUsername === currentUser.username && msg.recipient === activeChannel.id);
        else if (activeChannel.type === 'group') match = msg.groupId === activeChannel.id;
        
        if (!match) return false;
        if (innerSearchTerm) {
            return (msg.message?.includes(innerSearchTerm) || msg.sender?.includes(innerSearchTerm));
        }
        return true;
    });

    return (
        <div className="flex h-[calc(100vh-80px)] md:bg-gray-100 rounded-xl overflow-hidden md:shadow-lg md:border border-gray-200 relative font-sans">
            
            {/* --- LIST SIDEBAR --- */}
            <div className={`w-full md:w-80 bg-white border-l border-gray-200 flex flex-col transition-all absolute md:relative z-20 h-full ${activeChannel ? 'hidden md:flex' : 'flex'}`}>
                {/* Header */}
                <div className="p-3 border-b bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex gap-2 bg-gray-200 p-1 rounded-lg text-xs font-bold w-full">
                            <button onClick={() => setActiveTab('CHATS')} className={`flex-1 py-1.5 rounded-md transition-all ${activeTab === 'CHATS' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>گفتگوها</button>
                            <button onClick={() => setActiveTab('GROUPS')} className={`flex-1 py-1.5 rounded-md transition-all ${activeTab === 'GROUPS' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>گروه‌ها</button>
                            <button onClick={() => setActiveTab('TASKS')} className={`flex-1 py-1.5 rounded-md transition-all ${activeTab === 'TASKS' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>تسک‌ها</button>
                        </div>
                        {activeTab === 'GROUPS' && <button onClick={() => setShowGroupModal(true)} className="mr-2 text-blue-600 bg-blue-50 p-1.5 rounded-full"><Plus size={16}/></button>}
                    </div>
                    <div className="relative">
                        <input className="w-full bg-white border rounded-xl pl-8 pr-3 py-2 text-sm" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <Search size={16} className="absolute left-2.5 top-2.5 text-gray-400"/>
                    </div>
                </div>

                {/* List Items */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {activeTab === 'TASKS' ? (
                        <div className="flex flex-col h-full bg-gray-50">
                            <div className="p-4 border-b bg-white">
                                <button 
                                    onClick={() => {
                                        const title = prompt('عنوان تسک؟');
                                        if (title) {
                                            const newTask: GroupTask = {
                                                id: generateUUID(),
                                                groupId: activeChannel?.type === 'group' ? activeChannel.id! : 'personal',
                                                title,
                                                status: 'pending',
                                                assignedTo: [],
                                                createdBy: currentUser.username,
                                                createdAt: Date.now()
                                            };
                                            createTask(newTask).then(() => {
                                                setTasks(prev => [newTask, ...prev]);
                                            });
                                        }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white p-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-100"
                                >
                                    <Plus size={18}/> تسک جدید
                                </button>
                            </div>
                            <div className="p-2 space-y-2 overflow-y-auto">
                                {tasks.length === 0 ? (
                                    <div className="text-center text-gray-400 py-20">
                                        <ListTodo size={48} className="mx-auto mb-2 opacity-20"/>
                                        <p className="text-sm">تسک یا پروژه‌ای یافت نشد</p>
                                    </div>
                                ) : tasks.map(task => (
                                    <div key={task.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm group">
                                        <div className="flex items-start gap-3">
                                            <button 
                                                onClick={() => {
                                                    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
                                                    const updatedTask = { ...task, status: newStatus as any };
                                                    updateTask(updatedTask).then(() => {
                                                        setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
                                                    });
                                                }}
                                                className={`mt-0.5 rounded-md border-2 transition-colors ${task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}
                                            >
                                                {task.status === 'completed' ? <Check size={14} className="text-white"/> : <div className="w-3.5 h-3.5"/>}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <h5 className={`text-sm font-bold truncate ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</h5>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-[10px] text-gray-400">{formatDate(task.createdAt)}</span>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => deleteTask(task.id).then(() => setTasks(prev => prev.filter(t => t.id !== task.id)))} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : getSortedChannels().map((item: ChannelItem) => (
                        <div key={item.id} onClick={() => { setActiveChannel({type: item.type, id: item.id}); markAsRead(item.id, item.type); }} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 relative group">
                            <div className="relative">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${item.type === 'private' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-orange-400 to-orange-600'}`}>
                                    {item.avatar ? <img src={item.avatar} className="w-full h-full rounded-full object-cover"/> : item.name.charAt(0)}
                                </div>
                                {item.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-1 overflow-hidden">
                                        <span className="font-bold text-gray-800 text-sm truncate">{item.name}</span>
                                        {mutedChannels.has(item.id) && <BellOff size={10} className="text-gray-400 opacity-60"/>}
                                    </div>
                                    {item.lastMsg && <span className="text-[10px] text-gray-400">{new Date(item.lastMsg.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>}
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-500 truncate max-w-[150px]">
                                        {item.lastMsg ? (item.lastMsg.audioUrl ? '🎤 پیام صوتی' : item.lastMsg.attachment ? '📎 فایل' : item.lastMsg.message) : 'پیامی نیست'}
                                    </p>
                                    {item.unread > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-bold shadow-sm">{item.unread}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- CHAT AREA --- */}
            {/* Using fixed positioning on mobile to ensure it covers everything and header stays on top */}
            <div className={`fixed inset-0 md:static md:flex-1 bg-[#8e98a3] z-[100] md:z-30 transition-transform duration-300 flex flex-col ${activeChannel ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                {activeChannel ? (
                    <>
                        {/* Chat Header */}
                        <div className="bg-white p-2 px-4 flex justify-between items-center shadow-sm z-50 sticky top-0 safe-pt">
                            <div className="flex items-center gap-3">
                                <button onClick={() => window.history.back()} className="md:hidden p-1 hover:bg-gray-100 rounded-full"><ArrowRight/></button>
                                <div className="flex flex-col cursor-pointer" onClick={() => {
                                    if(activeChannel.type === 'private') setShowContactInfo(users.find(u=>u.username===activeChannel.id) || null);
                                    else if(activeChannel.type === 'group') setShowGroupInfo(groups.find(g=>g.id===activeChannel.id) || null);
                                }}>
                                    <h3 className="font-bold text-gray-800 text-sm">
                                        {activeChannel.type === 'private' ? users.find(u=>u.username===activeChannel.id)?.fullName : 
                                         activeChannel.type === 'group' ? groups.find(g=>g.id===activeChannel.id)?.name : 'کانال عمومی'}
                                    </h3>
                                    <span className="text-[10px] text-blue-500">
                                        {activeChannel.type === 'private' ? (
                                            users.find(u=>u.username===activeChannel.id)?.lastSeen && (Date.now() - (users.find(u=>u.username===activeChannel.id)?.lastSeen || 0) < 300000) ? 'آنلاین' : 
                                            `آخرین بازدید ${formatLastSeen(users.find(u=>u.username===activeChannel.id)?.lastSeen)}`
                                        ) : 'اطلاعات گروه'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {selectionMode ? (
                                    <div className="flex gap-2 animate-fade-in">
                                        <button onClick={() => setShowForwardModal(true)} className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100" title="فوروارد"><Forward size={18}/></button>
                                        <button onClick={() => handleDelete(false)} className="p-2 bg-orange-50 text-orange-600 rounded-full hover:bg-orange-100" title="حذف برای من"><Trash2 size={18}/></button>
                                        <button onClick={() => handleDelete(true)} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100" title="حذف دو طرفه"><Trash2 size={18}/></button>
                                        <button onClick={() => { setSelectionMode(false); setSelectedMessages(new Set()); }} className="p-2 hover:bg-gray-100 rounded-full"><X size={18}/></button>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowInnerSearch(!showInnerSearch)} className={`p-2 rounded-full ${showInnerSearch ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}><Search size={20}/></button>
                                )}
                            </div>
                        </div>

                        {/* Inner Search */}
                        {showInnerSearch && (
                            <div className="bg-white p-2 border-b flex items-center gap-2 animate-slide-down">
                                <input className="flex-1 bg-gray-100 border-none rounded-lg py-2 px-4 text-sm" placeholder="جستجو در پیام‌ها..." value={innerSearchTerm} onChange={e => setInnerSearchTerm(e.target.value)} autoFocus />
                                <button onClick={() => { setShowInnerSearch(false); setInnerSearchTerm(''); }}><X size={20} className="text-gray-500"/></button>
                            </div>
                        )}

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative bg-[url('https://web.telegram.org/img/bg_0.png')]">
                            {displayMessages.map((msg: ChatMessage) => {
                                const isMe = msg.senderUsername === currentUser.username;
                                const isSelected = selectedMessages.has(msg.id);
                                
                                return (
                                    <div 
                                        key={msg.id} 
                                        className={`flex w-full mb-1 group ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 ${selectionMode ? 'cursor-pointer' : ''}`}
                                        onClick={() => { if(selectionMode) toggleSelection(msg.id); }}
                                        onContextMenu={(e) => { e.preventDefault(); if(!selectionMode) setContextMenuMsg({msg, x: e.clientX, y: e.clientY}); }}
                                    >
                                        {/* Actions Button - LEFT for ME, RIGHT for OTHER */}
                                        {isMe && (
                                            <div className="flex flex-col gap-1 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                 <button onClick={() => setReplyingTo(msg)} className="p-1.5 bg-white rounded-full text-blue-600 shadow-sm hover:scale-110" title="پاسخ"><CornerUpLeft size={12}/></button>
                                                 <button onClick={() => { setSelectedMessages(new Set([msg.id])); setShowForwardModal(true); }} className="p-1.5 bg-white rounded-full text-green-600 shadow-sm hover:scale-110" title="فوروارد"><Forward size={12}/></button>
                                                 <button onClick={() => { navigator.clipboard.writeText(msg.message); }} className="p-1.5 bg-white rounded-full text-gray-600 shadow-sm hover:scale-110" title="کپی"><Copy size={12}/></button>
                                                 {(msg.attachment || msg.audioUrl) && <button onClick={() => handleNativeShare(msg)} className="p-1.5 bg-white rounded-full text-orange-600 shadow-sm hover:scale-110" title="اشتراک"><Share2 size={12}/></button>}
                                            </div>
                                        )}

                                        {selectionMode && (
                                            <div className={`mx-2 self-center w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-green-500 border-green-500' : 'border-gray-400 bg-white/50'}`}>
                                                {isSelected && <Check size={12} className="text-white"/>}
                                            </div>
                                        )}
                                        
                                        <div className={`relative max-w-[75%] md:max-w-[70%] rounded-xl px-3 py-1.5 shadow-sm text-sm transition-colors ${isMe ? 'bg-[#eeffde] rounded-tr-none' : 'bg-white rounded-tl-none'} ${isSelected ? 'ring-2 ring-blue-400' : ''}`}>
                                            
                                            {/* Forward Header */}
                                            {msg.isForwarded && msg.forwardFrom && (
                                                <div className="text-[10px] text-blue-600 font-bold mb-1 flex items-center gap-1">
                                                    <Forward size={10}/> نقل قول از {msg.forwardFrom}
                                                </div>
                                            )}

                                            {/* Reply Header */}
                                            {msg.replyTo && (
                                                <div className={`mb-1 px-2 py-0.5 rounded border-r-2 text-[10px] bg-opacity-10 cursor-pointer ${isMe ? 'bg-green-600 border-green-600' : 'bg-blue-600 border-blue-600'}`}>
                                                    <div className="font-bold opacity-80">{msg.replyTo.sender}</div>
                                                    <div className="truncate opacity-70">{msg.replyTo.message.substring(0, 30)}...</div>
                                                </div>
                                            )}

                                            {/* Sender Name in Group */}
                                            {!isMe && activeChannel.type !== 'private' && (
                                                <div className="text-[11px] font-bold text-[#e17076] mb-0.5">{msg.sender}</div>
                                            )}

                                            {/* Content */}
                                            {msg.attachment ? (
                                                <div className="mb-1">
                                                    {msg.attachment.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                        <img 
                                                            src={msg.attachment.url} 
                                                            className="rounded-lg max-h-60 object-cover cursor-pointer hover:opacity-90"
                                                            onClick={(e) => { e.stopPropagation(); setShowImageViewer(msg.attachment!.url); }}
                                                        />
                                                    ) : (
                                                        <button 
                                                            className="flex items-center gap-2 bg-black/5 p-2 rounded hover:bg-black/10 transition-colors w-full text-right" 
                                                            onClick={async (e) => { 
                                                                e.stopPropagation(); 
                                                                if (isDownloading[msg.id]) return;
                                                                
                                                                setIsDownloading(prev => ({ ...prev, [msg.id]: true }));
                                                                setFileProgress(prev => ({ ...prev, [msg.id]: 0 }));
                                                                
                                                                // Simulate meaningful progress for better UX
                                                                const steps = [10, 35, 60, 85, 100];
                                                                for (const s of steps) {
                                                                    await new Promise(r => setTimeout(r, 200));
                                                                    setFileProgress(prev => ({ ...prev, [msg.id]: s }));
                                                                }
                                                                
                                                                window.open(msg.attachment!.url, '_blank');
                                                                
                                                                setTimeout(() => {
                                                                    setIsDownloading(prev => { const n = {...prev}; delete n[msg.id]; return n; });
                                                                    setFileProgress(prev => { const n = {...prev}; delete n[msg.id]; return n; });
                                                                }, 500);
                                                            }}
                                                        >
                                                            <div className="bg-blue-500 p-2 rounded text-white relative">
                                                                {isDownloading[msg.id] ? <Loader2 size={16} className="animate-spin"/> : <File size={16}/>}
                                                                {isDownloading[msg.id] && (
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-blue-600 rounded text-[8px] font-bold">
                                                                        {fileProgress[msg.id]}%
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="overflow-hidden flex-1">
                                                                <div className="font-bold text-xs truncate">{msg.attachment.fileName}</div>
                                                                <div className="text-[10px] text-blue-600">{isDownloading[msg.id] ? 'در حال آماده‌سازی...' : 'دانلود فایل'}</div>
                                                            </div>
                                                        </button>
                                                    )}
                                                </div>
                                            ) : msg.audioUrl ? (
                                                <div className="flex items-center gap-2 min-w-[200px] py-1">
                                                    <AudioPlayer url={msg.audioUrl} isMe={isMe} duration={msg.audioDuration} />
                                                </div>
                                            ) : (
                                                <div 
                                                    className="whitespace-pre-wrap leading-relaxed message-content cursor-pointer"
                                                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.message); alert('متن کپی شد'); }}
                                                    title="برای کپی کلیک کنید"
                                                >
                                                    {msg.message}
                                                </div>
                                            )}

                                            {/* Footer */}
                                            <div className="flex justify-end items-center gap-1 mt-1 opacity-60 select-none">
                                                {msg.isEdited && <span className="text-[9px]">ویرایش شده</span>}
                                                <span className="text-[10px]">{new Date(msg.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                                                {isMe && <CheckCheck size={14} className={msg.readBy && msg.readBy.length > 0 ? "text-green-500" : "text-gray-500"}/>}
                                            </div>
                                        </div>

                                        {/* Actions Button - LEFT for ME, RIGHT for OTHER */}
                                        {!isMe && (
                                            <div className="flex flex-col gap-1 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                 <button onClick={() => setReplyingTo(msg)} className="p-1.5 bg-white rounded-full text-blue-600 shadow-sm hover:scale-110" title="پاسخ"><CornerUpLeft size={12}/></button>
                                                 <button onClick={() => { setSelectedMessages(new Set([msg.id])); setShowForwardModal(true); }} className="p-1.5 bg-white rounded-full text-green-600 shadow-sm hover:scale-110" title="فوروارد"><Forward size={12}/></button>
                                                 <button onClick={() => { navigator.clipboard.writeText(msg.message); }} className="p-1.5 bg-white rounded-full text-gray-600 shadow-sm hover:scale-110" title="کپی"><Copy size={12}/></button>
                                                 {(msg.attachment || msg.audioUrl) && <button onClick={() => handleNativeShare(msg)} className="p-1.5 bg-white rounded-full text-orange-600 shadow-sm hover:scale-110" title="اشتراک"><Share2 size={12}/></button>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="bg-white p-2 flex items-end gap-2 border-t relative z-20 pb-safe">
                            {/* Reply/Edit Preview */}
                            {(replyingTo || editingMessageId) && (
                                <div className="absolute bottom-full left-0 right-0 bg-white border-t border-b p-2 flex justify-between items-center shadow-sm z-10 animate-slide-up">
                                    <div className="flex items-center gap-2 border-r-4 border-blue-500 pr-2">
                                        {editingMessageId ? <Edit2 size={18} className="text-blue-500"/> : <Reply size={18} className="text-blue-500"/>}
                                        <div className="flex flex-col text-xs">
                                            <span className="font-bold text-blue-600">{editingMessageId ? 'ویرایش پیام' : `پاسخ به ${replyingTo?.sender}`}</span>
                                            <span className="text-gray-500 truncate max-w-[200px]">{editingMessageId ? '...' : replyingTo?.message}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => { setReplyingTo(null); setEditingMessageId(null); setInputText(''); }}><X size={18} className="text-gray-400 hover:text-red-500"/></button>
                                </div>
                            )}

                            <button onClick={() => document.getElementById('chat-file-menu')?.classList.toggle('hidden')} className="p-3 text-gray-500 hover:bg-gray-100 rounded-full transition-colors mb-1 relative">
                                <Paperclip size={24}/>
                                {/* Attachment Menu */}
                                <div id="chat-file-menu" className="hidden absolute bottom-14 right-0 bg-white shadow-xl rounded-xl border p-2 flex flex-col gap-2 min-w-[150px] animate-scale-in z-50">
                                    <button onClick={() => galleryInputRef.current?.click()} className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded text-sm text-gray-700"><ImageIcon size={18} className="text-blue-500"/> گالری (عکس/فیلم)</button>
                                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded text-sm text-gray-700"><File size={18} className="text-orange-500"/> فایل</button>
                                </div>
                            </button>
                            
                            <input type="file" ref={galleryInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload}/>
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload}/>

                            <div className="flex-1 bg-gray-100 rounded-3xl flex items-center px-4 py-2 min-h-[48px]">
                                <textarea 
                                    ref={inputAreaRef}
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                    placeholder="پیام..."
                                    className="bg-transparent border-none outline-none w-full text-sm resize-none max-h-32"
                                    rows={1}
                                    style={{ height: 'auto', minHeight: '24px' }}
                                />
                            </div>

                            {inputText.trim() || isUploading ? (
                                <button onClick={handleSendMessage} className="p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-transform active:scale-95 mb-1">
                                    {isUploading ? <Loader2 size={24} className="animate-spin"/> : <Send size={24} className={document.dir==='rtl' ? 'rotate-180' : ''}/>}
                                </button>
                            ) : (
                                <button 
                                    onMouseDown={startRecording}
                                    onMouseUp={stopRecording}
                                    onTouchStart={startRecording}
                                    onTouchEnd={stopRecording}
                                    className={`p-3 rounded-full shadow-lg transition-all mb-1 ${isRecording ? 'bg-red-500 scale-110 shadow-red-200' : 'bg-blue-500 text-white'}`}
                                >
                                    {isRecording ? <div className="text-white font-mono text-xs">{formatTime(recordingTime)}</div> : <Mic size={24}/>}
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-[#f0f2f5]">
                        <div className="bg-gray-200 p-4 rounded-full mb-4"><MessageSquare size={48}/></div>
                        <p>برای شروع گفتگو یک مخاطب را انتخاب کنید</p>
                    </div>
                )}
            </div>

            {/* --- OVERLAYS --- */}
            
            {/* 1. Context Menu */}
            {contextMenuMsg && (
                <div className="fixed inset-0 z-[200]" onClick={() => setContextMenuMsg(null)}>
                    <div 
                        className="absolute bg-white rounded-xl shadow-2xl border w-48 py-1 overflow-hidden animate-scale-in"
                        style={{ top: Math.min(contextMenuMsg.y, window.innerHeight - 200), left: Math.min(contextMenuMsg.x, window.innerWidth - 200) }}
                    >
                        <button onClick={() => { setReplyingTo(contextMenuMsg.msg); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><Reply size={16}/> پاسخ</button>
                        <button onClick={() => { navigator.clipboard.writeText(contextMenuMsg.msg.message); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><Copy size={16}/> کپی</button>
                        <button onClick={() => { handleNativeShare(contextMenuMsg.msg); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><Share2 size={16}/> اشتراک‌گذاری</button>
                        <button onClick={() => { setSelectedMessages(new Set([contextMenuMsg.msg.id])); setShowForwardModal(true); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><Forward size={16}/> فوروارد</button>
                        {contextMenuMsg.msg.senderUsername === currentUser.username && (
                            <button onClick={() => { setEditingMessageId(contextMenuMsg.msg.id); setInputText(contextMenuMsg.msg.message); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><Edit2 size={16}/> ویرایش</button>
                        )}
                        <button onClick={() => { setSelectedMessages(new Set([contextMenuMsg.msg.id])); setSelectionMode(true); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"><CheckSquare size={16}/> انتخاب</button>
                        <button onClick={() => { setMessages(prev => prev.filter(m => m.id !== contextMenuMsg.msg.id)); setContextMenuMsg(null); }} className="w-full text-right px-4 py-2 hover:bg-orange-50 text-orange-600 flex items-center gap-2 text-sm"><Trash2 size={16}/> حذف برای من</button>
                        {(contextMenuMsg.msg.senderUsername === currentUser.username || [UserRole.ADMIN, UserRole.MANAGER, UserRole.CEO].includes(currentUser.role as UserRole)) && (
                            <button 
                                onClick={async () => { 
                                    if(confirm('آیا از حذف این پیام برای همه اطمینان دارید؟')) {
                                        try {
                                            await deleteMessage(contextMenuMsg.msg.id); 
                                            setMessages(prev => prev.filter(m => m.id !== contextMenuMsg.msg.id));
                                            onRefresh(); 
                                        } catch (e) { alert("خطا در حذف پیام"); }
                                    }
                                    setContextMenuMsg(null); 
                                }} 
                                className="w-full text-right px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm"
                            >
                                <Trash2 size={16}/> حذف دو طرفه
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* 2. Image Viewer */}
            {showImageViewer && (
                <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center animate-fade-in" onClick={() => setShowImageViewer(null)}>
                    <img src={showImageViewer} className="max-w-[90%] max-h-[90%] rounded shadow-2xl" onClick={e => e.stopPropagation()}/>
                    <div className="absolute top-4 right-4 flex gap-4">
                        <a href={showImageViewer} download target="_blank" className="p-2 bg-white/20 rounded-full hover:bg-white/40 text-white" onClick={e=>e.stopPropagation()}><DownloadCloud/></a>
                        <button onClick={() => setShowImageViewer(null)} className="p-2 bg-white/20 rounded-full hover:bg-white/40 text-white"><X/></button>
                    </div>
                </div>
            )}

            {/* 3. Forward Modal */}
            {showForwardModal && (
                <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <span className="font-bold">ارسال به...</span>
                            <button onClick={() => setShowForwardModal(false)}><X size={20}/></button>
                        </div>
                        
                        {/* New Quote Toggle */}
                        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100">
                             <label className="flex items-center gap-2 cursor-pointer text-sm text-yellow-800">
                                 <input type="checkbox" checked={forwardNoQuote} onChange={e => setForwardNoQuote(e.target.checked)} className="w-4 h-4 rounded text-yellow-600"/>
                                 ارسال بدون نقل قول (مخفی کردن نام فرستنده)
                             </label>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2">
                            {getAllChannelsForForward().map((item: ChannelItem) => (
                                <div key={item.id} onClick={() => handleForward(item.id, item.type)} className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg cursor-pointer">
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold">
                                        {item.avatar ? <img src={item.avatar} className="w-full h-full rounded-full"/> : item.name.charAt(0)}
                                    </div>
                                    <div className="font-bold text-sm tracking-tight">{item.name} <span className="text-xs text-gray-400 font-normal mr-2">({item.type === 'private' ? 'شخصی' : item.type === 'public' ? 'عمومی' : 'گروه'})</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 3.1 Group Creation Modal */}
            {showGroupModal && (
                <div className="fixed inset-0 bg-black/50 z-[202] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden animate-scale-in">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold flex items-center gap-2"><Users size={20} className="text-orange-500"/> ساخت گروه جدید</h3>
                            <button onClick={() => setShowGroupModal(false)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">نام گروه</label>
                                <input 
                                    type="text" 
                                    value={newGroupName} 
                                    onChange={e => setNewGroupName(e.target.value)}
                                    placeholder="مثلاً: واحد حسابداری"
                                    className="w-full p-3 bg-gray-100 rounded-xl border-none outline-none focus:ring-2 focus:ring-orange-200 text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">انتخاب اعضا</label>
                                <div className="max-h-48 overflow-y-auto space-y-1 p-1 bg-gray-50 rounded-xl border border-gray-100">
                                    {users.filter(u => u.username !== currentUser.username).map(user => (
                                        <label key={user.username} className="flex justify-between items-center p-2 hover:bg-white rounded-lg cursor-pointer group transition-colors">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                                    {user.fullName.charAt(0)}
                                                </div>
                                                <span className="text-sm">{user.fullName}</span>
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedGroupMembers.includes(user.username)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedGroupMembers([...selectedGroupMembers, user.username]);
                                                    else setSelectedGroupMembers(selectedGroupMembers.filter(id => id !== user.username));
                                                }}
                                                className="w-4 h-4 rounded text-orange-500"
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex gap-3">
                            <button onClick={handleCreateGroup} className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-100">ایجاد گروه</button>
                            <button onClick={() => setShowGroupModal(false)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-300 transition-colors">انصراف</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Group Info & Management Modal */}
            {showGroupInfo && (
                <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md h-[70vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
                        <div className="relative bg-gradient-to-br from-orange-500 to-orange-700 p-8 text-white flex flex-col items-center">
                            <button onClick={() => setShowGroupInfo(null)} className="absolute top-4 left-4 p-2 bg-black/20 rounded-full hover:bg-black/30"><X size={20}/></button>
                            <div className="relative group/avatar">
                                <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center text-3xl font-black mb-3 shadow-lg backdrop-blur-md overflow-hidden">
                                    {showGroupInfo.avatar ? <img src={showGroupInfo.avatar} className="w-full h-full object-cover"/> : showGroupInfo.name.charAt(0)}
                                </div>
                                {((showGroupInfo.admins || []).includes(currentUser.username) || currentUser.role === UserRole.ADMIN) && (
                                    <button 
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = async (e: any) => {
                                                const file = e.target.files[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = async (re) => {
                                                        const result = await uploadFile(file.name, re.target?.result as string);
                                                        handleUpdateGroup(showGroupInfo.id, { avatar: result.url });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            };
                                            input.click();
                                        }}
                                        className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-3xl opacity-0 group-hover/avatar:opacity-100 transition-opacity backdrop-blur-[2px]"
                                    >
                                        <Camera size={24} className="text-white"/>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black">{showGroupInfo.name}</h3>
                                {((showGroupInfo.admins || []).includes(currentUser.username) || currentUser.role === UserRole.ADMIN) && (
                                    <button 
                                        onClick={() => {
                                            const newName = prompt('نام جدید گروه را وارد کنید:', showGroupInfo.name);
                                            if (newName && newName !== showGroupInfo.name) {
                                                handleUpdateGroup(showGroupInfo.id, { name: newName });
                                            }
                                        }}
                                        className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                                    >
                                        <Edit2 size={14}/>
                                    </button>
                                )}
                            </div>
                            <p className="text-xs opacity-80 mt-1">{showGroupInfo.members.length} عضو</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <Bell size={20} className={showGroupInfo && mutedChannels.has(showGroupInfo.id) ? "text-gray-300" : "text-blue-500"}/>
                                    <span className="text-sm font-bold text-gray-700">اعلان‌ها و صدا</span>
                                </div>
                                <button 
                                    onClick={() => {
                                        const newMuted = new Set(mutedChannels);
                                        if (newMuted.has(showGroupInfo.id)) newMuted.delete(showGroupInfo.id);
                                        else newMuted.add(showGroupInfo.id);
                                        setMutedChannels(newMuted);
                                    }}
                                    className={`w-12 h-6 rounded-full relative p-1 transition-colors ${mutedChannels.has(showGroupInfo.id) ? 'bg-gray-300' : 'bg-green-500'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${mutedChannels.has(showGroupInfo.id) ? 'left-1' : 'right-1'}`}></div>
                                </button>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">اعضای گروه</h4>
                                {showGroupInfo.members.map(username => {
                                    const u = users.find(user => user.username === username);
                                    const isCreator = showGroupInfo.createdBy === username;
                                    const isAdmin = (showGroupInfo.admins || []).includes(username);
                                    const isMe = currentUser.username === username;
                                    const canManage = (showGroupInfo.admins || []).includes(currentUser.username) || currentUser.role === UserRole.ADMIN;
                                    
                                    return (
                                        <div key={username} className="flex items-center justify-between group/member p-2 hover:bg-gray-50 rounded-xl transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-sm font-bold overflow-hidden">
                                                    {u?.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : (u?.fullName.charAt(0) || username.charAt(0))}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-gray-800">{u?.fullName || username} {isMe && '(شما)'}</span>
                                                    <span className="text-[10px] text-gray-400">@{username}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {isCreator && <span className="text-[9px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">سازنده</span>}
                                                {!isCreator && isAdmin && <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">مدیر</span>}
                                                
                                                {canManage && !isCreator && !isMe && (
                                                    <div className="flex gap-1 ml-2">
                                                        <button 
                                                            onClick={() => handleToggleAdminStatus(showGroupInfo.id, username)}
                                                            className={`p-1.5 rounded-lg hover:bg-white shadow-sm transition-all ${isAdmin ? 'text-blue-500' : 'text-gray-400'}`}
                                                            title={isAdmin ? 'سلب مدیریت' : 'ارتقا به مدیر'}
                                                        >
                                                            <Shield size={14}/>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRemoveMemberFromGroup(showGroupInfo.id, username)}
                                                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-white shadow-sm rounded-lg transition-all"
                                                            title="حذف از گروه"
                                                        >
                                                            <UserMinus size={14}/>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {((showGroupInfo.admins || []).includes(currentUser.username) || currentUser.role === UserRole.ADMIN) && (
                                <div className="pt-4 border-t space-y-2">
                                    <button 
                                        onClick={() => handleAddMemberToGroup(showGroupInfo.id)}
                                        className="w-full bg-blue-50 text-blue-600 p-3 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <UserPlus size={18}/> افزودن عضو جدید
                                    </button>
                                    <button onClick={() => { if(confirm('گروه حذف شود؟')) { deleteGroup(showGroupInfo.id); setShowGroupInfo(null); setActiveChannel(null); onRefresh(); } }} className="w-full bg-red-50 text-red-600 p-3 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                                        <Trash2 size={18}/> حذف و انحلال گروه
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Contact Info Modal */}
            {showContactInfo && (
                <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={()=>setShowContactInfo(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden animate-scale-in" onClick={e=>e.stopPropagation()}>
                        <div className="relative bg-gradient-to-br from-blue-500 to-blue-700 p-8 text-white flex flex-col items-center">
                            <button onClick={() => setShowContactInfo(null)} className="absolute top-4 left-4 p-2 bg-black/20 rounded-full hover:bg-black/30"><X size={20}/></button>
                            <div className="w-24 h-24 rounded-full bg-white/20 p-1 mb-3">
                                <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-blue-600 text-4xl font-black shadow-inner overflow-hidden">
                                    {showContactInfo.avatar ? <img src={showContactInfo.avatar} className="w-full h-full object-cover"/> : showContactInfo.fullName.charAt(0)}
                                </div>
                            </div>
                            <h3 className="text-xl font-black">{showContactInfo.fullName}</h3>
                            <p className="text-xs opacity-80 mt-1">@{showContactInfo.username}</p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <Bell size={20} className="text-gray-400"/>
                                    <span className="text-sm font-bold text-gray-700">بی‌صدا کردن</span>
                                </div>
                                <button className="w-12 h-6 bg-gray-300 rounded-full relative p-1">
                                    <div className="w-4 h-4 bg-white rounded-full absolute left-1 transition-all"></div>
                                </button>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-3 text-gray-600">
                                    <UserIcon size={18}/>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-400">نقش سیستم</span>
                                        <span className="text-sm font-bold">{showContactInfo.role}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-gray-600">
                                    <MessageSquare size={18}/>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-gray-400">آخرین فعالیت</span>
                                        <span className="text-sm font-medium">{formatLastSeen(showContactInfo.lastSeen)}</span>
                                    </div>
                                </div>
                            </div>

                            <button className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 hover:shadow-xl transition-all" onClick={() => { setActiveChannel({type: 'private', id: showContactInfo.username}); setShowContactInfo(null); }}>
                                ارسال پیام
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatRoom;
