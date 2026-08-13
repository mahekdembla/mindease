import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faPaperPlane,
    faMicrophone,
} from "@fortawesome/free-solid-svg-icons";

import { sendChatMessage } from "../../services/api";

function AISupport() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

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
    
    useEffect(() => {
        const savedContacts = JSON.parse(localStorage.getItem("trustedContacts")) || [];
        setContacts(savedContacts.filter(c => c.receive_sos));
    }, [sosModalOpen]); // reload contacts when modal opens

    const handleOpenSos = () => {
        if (contacts.length === 0) {
            alert("You have no trusted contacts configured. Please set them up in Safe Place.");
            navigate('/safeplace');
            return;
        }
        setSosSent(false);
        setSelectedContacts(contacts.map(c => c.id));
        setSosModalOpen(true);
    };

    const handleSendSos = async () => {
        setIsLoading(true);
        const selectedEmails = contacts.filter(c => selectedContacts.includes(c.id)).map(c => c.email);
        
        try {
            await fetch('http://127.0.0.1:8000/api/sos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails: selectedEmails })
            });
            
            const activities = JSON.parse(localStorage.getItem("safetyActivities")) || [];
            activities.push({
                title: "SOS Alert Sent",
                description: `Sent urgent safety email to ${selectedContacts.length} trusted contact(s).`,
                timestamp: Date.now(),
                date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()
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

    // Load chat history
    useEffect(() => {
        const saved = localStorage.getItem("chatHistory");

        if (saved) {
            setMessages(JSON.parse(saved));
        } else {
            setMessages([
                {
                    text: "Hi, I'm here to support you 💜",
                    sender: "ai",
                },
            ]);
        }
    }, []);

    // Save chat count
    useEffect(() => {
        localStorage.setItem("chatCount", messages.length);
    }, [messages]);

    // Save chat history
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(
                "chatHistory",
                JSON.stringify(messages)
            );
        }
    }, [messages]);

    // Auto scroll
    useEffect(() => {
        chatRef.current?.scrollTo(
            0,
            chatRef.current.scrollHeight
        );
    }, [messages]);

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
            // Send message to FastAPI backend
            const data = await sendChatMessage(userText);

            // Update detection capsule
            setDetectedEmotion(data.emotion || "neutral");
            setMentalState(data.mental_state || "");

            const aiSafetyEnabled = localStorage.getItem("aiSafety") !== "false";
            
            if (aiSafetyEnabled && data.safety?.riskLevel === "HIGH" && localStorage.getItem("autoSos") === "true") {
                 const activities = JSON.parse(localStorage.getItem("safetyActivities")) || [];
                 activities.push({
                     title: "Automatic SOS Triggered",
                     description: "High risk detected. Sent automatic safety check to trusted contacts.",
                     timestamp: Date.now(),
                     date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString()
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

            setMessages((prev) => [
                ...prev,
                aiMessage,
            ]);

        } catch (error) {
            console.error("Backend error:", error);

            const errorMessage = {
                text:
                    "I'm having trouble connecting right now. Please try again in a moment. 💜",
                sender: "ai",
            };

            setMessages((prev) => [
                ...prev,
                errorMessage,
            ]);

        } finally {
            setIsLoading(false);
        }
    };

    // Voice input
    const startListening = () => {
        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert(
                "Your browser does not support voice input"
            );
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
            const speechText =
                event.results[0][0].transcript;

            setInput(speechText);

            handleSend(speechText);
        };

        recognition.onerror = (event) => {
            console.error(
                "Voice error:",
                event.error
            );

            alert(
                "Mic error: " + event.error
            );
        };

        recognition.onend = () => {
            console.log("🎤 Stopped listening");
        };
    };

    // Emotion color
    const getEmotionColor = () => {
        if (detectedEmotion === "positive") {
            return "text-green-600";
        }

        if (detectedEmotion === "anxiety") {
            return "text-orange-500";
        }

        if (detectedEmotion === "anger") {
            return "text-red-600";
        }

        if (detectedEmotion === "negative") {
            return "text-blue-600";
        }

        if (detectedEmotion === "crisis") {
            return "text-red-800";
        }

        return "text-gray-500";
    };

    return (
        <div className="p-8 w-full flex flex-col h-screen">

            {/* Header */}
            <div className="flex items-start justify-between mb-4">

                {/* Title */}
                <div>
                    <h1 className="text-2xl font-heading font-semibold text-textPrimary">
                        AI Support
                    </h1>

                    <p className="text-sm text-textSecondary mt-1">
                        Your compassionate AI companion
                    </p>
                </div>

                {/* Detection Capsule */}
                <div className="bg-primaryLight px-4 py-2 rounded-full text-sm font-semibold shadow-sm">

                    <span className="text-textPrimary">
                        Detected:{" "}
                    </span>

                    <span className={getEmotionColor()}>
                        {detectedEmotion}
                        {mentalState && ` | ${mentalState}`}
                    </span>

                </div>

            </div>

            {/* Chat */}
            <div
                ref={chatRef}
                className="flex-1 bg-card border border-border rounded-2xl p-4 overflow-y-auto flex flex-col gap-3"
            >

                {messages.map((msg, index) => {
                    const isHighRisk = msg.safety?.riskLevel === "HIGH";
                    const isMediumRisk = msg.safety?.riskLevel === "MEDIUM";
                    
                    return (
                        <div key={index} className={`flex flex-col ${msg.sender === "user" ? "self-end items-end" : "self-start items-start"} max-w-md`}>
                            <div className={`p-3 rounded-xl text-sm ${
                                msg.sender === "user"
                                    ? "bg-primary text-white"
                                    : "bg-primaryLight text-textPrimary"
                            }`}>
                                {msg.text}
                            </div>
                            
                            {msg.sender === "ai" && isMediumRisk && (
                                <button 
                                    onClick={handleOpenSos}
                                    className="mt-2 text-xs font-semibold text-primary bg-primaryLight border border-primary px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition"
                                >
                                    Contact My Safe Place
                                </button>
                            )}

                            {msg.sender === "ai" && isHighRisk && (
                                <div className="mt-3 p-4 border border-red-300 bg-red-50 rounded-xl max-w-md w-full">
                                    <p className="text-red-700 font-medium mb-3">
                                        Your safety matters. Would you like MindEase to contact someone from your Safe Place?
                                    </p>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleOpenSos}
                                            className="flex-1 bg-red-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-700 transition"
                                        >
                                            Contact Safe Person
                                        </button>
                                        <button 
                                            className="flex-1 bg-white border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition"
                                        >
                                            I'm Safe Right Now
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Loading */}
                {isLoading && (
                    <div className="max-w-md p-3 rounded-xl text-sm bg-primaryLight text-textPrimary self-start">
                        Thinking... 💭
                    </div>
                )}

            </div>

            {/* Input */}
            <div className="mt-4 flex gap-3">

                <input
                    type="text"
                    value={input}
                    onChange={(e) =>
                        setInput(e.target.value)
                    }
                    placeholder="Type your message..."
                    className="flex-1 p-3 rounded-xl border border-border outline-none"
                    onKeyDown={(e) => {
                        if (
                            e.key === "Enter" &&
                            !e.shiftKey
                        ) {
                            handleSend();
                        }
                    }}
                    disabled={isLoading}
                />

                {/* Voice */}
                <button
                    onClick={startListening}
                    disabled={isLoading}
                    className="px-3 rounded-xl border border-border bg-card disabled:opacity-50"
                >
                    <FontAwesomeIcon
                        icon={faMicrophone}
                    />
                </button>

                {/* Send */}
                <button
                    onClick={() => handleSend()}
                    disabled={
                        isLoading ||
                        !input.trim()
                    }
                    className="bg-primary text-white px-4 rounded-xl disabled:opacity-50"
                >
                    <FontAwesomeIcon
                        icon={faPaperPlane}
                    />
                </button>

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
                                    <span className="font-semibold text-gray-700">Message Preview:</span><br/>
                                    "I'm not feeling okay right now. Please check on me."
                                </div>
                                
                                <h3 className="font-semibold mb-2">Who should we contact?</h3>
                                <div className="space-y-2 mb-6">
                                    {contacts.map(c => (
                                        <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedContacts.includes(c.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedContacts([...selectedContacts, c.id]);
                                                    else setSelectedContacts(selectedContacts.filter(id => id !== c.id));
                                                }}
                                                className="accent-red-600 w-4 h-4"
                                            />
                                            <span>{c.name} {c.email && `(${c.email})`}</span>
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
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
                                <h2 className="text-xl font-bold mb-2">Message Sent</h2>
                                <p className="text-textSecondary">Your trusted contacts have been notified. Please hold on, someone will reach out soon.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AISupport;