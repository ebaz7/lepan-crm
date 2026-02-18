
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChatMessage, ChatGroup, GroupTask, UserRole } from '../types';
import { sendMessage, deleteMessage, getGroups, createGroup, deleteGroup, getTasks, createTask, updateTask, deleteTask, uploadFile, updateMessage } from '../services/storageService';
import { getUsers } from '../services/authService';
import { generateUUID, formatDate } from '../constants';
import { 
    Send, User as UserIcon, MessageSquare, Users, Plus, ListTodo, Paperclip, 
    CheckSquare, Square, X, Trash2, Reply, Edit2, ArrowRight, Mic, 
    Play, Pause, Loader2, Search, MoreVertical, File, Image as ImageIcon,
    Check, CheckCheck, DownloadCloud, StopCircle, Share2, Copy, Forward, Eye, CornerUpLeft
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

    // --- Refs ---
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const inputAreaRef = useRef<HTMLTextAreaElement>(null);

    // --- Modals ---
    const [showGroupModal, setShowGroupModal] = useState(false);
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
            setTimeout(scrollToBottom, 150); // Slight delay for desktop rendering
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
            if (lastMsg.senderUsername !== currentUser.username && document.hidden) {
                let title = lastMsg.sender;
                if (lastMsg.groupId) {
                    const grp = groups.find(g => g.id === lastMsg.groupId);
                    if (grp) title = `${lastMsg.sender} @ ${grp.name}`;
                }
                sendNotification(title, lastMsg.message || 'پیام جدید');
            }
        }
    }, [messages.length]);

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

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // --- Helpers ---
    const getUnreadCount = (channelId: string, type: 'private' | 'group' | 'public') => {
        return messages.filter(m => {
            if (m.senderUsername === currentUser.username) return false;
            const isRead = m.readBy?.includes(currentUser.username);
            if (isRead) return false;
            
            if (type === 'private') {
                return (m.senderUsername === channelId && m