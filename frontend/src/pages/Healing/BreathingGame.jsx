import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faPlay, faPause, faRotateLeft, faLeaf } from "@fortawesome/free-solid-svg-icons";

const BREATHING_PATTERNS = {
  box: {
    name: "Box Breathing (4-4-4-4)",
    phases: [
      { name: "Inhale", duration: 4, instruction: "Breathe in slowly through your nose...", scale: 1.35, color: "from-teal-400 to-emerald-500 shadow-teal-300/50" },
      { name: "Hold", duration: 4, instruction: "Hold your breath calmly...", scale: 1.35, color: "from-indigo-400 to-purple-500 shadow-indigo-300/50" },
      { name: "Exhale", duration: 4, instruction: "Breathe out gently through your mouth...", scale: 0.85, color: "from-purple-400 to-pink-500 shadow-purple-300/50" },
      { name: "Rest", duration: 4, instruction: "Rest and pause...", scale: 0.85, color: "from-slate-400 to-indigo-400 shadow-slate-300/50" },
    ],
  },
  relax: {
    name: "Calming (4-7-8)",
    phases: [
      { name: "Inhale", duration: 4, instruction: "Inhale deeply through your nose...", scale: 1.35, color: "from-teal-400 to-cyan-500 shadow-teal-300/50" },
      { name: "Hold", duration: 7, instruction: "Hold your breath comfortably...", scale: 1.35, color: "from-indigo-500 to-purple-600 shadow-indigo-300/50" },
      { name: "Exhale", duration: 8, instruction: "Exhale completely with a soft sigh...", scale: 0.85, color: "from-rose-400 to-pink-500 shadow-rose-300/50" },
    ],
  },
  simple: {
    name: "Gentle Rhythm (4-4)",
    phases: [
      { name: "Inhale", duration: 4, instruction: "Breathe in...", scale: 1.35, color: "from-emerald-400 to-teal-500 shadow-emerald-300/50" },
      { name: "Exhale", duration: 4, instruction: "Breathe out...", scale: 0.85, color: "from-purple-400 to-pink-500 shadow-purple-300/50" },
    ],
  },
};

function BreathingGame({ onBack }) {
  const [patternKey, setPatternKey] = useState("box");
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(BREATHING_PATTERNS.box.phases[0].duration);
  const [isActive, setIsActive] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);

  const pattern = BREATHING_PATTERNS[patternKey];
  const currentPhase = pattern.phases[phaseIndex];

  // Timer effect
  useEffect(() => {
    let timer = null;

    if (isActive) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Move to next phase
            const nextIndex = (phaseIndex + 1) % pattern.phases.length;
            if (nextIndex === 0) {
              setCompletedCycles((c) => c + 1);
            }
            setPhaseIndex(nextIndex);
            return pattern.phases[nextIndex].duration;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [isActive, phaseIndex, pattern]);

  const handlePatternChange = (key) => {
    setPatternKey(key);
    setPhaseIndex(0);
    setTimeLeft(BREATHING_PATTERNS[key].phases[0].duration);
    setIsActive(false);
    setCompletedCycles(0);
  };

  const handleToggleActive = () => {
    setIsActive(!isActive);
  };

  const handleReset = () => {
    setIsActive(false);
    setPhaseIndex(0);
    setTimeLeft(pattern.phases[0].duration);
    setCompletedCycles(0);
  };

  return (
    <div className="p-6 sm:p-8 w-full flex flex-col items-center min-h-screen bg-background">
      
      {/* Header Bar */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-textSecondary hover:text-textPrimary bg-white border border-border px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer shadow-xs"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Back to Games</span>
        </button>

        <span className="text-xs uppercase tracking-wider font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
          Breathing Game 🌿
        </span>
      </div>

      {/* Main Container Card */}
      <div className="bg-white border border-border rounded-3xl p-6 sm:p-8 shadow-md w-full max-w-2xl text-center flex flex-col items-center">
        
        <div className="flex items-center gap-2 mb-1 text-emerald-600 text-2xl">
          <FontAwesomeIcon icon={faLeaf} />
          <h1 className="text-2xl font-heading font-bold text-textPrimary">Breathing Circle</h1>
        </div>

        <p className="text-sm text-textSecondary mb-6">
          Follow the expanding and shrinking circle to guide your breath.
        </p>

        {/* Pattern Selector Row */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {Object.keys(BREATHING_PATTERNS).map((key) => (
            <button
              key={key}
              onClick={() => handlePatternChange(key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                patternKey === key
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {BREATHING_PATTERNS[key].name}
            </button>
          ))}
        </div>

        {/* Breathing Animated Visual Sphere Area */}
        <div className="relative w-full h-[320px] bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col items-center justify-center overflow-hidden mb-6">
          
          {/* Animated Circle Sphere */}
          <div
            style={{
              transform: `scale(${isActive ? currentPhase.scale : 1})`,
              transitionDuration: `${currentPhase.duration}s`,
            }}
            className={`w-40 h-40 rounded-full bg-gradient-to-br ${currentPhase.color} flex items-center justify-center transition-transform ease-in-out shadow-2xl opacity-90`}
          >
            {/* Center Phase Label & Seconds Countdown */}
            <div className="text-white text-center select-none transform transition-transform">
              <div className="text-lg font-bold tracking-wide uppercase">{currentPhase.name}</div>
              <div className="text-3xl font-extrabold mt-1">{timeLeft}s</div>
            </div>
          </div>

          {/* Guidance Subtitle Below Circle */}
          <p className="absolute bottom-5 text-sm font-medium text-slate-600 max-w-md px-4">
            {isActive ? currentPhase.instruction : "Press Start Breathing to begin"}
          </p>
        </div>

        {/* Control Bar & Cycle Counter */}
        <div className="w-full flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-2xl px-5 py-3 text-sm">
          <div className="text-slate-600 font-medium">
            Cycles Completed: <span className="text-emerald-600 font-bold text-base">{completedCycles}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleActive}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <FontAwesomeIcon icon={isActive ? faPause : faPlay} />
              <span>{isActive ? "Pause" : "Start Breathing"}</span>
            </button>

            <button
              onClick={handleReset}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs transition-all cursor-pointer"
              title="Reset"
            >
              <FontAwesomeIcon icon={faRotateLeft} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default BreathingGame;
