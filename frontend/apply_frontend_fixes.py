"""
Frontend fixes for MindEase (backups saved as <file>.bak_fix):
  1. "I'm Safe Right Now" button now works (hides the safety card, sends a kind reply, logs it in Safety Activity)
  2. New "Professional Help" page (/professionals) with two psychiatrists you can call or chat with via WhatsApp,
     reachable from the top menu and from the high-risk safety card
  3. Chat feels faster: the sidebar refresh after each message no longer blocks the reply

Run from the repo root:   python apply_frontend_fixes.py      (the script can live anywhere)
Safe to run twice. If an anchor is not found it changes nothing and says which one.
Afterwards: put the real doctors' details in frontend/src/data/professionals.js
"""
import shutil, sys
from pathlib import Path

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("frontend/src")

PAGE = r"""import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserDoctor,
  faPhone,
  faCommentDots,
  faEnvelope,
  faClock,
  faLocationDot,
  faLanguage,
} from "@fortawesome/free-solid-svg-icons";
import { professionals } from "../../data/professionals";

const onlyDigits = (value) => (value || "").replace(/[^\d]/g, "");

const CHAT_INTRO =
  "Hello, I found you through MindEase and would like to book a consultation.";

function Professionals() {
  // Shown only while developing, so a placeholder never reaches a demo unnoticed.
  const hasPlaceholders = professionals.some((p) => p.name.includes("REPLACE"));

  return (
    <div className="p-6 sm:p-8 w-full flex flex-col min-h-screen bg-background relative overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <FontAwesomeIcon icon={faUserDoctor} className="text-3xl text-purple-600" />
          <div>
            <h1 className="text-3xl font-heading font-bold text-textPrimary">Professional Help</h1>
            <p className="text-textSecondary">
              Talk to a psychiatrist by phone or chat. They can support you in ways MindEase can't.
            </p>
          </div>
        </div>

        {import.meta.env.DEV && hasPlaceholders && (
          <div className="mb-6 p-4 rounded-xl border border-amber-300 bg-amber-50 text-sm text-amber-800">
            Developer note: replace the placeholder details in <code>src/data/professionals.js</code> with
            real, verified psychiatrists before you demo or publish. This note only shows in development.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {professionals.map((p) => {
            const hasContact = p.phone || p.whatsapp || p.email;
            return (
              <div key={p.id} className="bg-card border border-border p-6 rounded-2xl flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-textPrimary">{p.name}</h2>
                  <p className="text-sm text-primary font-medium">{p.title}</p>
                </div>

                <div className="space-y-2 text-sm text-textSecondary">
                  {p.location && (
                    <p className="flex items-start gap-2">
                      <FontAwesomeIcon icon={faLocationDot} className="mt-0.5 text-primary" />
                      <span>{p.location}</span>
                    </p>
                  )}
                  {p.availability && (
                    <p className="flex items-start gap-2">
                      <FontAwesomeIcon icon={faClock} className="mt-0.5 text-primary" />
                      <span>{p.availability}</span>
                    </p>
                  )}
                  {p.languages?.length > 0 && (
                    <p className="flex items-start gap-2">
                      <FontAwesomeIcon icon={faLanguage} className="mt-0.5 text-primary" />
                      <span>{p.languages.join(", ")}</span>
                    </p>
                  )}
                </div>

                {hasContact ? (
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {p.phone && (
                      <a
                        href={`tel:${p.phone}`}
                        className="flex items-center gap-2 text-xs font-semibold bg-primary text-white px-4 py-2 rounded-xl hover:opacity-90 transition"
                      >
                        <FontAwesomeIcon icon={faPhone} /> Call
                      </a>
                    )}
                    {p.whatsapp && (
                      <a
                        href={`https://wa.me/${onlyDigits(p.whatsapp)}?text=${encodeURIComponent(CHAT_INTRO)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs font-semibold text-primary bg-primaryLight border border-primary/40 px-4 py-2 rounded-xl hover:bg-primary hover:text-white transition"
                      >
                        <FontAwesomeIcon icon={faCommentDots} /> Chat on WhatsApp
                      </a>
                    )}
                    {p.email && (
                      <a
                        href={`mailto:${p.email}`}
                        className="flex items-center gap-2 text-xs font-semibold text-textPrimary bg-white border border-border px-4 py-2 rounded-xl hover:bg-gray-50 transition"
                      >
                        <FontAwesomeIcon icon={faEnvelope} /> Email
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-textSecondary mt-auto">Contact details coming soon.</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 p-5 rounded-2xl border border-border bg-primaryLight/50 text-sm text-textSecondary space-y-2">
          <p>
            <strong className="text-textPrimary">How this works:</strong> calls and chats happen directly
            with the doctor, outside MindEase. Nothing from your MindEase chats or journal is shared unless
            you choose to share it yourself.
          </p>
          <p>
            These listings are not endorsements, and MindEase cannot give medical advice. If you are in
            immediate danger, call your local emergency number right now, or reach a trusted contact from{" "}
            <Link to="/safeplace" className="text-primary font-semibold underline">
              Safe Place
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export default Professionals;
"""
DATA = r"""// ---------------------------------------------------------------------------
// EDIT THIS FILE: put the real details of two psychiatrists your team has
// verified and has their permission to list. The Professionals page shows
// whatever is here. Leave a field as "" to hide that button.
//
//   phone     -> "Call" button.      e.g. "+91XXXXXXXXXX"
//   whatsapp  -> "Chat" button.      digits with country code, e.g. "91XXXXXXXXXX"
//   email     -> "Email" button.
// ---------------------------------------------------------------------------
export const professionals = [
  {
    id: "psychiatrist-1",
    name: "REPLACE: Dr. Full Name",
    title: "Consultant Psychiatrist",
    location: "REPLACE: Clinic / hospital, City",
    languages: ["English", "Hindi"],
    availability: "REPLACE: e.g. Mon-Sat, 10 am - 6 pm",
    phone: "",
    whatsapp: "",
    email: "",
  },
  {
    id: "psychiatrist-2",
    name: "REPLACE: Dr. Full Name",
    title: "Consultant Psychiatrist",
    location: "REPLACE: Clinic / hospital, City",
    languages: ["English", "Hindi"],
    availability: "REPLACE: e.g. Mon-Sat, 10 am - 6 pm",
    phone: "",
    whatsapp: "",
    email: "",
  },
];
"""

def read(p):
    raw = p.read_bytes().decode("utf-8")
    return raw.replace("\r\n", "\n"), "\r\n" in raw

problems, plans = [], []

def plan_edits(path, edits):
    """edits: list of (marker_if_done, old, new, label). Returns new text or None."""
    text, crlf = read(path)
    for done, old, new, label in edits:
        if done in text:
            print(f"already : {path.name}: {label}")
        elif text.count(old) == 1:
            text = text.replace(old, new)
            print(f"applied : {path.name}: {label}")
        else:
            problems.append(f"{path.name}: {label}")
    plans.append((path, text, crlf))

# ---------------- AISupport.jsx
A = SRC / "pages/Support/AISupport.jsx"
HANDLER = """    // "I'm Safe Right Now": hide the safety card for this message and reply kindly
    const handleImSafe = (index) => {
        const key = `${activeConversationId || "new"}:${index}`;
        const updated = [...dismissedSafety, key];
        setDismissedSafety(updated);
        localStorage.setItem("dismissedSafety", JSON.stringify(updated));

        const activities = JSON.parse(localStorage.getItem("safetyActivities")) || [];
        activities.push({
            title: "Marked as safe",
            description: "Confirmed feeling safe right now after a safety check.",
            timestamp: Date.now(),
            date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString(),
        });
        localStorage.setItem("safetyActivities", JSON.stringify(activities));

        setMessages((prev) => [
            ...prev,
            {
                text: "I'm really glad you're safe right now. I'm here whenever you want to keep talking. If things start to feel heavy again, your Safe Place contacts and professional support are always one tap away \U0001F49C",
                sender: "ai",
            },
        ]);
    };

"""
BTN_INDENT = " " * 44
PRO_BTN = (BTN_INDENT + "<button\n" + BTN_INDENT + "    onClick={() => navigate(\"/professionals\")}\n" + BTN_INDENT +
           "    className=\"flex-1 bg-white border border-red-200 text-red-700 text-xs font-medium py-2 rounded-xl hover:bg-red-50 transition\"\n" +
           BTN_INDENT + ">\n" + BTN_INDENT + "    Talk to a Professional\n" + BTN_INDENT + "</button>\n")
CSP = "Contact Safe Person\n" + BTN_INDENT + "</button>\n"
plan_edits(A, [
    ("dismissedSafety, setDismissedSafety",
     "    const [sosSent, setSosSent] = useState(false);\n",
     "    const [sosSent, setSosSent] = useState(false);\n    const [dismissedSafety, setDismissedSafety] = useState(\n        () => JSON.parse(localStorage.getItem(\"dismissedSafety\") || \"[]\")\n    );\n",
     "dismissed-safety state"),
    ("const handleImSafe", "    // Auto scroll to bottom\n", HANDLER + "    // Auto scroll to bottom\n", "handleImSafe handler"),
    ("!dismissedSafety.includes", "{msg.sender === \"ai\" && isHighRisk && (",
     "{msg.sender === \"ai\" && isHighRisk && !dismissedSafety.includes(`${activeConversationId || \"new\"}:${index}`) && (",
     "hide card once dismissed"),
    ("flex flex-wrap gap-2", "<div className=\"flex gap-2\">", "<div className=\"flex flex-wrap gap-2\">", "wrap buttons"),
    ("Talk to a Professional", CSP, CSP + PRO_BTN, "Talk to a Professional button"),
    ("onClick={() => handleImSafe(index)}", "<button className=\"flex-1 bg-white border",
     "<button onClick={() => handleImSafe(index)} className=\"flex-1 bg-white border", "wire up I'm Safe Right Now"),
    ("(not awaited)", "await loadConversations(false);\n        } catch", "loadConversations(false); // sidebar refresh (not awaited)\n        } catch", "do not wait for sidebar refresh"),
])

# ---------------- App.jsx
APP = SRC / "App.jsx"
ROUTE = ("                    <Route\n                        path=\"/professionals\"\n                        element={<Professionals />}\n                    />\n\n")
plan_edits(APP, [
    ("import Professionals", "import SafePlace from \"./pages/SafePlace/SafePlace\";\n",
     "import SafePlace from \"./pages/SafePlace/SafePlace\";\nimport Professionals from \"./pages/Professionals/Professionals\";\n", "import page"),
    ("\"/safeplace\", \"/professionals\"]", "\"/settings\", \"/safeplace\"];", "\"/settings\", \"/safeplace\", \"/professionals\"];", "protect route"),
    ("path=\"/professionals\"", "                    <Route\n                        path=\"/login\"\n", ROUTE + "                    <Route\n                        path=\"/login\"\n", "add route"),
])

# ---------------- Navbar.jsx
NAV = SRC / "components/layout/Navbar.jsx"
plan_edits(NAV, [
    ("faUserDoctor }", "import { Link, useLocation, useNavigate } from \"react-router-dom\";\n",
     "import { Link, useLocation, useNavigate } from \"react-router-dom\";\nimport { faUserDoctor } from \"@fortawesome/free-solid-svg-icons\";\n", "icon import"),
    ("path: \"/professionals\"",
     "{ name: \"Safe Place\", icon: faShieldHeart, path: \"/safeplace\", desc: \"Grounding & instant relief\" },\n",
     "{ name: \"Safe Place\", icon: faShieldHeart, path: \"/safeplace\", desc: \"Grounding & instant relief\" },\n        { name: \"Professional Help\", icon: faUserDoctor, path: \"/professionals\", desc: \"Talk to a psychiatrist\" },\n",
     "menu item"),
])

if problems:
    print("\nNOTHING WAS CHANGED. Could not find:", "; ".join(problems))
    print("Your files may differ from the version I expected; send me the file and I will adjust.")
    sys.exit(1)

for path, text, crlf in plans:
    old_raw = path.read_bytes().decode("utf-8")
    new_raw = text.replace("\n", "\r\n") if crlf else text
    if new_raw != old_raw:
        shutil.copy(path, str(path) + ".bak_fix")
        path.write_bytes(new_raw.encode("utf-8"))

for rel, content in (("pages/Professionals/Professionals.jsx", PAGE), ("data/professionals.js", DATA)):
    target = SRC / rel
    if target.exists():
        print("kept    :", rel, "(already exists, not overwritten)")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        print("created :", rel)

print("\ndone. Next: edit frontend/src/data/professionals.js with the real doctors' details.")