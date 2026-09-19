import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faHouse,
    faCommentDots,
    faBook,
    faChartLine,
    faShieldHeart,
    faGear,
    faRightFromBracket,
    faCircleExclamation,
    faUser,
} from "@fortawesome/free-solid-svg-icons";

import CrisisModal from "../common/CrisisModal";
import { logoutUser, getCurrentUser } from "../../services/api";

function Navbar({ onLogout }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [openCrisis, setOpenCrisis] = useState(false);
    const [userName, setUserName] = useState("User");

    useEffect(() => {
        const fetchUser = async () => {
            const user = await getCurrentUser();
            if (user && user.name) {
                setUserName(user.name);
            }
        };
        fetchUser();
    }, []);

    const handleLogout = async () => {
        await logoutUser();
        if (onLogout) {
            onLogout();
        }
        navigate("/login");
    };

    const navItems = [
        { name: "Dashboard", icon: faHouse, path: "/dashboard" },
        { name: "AI Support", icon: faCommentDots, path: "/support" },
        { name: "Journal", icon: faBook, path: "/journal" },
        { name: "Insights", icon: faChartLine, path: "/insights" },
        { name: "Safe Place", icon: faShieldHeart, path: "/safeplace" },
        { name: "Settings", icon: faGear, path: "/settings" },
    ];

    return (
        <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur border-b border-border shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                
                {/* Brand Logo */}
                <Link to="/dashboard" className="flex items-center gap-2 font-heading font-bold text-xl text-textPrimary shrink-0">
                    <span className="text-primary text-2xl">💜</span>
                    <span>MindEase</span>
                </Link>

                {/* Primary Nav Links */}
                <nav className="hidden md:flex items-center gap-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                                    isActive
                                        ? "bg-primaryLight text-primary font-semibold shadow-xs"
                                        : "text-textSecondary hover:bg-primaryLight/60 hover:text-textPrimary"
                                }`}
                            >
                                <FontAwesomeIcon icon={item.icon} className="text-sm" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Actions: Crisis & Profile / Logout */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* Crisis Support Quick Action */}
                    <button
                        onClick={() => setOpenCrisis(true)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 transition-all cursor-pointer border border-red-200"
                    >
                        <FontAwesomeIcon icon={faCircleExclamation} className="text-red-500 animate-pulse" />
                        <span className="hidden sm:inline">Crisis Support</span>
                    </button>

                    {/* User Profile Badge & Logout */}
                    <div className="flex items-center gap-2 bg-gray-50 border border-border px-3 py-1.5 rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            <FontAwesomeIcon icon={faUser} />
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-textPrimary hidden lg:inline max-w-[100px] truncate">
                            {userName}
                        </span>
                        <button
                            onClick={handleLogout}
                            title="Logout"
                            className="text-textSecondary hover:text-red-600 p-1 rounded-lg transition-colors ml-1"
                        >
                            <FontAwesomeIcon icon={faRightFromBracket} className="text-sm" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Nav Scroll View */}
            <div className="md:hidden flex overflow-x-auto gap-2 px-4 py-2 border-t border-border/50 bg-gray-50/50">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                                isActive
                                    ? "bg-primary text-white"
                                    : "bg-white text-textSecondary border border-border"
                            }`}
                        >
                            <FontAwesomeIcon icon={item.icon} />
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </div>

            {/* Crisis Support Modal */}
            <CrisisModal isOpen={openCrisis} onClose={() => setOpenCrisis(false)} />
        </header>
    );
}

export default Navbar;
