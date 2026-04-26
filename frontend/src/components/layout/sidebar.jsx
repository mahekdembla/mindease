import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faCommentDots,
  faBook,
  faChartLine,
  faGear,
  faCircleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { Link, useLocation } from "react-router-dom";

function Sidebar() {
  const location = useLocation();

  const menuItems = [
    { name: "Dashboard", icon: faHouse, path: "/dashboard" },
    { name: "AI Support", icon: faCommentDots, path: "/support" },
    { name: "Journal", icon: faBook, path: "/journal" },
    { name: "Insights", icon: faChartLine, path: "/insights" },
    { name: "Settings", icon: faGear, path: "/settings" },
  ];

  return (
    <div className="w-72 h-screen sticky top-0 bg-card border-r border-border flex flex-col">

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

      {/* 🔻 Bottom Section (FIXED) */}
      <div className="p-5">
        <div className="bg-red-100 text-red-600 p-3 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-red-200 transition">
          <FontAwesomeIcon icon={faCircleExclamation} />
          Crisis Support
        </div>
      </div>

    </div>
  );
}

export default Sidebar; 