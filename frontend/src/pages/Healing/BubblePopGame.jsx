import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faRotateLeft, faPlay, faPause } from "@fortawesome/free-solid-svg-icons";

const BUBBLE_COLORS = [
  "from-pink-400 to-purple-500 border-pink-200/60 shadow-pink-300/40",
  "from-indigo-400 to-cyan-500 border-indigo-200/60 shadow-indigo-300/40",
  "from-emerald-400 to-teal-500 border-emerald-200/60 shadow-emerald-300/40",
  "from-amber-400 to-rose-500 border-amber-200/60 shadow-amber-300/40",
  "from-violet-400 to-fuchsia-500 border-violet-200/60 shadow-violet-300/40",
];

function BubblePopGame({ onBack }) {
  const [score, setScore] = useState(0);
  const [poppedCount, setPoppedCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [bubbles, setBubbles] = useState([]);
  const containerRef = useRef(null);

  // Spawn bubbles periodically when playing
  useEffect(() => {
    if (!isPlaying) return;

    const spawnInterval = setInterval(() => {
      setBubbles((prev) => {
        if (prev.length >= 15) return prev; // Limit max active bubbles

        const id = Date.now() + Math.random();
        const size = Math.floor(Math.random() * 25) + 55; // 55px - 80px
        const x = Math.floor(Math.random() * 82) + 5; // 5% - 87% left
        const speed = Math.random() * 4 + 5; // 5s - 9s float speed
        const color = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];

        return [...prev, { id, x, y: 105, size, speed, color, isPopping: false }];
      });
    }, 800);

    return () => clearInterval(spawnInterval);
  }, [isPlaying]);

  // Animation loop to move bubbles upwards
  useEffect(() => {
    if (!isPlaying) return;

    const animFrame = setInterval(() => {
      setBubbles((prev) =>
        prev
          .map((b) => (b.isPopping ? b : { ...b, y: b.y - 0.8 }))
          .filter((b) => b.y > -20)
      );
    }, 30);

    return () => clearInterval(animFrame);
  }, [isPlaying]);

  const handlePop = (id) => {
    setBubbles((prev) =>
      prev.map((b) => (b.id === id ? { ...b, isPopping: true } : b))
    );

    setScore((s) => s + 10);
    setPoppedCount((c) => c + 1);

    // Remove after pop effect animation
    setTimeout(() => {
      setBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 250);
  };

  const handleReset = () => {
    setBubbles([]);
    setScore(0);
    setPoppedCount(0);
    setIsPlaying(true);
  };

  return (
    <div className="p-6 sm:p-8 w-full flex flex-col items-center min-h-screen bg-background">
      
      {/* Top Header Bar */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-textSecondary hover:text-textPrimary bg-white border border-border px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer shadow-xs"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Back to Games</span>
        </button>

        <span className="text-xs uppercase tracking-wider font-semibold text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full border border-indigo-200">
          Bubble Pop 🫧
        </span>
      </div>

      {/* Main Game Box */}
      <div className="bg-white border border-border rounded-3xl p-6 sm:p-8 shadow-md w-full max-w-2xl text-center flex flex-col items-center">
        
        <div className="flex items-center gap-2 mb-1 text-indigo-600 text-2xl">
          <span className="text-2xl">🫧</span>
          <h1 className="text-2xl font-heading font-bold text-textPrimary">Bubble Pop</h1>
        </div>

        <p className="text-sm text-textSecondary mb-6">
          Tap or click the floating bubbles to pop them for relaxing stress relief.
        </p>

        {/* Score & Controls Bar */}
        <div className="w-full flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-2xl px-5 py-3 mb-6 text-sm">
          <div className="flex items-center gap-4">
            <div>
              Score: <span className="text-indigo-600 font-bold text-base">{score}</span>
            </div>
            <div className="text-slate-500 text-xs sm:text-sm">
              Popped: <span className="font-semibold text-slate-700">{poppedCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
              <span>{isPlaying ? "Pause" : "Resume"}</span>
            </button>

            <button
              onClick={handleReset}
              className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs transition-all cursor-pointer"
              title="Reset"
            >
              <FontAwesomeIcon icon={faRotateLeft} />
            </button>
          </div>
        </div>

        {/* Floating Bubble Playfield Canvas Area */}
        <div
          ref={containerRef}
          className="relative w-full h-[380px] bg-gradient-to-b from-indigo-50/40 via-purple-50/30 to-blue-50/50 rounded-2xl border border-indigo-100/80 overflow-hidden shadow-inner select-none cursor-crosshair"
        >
          {bubbles.map((b) => (
            <div
              key={b.id}
              onClick={() => handlePop(b.id)}
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: `${b.size}px`,
                height: `${b.size}px`,
              }}
              className={`absolute rounded-full bg-gradient-to-br ${b.color} border-2 backdrop-blur-xs flex items-center justify-center cursor-pointer transition-transform duration-150 shadow-lg hover:scale-110 active:scale-125 ${
                b.isPopping ? "scale-150 opacity-0 transition-all duration-200" : "animate-pulse"
              }`}
            >
              {/* Inner bubble shine element */}
              <div className="w-2.5 h-2.5 rounded-full bg-white/70 absolute top-2 left-2" />
            </div>
          ))}

          {bubbles.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm">
              <span className="text-3xl mb-2 animate-bounce">🫧</span>
              <span>Bubbles arriving shortly...</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default BubblePopGame;
