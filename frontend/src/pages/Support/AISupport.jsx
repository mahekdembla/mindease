
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPaperPlane,
  faMicrophone,
} from "@fortawesome/free-solid-svg-icons";

import {
  sendChatMessage,
  streamChatMessage,
  fetchConversations,
  fetchConversationMessages,
  deleteConversation,
} from "../../services/api";

import AISidebar from "../../components/layout/AISidebar.jsx";
import SafetyConsentModal from "../../components/common/SafetyConsentModal.jsx";

function formatReply(text) {
  return (text || "").split(/(\*\*[^*\n]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function AISupport() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);

  const [detectedEmotion, setDetectedEmotion] = useState("neutral");
  const [mentalState, setMentalState] = useState("");

  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [sosResult, setSosResult] = useState(null);

  const [dismissedSafety, setDismissedSafety] = useState(
    () => JSON.parse(localStorage.getItem("dismissedSafety") || "[]")
  );

  const navigate = useNavigate();
  const chatRef = useRef(null);

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
        setMessages([{ text: "Hi, I'm here to support you 💜", sender: "ai" }]);
      }
    } catch (e) {
      console.error("Failed to load conversation messages:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversations = async (autoSelectFirst = true) => {
    try {
      const convs = await fetchConversations();
      setConversations(convs || []);

      if (autoSelectFirst && convs && convs.length > 0) {
        const firstId = convs[0].conversation_id;
        setActiveConversationId(firstId);
        await loadMessagesForConversation(firstId);
      } else if (!activeConversationId && (!convs || convs.length === 0)) {
        setMessages([{ text: "Hi, I'm here to support you 💜", sender: "ai" }]);
      }
    } catch (e) {
      console.error("Failed to load conversations:", e);
    }
  };

  useEffect(() => {
    loadConversations(true);
  }, []);

  const handleSelectConversation = async (convId) => {
    if (convId === activeConversationId) return;
    setActiveConversationId(convId);
    await loadMessagesForConversation(convId);
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([{ text: "Hi, I'm here to support you 💜", sender: "ai" }]);
    setDetectedEmotion("neutral");
    setMentalState("");
  };

  const handleDeleteConversation = async (convId) => {
    if (!window.confirm("Are you sure you want to delete this conversation?")) return;

    try {
      await deleteConversation(convId);
      const updated = conversations.filter(c => c.conversation_id !== convId);
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

  // Include contacts eligible for either notification method.
  useEffect(() => {
    try {
      const savedContacts = JSON.parse(localStorage.getItem("trustedContacts") || "[]");
      setContacts(
        savedContacts.filter(contact =>
          contact.receive_sos === true ||
          contact.receive_sms === true ||
          (contact.receive_sos !== false && Boolean(contact.email))
        )
      );
    } catch (error) {
      console.error("Could not load trusted contacts:", error);
      setContacts([]);
    }
  }, [sosModalOpen]);

  const handleOpenSos = () => {
    if (contacts.length === 0) {
      alert("You have no trusted contacts configured. Please set them up in Safe Place.");
      navigate("/safeplace");
      return;
    }

    setSosResult(null);
    setSosModalOpen(true);
  };

  const handleImSafe = (index) => {
    const key = `${activeConversationId || "new"}:${index}`;
    const updated = [...dismissedSafety, key];

    setDismissedSafety(updated);
    localStorage.setItem("dismissedSafety", JSON.stringify(updated));

    const activities = JSON.parse(localStorage.getItem("safetyActivities") || "[]");

    activities.push({
      title: "Marked as safe",
      description: "Confirmed feeling safe right now after a safety check.",
      timestamp: Date.now(),
      date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
    });

    localStorage.setItem("safetyActivities", JSON.stringify(activities));

    setMessages(prev => [
      ...prev,
      {
        text: "I'm really glad you're safe right now. I'm here whenever you want to keep talking. If things start to feel heavy again, your Safe Place contacts and professional support are always one tap away 💜",
        sender: "ai",
      },
    ]);
  };

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages, isLoading]);

  const handleSend = async (messageText = input) => {
    if (!messageText.trim() || isLoading) return;

    const userText = messageText.trim();
    setMessages(prev => [...prev, { text: userText, sender: "user" }]);
    setInput("");
    setIsLoading(true);

    let streamStarted = false;

    try {
      let data;

      try {
        data = await streamChatMessage(
          userText,
          activeConversationId,
          (piece) => {
            if (!streamStarted) {
              streamStarted = true;
              setIsStreaming(true);
              setMessages(prev => [
                ...prev,
                { text: piece, sender: "ai", streaming: true },
              ]);
            } else {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + piece },
                ];
              });
            }
          }
        );
      } catch (streamError) {
        if (streamError.receivedText) throw streamError;
        data = await sendChatMessage(userText, activeConversationId);
      }

      if (data.conversation_id) setActiveConversationId(data.conversation_id);

      setDetectedEmotion(data.emotion || "neutral");
      setMentalState(data.mental_state || "");

      const aiSafetyEnabled = localStorage.getItem("aiSafety") !== "false";

      // Preserve the existing automatic email SOS feature.
      if (
        aiSafetyEnabled &&
        data.safety?.riskLevel === "HIGH" &&
        localStorage.getItem("autoSos") === "true"
      ) {
        import("../../services/api").then(({ sendSosAlert }) => {
          sendSosAlert([], true)
            .then(result => {
              if (result.simulated) {
                alert("Automatic SOS email is not configured. Please contact someone you trust directly.");
                return;
              }

              const activities = JSON.parse(localStorage.getItem("safetyActivities") || "[]");
              activities.push({
                title: "Automatic SOS Triggered",
                description: `High risk detected. Sent automatic safety email to ${result.sent} trusted contact(s).`,
                timestamp: Date.now(),
                date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
              });
              localStorage.setItem("safetyActivities", JSON.stringify(activities));
              alert("Automatic SOS has notified your Safe Place contacts.");
            })
            .catch(err => alert(`Automatic SOS could not be sent: ${err.message}. Please contact someone you trust directly.`));
        });
      }

      const aiMessage = {
        text: data.response,
        sender: "ai",
        emotion: data.emotion,
        mental_state: data.mental_state,
        top_emotions: data.top_emotions,
        safety: aiSafetyEnabled ? data.safety : undefined,
      };

      setMessages(prev =>
        streamStarted
          ? [...prev.slice(0, -1), aiMessage]
          : [...prev, aiMessage]
      );

      loadConversations(false);
    } catch (error) {
      console.error("Backend error:", error);

      const errorMessage = {
        text: streamStarted
          ? "My reply got interrupted. Please try sending that again. 💜"
          : "I'm having trouble connecting right now. Please try again in a moment. 💜",
        sender: "ai",
      };

      setMessages(prev => {
        const settled = streamStarted
          ? [...prev.slice(0, -1), { ...prev[prev.length - 1], streaming: false }]
          : prev;
        return [...settled, errorMessage];
      });
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

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
    recognition.onresult = event => {
      const speechText = event.results[0][0].transcript;
      setInput(speechText);
      handleSend(speechText);
    };
    recognition.onerror = event => {
      console.error("Voice error:", event.error);
      alert("Mic error: " + event.error);
    };
  };

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
      <AISidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
      />

      <div className="flex-1 flex flex-col h-full bg-background p-6 min-w-0 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-heading font-semibold text-textPrimary">
              AI Support Companion
            </h1>
            <p className="text-xs text-textSecondary mt-0.5">
              Your compassionate, confidential wellness companion
            </p>
          </div>

          <div className="bg-primaryLight/80 backdrop-blur px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs">
            <span className="text-textPrimary">Detected: </span>
            <span className={getEmotionColor()}>
              {detectedEmotion}{mentalState && ` | ${mentalState}`}
            </span>
          </div>
        </div>

        <div ref={chatRef} className="flex-1 bg-white border border-border rounded-2xl p-5 overflow-y-auto flex flex-col gap-4 shadow-xs">
          {messages.map((msg, index) => {
            const isHighRisk = msg.safety?.riskLevel === "HIGH";
            const isMediumRisk = msg.safety?.riskLevel === "MEDIUM";
            const safetyKey = `${activeConversationId || "new"}:${index}`;

            return (
              <div
                key={index}
                className={`flex flex-col ${msg.sender === "user" ? "self-end items-end" : "self-start items-start"} max-w-xl`}
              >
                <div className={`p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                  msg.sender === "user"
                    ? "bg-primary text-white rounded-br-xs"
                    : "bg-primaryLight text-textPrimary rounded-bl-xs"
                }`}>
                  {msg.sender === "ai" ? formatReply(msg.text) : msg.text}
                  {msg.streaming && <span className="inline-block ml-0.5 animate-pulse">▍</span>}
                </div>

                {msg.sender === "ai" && isMediumRisk && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleOpenSos}
                      className="text-xs font-semibold text-primary bg-primaryLight border border-primary/40 px-3 py-1.5 rounded-xl hover:bg-primary hover:text-white transition-all shadow-xs"
                    >
                      Contact My Safe Place
                    </button>
                  </div>
                )}

                {msg.sender === "ai" && isHighRisk && !dismissedSafety.includes(safetyKey) && (
                  <div className="mt-3 p-4 border border-red-300 bg-red-50 rounded-2xl max-w-md w-full shadow-sm">
                    <p className="text-red-700 font-medium text-xs mb-3">
                      Your safety matters. Would you like MindEase to contact someone from your Safe Place?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleOpenSos}
                        className="flex-1 bg-red-600 text-white text-xs font-medium py-2 rounded-xl hover:bg-red-700 transition"
                      >
                        Contact Safe Person
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate("/professionals")}
                        className="flex-1 bg-white border border-red-200 text-red-700 text-xs font-medium py-2 rounded-xl hover:bg-red-50 transition"
                      >
                        Talk to a Professional
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImSafe(index)}
                        className="flex-1 bg-white border border-gray-300 text-gray-700 text-xs font-medium py-2 rounded-xl hover:bg-gray-50 transition"
                      >
                        I'm Safe Right Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && !isStreaming && (
            <div className="max-w-md p-3.5 rounded-2xl rounded-bl-xs text-xs bg-primaryLight text-textPrimary self-start animate-pulse">
              Thinking... 💭
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 p-3.5 rounded-2xl border border-border bg-white text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs transition-all"
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) handleSend();
            }}
            disabled={isLoading}
          />

          <button
            type="button"
            onClick={startListening}
            disabled={isLoading}
            title="Voice Input"
            className="px-4 rounded-2xl border border-border bg-white text-gray-600 hover:text-primary hover:bg-primaryLight/50 transition-all disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faMicrophone} />
          </button>

          <button
            type="button"
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="bg-primary hover:bg-primaryDark text-white px-5 rounded-2xl font-medium transition-all disabled:opacity-50 shadow-sm hover:shadow"
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
        </div>
      </div>

      <SafetyConsentModal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        contacts={contacts}
        contextText={messages.slice(-3).map(message => message.text).join(" ")}
        isSuicideContext={messages.some(message =>
          message.isHighRisk || /suicid|kill|die|end it|hurt myself|harm/i.test(message.text)
        )}
        onSosSuccess={result => setSosResult(result)}
      />
    </div>
  );
}

export default AISupport;
