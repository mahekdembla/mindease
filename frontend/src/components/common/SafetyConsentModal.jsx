
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faXmark,
  faShieldHeart,
  faTriangleExclamation,
  faClipboardCheck,
  faPaintBrush,
  faPaperPlane,
  faRotateRight,
  faCheck,
  faHeartPulse,
  faEraser,
  faEye,
  faHand,
  faVolumeHigh,
  faWind,
  faUtensils,
  faPhone
} from "@fortawesome/free-solid-svg-icons";
import { sendSosAlert } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const CSSRS_QUESTIONS = [
  { id: "cssrs_1", text: "Have you wished you could go to sleep and not wake up, or wished you were dead?", weight: 15 },
  { id: "cssrs_2", text: "Have you had actual thoughts of killing yourself or ending your life?", weight: 25 },
  { id: "cssrs_3", text: "Have you been thinking about how you might do this (methods/ways)?", weight: 25 },
  { id: "cssrs_4", text: "Have you had any intention to act on these thoughts?", weight: 20 },
  { id: "cssrs_5", text: "Have you started to work out details or taken steps towards hurting yourself?", weight: 15 },
];

const PANIC_ANXIETY_QUESTIONS = [
  { id: "panic_1", text: "Are you feeling an intense surge of sudden fear, dread, or a racing heartbeat right now?", weight: 25 },
  { id: "panic_2", text: "Are you finding it hard to catch your breath, feeling dizzy, shaky, or trembling?", weight: 25 },
  { id: "panic_3", text: "Do you feel like you are losing control or about to experience a full panic attack?", weight: 20 },
  { id: "panic_4", text: "Are you feeling scared being by yourself and need someone to help steady you?", weight: 15 },
  { id: "panic_5", text: "Have physical grounding exercises or deep breaths felt difficult to do alone?", weight: 15 },
];

const LONELINESS_QUESTIONS = [
  { id: "lone_1", text: "Are you feeling painfully isolated, lonely, or like no one understands what you're going through?", weight: 25 },
  { id: "lone_2", text: "Do you feel frightened or overwhelmed by being alone with your thoughts right now?", weight: 25 },
  { id: "lone_3", text: "Would hearing a comforting voice or getting a message from a trusted friend give you relief?", weight: 20 },
  { id: "lone_4", text: "Are your thoughts spiraling and making you feel unsafe in your current environment?", weight: 15 },
  { id: "lone_5", text: "Do you feel you need an immediate check-in before this loneliness escalates?", weight: 15 },
];

const GENERAL_QUESTIONS = [
  { id: "gen_1", text: "Do you feel completely overwhelmed and unable to cope with this moment alone?", weight: 25 },
  { id: "gen_2", text: "Are you feeling intense physical tension, frustration, or rapid racing thoughts?", weight: 20 },
  { id: "gen_3", text: "Do you feel disconnected from yourself or your surroundings right now?", weight: 20 },
  { id: "gen_4", text: "Do you feel having someone close to you check in right now would prevent a crisis?", weight: 20 },
  { id: "gen_5", text: "Have you tried calming techniques (breathing, stepping away) without relief?", weight: 15 },
];

function determineAssessmentType(text = "", isExplicitSuicide = false) {
  const lower = (text || "").toLowerCase();
  const isNegatedSuicide =
    /\b(not|no|don't|dont|never|am not)\s+(having|thinking of|feeling|any)?\s*(suicid|kill|die|hurt myself|harm)/i.test(lower);

  const hasActiveSuicideKeywords =
    !isNegatedSuicide &&
    /\b(suicid|kill myself|killing myself|end my life|take my own life|want to die|wanna die|cut myself|hang myself)\b/i.test(lower);

  if (isExplicitSuicide || hasActiveSuicideKeywords) {
    return {
      title: "Columbia Clinical Screener (C-SSRS)",
      subtitle: "Standard clinical safety screening based on self-harm context.",
      questions: CSSRS_QUESTIONS
    };
  }

  if (/\b(panic|panic attack|scared|frightened|heart racing|can't breathe|shaking|trembling|dizzy|hyperventilat|anxious|anxiety)\b/i.test(lower)) {
    return {
      title: "Panic & Anxiety Situation Check",
      subtitle: "Targeted check to assess panic intensity, physical symptoms, and grounding needs.",
      questions: PANIC_ANXIETY_QUESTIONS
    };
  }

  if (/\b(lonely|alone|isolated|nobody|abandoned|crying|hopeless|scared to be alone)\b/i.test(lower)) {
    return {
      title: "Loneliness & Emotional Check",
      subtitle: "Understanding your current feelings of isolation and need for support.",
      questions: LONELINESS_QUESTIONS
    };
  }

  return {
    title: "Situational Distress Check",
    subtitle: "Understanding your current emotional and physical intensity.",
    questions: GENERAL_QUESTIONS
  };
}

const GROUNDING_STEPS = [
  { count: 5, icon: faEye, label: "5 Things you can SEE around you", hint: "Look for 5 distinct objects, patterns, or colors in the room." },
  { count: 4, icon: faHand, label: "4 Things you can physically TOUCH", hint: "Feel your feet on the floor, your chair, clothing texture, or cool desk." },
  { count: 3, icon: faVolumeHigh, label: "3 Things you can HEAR right now", hint: "Listen for the hum of a fan, traffic outside, or your own breathing." },
  { count: 2, icon: faWind, label: "2 Things you can SMELL", hint: "Smell fresh air, coffee, pencil, perfume, or take a deep grounding breath." },
  { count: 1, icon: faUtensils, label: "1 Thing you can TASTE or feel grateful for", hint: "Notice the lingering taste of water/tea, or think of 1 safe thought." },
];

export default function SafetyConsentModal({
  isOpen,
  onClose,
  contacts = [],
  contextText = "",
  isSuicideContext = false,
  onSosSuccess
}) {
  const { user } = useAuth();

  const [stage, setStage] = useState("INITIAL");
  const [confirmInput, setConfirmInput] = useState("");
  const assessmentConfig = determineAssessmentType(contextText, isSuicideContext);
  const questionsToUse = assessmentConfig.questions;
  const [answers, setAnswers] = useState({});
  const [distressScore, setDistressScore] = useState(0);

  const [distractTab, setDistractTab] = useState("scribble");
  const [groundingStepIndex, setGroundingStepIndex] = useState(0);
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ef4444");
  const [brushSize, setBrushSize] = useState(6);

  // Notification method and recipient selections
  const [notificationMethod, setNotificationMethod] = useState("email");
  const [selectedContactEmails, setSelectedContactEmails] = useState(new Set());
  const [selectedContactIds, setSelectedContactIds] = useState(new Set());
  const [isSubmittingSos, setIsSubmittingSos] = useState(false);
  const [sosResult, setSosResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setStage("INITIAL");
    setConfirmInput("");
    setAnswers({});
    setDistressScore(0);
    setGroundingStepIndex(0);
    setSosResult(null);
    setErrorMsg("");
    setNotificationMethod("email");

    setSelectedContactEmails(
      new Set(
        contacts
          .filter(c => c.receive_sos !== false && c.email)
          .map(c => c.email.trim().toLowerCase())
      )
    );

    setSelectedContactIds(
      new Set(
        contacts
          .filter(c => c.receive_sms === true && c.phone && c.id)
          .map(c => String(c.id))
      )
    );
  }, [isOpen, contacts]);

  useEffect(() => {
    if (stage !== "DISTRACT" || distractTab !== "scribble" || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.parentElement.clientWidth || 500;
    canvas.height = 320;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [stage, distractTab]);

  if (!isOpen) return null;

  const handleConfirmDirect = () => {
    if (confirmInput.trim().toUpperCase() === "CONFIRM") {
      setStage("CONTACT_PICKER");
    }
  };

  const handleAssessmentAnswer = (questionId, yes) => {
    setAnswers(prev => ({ ...prev, [questionId]: yes }));
  };

  const handleFinishAssessment = () => {
    const score = questionsToUse.reduce(
      (total, question) => total + (answers[question.id] === true ? question.weight : 0),
      0
    );
    setDistressScore(Math.min(score, 100));
    setStage("ASSESSMENT_RESULT");
  };

  const allQuestionsAnswered = questionsToUse.every(q => answers[q.id] !== undefined);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const point = e.touches?.[0] || e;
    ctx.beginPath();
    ctx.moveTo(point.clientX - rect.left, point.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const rect = canvasRef.current.getBoundingClientRect();
    const point = e.touches?.[0] || e;
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineTo(point.clientX - rect.left, point.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const toggleContactEmail = (email) => {
    const clean = email.trim().toLowerCase();
    setSelectedContactEmails(prev => {
      const next = new Set(prev);
      next.has(clean) ? next.delete(clean) : next.add(clean);
      return next;
    });
  };

  const toggleContactId = (id) => {
    const cleanId = String(id);
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      next.has(cleanId) ? next.delete(cleanId) : next.add(cleanId);
      return next;
    });
  };

  const handleSendSosAlert = async () => {
    setErrorMsg("");

    if (notificationMethod === "email") {
      const recipients = Array.from(selectedContactEmails);
      if (recipients.length === 0) {
        setErrorMsg("Please select at least one contact to receive your email alert.");
        return;
      }

      setIsSubmittingSos(true);
      try {
        const result = await sendSosAlert(recipients, false);
        setSosResult(result);
        setStage("SENT_RESULT");
        onSosSuccess?.(result);
      } catch (err) {
        setErrorMsg(err.message || "Failed to dispatch the email alert. Please try again.");
      } finally {
        setIsSubmittingSos(false);
      }
      return;
    }

    // SMS Demo: intentionally local only. This does not call MSG91,
    // the SMS API, or any paid provider.
    const eligibleContacts = contacts.filter(
      c =>
        selectedContactIds.has(String(c.id)) &&
        c.receive_sms === true &&
        Boolean(c.phone?.trim())
    );

    if (eligibleContacts.length === 0) {
      setErrorMsg("Select at least one contact with a phone number and SMS consent enabled.");
      return;
    }

    setIsSubmittingSos(true);
    try {
      const result = {
        simulated: true,
        method: "sms_demo",
        sent: 0,
        eligible: eligibleContacts.length,
        message: `SMS demo completed for ${eligibleContacts.length} eligible contact(s). No real SMS was sent and no SMS provider was contacted.`
      };

      setSosResult(result);
      setStage("SENT_RESULT");
      onSosSuccess?.(result);
    } catch (err) {
      setErrorMsg(err.message || "Could not complete the SMS demo.");
    } finally {
      setIsSubmittingSos(false);
    }
  };

  const selectedCount = notificationMethod === "email"
    ? selectedContactEmails.size
    : selectedContactIds.size;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="fixed inset-0" onClick={isSubmittingSos ? undefined : onClose} />

      <div className="relative w-full max-w-xl my-auto rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 sm:p-8 z-10 overflow-hidden text-slate-800">
        <button
          onClick={onClose}
          disabled={isSubmittingSos}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30"
          aria-label="Close"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        {stage === "INITIAL" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl">
                <FontAwesomeIcon icon={faShieldHeart} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Pause & Check In First</h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Before contacting your safe person, take a breath and choose the support you need.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500" />
                <span>Choose an option before contacting your safe person.</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                You can complete a situation check, try a grounding exercise, or confirm that you need to contact someone immediately.
              </p>
            </div>

            <div className="p-4 border border-purple-200 bg-purple-50/50 rounded-2xl">
              <h3 className="text-sm font-bold text-purple-900">
                <FontAwesomeIcon icon={faClipboardCheck} className="mr-2" />
                Option 1: {assessmentConfig.title}
              </h3>
              <p className="text-xs text-purple-700 mt-1">{assessmentConfig.subtitle}</p>
              <button onClick={() => setStage("ASSESSMENT")} className="mt-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2 rounded-xl">
                Start Check
              </button>
            </div>

            <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-2xl">
              <h3 className="text-sm font-bold text-emerald-900">
                <FontAwesomeIcon icon={faPaintBrush} className="mr-2" />
                Option 2: Distract & Ground
              </h3>
              <p className="text-xs text-emerald-700 mt-1">
                Use the scribble pad or the 5-4-3-2-1 sensory grounding exercise.
              </p>
              <button onClick={() => setStage("DISTRACT")} className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl">
                Try Distraction
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-2">Need to reach them immediately?</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type CONFIRM to proceed"
                  value={confirmInput}
                  onChange={e => setConfirmInput(e.target.value)}
                  className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 font-mono uppercase"
                />
                <button
                  onClick={handleConfirmDirect}
                  disabled={confirmInput.trim().toUpperCase() !== "CONFIRM"}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-2.5 rounded-xl"
                >
                  Confirm & Choose Contact
                </button>
              </div>
            </div>
          </div>
        )}

        {stage === "ASSESSMENT" && (
          <div className="space-y-5">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">{assessmentConfig.title}</h2>
              <p className="text-xs text-slate-500">{assessmentConfig.subtitle}</p>
            </div>

            <div className="space-y-3.5 max-h-[50vh] overflow-y-auto">
              {questionsToUse.map((q, idx) => (
                <div key={q.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60">
                  <p className="text-xs font-medium text-slate-800 mb-2.5">
                    <strong className="text-purple-600 mr-1.5">{idx + 1}.</strong>{q.text}
                  </p>
                  <div className="flex gap-2">
                    {[true, false].map(value => (
                      <button
                        key={String(value)}
                        onClick={() => handleAssessmentAnswer(q.id, value)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-bold ${
                          answers[q.id] === value
                            ? value ? "bg-purple-600 text-white" : "bg-slate-700 text-white"
                            : "bg-white border border-slate-200 text-slate-700"
                        }`}
                      >
                        {value ? "Yes" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-3 border-t">
              <button onClick={() => setStage("INITIAL")} className="flex-1 bg-slate-100 py-2.5 rounded-xl text-xs font-semibold">Back</button>
              <button onClick={handleFinishAssessment} disabled={!allQuestionsAnswered} className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl text-xs font-semibold disabled:opacity-40">
                Calculate Situation Result
              </button>
            </div>
          </div>
        )}

        {stage === "ASSESSMENT_RESULT" && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-2xl bg-amber-100 text-amber-600">
              <FontAwesomeIcon icon={faHeartPulse} />
            </div>
            <div>
              <span className="text-3xl font-black text-slate-900">{distressScore}%</span>
              <p className="text-xs uppercase tracking-wider font-bold mt-1">
                {distressScore >= 50 ? "High Distress / Urgent Support Needed" : distressScore >= 30 ? "Moderate Distress" : "Mild Distress / Coping Suggested"}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Your answers are a check-in, not a clinical diagnosis. Reach out to a trusted person if you need support.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={() => setStage("DISTRACT")} className="p-4 rounded-2xl border border-emerald-300 bg-emerald-50 text-left">
                <strong className="text-xs text-emerald-800">Try Distraction First</strong>
                <p className="text-[11px] text-emerald-700 mt-1">Use grounding or the scribble pad.</p>
              </button>
              <button onClick={() => setStage("CONTACT_PICKER")} className="p-4 rounded-2xl border border-red-300 bg-red-50 text-left">
                <strong className="text-xs text-red-800">Contact Safe Place</strong>
                <p className="text-[11px] text-red-700 mt-1">Choose email or SMS demo.</p>
              </button>
            </div>
            <button onClick={() => setStage("INITIAL")} className="text-xs text-slate-400 underline">Start over</button>
          </div>
        )}

        {stage === "DISTRACT" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Take Out Your Frustration</h2>
              <p className="text-xs text-slate-500">Scribble or ground your senses.</p>
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1 text-xs w-fit">
              <button onClick={() => setDistractTab("scribble")} className={`px-3 py-2 rounded-lg ${distractTab === "scribble" ? "bg-white text-purple-700" : "text-slate-600"}`}>Scribble Pad</button>
              <button onClick={() => setDistractTab("grounding")} className={`px-3 py-2 rounded-lg ${distractTab === "grounding" ? "bg-white text-emerald-700" : "text-slate-600"}`}>5-4-3-2-1</button>
            </div>

            {distractTab === "scribble" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs bg-slate-100 p-2 rounded-xl">
                  <div className="flex items-center gap-2">
                    {["#ef4444", "#8b5cf6", "#06b6d4", "#f59e0b", "#ffffff"].map(c => (
                      <button key={c} onClick={() => setBrushColor(c)} style={{ backgroundColor: c }} className={`w-5 h-5 rounded-full border-2 ${brushColor === c ? "border-slate-900" : "border-transparent"}`} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    {[4, 8, 14].map(size => (
                      <button key={size} onClick={() => setBrushSize(size)} className={`px-2 py-1 rounded ${brushSize === size ? "bg-purple-600 text-white" : "bg-slate-200"}`}>{size}</button>
                    ))}
                    <button onClick={clearCanvas} className="text-slate-600"><FontAwesomeIcon icon={faEraser} /> Clear</button>
                  </div>
                </div>
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-64 rounded-2xl border border-slate-300 bg-slate-900 touch-none"
                />
              </div>
            )}

            {distractTab === "grounding" && (
              <div className="p-6 rounded-2xl border border-emerald-200 bg-emerald-50 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center text-2xl">
                  <FontAwesomeIcon icon={GROUNDING_STEPS[groundingStepIndex].icon} />
                </div>
                <h3 className="font-bold text-emerald-950">{GROUNDING_STEPS[groundingStepIndex].label}</h3>
                <p className="text-xs text-emerald-800">{GROUNDING_STEPS[groundingStepIndex].hint}</p>
                <div className="flex justify-center gap-3">
                  {groundingStepIndex > 0 && <button onClick={() => setGroundingStepIndex(i => i - 1)} className="text-xs border px-3 py-2 rounded-xl">Previous</button>}
                  {groundingStepIndex < GROUNDING_STEPS.length - 1 && <button onClick={() => setGroundingStepIndex(i => i + 1)} className="text-xs bg-emerald-600 text-white px-3 py-2 rounded-xl">Next Step ({GROUNDING_STEPS[groundingStepIndex + 1].count})</button>}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t">
              <button onClick={() => setStage("INITIAL")} className="text-xs text-slate-500">Back to options</button>
              <button onClick={() => setStage("CONTACT_PICKER")} className="bg-red-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl">
                <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                Contact Safe Place
              </button>
            </div>
          </div>
        )}

        {stage === "CONTACT_PICKER" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                <FontAwesomeIcon icon={faPaperPlane} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Contact My Safe Place</h2>
                <p className="text-xs text-slate-500">Choose your trusted contact(s) and how to notify them.</p>
              </div>
            </div>

            {/* The requested notification options appear inside this modal */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-800">Choose notification method</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setNotificationMethod("email"); setErrorMsg(""); }}
                  className={`p-3 rounded-xl border text-left ${
                    notificationMethod === "email" ? "border-purple-500 bg-purple-50 ring-1 ring-purple-300" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="font-bold text-sm text-slate-900">✉️ Email alert</div>
                  <p className="text-xs text-slate-600 mt-1">Send an email using the existing alert feature.</p>
                </button>
                <button
                  type="button"
                  onClick={() => { setNotificationMethod("sms"); setErrorMsg(""); }}
                  className={`p-3 rounded-xl border text-left ${
                    notificationMethod === "sms" ? "border-amber-500 bg-amber-50 ring-1 ring-amber-300" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="font-bold text-sm text-slate-900">💬 SMS alert (Demo)</div>
                  <p className="text-xs text-slate-600 mt-1">Simulates an alert only. No real SMS or provider call.</p>
                </button>
              </div>
            </div>

            {notificationMethod === "email" && (
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Sender details included in email:</span>{" "}
                {user?.name || "MindEase User"} ({user?.email || "Account email"}) with direct Reply-To support.
              </div>
            )}

            <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
              {contacts.map(c => {
                const emailAvailable = Boolean(c.email);
                const smsAvailable = c.receive_sms === true && Boolean(c.phone?.trim()) && Boolean(c.id);
                const available = notificationMethod === "email" ? emailAvailable : smsAvailable;
                const checked = notificationMethod === "email"
                  ? emailAvailable && selectedContactEmails.has(c.email.trim().toLowerCase())
                  : selectedContactIds.has(String(c.id));

                return (
                  <button
                    type="button"
                    key={c.id || c.email || c.phone}
                    disabled={!available}
                    onClick={() => notificationMethod === "email" ? toggleContactEmail(c.email) : toggleContactId(c.id)}
                    className={`w-full p-3 rounded-2xl border transition-all flex items-center justify-between text-left ${
                      checked ? "border-red-500 bg-red-50/50" : "border-slate-200 bg-white"
                    } ${!available ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"}`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{c.name || "Trusted contact"}</h4>
                      <p className="text-[11px] text-slate-500">
                        {notificationMethod === "email"
                          ? (c.email || "No email address")
                          : (smsAvailable ? c.phone : "Phone number and SMS consent required")}
                      </p>
                    </div>
                    <span className={`w-5 h-5 rounded-lg border flex items-center justify-center text-xs ${
                      checked ? "bg-red-600 border-red-600 text-white" : "border-slate-300 bg-white"
                    }`}>
                      {checked && <FontAwesomeIcon icon={faCheck} />}
                    </span>
                  </button>
                );
              })}

              {contacts.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500 border border-dashed rounded-xl">
                  No trusted contacts found. Add them in your Safe Place dashboard first.
                </div>
              )}
            </div>

            {notificationMethod === "sms" && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                Demo only: pressing the button below will not send an SMS or contact MSG91.
              </p>
            )}

            {errorMsg && <div className="p-3 rounded-xl bg-red-100 border border-red-200 text-red-700 text-xs">{errorMsg}</div>}

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button onClick={() => setStage("INITIAL")} disabled={isSubmittingSos} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold">
                Back
              </button>
              <button
                onClick={handleSendSosAlert}
                disabled={isSubmittingSos || selectedCount === 0}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
              >
                {isSubmittingSos ? (
                  <><FontAwesomeIcon icon={faRotateRight} className="animate-spin" /> Processing...</>
                ) : (
                  <><FontAwesomeIcon icon={faPaperPlane} />
                    {notificationMethod === "sms"
                      ? `Run SMS Demo for ${selectedCount} Contact(s)`
                      : `Send Email to ${selectedCount} Contact(s)`}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {stage === "SENT_RESULT" && (
          <div className="space-y-6 text-center py-2">
            <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl ${
              sosResult?.simulated ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
            }`}>
              <FontAwesomeIcon icon={sosResult?.simulated ? faTriangleExclamation : faCheck} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {sosResult?.method === "sms_demo"
                  ? "SMS Demo Completed"
                  : sosResult?.simulated ? "Alert Simulated" : "Emergency Alert Sent"}
              </h2>
              <p className="text-xs text-slate-600 mt-2 max-w-sm mx-auto leading-relaxed">
                {sosResult?.message || "Your selected contacts have been processed."}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-left space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <FontAwesomeIcon icon={faPhone} className="text-red-500" />
                  Crisis support resources in India
                </p>
                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">India</span>
              </div>
              <div className="bg-white border border-purple-200 p-2.5 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-purple-950">Tele-MANAS</div>
                  <div className="text-xs font-mono font-extrabold text-purple-700">14416 / 1800-891-4416</div>
                </div>
                <a href="tel:14416" className="bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl">Call 14416</a>
              </div>
              <div className="text-[11px] text-slate-600 space-y-1 pt-1">
                <div>🏥 <strong>Hitguj (KEM Hospital):</strong> <a href="tel:02224131212" className="underline font-mono text-purple-700">022-24131212</a></div>
                <div>🤝 <strong>Vandrevala Foundation:</strong> <a href="tel:+919999666555" className="underline font-mono text-purple-700">+91 9999-666-555</a></div>
                <div>🚨 <strong>National Emergency:</strong> <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">112</code></div>
              </div>
            </div>

            <button onClick={onClose} className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl">
              Close
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
