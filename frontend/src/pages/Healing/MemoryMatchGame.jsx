import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faRotateLeft, faBrain, faTrophy } from "@fortawesome/free-solid-svg-icons";

const EMOJI_POOL = ["🌸", "🌿", "☀️", "🌊", "🧘", "🎨", "🌈", "💜", "🌙", "🍀", "🕯️", "🦋"];

function MemoryMatchGame({ onBack }) {
  const [difficulty, setDifficulty] = useState(8); // 8 cards (4 pairs) or 16 cards (8 pairs)
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]); // indices of currently flipped cards
  const [matched, setMatched] = useState([]); // array of matched card ids
  const [moves, setMoves] = useState(0);
  const [isWon, setIsWon] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    initGame(difficulty);
  }, [difficulty]);

  const initGame = (numCards = difficulty) => {
    const numPairs = numCards / 2;
    const selectedEmojis = EMOJI_POOL.slice(0, numPairs);
    const deck = [...selectedEmojis, ...selectedEmojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({
        id: index,
        emoji,
      }));

    setCards(deck);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setIsWon(false);
    setIsChecking(false);
  };

  const handleCardClick = (index) => {
    if (isChecking) return;
    if (flipped.includes(index) || matched.includes(cards[index].id)) return;

    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((prev) => prev + 1);
      setIsChecking(true);

      const [firstIdx, secondIdx] = newFlipped;
      if (cards[firstIdx].emoji === cards[secondIdx].emoji) {
        // Match found!
        const newMatched = [...matched, cards[firstIdx].id, cards[secondIdx].id];
        setMatched(newMatched);
        setFlipped([]);
        setIsChecking(false);

        if (newMatched.length === cards.length) {
          setIsWon(true);
        }
      } else {
        // No match - flip back after delay
        setTimeout(() => {
          setFlipped([]);
          setIsChecking(false);
        }, 900);
      }
    }
  };

  return (
    <div className="p-6 sm:p-8 w-full flex flex-col items-center min-h-screen bg-background">
      
      {/* Top Header */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-textSecondary hover:text-textPrimary bg-white border border-border px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer shadow-xs"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Back to Games</span>
        </button>

        <span className="text-xs uppercase tracking-wider font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
          Memory Match 🧠
        </span>
      </div>

      {/* Main Game Container */}
      <div className="bg-white border border-border rounded-3xl p-6 sm:p-8 shadow-md w-full max-w-xl text-center flex flex-col items-center">
        
        <div className="flex items-center gap-2 mb-1 text-purple-600 text-2xl">
          <FontAwesomeIcon icon={faBrain} />
          <h1 className="text-2xl font-heading font-bold text-textPrimary">Memory Match</h1>
        </div>
        
        <p className="text-sm text-textSecondary mb-6">
          Flip cards to find matching pairs and clear the board.
        </p>

        {/* Controls & Stats Row */}
        <div className="w-full flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-2xl px-5 py-3 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Difficulty:</span>
            <button
              onClick={() => setDifficulty(8)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                difficulty === 8
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Easy (4 Pairs)
            </button>
            <button
              onClick={() => setDifficulty(16)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                difficulty === 16
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              Normal (8 Pairs)
            </button>
          </div>

          <div className="font-semibold text-slate-700">
            Moves: <span className="text-purple-600 font-bold">{moves}</span>
          </div>
        </div>

        {/* Win Alert Banner */}
        {isWon && (
          <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 mb-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <FontAwesomeIcon icon={faTrophy} className="text-2xl text-emerald-600 mb-1" />
            <h2 className="text-lg font-bold">Wonderful Job! 🎉</h2>
            <p className="text-xs text-emerald-700 mt-0.5">
              You matched all pairs in <strong className="font-semibold">{moves} moves</strong>.
            </p>
          </div>
        )}

        {/* Cards Grid */}
        <div
          className={`grid gap-3 sm:gap-4 w-full mb-6 ${
            difficulty === 8 ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-4"
          }`}
        >
          {cards.map((card, index) => {
            const isFlipped = flipped.includes(index) || matched.includes(card.id);
            const isCardMatched = matched.includes(card.id);

            return (
              <button
                key={index}
                onClick={() => handleCardClick(index)}
                disabled={isCardMatched}
                className={`aspect-square rounded-2xl text-3xl sm:text-4xl flex items-center justify-center transition-all duration-300 transform select-none cursor-pointer shadow-sm ${
                  isCardMatched
                    ? "bg-emerald-100/80 border-2 border-emerald-300 opacity-80 cursor-default scale-95"
                    : isFlipped
                    ? "bg-purple-50 border-2 border-purple-400 rotate-y-180 shadow-md"
                    : "bg-gradient-to-br from-purple-500 to-indigo-600 border-2 border-purple-400 text-white hover:scale-105 active:scale-95"
                }`}
              >
                {isFlipped ? card.emoji : "❓"}
              </button>
            );
          })}
        </div>

        {/* Restart Button */}
        <button
          onClick={() => initGame()}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2 text-sm"
        >
          <FontAwesomeIcon icon={faRotateLeft} />
          <span>Restart Game</span>
        </button>

      </div>
    </div>
  );
}

export default MemoryMatchGame;
