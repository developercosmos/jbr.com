"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, Edit, MoreVertical, Paperclip, ShoppingBag, Smile, Send, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock Data
const conversations = [
    {
        id: 1,
        name: "Sarah Tennis",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuD57KBrW9H11lKFtCtp7VcixYT-ya1Hfjqc5w9zUs_17RhIkk_F99rht_DaLRL9y2in_xafEZ-XlDsKeGM2ULkaVBuOlf8PXCm3XFbnDRGo787WGkafeJiEUsjMCfxpss9bzkdul_KXTXe41Xzi7zFhh3mp3Aq72ebG4ksZhbrl1Kj4TnJ8dcqkc8SPcGNlHrSDQMhzvgYmrhpwNksdZx0jFCS7ZD55VvdKjOC7kY5-A7ICQg8AqFrG0Jtfx2BLXNfPjRInVSgb95A",
        lastMessage: "Is the grip still tacky?",
        time: "10:30 AM",
        unread: 0,
        online: true,
        verified: true,
    },
    {
        id: 2,
        name: "Budi Sports",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuBa8mSsHAuFonF5g3Za58AIyEY6kwasp0Bw7Q5YUa7Gd1j1aoe9kycxZYsmqKjDLe89pcVKa5S9MYoD7lqnMlzjqWQMXAEreacd9rPUQPcCne8JRaEAGE8dviTcXyPMJU8OR-ZRp_sIyUOEVbHTGzMlCtdWyoAEZP8VMFB4T-wrYiorZr2tVHGMB8jBw9q94oiaKylWvVKAj6dUvCVNcJSAyuWSX7QGQgmDG05kpxGVftN8_UshxXadMHP_6AgrdEqOtb32mThc7cw",
        lastMessage: "Can you do $50 for the set?",
        time: "Yesterday",
        unread: 2,
        online: false,
        verified: false,
    },
    {
        id: 3,
        name: "Mike Badminton",
        avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuD9lcC_gyEv_1Dkn8vG-VUheNVIhACHnM8yVUs8-s7woQFgs6mpRFPzmCz9Y-aLezAhkj74yLKNxc31zasTqAniH27ZBUvUyQjLYzNeG3qJhL17IA9Z_uxA0oTC6K2tGfO9KJ7L9jJKBZ01j-Vos8BxeUIhfVYMmwatOvy0TkkO5TPFMQTsN07G2IeMf30XhdCx2RuuBqi54vv0DHJai03Ukias2GZhFbKDklaJyCJNftrKFa9tIYonxZg1hCP4qJCxV6xb9PkACiE",
        lastMessage: "Thanks for the quick delivery!",
        time: "Tue",
        unread: 0,
        online: false,
        verified: false,
    },
];

const messages = [
    {
        id: 1,
        sender: "other",
        text: "Hi there! Is this racket still available?",
        time: "10:15 AM",
    },
    {
        id: 2,
        sender: "me",
        text: "Yes, it's ready to ship. I just restrung it last week.",
        time: "10:18 AM",
        status: "read",
    },
    {
        id: 3,
        sender: "other",
        text: "Great! Is the grip still tacky? Also, can you send a closeup of the scratch you mentioned?",
        time: "10:25 AM",
    },
    {
        id: 4,
        sender: "me",
        text: "Here is the close up. The grip is original, slightly worn but still very usable.",
        image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBa-Pa_MvjS5XOy_Ud6ig8KLMMqB1DZcaRlTFhez3OSFCLG1iM0OBLv1UN4KOG6O51ZRb-793z52SRD7EbDU_V3Dt4OEKsZ5S9qaau2g3FBhvro0R4IptD2MUYsdawLSiPEacNhzNpgcPq5le4KrrMm_MrT--pUtXVGdPsZCu5S0BwUCZQ6ZJgWo4G8UapcZGeuU7hVPAkzPICWaNBL7bLue4E_sDGQOC6DFpth0K_ZGCfqx47KnJK07Nyrbd8B3d-_K0BgK7PqPgo",
        time: "10:28 AM",
        status: "sent",
    },
];

export default function ChatPage() {
    const [activeChat, setActiveChat] = useState(1);

    return (
        <div className="fixed top-[65px] md:top-[105px] bottom-0 left-0 right-0 flex overflow-hidden bg-slate-50">
            {/* Sidebar */}
            <aside className="w-full md:w-1/3 lg:w-[360px] flex flex-col border-r border-slate-200 bg-white z-10">
                <div className="p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-center px-1">
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase">Messages</h1>
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
                    {conversations.map((chat) => (
                        <div
                            key={chat.id}
                            onClick={() => setActiveChat(chat.id)}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-l-4",
                                activeChat === chat.id
                                    ? "bg-blue-50 border-brand-primary"
                                    : "hover:bg-slate-50 border-transparent"
                            )}
                        >
                            <div className="relative shrink-0">
                                <div className="relative h-12 w-12 rounded-full overflow-hidden border border-slate-100">
                                    <Image src={chat.avatar} alt={chat.name} fill className="object-cover" />
                                </div>
                                {chat.online && (
                                    <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-white rounded-full"></div>
                                )}
                            </div>
                            <div className="flex flex-col justify-center flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-slate-900 text-sm font-bold truncate">{chat.name}</p>
                                        {chat.verified && <CheckCheck className="w-3.5 h-3.5 text-brand-primary" />}
                                    </div>
                                    <span className="text-[10px] font-medium text-slate-400">{chat.time}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className={cn("text-xs truncate max-w-[180px]", chat.unread > 0 ? "text-slate-900 font-semibold" : "text-slate-500")}>
                                        {chat.lastMessage}
                                    </p>
                                    {chat.unread > 0 && (
                                        <span className="flex items-center justify-center h-4 min-w-[16px] px-1 bg-brand-primary text-white text-[9px] font-bold rounded-full">
                                            {chat.unread}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="hidden md:flex flex-1 flex-col relative bg-slate-100/50">
                {/* Chat Header */}
                <div className="flex-none flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 z-20 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="relative h-10 w-10 rounded-full overflow-hidden border border-slate-100">
                                <Image
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCwMhnTxkU39OZcBzkGXc0JD3POuCyM5R6UBZheVTqYQ_xBk0F-tmVFLaCPuuwkA9LaHHbVHbRarujUByPjRFYcMmge95FShdkmzndkA8wEZUAw89Z_2u-WgKWQYBYeut0RhACug3fY5rNeiT0jidAnvW9JJ2rtzc8JtKohRbf4XOIogvha-0mhmYlPk-e7ohYbOwFIhtXns-AQp7BkX0Hu90uA-wawXAHDw6_eYgWyN0YvO0QM25U2vz4X_PCosWpyO-d5KP1-BSo"
                                    alt="Sarah Tennis"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h3 className="font-bold text-slate-900 text-sm">Sarah Tennis</h3>
                                <CheckCheck className="w-3.5 h-3.5 text-brand-primary" />
                            </div>
                            <p className="text-[10px] text-green-600 font-medium">Online</p>
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
                <div className="flex-1 p-6 flex flex-col gap-6 relative overflow-y-auto">
                    {/* Product Context Card */}
                    <div className="sticky top-0 z-10 self-center w-full max-w-md">
                        <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-sm border border-slate-200 p-3 flex gap-3 items-center">
                            <div className="relative h-14 w-14 rounded-lg overflow-hidden shrink-0 bg-slate-100">
                                <Image
                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAHvywbzwwYxld3nkksDFg33tLurhJ4q79GR7Yaq1vxuqHJfkaUL0YYWJubEVEXbR0Foq09rDGdUDLRdi0bcm3i-sbk_hog8QoOGv10nXUJ8_ZA-dxnOxB8D6PzKSGP4ZosuHcfMuzMCgktYcRzuwAd2qmuE7b54LwnvFC9RJ8UvsP-B1NTnMHP8PhKeC8iEzYp1m_0ygxq-Aje2XutoJ4q3Oyit-9FpNWv1Yqy3QNPvbjMCvPWIsf6aQzAUZafZJIJZGzN7YIO9TE"
                                    alt="Product"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-100">
                                        Pre-loved - Good
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-slate-900 truncate">Yonex Ezone 98 Tennis Racket</h4>
                                <p className="text-xs font-bold text-brand-primary">Rp 1.500.000</p>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <button className="px-3 py-1.5 bg-brand-primary hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition-colors shadow-sm">
                                    Buy Now
                                </button>
                                <button className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[10px] font-bold rounded-lg transition-colors">
                                    Offer
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center my-2">
                        <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                            Today
                        </span>
                    </div>

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex flex-col gap-1 max-w-[80%] group",
                                msg.sender === "me" ? "self-end items-end" : "self-start"
                            )}
                        >
                            <div className={cn("flex items-end gap-2", msg.sender === "me" && "flex-row-reverse")}>
                                {msg.sender === "other" && (
                                    <div className="relative h-8 w-8 rounded-full overflow-hidden shrink-0 mb-1 border border-slate-100">
                                        <Image
                                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBk9zvSFp4slQjkpVNTBREMMD9XFyFCaC65Uc7jxYNOskqBV2lnys960jQcXF2ZfFpCZMg-l8dOLRlQ-R-mzuTcWTdVTZLbHWSnM-M3CO5a4e3Wzl_M2fo4L0WukB6y8fvxRl5l8jfl9DvIsIto_Pm80m_-u7N4j0tRT97rZ3GUnbEWkIIeWYZ4VScLpZ_DBEv16orEiCC8KJuJiwQ7kLmxYeDUuBaJTSgr64r6YV0RSHmxaZztsiVHc__mZCED7-Jenp6X9BVFrMo"
                                            alt="Sender"
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                )}
                                <div
                                    className={cn(
                                        "relative p-3 shadow-sm",
                                        msg.sender === "me"
                                            ? "bg-brand-primary text-white rounded-2xl rounded-br-none"
                                            : "bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-bl-none"
                                    )}
                                >
                                    {msg.image && (
                                        <div className="rounded-lg overflow-hidden mb-2 relative w-full h-auto max-w-[280px] aspect-[4/3] border border-black/5">
                                            <Image src={msg.image} alt="Attachment" fill className="object-cover" />
                                        </div>
                                    )}
                                    <p className="text-sm leading-relaxed">{msg.text}</p>
                                </div>
                            </div>
                            <div className={cn("flex items-center gap-1 text-[10px] text-slate-400 font-medium", msg.sender === "other" && "pl-12", msg.sender === "me" && "pr-1")}>
                                <span>{msg.time}</span>
                                {msg.sender === "me" && (
                                    msg.status === "read" ? <CheckCheck className="w-3 h-3 text-brand-primary" /> : <Check className="w-3 h-3 text-slate-400" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="flex-none p-4 bg-white border-t border-slate-200 z-20">
                    <div className="flex items-end gap-2 max-w-4xl mx-auto">
                        <button className="p-2.5 text-slate-400 hover:text-brand-primary hover:bg-slate-50 rounded-xl transition-colors shrink-0">
                            <Paperclip className="w-5 h-5" />
                        </button>
                        <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-200 focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary transition-all flex items-center min-h-[44px] px-4 py-2">
                            <textarea
                                className="w-full bg-transparent border-none p-0 focus:ring-0 text-slate-900 placeholder:text-slate-400 resize-none max-h-32 text-sm leading-relaxed"
                                placeholder="Type a message..."
                                rows={1}
                            />
                            <button className="ml-2 text-slate-400 hover:text-brand-primary transition-colors">
                                <Smile className="w-5 h-5" />
                            </button>
                        </div>
                        <button className="p-2.5 bg-brand-primary hover:bg-blue-700 text-white rounded-full shadow-md shadow-brand-primary/20 transition-transform active:scale-95 shrink-0 flex items-center justify-center">
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
