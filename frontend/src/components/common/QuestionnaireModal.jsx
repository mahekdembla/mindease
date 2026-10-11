import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faClipboardCheck, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { fetchQuestionnairePrompts, submitQuestionnaire } from "../../services/api";

const QUESTION_ORDER = ["mood", "anxiety", "sleep", "energy", "support", "hope"];

const DEFAULT_QUESTIONS = {
  mood: { label: "How has your overall mood been the last few days?", low: "Very low", high: "Very good" },
  anxiety: { label: "How calm do you feel, as opposed to anxious or on edge?", low: "Very anxious", high: "Very calm" },
  sleep: { label: "How has your sleep been?", low: "Very poor", high: "Very good" },
  energy: { label: "How is your energy and motivation?", low: "Very low", high: "Very high" },
  support: { label: "Do you feel supported by the people around you?", low: "Not at all", high: "Very supported" },
  hope: { label: "How hopeful do you feel that things will improve?", low: "Not hopeful", high: "Very hopeful" },
};

function QuestionnaireModal({ isOpen, onClose, onSubmitted }) {
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [personalized, setPersonalized] = useState(false);
  const [answers, setAnswers] = useState({});
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetchQuestionnairePrompts()
      .then((data) => {
        if (cancelled || !data?.questions) return;
        setQuestions(data.questions);
        setPersonalized(!!data.personalized);
      })
      .catch((e) => console.error("Questionnaire prompts fetch error:", e));
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const allAnswered = QUESTION_ORDER.every((key) => answers[key]);

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await submitQuestionnaire(answers, note);
      setAnswers({});
      setNote("");
      setQuestions(DEFAULT_QUESTIONS);
      setPersonalized(false);
      onSubmitted && onSubmitted();
    } catch (e) {
      console.error("Questionnaire submit error:", e);
      setError(e.message || "Something went wrong saving your check-in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-md transition-opacity duration-300">
      <div className="fixed inset-0 cursor-pointer" onClick={submitting ? undefined : onClose} aria-hidden="true" />

      <div className="relative w-full max-w-xl my-auto rounded-3xl bg-white shadow-2xl border border-purple-100 p-6 sm:p-8 z-10 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-purple-200/40 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-150 z-20 cursor-pointer"
        >
          <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-sm shrink-0">
            <FontAwesomeIcon icon={faClipboardCheck} className="text-xl" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">A 2-Minute Check-in</h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              This builds your personal coping plan - be as honest as feels okay.
            </p>
          </div>
        </div>

        {personalized && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl mt-3 w-fit">
            <FontAwesomeIcon icon={faWandMagicSparkles} className="text-[10px]" />
            <span>Tailored to what you've shared with MindEase recently</span>
          </div>
        )}

        <div className="mt-5 space-y-5 max-h-[55vh] overflow-y-auto pr-1">
          {QUESTION_ORDER.map((key) => {
            const q = questions[key] || DEFAULT_QUESTIONS[key];
            return (
              <div key={key}>
                <p className="text-sm font-semibold text-slate-800 mb-2">{q.label}</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAnswers((a) => ({ ...a, [key]: n }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all cursor-pointer ${
                        answers[key] === n
                          ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-purple-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-0.5">
                  <span>{q.low}</span>
                  <span>{q.high}</span>
                </div>
              </div>
            );
          })}

          <div>
            <p className="text-sm font-semibold text-slate-800 mb-2">
              Anything specific you'd like help with right now? <span className="text-slate-400 font-normal">(optional)</span>
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. I've been missing my family and feeling disconnected lately..."
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-600 mt-3">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="w-full mt-5 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold shadow-lg shadow-purple-500/20 active:scale-[0.99] transition-all duration-150 text-base cursor-pointer"
        >
          {submitting ? "Building your plan..." : "Build My Plan"}
        </button>
      </div>
    </div>,
    document.body
  );
}

export default QuestionnaireModal;
