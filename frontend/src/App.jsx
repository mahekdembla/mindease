import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing/Landing.jsx";
import Sidebar from "./components/layout/sidebar.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import AISupport from "./pages/Support/AISupport.jsx";
import Journal from "./pages/Journal/Journal";
import Insights from "./pages/Insights/Insights";
import Settings from "./pages/Settings/Settings";
import Login from "./pages/Auth/Login";
import Signup from "./pages/Auth/Signup";

function App() {
    const location = useLocation();
    const navigate = useNavigate();

    const [demoLocked, setDemoLocked] = useState(
        localStorage.getItem("demoLocked") === "true"
    );

    const [showDemoPopup, setShowDemoPopup] =
        useState(false);

    const isLanding =
        location.pathname === "/" ||
        location.pathname === "/login" ||
        location.pathname === "/signup";

    // =========================
    // DEMO TIMER
    // =========================

    useEffect(() => {
        const demoStartedAt =
            localStorage.getItem("demoStartedAt");

        const currentUser =
            localStorage.getItem("currentUser");

        // Logged-in users are not affected
        // by the demo timer.
        if (currentUser) {
            setDemoLocked(false);
            setShowDemoPopup(false);
            return;
        }

        // No demo session exists
        if (!demoStartedAt) {
            return;
        }

        // Demo is already locked
        if (
            localStorage.getItem("demoLocked") ===
            "true"
        ) {
            setDemoLocked(true);

            if (!isLanding) {
                setShowDemoPopup(true);
            }

            return;
        }

        // =========================
        // 3 MINUTE DEMO
        // =========================

        const DEMO_DURATION = 3 * 60 * 1000;

        const checkDemoTime = () => {
            const startedAt = Number(
                localStorage.getItem(
                    "demoStartedAt"
                )
            );

            if (!startedAt) {
                return;
            }

            const elapsed =
                Date.now() - startedAt;

            if (elapsed >= DEMO_DURATION) {
                localStorage.setItem(
                    "demoLocked",
                    "true"
                );

                setDemoLocked(true);

                if (!isLanding) {
                    setShowDemoPopup(true);
                }
            }
        };

        // Check immediately
        checkDemoTime();

        // Check every second
        const timer = setInterval(
            checkDemoTime,
            1000
        );

        return () => {
            clearInterval(timer);
        };

    }, [location.pathname, isLanding]);

    // =========================
    // SHOW POPUP
    // =========================

    useEffect(() => {
        const currentUser =
            localStorage.getItem("currentUser");

        if (
            demoLocked &&
            !currentUser &&
            !isLanding
        ) {
            setShowDemoPopup(true);
        }
    }, [
        demoLocked,
        isLanding,
        location.pathname,
    ]);

    // =========================
    // LOGIN
    // =========================

    const handleDemoLogin = () => {
        setShowDemoPopup(false);
        navigate("/login");
    };

    // =========================
    // SIGNUP
    // =========================

    const handleDemoSignup = () => {
        setShowDemoPopup(false);
        navigate("/signup");
    };

    return (
        <div className="min-h-screen overflow-x-hidden">

            {/* Sidebar */}
            {!isLanding && <Sidebar />}

            {/* Main Content */}
            <main
                className={
                    isLanding
                        ? "min-h-screen"
                        : "min-h-screen ml-72 min-w-0 overflow-x-hidden"
                }
            >
                <Routes>

                    <Route
                        path="/"
                        element={<Landing />}
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
                        path="/settings"
                        element={<Settings />}
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
                DEMO EXPIRED POPUP
            ========================= */}

            {showDemoPopup &&
                !localStorage.getItem(
                    "currentUser"
                ) && (
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
                                We hope you enjoyed
                                exploring MindEase!
                                Create an account or
                                log in to continue
                                using your personalized
                                mental wellness space.
                            </p>

                            {/* Buttons */}

                            <div
                                className="
                                    flex flex-col gap-3
                                "
                            >

                                {/* Login */}

                                <button
                                    onClick={
                                        handleDemoLogin
                                    }
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

                                {/* Create Account */}

                                <button
                                    onClick={
                                        handleDemoSignup
                                    }
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