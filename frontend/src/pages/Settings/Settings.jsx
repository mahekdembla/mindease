import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faFloppyDisk,
    faUserPlus,
    faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";

function Settings() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    const [saveChat, setSaveChat] = useState(true);
    const [saveJournal, setSaveJournal] = useState(true);
    const [aiSafety, setAiSafety] = useState(
       localStorage.getItem("aiSafety") !== "false"
      );

    const [autoSos, setAutoSos] = useState(
        localStorage.getItem("autoSos") === "true"
      );

    const [darkMode, setDarkMode] = useState(
        localStorage.getItem("theme") === "dark"
    );

    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // =========================
    // LOAD CURRENT USER
    // =========================

    useEffect(() => {
        const currentUser = JSON.parse(
            localStorage.getItem("currentUser")
        );

        if (currentUser) {
            setIsLoggedIn(true);
            setName(currentUser.name || "");
            setEmail(currentUser.email || "");
        } else {
            setIsLoggedIn(false);
            setName("");
            setEmail("");
        }
    }, []);

    // =========================
    // SAVE PROFILE
    // =========================

    const handleSave = () => {
        const currentUser = JSON.parse(
            localStorage.getItem("currentUser")
        );

        if (!currentUser) {
            alert("Please create an account or log in first.");
            return;
        }

        const users =
            JSON.parse(
                localStorage.getItem("users")
            ) || [];

        const updatedUsers = users.map(
            (user) => {
                if (
                    user.email.toLowerCase() ===
                    currentUser.email.toLowerCase()
                ) {
                    return {
                        ...user,
                        name: name,
                        email: email,
                    };
                }

                return user;
            }
        );

        // Save updated users
        localStorage.setItem(
            "users",
            JSON.stringify(updatedUsers)
        );

        // Update current user
        const updatedCurrentUser = {
            ...currentUser,
            name: name,
            email: email,
        };

        localStorage.setItem(
            "currentUser",
            JSON.stringify(
                updatedCurrentUser
            )
        );

        alert("Profile updated");
    };

    // =========================
    // RESET APP
    // =========================

    const resetApp = () => {
        const confirmed = window.confirm(
            "Are you sure you want to reset all app data?"
        );

        if (!confirmed) return;

        localStorage.clear();

        alert("App data reset");

        window.location.href = "/";
    };

    // =========================
    // LOGOUT
    // =========================

    const logout = () => {
        localStorage.removeItem(
            "currentUser"
        );

        window.location.href = "/";
    };

    // =========================
    // CREATE ACCOUNT
    // =========================

    const createAccount = () => {
        window.location.href = "/signup";
    };

    return (
        <div className="w-full p-8">

            {/* Header */}

            <h1 className="text-3xl font-heading font-semibold text-textPrimary mb-2">
                Settings
            </h1>

            <p className="text-textSecondary mb-6">
                Manage your account preferences
            </p>

            <div className="space-y-6">

                {/* =========================
                    PROFILE
                ========================= */}

                <div className="bg-card p-6 rounded-2xl border">

                    <h2 className="font-semibold mb-4">
                        Profile Details
                    </h2>

                    <div className="space-y-4">

                        {/* Name */}

                        <div>
                            <label className="text-sm text-textSecondary">
                                Full Name
                            </label>

                            <input
                                value={name}
                                onChange={(e) =>
                                    setName(
                                        e.target.value
                                    )
                                }
                                disabled={!isLoggedIn}
                                placeholder={
                                    isLoggedIn
                                        ? "Enter your full name"
                                        : "Create an account to edit your profile"
                                }
                                className="
                                    w-full mt-1 p-3 rounded-xl
                                    border border-primary/30
                                    focus:border-primary
                                    outline-none transition
                                    disabled:bg-gray-100
                                    disabled:text-gray-400
                                    disabled:cursor-not-allowed
                                "
                            />
                        </div>

                        {/* Email */}

                        <div>
                            <label className="text-sm text-textSecondary">
                                Email Address
                            </label>

                            <input
                                type="email"
                                value={email}
                                onChange={(e) =>
                                    setEmail(
                                        e.target.value
                                    )
                                }
                                disabled={!isLoggedIn}
                                placeholder={
                                    isLoggedIn
                                        ? "Enter your email"
                                        : "Create an account to edit your profile"
                                }
                                className="
                                    w-full mt-1 p-3 rounded-xl
                                    border border-primary/30
                                    focus:border-primary
                                    outline-none transition
                                    disabled:bg-gray-100
                                    disabled:text-gray-400
                                    disabled:cursor-not-allowed
                                "
                            />
                        </div>

                        {/* Save */}

                        <button
                            onClick={handleSave}
                            disabled={!isLoggedIn}
                            className="
                                bg-primary text-white
                                px-5 py-2 rounded-xl
                                flex items-center gap-2
                                hover:opacity-90 transition
                                disabled:opacity-50
                                disabled:cursor-not-allowed
                            "
                        >
                            <FontAwesomeIcon
                                icon={faFloppyDisk}
                            />

                            Save Changes
                        </button>

                    </div>
                </div>

                {/* =========================
                    PRIVACY
                ========================= */}

                <div className="bg-card p-6 rounded-2xl border">

                    <h2 className="font-semibold mb-4">
                        Privacy Settings
                    </h2>

                    <div className="space-y-5">

                        {/* Save Chat */}

                        <div className="flex justify-between items-center">

                            <p>
                                Save chat history
                            </p>

                            <div
                                onClick={() =>
                                    setSaveChat(
                                        !saveChat
                                    )
                                }
                                className={`
                                    w-12 h-6 flex items-center
                                    rounded-full p-1 cursor-pointer
                                    transition
                                    ${
                                        saveChat
                                            ? "bg-primary"
                                            : "bg-gray-300"
                                    }
                                `}
                            >
                                <div
                                    className={`
                                        bg-white w-4 h-4
                                        rounded-full shadow-md
                                        transform transition
                                        ${
                                            saveChat
                                                ? "translate-x-6"
                                                : ""
                                        }
                                    `}
                                />
                            </div>
                        </div>

                        {/* Save Journal */}

                        <div className="flex justify-between items-center">

                            <p>
                                Save journal entries
                            </p>

                            <div
                                onClick={() =>
                                    setSaveJournal(
                                        !saveJournal
                                    )
                                }
                                className={`
                                    w-12 h-6 flex items-center
                                    rounded-full p-1 cursor-pointer
                                    transition
                                    ${
                                        saveJournal
                                            ? "bg-primary"
                                            : "bg-gray-300"
                                    }
                                `}
                            >
                                <div
                                    className={`
                                        bg-white w-4 h-4
                                        rounded-full shadow-md
                                        transform transition
                                        ${
                                            saveJournal
                                                ? "translate-x-6"
                                                : ""
                                        }
                                    `}
                                />
                            </div>
                        </div>

                    </div>
                </div>

                {/* =========================
                    DATA CONTROL
                ========================= */}

                <div className="bg-card p-6 rounded-2xl border">

                    <h2 className="font-semibold mb-4">
                        Data Control
                    </h2>

                    <p className="text-sm text-textSecondary mb-4">
                        Reset all app data including
                        journal and chat history.
                    </p>

                    <button
                        onClick={resetApp}
                        className="
                            bg-red-500 text-white
                            px-4 py-2 rounded-xl
                            hover:bg-red-600 transition
                        "
                    >
                        Reset App Data
                    </button>

                </div>

                {/* =========================
                    ACCOUNT
                ========================= */}

                <div className="bg-card p-6 rounded-2xl border">

                    <h2 className="font-semibold mb-4">
                        Account
                    </h2>

                    {isLoggedIn ? (

                        /* LOGGED IN */

                        <div>

                            <p className="text-sm text-textSecondary mb-4">
                                You are currently logged in.
                            </p>

                            <button
                                onClick={logout}
                                className="
                                    bg-black text-white
                                    px-4 py-2 rounded-xl
                                    flex items-center gap-2
                                    hover:bg-gray-900
                                    transition
                                "
                            >
                                <FontAwesomeIcon
                                    icon={
                                        faRightFromBracket
                                    }
                                />

                                Log Out
                            </button>

                        </div>

                    ) : (

                        /* NOT LOGGED IN */

                        <div>

                            <p className="text-sm text-textSecondary mb-4">
                                You're currently using
                                MindEase as a demo user.
                                Create an account to save
                                your profile.
                            </p>

                            <button
                                onClick={createAccount}
                                className="
                                    bg-primary text-white
                                    px-4 py-2 rounded-xl
                                    flex items-center gap-2
                                    hover:opacity-90
                                    transition
                                "
                            >
                                <FontAwesomeIcon
                                    icon={faUserPlus}
                                />

                                Create Account
                            </button>

                        </div>

                    )}
                    </div>

{/* 🔹 SAFETY SETTINGS */}
<div className="bg-card p-6 rounded-2xl border">
  <h2 className="font-semibold mb-4">
    AI Safety Settings
  </h2>

  <div className="space-y-5">

    {/* AI Safety Detection */}
    <div className="flex justify-between items-start gap-4">
      <div>
        <p className="font-medium">
          Enable AI Safety Detection
        </p>

        <p className="text-sm text-textSecondary mt-1">
          MindEase can identify messages that may indicate a serious
          safety concern and offer to connect you with someone you trust.
        </p>
      </div>

      <div
        onClick={() => {
          setAiSafety(!aiSafety);
          localStorage.setItem("aiSafety", !aiSafety);
        }}
        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition flex-shrink-0 mt-1
          ${aiSafety ? "bg-primary" : "bg-gray-300"}
        `}
      >
        <div
          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition
            ${aiSafety ? "translate-x-6" : ""}
          `}
        />
      </div>
    </div>

    {/* Automatic SOS */}
    <div className="flex justify-between items-start gap-4">
      <div>
        <p className="font-medium">
          Enable Automatic SOS
        </p>

        <p className="text-sm text-textSecondary mt-1">
          When enabled, MindEase may notify your selected Safe Place
          contact when a high-risk safety concern is detected.
        </p>
      </div>

      <div
        onClick={() => {
          setAutoSos(!autoSos);
          localStorage.setItem("autoSos", !autoSos);
        }}
        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition flex-shrink-0 mt-1
          ${autoSos ? "bg-primary" : "bg-gray-300"}
        `}
      >
        <div
          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition
            ${autoSos ? "translate-x-6" : ""}
          `}
        />
      </div>
    </div>

  </div>
</div>

</div>

            </div>
        </div>
    );
}

export default Settings;