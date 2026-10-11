import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faPaperPlane,
    faMicrophone,
} from "@fortawesome/free-solid-svg-icons";

import {
    sendChatMessage,
    fetchConversations,
    fetchConversationMessages,
    deleteConversation,
} from "../../services/api";

import AISidebar from "../../components/layout/AISidebar.jsx";

function AISupport() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Conversations state
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);

    // Latest detected emotion and mental state
    const [detectedEmotion, setDetectedEmotion] = useState("neutral");
    const [mentalState, setMentalState] = useState("");

    // Safety
    const [sosModalOpen, setSosModalOpen] = useState(false);
    const [contacts, setContacts] = useState([]);
    const [selectedContacts, setSelectedContacts] = useState([]);
    const [sosSent, setSosSent] = useState(false);
    const navigate = useNavigate();

    const chatRef = useRef(null);

    // Load conversation list from backend MongoDB
    const loadConversations = async (autoSelectFirst = true) => {
        try {
            const convs = await fetchConversations();
            setConversations(convs || []);

            if (autoSelectFirst && convs && convs.length > 0) {
                const firstId = convs[0].conversation_id;
                setActiveConversationId(firstId);
                await loadMessagesForConversation(firstId);
            } else if (!activeConversationId && (!convs || convs.length === 0)) {
                setMessages([
                    {
                        text: "Hi, I'm here to support you 💜",
                        sender: "ai",
                    },
                ]);
            }
        } catch (e) {
            console.error("Failed to load conversations:", e);
        }
    };

    // Load messages for a specific conversation
    const loadMessagesForConversation = async (convId) => {
        try {
            setIsLoading(true);
            const history = await fetchConversationMessages(convId);
            if (history && history.length > 0) {
                const formatted = [];
                let lastEmotion = "neutral";
                let lastMentalState = "";

                history.forEach((h) => {
                    if (h.message) formatted.push({ text: h.message, sender: "user" });
                    if (h.response) {
                        formatted.push({
                            text: h.response,
                            sender: "ai",
                            emotion: h.emotion,
                            mental_state: h.mental_state,
                            top_emotions: h.top_emotions,
                            safety: h.safety,
                        });
                        if (h.emotion) lastEmotion = h.emotion;
                        if (h.mental_state) lastMentalState = h.mental_state;
                    }
                });

                setMessages(formatted);
                setDetectedEmotion(lastEmotion);
                setMentalState(lastMentalState);
            } else {
                setMessages([
                    {
                        text: "Hi, I'm here to support you 💜",
                        sender: "ai",
                    },
                ]);
            }
        } catch (e) {
            console.error("Failed to load conversation messages:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadConversations(true);
    }, []);

    // Handle selecting a conversation
    const handleSelectConversation = async (convId) => {
        if (convId === activeConversationId) return;
        setActiveConversationId(convId);
        await loadMessagesForConversation(convId);
    };

    // Handle starting a new chat
    const handleNewChat = () => {
        setActiveConversationId(null);
        setMessages([
            {
                text: "Hi, I'm here to support you 💜",
                sender: "ai",
            },
        ]);
        setDetectedEmotion("neutral");
        setMentalState("");
    };

    // Handle deleting a conversation
    const handleDeleteConversation = async (convId) => {
        if (!window.confirm("Are you sure you want to delete this conversation?")) return;

        try {
            await deleteConversation(convId);
            const updated = conversations.filter((c) => c.conversation_id !== convId);
            setConversations(updated);

            if (activeConversationId === convId) {
                if (updated.length > 0) {
                    const nextId = updated[0].conversation_id;
                    setActiveConversationId(nextId);
                    await loadMessagesForConversation(nextId);
                } else {
                    handleNewChat();
                }
            }
        } catch (e) {
            alert("Failed to delete conversation: " + e.message);
        }
    };

    useEffect(() => {
        const savedContacts = JSON.parse(localStorage.getItem("trustedContacts")) || [];
        setContacts(savedContacts.filter((c) => c.receive_sos));
    }, [sosModalOpen]);

    const handleOpenSos = () => {
        if (contacts.length === 0) {
            alert("You have no trusted contacts configured. Please set them up in Safe Place.");
            navigate("/safeplace");
            return;
        }
        setSosSent(false);
        setSelectedContacts(contacts.map((c) => c.id));
        setSosModalOpen(true);
    };

    const handleSendSos = async () => {
        setIsLoading(true);
        const selectedEmails = contacts.filter((c) => selectedContacts.includes(c.id)).map((c) => c.email);

        try {
            await fetch("http://127.0.0.1:8000/api/sos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emails: selectedEmails }),
            });

            const activities = JSON.parse(localStorage.getItem("safetyActivities")) || [];
            activities.push({
                title: "SOS Alert Sent",
                description: `Sent urgent safety email to ${selectedContacts.length} trusted contact(s).`,
                timestamp: Date.now(),
                date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
            });
            localStorage.setItem("safetyActivities", JSON.stringify(activities));

            setSosSent(true);
            setTimeout(() => setSosModalOpen(false), 2000);
        } catch (error) {
            alert("Failed to send SOS: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Auto scroll to bottom
    useEffect(() => {
        chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
    }, [messages, isLoading]);

    // Send message
    const handleSend = async (messageText = input) => {
        if (!messageText.trim() || isLoading) return;

        const userText = messageText.trim();

        const userMessage = {
            text: userText,
            sender: "user",
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const data = await sendChatMessage(userText, activeConversationId);

            if (data.conversation_id) {
                setActiveConversationId(data.conversation_id);
            }

            setDetectedEmotion(data.emotion || "neutral");
            setMentalState(data.mental_state || "");

            const aiSafetyEnabled = localStorage.getItem("aiSafety") !== "false";

            if (aiSafetyEnabled && data.safety?.riskLevel === "HIGH" && localStorage.getItem("autoSos") === "true") {
                const activities = JSON.parse(localStorage.getItem("safetyActivities")) || [];
                activities.push({
                    title: "Automatic SOS Triggered",
                    description: "High risk detected. Sent automatic safety check to trusted contacts.",
                    timestamp: Date.now(),
                    date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
                });
                localStorage.setItem("safetyActivities", JSON.stringify(activities));
                alert("Automatic SOS has notified your Safe Place contacts.");
            }

            const aiMessage = {
                text: data.response,
                sender: "ai",
                emotion: data.emotion,
                mental_state: data.mental_state,
                top_emotions: data.top_emotions,
                safety: aiSafetyEnabled ? data.safety : undefined,
            };

            setMessages((prev) => [...prev, aiMessage]);

            // Refresh conversations list to update titles/ordering
            await loadConversations(false);
        } catch (error) {
            console.error("Backend error:", error);

            const errorMessage = {
                text: "I'm having trouble connecting right now. Please try again in a moment. 💜",
                sender: "ai",
            };

            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Voice input
    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert("Your browser does not support voice input");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.start();

        recognition.onstart = () => {
            console.log("🎤 Listening...");
        };

        recognition.onresult = (event) => {
            const speechText = event.results[0][0].transcript;
            setInput(speechText);
            handleSend(speechText);
        };

        recognition.onerror = (event) => {
            console.error("Voice error:", event.error);
            alert("Mic error: " + event.error);
        };

        recognition.onend = () => {
            console.log("🎤 Stopped listening");
        };
    };

    // Emotion color indicator
    const getEmotionColor = () => {
        if (detectedEmotion === "positive") return "text-green-600";
        if (detectedEmotion === "anxiety") return "text-orange-500";
        if (detectedEmotion === "anger") return "text-red-600";
        if (detectedEmotion === "negative") return "text-blue-600";
        if (detectedEmotion === "crisis") return "text-red-800";
        return "text-gray-500";
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden">
            {/* Dedicated AI Support Conversation History Sidebar */}
            <AISidebar
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={handleSelectConversation}
                onNewChat={handleNewChat}
                onDeleteConversation={handleDeleteConversation}
            />

            {/* Main Chat Interface */}
            <div className="flex-1 flex flex-col h-full bg-background p-6 min-w-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-xl font-heading font-semibold text-textPrimary">
                            AI Support Companion
                        </h1>
                        <p className="text-xs text-textSecondary mt-0.5">
                            Your compassionate, confidential wellness companion
                        </p>
                    </div>

                    {/* Detection Capsule */}
                    <div className="bg-primaryLight/80 backdrop-blur px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs">
                        <span className="text-textPrimary">Detected: </span>
                        <span className={getEmotionColor()}>
                            {detectedEmotion}
                            {mentalState && ` | ${mentalState}`}
                        </span>
                    </div>
                </div>

                {/* Chat Messages Window */}
                <div
                    ref={chatRef}
                    className="flex-1 bg-white border border-border rounded-2xl p-5 overflow-y-auto flex flex-col gap-4 shadow-xs"
                >
                    {messages.map((msg, index) => {
                        const isHighRisk = msg.safety?.riskLevel === "HIGH";
                        const isMediumRisk = msg.safety?.riskLevel === "MEDIUM";

                        return (
                            <div
                                key={index}
                                className={`flex flex-col ${
                                    msg.sender === "user" ? "self-end items-end" : "self-start items-start"
                                } max-w-xl`}
                            >
                                <div
                                    className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                                        msg.sender === "user"
                                            ? "bg-primary text-white rounded-br-xs"
                                            : "bg-primaryLight text-textPrimary rounded-bl-xs"
                                    }`}
                                >
                                    {msg.text}
                                </div>

                                {msg.sender === "ai" && isMediumRisk && (
                                    <button
                                        onClick={handleOpenSos}
                                        className="mt-2 text-xs font-semibold text-primary bg-primaryLight border border-primary/40 px-3 py-1.5 rounded-xl hover:bg-primary hover:text-white transition-all shadow-xs"
                                    >
                                        Contact My Safe Place
                                    </button>
                                )}

                                {msg.sender === "ai" && isHighRisk && (
                                    <div className="mt-3 p-4 border border-red-300 bg-red-50 rounded-2xl max-w-md w-full shadow-sm">
                                        <p className="text-red-700 font-medium text-xs mb-3">
                                            Your safety matters. Would you like MindEase to contact someone from your Safe Place?
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleOpenSos}
                                                className="flex-1 bg-red-600 text-white text-xs font-medium py-2 rounded-xl hover:bg-red-700 transition"
                                            >
                                                Contact Safe Person
                                            </button>
                                            <button className="flex-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium py-2 rounded-xl hover:bg-gray-50 transition">
                                                I'm Safe Right Now
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Thinking Indicator */}
                    {isLoading && (
                        <div className="max-w-md p-3.5 rounded-2xl rounded-bl-xs text-xs bg-primaryLight text-textPrimary self-start animate-pulse">
                            Thinking... 💭
                        </div>
                    )}
                </div>

                {/* Input Controls */}
                <div className="mt-4 flex gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 p-3.5 rounded-2xl border border-border bg-white text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-all"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                handleSend();
                            }
                        }}
                        disabled={isLoading}
                    />

                    <button
                        onClick={startListening}
                        disabled={isLoading}
                        title="Voice Input"
                        className="px-4 rounded-2xl border border-border bg-white text-gray-600 hover:text-primary hover:bg-primaryLight/50 transition-all disabled:opacity-50"
                    >
                        <FontAwesomeIcon icon={faMicrophone} />
                    </button>

                    <button
                        onClick={() => handleSend()}
                        disabled={isLoading || !input.trim()}
                        className="bg-primary hover:bg-primaryDark text-white px-5 rounded-2xl font-medium transition-all disabled:opacity-50 shadow-sm hover:shadow"
                    >
                        <FontAwesomeIcon icon={faPaperPlane} />
                    </button>
                </div>
            </div>

            {/* SOS Modal */}
            {sosModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-lg">
                        {!sosSent ? (
                            <>
                                <h2 className="text-xl font-bold text-red-600 mb-2">Contact Safe Place</h2>
                                <p className="text-sm text-textSecondary mb-4">
                                    MindEase will send an urgent email letting your trusted contacts know you need support.
                                </p>

                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm mb-4">
                                    <span className="font-semibold text-gray-700">Message Preview:</span>
                                    <br />
                                    "I'm not feeling okay right now. Please check on me."
                                </div>

                                <h3 className="font-semibold mb-2">Who should we contact?</h3>
                                <div className="space-y-2 mb-6">
                                    {contacts.map((c) => (
                                        <label
                                            key={c.id}
                                            className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedContacts.includes(c.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedContacts([...selectedContacts, c.id]);
                                                    else setSelectedContacts(selectedContacts.filter((id) => id !== c.id));
                                                }}
                                                className="accent-red-600 w-4 h-4"
                                            />
                                            <span>
                                                {c.name} {c.email && `(${c.email})`}
                                            </span>
                                        </label>
                                    ))}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setSosModalOpen(false)}
                                        className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl font-medium hover:bg-gray-200 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSendSos}
                                        disabled={selectedContacts.length === 0}
                                        className="flex-1 bg-red-600 text-white py-2 rounded-xl font-medium hover:bg-red-700 transition disabled:opacity-50"
                                    >
                                        Send SOS
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                                    ✓
                                </div>
                                <h2 className="text-xl font-bold mb-2">Message Sent</h2>
                                <p className="text-textSecondary">
                                    Your trusted contacts have been notified. Please hold on, someone will reach out soon.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AISupport;