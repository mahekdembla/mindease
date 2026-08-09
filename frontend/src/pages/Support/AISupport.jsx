import { useState, useEffect, useRef } from "react";
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

    const chatRef = useRef(null);

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

            const aiMessage = {
                text: data.response,
                sender: "ai",
                emotion: data.emotion,
                mental_state: data.mental_state,
                top_emotions: data.top_emotions,
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

                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`max-w-md p-3 rounded-xl text-sm ${
                            msg.sender === "user"
                                ? "bg-primary text-white self-end"
                                : "bg-primaryLight text-textPrimary self-start"
                        }`}
                    >
                        {msg.text}
                    </div>
                ))}

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

        </div>
    );
}

export default AISupport;