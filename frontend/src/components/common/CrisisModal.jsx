import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faXmark,
  faHeartPulse,
  faShieldHeart,
  faClock,
  faLocationDot,
  faEnvelope,
  faMagnifyingGlass,
  faCopy,
  faCheck,
  faBuildingColumns,
  faTriangleExclamation,
  faArrowUpRightFromSquare,
  faPaperPlane,
  faPenToSquare,
  faArrowLeft
} from "@fortawesome/free-solid-svg-icons";
import { CRISIS_HELPLINES, EMERGENCY_NUMBERS } from "../../data/crisisHelplines";
import { useAuth } from "../../context/AuthContext";

function CrisisModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [copiedId, setCopiedId] = useState(null);

  // Active email composer state
  const [composingHelpline, setComposingHelpline] = useState(null);
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [isCopiedTemplate, setIsCopiedTemplate] = useState(false);

  // Generate tailored email content for a helpline
  const startEmailComposer = (helpline) => {
    const userName = user?.name || "A MindEase User";
    const userContact = user?.email || "";
    const subject = `[Confidential Support Request] Need Emotional Support - MindEase`;
    const body = `Dear ${helpline.name} Support Team,

I am reaching out through MindEase because I am currently experiencing emotional distress and would appreciate your confidential support and guidance.

My Name: ${userName}
Contact Email: ${userContact || "[My Email Address]"}
Location: ${helpline.category === "maharashtra" ? "Maharashtra, India" : "India"}

What I am going through right now:
[Please share what you are feeling or what is overwhelming you right now]

Preferred time to be contacted: [As soon as possible / Morning / Afternoon / Evening]

Thank you for your confidential listening and help.

--
Sent via MindEase Mental Health Crisis Directory`;

    setComposingHelpline(helpline);
    setCustomSubject(subject);
    setCustomBody(body);
    setIsCopiedTemplate(false);
  };

  const closeEmailComposer = () => {
    setComposingHelpline(null);
  };

  const filteredHelplines = useMemo(() => {
    return CRISIS_HELPLINES.filter((h) => {
      // Category filter
      if (activeCategory === "24x7" && !h.is24x7) return false;
      if (activeCategory === "national" && h.category !== "national") return false;
      if (activeCategory === "maharashtra" && h.category !== "maharashtra") return false;

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        h.name.toLowerCase().includes(q) ||
        h.subtitle.toLowerCase().includes(q) ||
        h.coverage.toLowerCase().includes(q) ||
        h.phones.some((p) => p.replace(/[^\d]/g, "").includes(q) || p.includes(q)) ||
        (h.description && h.description.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, activeCategory]);

  const handleCopy = (id, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyTemplate = () => {
    if (!composingHelpline) return;
    const fullText = `To: ${composingHelpline.email}\nSubject: ${customSubject}\n\n${customBody}`;
    navigator.clipboard?.writeText(fullText);
    setIsCopiedTemplate(true);
    setTimeout(() => setIsCopiedTemplate(false), 2000);
  };

  // URL generators for opening actual inboxes
  const getGmailUrl = () => {
    if (!composingHelpline?.email) return "#";
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      composingHelpline.email
    )}&su=${encodeURIComponent(customSubject)}&body=${encodeURIComponent(customBody)}`;
  };

  const getMailtoUrl = () => {
    if (!composingHelpline?.email) return "#";
    return `mailto:${composingHelpline.email}?subject=${encodeURIComponent(
      customSubject
    )}&body=${encodeURIComponent(customBody)}`;
  };

  const getOutlookUrl = () => {
    if (!composingHelpline?.email) return "#";
    return `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(
      composingHelpline.email
    )}&subject=${encodeURIComponent(customSubject)}&body=${encodeURIComponent(customBody)}`;
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-950/80 backdrop-blur-md transition-opacity duration-300">
      {/* Clickable Backdrop */}
      <div
        className="fixed inset-0 cursor-pointer"
        onClick={() => {
          if (composingHelpline) closeEmailComposer();
          else onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div className="relative w-full max-w-4xl my-auto rounded-3xl bg-white shadow-2xl border border-purple-100 z-10 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Soft Background Accents */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-purple-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-red-200/30 rounded-full blur-3xl pointer-events-none" />

        {/* TOP EMERGENCY FLASH BAR */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white px-4 py-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shrink-0 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider font-extrabold flex items-center gap-1">
              <FontAwesomeIcon icon={faTriangleExclamation} /> SOS
            </span>
            <span>
              National Emergency: Police – <strong>100 / 112</strong> &nbsp;|&nbsp; TeleMANAS:{" "}
              <a href="tel:14416" className="underline font-bold hover:text-red-100">
                14416
              </a>{" "}
              (24×7, Free)
            </span>
          </div>

          <a
            href="tel:14416"
            className="hidden sm:inline-flex items-center gap-1.5 bg-white text-red-700 text-xs font-bold px-3 py-1 rounded-xl shadow-xs hover:bg-red-50 transition shrink-0 active:scale-95"
          >
            <FontAwesomeIcon icon={faPhone} /> Call TeleMANAS
          </a>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VIEW 1: TAILORED EMAIL COMPOSER & DISPATCH OVERLAY */}
        {/* ------------------------------------------------------------- */}
        {composingHelpline ? (
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 flex flex-col justify-between gap-6 bg-slate-50/60">
            <div>
              {/* Back to Directory button */}
              <button
                onClick={closeEmailComposer}
                className="mb-4 text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-2 cursor-pointer transition"
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Back to Helplines Directory
              </button>

              {/* Recipient Details Card */}
              <div className="bg-white border border-purple-200/90 rounded-2xl p-5 shadow-xs mb-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">
                      Destination Organization
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      {composingHelpline.name}
                    </h3>
                    <p className="text-xs text-slate-500">{composingHelpline.subtitle}</p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs text-slate-500 font-medium">To Email Address:</span>
                    <div className="font-mono text-sm font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-xl border border-purple-100 mt-0.5 select-all">
                      {composingHelpline.email}
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">Sender:</span>
                    <span>{user?.name || "MindEase User"} {user?.email ? `(${user.email})` : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faClock} className="text-purple-500" />
                    <span>Response Hours: {composingHelpline.hours}</span>
                  </div>
                </div>
              </div>

              {/* Editable Tailored Email Preview */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <FontAwesomeIcon icon={faPenToSquare} className="text-purple-600" />
                    Tailored Crisis Support Template
                  </h4>
                  <button
                    onClick={handleCopyTemplate}
                    className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FontAwesomeIcon icon={isCopiedTemplate ? faCheck : faCopy} className={isCopiedTemplate ? "text-emerald-600" : ""} />
                    {isCopiedTemplate ? "Copied to Clipboard!" : "Copy Template"}
                  </button>
                </div>

                {/* Subject Field */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:border-purple-500 outline-none"
                  />
                </div>

                {/* Body Field */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Tailored Message Body
                  </label>
                  <textarea
                    rows={8}
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-700 focus:border-purple-500 outline-none font-mono leading-relaxed resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Launch Inboxes Actions Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                <strong>Click below to open your inbox:</strong> The recipient email, subject, and tailored message will open automatically prepared.
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* 1. Open in Gmail Web */}
                <a
                  href={getGmailUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition active:scale-95"
                >
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                  Open in Gmail
                </a>

                {/* 2. Open Default Email Client */}
                <a
                  href={getMailtoUrl()}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition active:scale-95"
                >
                  <FontAwesomeIcon icon={faPaperPlane} />
                  Default Mail App
                </a>

                {/* 3. Open in Outlook Web */}
                <a
                  href={getOutlookUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2.5 rounded-xl transition"
                >
                  Outlook Web
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* VIEW 2: STANDARD DIRECTORY LIST WITH SEARCH & FILTERS */
          /* ------------------------------------------------------------- */
          <>
            {/* MODAL HEADER */}
            <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 shrink-0 relative bg-white/90 backdrop-blur-xs">
              {/* Header Close Button */}
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-20 cursor-pointer"
              >
                <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3.5 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-sm shrink-0">
                  <FontAwesomeIcon icon={faHeartPulse} className="text-2xl animate-pulse text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                    <span>Mental Health Resources & Suicide Helplines</span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      24/7 Verified
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Mumbai City & Suburban · Thane · Pune · Nashik · Nagpur · All-India National Helplines
                  </p>
                </div>
              </div>

              {/* Search & Category Filter Controls */}
              <div className="mt-4 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                {/* Search Input */}
                <div className="relative flex-1">
                  <FontAwesomeIcon
                    icon={faMagnifyingGlass}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"
                  />
                  <input
                    type="text"
                    placeholder="Search by name, city, number, or language..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-purple-500 outline-none transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0">
                  {[
                    { id: "all", label: "All Helplines" },
                    { id: "24x7", label: "24×7 Available" },
                    { id: "national", label: "National / Govt" },
                    { id: "maharashtra", label: "Mumbai & Maharashtra" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 ${
                        activeCategory === cat.id
                          ? "bg-purple-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* SCROLLABLE HELPLINE DIRECTORY */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1 bg-slate-50/50">
              
              {/* FEATURED: TeleMANAS Special Banner */}
              {(activeCategory === "all" || activeCategory === "national" || activeCategory === "24x7") &&
                !searchQuery && (
                  <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-800 text-white p-5 rounded-2xl shadow-md border border-purple-700/50 relative overflow-hidden">
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-purple-500/10 skew-x-12 pointer-events-none" />
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="bg-emerald-500 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">
                            Govt. of India · 24×7 Free
                          </span>
                          <span className="text-purple-200 text-xs font-medium">
                            Ministry of Health & Family Welfare
                          </span>
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                          <FontAwesomeIcon icon={faBuildingColumns} className="text-purple-300" />
                          TeleMANAS (National Mental Health Helpline)
                        </h3>
                        <p className="text-xs text-purple-200 mt-1 max-w-xl">
                          Comprehensive mental health care service offering immediate psychological support, crisis counseling, and guidance across 20+ languages.
                        </p>
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-lg sm:text-xl font-black text-amber-300 font-mono">
                          <span>Dial: 14416</span>
                          <span className="text-sm font-normal text-purple-300">or</span>
                          <span>1800-891-4416</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap gap-2.5 shrink-0">
                        <a
                          href="tel:14416"
                          className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-lg transition active:scale-95"
                        >
                          <FontAwesomeIcon icon={faPhone} />
                          Call 14416 Now
                        </a>
                        <button
                          onClick={() => handleCopy("telemanas-banner", "14416")}
                          className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-3 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                          title="Copy number"
                        >
                          <FontAwesomeIcon icon={copiedId === "telemanas-banner" ? faCheck : faCopy} />
                          {copiedId === "telemanas-banner" ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              {/* Helplines Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredHelplines.map((helpline) => {
                  const mainPhone = helpline.phones[0];
                  const cleanPhone = mainPhone.replace(/[^\d+]/g, "");
                  const isCopied = copiedId === helpline.id;

                  return (
                    <div
                      key={helpline.id}
                      className="bg-white border border-slate-200/80 hover:border-purple-300 rounded-2xl p-4 sm:p-4.5 transition-all shadow-2xs hover:shadow-sm flex flex-col justify-between gap-3 group"
                    >
                      <div>
                        {/* Header: Title & Badges */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div>
                            <h4 className="font-bold text-slate-900 text-base group-hover:text-purple-700 transition-colors">
                              {helpline.name}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium">{helpline.subtitle}</p>
                          </div>

                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                              helpline.is24x7
                                ? "bg-purple-100 text-purple-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {helpline.badge}
                          </span>
                        </div>

                        {/* Phone Numbers Display */}
                        <div className="my-2 bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between gap-2">
                          <div className="font-mono text-sm sm:text-base font-extrabold text-purple-800 tracking-wide truncate">
                            {helpline.displayPhone || helpline.phones.join(" / ")}
                          </div>
                          <button
                            onClick={() => handleCopy(helpline.id, helpline.phones.join(" / "))}
                            className="text-slate-400 hover:text-purple-600 text-xs p-1 cursor-pointer shrink-0 transition"
                            title="Copy number"
                          >
                            <FontAwesomeIcon icon={isCopied ? faCheck : faCopy} className={isCopied ? "text-emerald-600" : ""} />
                            <span className="sr-only">Copy</span>
                          </button>
                        </div>

                        {/* Details / Hours & Coverage */}
                        <div className="space-y-1 text-xs text-slate-600 mb-2">
                          <div className="flex items-start gap-2">
                            <FontAwesomeIcon icon={faClock} className="text-purple-500 text-[11px] mt-0.5 shrink-0" />
                            <span className="font-medium">{helpline.hours}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <FontAwesomeIcon icon={faLocationDot} className="text-slate-400 text-[11px] mt-0.5 shrink-0" />
                            <span className="text-slate-500">{helpline.coverage}</span>
                          </div>
                          {helpline.email && (
                            <div className="flex items-start gap-2">
                              <FontAwesomeIcon icon={faEnvelope} className="text-purple-400 text-[11px] mt-0.5 shrink-0" />
                              <span className="text-purple-700 font-mono text-[11px] font-semibold">{helpline.email}</span>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        {helpline.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                            {helpline.description}
                          </p>
                        )}
                      </div>

                      {/* Actions (Call / Tailored Email) */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <a
                          href={`tel:${cleanPhone}`}
                          className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 rounded-xl transition shadow-2xs active:scale-95"
                        >
                          <FontAwesomeIcon icon={faPhone} />
                          Call {mainPhone}
                        </a>

                        {helpline.email && (
                          <button
                            onClick={() => startEmailComposer(helpline)}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            title={`Send tailored email to ${helpline.email}`}
                          >
                            <FontAwesomeIcon icon={faEnvelope} /> Email Inbox
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Empty Search State */}
              {filteredHelplines.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3 text-lg">
                    <FontAwesomeIcon icon={faMagnifyingGlass} />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">No Helplines Matched Your Search</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Try searching for "TeleMANAS", "Mumbai", "14416", or clear your filter.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setActiveCategory("all");
                    }}
                    className="mt-3 text-xs font-semibold text-purple-600 hover:underline cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              )}

            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-white/95 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-slate-500 leading-relaxed text-center sm:text-left">
                <FontAwesomeIcon icon={faShieldHeart} className="text-purple-600 text-base shrink-0" />
                <span>
                  All helplines are free, confidential, and run by authorized government or nonprofit psychiatric teams.
                </span>
              </div>

              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer shadow-sm shrink-0"
              >
                Close Directory
              </button>
            </div>
          </>
        )}

      </div>
    </div>,
    document.body
  );
}

export default CrisisModal;