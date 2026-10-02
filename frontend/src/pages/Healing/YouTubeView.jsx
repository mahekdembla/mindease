import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faPlay,
  faClock,
  faUser,
  faUpRightFromSquare,
  faXmark,
  faVideo,
} from "@fortawesome/free-solid-svg-icons";

function YouTubeView({ onBack }) {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeVideo, setActiveVideo] = useState(null); // For modal embed playback

  const categories = [
    "Guided Meditation & Relaxation",
    "Breathing & Grounding",
    "Mental Health Talks",
    "Personal Growth",
    "Sleep & Calm",
    "Inspirational Talks",
    "Student Life & Stress",
  ];

  useEffect(() => {
    const fetchVideos = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("http://127.0.0.1:8000/api/content/youtube");
        if (res.ok) {
          const result = await res.json();
          setVideos(result.data || []);
        } else {
          setError("Could not load YouTube wellness videos.");
        }
      } catch (err) {
        console.error("Error fetching YouTube videos:", err);
        setError("Network error loading YouTube videos.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideos();
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

  // Group videos by category
  const groupedVideos = categories.reduce((acc, cat) => {
    const matched = videos.filter((v) => v.category === cat);
    if (matched.length > 0) {
      acc[cat] = matched;
    }
    return acc;
  }, {});

  // Add any remaining uncategorized videos to first category or general
  const uncategorized = videos.filter((v) => !categories.includes(v.category));
  if (uncategorized.length > 0) {
    groupedVideos["Guided Meditation & Relaxation"] = [
      ...(groupedVideos["Guided Meditation & Relaxation"] || []),
      ...uncategorized,
    ];
  }

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
          YouTube Wellness Videos 🎥
        </span>
      </div>

      {/* Main Header Title */}
      <div className="max-w-5xl mx-auto w-full mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FontAwesomeIcon icon={faPlay} className="text-3xl text-purple-600" />
          <h1 className="text-3xl font-heading font-bold text-textPrimary">
            YouTube Wellness & Mental Health Videos
          </h1>
        </div>
        <p className="text-textSecondary text-sm sm:text-base leading-relaxed">
          Curated video sessions, guided meditations, expert talks, and grounding exercises to support your mental well-being.
        </p>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="max-w-5xl mx-auto w-full py-12 text-center text-slate-500 text-sm">
          Loading wellness videos...
        </div>
      )}

      {error && (
        <div className="max-w-5xl mx-auto w-full p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-center text-sm mb-6">
          {error}
        </div>
      )}

      {/* Main Outlined Enclosing Box containing Scroll Line and Video Category Sections */}
      {!isLoading && videos.length > 0 && (
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

            {/* Video Categories List */}
            <div className="flex-1 space-y-8">
              {Object.entries(groupedVideos).map(([categoryName, categoryVideos]) => (
                <section key={categoryName} className="space-y-4">
                  {/* Category Title */}
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <FontAwesomeIcon icon={faVideo} className="text-purple-600 text-sm" />
                    <h2 className="text-lg font-bold text-textPrimary tracking-tight">
                      {categoryName}
                    </h2>
                  </div>

                  {/* Video Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categoryVideos.map((video) => (
                      <article
                        key={video.id}
                        className="bg-slate-50/70 border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                      >
                        {/* Thumbnail Container */}
                        <div className="relative aspect-video bg-slate-900 overflow-hidden group cursor-pointer" onClick={() => setActiveVideo(video)}>
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            onError={(e) => {
                              // Fallback to medium quality thumbnail or clean poster if hqdefault fails
                              if (!e.target.src.includes("mqdefault.jpg")) {
                                e.target.src = `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`;
                              }
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300 opacity-90 group-hover:opacity-100"
                            loading="lazy"
                          />

                          {/* Sketch / Drawing Badge */}
                          {video.is_sketch && (
                            <span className="absolute top-2 left-2 bg-purple-900/90 text-purple-100 text-[10px] font-bold px-2 py-0.5 rounded-md border border-purple-400/40 backdrop-blur-xs flex items-center gap-1 shadow-xs">
                              <span>✏️</span>
                              <span>Sketch Explanation</span>
                            </span>
                          )}
                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-all">
                            <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <FontAwesomeIcon icon={faPlay} className="ml-1 text-sm" />
                            </div>
                          </div>
                          {/* Duration Badge */}
                          {video.duration && (
                            <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs">
                              {video.duration}
                            </span>
                          )}

                        </div>

                        {/* Details Body */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            {/* Meta Channel */}
                            <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-1.5">
                              <span className="flex items-center gap-1 font-semibold text-purple-700">
                                <FontAwesomeIcon icon={faUser} className="text-[10px]" />
                                {video.creator}
                              </span>
                              <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">
                                {video.category.split(" ")[0]}
                              </span>
                            </div>

                            {/* Title */}
                            <h3 className="text-sm font-bold text-textPrimary mb-1.5 leading-snug line-clamp-2">
                              {video.title}
                            </h3>

                            {/* Description */}
                            <p className="text-slate-600 text-xs leading-relaxed mb-3 line-clamp-2">
                              {video.description}
                            </p>
                          </div>

                          {/* Watch Actions Row */}
                          <div className="pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2">
                            <button
                              onClick={() => setActiveVideo(video)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-100/80 hover:bg-purple-200/80 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                            >
                              <FontAwesomeIcon icon={faPlay} className="text-[10px]" />
                              <span>Watch Now</span>
                            </button>

                            <a
                              href={video.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-purple-700 transition-colors"
                            >
                              <span>YouTube</span>
                              <FontAwesomeIcon icon={faUpRightFromSquare} className="text-[9px]" />
                            </a>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* Embedded Video Modal Player */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl animate-subtle-float">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faPlay} className="text-purple-600 text-sm" />
                <h3 className="text-sm sm:text-base font-bold text-textPrimary truncate max-w-lg">
                  {activeVideo.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveVideo(null)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            {/* Video Iframe Embed */}
            <div className="relative aspect-video bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${activeVideo.id}?autoplay=1`}
                title={activeVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Modal Footer Info */}
            <div className="p-4 bg-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-purple-700">{activeVideo.creator}</p>
                <p className="text-xs text-slate-500">{activeVideo.description}</p>
              </div>
              <a
                href={activeVideo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-100 px-3.5 py-2 rounded-xl transition-all"
              >
                <span>Open on YouTube</span>
                <FontAwesomeIcon icon={faUpRightFromSquare} className="text-[10px]" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default YouTubeView;
