import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faGamepad,
  faBrain,
  faLeaf,
  faArrowRight,
  faCirclePlay,
} from "@fortawesome/free-solid-svg-icons";

import SimonGame from "./SimonGame";
import MemoryMatchGame from "./MemoryMatchGame";
import BubblePopGame from "./BubblePopGame";
import BreathingGame from "./BreathingGame";

function GamesHub({ onBackToHealing }) {
  const [selectedGame, setSelectedGame] = useState(null);

  const games = [
    {
      id: "simon",
      title: "Simon Game 🎯",
      badge: "Sequence & Memory",
      badgeColor: "bg-indigo-100 text-indigo-700 border-indigo-200",
      description: "Follow and repeat the growing sequence of colors and numbers to test your focus and pattern memory.",
      icon: faGamepad,
      iconBg: "bg-indigo-100 text-indigo-600",
    },
    {
      id: "memory",
      title: "Memory Match 🧠",
      badge: "Concentration",
      badgeColor: "bg-purple-100 text-purple-700 border-purple-200",
      description: "Flip cards and find matching emoji pairs. A simple memory and concentration game with customizable difficulty.",
      icon: faBrain,
      iconBg: "bg-purple-100 text-purple-600",
    },
    {
      id: "bubble",
      title: "Bubble Pop 🫧",
      badge: "Relax & Unwind",
      badgeColor: "bg-cyan-100 text-cyan-700 border-cyan-200",
      description: "Pop colorful floating bubbles as they drift on screen. A relaxing, low-pressure game focused on simple interaction.",
      icon: faCirclePlay,
      iconBg: "bg-cyan-100 text-cyan-600",
    },
    {
      id: "breathing",
      title: "Breathing Game 🌿",
      badge: "Calming Exercise",
      badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
      description: "Follow a gently expanding and shrinking circle to guide slow breathing. Designed as a calming, screen-based breathing exercise.",
      icon: faLeaf,
      iconBg: "bg-emerald-100 text-emerald-600",
    },
  ];

  if (selectedGame === "simon") {
    return <SimonGame onBack={() => setSelectedGame(null)} />;
  }
  if (selectedGame === "memory") {
    return <MemoryMatchGame onBack={() => setSelectedGame(null)} />;
  }
  if (selectedGame === "bubble") {
    return <BubblePopGame onBack={() => setSelectedGame(null)} />;
  }
  if (selectedGame === "breathing") {
    return <BreathingGame onBack={() => setSelectedGame(null)} />;
  }

  return (
    <div className="p-6 sm:p-8 w-full flex flex-col min-h-screen bg-background">
      
      {/* Top Header Bar */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between mb-8">
        <button
          onClick={onBackToHealing}
          className="flex items-center gap-2 text-textSecondary hover:text-textPrimary bg-white border border-border px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer shadow-xs"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Back to Healing Space</span>
        </button>

        <span className="text-xs uppercase tracking-wider font-semibold text-primary bg-primaryLight px-3.5 py-1.5 rounded-full border border-primary/20">
          Mindful Games Hub 🎮
        </span>
      </div>

      {/* Title */}
      <div className="max-w-5xl mx-auto w-full mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FontAwesomeIcon icon={faGamepad} className="text-3xl text-primary" />
          <h1 className="text-3xl font-heading font-semibold text-textPrimary">
            Mindful Games
          </h1>
        </div>
        <p className="text-textSecondary text-sm sm:text-base">
          Select a game below to train your memory, relieve stress, or practice guided breathing.
        </p>
      </div>

      {/* Games Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full">
        {games.map((g) => (
          <div
            key={g.id}
            onClick={() => setSelectedGame(g.id)}
            className="group bg-white border border-border rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${g.iconBg} flex items-center justify-center text-xl`}>
                  <FontAwesomeIcon icon={g.icon} />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${g.badgeColor}`}>
                  {g.badge}
                </span>
              </div>

              <h2 className="text-xl font-heading font-semibold text-textPrimary mb-2 group-hover:text-primary transition-colors">
                {g.title}
              </h2>

              <p className="text-sm text-textSecondary leading-relaxed mb-4">
                {g.description}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-primary">
              <span>Play Now</span>
              <FontAwesomeIcon icon={faArrowRight} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

export default GamesHub;
