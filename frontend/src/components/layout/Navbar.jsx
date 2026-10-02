import { useState, useEffect, useRef } from "react";
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
    faWandMagicSparkles,
    faChevronDown,
    faBars,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";

import CrisisModal from "../common/CrisisModal";
import { logoutUser, getCurrentUser } from "../../services/api";

function Navbar({ user: propUser, onLogout }) {
    const location = useLocation();
    const navigate = useNavigate();

    const [openCrisis, setOpenCrisis] = useState(false);
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const moreRef = useRef(null);
    const profileRef = useRef(null);

    const getInitialUserName = () => {
        if (propUser && (propUser.name || propUser.email)) {
            return propUser.name || propUser.email.split("@")[0];
        }
        try {
            const cached = localStorage.getItem("currentUser");
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && (parsed.name || parsed.email)) {
                    return parsed.name || parsed.email.split("@")[0];
                }
            }
            if (localStorage.getItem("demoStartedAt")) {
                return "Guest Demo";
            }
        } catch (e) {}
        return "User";
    };

    const [userName, setUserName] = useState(getInitialUserName);

    useEffect(() => {
        const fetchUser = async () => {
            const user = await getCurrentUser();
            if (user) {
                const displayName = user.name || user.email?.split("@")[0] || "User";
                setUserName(displayName);
                localStorage.setItem("currentUser", JSON.stringify(user));
            }
        };
        fetchUser();
    }, [location.pathname]);

    // Close dropdowns on outside click or location change
    useEffect(() => {
        setIsMoreOpen(false);
        setIsProfileOpen(false);
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (moreRef.current && !moreRef.current.contains(event.target)) {
                setIsMoreOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await logoutUser();
        localStorage.removeItem("currentUser");
        localStorage.removeItem("demoStartedAt");
        localStorage.removeItem("demoLocked");
        if (onLogout) {
            onLogout();
        }
        navigate("/login");
    };

    // Core 4 visible navigation items
    const primaryNavItems = [
        { name: "Dashboard", icon: faHouse, path: "/dashboard" },
        { name: "AI Support", icon: faCommentDots, path: "/support" },
        { name: "Journal", icon: faBook, path: "/journal" },
        { name: "Insights", icon: faChartLine, path: "/insights" },
    ];

    // Secondary navigation items inside dropdown
    const secondaryNavItems = [
        { name: "Healing Space", icon: faWandMagicSparkles, path: "/healing", desc: "Calming sessions & resources" },
        { name: "Safe Place", icon: faShieldHeart, path: "/safeplace", desc: "Grounding & instant relief" },
        { name: "Settings", icon: faGear, path: "/settings", desc: "Account & preferences" },
    ];

    const isSecondaryActive = secondaryNavItems.some(
        (item) => location.pathname === item.path || (item.path === "/healing" && location.pathname === "/healing-space")
    );

    return (
        <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-border shadow-2xs transition-all">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                
                {/* Brand Logo */}
                <Link 
                    to="/dashboard" 
                    className="flex items-center gap-2.5 font-heading font-bold text-xl text-textPrimary shrink-0 hover:opacity-90 transition-opacity"
                >
                    <span className="w-9 h-9 rounded-xl bg-purple-100/80 flex items-center justify-center text-primary text-xl border border-purple-200/50 shadow-2xs">
                        💜
                    </span>
                    <span className="tracking-tight text-purple-950">MindEase</span>
                </Link>

                {/* Desktop Primary Navigation Links */}
                <nav className="hidden md:flex items-center gap-1.5 bg-slate-50/80 p-1 rounded-2xl border border-slate-200/60">
                    {primaryNavItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                                    isActive
                                        ? "bg-white text-primary shadow-xs border border-purple-100"
                                        : "text-slate-600 hover:text-purple-900 hover:bg-white/60"
                                }`}
                            >
                                <FontAwesomeIcon icon={item.icon} className={`text-xs ${isActive ? "text-primary" : "text-slate-400"}`} />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}

                    {/* Secondary Navigation Dropdown */}
                    <div className="relative" ref={moreRef}>
                        <button
                            onClick={() => setIsMoreOpen((prev) => !prev)}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                                isSecondaryActive || isMoreOpen
                                    ? "bg-white text-primary shadow-xs border border-purple-100"
                                    : "text-slate-600 hover:text-purple-900 hover:bg-white/60"
                            }`}
                        >
                            <span>More</span>
                            <FontAwesomeIcon 
                                icon={faChevronDown} 
                                className={`text-[10px] transition-transform duration-200 ${isMoreOpen ? "rotate-180 text-primary" : "text-slate-400"}`} 
                            />
                        </button>

                        {/* Dropdown Menu */}
                        {isMoreOpen && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-subtle-float">
                                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                                    Wellness Spaces
                                </div>
                                {secondaryNavItems.map((item) => {
                                    const isActive = location.pathname === item.path || (item.path === "/healing" && location.pathname === "/healing-space");
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.path}
                                            className={`flex items-start gap-3 p-2 rounded-xl transition-all ${
                                                isActive
                                                    ? "bg-purple-50 text-primary font-semibold"
                                                    : "text-slate-700 hover:bg-slate-50 hover:text-purple-900"
                                            }`}
                                        >
                                            <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                                                isActive ? "bg-purple-100 text-primary" : "bg-slate-100 text-slate-500"
                                            }`}>
                                                <FontAwesomeIcon icon={item.icon} />
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold leading-snug">{item.name}</div>
                                                <div className="text-[10px] text-slate-400 font-normal">{item.desc}</div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </nav>

                {/* Right Side Actions: Crisis Support & User Profile */}
                <div className="flex items-center gap-2.5 shrink-0">
                    
                    {/* Crisis Support Action */}
                    <button
                        onClick={() => setOpenCrisis(true)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border border-red-200/80 shadow-2xs"
                    >
                        <FontAwesomeIcon icon={faCircleExclamation} className="text-red-500 animate-pulse text-xs" />
                        <span className="hidden sm:inline">Crisis Support</span>
                    </button>

                    {/* Compact Profile Badge Dropdown */}
                    <div className="relative" ref={profileRef}>
                        <button
                            onClick={() => setIsProfileOpen((prev) => !prev)}
                            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 p-1 pr-2.5 rounded-2xl transition-all cursor-pointer"
                        >
                            <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                                {userName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-slate-800 hidden sm:inline max-w-[100px] truncate">
                                {userName}
                            </span>
                            <FontAwesomeIcon 
                                icon={faChevronDown} 
                                className={`text-[10px] text-slate-400 hidden sm:inline transition-transform duration-200 ${isProfileOpen ? "rotate-180" : ""}`} 
                            />
                        </button>

                        {/* Profile Dropdown Menu */}
                        {isProfileOpen && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-subtle-float">
                                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Signed in as</p>
                                    <p className="text-xs font-bold text-slate-800 truncate">{userName}</p>
                                </div>

                                <Link
                                    to="/settings"
                                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-purple-900 transition-colors"
                                >
                                    <FontAwesomeIcon icon={faGear} className="text-slate-400" />
                                    <span>Settings</span>
                                </Link>

                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                    <FontAwesomeIcon icon={faRightFromBracket} />
                                    <span>Log Out</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Mobile Menu Toggle Button */}
                    <button
                        onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                        className="md:hidden w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer"
                        aria-label="Toggle navigation menu"
                    >
                        <FontAwesomeIcon icon={isMobileMenuOpen ? faXmark : faBars} className="text-sm" />
                    </button>
                </div>
            </div>

            {/* Mobile Dropdown Navigation Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden border-t border-slate-200/80 bg-white px-4 py-3 space-y-1 shadow-lg animate-subtle-float">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Main Menu</p>
                    {primaryNavItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    isActive
                                        ? "bg-purple-100 text-primary"
                                        : "text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                <FontAwesomeIcon icon={item.icon} className="text-sm" />
                                <span>{item.name}</span>
                            </Link>
                        );
                    })}

                    <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Wellness Spaces</p>
                        {secondaryNavItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                        isActive
                                            ? "bg-purple-100 text-primary"
                                            : "text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                    <FontAwesomeIcon icon={item.icon} className="text-sm" />
                                    <span>{item.name}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Crisis Support Modal */}
            <CrisisModal isOpen={openCrisis} onClose={() => setOpenCrisis(false)} />
        </header>
    );
}

export default Navbar;
