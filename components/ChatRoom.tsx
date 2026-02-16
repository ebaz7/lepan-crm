import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage } from '../types';
import { sendMessage, getMessages, deleteMessage, updateMessage, uploadFile } from '../services/storageService';
import { generateUUID } from '../constants';
import { Send, MoreVertical, Search, ArrowLeft, Reply, CornerUpRight, Trash2, Copy, Edit2, Check, CheckCheck, Paperclip, Mic, X, Smile, Download } from 'lucide-react';

interface ChatRoomProps {
    currentUser: User;
    preloadedMessages: ChatMessage[];
    onRefresh: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ currentUser, preloadedMessages, onRefresh }) => {
    const [messages, setMessages] = useState<ChatMessage[]>(preloadedMessages || []);
    const [inputText, setInputText] = useState('');
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setMessages(preloadedMessages);
        scrollToBottom();
    }, [preloadedMessages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;

        const newMessage: ChatMessage = {
            id: generateUUID(),
            sender: currentUser.fullName,
            senderUsername: currentUser.username,
            role: currentUser.role,
            message: inputText,
            timestamp: Date.now(),
            replyTo: replyTo ? { id: replyTo.id, sender: replyTo.sender, message: replyTo.message } : undefined
        };

        try {
            await sendMessage(newMessage);
            setInputText('');
            setReplyTo(null);
            onRefresh();
        } catch (error) {
            console.error("Send error", error);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target?.result as string;
            try {
                const result = await uploadFile(file.name, base64);
                const newMessage: ChatMessage = {
                    id: generateUUID(),
                    sender: currentUser.fullName,
                    senderUsername: currentUser.username,
                    role: currentUser.role,
                    message: '', // Attachment message
                    attachment: { fileName: result.fileName, url: result.url },
                    timestamp: Date.now()
                };
                await sendMessage(newMessage);
                onRefresh();
            } catch (err) {
                alert('Upload failed');
            } finally {
                setIsUploading(false);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleMessageClick = (e: React.MouseEvent, msg: ChatMessage) => {
        e.stopPropagation();
        if (selectedMessage?.id === msg.id) {
            setSelectedMessage(null);
        } else {
            setSelectedMessage(msg);
        }
    };

    const handleDeleteMessage = async (msg: ChatMessage, forEveryone: boolean) => {
        if (!confirm('آیا مطمئن هستید؟')) return;
        await deleteMessage(msg.id, forEveryone ? undefined : currentUser.username);
        setSelectedMessage(null);
        onRefresh();
    };

    const handleQuickReply = (msg: ChatMessage) => {
        setReplyTo(msg);
        setSelectedMessage(null);
    };

    const handleQuickForward = (msg: ChatMessage) => {
        // Mock forward functionality
        const forwardedText = `Forwarded from ${msg.sender}: ${msg.message}`;
        setInputText(forwardedText);
        setSelectedMessage(null);
    };

    const triggerMenuDesktop = (e: React.MouseEvent, msg: ChatMessage) => {
        e.preventDefault();
        setSelectedMessage(msg);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] bg-[#efe7dd] relative overflow-hidden rounded-xl shadow-inner" 
             style={currentUser.chatBackground ? { backgroundImage: `url(${currentUser.chatBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
            
            {/* Header */}
            <div className="bg-white p-3 shadow-sm flex justify-between items-center z-10 border-b">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">
                        {currentUser.fullName.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800">گفتگوی سازمانی</h3>
                        <span className="text-xs text-green-600 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> آنلاین
                        </span>
                    </div>
                </div>
                <div className="flex gap-2 text-gray-500">
                    <Search size={20} />
                    <MoreVertical size={20} />
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 relative" onClick={() => setSelectedMessage(null)}>
                {messages.map((msg) => {
                    const isMe = msg.senderUsername === currentUser.username;
                    const isSelected = selectedMessage?.id === msg.id;
                    const isHidden = msg.hiddenFor?.includes(currentUser.username);

                    if (isHidden) return null;

                    return (
                        <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group`}>
                            <div 
                                className={`relative max-w-[85%] md:max-w-[70%] lg:max-w-[60%] rounded-2xl px-4 py-3 shadow-sm text-sm cursor-pointer select-none transition-all ${isMe ? 'bg-[#EEFFDE] rounded-tr-none' : 'bg-white rounded-tl-none'} ${isSelected ? 'ring-2 ring-blue-400 z-20' : ''}`}
                                onClick={(e) => handleMessageClick(e, msg)}
                                onContextMenu={(e) => triggerMenuDesktop(e, msg)}
                            >
                                {/* Reply Context */}
                                {msg.replyTo && (
                                    <div className={`mb-2 text-xs border-l-4 pl-2 rounded py-1 bg-black/5 ${isMe ? 'border-green-600' : 'border-blue-600'}`}>
                                        <div className={`font-bold ${isMe ? 'text-green-800' : 'text-blue-800'}`}>{msg.replyTo.sender}</div>
                                        <div className="truncate opacity-70">{msg.replyTo.message || 'فایل ضمیمه'}</div>
                                    </div>
                                )}

                                {/* Hover Actions */}
                                <div className={`absolute -top-8 ${isMe ? 'left-0' : 'right-0'} hidden group-hover:flex items-center gap-1 bg-white shadow-md p-1 rounded-lg border border-gray-200 transition-all z-30`}>
                                    <button onClick={(e) => { e.stopPropagation(); handleQuickReply(msg); }} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-full" title="پاسخ"><Reply size={14}/></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleQuickForward(msg); }} className="p-1.5 hover:bg-green-50 text-green-600 rounded-full" title="فوروارد"><CornerUpRight size={14}/></button>
                                </div>

                                {/* Content */}
                                {msg.attachment ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 bg-gray-100 p-2 rounded">
                                            <div className="bg-white p-2 rounded-full"><Download size={16} /></div>
                                            <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline truncate max-w-[150px]" onClick={e => e.stopPropagation()}>{msg.attachment.fileName}</a>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap leading-relaxed">{msg.message}</div>
                                )}

                                {/* Footer */}
                                <div className="flex justify-end items-center gap-1 mt-1 opacity-60 text-[10px]">
                                    <span>{new Date(msg.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    {isMe && <CheckCheck size={14} className="text-blue-500" />}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Selection Toolbar (Mobile/Desktop) */}
            {selectedMessage && (
                <div className="absolute bottom-16 left-4 right-4 bg-white shadow-2xl rounded-xl p-2 flex justify-between items-center z-40 animate-slide-up border border-gray-200">
                    <div className="flex gap-2">
                        <button onClick={() => handleDeleteMessage(selectedMessage, true)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg flex flex-col items-center gap-1 text-xs">
                            <Trash2 size={20} />
                            <span>حذف برای همه</span>
                        </button>
                        <button onClick={() => handleDeleteMessage(selectedMessage, false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg flex flex-col items-center gap-1 text-xs">
                            <Trash2 size={20} />
                            <span>حذف برای من</span>
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => { navigator.clipboard.writeText(selectedMessage.message); setSelectedMessage(null); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg flex flex-col items-center gap-1 text-xs">
                            <Copy size={20} />
                            <span>کپی</span>
                        </button>
                        <button onClick={() => handleQuickReply(selectedMessage)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg flex flex-col items-center gap-1 text-xs">
                            <Reply size={20} />
                            <span>پاسخ</span>
                        </button>
                        <button onClick={() => setSelectedMessage(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                            <X size={24} />
                        </button>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="bg-white p-2 md:p-3 border-t flex flex-col gap-2 relative z-30">
                {replyTo && (
                    <div className="bg-gray-100 p-2 rounded-lg flex justify-between items-center mb-1 border-r-4 border-blue-500">
                        <div className="text-xs overflow-hidden">
                            <span className="font-bold text-blue-600 block mb-0.5">پاسخ به {replyTo.sender}</span>
                            <span className="text-gray-500 truncate block max-w-[250px]">{replyTo.message || 'فایل ضمیمه'}</span>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-500"><X size={16}/></button>
                    </div>
                )}
                
                <div className="flex items-end gap-2">
                    <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors shrink-0">
                        <Smile size={24} />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors shrink-0" disabled={isUploading}>
                        <Paperclip size={24} />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    
                    <div className="flex-1 bg-gray-100 rounded-2xl flex items-center px-4 py-2">
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="پیام خود را بنویسید..."
                            className="w-full bg-transparent border-none outline-none resize-none max-h-32 text-sm"
                            rows={1}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                        />
                    </div>
                    
                    {inputText.trim() ? (
                        <button onClick={handleSendMessage} className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-lg active:scale-90 shrink-0">
                            <Send size={20} className="rtl:rotate-180" />
                        </button>
                    ) : (
                        <button className="p-3 bg-teal-500 text-white rounded-full hover:bg-teal-600 transition-all shadow-lg active:scale-90 shrink-0">
                            <Mic size={20} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatRoom;