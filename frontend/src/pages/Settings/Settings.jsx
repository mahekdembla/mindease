import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFloppyDisk } from "@fortawesome/free-solid-svg-icons";

function Settings() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [saveChat, setSaveChat] = useState(true);
  const [saveJournal, setSaveJournal] = useState(true);
  const [darkMode, setDarkMode] = useState(
  localStorage.getItem("theme") === "dark"
  );

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("user", JSON.stringify({ name, email }));
    alert("Profile updated");
  };

  const resetApp = () => {
    localStorage.clear();
    alert("App data reset");
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  return (
    <div className="w-full flex justify-center">

      <div className="w-full max-w-3xl p-8">

        {/* Header */}
        <h1 className="text-3xl font-heading font-semibold text-textPrimary mb-2">
          Settings
        </h1>
        <p className="text-textSecondary mb-6">
          Manage your account preferences
        </p>

        <div className="space-y-6">

          {/* 🔹 PROFILE */}
          <div className="bg-card p-6 rounded-2xl border">
            <h2 className="font-semibold mb-4">Profile Details</h2>

            <div className="space-y-4">

              {/* Name */}
              <div>
                <label className="text-sm text-textSecondary">
                  Full Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-primary/30 focus:border-primary outline-none transition"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-sm text-textSecondary">
                  Email Address
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl border border-primary/30 focus:border-primary outline-none transition"
                />
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                className="bg-primary text-white px-5 py-2 rounded-xl flex items-center gap-2 hover:opacity-90 transition"
              >
                <FontAwesomeIcon icon={faFloppyDisk} />
                Save Changes
              </button>

            </div>
          </div>

          {/* 🔹 PRIVACY */}
          <div className="bg-card p-6 rounded-2xl border">
            <h2 className="font-semibold mb-4">Privacy Settings</h2>

            <div className="space-y-5">

              {/* Toggle 1 */}
              <div className="flex justify-between items-center">
                <p>Save chat history</p>

                <div
                  onClick={() => setSaveChat(!saveChat)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition
                    ${saveChat ? "bg-primary" : "bg-gray-300"}
                  `}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition
                      ${saveChat ? "translate-x-6" : ""}
                    `}
                  />
                </div>
              </div>

              {/* Toggle 2 */}
              <div className="flex justify-between items-center">
                <p>Save journal entries</p>

                <div
                  onClick={() => setSaveJournal(!saveJournal)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition
                    ${saveJournal ? "bg-primary" : "bg-gray-300"}
                  `}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition
                      ${saveJournal ? "translate-x-6" : ""}
                    `}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* 🔹 DATA CONTROL (CLEAN VERSION) */}
          <div className="bg-card p-6 rounded-2xl border">
            <h2 className="font-semibold mb-4">Data Control</h2>

            <p className="text-sm text-textSecondary mb-4">
              Reset all app data including journal and chat history.
            </p>

            <button
              onClick={resetApp}
              className="bg-red-500 text-white px-4 py-2 rounded-xl hover:bg-red-600 transition"
            >
              Reset App Data
            </button>
          </div>

          {/* 🔹 ACCOUNT */}
          <div className="bg-card p-6 rounded-2xl border">
            <h2 className="font-semibold mb-4">Account</h2>

            <button
              onClick={logout}
              className="bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-900 transition"
            >
              Logout
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Settings;