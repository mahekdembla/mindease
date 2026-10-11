import { useEffect, useState } from "react";
import { useLocation, useNavigate, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing/Landing.jsx";
import Navbar from "./components/layout/Navbar.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import AISupport from "./pages/Support/AISupport.jsx";
import Journal from "./pages/Journal/Journal";
import Insights from "./pages/Insights/Insights";
import Settings from "./pages/Settings/Settings";
import SafePlace from "./pages/SafePlace/SafePlace";
import HealingSpace from "./pages/Healing/HealingSpace";
import Login from "./pages/Auth/Login";
import Signup from "./pages/Auth/Signup";

import { getCurrentUser } from "./services/api";

function App() {
    const location = useLocation();
    const navigate = useNavigate();

    const [user, setUser] = useState(() => {
        try {
            const cached = localStorage.getItem("currentUser");
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            return null;
        }
    });

    const [authChecked, setAuthChecked] = useState(false);
    const [demoLocked, setDemoLocked] = useState(false);
    const [showDemoPopup, setShowDemoPopup] = useState(false);

    const isLanding =
        location.pathname === "/" ||
        location.pathname === "/login" ||
        location.pathname === "/signup";

    // =========================
    // OAUTH & AUTHENTICATION CHECK
    // =========================

    useEffect(() => {
        const verifyAuth = async () => {
            // Parse token from URL if returned from Google/GitHub OAuth callback
            const queryParams = new URLSearchParams(window.location.search);
            const tokenFromUrl = queryParams.get("token");

            if (tokenFromUrl) {
                localStorage.setItem("mindease_token", tokenFromUrl);
                // Clean token query from address bar
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            try {
                const currentUser = await getCurrentUser();
                if (currentUser) {
                    setUser(currentUser);
                    localStorage.setItem("currentUser", JSON.stringify(currentUser));
                    
                    // CRITICAL FIX: Authenticated user clears demo state completely
                    localStorage.removeItem("demoStartedAt");
                    localStorage.removeItem("demoLocked");
                    setDemoLocked(false);
                    setShowDemoPopup(false);

                    if (location.pathname === "/login" || location.pathname === "/signup") {
                        const targetPath = location.state?.from || "/dashboard";
                        navigate(targetPath, { replace: true });
                    }
                } else {
                    setUser(null);
                    localStorage.removeItem("currentUser");

                    const isDemoActive = !!localStorage.getItem("demoStartedAt") && localStorage.getItem("demoLocked") !== "true";

                    const protectedRoutes = ["/dashboard", "/support", "/journal", "/insights", "/healing", "/healing-space", "/settings", "/safeplace"];
                    if (protectedRoutes.includes(location.pathname) && !isDemoActive) {
                        navigate("/login", { state: { from: location.pathname } });
                    }
                }
            } catch (err) {
                setUser(null);
            } finally {
                setAuthChecked(true);
            }
        };

        verifyAuth();
    }, [location.pathname]);

    // =========================
    // 3 MINUTE DEMO TIMER (UNAUTHENTICATED ONLY)
    // =========================

    useEffect(() => {
        // Authenticated users never trigger demo locks or popups
        const hasToken = !!localStorage.getItem("mindease_token");
        if (user || hasToken) {
            setDemoLocked(false);
            setShowDemoPopup(false);
            localStorage.removeItem("demoStartedAt");
            localStorage.removeItem("demoLocked");
            return;
        }

        const demoStartedAt = localStorage.getItem("demoStartedAt");
        if (!demoStartedAt) {
            setDemoLocked(false);
            setShowDemoPopup(false);
            localStorage.removeItem("demoLocked");
            return;
        }

        if (localStorage.getItem("demoLocked") === "true") {
            setDemoLocked(true);
            if (!isLanding) {
                setShowDemoPopup(true);
            }
            return;
        }

        const DEMO_DURATION = 3 * 60 * 1000;

        const checkDemoTime = () => {
            const startedAt = Number(localStorage.getItem("demoStartedAt"));
            if (!startedAt) return;

            const elapsed = Date.now() - startedAt;
            if (elapsed >= DEMO_DURATION) {
                localStorage.setItem("demoLocked", "true");
                setDemoLocked(true);
                if (!isLanding) {
                    setShowDemoPopup(true);
                }
            }
        };

        checkDemoTime();
        const timer = setInterval(checkDemoTime, 1000);
        return () => clearInterval(timer);
    }, [location.pathname, isLanding, user]);

    const handleDemoLogin = () => {
        setShowDemoPopup(false);
        setDemoLocked(false);
        localStorage.removeItem("demoStartedAt");
        localStorage.removeItem("demoLocked");
        navigate("/login");
    };

    const handleDemoSignup = () => {
        setShowDemoPopup(false);
        setDemoLocked(false);
        localStorage.removeItem("demoStartedAt");
        localStorage.removeItem("demoLocked");
        navigate("/signup");
    };

    return (
        <div className="min-h-screen bg-background overflow-x-hidden flex flex-col">

            {/* Top Navigation Bar */}
            {!isLanding && <Navbar user={user} onLogout={() => setUser(null)} />}

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 w-full overflow-x-hidden">
                <Routes>

                    <Route
                        path="/"
                        element={<Landing user={user} />}
                    />

                    <Route
                        path="/dashboard"
                        element={<Dashboard />}
                    />

                    <Route
                        path="/support"
                        element={<AISupport />}
                    />

                    <Route
                        path="/journal"
                        element={<Journal />}
                    />

                    <Route
                        path="/insights"
                        element={<Insights />}
                    />

                    <Route
                        path="/healing"
                        element={<HealingSpace />}
                    />

                    <Route
                        path="/healing-space"
                        element={<HealingSpace />}
                    />

                    <Route
                        path="/settings"
                        element={<Settings />}
                    />

                    <Route
                        path="/safeplace"
                        element={<SafePlace />}
                    />

                    <Route
                        path="/safe-place"
                        element={<SafePlace />}
                    />

                    <Route
                        path="/login"
                        element={<Login />}
                    />

                    <Route
                        path="/signup"
                        element={<Signup />}
                    />

                </Routes>
            </main>

            {/* =========================
                DEMO EXPIRED POPUP (GUESTS ONLY)
            ========================= */}

            {showDemoPopup && !user && !localStorage.getItem("mindease_token") && (
                <div
                    className="
                        fixed inset-0 z-[999]
                        bg-black/50
                        backdrop-blur-sm
                        flex items-center
                        justify-center
                        p-4
                    "
                >

                    <div
                        className="
                            bg-white
                            w-full max-w-md
                            rounded-3xl
                            p-8
                            shadow-2xl
                            text-center
                        "
                    >

                        {/* Icon */}
                        <div
                            className="
                                w-16 h-16
                                mx-auto mb-5
                                rounded-full
                                bg-primaryLight
                                flex items-center
                                justify-center
                                text-3xl
                            "
                        >
                            💜
                        </div>

                        {/* Heading */}
                        <h2
                            className="
                                text-2xl
                                font-heading
                                font-semibold
                                text-textPrimary
                                mb-3
                            "
                        >
                            Your demo has ended
                        </h2>

                        {/* Message */}
                        <p
                            className="
                                text-textSecondary
                                leading-relaxed
                                mb-6
                            "
                        >
                            We hope you enjoyed exploring MindEase! Create an account or log in to continue using your personalized mental wellness space.
                        </p>

                        {/* Buttons */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleDemoLogin}
                                className="
                                    w-full
                                    bg-primary
                                    text-white
                                    py-3
                                    rounded-xl
                                    font-medium
                                    transition-all
                                    duration-200
                                    hover:bg-primary/90
                                    hover:scale-[1.02]
                                    hover:shadow-lg
                                "
                            >
                                Log In
                            </button>

                            <button
                                onClick={handleDemoSignup}
                                className="
                                    w-full
                                    border
                                    border-primary
                                    text-primary
                                    py-3
                                    rounded-xl
                                    font-medium
                                    transition-all
                                    duration-200
                                    hover:bg-primaryLight
                                    hover:scale-[1.02]
                                "
                            >
                                Create Account
                            </button>
                        </div>

                    </div>

                </div>
            )}

        </div>
    );
}

export default App;