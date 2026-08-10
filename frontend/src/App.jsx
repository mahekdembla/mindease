import { useLocation } from "react-router-dom";
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

    const isLanding =
        location.pathname === "/" ||
        location.pathname === "/login" ||
        location.pathname === "/signup";

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

        </div>
    );
}

export default App;