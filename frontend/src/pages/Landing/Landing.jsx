import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import heroImg from "../../assets/hero.png";
import FeatureGlassPanel from "../../components/common/FeatureGlassPanel.jsx";



const MESSAGE_STATES = [
    {
        small: "TAKE A MOMENT",
        keyword: "BREATHE",
        supporting: "Your mind deserves a gentle pause.",
        glow: "rgba(126, 34, 206, 0.32)"
    },
    {
        small: "UNDERSTAND YOURSELF",
        keyword: "FEEL",
        supporting: "Every emotion has something meaningful to tell you.",
        glow: "rgba(147, 51, 234, 0.35)"
    },
    {
        small: "MAKE SPACE FOR YOU",
        keyword: "PAUSE",
        supporting: "Slow down. Take time to check in with yourself.",
        glow: "rgba(109, 40, 217, 0.3)"
    },
    {
        small: "YOU DON'T HAVE TO CARRY IT ALONE",
        keyword: "CONNECT",
        supporting: "Sometimes being heard is the very first step toward peace.",
        glow: "rgba(126, 34, 206, 0.35)"
    },
    {
        small: "YOUR MENTAL WELLBEING MATTERS",
        keyword: "GROW",
        supporting: "Small daily steps create lasting, compassionate change.",
        glow: "rgba(147, 51, 234, 0.38)"
    }
];

const PLATFORM_TOOLS = [
    {
        key: "support",
        icon: "🤖",
        title: "AI Emotional Support",
        desc: "Empathetic 24/7 conversational guidance tailored to help you process feelings in a safe, confidential space.",
        tag: "Always Listening",
        stagger: "0s"
    },
    {
        key: "journal",
        icon: "📖",
        title: "Reflective Journaling",
        desc: "Express your daily thoughts with guided prompts, mood tagging, and gentle emotional clarity.",
        tag: "Personal Sanctuary",
        stagger: "0.3s"
    },
    {
        key: "insights",
        icon: "📊",
        title: "Wellness Insights",
        desc: "Track your mood patterns over time and gain deep, meaningful understanding of your personal growth.",
        tag: "Emotional Clarity",
        stagger: "0.6s"
    },
    {
        key: "safeplace",
        icon: "🛡️",
        title: "Safe Place",
        desc: "Instant grounding exercises, calming breathing techniques, and quiet spaces for stress relief.",
        tag: "Instant Relief",
        stagger: "0.9s"
    },
    {
        key: "healing",
        icon: "🎧",
        title: "Healing Sessions",
        desc: "Calming resources for moments when you need to pause, breathe, reflect and reset.",
        tag: "Calming Content",
        stagger: "1.2s",
        categories: "Podcasts • Breathing • Grounding • Stories • Reading"
    }
];

const HOW_IT_WORKS_STEPS = [
    {
        step: "01",
        title: "Check In Daily",
        desc: "Capture how you feel in seconds with gentle mood tracking and private emotional check-ins."
    },
    {
        step: "02",
        title: "Talk or Reflect",
        desc: "Engage in compassionate AI support conversations or write guided journal reflections at your own pace."
    },
    {
        step: "03",
        title: "Discover Trends",
        desc: "Uncover real insights into what influences your stress, energy, and inner peace."
    },
    {
        step: "04",
        title: "Reset Anytime",
        desc: "Access instant breathing exercises, grounding tools, and calming resources whenever overwhelm arises."
    }
];

function Landing({ user }) {
    const navigate = useNavigate();
    const [currentStateIndex, setCurrentStateIndex] = useState(0);
    const [totalViewCount, setTotalViewCount] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const [activeStep, setActiveStep] = useState(0);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [scrollY, setScrollY] = useState(0);
    const [isUserScrolling, setIsUserScrolling] = useState(false);

    // Active Navbar Section Tracker
    const [activeNavSection, setActiveNavSection] = useState("home");

    // Glass Feature Panel state
    const [isGlassPanelOpen, setIsGlassPanelOpen] = useState(false);
    const [selectedFeatureKey, setSelectedFeatureKey] = useState("support");

    // Section Visibility Observer States (for bi-directional scroll transitions)
    const [visibleSections, setVisibleSections] = useState({
        about: false,
        features: false,
        howItWorks: false,
        support: false,
        getStarted: false
    });

    const timeoutRef = useRef(null);
    const scrollTimeoutRef = useRef(null);

    // Check reduced motion preference
    const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ==========================================
    // SCROLL PROGRESS CALCULATIONS & PARALLAX
    // ==========================================
    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            const currentY = window.scrollY;
            setScrollY(currentY);
            setIsUserScrolling(true);

            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const heroElement = document.getElementById("hero");
                    if (heroElement) {
                        const heroHeight = heroElement.offsetHeight || 800;
                        const progress = Math.min(1, Math.max(0, currentY / (heroHeight * 0.75)));
                        setScrollProgress(progress);

                        if (progress > 0 && progress < 1) {
                            const newIndex = Math.min(
                                MESSAGE_STATES.length - 1,
                                Math.floor(progress * MESSAGE_STATES.length)
                            );
                            if (newIndex !== currentStateIndex) {
                                setCurrentStateIndex(newIndex);
                            }
                        }
                    }
                    ticking = false;
                });
                ticking = true;
            }

            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            scrollTimeoutRef.current = setTimeout(() => {
                setIsUserScrolling(false);
            }, 1800);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => {
            window.removeEventListener("scroll", handleScroll);
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        };
    }, [currentStateIndex]);

    // ==========================================
    // INTERSECTION OBSERVER FOR NAVBAR & SCROLL REVEALS
    // ==========================================
    useEffect(() => {
        // Bi-directional section reveal observer
        const sectionObserverOptions = {
            root: null,
            rootMargin: "0px 0px -10% 0px",
            threshold: 0.15
        };

        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const targetId = entry.target.id;
                setVisibleSections((prev) => ({
                    ...prev,
                    [targetId]: entry.isIntersecting
                }));
            });
        }, sectionObserverOptions);

        const sectionIds = ["about", "features", "how-it-works", "support", "get-started"];
        sectionIds.forEach((id) => {
            const el = document.getElementById(id);
            if (el) sectionObserver.observe(el);
        });

        // Dynamic Navbar Active Section Tracker Observer
        const navSections = [
            { id: "hero", navId: "home" },
            { id: "about", navId: "about" },
            { id: "features", navId: "features" },
            { id: "how-it-works", navId: "how-it-works" },
            { id: "support", navId: "support" }
        ];

        const navObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const matched = navSections.find((s) => s.id === entry.target.id);
                        if (matched) {
                            setActiveNavSection(matched.navId);
                        }
                    }
                });
            },
            { root: null, rootMargin: "-30% 0px -40% 0px", threshold: 0.15 }
        );

        navSections.forEach((s) => {
            const el = document.getElementById(s.id);
            if (el) navObserver.observe(el);
        });

        return () => {
            sectionObserver.disconnect();
            navObserver.disconnect();
        };
    }, []);

    // ==========================================
    // AUTOMATIC TIMER (PAUSED WHEN SCROLLING)
    // ==========================================
    useEffect(() => {
        if (isUserScrolling) return;

        const interval = setInterval(() => {
            setIsAnimating(true);

            timeoutRef.current = setTimeout(() => {
                setCurrentStateIndex((prev) => (prev + 1) % MESSAGE_STATES.length);
                setTotalViewCount((prev) => prev + 1);
                setIsAnimating(false);
            }, 600);


        }, 3800);

        return () => {
            clearInterval(interval);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [isUserScrolling]);

    // ==========================================
    // DEMO NAVIGATION LOGIC (UNAUTHENTICATED)
    // ==========================================
    const handleTryDemo = () => {
        setIsGlassPanelOpen(false);
        const demoLocked = localStorage.getItem("demoLocked") === "true";
        if (demoLocked) {
            navigate("/dashboard");
            return;
        }
        localStorage.setItem("demoStartedAt", Date.now().toString());
        localStorage.removeItem("demoLocked");
        navigate("/dashboard");
    };

    const currentState = MESSAGE_STATES[currentStateIndex];

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: "smooth" });
        }
    };

    const handleOpenFeaturePanel = (featureKey) => {
        setSelectedFeatureKey(featureKey);
        setIsGlassPanelOpen(true);
    };

    return (
        <div className="min-h-screen flex flex-col lavender-canvas text-[#230f3e] relative overflow-hidden select-none">

            {/* Atmospheric Soft Purple Ambient Layers & Parallax Orbs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div
                    className="absolute -top-32 -left-32 w-[650px] h-[650px] bg-purple-300/35 rounded-full blur-[130px] animate-orb-1 transition-transform duration-500 ease-out"
                    style={{ transform: prefersReducedMotion ? "none" : `translateY(${scrollY * 0.15}px)` }}
                />
                <div
                    className="absolute top-1/4 -right-32 w-[700px] h-[700px] bg-indigo-200/40 rounded-full blur-[150px] animate-orb-2 transition-transform duration-500 ease-out"
                    style={{ transform: prefersReducedMotion ? "none" : `translateY(${scrollY * -0.1}px)` }}
                />
                <div
                    className="absolute bottom-10 left-1/3 w-[550px] h-[550px] bg-fuchsia-200/30 rounded-full blur-[140px] transition-transform duration-700 ease-out"
                    style={{ transform: prefersReducedMotion ? "none" : `translateY(${scrollY * 0.08}px)` }}
                />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/30 via-transparent to-[#f4edff]/80" />
            </div>

            {/* 1. TOP NAVIGATION BAR (WITH DYNAMIC ACTIVE SECTION UNDERLINE INDICATOR & PILL LOGIN) */}
            <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-4 md:px-12 py-3.5 backdrop-blur-md bg-white/60 border-b border-purple-200/60 shadow-xs transition-all">
                <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => scrollToSection("hero")}>
                    <span className="text-2xl filter drop-shadow-[0_2px_8px_rgba(147,51,234,0.3)]">💜</span>
                    <h1 className="text-xl font-heading font-bold tracking-tight text-[#230f3e]">
                        Mind<span className="text-purple-700 font-bold">Ease</span>
                    </h1>
                </div>

                {/* Navbar links with smooth sliding active underline indicator */}
                <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-purple-950/80">
                    {[
                        { id: "home", label: "Home", target: "hero" },
                        { id: "about", label: "About", target: "about" },
                        { id: "features", label: "Features", target: "features" },
                        { id: "how-it-works", label: "How It Works", target: "how-it-works" },
                        { id: "support", label: "Support", target: "support" }
                    ].map((item) => {
                        const isActive = activeNavSection === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => scrollToSection(item.target)}
                                className={`relative py-1 transition-colors cursor-pointer ${isActive ? "text-purple-700 font-bold" : "hover:text-purple-700"
                                    }`}
                            >
                                <span>{item.label}</span>
                                {isActive && (
                                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-700 rounded-full transition-all duration-300 animate-fadeIn" />
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="flex gap-2.5 items-center">
                    {/* Fixed Pill-shaped Login Button */}
                    <button
                        onClick={() => navigate("/login")}
                        className="
                            text-purple-900 text-sm font-semibold
                            px-5 py-2 rounded-full min-w-[95px]
                            border border-purple-300/80
                            bg-white/70 backdrop-blur-sm
                            flex items-center justify-center text-center
                            transition-all duration-300
                            hover:bg-purple-700 hover:text-white hover:border-purple-700
                            hover:shadow-md hover:shadow-purple-200/60 cursor-pointer
                        "
                    >
                        Log In
                    </button>

                    {/* Radial Glowing Get Started Button (Darker Corners, Lighter Center) */}
                    <button
                        onClick={() => navigate("/signup")}
                        className="
                            bg-glowing-purple-btn
                            text-white text-sm font-semibold
                            px-5 py-2 rounded-full
                            flex items-center justify-center text-center
                            cursor-pointer
                        "
                    >
                        Get Started
                    </button>
                </div>
            </header>

            {/* SECTION 1: EDITORIAL HERO (SCROLL-DRIVEN & INTERACTIVE) */}
            <main id="hero" className="relative z-10 flex-1 flex flex-col justify-center items-center px-4 md:px-8 pt-24 pb-16 min-h-[92vh]">

                <div className="w-full max-w-6xl mx-auto flex flex-col items-center justify-center text-center relative py-4 md:py-8">

                    {/* Small Editorial Serif Phrase */}
                    <div
                        className={`
                            text-purple-950/90 font-serif italic text-lg sm:text-2xl md:text-3xl tracking-wider uppercase font-light mb-1
                            transition-all duration-700 ease-out transform
                            ${isAnimating ? "opacity-0 -translate-y-6 scale-95" : "opacity-100 translate-y-0 scale-100"}
                        `}
                        style={{
                            transitionDelay: isAnimating ? "0ms" : "100ms",
                            transform: prefersReducedMotion ? "none" : `translateY(${scrollProgress * -30}px)`
                        }}
                    >
                        {currentState.small}
                    </div>

                    {/* Dominant Editorial Keyword & Human Visual Overlapping Composition */}
                    <div className="relative w-full flex flex-col items-center justify-center my-2 md:my-4">

                        {/* Large Sans-Serif Keyword */}
                        <h2
                            className={`
                                font-sans font-black tracking-tighter uppercase leading-none select-none text-transparent bg-clip-text
                                bg-gradient-to-br from-purple-950 via-purple-800 to-indigo-900
                                z-20 relative keyword-glow
                                transition-all duration-800 ease-out transform
                                ${isAnimating
                                    ? "opacity-0 scale-75 blur-sm translate-y-8"
                                    : "opacity-100 scale-100 blur-0 translate-y-0"
                                }
                            `}
                            style={{
                                fontSize: "clamp(4.2rem, 14.5vw, 12.8rem)",
                                filter: `drop-shadow(0 10px 30px ${currentState.glow})`,
                                transitionDelay: isAnimating ? "100ms" : "250ms",
                                letterSpacing: "-0.045em",
                                transform: prefersReducedMotion ? "none" : `scale(${1 - scrollProgress * 0.08}) translateY(${scrollProgress * -20}px)`
                            }}
                        >
                            {currentState.keyword}
                        </h2>

                        {/* Integrated Human Visual Element with Parallax Scale */}
                        <div 
                            className="relative -mt-10 sm:-mt-16 md:-mt-24 z-10 w-full max-w-sm sm:max-w-md md:max-w-lg flex justify-center items-center pointer-events-none transition-transform duration-500"
                            style={{ transform: prefersReducedMotion ? "none" : `scale(${1 + scrollProgress * 0.06}) translateY(${scrollProgress * 25}px)` }}
                        >
                            <div className="relative rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden p-1 bg-gradient-to-b from-purple-300/40 via-purple-200/20 to-transparent shadow-2xl shadow-purple-900/15 animate-subtle-float">
                                <img
                                    src={heroImg}
                                    alt="Peaceful reflection and emotional wellbeing"
                                    className="w-full h-48 sm:h-64 md:h-72 object-cover rounded-[2.3rem] md:rounded-[3.3rem] opacity-90 filter brightness-105 contrast-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#f6f0ff] via-purple-900/10 to-transparent rounded-[2.3rem] md:rounded-[3.3rem]" />
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_40%,_#f6f0ff_95%)]" />
                            </div>
                        </div>

                    </div>

                    {/* Supporting Comforting Sentence */}
                    <div
                        className={`
                            text-purple-950/80 font-sans text-base sm:text-lg md:text-xl font-medium tracking-normal max-w-xl mx-auto mt-4 md:mt-6 px-4
                            transition-all duration-700 ease-out transform
                            ${isAnimating ? "opacity-0 translate-y-6 scale-95" : "opacity-100 translate-y-0 scale-100"}
                        `}
                        style={{ transitionDelay: isAnimating ? "150ms" : "350ms" }}
                    >
                        {currentState.supporting}
                    </div>

                    {/* Animated Sequence State Dots */}
                    <div className="flex gap-2.5 mt-6 md:mt-8 items-center">
                        {MESSAGE_STATES.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    setIsAnimating(true);
                                    setTimeout(() => {
                                        setCurrentStateIndex(idx);
                                        setIsAnimating(false);
                                    }, 300);
                                }}
                                className={`
                                    h-1.5 rounded-full transition-all duration-500 cursor-pointer
                                    ${idx === currentStateIndex
                                        ? "w-8 bg-purple-700 shadow-[0_0_8px_rgba(147,51,234,0.6)]"
                                        : "w-1.5 bg-purple-300 hover:bg-purple-400"
                                    }
                                `}
                                aria-label={`Go to sequence ${idx + 1}`}
                            />
                        ))}
                    </div>

                </div>

                {/* Subtitle Action Buttons */}
                <div className="w-full max-w-2xl mx-auto text-center mt-4 flex flex-col items-center">
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-md px-4 mt-2">
                        <button
                            onClick={() => navigate("/signup")}
                            className="
                                w-full sm:w-auto
                                bg-glowing-purple-btn
                                text-white font-semibold text-base
                                px-8 py-3.5 rounded-2xl
                                flex items-center justify-center gap-2
                                cursor-pointer
                            "
                        >
                            <span>Get Started</span>
                            <span className="text-lg">→</span>
                        </button>

                        <button
                            onClick={handleTryDemo}
                            className="
                                w-full sm:w-auto
                                bg-white/80 text-purple-950 font-semibold text-base
                                px-7 py-3.5 rounded-2xl
                                border border-purple-300/90
                                backdrop-blur-md
                                shadow-sm
                                transition-all duration-300
                                hover:bg-white
                                hover:border-purple-400
                                hover:scale-105
                                hover:shadow-md
                                cursor-pointer
                            "
                        >
                            Try Interactive Demo
                        </button>
                    </div>
                </div>

            </main>

            {/* SECTION 2: UNDERSTAND YOURSELF (SCROLL-DRIVEN EDITORIAL STORY REVEAL) */}
            <section
                id="about"
                className={`
                    relative z-10 py-24 px-6 md:px-12 border-t border-purple-200/50
                    transition-all duration-1000 ease-out transform
                    ${visibleSections.about || prefersReducedMotion
                        ? "opacity-100 translate-y-0 scale-100"
                        : "opacity-0 translate-y-16 scale-95"
                    }
                `}
            >
                <div className="max-w-4xl mx-auto text-center">
                    <span className="text-xs uppercase tracking-widest text-purple-800 font-bold px-4 py-1.5 rounded-full bg-purple-100/90 border border-purple-300/60 inline-block mb-6">
                        Mindful Perspective
                    </span>
                    <h2 className="text-3xl sm:text-5xl md:text-6xl font-serif italic font-light text-[#230f3e] leading-tight mb-8">
                        "Your emotions are information, <br className="hidden sm:inline" /> not something you have to hide."
                    </h2>
                    <p className="text-purple-950/80 text-lg md:text-xl font-normal leading-relaxed max-w-2xl mx-auto">
                        MindEase provides a calm, judgment-free sanctuary to observe your thoughts, listen to your feelings, and cultivate emotional balance at your own speed.
                    </p>
                </div>
            </section>

            {/* SECTION 3: YOUR MIND, YOUR SPACE (INDEPENDENT FLOATING GLASS CARDS WITH ALIVE EFFECT) */}
            <section
                id="features"
                className={`
                    relative z-10 py-24 px-6 md:px-12 border-t border-purple-200/60
                    transition-all duration-1000 ease-out transform
                    ${visibleSections.features || prefersReducedMotion
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-20"
                    }
                `}
            >
                <div className="max-w-7xl mx-auto">

                    <div className="text-center mb-16">
                        <span className="text-xs uppercase tracking-widest text-purple-800 font-bold px-3.5 py-1.5 rounded-full bg-purple-100/90 border border-purple-300/60">
                            MindEase Sanctuary
                        </span>
                        <h3 className="text-3xl md:text-5xl font-heading font-bold text-[#230f3e] mt-4 tracking-tight">
                            Your Mind, Your Space
                        </h3>
                        <p className="text-purple-900/75 text-base max-w-xl mx-auto mt-3">
                            Tailored mental health tools built with privacy, empathy, and clarity. Click any feature card to view its glass preview.
                        </p>
                    </div>

                    {/* Independent Floating Glass Cards (Grid layout with ample spacing) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 sm:gap-7">
                        {PLATFORM_TOOLS.map((tool, idx) => (
                            <div
                                key={tool.key}
                                onClick={() => handleOpenFeaturePanel(tool.key)}
                                className={`
                                    glass-card-independent feature-card-alive
                                    p-6
                                    flex flex-col justify-between
                                    cursor-pointer group
                                    transition-all duration-700 ease-out transform
                                    ${visibleSections.features || prefersReducedMotion
                                        ? "opacity-100 translate-y-0"
                                        : "opacity-0 translate-y-12"
                                    }
                                `}
                                style={{
                                    transitionDelay: prefersReducedMotion ? "0ms" : `${idx * 120}ms`,
                                    animationDelay: prefersReducedMotion ? "0s" : tool.stagger
                                }}
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-5">
                                        <div className="text-3xl p-3 rounded-2xl bg-purple-100/80 border border-purple-200 group-hover:scale-110 transition-transform">
                                            {tool.icon}
                                        </div>
                                        <span className="text-[10px] font-bold text-purple-800 px-2.5 py-0.5 rounded-full bg-purple-100/90 border border-purple-200">
                                            {tool.tag}
                                        </span>
                                    </div>
                                    <h4 className="text-lg font-heading font-bold text-[#230f3e] mb-2 group-hover:text-purple-700 transition-colors">
                                        {tool.title}
                                    </h4>
                                    <p className="text-purple-950/75 text-xs leading-relaxed">
                                        {tool.desc}
                                    </p>
                                    {tool.categories && (
                                        <p className="text-[11px] font-medium text-purple-800/90 mt-2.5 pt-2 border-t border-purple-200/50">
                                            {tool.categories}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-5 pt-3 border-t border-purple-100 flex items-center text-purple-700 text-xs font-bold group-hover:text-purple-950 transition-colors">
                                    <span>Explore Glass Preview</span>
                                    <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </section>

            {/* SECTION 4: SUPPORT WHEN YOU NEED IT (HOW IT WORKS CONVERGING SLIDE EFFECT) */}
            <section
                id="how-it-works"
                className={`
                    relative z-10 py-24 px-6 md:px-12 border-t border-purple-200/50
                    transition-all duration-1000 ease-out transform
                    ${visibleSections.howItWorks || prefersReducedMotion
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-20"
                    }
                `}
            >
                <div className="max-w-6xl mx-auto">

                    <div className="text-center mb-16">
                        <span className="text-xs uppercase tracking-widest text-purple-800 font-bold px-3.5 py-1.5 rounded-full bg-purple-100/90 border border-purple-300/60">
                            Guided Workflow
                        </span>
                        <h3 className="text-3xl md:text-5xl font-heading font-bold text-[#230f3e] mt-4 tracking-tight">
                            Support When You Need It
                        </h3>
                        <p className="text-purple-900/75 text-base max-w-xl mx-auto mt-3">
                            Simple, compassionate steps designed to fit seamlessly into your daily life.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {HOW_IT_WORKS_STEPS.map((step, idx) => (
                            <div
                                key={idx}
                                onClick={() => setActiveStep(idx)}
                                className={`
                                    glass-card-independent p-7 transition-all duration-500 cursor-pointer border transform
                                    ${activeStep === idx
                                        ? "bg-white border-purple-400 shadow-lg shadow-purple-200/60 scale-[1.02]"
                                        : "bg-white/60 border-purple-200/60 hover:bg-white/80"
                                    }
                                    ${visibleSections.howItWorks || prefersReducedMotion
                                        ? "opacity-100 translate-x-0"
                                        : idx % 2 === 0 ? "opacity-0 -translate-x-12" : "opacity-0 translate-x-12"
                                    }
                                `}
                                style={{ transitionDelay: prefersReducedMotion ? "0ms" : `${idx * 150}ms` }}
                            >
                                <span className="text-2xl font-black text-purple-400 font-sans block mb-3">
                                    {step.step}
                                </span>
                                <h4 className="text-lg font-heading font-bold text-[#230f3e] mb-2">
                                    {step.title}
                                </h4>
                                <p className="text-purple-950/70 text-sm leading-relaxed">
                                    {step.desc}
                                </p>
                            </div>
                        ))}
                    </div>

                </div>
            </section>

            {/* SECTION 5: YOU ARE NOT ALONE (EDITORIAL BANNER) */}
            <section
                id="support"
                className={`
                    relative z-10 py-24 px-6 md:px-12 bg-gradient-to-b from-white/30 via-purple-100/40 to-transparent border-t border-purple-200/60
                    transition-all duration-1000 ease-out transform
                    ${visibleSections.support || prefersReducedMotion
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-16"
                    }
                `}
            >
                <div className="max-w-5xl mx-auto text-center">
                    <div className="flex flex-col items-center justify-center my-6">
                        <div className="text-xs uppercase tracking-widest text-purple-800 font-bold px-4 py-1.5 rounded-full bg-purple-100/90 border border-purple-300/60 mb-6">
                            Constant Companion
                        </div>
                        <h2 className="font-sans font-black tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-950 via-purple-800 to-indigo-900 text-5xl sm:text-7xl md:text-8xl leading-none">
                            YOU ARE NOT ALONE
                        </h2>
                    </div>

                    <p className="text-purple-950/85 text-lg sm:text-xl font-medium max-w-2xl mx-auto mt-6 leading-relaxed">
                        Mental wellness isn't a destination—it's a daily conversation with yourself. MindEase is always here, offering a quiet space whenever you need to reflect.
                    </p>
                </div>
            </section>

            {/* SECTION 6: FINAL CTA SECTION */}
            <section
                id="get-started"
                className={`
                    relative z-10 py-24 px-6 md:px-12 bg-white/60 border-t border-purple-200/60 backdrop-blur-md
                    transition-all duration-1000 ease-out transform
                    ${visibleSections.getStarted || prefersReducedMotion
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-16"
                    }
                `}
            >
                <div className="max-w-3xl mx-auto text-center">
                    <span className="text-2xl filter drop-shadow-[0_2px_8px_rgba(147,51,234,0.3)] block mb-4">💜</span>
                    <h3 className="text-3xl sm:text-5xl font-heading font-bold text-[#230f3e] tracking-tight mb-4">
                        Take the first step toward understanding yourself.
                    </h3>
                    <p className="text-purple-950/80 text-base sm:text-lg mb-8 max-w-xl mx-auto">
                        Start your journey to emotional balance today. No pressure, no judgment—just compassionate support when you need it most.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <button
                            onClick={() => navigate("/signup")}
                            className="
                                w-full sm:w-auto
                                bg-glowing-purple-btn
                                text-white font-semibold text-base
                                px-8 py-4 rounded-2xl
                                flex items-center justify-center gap-2
                                cursor-pointer
                            "
                        >
                            <span>Get Started Now</span>
                            <span className="text-lg">→</span>
                        </button>

                        <button
                            onClick={handleTryDemo}
                            className="
                                w-full sm:w-auto
                                bg-white text-purple-950 font-semibold text-base
                                px-8 py-4 rounded-2xl
                                border border-purple-300/90
                                shadow-sm
                                transition-all duration-300
                                hover:bg-purple-50
                                hover:border-purple-400
                                hover:scale-105
                                hover:shadow-md
                                cursor-pointer
                            "
                        >
                            Try Interactive Demo
                        </button>
                    </div>

                    <div className="mt-6 text-sm text-purple-900/70">
                        Already have an account?{" "}
                        <button
                            onClick={() => navigate("/login")}
                            className="text-purple-700 font-bold hover:underline cursor-pointer"
                        >
                            Log In
                        </button>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="relative z-10 border-t border-purple-200/60 py-8 px-6 text-center text-xs text-purple-900/60 backdrop-blur-md bg-white/40">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span>💜</span>
                        <span className="font-bold text-[#230f3e]">MindEase</span>
                        <span>— Compassionate Mental Wellness Companion</span>
                    </div>
                    <div>
                        © {new Date().getFullYear()} MindEase. All rights reserved.
                    </div>
                </div>
            </footer>

            {/* INTERACTIVE GLASSMORPHISM FEATURE PANEL */}
            <FeatureGlassPanel
                isOpen={isGlassPanelOpen}
                activeFeatureKey={selectedFeatureKey}
                onClose={() => setIsGlassPanelOpen(false)}
                onSelectFeature={(key) => setSelectedFeatureKey(key)}
                onTryDemo={handleTryDemo}
                onGetStarted={() => {
                    setIsGlassPanelOpen(false);
                    navigate("/signup");
                }}
            />

        </div>
    );
}

export default Landing;