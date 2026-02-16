
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChatMessage, ChatGroup, GroupTask, UserRole, SystemSettings } from '../types';
import { sendMessage, deleteMessage, getGroups, createGroup, deleteGroup, getTasks, createTask, updateTask, deleteTask, uploadFile, updateGroup, updateMessage, getSettings } from '../services/storageService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';
import { 
    Send, User as UserIcon, MessageSquare, Users, Plus, ListTodo, Paperclip, 
    CheckSquare, Square, X, Trash2, Reply, Edit2, ArrowRight, Mic, 
    Play, Pause, Loader2, Search, MoreVertical, File, Image as ImageIcon,
    Check, CheckCheck, DownloadCloud, StopCircle, Bookmark, Lock, Forward, Share2, CornerUpRight
} from 'lucide-react';

interface ChatRoomProps { 
    currentUser: User; 
    preloadedMessages: ChatMessage[]; 
    onRefresh: () => void; 
}

const ChatRoom: React.FC<ChatRoomProps> = ({ currentUser, preloadedMessages, onRefresh }) => {
    // --- Data State ---
    const [messages, setMessages] = useState<ChatMessage[]>(preloadedMessages || []);
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<ChatGroup[]>([]);
    const [tasks, setTasks] = useState<GroupTask[]>([]);
    const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
    
    // --- UI State ---
    const [activeChannel, setActiveChannel] = useState<{type: 'public' | 'private' | 'group', id: string | null}>({ type: 'public', id: null });
    const [activeTab, setActiveTab] = useState<'chat' | 'tasks'>('chat'); // View mode inside a group
    const [sidebarTab, setSidebarTab] = useState<'private' | 'groups' | 'tasks'>('private'); // Sidebar Category
    
    const [mobileShowChat, setMobileShowChat] = useState(false);
    const [searchTerm, setSearchTerm] = useState(''); // Sidebar Search
    
    // --- Inner Chat Search State ---
    const [showInnerSearch, setShowInnerSearch] = useState(false);
    const [innerSearchTerm, setInnerSearchTerm] = useState('');

    // --- Input & Action State ---
    const [inputText, setInputText] = useState('');
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    // --- Voice Recording State ---
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0); // Seconds
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // --- Forwarding & Share State ---
    const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
    const [sharedFile, setSharedFile] = useState<File | null>(null); // For PWA share
    const [sharedText, setSharedText] = useState<string>(''); // For PWA share
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [hideSenderName, setHideSenderName] = useState(false); // Toggle for "Forward without quote"

    // --- Refs ---
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputAreaRef = useRef<HTMLTextAreaElement>(null);
    const innerSearchInputRef = useRef<HTMLInputElement>(null);

    // --- Modal State ---
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    
    // --- READ STATUS TRACKING ---
    const [lastReadMap, setLastReadMap] = useState<Record<string, number>>({});

    // --- Load Data & Effects ---
    useEffect(() => { if (preloadedMessages) setMessages(preloadedMessages); }, [preloadedMessages]);

    useEffect(() => { 
        loadMeta();
        loadReadStatus();
        const interval = setInterval(loadMeta, 5000); 
        // Check for shared content on mount
        checkSharedContent();
        return () => clearInterval(interval);
    }, []);

    // Check for PWA Shared Content
    const checkSharedContent = async () => {
        if (window.location.hash.includes('share_received')) {
            try {
                const cache = await caches.open('share-data');
                const metaRes = await cache.match('/shared-meta');
                if (metaRes) {
                    const meta = await metaRes.json();
                    
                    if (meta.files && meta.files.length > 0) {
                        const fileRes = await cache.match('/shared-file-0');
                        if (fileRes) {
                            const blob = await fileRes.blob();
                            const file = new File([blob], meta.files[0].name, { type: meta.files[0].type });
                            setSharedFile(file);
                            setSharedText(meta.text); // Caption
                            setShowForwardModal(true); // Open select dialog
                        }
                    } else if (meta.text) {
                        setSharedText(meta.text);
                        // Create a dummy message object for text sharing to reuse logic
                        setForwardMsg({
                            id: 'shared_text',
                            sender: 'External App',
                            senderUsername: '',
                            role: '',
                            message: meta.text,
                            timestamp: Date.now()
                        });
                        setShowForwardModal(true);
                    }

                    // Clean up
                    await cache.delete('/shared-meta');
                    await cache.delete('/shared-file-0');
                    // Remove hash to prevent re-read
                    window.history.replaceState(null, '', window.location.pathname + window.location.hash.replace('?action=share_received', ''));
                }
            } catch (e) {
                console.error("Error reading shared content", e);
            }
        }
    };

    // Load Last Read Map from LocalStorage
    const loadReadStatus = () => {
        try {
            const stored = localStorage.getItem(`chat_last_read_${currentUser.username}`);
            if (stored) setLastReadMap(JSON.parse(stored));
        } catch(e) {}
    };

    // Save Last Read Status
    const updateReadStatus = (channelId: string) => {
        const newMap = { ...lastReadMap, [channelId]: Date.now() };
        setLastReadMap(newMap);
        localStorage.setItem(`chat_last_read_${currentUser.username}`, JSON.stringify(newMap));
    };

    // Scroll to bottom when channel changes or chat opens
    useEffect(() => {
        if (!showInnerSearch) {
            scrollToBottom();
            setTimeout(scrollToBottom, 100);
            setTimeout(scrollToBottom, 300);
        }
        setReplyingTo(null);
        setEditingMessageId(null);
        setInputText('');
        setShowInnerSearch(false);
        setInnerSearchTerm('');
        
        if (mobileShowChat && activeChannel.id) updateReadStatus(activeChannel.id);
        else if (mobileShowChat && activeChannel.type === 'public') updateReadStatus('public');

    }, [activeChannel, mobileShowChat]);

    // Handle Mobile Back Button
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (mobileShowChat) {
                setMobileShowChat(false);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [mobileShowChat]);

    // Auto-scroll on new message
    useEffect(() => {
        if (!showInnerSearch && messages.length > 0) {
             scrollToBottom();
             if (mobileShowChat || window.innerWidth >= 768) {
                 if (activeChannel.id) updateReadStatus(activeChannel.id);
                 else if (activeChannel.type === 'public') updateReadStatus('public');
             }
        }
    }, [messages.length]);
    
    // Timer for Recording
    useEffect(() => {
        if (isRecording) {
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            setRecordingDuration(0);
        }
        return () => { if (recordingTimerRef.current) clearInterval(recordingTimerRef.current); };
    }, [isRecording]);

    // Auto Focus inner search
    useEffect(() => {
        if (showInnerSearch) {
            setTimeout(() => innerSearchInputRef.current?.focus(), 100);
        }
    }, [showInnerSearch]);

    const loadMeta = async () => {
        try {
            const usrList = await getUsers();
            setUsers(usrList); 
            const grpList = await getGroups();
            const isManager = [UserRole.ADMIN, UserRole.MANAGER, UserRole.CEO].includes(currentUser.role as UserRole);
            const visibleGroups = grpList.filter(g => isManager || g.members.includes(currentUser.username) || g.createdBy === currentUser.username);
            setGroups(visibleGroups);
            const tskList = await getTasks();
            setTasks(tskList);
            const s = await getSettings();
            setSystemSettings(s);
        } catch (e) { console.error("Chat load error", e); }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    };

    const getDisplayMessages = () => {
        const list = messages.filter(msg => { 
            if (activeChannel.type === 'public') return !msg.recipient && !msg.groupId; 
            if (activeChannel.type === 'private') {
                if (activeChannel.id === currentUser.username) {
                    return msg.senderUsername === currentUser.username && msg.recipient === currentUser.username;
                }
                return (msg.senderUsername === activeChannel.id && msg.recipient === currentUser.username) || 
                       (msg.senderUsername === currentUser.username && msg.recipient === activeChannel.id); 
            }
            if (activeChannel.type === 'group') return msg.groupId === activeChannel.id; 
            return false; 
        });

        if (innerSearchTerm.trim()) {
            return list.filter(m => 
                (m.message && m.message.includes(innerSearchTerm)) || 
                (m.attachment && m.attachment.fileName.includes(innerSearchTerm)) ||
                (m.sender && m.sender.includes(innerSearchTerm))
            );
        }
        return list;
    };

    // --- SORTED CHAT LIST ---
    const sortedChatList = useMemo(() => {
        const getChannelMeta = (type: 'public' | 'group' | 'private', id: string | null) => {
            let relevantMsgs = [];
            if (type === 'public') relevantMsgs = messages.filter(m => !m.recipient && !m.groupId);
            else if (type === 'group') relevantMsgs = messages.filter(m => m.groupId === id);
            else if (type === 'private') {
                if (id === currentUser.username) relevantMsgs = messages.filter(m => m.senderUsername === currentUser.username && m.recipient === currentUser.username);
                else relevantMsgs = messages.filter(m => (m.senderUsername === id && m.recipient === currentUser.username) || (m.senderUsername === currentUser.username && m.recipient === id));
            }
            if (relevantMsgs.length === 0) return { lastMsg: null, timestamp: 0, unreadCount: 0 };
            const lastMsg = relevantMsgs[relevantMsgs.length - 1];
            const readTime = lastReadMap[id || 'public'] || 0;
            const unreadCount = relevantMsgs.filter(m => m.timestamp > readTime && (id === currentUser.username ? true : m.senderUsername !== currentUser.username)).length;
            return { lastMsg, timestamp: lastMsg.timestamp, unreadCount };
        };

        const list = [];
        // Saved Messages (Always)
        list.push({ type: 'private', id: currentUser.username, name: 'پیام‌های ذخیره شده', avatar: null, isGroup: false, isSaved: true });
        
        // Users
        users.filter(u => u.username !== currentUser.username).forEach(u => {
            list.push({ type: 'private', id: u.username, name: u.fullName, avatar: u.avatar, isGroup: false, isSaved: false });
        });
        
        // Public Channel
        list.push({ type: 'public', id: null, name: 'کانال عمومی', avatar: null, isGroup: true, isSaved: false });
        
        // Groups
        groups.forEach(g => {
            list.push({ type: 'group', id: g.id, name: g.name, avatar: null, isGroup: true, isSaved: false });
        });

        const listWithMeta = list.map(item => {
            const meta = getChannelMeta(item.type as any, item.id);
            return { ...item, ...meta };
        });

        const filtered = listWithMeta.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));

        // Sort: Saved first, then by timestamp
        return filtered.sort((a, b) => {
            if (a.isSaved) return -1;
            if (b.isSaved) return 1;
            return b.timestamp - a.timestamp;
        });

    }, [messages, users, groups, searchTerm, currentUser.username, lastReadMap]);

    const handleOpenChat = (item: any) => {
        const type = item.type as 'public' | 'private' | 'group';
        const id = item.id;
        const readKey = type === 'public' ? 'public' : id;
        updateReadStatus(readKey);
        setActiveChannel({ type, id });
        setMobileShowChat(true);
        if (window.innerWidth < 768) {
            window.history.pushState({ tab: 'chat', chatDetail: true }, '', window.location.hash);
        }
        if (sidebarTab === 'tasks') setActiveTab('tasks');
        else setActiveTab('chat');
    };

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
                } catch(e) { alert("خطا در ویرایش پیام"); }
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
            recipient: activeChannel.type === 'private' ? activeChannel.id! : undefined,
            groupId: activeChannel.type === 'group' ? activeChannel.id! : undefined,
            replyTo: replyingTo ? {
                id: replyingTo.id,
                sender: replyingTo.sender,
                message: replyingTo.message || (replyingTo.audioUrl ? 'پیام صوتی' : 'فایل')
            } : undefined
        };

        try {
            await sendMessage(newMsg);
            setInputText('');
            setReplyingTo(null);
            onRefresh();
            scrollToBottom();
            setTimeout(scrollToBottom, 200);
            if (activeChannel.id) updateReadStatus(activeChannel.id);
            else if (activeChannel.type === 'public') updateReadStatus('public');
        } catch (e: any) { alert(`خطا در ارسال پیام: ${e.message}`); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        processFile(file);
        e.target.value = '';
    };

    const processFile = async (file: File, caption?: string, customTarget?: {type: 'private'|'group'|'public', id: string|null}) => {
        if (file.size > 200 * 1024 * 1024) { alert('حجم فایل نباید بیشتر از 200 مگابایت باشد.'); return; }
        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const base64 = ev.target?.result as string;
                const result = await uploadFile(file.name, base64);
                
                const targetType = customTarget ? customTarget.type : activeChannel.type;
                const targetId = customTarget ? customTarget.id : activeChannel.id;

                const newMsg: ChatMessage = {
                    id: generateUUID(),
                    sender: currentUser.fullName,
                    senderUsername: currentUser.username,
                    role: currentUser.role,
                    message: caption || '',
                    timestamp: Date.now(),
                    recipient: targetType === 'private' ? targetId! : undefined,
                    groupId: targetType === 'group' ? targetId! : undefined,
                    attachment: { fileName: result.fileName, url: result.url }
                };
                await sendMessage(newMsg);
                onRefresh();
                
                // If current channel is same as target, mark read
                if (targetId === activeChannel.id && targetType === activeChannel.type) {
                     if (targetId) updateReadStatus(targetId);
                     else if (targetType === 'public') updateReadStatus('public');
                }
            } catch (error) { alert('خطا در ارسال فایل. اتصال را بررسی کنید.'); } finally { setIsUploading(false); }
        };
        reader.readAsDataURL(file);
    };
    
    // --- FORWARDING LOGIC ---
    const handleForwardClick = (msg: ChatMessage) => {
        setForwardMsg(msg);
        setShowForwardModal(true);
    };

    const executeForward = async (targetItem: any) => {
        if (!forwardMsg && !sharedFile) return;
        setIsUploading(true);

        try {
            // Case 1: Shared File from PWA
            if (sharedFile) {
                await processFile(sharedFile, sharedText, { type: targetItem.type, id: targetItem.id });
                setSharedFile(null);
                setSharedText('');
            } 
            // Case 2: Standard Message Forwarding
            else if (forwardMsg) {
                let content = forwardMsg.message || '';
                
                // Prepend header if not hidden
                if (!hideSenderName && !sharedFile && forwardMsg.id !== 'shared_text') {
                    // Simple quote style
                    if (content) content = `[نقل قول از ${forwardMsg.sender}]:\n${content}`;
                }

                const newMsg: ChatMessage = {
                    id: generateUUID(),
                    sender: currentUser.fullName,
                    senderUsername: currentUser.username,
                    role: currentUser.role,
                    message: content,
                    timestamp: Date.now(),
                    recipient: targetItem.type === 'private' ? targetItem.id! : undefined,
                    groupId: targetItem.type === 'group' ? targetItem.id! : undefined,
                    attachment: forwardMsg.attachment,
                    audioUrl: forwardMsg.audioUrl
                };
                await sendMessage(newMsg);
                onRefresh();
            }

            setShowForwardModal(false);
            setForwardMsg(null);
            setHideSenderName(false);
            
            // Navigate to that chat
            handleOpenChat(targetItem);

        } catch(e) {
            alert('خطا در فوروارد پیام');
        } finally {
            setIsUploading(false);
        }
    };
    
    // ... (Recording, Edit, Delete handlers same as before) ...
    const toggleRecording = async () => {
         if (isRecording) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        } else {
            if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
                alert("امکان ضبط صدا فقط در حالت امن (HTTPS) یا لوکال‌هاست وجود دارد.");
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    if (audioBlob.size < 1000) { setIsUploading(false); return; }

                    setIsUploading(true);
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = async () => {
                        const base64 = reader.result as string;
                        try {
                            const result = await uploadFile(`voice_${Date.now()}.webm`, base64);
                            const newMsg: ChatMessage = {
                                id: generateUUID(),
                                sender: currentUser.fullName,
                                senderUsername: currentUser.username,
                                role: currentUser.role,
                                message: '',
                                timestamp: Date.now(),
                                recipient: activeChannel.type === 'private' ? activeChannel.id! : undefined,
                                groupId: activeChannel.type === 'group' ? activeChannel.id! : undefined,
                                audioUrl: result.url
                            };
                            await sendMessage(newMsg);
                            onRefresh();
                             if (activeChannel.id) updateReadStatus(activeChannel.id);
                             else if (activeChannel.type === 'public') updateReadStatus('public');
                        } catch (e) { alert('خطا در ارسال ویس'); } finally { setIsUploading(false); }
                    };
                    stream.getTracks().forEach(track => track.stop());
                };
                mediaRecorder.start();
                setIsRecording(true);
            } catch (err) { alert("دسترسی به میکروفون امکان‌پذیر نیست."); setIsRecording(false); }
        }
    };

    const handleEditMessage = (msg: ChatMessage) => {
        if (!msg.message) return;
        setInputText(msg.message);
        setEditingMessageId(msg.id);
        setReplyingTo(null);
        inputAreaRef.current?.focus();
    };

    const handleDeleteMessage = async (id: string) => {
        if (confirm("آیا از حذف این پیام اطمینان دارید؟")) {
            await deleteMessage(id);
            setMessages(prev => prev.filter(m => m.id !== id));
            onRefresh();
        }
    };

    const renderMessageContent = (text: string) => {
        if (!innerSearchTerm || !text) return text;
        const parts = text.split(new RegExp(`(${innerSearchTerm})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) => 
                    part.toLowerCase() === innerSearchTerm.toLowerCase() ? <span key={i} className="bg-yellow-200 text-black px-1 rounded">{part}</span> : part
                )}
            </span>
        );
    };
    
    const getPreviewTime = (ts: number) => {
        if (!ts) return '';
        const d = new Date(ts);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'});
        return d.toLocaleDateString('fa-IR', {month:'short', day:'numeric'});
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const displayMsgs = getDisplayMessages();

    // Background
    const backgroundStyle = useMemo(() => {
        if (currentUser.chatBackground) {
            return { backgroundImage: `url(${currentUser.chatBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' };
        }
        if (systemSettings?.defaultChatBackground) {
             return { backgroundImage: `url(${systemSettings.defaultChatBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' };
        }
        return { backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`, opacity: 0.1 };
    }, [currentUser.chatBackground, systemSettings?.defaultChatBackground]);

    const isPatternBackground = !currentUser.chatBackground && !systemSettings?.defaultChatBackground;

    return (
        <div className="flex h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] bg-white overflow-hidden rounded-xl border border-gray-200 shadow-sm relative">
            
            {/* --- SIDEBAR --- */}
            <div className={`absolute inset-0 md:static md:w-80 bg-white border-l border-gray-200 flex flex-col z-20 transition-transform duration-300 ${mobileShowChat ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                {/* Sidebar Header & Lists - Same as before */}
                 <div className="p-3 border-b flex flex-col gap-3 bg-gray-50">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200">
                                {currentUser.fullName.charAt(0)}
                            </div>
                            <span className="font-bold text-gray-800">پیام‌ها</span>
                        </div>
                        {sidebarTab === 'groups' && (
                            <button onClick={() => setShowGroupModal(true)} className="p-2 text-blue-600 bg-white rounded-full hover:bg-blue-50 shadow-sm transition-colors">
                                <Plus size={18}/>
                            </button>
                        )}
                    </div>
                    <div className="flex bg-gray-200 p-1 rounded-lg">
                        <button onClick={() => setSidebarTab('private')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sidebarTab === 'private' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>شخصی</button>
                        <button onClick={() => setSidebarTab('groups')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sidebarTab === 'groups' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>گروه‌ها</button>
                        <button onClick={() => setSidebarTab('tasks')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sidebarTab === 'tasks' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>تسک‌ها</button>
                    </div>
                    <div className="relative">
                        <Search size={16} className="absolute right-3 top-2.5 text-gray-400"/>
                        <input className="w-full bg-white border border-gray-200 rounded-xl py-2 pr-9 pl-3 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {sortedChatList.map(item => {
                        const isActive = activeChannel.type === item.type && activeChannel.id === item.id;
                        return (
                            <div key={`${item.type}_${item.id}`} onClick={() => handleOpenChat(item)} className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 ${isActive ? 'bg-blue-50 border-r-4 border-r-blue-600' : ''}`}>
                                <div className="relative">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm overflow-hidden ${item.isSaved ? 'bg-sky-600' : item.type === 'public' ? 'bg-indigo-500' : item.type === 'group' ? 'bg-orange-500' : 'bg-gray-400'}`}>
                                        {item.isSaved ? <Bookmark size={20}/> : item.avatar ? <img src={item.avatar} className="w-full h-full object-cover"/> : (item.type === 'public' ? <Users size={22}/> : item.type === 'group' ? <Users size={20}/> : <UserIcon size={20}/>)}
                                    </div>
                                    {item.unreadCount > 0 && (<div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white shadow-sm font-bold animate-pulse">{item.unreadCount > 99 ? '99+' : item.unreadCount}</div>)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1"><span className="font-bold text-gray-800 text-sm truncate">{item.name}</span>{item.timestamp > 0 && <span className="text-[10px] text-gray-400">{getPreviewTime(item.timestamp)}</span>}</div>
                                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">{item.lastMsg ? (<>{!item.isSaved && item.lastMsg.senderUsername === currentUser.username && <span className="text-blue-500">شما:</span>}<span className={`${!item.isSaved && !item.lastMsg.senderUsername.includes(currentUser.username) ? 'text-gray-800 font-medium' : ''}`}>{item.lastMsg.message || (item.lastMsg.audioUrl ? '🎤 پیام صوتی' : item.lastMsg.attachment ? '📎 فایل' : '')}</span></>) : (<span className="opacity-50 italic">پیامی نیست</span>)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- CHAT AREA --- */}
            <div className={`absolute inset-0 md:static flex-1 min-w-0 flex flex-col bg-[#8E98A3] z-30 transition-transform duration-300 ${mobileShowChat ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                
                <div className={`absolute inset-0 pointer-events-none ${isPatternBackground ? 'opacity-10' : 'opacity-100'}`} style={backgroundStyle}></div>

                {/* Header */}
                <div className="bg-white p-3 flex justify-between items-center shadow-sm z-10 sticky top-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => { setMobileShowChat(false); if (window.history.state?.chatDetail) window.history.back(); }} className="md:hidden p-2 hover:bg-gray-100 rounded-full text-gray-600"><ArrowRight/></button>
                        <div className="flex flex-col cursor-pointer" onClick={() => { if(activeChannel.type==='group') setActiveTab(activeTab==='chat'?'tasks':'chat') }}>
                            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                {activeChannel.id === currentUser.username ? 'پیام‌های ذخیره شده' : (activeChannel.type === 'public' ? 'کانال عمومی' : activeChannel.type === 'private' ? users.find(u=>u.username===activeChannel.id)?.fullName : groups.find(g=>g.id===activeChannel.id)?.name)}
                                {activeChannel.id === currentUser.username && <Lock size={14} className="text-gray-400"/>}
                            </h3>
                            <span className="text-xs text-blue-500 font-medium">
                                {activeChannel.id === currentUser.username ? 'شخصی' : (activeChannel.type === 'group' ? (activeTab === 'chat' ? 'بزنید برای تسک‌ها' : 'بزنید برای چت') : 'آنلاین')}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {activeTab === 'chat' && (
                             <button onClick={() => { setShowInnerSearch(!showInnerSearch); setInnerSearchTerm(''); }} className={`p-2 rounded-full transition-colors ${showInnerSearch ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}>
                                 <Search size={20}/>
                             </button>
                        )}
                        {activeChannel.type === 'group' && (
                            <div className="bg-gray-100 p-2 rounded-lg text-gray-600 cursor-pointer" onClick={() => setActiveTab(activeTab==='chat'?'tasks':'chat')}>
                                {activeTab === 'chat' ? <ListTodo size={20}/> : <MessageSquare size={20}/>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Inner Search Bar */}
                {showInnerSearch && (
                    <div className="bg-white p-2 border-b animate-slide-down flex items-center gap-2 z-10">
                        <input ref={innerSearchInputRef} className="flex-1 bg-gray-100 border-none rounded-lg py-2 px-4 text-sm focus:ring-2 focus:ring-blue-200 outline-none" placeholder="جستجو در این گفتگو..." value={innerSearchTerm} onChange={e => setInnerSearchTerm(e.target.value)}/>
                        <button onClick={() => { setShowInnerSearch(false); setInnerSearchTerm(''); }} className="p-2 text-gray-500 hover:text-red-500"><X size={20}/></button>
                    </div>
                )}

                {/* Messages */}
                {activeTab === 'chat' ? (
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative z-0 overflow-x-hidden pb-20">
                        {displayMsgs.length === 0 && innerSearchTerm && (
                            <div className="text-center text-gray-500 bg-white/80 p-2 rounded shadow-sm mx-auto w-fit">نتیجه‌ای یافت نشد</div>
                        )}
                        
                        {displayMsgs.map((msg) => {
                            const isMe = msg.senderUsername === currentUser.username;
                            
                            return (
                                <div key={msg.id} id={`msg-${msg.id}`} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-1 group`}>
                                    <div className={`relative max-w-[85%] md:max-w-[75%] lg:max-w-[65%] rounded-2xl px-3 py-2 shadow-sm text-sm ${isMe ? 'bg-[#EEFFDE] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
                                        
                                        {msg.replyTo && (
                                            <div className={`mb-1 px-2 py-1 rounded border-r-2 text-xs cursor-pointer ${isMe ? 'bg-[#dcf8c6] border-green-500' : 'bg-gray-50 border-blue-500'}`} onClick={() => {
                                                document.getElementById(`msg-${msg.replyTo?.id}`)?.scrollIntoView({behavior: 'smooth', block: 'center'});
                                            }}>
                                                <div className="font-bold text-blue-600 opacity-80">{msg.replyTo.sender}</div>
                                                <div className="truncate opacity-70">{msg.replyTo.message}</div>
                                            </div>
                                        )}

                                        {!isMe && activeChannel.type !== 'private' && (
                                            <div className="text-[11px] font-bold text-orange-600 mb-1">{msg.sender}</div>
                                        )}

                                        {msg.audioUrl && (
                                            <div className="flex items-center gap-2 min-w-[160px] py-1">
                                                <audio controls src={msg.audioUrl} className="h-8 w-full opacity-90 custom-audio-player" />
                                            </div>
                                        )}

                                        {msg.attachment && (
                                            <div className="mb-1">
                                                {msg.attachment.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                    <a href={msg.attachment.url} target="_blank" className="block mb-1">
                                                        <img src={msg.attachment.url} alt="attachment" className="max-w-full h-auto rounded-lg max-h-60 object-cover" />
                                                    </a>
                                                ) : (
                                                    <div className="flex items-center gap-3 bg-black/5 p-2 rounded-lg max-w-full overflow-hidden">
                                                        <div className={`p-2 rounded-full text-white shrink-0 ${isMe ? 'bg-green-500' : 'bg-blue-500'}`}><File size={18}/></div>
                                                        <div className="overflow-hidden min-w-0">
                                                            <div className="truncate font-bold text-xs">{renderMessageContent(msg.attachment.fileName)}</div>
                                                            <a href={msg.attachment.url} target="_blank" className="text-[10px] text-blue-600 font-bold flex items-center gap-1 mt-0.5">دانلود <DownloadCloud size={10}/></a>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {msg.message && <div className="whitespace-pre-wrap leading-relaxed break-words break-all">{renderMessageContent(msg.message)}</div>}

                                        {/* Meta & Actions */}
                                        <div className="flex justify-between items-end mt-1 pt-1 border-t border-black/5">
                                            <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                                                <button onClick={() => setReplyingTo(msg)} className="p-0.5 hover:text-blue-600" title="پاسخ"><Reply size={12}/></button>
                                                {/* Forward Button */}
                                                <button onClick={() => handleForwardClick(msg)} className="p-0.5 hover:text-orange-600 transform hover:scale-110 transition-transform" title="فوروارد">
                                                    <CornerUpRight size={12}/>
                                                </button>
                                                {isMe && <button onClick={() => handleEditMessage(msg)} className="p-0.5 hover:text-green-600"><Edit2 size={12}/></button>}
                                                {(isMe || currentUser.role === UserRole.ADMIN) && <button onClick={() => handleDeleteMessage(msg.id)} className="p-0.5 hover:text-red-600"><Trash2 size={12}/></button>}
                                            </div>

                                            <div className="flex items-center gap-1 opacity-50 select-none text-[10px]">
                                                {msg.isEdited && <span className="text-[8px]">ویرایش شده</span>}
                                                <span>{new Date(msg.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                                                {isMe && <CheckCheck size={12} className="text-green-600"/>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                ) : (
                    /* ... Tasks View (Same as before) ... */
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
                        <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                            <h3 className="font-bold mb-3 flex items-center gap-2 text-gray-700"><CheckSquare className="text-green-600"/> تسک‌های گروه</h3>
                            <div className="flex gap-2">
                                <input className="flex-1 border rounded-lg p-2 text-sm" placeholder="تسک جدید..." value={newTaskTitle} onChange={e=>setNewTaskTitle(e.target.value)}/>
                                <button onClick={async ()=>{ if(!newTaskTitle) return; await createTask({ id: generateUUID(), groupId: activeChannel.id!, title: newTaskTitle, isCompleted: false, createdBy: currentUser.username, createdAt: Date.now() }); setNewTaskTitle(''); loadMeta(); }} className="bg-green-600 text-white px-4 rounded-lg font-bold">افزودن</button>
                            </div>
                        </div>
                        <div className="space-y-2">{tasks.filter(t => t.groupId === activeChannel.id).map(t => (<div key={t.id} className="bg-white p-3 rounded-lg shadow-sm flex items-center gap-3"><button onClick={async ()=>{ await updateTask({...t, isCompleted: !t.isCompleted}); loadMeta(); }} className={t.isCompleted ? "text-green-500" : "text-gray-300"}>{t.isCompleted ? <CheckSquare/> : <Square/>}</button><span className={`flex-1 text-sm ${t.isCompleted ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</span><button onClick={async ()=>{ if(confirm('حذف؟')) { await deleteTask(t.id); loadMeta(); } }} className="text-red-400 p-1"><Trash2 size={16}/></button></div>))}</div>
                    </div>
                )}

                {/* Input Area */}
                {activeTab === 'chat' && (
                    <div className="bg-white p-2 flex items-end gap-2 border-t relative z-20">
                        {replyingTo && (
                            <div className="absolute bottom-full left-0 right-0 bg-white border-t border-b p-2 flex justify-between items-center shadow-sm z-10 animate-slide-up">
                                <div className="flex items-center gap-2 border-r-4 border-blue-500 pr-2">
                                    <Reply size={20} className="text-blue-500"/>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-blue-600 text-xs">پاسخ به {replyingTo.sender}</span>
                                        <span className="text-xs text-gray-500 truncate max-w-[200px]">{replyingTo.message || 'رسانه'}</span>
                                    </div>
                                </div>
                                <button onClick={() => { setReplyingTo(null); setEditingMessageId(null); setInputText(''); }} className="p-1 hover:bg-red-50 rounded-full text-gray-500 hover:text-red-500"><X size={18}/></button>
                            </div>
                        )}

                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                        <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors mb-1">
                            {isUploading ? <Loader2 size={24} className="animate-spin text-blue-500"/> : <Paperclip size={24}/>}
                        </button>

                        <div className="flex-1 bg-gray-100 rounded-3xl flex items-center px-4 py-2 min-h-[48px] border border-transparent focus-within:border-blue-400 focus-within:bg-white transition-all">
                            <textarea 
                                ref={inputAreaRef}
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) { e.preventDefault(); handleSendMessage(); }}}
                                placeholder={isRecording ? `در حال ضبط... ${formatDuration(recordingDuration)}` : "پیام خود را بنویسید..."}
                                className="bg-transparent border-none outline-none w-full text-sm resize-none max-h-32"
                                rows={1}
                                style={{ height: 'auto', minHeight: '24px' }}
                                disabled={isRecording}
                            />
                        </div>

                        {inputText.trim() || isUploading || editingMessageId ? (
                            <button onClick={handleSendMessage} className="p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-transform active:scale-95 mb-1 animate-scale-in">
                                {editingMessageId ? <Check size={20}/> : <Send size={20} className={document.dir === 'rtl' ? 'rotate-180' : ''}/>}
                            </button>
                        ) : (
                            <button onClick={toggleRecording} className={`p-3 rounded-full shadow-lg transition-all mb-1 ${isRecording ? 'bg-red-500 scale-110 shadow-red-200' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-200'}`}>
                                {isRecording ? <div className="flex items-center justify-center w-5 h-5 relative"><div className="absolute animate-ping inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></div><div className="z-10"><Send size={20} className={document.dir === 'rtl' ? 'rotate-180 text-white' : 'text-white'}/></div></div> : <Mic size={20} className="text-white"/>}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* FORWARD MODAL */}
            {showForwardModal && (
                <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                <Forward size={18} className="text-blue-600"/>
                                ارسال به ...
                            </h3>
                            <button onClick={() => { setShowForwardModal(false); setForwardMsg(null); setSharedFile(null); }} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                        </div>
                        
                        {/* Preview */}
                        <div className="p-3 bg-blue-50 border-b border-blue-100">
                             <div className="text-xs text-blue-800 font-bold mb-1">محتوای ارسالی:</div>
                             {sharedFile ? (
                                 <div className="flex items-center gap-2 text-xs text-gray-600 bg-white p-2 rounded border">
                                     <Paperclip size={14}/> {sharedFile.name}
                                     {sharedText && <span className="border-r pr-2">{sharedText}</span>}
                                 </div>
                             ) : (
                                 <div className="text-xs text-gray-600 bg-white p-2 rounded border truncate">
                                     {forwardMsg?.message || (forwardMsg?.attachment ? 'فایل پیوست' : 'ویس')}
                                 </div>
                             )}

                             {/* Option to Hide Name */}
                             {!sharedFile && forwardMsg?.id !== 'shared_text' && (
                                <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={hideSenderName} 
                                        onChange={e => setHideSenderName(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <span className="text-xs text-gray-700">ارسال بدون نام (کپی)</span>
                                </label>
                             )}
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {sortedChatList.filter(i => i.type !== 'public' || currentUser.role === UserRole.ADMIN).map(item => (
                                <div 
                                    key={`fwd_${item.type}_${item.id}`} 
                                    onClick={() => executeForward(item)}
                                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 transition-colors"
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm overflow-hidden ${item.isSaved ? 'bg-sky-600' : item.type === 'group' ? 'bg-orange-500' : 'bg-gray-400'}`}>
                                        {item.isSaved ? <Bookmark size={18}/> : item.avatar ? <img src={item.avatar} className="w-full h-full object-cover"/> : <UserIcon size={18}/>}
                                    </div>
                                    <span className="font-bold text-sm text-gray-800 truncate">{item.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Group Creation Modal (Existing) */}
            {showGroupModal && (
                <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 text-lg">ایجاد گروه جدید</h3>
                            <button onClick={() => setShowGroupModal(false)}><X size={20} className="text-gray-400"/></button>
                        </div>
                        <input className="w-full border rounded-xl p-3 mb-4 bg-gray-50 focus:bg-white transition-colors" placeholder="نام گروه" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                        <div className="max-h-48 overflow-y-auto mb-4 border rounded-xl p-2 bg-gray-50 custom-scrollbar">
                            {users.map(u => (
                                <label key={u.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                    <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" onChange={e => {
                                        if (e.target.checked) setSelectedGroupMembers([...selectedGroupMembers, u.username]);
                                        else setSelectedGroupMembers(selectedGroupMembers.filter(m => m !== u.username));
                                    }}/>
                                    <span className="text-sm font-medium text-gray-700">{u.fullName}</span>
                                </label>
                            ))}
                        </div>
                        <button onClick={async () => {
                            if(!newGroupName) return;
                            await createGroup({ id: generateUUID(), name: newGroupName, members: [...selectedGroupMembers, currentUser.username], createdBy: currentUser.username });
                            setShowGroupModal(false); loadMeta();
                        }} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">ایجاد گروه</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatRoom;
