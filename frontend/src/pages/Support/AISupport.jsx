import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faMicrophone } from "@fortawesome/free-solid-svg-icons";
import { getReply } from "../../utils/getReply";

function AISupport() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");

    const chatRef = useRef(null);

    // ✅ Load chat history
    useEffect(() => {
        const saved = localStorage.getItem("chatHistory");

        if (saved) {
            setMessages(JSON.parse(saved));
        } else {
            setMessages([
                { text: "Hi, I'm here to support you 💜", sender: "ai" },
            ]);
        }
    }, []);
    useEffect(() => {
        localStorage.setItem("chatCount", messages.length);
    }, [messages]);

    // ✅ Save chat history
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem("chatHistory", JSON.stringify(messages));
        }
    }, [messages]);

    // ✅ Auto scroll
    useEffect(() => {
        chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
    }, [messages]);

    // ✅ Send message
    const handleSend = () => {
        if (!input.trim()) return;
        const userText = input;
        const userMessage = { text: userText, sender: "user" };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");

        // simulate AI delay
        setTimeout(() => {
            const aiMessage = {
                text: getReply(userText),
                sender: "ai",
            };

            setMessages((prev) => [...prev, aiMessage]);
        }, 600);
    };

    // 🎤 Voice input
    const startListening = () => {
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;

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

            setTimeout(() => {
                handleSend();
            }, 500);
        };

        recognition.onerror = (event) => {
            console.error("Voice error:", event.error);
            alert("Mic error: " + event.error);
        };

        recognition.onend = () => {
            console.log("🎤 Stopped listening");
        };
    };

    return (
        <div className="p-8 w-full flex flex-col h-screen">

            {/* Header */}
            <h1 className="text-2xl font-heading font-semibold text-textPrimary mb-4">
                AI Support
            </h1>

            {/* Chat */}
            <div
                ref={chatRef}
                className="flex-1 bg-card border border-border rounded-2xl p-4 overflow-y-auto flex flex-col gap-3"
            >
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`max-w-md p-3 rounded-xl text-sm ${msg.sender === "user"
                            ? "bg-primary text-white self-end"
                            : "bg-primaryLight text-textPrimary self-start"
                            }`}
                    >
                        {msg.text}
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="mt-4 flex gap-3">

                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 p-3 rounded-xl border border-border outline-none"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSend();
                    }}
                />

                {/* 🎤 Voice */}
                <button
                    onClick={startListening}
                    className="px-3 rounded-xl border border-border bg-card"
                >
                    <FontAwesomeIcon icon={faMicrophone} />
                </button>

                {/* Send */}
                <button
                    onClick={handleSend}
                    className="bg-primary text-white px-4 rounded-xl"
                >
                    <FontAwesomeIcon icon={faPaperPlane} />
                </button>

            </div>
        </div>
    );
}

export default AISupport;