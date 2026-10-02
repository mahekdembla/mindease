import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faFileLines,
  faLightbulb,
  faUpRightFromSquare,
  faClock,
  faUser,
} from "@fortawesome/free-solid-svg-icons";

function ArticlesView({ onBack }) {
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const fetchArticles = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("http://127.0.0.1:8000/api/content/articles");
        if (res.ok) {
          const result = await res.json();
          setArticles(result.data || []);
        } else {
          setError("Could not load health articles.");
        }
      } catch (err) {
        console.error("Error fetching articles:", err);
        setError("Network error loading health articles.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticles();
  }, []);

  // Scroll position listener for dynamic progress line & moving dot
  useEffect(() => {
    const handleScroll = () => {
      const winScroll = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const height = (document.documentElement.scrollHeight || document.body.scrollHeight || 1) - window.innerHeight;
      if (height > 0) {
        const pct = Math.min(100, Math.max(0, (winScroll / height) * 100));
        setScrollProgress(pct);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  const isValidSourceUrl = (url) => {
    if (!url || typeof url !== "string") return false;
    return url.startsWith("http://") || url.startsWith("https://");
  };

  return (
    <div className="p-6 sm:p-8 w-full flex flex-col min-h-screen bg-background relative">
      
      {/* Top Header Navigation */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-textSecondary hover:text-textPrimary bg-white border border-border px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer shadow-xs"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Back to Healing Space</span>
        </button>

        <span className="text-xs uppercase tracking-wider font-semibold text-purple-700 bg-purple-100 px-3.5 py-1.5 rounded-full border border-purple-200">
          Health & Psychology Articles 📑
        </span>
      </div>

      {/* Main Header Title */}
      <div className="max-w-5xl mx-auto w-full mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FontAwesomeIcon icon={faFileLines} className="text-3xl text-purple-600" />
          <h1 className="text-3xl font-heading font-bold text-textPrimary">
            Health & Psychology Articles
          </h1>
        </div>
        <p className="text-textSecondary text-sm sm:text-base leading-relaxed">
          Evidence-based articles, neuroscience research, and CBT therapy insights to help you understand your mind.
        </p>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="max-w-5xl mx-auto w-full py-12 text-center text-slate-500 text-sm">
          Loading health & psychology articles...
        </div>
      )}

      {error && (
        <div className="max-w-5xl mx-auto w-full p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-center text-sm mb-6">
          {error}
        </div>
      )}

      {/* Main Outlined Enclosing Box containing Scroll Line and Article Cards */}
      {!isLoading && articles.length > 0 && (
        <div className="max-w-5xl mx-auto w-full bg-white border border-border rounded-3xl p-5 sm:p-7 shadow-xs">
          <div className="relative flex gap-5 sm:gap-6">
            
            {/* Thin Scroll Line & Perfectly Centered Purple Circle Dot */}
            <div className="relative w-4 flex flex-col items-center shrink-0 py-1">
              {/* Active Growing Thin Line (Centered) */}
              <div
                style={{ height: `${scrollProgress}%` }}
                className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 bg-purple-600 transition-all duration-75 ease-out"
              />

              {/* Moving Purple Circle Dot (Centered Horizontally on Line) */}
              <div
                style={{ top: `${scrollProgress}%` }}
                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-purple-600 border-2 border-white shadow-xs transition-all duration-75 ease-out"
              />
            </div>

            {/* Compact Article Cards List */}
            <div className="flex-1 space-y-4">
              {articles.map((article) => (
                <article
                  key={article.id || article.title}
                  className="bg-slate-50/60 border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Meta Header Row with Source & Mood Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium mb-2.5">
                      <div className="flex items-center gap-3">
                        {article.source_name && (
                          <span className="bg-purple-100/80 text-purple-800 px-2.5 py-0.5 rounded-md font-semibold border border-purple-200/60">
                            {article.source_name}
                          </span>
                        )}
                        {article.author && (
                          <span className="flex items-center gap-1">
                            <FontAwesomeIcon icon={faUser} className="text-slate-400 text-[11px]" />
                            {article.author}
                          </span>
                        )}
                        {article.read_time && (
                          <span className="flex items-center gap-1">
                            <FontAwesomeIcon icon={faClock} className="text-slate-400 text-[11px]" />
                            {article.read_time}
                          </span>
                        )}
                      </div>

                      {/* Mood Tag Pill inside Card */}
                      {article.mood && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200 shadow-2xs">
                          <span>{article.mood_icon || "🌿"}</span>
                          <span>{article.mood}</span>
                        </span>
                      )}
                    </div>

                    {/* Compact Title */}
                    <h2 className="text-lg sm:text-xl font-bold text-textPrimary mb-2 leading-snug">
                      {article.title}
                    </h2>

                    {/* Article Summary Body */}
                    <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4">
                      {article.summary}
                    </p>

                    {/* Compact What Science/Research Shows Box */}
                    {article.takeaway && (
                      <div className="bg-purple-50/80 border border-purple-200/70 rounded-xl p-3 sm:p-3.5 mb-3 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs shrink-0 shadow-xs">
                          <FontAwesomeIcon icon={faLightbulb} />
                        </div>
                        <div>
                          <h3 className="text-[11px] uppercase tracking-wider font-extrabold text-purple-900 mb-0.5">
                            Key Psychological Insight
                          </h3>
                          <p className="text-xs font-medium text-slate-700 leading-relaxed">
                            {article.takeaway}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Clean Attribution Footer Link */}
                  {isValidSourceUrl(article.original_url) && (
                    <div className="pt-3 border-t border-slate-200/60 flex items-center justify-end text-xs">
                      <a
                        href={article.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-purple-700 hover:text-purple-900 font-semibold hover:underline cursor-pointer"
                      >
                        <span>Read full article on {article.source_name || "Source"}</span>
                        <FontAwesomeIcon icon={faUpRightFromSquare} className="text-[10px]" />
                      </a>
                    </div>
                  )}
                </article>
              ))}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default ArticlesView;
