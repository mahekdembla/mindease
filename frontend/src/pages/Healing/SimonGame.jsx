import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faRotateLeft, faGamepad } from "@fortawesome/free-solid-svg-icons";

const btnColors = ["red", "yellow", "green", "purple"];

function SimonGame({ onBack }) {
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(0);
  const [gameSeq, setGameSeq] = useState([]);
  const [userSeq, setUserSeq] = useState([]);
  const [flashBtn, setFlashBtn] = useState(null); // { color, type: 'flash' | 'userFlash' }
  const [statusMsg, setStatusMsg] = useState("Press Start or any key to start");
  const [gameOverFlash, setGameOverFlash] = useState(false);

  // Keyboard press listener to start game
  useEffect(() => {
    const handleKeyPress = () => {
      if (!started) {
        startGame();
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [started]);

  const levelUp = (currentSeq) => {
    const nextLevel = currentSeq.length + 1;
    setLevel(nextLevel);
    setStatusMsg(`Level ${nextLevel}`);

    const randColor = btnColors[Math.floor(Math.random() * 4)];
    const newSeq = [...currentSeq, randColor];
    setGameSeq(newSeq);
    setUserSeq([]);

    // Flash the new button after a short delay
    setTimeout(() => {
      flashGameButton(randColor);
    }, 500);
  };

  const startGame = () => {
    setStarted(true);
    setGameOverFlash(false);
    setGameSeq([]);
    setUserSeq([]);
    levelUp([]);
  };

  const flashGameButton = (color) => {
    setFlashBtn({ color, type: "flash" });
    setTimeout(() => {
      setFlashBtn(null);
    }, 300);
  };

  const flashUserButton = (color) => {
    setFlashBtn({ color, type: "userFlash" });
    setTimeout(() => {
      setFlashBtn(null);
    }, 250);
  };

  const handleBtnClick = (color) => {
    if (!started) return;

    flashUserButton(color);
    const newSeq = [...userSeq, color];
    setUserSeq(newSeq);

    checkAnswer(newSeq.length - 1, newSeq);
  };

  const checkAnswer = (idx, currentSeq) => {
    if (currentSeq[idx] === gameSeq[idx]) {
      if (currentSeq.length === gameSeq.length) {
        setTimeout(() => {
          levelUp(gameSeq);
        }, 1000);
      }
    } else {
      // Game Over
      setGameOverFlash(true);
      setStatusMsg(`Game Over! Score: ${level}. Press Start to play again.`);
      setStarted(false);
      setGameSeq([]);
      setUserSeq([]);

      setTimeout(() => {
        setGameOverFlash(false);
      }, 400);
    }
  };

  return (
    <div className={`p-6 sm:p-8 w-full flex flex-col items-center min-h-screen transition-colors duration-300 ${gameOverFlash ? "bg-red-500/20" : "bg-background"}`}>
      
      {/* Top Bar with Back Button */}
      <div className="w-full max-w-2xl flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-textSecondary hover:text-textPrimary bg-white border border-border px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer shadow-xs"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Back to Healing Space</span>
        </button>

        <span className="text-xs uppercase tracking-wider font-semibold text-primary bg-primaryLight px-3 py-1 rounded-full">
          Mindful Mini-Game
        </span>
      </div>

      {/* Main Game Container Card */}
      <div className="bg-white border border-border rounded-3xl p-6 sm:p-8 shadow-md w-full max-w-lg text-center flex flex-col items-center">
        
        <div className="flex items-center gap-2 mb-1 text-primary text-2xl">
          <FontAwesomeIcon icon={faGamepad} />
          <h1 className="text-2xl font-heading font-bold text-textPrimary">Simon Game</h1>
        </div>

        <h2 className="text-base sm:text-lg font-medium text-textSecondary mb-5 min-h-[1.75rem]">
          {statusMsg}
        </h2>

        {/* Start / Reset Button */}
        {!started && (
          <button
            onClick={startGame}
            className="mb-6 px-6 py-2.5 bg-primary text-white font-semibold rounded-xl shadow-md hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2 text-sm"
          >
            <FontAwesomeIcon icon={faRotateLeft} />
            <span>{level > 0 ? "Play Again" : "Start Game"}</span>
          </button>
        )}

        {/* Buttons Grid Container matching requested HTML structure & classes */}
        <div className="btn-container flex flex-col items-center gap-3 my-2">
          {/* Line One */}
          <div className="line-one flex justify-center gap-3 sm:gap-4">
            <div
              id="red"
              role="button"
              tabIndex={0}
              onClick={() => handleBtnClick("red")}
              className={`btn red flex items-center justify-center text-3xl font-extrabold text-white/90 select-none transition-all cursor-pointer shadow-md active:scale-95 ${
                flashBtn?.color === "red"
                  ? flashBtn.type === "flash"
                    ? "flash"
                    : "userFlash"
                  : ""
              }`}
            >
              1
            </div>
            <div
              id="yellow"
              role="button"
              tabIndex={0}
              onClick={() => handleBtnClick("yellow")}
              className={`btn yellow flex items-center justify-center text-3xl font-extrabold text-white/90 select-none transition-all cursor-pointer shadow-md active:scale-95 ${
                flashBtn?.color === "yellow"
                  ? flashBtn.type === "flash"
                    ? "flash"
                    : "userFlash"
                  : ""
              }`}
            >
              2
            </div>
          </div>

          {/* Line Two */}
          <div className="line-two flex justify-center gap-3 sm:gap-4">
            <div
              id="green"
              role="button"
              tabIndex={0}
              onClick={() => handleBtnClick("green")}
              className={`btn green flex items-center justify-center text-3xl font-extrabold text-white/90 select-none transition-all cursor-pointer shadow-md active:scale-95 ${
                flashBtn?.color === "green"
                  ? flashBtn.type === "flash"
                    ? "flash"
                    : "userFlash"
                  : ""
              }`}
            >
              3
            </div>
            <div
              id="purple"
              role="button"
              tabIndex={0}
              onClick={() => handleBtnClick("purple")}
              className={`btn purple flex items-center justify-center text-3xl font-extrabold text-white/90 select-none transition-all cursor-pointer shadow-md active:scale-95 ${
                flashBtn?.color === "purple"
                  ? flashBtn.type === "flash"
                    ? "flash"
                    : "userFlash"
                  : ""
              }`}
            >
              4
            </div>
          </div>
        </div>

      </div>

      {/* Embedded styles matching user's requested style3.css */}
      <style>{`
        .btn {
          height: 130px;
          width: 130px;
          border-radius: 20%;
          border: 8px solid black;
          margin: 0.5rem;
        }

        @media (min-width: 640px) {
          .btn {
            height: 160px;
            width: 160px;
            border: 10px solid black;
            margin: 0.75rem;
          }
        }

        .red {
          background-color: #d95980;
        }

        .yellow {
          background-color: #f99b45;
        }

        .green {
          background-color: #63aac0;
        }

        .purple {
          background-color: #819ff9;
        }

        .flash {
          background-color: #ffffff !important;
          box-shadow: 0 0 25px #ffffff !important;
          transform: scale(1.04);
        }

        .userFlash {
          background-color: #22c55e !important;
          box-shadow: 0 0 25px #22c55e !important;
          transform: scale(1.04);
        }
      `}</style>
    </div>
  );
}

export default SimonGame;
