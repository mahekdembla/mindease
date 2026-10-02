import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faCommentDots,
  faBook,
  faChartLine,
  faGear,
  faCircleExclamation,
  faRightFromBracket,
  faShieldHeart,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CrisisModal from "../common/CrisisModal";
import { logoutUser } from "../../services/api";

function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const [openCrisis, setOpenCrisis] = useState(false);

    const handleLogout = async () => {
        await logoutUser();
        navigate("/login");
    };

    const menuItems = [
        {
            name: "Dashboard",
            icon: faHouse,
            path: "/dashboard",
        },
        {
            name: "AI Support",
            icon: faCommentDots,
            path: "/support",
        },
        {
            name: "Journal",
            icon: faBook,
            path: "/journal",
        },
        {
            name: "Insights",
            icon: faChartLine,
            path: "/insights",
        },
        {
            name: "Healing Space",
            icon: faWandMagicSparkles,
            path: "/healing",
        },
        {
             name: "Safe Place",
             icon: faShieldHeart,
              path: "/safeplace",
        },
        {
            name: "Settings",
            icon: faGear,
            path: "/settings",
        },
    ];

    return (
        <aside className="fixed left-0 top-0 z-40 w-72 h-screen bg-white border-r border-border flex flex-col">

            {/* Top Section */}
            <div className="p-5">

                {/* Logo */}
                <div className="flex items-center gap-2 mb-8">
                    <div className="text-primary text-2xl">
                        💜
                    </div>

                    <h1 className="text-xl font-heading font-semibold text-textPrimary">
                        MindEase
                    </h1>
                </div>

                {/* Menu */}
                <nav className="flex flex-col gap-2">
                    {menuItems.map((item) => {
                        const isActive =
                            location.pathname === item.path;

                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                className={`
                                    flex items-center gap-3
                                    px-4 py-3 rounded-xl
                                    transition-all
                                    ${
                                        isActive
                                            ? "bg-primaryLight text-primary font-medium"
                                            : "text-textSecondary hover:bg-primaryLight hover:text-textPrimary"
                                    }
                                `}
                            >
                                <FontAwesomeIcon
                                    icon={item.icon}
                                />

                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Push Crisis Support & Logout to Bottom */}
            <div className="mt-auto p-4 space-y-2">

                {/* Crisis Support */}
                <div
                    onClick={() =>
                        setOpenCrisis(true)
                    }
                    className="
                        bg-red-100
                        text-red-600
                        p-3
                        rounded-xl
                        flex
                        items-center
                        gap-2
                        cursor-pointer
                        hover:bg-red-200
                        transition
                    "
                >
                    <FontAwesomeIcon
                        icon={faCircleExclamation}
                    />

                    Crisis Support
                </div>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className="
                        w-full
                        text-textSecondary
                        hover:text-red-600
                        hover:bg-red-50
                        p-3
                        rounded-xl
                        flex
                        items-center
                        gap-3
                        transition-all
                        font-medium
                    "
                >
                    <FontAwesomeIcon icon={faRightFromBracket} />
                    Logout
                </button>
            </div>

            {/* Crisis Modal */}
            <CrisisModal
                isOpen={openCrisis}
                onClose={() =>
                    setOpenCrisis(false)
                }
            />

        </aside>
    );
}

export default Sidebar;