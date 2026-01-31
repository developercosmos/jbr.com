"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Edit, MoreVertical, Paperclip, Smile, Send, Check, CheckCheck, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMessages, sendMessage, getConversations } from "@/actions/chat";

type Conversation = {
    id: string;
    otherParty: {
        id: string;
        name: string;
        image: string | null;
    };
    product: {
        id: string;
        title: string;
        price: string;
        images: string[] | null;
        condition: string;
        condition_rating: number | null;
        slug: string;
    } | null;
    lastMessage: {
        content: string | null;
        createdAt: Date;
        isFromMe: boolean;
        isRead: boolean;
    } | null;
    lastMessageAt: Date;
};

type Message = {
    id: string;
    content: string | null;
    attachmentUrl: string | null;
    isFromMe: boolean;
    sender: {
        id: string;
        name: string;
        image: string | null;
    };
    isRead: boolean;
    createdAt: Date;
};

type ConversationData = {
    conversation: {
        id: string;
        otherParty: {
            id: string;
            name: string;
            image: string | null;
        };
        product: Conversation["product"];
    };
    messages: Message[];
    currentUserId: string;
};

function formatTime(date: Date) {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        return new Date(date).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    } else if (days === 1) {
        return "Yesterday";
    } else if (days < 7) {
        return new Date(date).toLocaleDateString("en-US", { weekday: "short" });
    } else {
        return new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    }
}

function formatPrice(price: string) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(parseFloat(price));
}

export function ChatClient({
    initialConversations,
    initialConversationId
}: {
    initialConversations: Conversation[];
    initialConversationId?: string | null;
}) {
    const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(
        initialConversationId || initialConversations[0]?.id || null
    );
    const [conversationData, setConversationData] = useState<ConversationData | null>(null);
    const [messageInput, setMessageInput] = useState("");
    const [isPending, startTransition] = useTransition();
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load messages when active conversation changes
    useEffect(() => {
        if (activeConversationId) {
            startTransition(async () => {
                try {
                    const data = await getMessages(activeConversationId);
                    setConversationData(data);
                } catch (error) {
                    console.error("Failed to load messages:", error);
                }
            });
        }
    }, [activeConversationId]);

    // Smart polling for real-time updates
    useEffect(() => {
        if (!activeConversationId) return;

        let isPolling = true;
        let timeoutId: NodeJS.Timeout;

        const pollMessages = async () => {
            if (!isPolling || document.hidden) {
                // Schedule next poll even if skipped
                timeoutId = setTimeout(pollMessages, 3000);
                return;
            }

            try {
                const data = await getMessages(activeConversationId);

                // Only update if there are new messages
                if (data.messages.length !== conversationData?.messages.length) {
                    setConversationData(data);
                }
            } catch (error) {
                console.error("Polling error:", error);
            }

            // Schedule next poll
            if (isPolling) {
                timeoutId = setTimeout(pollMessages, 3000);
            }
        };

        // Start polling after initial delay
        timeoutId = setTimeout(pollMessages, 3000);

        // Cleanup
        return () => {
            isPolling = false;
            clearTimeout(timeoutId);
        };
    }, [activeConversationId, conversationData?.messages.length]);

    // Poll conversations list for sidebar updates (less frequent)
    useEffect(() => {
        let isPolling = true;
        let timeoutId: NodeJS.Timeout;

        const pollConversations = async () => {
            if (!isPolling || document.hidden) {
                timeoutId = setTimeout(pollConversations, 5000);
                return;
            }

            try {
                const updatedConversations = await getConversations();
                setConversations(updatedConversations);
            } catch (error) {
                console.error("Conversations polling error:", error);
            }

            if (isPolling) {
                timeoutId = setTimeout(pollConversations, 5000);
            }
        };

        // Start polling after delay
        timeoutId = setTimeout(pollConversations, 5000);

        return () => {
            isPolling = false;
            clearTimeout(timeoutId);
        };
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversationData?.messages]);

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !activeConversationId || isSending) return;

        const content = messageInput.trim();
        setMessageInput("");
        setIsSending(true);

        try {
            const newMessage = await sendMessage(activeConversationId, content);

            // Add message to local state
            if (conversationData) {
                setConversationData({
                    ...conversationData,
                    messages: [
                        ...conversationData.messages,
                        {
                            id: newMessage.id,
                            content: newMessage.content,
                            attachmentUrl: newMessage.attachmentUrl,
                            isFromMe: true,
                            sender: {
                                id: conversationData.currentUserId,
                                name: "You",
                                image: null,
                            },
                            isRead: false,
                            createdAt: newMessage.createdAt,
                        },
                    ],
                });
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            setMessageInput(content); // Restore message on error
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const activeConversation = conversations.find((c) => c.id === activeConversationId);

    return (
        <div className="fixed top-[65px] md:top-[105px] bottom-0 left-0 right-0 flex overflow-hidden bg-slate-50">
            {/* Sidebar */}
            <aside className="w-full md:w-1/3 lg:w-[360px] flex flex-col border-r border-slate-200 bg-white z-10">
                <div className="p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-center px-1">
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase">
                            Messages
                        </h1>
                        <button className="text-brand-primary hover:text-blue-700 p-2 rounded-full hover:bg-slate-50 transition-colors">
                            <Edit className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-slate-400" />
                        </div>
                        <input
                            className="block w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary focus:outline-none transition-all text-slate-900"
                            placeholder="Search chats..."
                            type="text"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {conversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <MessageSquare className="w-12 h-12 text-slate-300 mb-4" />
                            <h3 className="font-bold text-slate-900 mb-2">No conversations yet</h3>
                            <p className="text-sm text-slate-500">
                                Start chatting with sellers by visiting a product page
                            </p>
                        </div>
                    ) : (
                        conversations.map((chat) => (
                            <div
                                key={chat.id}
                                onClick={() => setActiveConversationId(chat.id)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-l-4",
                                    activeConversationId === chat.id
                                        ? "bg-blue-50 border-brand-primary"
                                        : "hover:bg-slate-50 border-transparent"
                                )}
                            >
                                <div className="relative shrink-0">
                                    <div className="relative h-12 w-12 rounded-full overflow-hidden border border-slate-100 bg-slate-200">
                                        {chat.otherParty.image ? (
                                            <Image
                                                src={chat.otherParty.image}
                                                alt={chat.otherParty.name}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-brand-primary text-white font-bold">
                                                {chat.otherParty.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <p className="text-slate-900 text-sm font-bold truncate">
                                            {chat.otherParty.name}
                                        </p>
                                        <span className="text-[10px] font-medium text-slate-400">
                                            {chat.lastMessage ? formatTime(chat.lastMessage.createdAt) : ""}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-xs truncate max-w-[180px] text-slate-500">
                                            {chat.lastMessage?.isFromMe && "You: "}
                                            {chat.lastMessage?.content || "No messages yet"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="hidden md:flex flex-1 flex-col relative bg-slate-100/50">
                {!activeConversation ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="font-bold text-slate-900 mb-2">Select a conversation</h3>
                            <p className="text-sm text-slate-500">
                                Choose a chat from the sidebar to start messaging
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="flex-none flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 z-20 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="relative h-10 w-10 rounded-full overflow-hidden border border-slate-100 bg-slate-200">
                                    {activeConversation.otherParty.image ? (
                                        <Image
                                            src={activeConversation.otherParty.image}
                                            alt={activeConversation.otherParty.name}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-brand-primary text-white font-bold">
                                            {activeConversation.otherParty.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm">
                                        {activeConversation.otherParty.name}
                                    </h3>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                                <button className="p-2 hover:bg-slate-50 hover:text-brand-primary rounded-full transition-colors">
                                    <Search className="w-5 h-5" />
                                </button>
                                <button className="p-2 hover:bg-slate-50 hover:text-brand-primary rounded-full transition-colors">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 p-6 flex flex-col gap-4 relative overflow-y-auto">
                            {/* Product Context Card */}
                            {conversationData?.conversation.product && (
                                <div className="sticky top-0 z-10 self-center w-full max-w-md">
                                    <Link
                                        href={`/product/${conversationData.conversation.product.slug}`}
                                        className="block bg-white/90 backdrop-blur-md rounded-xl shadow-sm border border-slate-200 p-3 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex gap-3 items-center">
                                            <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                                                {conversationData.conversation.product.images?.[0] ? (
                                                    <Image
                                                        src={conversationData.conversation.product.images[0]}
                                                        alt={conversationData.conversation.product.title}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                        <User className="w-6 h-6" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-100">
                                                        {conversationData.conversation.product.condition === "NEW"
                                                            ? "New"
                                                            : `Pre-loved ${conversationData.conversation.product.condition_rating || ""}/10`}
                                                    </span>
                                                </div>
                                                <h4 className="text-sm font-bold text-slate-900 truncate">
                                                    {conversationData.conversation.product.title}
                                                </h4>
                                                <p className="text-xs font-bold text-brand-primary">
                                                    {formatPrice(conversationData.conversation.product.price)}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            )}

                            {isPending ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                                </div>
                            ) : conversationData?.messages.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center text-center">
                                    <div>
                                        <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500">No messages yet. Say hello!</p>
                                    </div>
                                </div>
                            ) : (
                                conversationData?.messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex flex-col gap-1 max-w-[80%] group",
                                            msg.isFromMe ? "self-end items-end" : "self-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "flex items-end gap-2",
                                                msg.isFromMe && "flex-row-reverse"
                                            )}
                                        >
                                            {!msg.isFromMe && (
                                                <div className="relative h-8 w-8 rounded-full overflow-hidden shrink-0 mb-1 border border-slate-100 bg-slate-200">
                                                    {msg.sender.image ? (
                                                        <Image
                                                            src={msg.sender.image}
                                                            alt={msg.sender.name}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-brand-primary text-white text-xs font-bold">
                                                            {msg.sender.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div
                                                className={cn(
                                                    "relative p-3 shadow-sm",
                                                    msg.isFromMe
                                                        ? "bg-brand-primary text-white rounded-2xl rounded-br-none"
                                                        : "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-bl-none"
                                                )}
                                            >
                                                {msg.attachmentUrl && (
                                                    <div className="rounded-lg overflow-hidden mb-2 relative w-full h-auto max-w-[280px] aspect-[4/3] border border-black/5">
                                                        <Image
                                                            src={msg.attachmentUrl}
                                                            alt="Attachment"
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                )}
                                                <p className="text-sm leading-relaxed">{msg.content}</p>
                                            </div>
                                        </div>
                                        <div
                                            className={cn(
                                                "flex items-center gap-1 text-[10px] text-slate-400 font-medium",
                                                !msg.isFromMe && "pl-12",
                                                msg.isFromMe && "pr-1"
                                            )}
                                        >
                                            <span>{formatTime(msg.createdAt)}</span>
                                            {msg.isFromMe &&
                                                (msg.isRead ? (
                                                    <CheckCheck className="w-3 h-3 text-brand-primary" />
                                                ) : (
                                                    <Check className="w-3 h-3 text-slate-400" />
                                                ))}
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="flex-none p-4 bg-white border-t border-slate-200 z-20">
                            <div className="flex items-end gap-2 max-w-4xl mx-auto">
                                <button className="p-2.5 text-slate-400 hover:text-brand-primary hover:bg-slate-50 rounded-xl transition-colors shrink-0">
                                    <Paperclip className="w-5 h-5" />
                                </button>
                                <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary transition-all flex items-center min-h-[44px] px-4 py-2">
                                    <textarea
                                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-slate-900 placeholder:text-slate-400 resize-none max-h-32 text-sm leading-relaxed focus:outline-none"
                                        placeholder="Type a message..."
                                        rows={1}
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onKeyDown={handleKeyPress}
                                        disabled={isSending}
                                    />
                                    <button className="ml-2 text-slate-400 hover:text-brand-primary transition-colors">
                                        <Smile className="w-5 h-5" />
                                    </button>
                                </div>
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!messageInput.trim() || isSending}
                                    className="p-2.5 bg-brand-primary hover:bg-blue-700 text-white rounded-full shadow-md shadow-brand-primary/20 transition-transform active:scale-95 shrink-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
