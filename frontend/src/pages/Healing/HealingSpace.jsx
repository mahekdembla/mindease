import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWandMagicSparkles,
  faBookOpen,
  faGamepad,
  faFileLines,
  faPlay,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import GamesHub from "./GamesHub";
import StoriesView from "./StoriesView";
import ArticlesView from "./ArticlesView";
import YouTubeView from "./YouTubeView";

function HealingSpace() {
  const [activeView, setActiveView] = useState(null);

  const cards = [
    {
      id: "stories",
      title: "Stories",
      description: "Timeless fables, folklore, and moral stories for reflection.",
      icon: faBookOpen,
    },
    {
      id: "games",
      title: "Games",
      description: "Breathing rhythm exercises, mini-games, and focus puzzles.",
      icon: faGamepad,
    },
    {
      id: "articles",
      title: "Articles",
      description: "Evidence-based articles, CBT insights, and self-care guides.",
      icon: faFileLines,
    },
    {
      id: "youtube",
      title: "YouTube Videos",
      description: "Guided meditations, relaxing soundscapes, and mental health talks.",
      icon: faPlay,
    },
  ];

  const handleCardClick = (id) => {
    if (id === "games") {
      setActiveView("games");
    } else if (id === "stories") {
      setActiveView("stories");
    } else if (id === "articles") {
      setActiveView("articles");
    } else if (id === "youtube") {
      setActiveView("youtube");
    }
  };

  if (activeView === "games") {
    return <GamesHub onBackToHealing={() => setActiveView(null)} />;
  }

  if (activeView === "stories") {
    return <StoriesView onBack={() => setActiveView(null)} />;
  }

  if (activeView === "articles") {
    return <ArticlesView onBack={() => setActiveView(null)} />;
  }

  if (activeView === "youtube") {
    return <YouTubeView onBack={() => setActiveView(null)} />;
  }

  return (
    <div className="p-6 sm:p-8 w-full flex flex-col min-h-screen bg-background relative overflow-y-auto">
      
      {/* Top Navigation Bar */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between mb-6">
        <span className="text-xs uppercase tracking-wider font-semibold text-purple-700 bg-purple-100 px-3.5 py-1.5 rounded-full border border-purple-200">
          Healing Space 🔮
        </span>
      </div>

      {/* Header */}
      <div className="max-w-5xl mx-auto w-full mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FontAwesomeIcon icon={faWandMagicSparkles} className="text-3xl text-purple-600" />
          <h1 className="text-3xl sm:text-4xl font-heading font-bold text-textPrimary">
            Healing Space
          </h1>
        </div>
        <p className="text-textSecondary text-sm sm:text-base leading-relaxed">
          Explore wellness activities, games, wisdom stories, and mental health videos.
        </p>
      </div>

      {/* Enclosed Centered White Box */}
      <div className="max-w-5xl mx-auto w-full bg-white border border-border rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className="group bg-slate-50/70 border border-slate-200/80 rounded-2xl p-6 shadow-2xs hover:shadow-xs hover:border-purple-300 hover:bg-white transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white flex items-center justify-center text-xl transition-colors">
                    <FontAwesomeIcon icon={card.icon} />
                  </div>
                  <FontAwesomeIcon
                    icon={faArrowRight}
                    className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all"
                  />
                </div>

                <h2 className="text-xl font-heading font-bold text-textPrimary mb-2 group-hover:text-purple-900 transition-colors">
                  {card.title}
                </h2>

                <p className="text-slate-600 text-sm leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default HealingSpace;
