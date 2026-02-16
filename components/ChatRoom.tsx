
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChatMessage, ChatGroup, GroupTask, UserRole, SystemSettings } from '../types';
import { sendMessage, deleteMessage, getGroups, getTasks, uploadFile, updateMessage, getSettings } from '../services/storageService';
import { getUsers } from '../services/authService';
import { generateUUID } from '../constants';
import { 
    Send, User as UserIcon, Users, Plus, Paperclip, 
    CheckSquare, X, Trash2, Reply, Edit2, ArrowRight, 
    Loader2, Search, File, CheckCheck, Bookmark, CornerUpRight, Copy, MoreVertical, EyeOff, Eye
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
    const [activeTab, setActiveTab] = useState<'chat' | 'tasks'>('chat'); 
    const [sidebarTab, setSidebarTab] = useState<'private' | 'groups' | 'tasks'>('private'); 
    const [mobileShowChat, setMobileShowChat] = useState(false);
    const [searchTerm, setSearchTerm] = useState(''); 
    const [showInnerSearch, setShowInnerSearch] = useState(false);
    const [innerSearchTerm, setInnerSearchTerm] = useState('');

    // --- Selection Mode State ---
    const [isSelectionMode, setIsSelectionMode] = useState(false); // Sidebar selection
    const [selectedChatIds, setSelectedChatIds] = useState<string[]>([]);
    const [isMsgSelectionMode, setIsMsgSelectionMode] = useState(false); // Inner message selection
    const [selectedMsgIds, setSelectedMsgIds] = useState<string[]>([]);

    // --- Input & Action State ---
    const [inputText, setInputText] = useState('');
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
    const [pendingForward, setPendingForward] = useState<ChatMessage | null>(null);
    const [hideForwardSender, setHideForwardSender] = useState(false); // New state for hiding quote
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, msg: ChatMessage } | null>(null);
    
    // --- Forwarding Modal State ---
    const [showForwardDestinationModal, setShowForwardDestinationModal] = useState(false);
    const [sharedFile, setSharedFile] = useState<File | null>(null); 
    const [sharedText, setSharedText] = useState<string>(''); 

    // --- Refs ---
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputAreaRef = useRef<HTMLTextAreaElement>(null);
    const innerSearchInputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // --- Modal State ---
    const [showGroupModal, setShowGroupModal] = useState(false);
    
    // --- READ STATUS TRACKING ---
    const [lastReadMap, setLastReadMap] = useState<Record<string, number>>({});

    const getPreviewTime = (timestamp: number) => {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (d.toDateString() === now.toDateString()) {
            return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        } else if (d.toDateString() === yesterday.toDateString()) {
            return 'دیروز';
        } else {
            return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
        }
    };

    // --- Load Data & Effects ---
    useEffect(() => { if (preloadedMessages) setMessages(preloadedMessages); }, [preloadedMessages]);

    useEffect(() => { 
        loadMeta();
        loadReadStatus();
        const interval = setInterval(loadMeta, 5000); 
        checkSharedContent();
        return () => clearInterval(interval);
    }, []);

    // --- HANDLE HARDWARE BACK BUTTON (MOBILE & HISTORY API) ---
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            // Priority 1: Close Forward Modal
            if (showForwardDestinationModal) {
                setShowForwardDestinationModal(false);
                setPendingForward(null);
                return;
            }
            
            // Priority 2: Close Inner Search
            if (showInnerSearch) {
                setShowInnerSearch(false);
                setInnerSearchTerm('');
                return;
            }

            // Priority 3: Close Chat View (Mobile)
            if (mobileShowChat) {
                setMobileShowChat(false);
                return;
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [mobileShowChat, showForwardDestinationModal, showInnerSearch]);

    // Push state when opening chat to allow back button
    const pushChatHistory = () => {
        if (window.innerWidth < 768) {
            try {
                if (window.location.protocol !== 'blob:') {
                     window.history.pushState({ view: 'chat' }, '', '#chat/open');
                } else {
                     window.history.pushState({ view: 'chat' }, '');
                }
            } catch(e) {
                 try { window.history.pushState({ view: 'chat' }, ''); } catch(e2) {}
            }
        }
    };

    // Push state for modals
    const pushModalHistory = () => {
        try {
            if (window.location.protocol !== 'blob:') {
                 window.history.pushState({ view: 'modal' }, '', '#chat/modal');
            } else {
                 window.history.pushState({ view: 'modal' }, '');
            }
        } catch(e) {
             try { window.history.pushState({ view: 'modal' }, ''); } catch(e2) {}
        }
    };

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
                            setSharedText(meta.text); 
                            setShowForwardDestinationModal(true); 
                        }
                    } else if (meta.text) {
                        setSharedText(meta.text);
                        const dummyMsg = {
                            id: 'shared_text',
                            sender: 'External App',
                            senderUsername: '',
                            role: '',
                            message: meta.text,
                            timestamp: Date.now()
                        } as ChatMessage;
                        setPendingForward(dummyMsg); 
                        setShowForwardDestinationModal(true);
                    }

                    await cache.delete('/shared-meta');
                    await cache.delete('/shared-file-0');
                    if (window.location.protocol !== 'blob:') {
                        window.history.replaceState(null, '', window.location.pathname + window.location.hash.replace('?action=share_received', ''));
                    }
                }
            } catch (e) {
                console.error("Error reading shared content", e);
            }
        }
    };

    const loadReadStatus = () => {
        try {
            const stored = localStorage.getItem(`chat_last_read_${currentUser.username}`);
            if (stored) setLastReadMap(JSON.parse(stored));
        } catch(e) {}
    };

    const updateReadStatus = (channelId: string) => {
        const newMap = { ...lastReadMap, [channelId]: Date.now() };
        setLastReadMap(newMap);
        localStorage.setItem(`chat_last_read_${currentUser.username}`, JSON.stringify(newMap));
    };

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

    // --- Message Processing & Filtering ---
    const getDisplayMessages = () => {
        const list = messages.filter(msg => { 
            // Filter out deleted messages for this user (Soft Delete)
            if (msg.hiddenFor && msg.hiddenFor.includes(currentUser.username)) return false;

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

    const displayMsgs = getDisplayMessages();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    };

    useEffect(() => {
        if (!showInnerSearch) {
            scrollToBottom();
            setTimeout(scrollToBottom, 100);
        }
    }, [activeChannel, mobileShowChat, displayMsgs.length, showInnerSearch]);

    // Reset UI states when changing channel
    useEffect(() => {
        setIsMsgSelectionMode(false);
        setSelectedMsgIds([]);
        setReplyingTo(null);
        setEditingMessageId(null);
        setShowInnerSearch(false);
        setInnerSearchTerm('');
        
        if (mobileShowChat && activeChannel.id) updateReadStatus(activeChannel.id);
        else if (mobileShowChat && activeChannel.type === 'public') updateReadStatus('public');

    }, [activeChannel, mobileShowChat]);

    // Close Context Menu on click outside
    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

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
            relevantMsgs = relevantMsgs.filter(m => !m.hiddenFor?.includes(currentUser.username));

            if (relevantMsgs.length === 0) return { lastMsg: null, timestamp: 0, unreadCount: 0 };
            const lastMsg = relevantMsgs[relevantMsgs.length - 1];
            const readTime = lastReadMap[id || 'public'] || 0;
            const unreadCount = relevantMsgs.filter(m => m.timestamp > readTime && (id === currentUser.username ? true : m.senderUsername !== currentUser.username)).length;
            return { lastMsg, timestamp: lastMsg.timestamp, unreadCount };
        };

        const list = [];
        
        if (sidebarTab === 'private') {
            list.push({ type: 'private', id: currentUser.username, name: 'پیام‌های ذخیره شده', avatar: null, isGroup: false, isSaved: true });
            users.filter(u => u.username !== currentUser.username).forEach(u => {
                list.push({ type: 'private', id: u.username, name: u.fullName, avatar: u.avatar, isGroup: false, isSaved: false });
            });
        } else {
             list.push({ type: 'public', id: null, name: 'کانال عمومی', avatar: null, isGroup: true, isSaved: false });
             groups.forEach(g => {
                list.push({ type: 'group', id: g.id, name: g.name, avatar: null, isGroup: true, isSaved: false });
             });
        }

        const listWithMeta = list.map(item => {
            const meta = getChannelMeta(item.type as any, item.id);
            return { ...item, ...meta };
        });

        const filtered = listWithMeta.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
        return filtered.sort((a, b) => {
            if (a.isSaved) return -1;
            if (b.isSaved) return 1;
            return b.timestamp - a.timestamp;
        });

    }, [messages, users, groups, searchTerm, currentUser.username, lastReadMap, sidebarTab]);

    // --- ACTION HANDLERS ---
    
    const toggleMsgSelection = (id: string) => {
        if (selectedMsgIds.includes(id)) {
            setSelectedMsgIds(prev => prev.filter(i => i !== id));
        } else {
            setSelectedMsgIds(prev => [...prev, id]);
        }
    };

    const handleBulkDeleteChats = async () => {
        if(!confirm('آیا از حذف گفتگوهای انتخاب شده اطمینان دارید؟')) return;
        setIsSelectionMode(false);
        setSelectedChatIds([]);
    };

    const handleBulkDeleteMessages = async (forEveryone: boolean) => {
        if(!confirm(forEveryone ? 'حذف برای همه؟' : 'حذف برای من؟')) return;
        
        for (const id of selectedMsgIds) {
            await deleteMessage(id, forEveryone ? undefined : currentUser.username);
        }
        onRefresh();
        setIsMsgSelectionMode(false);
        setSelectedMsgIds([]);
    };

    const handleBulkForward = () => {
        if (selectedMsgIds.length === 0) return;
        const msgsToForward = messages.filter(m => selectedMsgIds.includes(m.id));
        if (msgsToForward.length > 0) {
            setPendingForward(msgsToForward[0]);
            setIsMsgSelectionMode(false);
            setSelectedMsgIds([]);
            setHideForwardSender(false);
            setShowForwardDestinationModal(true);
            pushModalHistory();
        }
    };

    const handleOpenChat = (item: any) => {
        if (isSelectionMode) {
            if (selectedChatIds.includes(item.id || 'public')) setSelectedChatIds(selectedChatIds.filter(i => i !== (item.id || 'public')));
            else setSelectedChatIds([...selectedChatIds, item.id || 'public']);
            return;
        }
        
        if (pendingForward || sharedFile) {
            setActiveChannel({ type: item.type, id: item.id });
            setMobileShowChat(true);
            setShowForwardDestinationModal(false); 
            pushChatHistory();
            return;
        }

        const type = item.type as 'public' | 'private' | 'group';
        const id = item.id;
        const readKey = type === 'public' ? 'public' : id;
        updateReadStatus(readKey);
        setActiveChannel({ type, id });
        
        setMobileShowChat(true);
        pushChatHistory();
        
        if (sidebarTab === 'tasks') setActiveTab('tasks');
        else setActiveTab('chat');
    };

    const handleSendMessage = async () => {
        if ((!inputText.trim() && !pendingForward && !sharedFile) || isUploading) return;
        
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

        let finalMessage = inputText;
        
        if (sharedFile) {
             processFile(sharedFile, sharedText, activeChannel);
             setSharedFile(null);
             setSharedText('');
             return;
        }

        const newMsg: ChatMessage = {
            id: generateUUID(),
            sender: currentUser.fullName,
            senderUsername: currentUser.username,
            role: currentUser.role,
            message: finalMessage,
            timestamp: Date.now(),
            recipient: activeChannel.type === 'private' ? activeChannel.id! : undefined,
            groupId: activeChannel.type === 'group' ? activeChannel.id! : undefined,
            replyTo: replyingTo ? {
                id: replyingTo.id,
                sender: replyingTo.sender,
                message: replyingTo.message || 'رسانه'
            } : undefined,
        };

        if (pendingForward) {
            let content = pendingForward.message || '';
            if (!hideForwardSender) content = `[بازارسال از ${pendingForward.sender}]:\n${content}`;
            if (finalMessage) newMsg.message = `${finalMessage}\n\n${content}`;
            else newMsg.message = content;
            if (pendingForward.attachment) newMsg.attachment = pendingForward.attachment;
            if (pendingForward.audioUrl) newMsg.audioUrl = pendingForward.audioUrl;
        }

        try {
            await sendMessage(newMsg);
            setInputText('');
            setReplyingTo(null);
            setPendingForward(null);
            setHideForwardSender(false);
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
            } catch (error) { alert('خطا در ارسال فایل.'); } finally { setIsUploading(false); }
        };
        reader.readAsDataURL(file);
    };
    
    // --- Message Interaction ---
    const handleMessageClick = (e: React.MouseEvent | React.TouchEvent, msg: ChatMessage) => {
        if (isMsgSelectionMode) {
            toggleMsgSelection(msg.id);
            return;
        }

        // On mobile, tap shows menu
        if (window.innerWidth < 768) {
            e.stopPropagation();
            e.preventDefault();
            let clientX, clientY;
            if ('touches' in e) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = (e as React.MouseEvent).clientX;
                clientY = (e as React.MouseEvent).clientY;
            }
            // Add offset for touch visibility
            setContextMenu({ x: clientX, y: clientY + 20, msg });
        }
    };

    const triggerMenuDesktop = (e: React.MouseEvent, msg: ChatMessage) => {
        e.stopPropagation();
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, msg });
    };

    // --- Direct Reply/Forward Handlers (for new side buttons) ---
    const handleQuickReply = (msg: ChatMessage) => {
        setReplyingTo(msg);
        inputAreaRef.current?.focus();
    };

    const handleQuickForward = (msg: ChatMessage) => {
        setPendingForward(msg);
        setHideForwardSender(false);
        setShowForwardDestinationModal(true);
        pushModalHistory();
    };

    const onActionEdit = () => {
        if (!contextMenu) return;
        if (contextMenu.msg.senderUsername !== currentUser.username) { alert('فقط پیام خودتان را می‌توانید ویرایش کنید.'); return; }
        setEditingMessageId(contextMenu.msg.id);
        setInputText(contextMenu.msg.message);
        setContextMenu(null);
        inputAreaRef.current?.focus();
    };

    const onActionReply = () => {
        if (!contextMenu) return;
        setReplyingTo(contextMenu.msg);
        setContextMenu(null);
        inputAreaRef.current?.focus();
    };

    const onActionForward = () => {
        if (!contextMenu) return;
        setPendingForward(contextMenu.msg);
        setHideForwardSender(false);
        setContextMenu(null);
        setShowForwardDestinationModal(true);
        pushModalHistory();
    };

    const onActionCopy = () => {
        if (!contextMenu) return;
        navigator.clipboard.writeText(contextMenu.msg.message);
        setContextMenu(null);
    };

    const onActionDelete = async (forEveryone: boolean) => {
        if (!contextMenu) return;
        await deleteMessage(contextMenu.msg.id, forEveryone ? undefined : currentUser.username);
        onRefresh();
        setContextMenu(null);
    };

    const handleCancelReplyForward = () => {
        setReplyingTo(null);
        setPendingForward(null);
        setHideForwardSender(false);
    };
    
    // --- HELPER: GET USER ONLINE STATUS ---
    const getUserStatusText = (targetUser: User | undefined) => {
        if (!targetUser) return 'آفلاین';
        if (!targetUser.lastSeen) return 'آفلاین';

        const diff = Date.now() - targetUser.lastSeen;
        
        // Online if active in last 2 minutes
        if (diff < 120000) return 'آنلاین';
        
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `آخرین بازدید ${minutes} دقیقه پیش`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `آخرین بازدید ${hours} ساعت پیش`;

        const d = new Date(targetUser.lastSeen);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);

        if (d.toDateString() === yesterday.toDateString()) {
             return `آخرین بازدید دیروز ${d.toLocaleTimeString('fa-IR', {hour: '2-digit', minute:'2-digit'})}`;
        } else {
             return `آخرین بازدید ${d.toLocaleDateString('fa-IR')}`;
        }
    };

    // --- Dynamic Background Style ---
    const backgroundStyle = useMemo(() => {
        // Standard Telegram-like pattern if no custom background
        const defaultPattern = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`;

        const style: React.CSSProperties = {
            backgroundColor: '#e6ebee', // Default light chat color
            backgroundImage: defaultPattern,
            backgroundSize: 'auto',
            backgroundRepeat: 'repeat',
            backgroundAttachment: 'fixed',
            position: 'absolute',
            inset: 0,
            zIndex: 0
        };

        if (currentUser.chatBackground) {
            style.backgroundImage = `url(${currentUser.chatBackground})`;
            style.backgroundSize = 'cover';
            style.backgroundPosition = 'center';
            style.backgroundColor = 'transparent';
        } else if (systemSettings?.defaultChatBackground) {
             style.backgroundImage = `url(${systemSettings.defaultChatBackground})`;
             style.backgroundSize = 'cover';
             style.backgroundPosition = 'center';
             style.backgroundColor = 'transparent';
        }
        
        return style;
    }, [currentUser.chatBackground, systemSettings?.defaultChatBackground]);

    return (
        <div className="flex h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] bg-white overflow-hidden rounded-xl border border-gray-200 shadow-sm relative">
            
            {/* --- SIDEBAR --- */}
            <div className={`absolute inset-0 md:static md:w-80 bg-white border-l border-gray-200 flex flex-col z-20 transition-transform duration-300 ${mobileShowChat ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                {/* Header */}
                <div className="p-3 border-b flex flex-col gap-3 bg-gray-50">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            {isSelectionMode ? (
                                <button onClick={() => { setIsSelectionMode(false); setSelectedChatIds([]); }} className="text-gray-600 hover:text-red-500">
                                    <X size={20}/>
                                </button>
                            ) : (
                                <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-blue-200">
                                    {currentUser.fullName.charAt(0)}
                                </div>
                            )}
                            <span className="font-bold text-gray-800">{isSelectionMode ? `${selectedChatIds.length} انتخاب شده` : 'پیام‌ها'}</span>
                        </div>
                        <div className="flex gap-2">
                            {isSelectionMode ? (
                                <button onClick={handleBulkDeleteChats} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={18}/></button>
                            ) : (
                                <>
                                    <button onClick={() => setIsSelectionMode(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"><CheckSquare size={18}/></button>
                                    {sidebarTab === 'groups' && <button onClick={() => setShowGroupModal(true)} className="p-2 text-blue-600 bg-white rounded-full hover:bg-blue-50 shadow-sm"><Plus size={18}/></button>}
                                </>
                            )}
                        </div>
                    </div>
                    {/* Tabs & Search */}
                    {!isSelectionMode && (
                        <>
                            <div className="flex bg-gray-200 p-1 rounded-lg">
                                <button onClick={() => setSidebarTab('private')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sidebarTab === 'private' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>شخصی</button>
                                <button onClick={() => setSidebarTab('groups')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sidebarTab === 'groups' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>گروه‌ها</button>
                                <button onClick={() => setSidebarTab('tasks')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${sidebarTab === 'tasks' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}>تسک‌ها</button>
                            </div>
                            <div className="relative">
                                <Search size={16} className="absolute right-3 top-2.5 text-gray-400"/>
                                <input className="w-full bg-white border border-gray-200 rounded-xl py-2 pr-9 pl-3 text-sm focus:border-blue-400 outline-none" placeholder="جستجو..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {sortedChatList.map(item => {
                        const isActive = activeChannel.type === item.type && activeChannel.id === item.id;
                        const isSelected = selectedChatIds.includes(item.id || 'public');
                        
                        return (
                            <div key={`${item.type}_${item.id}`} onClick={() => handleOpenChat(item)} className={`flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 ${isActive ? 'bg-blue-50 border-r-4 border-r-blue-600' : ''} ${isSelected ? 'bg-blue-100' : ''}`}>
                                {isSelectionMode && (
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}>
                                        {isSelected && <CheckSquare size={14} className="text-white"/>}
                                    </div>
                                )}
                                <div className="relative">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm overflow-hidden ${item.isSaved ? 'bg-sky-600' : item.type === 'public' ? 'bg-indigo-500' : item.type === 'group' ? 'bg-orange-500' : 'bg-gray-400'}`}>
                                        {item.isSaved ? <Bookmark size={20}/> : item.avatar ? <img src={item.avatar} className="w-full h-full object-cover"/> : (item.type === 'public' ? <Users size={22}/> : item.type === 'group' ? <Users size={20}/> : <UserIcon size={20}/>)}
                                    </div>
                                    {item.unreadCount > 0 && (
                                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-white shadow-sm font-bold z-10">
                                            {item.unreadCount > 99 ? '99+' : item.unreadCount}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1"><span className="font-bold text-gray-800 text-sm truncate">{item.name}</span>{item.timestamp > 0 && <span className="text-[10px] text-gray-400">{getPreviewTime(item.timestamp)}</span>}</div>
                                    <p className="text-xs text-gray-500 truncate flex items-center gap-1">{item.lastMsg ? item.lastMsg.message || 'فایل' : 'پیامی نیست'}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- CHAT AREA --- */}
            <div className={`absolute inset-0 md:static flex-1 min-w-0 flex flex-col z-30 transition-transform duration-300 ${mobileShowChat ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                
                {/* Background Image Layer */}
                <div style={backgroundStyle}></div>

                {/* Sticky Header - Fixed at Top */}
                <div className="bg-white/95 backdrop-blur-sm p-3 flex justify-between items-center shadow-sm z-40 sticky top-0 h-[64px] border-b border-gray-100">
                    {showInnerSearch ? (
                        <div className="flex-1 flex items-center bg-gray-100 rounded-lg mx-2 px-2 animate-fade-in">
                            <Search size={18} className="text-gray-400"/>
                            <input
                                ref={innerSearchInputRef}
                                className="flex-1 bg-transparent border-none outline-none text-sm p-2"
                                placeholder="جستجو در این گفتگو..."
                                value={innerSearchTerm}
                                onChange={e => setInnerSearchTerm(e.target.value)}
                                autoFocus
                            />
                            <button onClick={() => { setShowInnerSearch(false); setInnerSearchTerm(''); }}><X size={18} className="text-gray-500 hover:text-red-500"/></button>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                {/* Use Back Button logic */}
                                <button onClick={() => { window.history.back(); }} className="md:hidden p-2 hover:bg-gray-100 rounded-full text-gray-600"><ArrowRight/></button>
                                
                                {isMsgSelectionMode ? (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setIsMsgSelectionMode(false); setSelectedMsgIds([]); }}><X size={20}/></button>
                                        <span className="font-bold">{selectedMsgIds.length} انتخاب شده</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col cursor-pointer" onClick={() => { if(activeChannel.type==='group') setActiveTab(activeTab==='chat'?'tasks':'chat') }}>
                                        <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                                            {activeChannel.id === currentUser.username ? 'پیام‌های ذخیره شده' : (activeChannel.type === 'public' ? 'کانال عمومی' : activeChannel.type === 'private' ? users.find(u=>u.username===activeChannel.id)?.fullName : groups.find(g=>g.id===activeChannel.id)?.name)}
                                        </h3>
                                        {/* Accuate Status Display */}
                                        <span className="text-xs font-medium text-gray-500">
                                            {activeChannel.id === currentUser.username ? 'شخصی' : 
                                             activeChannel.type === 'public' ? 'آنلاین' : 
                                             activeChannel.type === 'group' ? 'گروه' :
                                             getUserStatusText(users.find(u => u.username === activeChannel.id))}
                                        </span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-2">
                                {isMsgSelectionMode ? (
                                    <>
                                        <button onClick={handleBulkForward} className="p-2 hover:bg-gray-100 rounded-full"><CornerUpRight size={20}/></button>
                                        <button onClick={() => handleBulkDeleteMessages(false)} className="p-2 hover:bg-red-50 text-red-500 rounded-full"><Trash2 size={20}/></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => setShowInnerSearch(true)} className="p-2 hover:bg-gray-100 rounded-full"><Search size={20}/></button>
                                        <button onClick={() => setIsMsgSelectionMode(true)} className="p-2 hover:bg-gray-100 rounded-full"><CheckSquare size={20}/></button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Messages List - Scrollable Area */}
                {activeTab === 'chat' ? (
                    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative z-10" ref={chatContainerRef}>
                        {displayMsgs.map((msg) => {
                            const isMe = msg.senderUsername === currentUser.username;
                            const isSelected = selectedMsgIds.includes(msg.id);
                            
                            return (
                                <div 
                                    key={msg.id} 
                                    id={`msg-${msg.id}`} 
                                    className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-3 group relative items-end`}
                                    onClick={(e) => {
                                        if (isMsgSelectionMode) {
                                            e.stopPropagation();
                                            toggleMsgSelection(msg.id);
                                        }
                                    }}
                                >
                                    {/* Selection Checkbox */}
                                    {isMsgSelectionMode && (
                                        <div className={`flex items-center justify-center mx-2 ${isMe ? 'order-first' : 'order-last'}`}>
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-green-500 border-green-500' : 'bg-white/50 border-gray-400'}`}>
                                                {isSelected && <CheckCheck size={12} className="text-white"/>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Message Bubble - Tap to open menu on mobile */}
                                    <div 
                                        className={`relative max-w-[85%] md:max-w-[70%] lg:max-w-[60%] rounded-2xl px-4 py-3 shadow-sm text-sm cursor-pointer select-none ${isMe ? 'bg-[#EEFFDE] rounded-tr-none' : 'bg-white rounded-tl-none'} ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
                                        onClick={(e) => handleMessageClick(e, msg)}
                                        onContextMenu={(e) => triggerMenuDesktop(e, msg)}
                                    >
                                        
                                        {/* Hover Menu Button (Desktop Only) */}
                                        <button 
                                            className={`absolute top-1 ${isMe ? 'left-1' : 'right-1'} p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-black/5 z-20 transition-all opacity-0 group-hover:opacity-100 hidden md:block`}
                                            onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, msg }); }}
                                        >
                                            <MoreVertical size={14} />
                                        </button>

                                        {/* Reply/Quote */}
                                        {msg.replyTo && (
                                            <div className={`mb-2 px-2 py-1.5 rounded-lg border-r-4 text-xs opacity-80 truncate ${isMe ? 'bg-green-100 border-green-600' : 'bg-gray-100 border-blue-600'}`}>
                                                <span className="font-bold block mb-0.5">{msg.replyTo.sender}</span>
                                                <span>{msg.replyTo.message}</span>
                                            </div>
                                        )}

                                        {!isMe && activeChannel.type !== 'private' && (
                                            <div className="text-xs font-bold text-orange-700 mb-1">{msg.sender}</div>
                                        )}

                                        {msg.audioUrl && (
                                            <div className="flex items-center gap-2 min-w-[180px] py-1">
                                                <audio controls src={msg.audioUrl} className="h-8 w-full opacity-90 custom-audio-player" />
                                            </div>
                                        )}

                                        {msg.attachment && (
                                            <div className="mb-2">
                                                {msg.attachment.fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                    <img src={msg.attachment.url} alt="attachment" className="max-w-full h-auto rounded-lg max-h-72 object-cover" />
                                                ) : (
                                                    <div className="flex items-center gap-3 bg-black/5 p-3 rounded-lg border border-black/5">
                                                        <div className="p-2 rounded-full bg-blue-500 text-white"><File size={20}/></div>
                                                        <div className="truncate font-bold text-xs">{msg.attachment.fileName}</div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {msg.message && <div className="whitespace-pre-wrap leading-relaxed break-words text-[15px]">{msg.message}</div>}

                                        <div className="flex justify-end items-center gap-1 mt-1 opacity-50 text-[10px] font-medium">
                                            {msg.isEdited && <span className="mr-1">ویرایش شده</span>}
                                            <span>{new Date(msg.timestamp).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'})}</span>
                                            {isMe && <CheckCheck size={14} className="text-green-600 ml-0.5"/>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                ) : (
                    <div className="flex-1 p-4 bg-gray-100 text-center text-gray-500">تسک‌ها</div>
                )}

                {/* Input Area */}
                {activeTab === 'chat' && (
                    <div className="bg-white/95 backdrop-blur-sm p-2 flex flex-col border-t relative z-20">
                        {/* Reply / Forward Preview - Compact */}
                        {(replyingTo || pendingForward) && (
                            <div className="bg-gray-50 px-3 py-2 rounded-t-lg border-b border-gray-200 flex justify-between items-center text-xs animate-slide-up">
                                <div className="flex items-center gap-2 truncate">
                                    <div className={`w-1 h-8 rounded-full ${replyingTo ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                                    <div className="flex flex-col truncate">
                                        <span className={`font-bold ${replyingTo ? 'text-blue-600' : 'text-green-600'}`}>
                                            {replyingTo ? `پاسخ به ${replyingTo.sender}` : `فوروارد از ${pendingForward?.sender}`}
                                        </span>
                                        <span className="text-gray-500 truncate max-w-[200px]">
                                            {replyingTo ? replyingTo.message : (hideForwardSender ? 'بدون نقل قول' : pendingForward?.message)}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={handleCancelReplyForward} className="text-gray-400 hover:text-red-500 p-1"><X size={16}/></button>
                            </div>
                        )}

                        <div className="flex items-end gap-2 pt-2">
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} disabled={isUploading}/>
                            <button onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-500 hover:bg-gray-100 rounded-full transition-colors mb-1">
                                {isUploading ? <Loader2 size={24} className="animate-spin text-blue-500"/> : <Paperclip size={24}/>}
                            </button>

                            <div className="flex-1 bg-gray-100 rounded-3xl flex items-center px-4 py-2 min-h-[48px] border border-transparent focus-within:border-blue-400 transition-all">
                                <textarea 
                                    ref={inputAreaRef}
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                                    placeholder="پیام خود را بنویسید..."
                                    className="bg-transparent border-none outline-none w-full text-sm resize-none max-h-32"
                                    rows={1}
                                    style={{ height: 'auto', minHeight: '24px' }}
                                />
                            </div>

                            <button onClick={handleSendMessage} className="p-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-transform active:scale-95 mb-1">
                                <Send size={20} className={document.dir === 'rtl' ? 'rotate-180' : ''}/>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Context Menu (Action Sheet) */}
            {contextMenu && (
                <>
                {/* Backdrop for mobile */}
                <div className="fixed inset-0 z-40 bg-black/20 md:hidden" onClick={() => setContextMenu(null)}></div>
                <div 
                    className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 w-48 animate-scale-in md:w-48 w-[200px] left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto"
                    style={window.innerWidth >= 768 ? { top: Math.min(contextMenu.y, window.innerHeight - 220), left: contextMenu.x > window.innerWidth / 2 ? contextMenu.x - 192 : contextMenu.x } : { bottom: '80px' }} // Mobile: Bottom Sheet style or center
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={onActionReply} className="w-full text-right px-4 py-2.5 hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-700"><Reply size={16}/> پاسخ</button>
                    <button onClick={onActionForward} className="w-full text-right px-4 py-2.5 hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-700"><CornerUpRight size={16}/> فوروارد</button>
                    <button onClick={onActionCopy} className="w-full text-right px-4 py-2.5 hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-700"><Copy size={16}/> کپی متن</button>
                    {contextMenu.msg.senderUsername === currentUser.username && (
                        <button onClick={onActionEdit} className="w-full text-right px-4 py-2.5 hover:bg-gray-100 flex items-center gap-2 text-sm text-amber-600"><Edit2 size={16}/> ویرایش</button>
                    )}
                    <div className="border-t my-1"></div>
                    <button onClick={() => onActionDelete(false)} className="w-full text-right px-4 py-2.5 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600"><Trash2 size={16}/> حذف برای من</button>
                    {(contextMenu.msg.senderUsername === currentUser.username || currentUser.role === UserRole.ADMIN) && (
                        <button onClick={() => onActionDelete(true)} className="w-full text-right px-4 py-2.5 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600 font-bold"><Trash2 size={16}/> حذف برای همه</button>
                    )}
                </div>
                </>
            )}

            {/* Forward Destination Modal */}
            {showForwardDestinationModal && (
                <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in">
                    <div className="p-3 border-b flex justify-between items-center bg-gray-50">
                        <span className="font-bold">ارسال به ...</span>
                        <button onClick={() => { setShowForwardDestinationModal(false); setPendingForward(null); setSharedFile(null); setHideForwardSender(false); window.history.back(); }}><X/></button>
                    </div>
                    
                    <div className="p-2 bg-blue-50 text-xs text-blue-800 mb-2 mx-2 rounded border border-blue-100">
                        {sharedFile ? `فایل: ${sharedFile.name}` : `پیام: ${pendingForward?.message?.substring(0, 30)}...`}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto">
                        {sortedChatList.map(item => (
                            <div key={item.id} onClick={() => handleOpenChat(item)} className="flex items-center gap-3 p-3 border-b hover:bg-gray-50 cursor-pointer">
                                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-white"><UserIcon/></div>
                                <span className="font-bold text-sm">{item.name}</span>
                            </div>
                        ))}
                    </div>
                    
                    {/* Toggle: Hide Sender (Quote) */}
                    <div 
                        className="p-4 border-t bg-gray-50 flex items-center gap-3 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => setHideForwardSender(!hideForwardSender)}
                    >
                         <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${hideForwardSender ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400'}`}>
                             {hideForwardSender && <CheckCheck size={12} className="text-white"/>}
                         </div>
                         <div className="flex flex-col">
                             <span className="text-sm font-bold text-gray-800">مخفی کردن نام فرستنده (بدون نقل قول)</span>
                             <span className="text-[10px] text-gray-500">{hideForwardSender ? 'پیام به نام شما ارسال می‌شود' : 'پیام با نام نویسنده اصلی ارسال می‌شود'}</span>
                         </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ChatRoom;
