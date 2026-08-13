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
} from "@fortawesome/free-solid-svg-icons";
import { Link, useLocation } from "react-router-dom";
import CrisisModal from "../common/CrisisModal";

function Sidebar() {
    const location = useLocation();
    const [openCrisis, setOpenCrisis] = useState(false);

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

            {/* Push Crisis Support to Bottom */}
            <div className="mt-auto p-4">

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