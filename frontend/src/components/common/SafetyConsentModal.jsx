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

/**
 * SafetyConsentModal
 * 
 * Multi-stage intentional safety workflow:
 *  Stage 1: 'INITIAL' - Choose to type 'CONFIRM', take Context Assessment, or go straight to Distract/Scribble.
 *  Stage 2: 'ASSESSMENT' - Situation verification (C-SSRS for self-harm/suicide, or Situational Stress).
 *  Stage 3: 'ASSESSMENT_RESULT' - Shows % distress score and options to "Contact Safe Place" or "Distract Myself".
 *  Stage 4: 'DISTRACT' - Interactive Scribble Canvas (vent anger) + 5-4-3-2-1 Sensory Grounding.
 *  Stage 5: 'CONTACT_PICKER' - Multi-select specific contacts from Safe Place and dispatch email.
 *  Stage 6: 'SENT_RESULT' - Confirmation message & National Helpline reminders.
 */

// Columbia Suicide Severity Rating Scale Screener (C-SSRS) items (Only for genuine active suicidal ideation)
const CSSRS_QUESTIONS = [
  { id: "cssrs_1", text: "Have you wished you could go to sleep and not wake up, or wished you were dead?", weight: 15 },
  { id: "cssrs_2", text: "Have you had actual thoughts of killing yourself or ending your life?", weight: 25 },
  { id: "cssrs_3", text: "Have you been thinking about how you might do this (methods/ways)?", weight: 25 },
  { id: "cssrs_4", text: "Have you had any intention to act on these thoughts?", weight: 20 },
  { id: "cssrs_5", text: "Have you started to work out details or taken steps towards hurting yourself?", weight: 15 },
];

// Panic & Acute Anxiety / Overwhelm Screener
const PANIC_ANXIETY_QUESTIONS = [
  { id: "panic_1", text: "Are you feeling an intense surge of sudden fear, dread, or a racing heartbeat right now?", weight: 25 },
  { id: "panic_2", text: "Are you finding it hard to catch your breath, feeling dizzy, shaky, or trembling?", weight: 25 },
  { id: "panic_3", text: "Do you feel like you are losing control or about to experience a full panic attack?", weight: 20 },
  { id: "panic_4", text: "Are you feeling scared being by yourself and need someone to help steady you?", weight: 15 },
  { id: "panic_5", text: "Have physical grounding exercises or deep breaths felt difficult to do alone?", weight: 15 },
];

// Loneliness & Isolation / Emotional Overwhelm Screener
const LONELINESS_QUESTIONS = [
  { id: "lone_1", text: "Are you feeling painfully isolated, lonely, or like no one understands what you're going through?", weight: 25 },
  { id: "lone_2", text: "Do you feel frightened or overwhelmed by being alone with your thoughts right now?", weight: 25 },
  { id: "lone_3", text: "Would hearing a comforting voice or getting a message from a trusted friend give you relief?", weight: 20 },
  { id: "lone_4", text: "Are your thoughts spiraling and making you feel unsafe in your current environment?", weight: 15 },
  { id: "lone_5", text: "Do you feel you need an immediate check-in before this loneliness escalates?", weight: 15 },
];

// General Acute Emotional Distress Screener
const GENERAL_QUESTIONS = [
  { id: "gen_1", text: "Do you feel completely overwhelmed and unable to cope with this moment alone?", weight: 25 },
  { id: "gen_2", text: "Are you feeling intense physical tension, frustration, or rapid racing thoughts?", weight: 20 },
  { id: "gen_3", text: "Do you feel disconnected from yourself or your surroundings right now?", weight: 20 },
  { id: "gen_4", text: "Do you feel having someone close to you check in right now would prevent a crisis?", weight: 20 },
  { id: "gen_5", text: "Have you tried calming techniques (breathing, stepping away) without relief?", weight: 15 },
];

// Context Classifier Helper
function determineAssessmentType(text = "", isExplicitSuicide = false) {
  const lower = (text || "").toLowerCase();

  // 1. Check for explicit negation of suicide: e.g. "not thinking of suicide", "no suicidal thoughts", "not suicidal"
  const isNegatedSuicide = /\b(not|no|don't|dont|never|am not)\s+(having|thinking of|feeling|any)?\s*(suicid|kill|die|hurt myself|harm)/i.test(lower);

  // Genuine active suicide intent (only if NOT negated)
  const hasActiveSuicideKeywords = !isNegatedSuicide && /\b(suicid|kill myself|killing myself|end my life|take my own life|want to die|wanna die|cut myself|hang myself)\b/i.test(lower);

  if (isExplicitSuicide || hasActiveSuicideKeywords) {
    return {
      type: "suicide",
      title: "Columbia Clinical Screener (C-SSRS)",
      subtitle: "Standard clinical safety screening based on self-harm context.",
      questions: CSSRS_QUESTIONS
    };
  }

  // 2. Panic attack / Acute Anxiety / Fear context
  if (/\b(panic|panic attack|scared|frightened|heart racing|can't breathe|shaking|trembling|dizzy|hyperventilat|anxious|anxiety)\b/i.test(lower)) {
    return {
      type: "panic",
      title: "Panic & Anxiety Situation Check",
      subtitle: "Targeted check to assess panic intensity, physical symptoms, and grounding needs.",
      questions: PANIC_ANXIETY_QUESTIONS
    };
  }

  // 3. Loneliness / Isolation / Sadness context
  if (/\b(lonely|alone|isolated|nobody|abandoned|crying|hopeless|scared to be alone)\b/i.test(lower)) {
    return {
      type: "loneliness",
      title: "Loneliness & Emotional Check",
      subtitle: "Understanding your current feelings of isolation and need for support.",
      questions: LONELINESS_QUESTIONS
    };
  }

  // 4. Default: General Acute Distress
  return {
    type: "general",
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
  
  // Stages: 'INITIAL' | 'ASSESSMENT' | 'ASSESSMENT_RESULT' | 'DISTRACT' | 'CONTACT_PICKER' | 'SENT_RESULT'
  const [stage, setStage] = useState("INITIAL");

  // Stage 1: Typing CONFIRM
  const [confirmInput, setConfirmInput] = useState("");

  // Stage 2: Assessment state dynamically adapted to user context
  const assessmentConfig = determineAssessmentType(contextText, isSuicideContext);
  const questionsToUse = assessmentConfig.questions;
  const [answers, setAnswers] = useState({});
  const [distressScore, setDistressScore] = useState(0);

  // Stage 4: Distract Mode tabs ('scribble' | 'grounding')
  const [distractTab, setDistractTab] = useState("scribble");
  const [groundingStepIndex, setGroundingStepIndex] = useState(0);

  // Scribble Canvas Refs and settings
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ef4444"); // Red for anger vent
  const [brushSize, setBrushSize] = useState(6);

  // Stage 5: Contact selection
  const [selectedContactEmails, setSelectedContactEmails] = useState(new Set());
  const [isSubmittingSos, setIsSubmittingSos] = useState(false);
  const [sosResult, setSosResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStage("INITIAL");
      setConfirmInput("");
      setAnswers({});
      setDistressScore(0);
      setGroundingStepIndex(0);
      setSosResult(null);
      setErrorMsg("");

      // Pre-select all SOS-enabled contacts by default
      const defaultSelected = new Set(
        contacts
          .filter(c => c.receive_sos !== false && c.email)
          .map(c => c.email.trim().toLowerCase())
      );
      setSelectedContactEmails(defaultSelected);
    }
  }, [isOpen, contacts]);

  // Canvas drawing setup
  useEffect(() => {
    if (stage === "DISTRACT" && distractTab === "scribble" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      // Set actual display resolution
      canvas.width = canvas.parentElement.clientWidth || 500;
      canvas.height = 320;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [stage, distractTab]);

  if (!isOpen) return null;

  // --- Handlers ---
  const handleConfirmDirect = () => {
    if (confirmInput.trim().toUpperCase() === "CONFIRM") {
      setStage("CONTACT_PICKER");
    }
  };

  const handleAssessmentAnswer = (questionId, yes) => {
    setAnswers(prev => ({ ...prev, [questionId]: yes }));
  };

  const handleFinishAssessment = () => {
    let score = 0;
    questionsToUse.forEach(q => {
      if (answers[q.id] === true) {
        score += q.weight;
      }
    });
    setDistressScore(Math.min(score, 100));
    setStage("ASSESSMENT_RESULT");
  };

  const allQuestionsAnswered = questionsToUse.every(q => answers[q.id] !== undefined);

  // Drawing Canvas logic
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Contact Picker Checkbox
  const toggleContactEmail = (email) => {
    const clean = email.trim().toLowerCase();
    setSelectedContactEmails(prev => {
      const next = new Set(prev);
      if (next.has(clean)) next.delete(clean);
      else next.add(clean);
      return next;
    });
  };

  const handleSendSosAlert = async () => {
    const recipients = Array.from(selectedContactEmails);
    if (recipients.length === 0) {
      setErrorMsg("Please select at least one contact to receive your alert.");
      return;
    }
    setIsSubmittingSos(true);
    setErrorMsg("");

    try {
      const result = await sendSosAlert(recipients, false);
      setSosResult(result);
      setStage("SENT_RESULT");
      if (onSosSuccess) onSosSuccess(result);
    } catch (err) {
      setErrorMsg(err.message || "Failed to dispatch SOS alert. Please try again or reach helplines directly.");
    } finally {
      setIsSubmittingSos(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={isSubmittingSos ? undefined : onClose} />

      <div className="relative w-full max-w-xl my-auto rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 sm:p-8 z-10 overflow-hidden text-slate-800">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmittingSos}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-20 cursor-pointer disabled:opacity-30"
          aria-label="Close"
        >
          <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
        </button>

        {/* ------------------------------------------------------------- */}
        {/* STAGE 1: INITIAL CONSENT & PAUSE */}
        {/* ------------------------------------------------------------- */}
        {stage === "INITIAL" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-xl shrink-0">
                <FontAwesomeIcon icon={faShieldHeart} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Pause & Check In First</h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Before contacting your safe person, let's take a breath to ensure you get the exact care you need.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-500" />
                <span>You have 2 mindful options before dispatching an emergency alert:</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Contacting your safe person will send an urgent email to their personal inbox. You can verify your situation with a 1-minute clinical check, try an anger/distraction exercise, or confirm immediately if it's an urgent emergency.
              </p>
            </div>

            {/* Option A: Quick Situation Verification */}
            <div className="p-4 border border-purple-200 bg-purple-50/50 rounded-2xl hover:border-purple-300 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                    <FontAwesomeIcon icon={faClipboardCheck} className="text-purple-600" />
                    Option 1: {assessmentConfig.title}
                  </h3>
                  <p className="text-xs text-purple-700 mt-1">
                    {assessmentConfig.subtitle} Answer 5 quick questions to calculate your situation score.
                  </p>
                </div>
                <button
                  onClick={() => setStage("ASSESSMENT")}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all shrink-0"
                >
                  Start Check
                </button>
              </div>
            </div>

            {/* Option B: Distract / Scribble Exercise */}
            <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-2xl hover:border-emerald-300 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                    <FontAwesomeIcon icon={faPaintBrush} className="text-emerald-600" />
                    Option 2: Distract & Ground (Scribble Pad / 5-4-3-2-1)
                  </h3>
                  <p className="text-xs text-emerald-700 mt-1">
                    Vigorously scratch out frustration on our scribble pad or take 2 minutes to ground your senses.
                  </p>
                </div>
                <button
                  onClick={() => setStage("DISTRACT")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all shrink-0"
                >
                  Try Distraction
                </button>
              </div>
            </div>

            {/* Option C: Direct Fast-Track (Type CONFIRM) */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Need to reach them immediately without questions?
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type CONFIRM to proceed"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  className="flex-1 p-2.5 text-xs rounded-xl border border-slate-200 bg-white font-mono focus:border-red-500 outline-none uppercase"
                />
                <button
                  onClick={handleConfirmDirect}
                  disabled={confirmInput.trim().toUpperCase() !== "CONFIRM"}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-all"
                >
                  Confirm & Choose Contact
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STAGE 2: CLINICAL / SITUATIONAL ASSESSMENT */}
        {/* ------------------------------------------------------------- */}
        {stage === "ASSESSMENT" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {assessmentConfig.title}
                </h2>
                <p className="text-xs text-slate-500">
                  {assessmentConfig.subtitle}
                </p>
              </div>
              <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">
                5 Questions
              </span>
            </div>

            <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1">
              {questionsToUse.map((q, idx) => (
                <div key={q.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60">
                  <p className="text-xs font-medium text-slate-800 mb-2.5">
                    <span className="font-bold text-purple-600 mr-1.5">{idx + 1}.</span>
                    {q.text}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleAssessmentAnswer(q.id, true)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        answers[q.id] === true
                          ? "bg-purple-600 text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssessmentAnswer(q.id, false)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        answers[q.id] === false
                          ? "bg-slate-700 text-white shadow-xs"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setStage("INITIAL")}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleFinishAssessment}
                disabled={!allQuestionsAnswered}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition shadow-sm"
              >
                Calculate Situation Result
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STAGE 3: ASSESSMENT RESULT & RECOMMENDATION */}
        {/* ------------------------------------------------------------- */}
        {stage === "ASSESSMENT_RESULT" && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center text-2xl shadow-sm transition-all"
              style={{
                backgroundColor: distressScore >= 50 ? "#fee2e2" : distressScore >= 30 ? "#fef3c7" : "#ecfdf5",
                color: distressScore >= 50 ? "#dc2626" : distressScore >= 30 ? "#d97706" : "#059669"
              }}
            >
              <FontAwesomeIcon icon={faHeartPulse} />
            </div>

            <div>
              <span className="text-3xl font-black text-slate-900 tracking-tight">{distressScore}%</span>
              <p className="text-xs uppercase tracking-wider font-bold mt-1"
                style={{ color: distressScore >= 50 ? "#dc2626" : distressScore >= 30 ? "#d97706" : "#059669" }}
              >
                {distressScore >= 50 ? "High Distress / Urgent Support Needed" : distressScore >= 30 ? "Moderate Distress" : "Mild Distress / Coping Suggested"}
              </p>
              <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
                {distressScore >= 40
                  ? "Your responses indicate acute distress. Reaching out to your safe contact or national crisis helplines is strongly recommended."
                  : "You are experiencing strain, but an active grounding technique or venting anger right now may help bring your heart rate down."}
              </p>
            </div>

            {/* Decision Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setStage("DISTRACT")}
                className="p-4 rounded-2xl border border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/70 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
                  <FontAwesomeIcon icon={faPaintBrush} />
                  <span>Try Distraction First</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Release frustration on the Scribble Pad or 5-4-3-2-1 Sensory Grounding.
                </p>
              </button>

              <button
                onClick={() => setStage("CONTACT_PICKER")}
                className="p-4 rounded-2xl border border-red-300 bg-red-50/60 hover:bg-red-100/70 transition-all text-left cursor-pointer"
              >
                <div className="flex items-center gap-2 text-red-800 font-bold text-xs mb-1">
                  <FontAwesomeIcon icon={faPaperPlane} />
                  <span>Contact Safe Place</span>
                </div>
                <p className="text-[11px] text-red-700">
                  Select which contact receives your SOS email right now.
                </p>
              </button>
            </div>

            <button
              onClick={() => setStage("INITIAL")}
              className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
            >
              Start over
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STAGE 4: DISTRACT / SCRIBBLE & GROUNDING HUB */}
        {/* ------------------------------------------------------------- */}
        {stage === "DISTRACT" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Take Out Your Frustration</h2>
                <p className="text-xs text-slate-500">Scribble furiously or ground your 5 senses to release adrenaline.</p>
              </div>
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs">
                <button
                  onClick={() => setDistractTab("scribble")}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer transition ${
                    distractTab === "scribble" ? "bg-white text-purple-700 shadow-xs" : "text-slate-600"
                  }`}
                >
                  Scribble Pad
                </button>
                <button
                  onClick={() => setDistractTab("grounding")}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer transition ${
                    distractTab === "grounding" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600"
                  }`}
                >
                  5-4-3-2-1
                </button>
              </div>
            </div>

            {/* TAB A: SCRIBBLE CANVAS */}
            {distractTab === "scribble" && (
              <div className="space-y-3">
                {/* Tool bar */}
                <div className="flex items-center justify-between text-xs bg-slate-100 p-2 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Color:</span>
                    {["#ef4444", "#8b5cf6", "#06b6d4", "#f59e0b", "#ffffff"].map(c => (
                      <button
                        key={c}
                        onClick={() => setBrushColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-full border-2 cursor-pointer transition ${
                          brushColor === c ? "border-slate-900 scale-110" : "border-transparent"
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Weight:</span>
                      {[4, 8, 14].map(size => (
                        <button
                          key={size}
                          onClick={() => setBrushSize(size)}
                          className={`w-5 h-5 rounded text-[10px] font-bold cursor-pointer ${
                            brushSize === size ? "bg-purple-600 text-white" : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={clearCanvas}
                      className="text-slate-600 hover:text-red-600 p-1 cursor-pointer"
                      title="Clear canvas"
                    >
                      <FontAwesomeIcon icon={faEraser} /> Clear
                    </button>
                  </div>
                </div>

                {/* Canvas element */}
                <div className="rounded-2xl overflow-hidden border border-slate-300 shadow-inner bg-slate-900">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-64 touch-none cursor-crosshair block"
                  />
                </div>
                <p className="text-[11px] text-slate-500 text-center italic">
                  Press hard, scratch, loop circles, or scribble fast. Releasing physical tension reduces cortisol.
                </p>
              </div>
            )}

            {/* TAB B: 5-4-3-2-1 SENSORY GROUNDING */}
            {distractTab === "grounding" && (
              <div className="space-y-4 py-2">
                {(() => {
                  const currentStep = GROUNDING_STEPS[groundingStepIndex];
                  return (
                    <div className="p-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 text-center space-y-3">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center text-2xl">
                        <FontAwesomeIcon icon={currentStep.icon} />
                      </div>
                      <h3 className="text-base font-bold text-emerald-950">{currentStep.label}</h3>
                      <p className="text-xs text-emerald-800 max-w-sm mx-auto leading-relaxed">
                        {currentStep.hint}
                      </p>

                      <div className="flex justify-center gap-1.5 pt-3">
                        {GROUNDING_STEPS.map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all ${
                              i === groundingStepIndex ? "w-6 bg-emerald-600" : "w-2 bg-emerald-200"
                            }`}
                          />
                        ))}
                      </div>

                      <div className="flex justify-center gap-3 pt-2">
                        {groundingStepIndex > 0 && (
                          <button
                            onClick={() => setGroundingStepIndex(prev => prev - 1)}
                            className="text-xs text-emerald-700 bg-white border border-emerald-300 px-3 py-1.5 rounded-xl cursor-pointer"
                          >
                            Previous
                          </button>
                        )}
                        {groundingStepIndex < GROUNDING_STEPS.length - 1 ? (
                          <button
                            onClick={() => setGroundingStepIndex(prev => prev + 1)}
                            className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-xl cursor-pointer"
                          >
                            Next Step ({GROUNDING_STEPS[groundingStepIndex + 1].count})
                          </button>
                        ) : (
                          <div className="text-xs font-bold text-emerald-700">
                            Awesome job grounding your senses!
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Exit actions after distract */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                onClick={() => setStage("INITIAL")}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Back to options
              </button>

              <button
                onClick={() => setStage("CONTACT_PICKER")}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition shadow-sm flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faPaperPlane} />
                Still Need to Contact Safe Place
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STAGE 5: SELECT SPECIFIC RECIPIENTS & DISPATCH */}
        {/* ------------------------------------------------------------- */}
        {stage === "CONTACT_PICKER" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <FontAwesomeIcon icon={faPaperPlane} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Choose Who Receives the Alert</h2>
                <p className="text-xs text-slate-500">
                  Select which trusted contact(s) should receive an emergency SOS email right now.
                </p>
              </div>
            </div>

            {/* Logged in Sender Note */}
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Sender details included in email:</span>{" "}
              {user?.name || "MindEase User"} ({user?.email || "Account email"}) with direct Reply-To support.
            </div>

            {/* Contact list with checkboxes */}
            <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
              {contacts.map(c => {
                const isChecked = c.email && selectedContactEmails.has(c.email.trim().toLowerCase());
                return (
                  <div
                    key={c.id}
                    onClick={() => c.email && toggleContactEmail(c.email)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? "border-red-500 bg-red-50/50 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    } ${!c.email ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{c.name}</h4>
                      <p className="text-[11px] text-slate-500">{c.email || "No email address"}</p>
                    </div>

                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center text-xs ${
                      isChecked ? "bg-red-600 border-red-600 text-white" : "border-slate-300 bg-white"
                    }`}>
                      {isChecked && <FontAwesomeIcon icon={faCheck} />}
                    </div>
                  </div>
                );
              })}

              {contacts.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500 border border-dashed rounded-xl">
                  No trusted contacts found. Add them in your Safe Place dashboard first.
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-100 border border-red-200 text-red-700 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setStage("INITIAL")}
                disabled={isSubmittingSos}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleSendSosAlert}
                disabled={isSubmittingSos || selectedContactEmails.size === 0}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer transition shadow-sm flex items-center justify-center gap-2"
              >
                {isSubmittingSos ? (
                  <>
                    <FontAwesomeIcon icon={faRotateRight} className="animate-spin" />
                    Sending Email...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} />
                    Send Alert to {selectedContactEmails.size} Contact(s)
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STAGE 6: RESULT CONFIRMATION & CRISIS RESOURCES */}
        {/* ------------------------------------------------------------- */}
        {stage === "SENT_RESULT" && (
          <div className="space-y-6 text-center py-2">
            <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl ${
              sosResult?.simulated ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
            }`}>
              <FontAwesomeIcon icon={sosResult?.simulated ? faTriangleExclamation : faCheck} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {sosResult?.simulated ? "Alert Simulated" : "Emergency Alert Sent"}
              </h2>
              <p className="text-xs text-slate-600 mt-2 max-w-sm mx-auto leading-relaxed">
                {sosResult?.message || "Your selected contacts have been notified to check in on you."}
              </p>
            </div>

            {/* Helpline quick-card */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-left space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <FontAwesomeIcon icon={faPhone} className="text-red-500" />
                  Immediate 24×7 Free & Confidential Crisis Lines:
                </p>
                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">India Govt</span>
              </div>
              
              <div className="bg-white border border-purple-200 p-2.5 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-purple-950">TeleMANAS (National Mental Health)</div>
                  <div className="text-xs font-mono font-extrabold text-purple-700">14416 &nbsp;/&nbsp; 1800-891-4416</div>
                </div>
                <a
                  href="tel:14416"
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-2xs"
                >
                  Call 14416
                </a>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1 pt-1">
                <div>🏥 <strong>Hitguj (KEM Hospital):</strong> <a href="tel:02224131212" className="underline font-mono text-purple-700">022-24131212</a> (24×7 Mumbai)</div>
                <div>🤝 <strong>Vandrevala Foundation:</strong> <a href="tel:+919999666555" className="underline font-mono text-purple-700">+91 9999-666-555</a> (24×7)</div>
                <div>🚨 <strong>National Emergency:</strong> Police <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">100 / 112</code></div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl cursor-pointer transition"
            >
              Close
            </button>
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}
