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
} from "@fortawesome/free-solid-svg-icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CrisisModal from "../common/CrisisModal";

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [openCrisis, setOpenCrisis] = useState(false);

  const menuItems = [
    { name: "Dashboard", icon: faHouse, path: "/dashboard" },
    { name: "AI Support", icon: faCommentDots, path: "/support" },
    { name: "Journal", icon: faBook, path: "/journal" },
    { name: "Insights", icon: faChartLine, path: "/insights" },
    { name: "Settings", icon: faGear, path: "/settings" },
  ];

  const handleLogout = () => {
    // Remove only the currently logged-in user
    // Registered users remain saved
    localStorage.removeItem("currentUser");

    // Return to landing page
    navigate("/");
  };

  return (
    <div className="w-64 min-h-screen flex flex-col bg-white border-r border-border">

      {/* 🔹 Top Section */}
      <div className="p-5">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="text-primary text-2xl">💜</div>

          <h1 className="text-xl font-heading font-semibold text-textPrimary">
            MindEase
          </h1>
        </div>

        {/* Menu */}
        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${
                    isActive
                      ? "bg-primaryLight text-primary font-medium"
                      : "text-textSecondary hover:bg-primaryLight hover:text-textPrimary"
                  }
                `}
              >
                <FontAwesomeIcon icon={item.icon} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 🔹 Push bottom */}
      <div className="flex-1" />

      {/* 🔻 Bottom Section */}
      <div className="p-4 flex flex-col gap-2">

        {/* Logout
        <button
          onClick={handleLogout}
          className="w-full p-3 rounded-xl flex items-center gap-3
                     text-textSecondary hover:bg-gray-100
                     hover:text-textPrimary transition"
        >
          <FontAwesomeIcon icon={faRightFromBracket} />
          Log Out
        </button> */}

        {/* Crisis Support */}
        <div
          onClick={() => setOpenCrisis(true)}
          className="bg-red-100 text-red-600 p-3 rounded-xl
                     flex items-center gap-2 cursor-pointer
                     hover:bg-red-200 transition"
        >
          <FontAwesomeIcon icon={faCircleExclamation} />
          Crisis Support
        </div>

      </div>

      {/* Crisis Modal */}
      <CrisisModal
        isOpen={openCrisis}
        onClose={() => setOpenCrisis(false)}
      />

    </div>
  );
}

export default Sidebar;