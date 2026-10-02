import { useEffect } from "react";

const FEATURE_DATA = {
    support: {
        key: "support",
        icon: "🤖",
        title: "AI Emotional Support",
        tag: "24/7 Compassionate Companion",
        desc: "Talk through what's on your mind with MindEase's AI-powered emotional support. Express what you're feeling in a completely private, judgment-free space and receive thoughtful, supportive guidance.",
        previewType: "chat",
        userMsg: "I've been feeling overwhelmed with exams and workload lately...",
        aiMsg: "I hear you 💜 It's completely valid to feel stressed during busy times. Let me help you break down your thoughts so you can catch your breath.",
    },
    journal: {
        key: "journal",
        icon: "📖",
        title: "Reflective Journaling",
        tag: "Personal Sanctuary",
        desc: "Create a private space to reflect on your thoughts, emotions, and daily experiences with guided prompts, mood tagging, and gentle sentiment analysis.",
        previewType: "journal",
        date: "Today's Entry",
        mood: "Calm & Reflective 💜",
        text: "Took a 15-minute walk outside today. Focusing on my breath helped me slow down my racing thoughts before starting evening study...",
    },
    insights: {
        key: "insights",
        icon: "📊",
        title: "Wellness Insights",
        tag: "Emotional Analytics",
        desc: "Understand patterns in your emotions and mental wellbeing over time through clear, personalized visual insights and mood growth metrics.",
        previewType: "insights",
        stats: [
            { day: "Mon", level: 65, label: "Calm" },
            { day: "Tue", level: 80, label: "Peaceful" },
            { day: "Wed", level: 50, label: "Reflective" },
            { day: "Thu", level: 85, label: "Balanced" },
            { day: "Fri", level: 90, label: "Serene" }
        ],
        highlight: "7-Day Emotional Balance: 82% Positive Consistency"
    },
    safeplace: {
        key: "safeplace",
        icon: "🛡️",
        title: "Safe Place & Relief",
        tag: "Instant Anxiety Relief",
        desc: "A calming sanctuary with guided 4-7-8 breathing exercises, 5-4-3-2-1 grounding techniques, and trusted emergency contacts available whenever you need immediate comfort.",
        previewType: "safeplace",
        prompt: "Focus on your breath. Breathe in for 4 seconds, hold for 7, exhale for 8.",
        technique: "5-4-3-2-1 Sensory Grounding Technique"
    },
    healing: {
        key: "healing",
        icon: "🎧",
        title: "Healing Sessions",
        tag: "Calming Wellness Content",
        desc: "Take a pause with calming audio, guided breathing, grounding exercises, stories and reflective reading.",
        previewType: "healing",
        categories: [
            "🎧 Wellness Audio",
            "🌬 Guided Breathing",
            "🌿 Sensory Grounding",
            "📖 Life Stories",
            "📚 Reflective Reading"
        ],
        prompt: "A quiet space of supportive wellness resources to help you rest, reflect, and regain emotional balance at your own pace."
    }
};

function FeatureGlassPanel({
    isOpen,
    activeFeatureKey = "support",
    onClose,
    onSelectFeature,
    onTryDemo,
    onGetStarted
}) {
    // Handle Escape key to close panel
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const currentFeature = FEATURE_DATA[activeFeatureKey] || FEATURE_DATA.support;

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-purple-950/45 backdrop-blur-md transition-all animate-fadeIn"
            onClick={onClose}
        >
            {/* Glass Modal Card */}
            <div 
                className="
                    relative w-full max-w-2xl rounded-3xl p-6 sm:p-8
                    bg-white/90 border border-white/80
                    shadow-2xl shadow-purple-900/35
                    backdrop-blur-2xl text-[#230f3e]
                    overflow-hidden select-none
                    transition-all duration-300 transform scale-100
                "
                onClick={(e) => e.stopPropagation()}
            >
                {/* Background Ambient Glows */}
                <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-300/40 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />

                {/* Top Close Button */}
                <button
                    onClick={onClose}
                    className="
                        absolute top-5 right-5 w-9 h-9 rounded-full
                        bg-purple-100/80 border border-purple-200
                        text-purple-900 hover:bg-purple-200/90
                        flex items-center justify-center font-bold text-base
                        transition-colors cursor-pointer z-20
                    "
                    aria-label="Close feature preview"
                >
                    ✕
                </button>

                {/* Feature Selector Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-6 border-b border-purple-200/60 custom-scrollbar relative z-10">
                    {Object.values(FEATURE_DATA).map((feat) => {
                        const isActive = feat.key === currentFeature.key;
                        return (
                            <button
                                key={feat.key}
                                onClick={() => onSelectFeature(feat.key)}
                                className={`
                                    flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer
                                    ${isActive
                                        ? "bg-purple-700 text-white shadow-md shadow-purple-300/60"
                                        : "bg-purple-100/60 text-purple-950 hover:bg-purple-200/70 border border-purple-200/50"
                                    }
                                `}
                            >
                                <span>{feat.icon}</span>
                                <span>{feat.title}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Active Feature Details */}
                <div className="relative z-10">
                    
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl sm:text-4xl p-2.5 rounded-2xl bg-purple-100/80 border border-purple-200">
                                {currentFeature.icon}
                            </span>
                            <div>
                                <h3 className="text-2xl sm:text-3xl font-heading font-bold text-[#230f3e]">
                                    {currentFeature.title}
                                </h3>
                                <span className="text-xs font-semibold text-purple-800 px-2.5 py-0.5 rounded-full bg-purple-100 border border-purple-200 inline-block mt-1">
                                    {currentFeature.tag}
                                </span>
                            </div>
                        </div>
                    </div>

                    <p className="text-purple-950/80 text-sm sm:text-base leading-relaxed my-4">
                        {currentFeature.desc}
                    </p>

                    {/* Glass Interactive Feature Preview Container */}
                    <div className="my-5 p-5 rounded-2xl bg-white/60 border border-purple-200/80 backdrop-blur-md shadow-sm">
                        
                        {/* Chat Preview */}
                        {currentFeature.previewType === "chat" && (
                            <div className="space-y-3 text-xs sm:text-sm">
                                <div className="flex justify-end">
                                    <div className="bg-purple-700 text-white py-2.5 px-4 rounded-2xl rounded-tr-xs max-w-[85%] shadow-xs">
                                        {currentFeature.userMsg}
                                    </div>
                                </div>
                                <div className="flex justify-start items-start gap-2">
                                    <span className="text-lg">💜</span>
                                    <div className="bg-purple-100/90 text-purple-950 py-2.5 px-4 rounded-2xl rounded-tl-xs max-w-[85%] border border-purple-200/70">
                                        {currentFeature.aiMsg}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-purple-600 text-xs pl-7 pt-1 font-medium">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                                    <span>MindEase AI is listening...</span>
                                </div>
                            </div>
                        )}

                        {/* Journal Preview */}
                        {currentFeature.previewType === "journal" && (
                            <div className="space-y-2 text-xs sm:text-sm">
                                <div className="flex justify-between items-center text-xs font-bold text-purple-800 border-b border-purple-200/60 pb-2">
                                    <span>{currentFeature.date}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-purple-200/70">{currentFeature.mood}</span>
                                </div>
                                <p className="text-purple-950/90 italic font-serif leading-relaxed pt-1">
                                    "{currentFeature.text}"
                                </p>
                            </div>
                        )}

                        {/* Insights Preview */}
                        {currentFeature.previewType === "insights" && (
                            <div className="space-y-3">
                                <div className="flex items-end justify-between h-20 px-4 pt-2">
                                    {currentFeature.stats.map((st, idx) => (
                                        <div key={idx} className="flex flex-col items-center gap-1.5 flex-1">
                                            <div 
                                                className="w-7 rounded-t-lg bg-gradient-to-t from-purple-700 to-indigo-500 shadow-xs transition-all duration-500" 
                                                style={{ height: `${st.level * 0.6}px` }}
                                            />
                                            <span className="text-[11px] font-bold text-purple-900">{st.day}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-center text-xs font-bold text-purple-800 pt-2 border-t border-purple-200/60">
                                    ✨ {currentFeature.highlight}
                                </div>
                            </div>
                        )}

                        {/* Safe Place Preview */}
                        {currentFeature.previewType === "safeplace" && (
                            <div className="text-center space-y-3 py-1">
                                <div className="w-14 h-14 mx-auto rounded-full bg-purple-200/80 border-2 border-purple-400/80 flex items-center justify-center text-2xl animate-pulse">
                                    🌬️
                                </div>
                                <p className="text-xs sm:text-sm font-semibold text-purple-950">
                                    {currentFeature.prompt}
                                </p>
                                <span className="inline-block text-[11px] font-bold text-purple-800 px-3 py-1 rounded-full bg-purple-100 border border-purple-200">
                                    {currentFeature.technique}
                                </span>
                            </div>
                        )}

                        {/* Healing Sessions Preview */}
                        {currentFeature.previewType === "healing" && (
                            <div className="space-y-3 py-2 text-center">
                                <div className="flex flex-wrap gap-2 justify-center py-1">
                                    {currentFeature.categories.map((cat, idx) => (
                                        <span key={idx} className="text-xs font-semibold text-purple-900 bg-purple-100/90 border border-purple-200 px-3 py-1 rounded-full shadow-xs">
                                            {cat}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-xs sm:text-sm text-purple-950/80 font-medium italic pt-1 max-w-md mx-auto leading-relaxed">
                                    "{currentFeature.prompt}"
                                </p>
                            </div>
                        )}

                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                            onClick={onTryDemo}
                            className="
                                flex-1 bg-white hover:bg-purple-50
                                text-purple-950 font-bold text-sm
                                py-3 px-5 rounded-2xl
                                border border-purple-300
                                shadow-xs transition-all
                                hover:scale-[1.02] cursor-pointer text-center
                            "
                        >
                            Try Interactive Demo
                        </button>

                        <button
                            onClick={onGetStarted}
                            className="
                                flex-1 bg-glowing-purple-btn
                                text-white font-bold text-sm
                                py-3 px-5 rounded-2xl
                                transition-all cursor-pointer text-center
                            "
                        >
                            Get Started
                        </button>
                    </div>

                </div>

            </div>
        </div>
    );
}

export default FeatureGlassPanel;
