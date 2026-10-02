import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenNib,
  faBolt,
  faFloppyDisk,
  faTrash,
  faPen,
  faTriangleExclamation,
  faArrowRight,
  faCalendarDay,
  faShieldHeart,
  faFeather,
  faPlay,
  faPause,
  faVolumeHigh,
  faVolumeMute,
  faMusic,
  faChartLine,
  faFire,
  faSliders,
  faRotateRight,
  faCheck
} from "@fortawesome/free-solid-svg-icons";

import Card from "../../components/common/Card";
import Button from "../../components/common/Button";
import {
  fetchJournalEntries,
  saveJournalEntry,
  updateJournalEntry,
  deleteJournalEntry
} from "../../services/api";

function Journal() {
  // Active Tab Mode: 'free_write' | 'trigger_worksheet'
  const [activeTab, setActiveTab] = useState("free_write");

  // ==========================================
  // AMBIENT AUDIO PLAYER STATE (JOURNAL ONLY)
  // ==========================================
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.18); // Default low volume (18%)
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const audioRef = useRef(null);
  const synthAudioCtxRef = useRef(null);
  const synthOscsRef = useRef([]);

  // ==========================================
  // FREE WRITE FORM STATE
  // ==========================================
  const [freeTitle, setFreeTitle] = useState("");
  const [freeText, setFreeText] = useState("");

  // ==========================================
  // TRIGGER WORKSHEET FORM STATE
  // ==========================================
  const [triggerInput, setTriggerInput] = useState("");
  const [responseInput, setResponseInput] = useState("");
  const [lifeEffectInput, setLifeEffectInput] = useState("");
  const [nextTimeHelpInput, setNextTimeHelpInput] = useState("");
  const [intensity, setIntensity] = useState(3);

  // Common Form & List State
  const [selectedMood, setSelectedMood] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [deleteId, setDeleteId] = useState(null);

  const editorRef = useRef(null);

  const moods = [
    "😊 Happy",
    "😌 Calm",
    "😟 Anxious",
    "😢 Sad",
    "😫 Stressed",
  ];

  // Helper date formatter
  const getFormattedDate = (dateVal) => {
    try {
      const d = dateVal ? new Date(dateVal) : new Date();
      if (isNaN(d.getTime())) {
        return dateVal || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      }
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      });
    } catch (e) {
      return "Today";
    }
  };

  // ==========================================
  // AUDIO CONTROLLER & CLEANUP HOOK
  // ==========================================
  useEffect(() => {
    // 1. Initialize HTML5 Audio instance for /audio/calm-ambient.mp3
    const audio = new Audio("/audio/calm-ambient.mp3");
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.onerror = () => {
      console.log("Ambient MP3 audio file status. Web Audio ambient synthesizer available.");
    };

    // 2. Attempt Autoplay on mount at low volume
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => {
          // Autoplay blocked by browser policy -> show manual start button
          setIsPlaying(false);
          setAutoplayBlocked(true);
        });
    }

    // 3. Clean up audio when leaving the Journal page
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.pause();
      audioRef.current = null;
      stopSynthDrone();
    };
  }, []);

  // Web Audio Synth Fallback (if custom MP3 file is absent or fails)
  const startSynthDrone = () => {
    try {
      if (synthAudioCtxRef.current) return;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      synthAudioCtxRef.current = ctx;

      const freqs = [108, 162, 216, 324]; // Gentle 432Hz harmonic ambient chord
      const oscs = freqs.map((f) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        return { osc, gain };
      });
      synthOscsRef.current = oscs;
    } catch (e) {
      console.log("Synth audio fallback context:", e);
    }
  };

  const stopSynthDrone = () => {
    if (synthOscsRef.current) {
      synthOscsRef.current.forEach(({ osc }) => {
        try { osc.stop(); } catch (e) {}
      });
      synthOscsRef.current = [];
    }
    if (synthAudioCtxRef.current) {
      try { synthAudioCtxRef.current.close(); } catch (e) {}
      synthAudioCtxRef.current = null;
    }
  };

  // Audio Play/Pause Toggle
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      stopSynthDrone();
      setIsPlaying(false);
    } else {
      audio.play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => {
          startSynthDrone();
          setIsPlaying(true);
          setAutoplayBlocked(false);
        });
    }
  };

  // Audio Volume Change
  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
    if (newVol > 0) setIsMuted(false);
  };

  // Mute Toggle
  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume > 0 ? volume : 0.18;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const formatSeconds = (sec) => {
    if (isNaN(sec) || sec === 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // ==========================================
  // FETCH & MANAGE JOURNAL ENTRIES
  // ==========================================
  const loadEntries = async () => {
    try {
      const data = await fetchJournalEntries();
      const formatted = data.map((item) => ({
        id: item.id || item._id,
        title: item.title || "",
        text: item.text || "",
        mood: item.mood || "",
        entry_type: (item.type || item.entry_type || (item.trigger ? "trigger_worksheet" : "free_write")).toLowerCase(),
        trigger: item.trigger || "",
        response: item.response || "",
        life_effect: item.life_effect || "",
        next_time_help: item.next_time_help || "",
        intensity: item.intensity !== undefined ? item.intensity : 3,
        date: getFormattedDate(item.time || item.created_at),
        raw_time: item.time || item.created_at || ""
      }));

      formatted.sort((a, b) => new Date(b.raw_time || 0) - new Date(a.raw_time || 0));
      setEntries(formatted);
    } catch (error) {
      console.error("Failed to load journal entries:", error);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const resetForm = () => {
    setFreeTitle("");
    setFreeText("");
    setTriggerInput("");
    setResponseInput("");
    setLifeEffectInput("");
    setNextTimeHelpInput("");
    setIntensity(3);
    setSelectedMood("");
    setEditingId(null);
  };

  // Handle Save (Free Write vs Trigger Worksheet)
  const handleSave = async () => {
    if (isLoading) return;

    if (activeTab === "free_write") {
      if (!freeText.trim()) return;
    } else {
      if (!triggerInput.trim() || !responseInput.trim() || !lifeEffectInput.trim()) return;
    }

    setIsLoading(true);

    try {
      const payload = {
        type: activeTab,
        entry_type: activeTab,
        mood: selectedMood,
        intensity: intensity,
        ...(activeTab === "free_write"
          ? {
              title: freeTitle.trim(),
              text: freeText.trim()
            }
          : {
              trigger: triggerInput.trim(),
              response: responseInput.trim(),
              life_effect: lifeEffectInput.trim(),
              next_time_help: nextTimeHelpInput.trim(),
              title: `Trigger: ${triggerInput.trim().slice(0, 35)}...`,
              text: `Trigger: ${triggerInput.trim()}\nResponse: ${responseInput.trim()}\nImpact: ${lifeEffectInput.trim()}${nextTimeHelpInput.trim() ? `\nNext time: ${nextTimeHelpInput.trim()}` : ""}`
            })
      };

      if (editingId !== null) {
        await updateJournalEntry(editingId, payload);
      } else {
        await saveJournalEntry(payload);
      }

      await loadEntries();
      resetForm();
    } catch (error) {
      console.error("Failed to save journal entry:", error);
      alert("Could not save your entry. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Edit
  const handleEdit = (item) => {
    setEditingId(item.id);
    const targetTab = item.entry_type === "trigger_worksheet" || item.entry_type === "trigger" ? "trigger_worksheet" : "free_write";
    setActiveTab(targetTab);
    setSelectedMood(item.mood || "");
    setIntensity(item.intensity || 3);

    if (targetTab === "free_write") {
      setFreeTitle(item.title || "");
      setFreeText(item.text || "");
    } else {
      setTriggerInput(item.trigger || "");
      setResponseInput(item.response || "");
      setLifeEffectInput(item.life_effect || "");
      setNextTimeHelpInput(item.next_time_help || "");
    }

    setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // Handle Delete
  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteJournalEntry(deleteId);
      setEntries(entries.filter((e) => e.id !== deleteId));
      if (editingId === deleteId) resetForm();
      setDeleteId(null);
    } catch (error) {
      console.error("Failed to delete entry:", error);
      alert("Could not delete entry.");
    }
  };

  // ==========================================
  // SEPARATED ENTRY LISTS
  // ==========================================
  const freeWriteEntries = entries.filter((e) => e.entry_type === "free_write");
  const triggerEntries = entries.filter((e) => e.entry_type === "trigger_worksheet" || e.entry_type === "trigger");

  // ==========================================
  // CALCULATED TRIGGER PATTERN METRICS (REAL DATA)
  // ==========================================
  const totalTriggerCount = triggerEntries.length;
  const avgIntensity = totalTriggerCount > 0
    ? (triggerEntries.reduce((acc, curr) => acc + (curr.intensity || 3), 0) / totalTriggerCount).toFixed(1)
    : "0.0";

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thisWeekTriggerCount = triggerEntries.filter((e) => new Date(e.raw_time || 0) >= sevenDaysAgo).length;

  // Factual trigger topic frequency map
  const triggerFrequency = {};
  triggerEntries.forEach((e) => {
    const rawTrig = e.trigger || e.title || "Unspecified";
    const cleanTrig = rawTrig.length > 30 ? rawTrig.slice(0, 30) + "..." : rawTrig;
    triggerFrequency[cleanTrig] = (triggerFrequency[cleanTrig] || 0) + 1;
  });
  const sortedTriggers = Object.entries(triggerFrequency).sort((a, b) => b[1] - a[1]).slice(0, 4);

  // Factual response snippets
  const responseList = triggerEntries.map((e) => e.response).filter(Boolean).slice(0, 4);

  const todayStr = getFormattedDate();

  return (
    <div className="w-full max-w-5xl mx-auto p-6 sm:p-8 flex flex-col gap-8">


      {/* 1. HEADER & SPOTIFY-STYLE CALM AUDIO PLAYER */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-textPrimary flex items-center gap-3">
            <span>Journal</span>
            <span className="text-2xl">🌿</span>
          </h1>
          <p className="text-textSecondary mt-1 text-base">
            A safe space for your thoughts
          </p>
        </div>

        {/* SPOTIFY-STYLE AMBIENT AUDIO PLAYER COMPONENT */}
        <div className="p-4 px-5 rounded-3xl glass-card-independent border border-purple-500/25 bg-gradient-to-r from-purple-900/10 via-indigo-900/10 to-violet-900/10 flex flex-col sm:flex-row items-center gap-4 shadow-sm w-full lg:w-auto">
          <div className="flex items-center gap-3 shrink-0">
            <div className={`w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center text-lg shadow-inner ${isPlaying ? "animate-pulse" : ""}`}>
              <FontAwesomeIcon icon={faMusic} />
            </div>
            <div>
              <p className="text-xs font-extrabold text-textPrimary leading-tight flex items-center gap-1.5">
                <span>🌿 Calm Space</span>
                <span className="text-[10px] text-purple-600 dark:text-purple-300 font-semibold bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/20">
                  MindEase
                </span>
              </p>
              <p className="text-[11px] text-textSecondary leading-tight">Soft Ambient • Looping</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            {/* Play / Pause / Start Button */}
            {autoplayBlocked && !isPlaying ? (
              <button
                onClick={togglePlay}
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-transform hover:scale-105 flex items-center gap-1.5 shrink-0"
              >
                <FontAwesomeIcon icon={faPlay} />
                <span>▶ Start Calm Sound</span>
              </button>
            ) : (
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs flex items-center justify-center shadow-xs transition-transform hover:scale-105 shrink-0"
                aria-label={isPlaying ? "Pause ambient sound" : "Play ambient sound"}
              >
                <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
              </button>
            )}

            {/* Time / Progress Display */}
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-textSecondary font-medium">
              <span>{formatSeconds(currentTime)}</span>
              <div className="w-20 h-1.5 bg-purple-500/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-300"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 35}%` }}
                />
              </div>
              <span>{duration > 0 ? formatSeconds(duration) : "∞"}</span>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2 border-l border-purple-500/20 pl-3">
              <button onClick={toggleMute} className="text-textSecondary hover:text-primary text-xs" title="Mute/Unmute">
                <FontAwesomeIcon icon={isMuted || volume === 0 ? faVolumeMute : faVolumeHigh} />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-purple-500/30 rounded-lg appearance-none cursor-pointer accent-purple-600"
                title="Adjust Ambient Volume"
              />
            </div>
          </div>
        </div>
      </header>

      {/* 2. MODE / TAB SELECTOR */}
      <div className="flex border-b border-purple-500/20 gap-2">
        <button
          onClick={() => {
            setActiveTab("free_write");
            if (editingId === null) resetForm();
          }}
          className={`
            px-6 py-3 font-bold text-sm rounded-t-2xl transition-all duration-200 flex items-center gap-2 border-b-2
            ${activeTab === "free_write"
              ? "border-purple-600 text-purple-700 dark:text-purple-300 bg-purple-500/10 shadow-xs"
              : "border-transparent text-textSecondary hover:text-textPrimary hover:bg-purple-500/5"}
          `}
        >
          <FontAwesomeIcon icon={faPenNib} />
          <span>✍ Free Write</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("trigger_worksheet");
            if (editingId === null) resetForm();
          }}
          className={`
            px-6 py-3 font-bold text-sm rounded-t-2xl transition-all duration-200 flex items-center gap-2 border-b-2
            ${activeTab === "trigger_worksheet"
              ? "border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 shadow-xs"
              : "border-transparent text-textSecondary hover:text-textPrimary hover:bg-indigo-500/5"}
          `}
        >
          <FontAwesomeIcon icon={faBolt} />
          <span>↗ Trigger Worksheet</span>
        </button>
      </div>

      {/* 3. ACTIVE TAB CONTENT WORKSPACE */}
      <div ref={editorRef} className="scroll-mt-6">

        {/* ============================================================ */}
        {/* TAB 1: FREE WRITE — PERSONAL NOTEBOOK WRITING PAGE           */}
        {/* ============================================================ */}
        {activeTab === "free_write" && (
          <div className="flex flex-col gap-8">
            {/* Notebook Form */}
            <div className="relative rounded-3xl p-6 sm:p-10 border-2 border-slate-900 bg-gradient-to-b from-[#f4eeff] via-[#f8f5ff] to-[#f2eafe] text-slate-900 shadow-xl overflow-hidden transition-all duration-300">
              <div className="flex items-center justify-between border-b-2 border-slate-900/15 pb-4 mb-6">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-purple-900/70 block">
                    PERSONAL NOTES WORKSPACE
                  </span>
                  <h3 className="text-2xl font-heading font-extrabold text-slate-900 flex items-center gap-2">
                    <span>My Journal</span>
                    <FontAwesomeIcon icon={faFeather} className="text-purple-600 text-sm" />
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 bg-white/70 px-3.5 py-1.5 rounded-full border border-slate-900/20 shadow-xs">
                  <FontAwesomeIcon icon={faCalendarDay} className="text-purple-700" />
                  <span>{todayStr}</span>
                </div>
              </div>

              {/* Optional Title */}
              <div className="mb-4">
                <input
                  type="text"
                  value={freeTitle}
                  onChange={(e) => setFreeTitle(e.target.value)}
                  placeholder="Give this entry a title... (optional)"
                  className="w-full text-lg font-bold text-slate-900 placeholder-purple-900/40 bg-transparent border-b-2 border-purple-900/20 focus:border-slate-900 outline-none py-2 transition-colors"
                />
              </div>

              {/* Writing Area */}
              <div className="relative mb-5">
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Write whatever is on your mind. No structure, no judgment..."
                  className="w-full h-64 sm:h-72 p-5 text-slate-900 placeholder-slate-500 bg-white/85 rounded-2xl border-2 border-slate-900/20 focus:border-slate-900 focus:ring-4 focus:ring-purple-400/20 text-base sm:text-lg leading-relaxed resize-none outline-none transition-all shadow-inner font-sans"
                />
                <div className="absolute bottom-3 right-4 text-xs font-semibold text-slate-500 bg-white/90 px-2.5 py-0.5 rounded-md border border-slate-900/10">
                  {freeText.length} characters
                </div>
              </div>

              {/* Mood Selection & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-900/15 pt-5">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block mb-2">
                    How are you feeling? (Optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {moods.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedMood(selectedMood === m ? "" : m)}
                        className={`
                          px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border
                          ${selectedMood === m
                            ? "bg-purple-700 text-white border-purple-800 shadow-xs scale-105"
                            : "bg-white/80 text-slate-800 border-slate-900/20 hover:border-purple-600 hover:bg-purple-50"}
                        `}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  {editingId !== null && (
                    <button
                      onClick={resetForm}
                      className="px-4 py-2.5 rounded-xl border border-slate-900/30 text-slate-800 font-bold text-xs hover:bg-slate-900/10 transition-colors"
                    >
                      Cancel Editing
                    </button>
                  )}
                  <Button
                    onClick={handleSave}
                    disabled={isLoading || !freeText.trim()}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    <FontAwesomeIcon icon={faFloppyDisk} />
                    <span>{isLoading ? "Saving..." : editingId !== null ? "Update Note" : "Save Entry"}</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* SEPARATE LIST: YOUR NOTES (ONLY FREE WRITE) */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                <h2 className="text-xl font-bold font-heading text-textPrimary flex items-center gap-2">
                  <span>YOUR NOTES</span>
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                    {freeWriteEntries.length}
                  </span>
                </h2>
                <p className="text-xs text-textSecondary">Personal notes & free writing entries</p>
              </div>

              {freeWriteEntries.length === 0 ? (
                <Card className="p-8 text-center flex flex-col items-center gap-3 glass-card-independent">
                  <span className="text-4xl">✍</span>
                  <p className="text-base font-bold text-textPrimary">No personal notes yet</p>
                  <p className="text-xs text-textSecondary max-w-md">
                    Use the editor above to write down whatever is on your mind freely.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {freeWriteEntries.map((item) => (
                    <Card key={item.id} className="p-5 glass-card-independent flex flex-col justify-between gap-3 hover:border-purple-400/50 transition-all">
                      <div>
                        <div className="flex items-center justify-between text-xs text-textSecondary mb-2">
                          <span className="font-bold flex items-center gap-1">
                            <FontAwesomeIcon icon={faCalendarDay} className="text-primary" />
                            {item.date}
                          </span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEdit(item)} className="hover:text-primary font-semibold flex items-center gap-1">
                              <FontAwesomeIcon icon={faPen} /> Edit
                            </button>
                            <button onClick={() => setDeleteId(item.id)} className="hover:text-red-500 font-semibold flex items-center gap-1">
                              <FontAwesomeIcon icon={faTrash} /> Delete
                            </button>
                          </div>
                        </div>
                        {item.title && <h3 className="font-bold text-textPrimary text-base mb-1">{item.title}</h3>}
                        <p className="text-textPrimary text-sm leading-relaxed whitespace-pre-wrap line-clamp-4">{item.text}</p>
                      </div>
                      {item.mood && (
                        <div className="pt-2 border-t border-purple-500/10 flex items-center justify-between">
                          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                            {item.mood}
                          </span>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: TRIGGER WORKSHEET — STRUCTURED REFLECTION PAGE        */}
        {/* ============================================================ */}
        {activeTab === "trigger_worksheet" && (
          <div className="flex flex-col gap-10">
            {/* Worksheet Form */}
            <div className="rounded-3xl p-6 sm:p-10 border-2 border-indigo-900/40 bg-gradient-to-b from-indigo-50/90 via-purple-50/70 to-slate-50 dark:from-card dark:to-card text-textPrimary shadow-xl transition-all duration-300">
              <div className="border-b border-indigo-500/20 pb-4 mb-6">
                <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-700 dark:text-indigo-300 block">
                  STRUCTURED SELF-REFLECTION
                </span>
                <h3 className="text-2xl font-heading font-extrabold text-textPrimary flex items-center gap-2">
                  <span>Trigger Worksheet</span>
                  <FontAwesomeIcon icon={faBolt} className="text-indigo-600 text-sm" />
                </h3>
                <p className="text-xs text-textSecondary mt-1">
                  Understand what happened, how you responded, and what might help next time.
                </p>
              </div>

              {/* 5 Form Fields */}
              <div className="flex flex-col gap-5 mb-6">
                {/* 1. POSSIBLE TRIGGER */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-card border border-indigo-500/25 shadow-xs">
                  <label className="block font-extrabold text-sm text-indigo-900 dark:text-indigo-200 mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs flex items-center justify-center font-black">1</span>
                    <span>Possible Trigger *</span>
                  </label>
                  <p className="text-xs text-textSecondary mb-2">What happened or what situation affected you?</p>
                  <textarea
                    value={triggerInput}
                    onChange={(e) => setTriggerInput(e.target.value)}
                    placeholder="Describe the situation or event..."
                    className="w-full h-24 p-3.5 rounded-xl outline-none text-sm text-textPrimary bg-indigo-500/5 border border-indigo-500/20 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-400/20 resize-none"
                  />
                </div>

                {/* 2. YOUR RESPONSE */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-card border border-purple-500/25 shadow-xs">
                  <label className="block font-extrabold text-sm text-purple-900 dark:text-purple-200 mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs flex items-center justify-center font-black">2</span>
                    <span>Your Response *</span>
                  </label>
                  <p className="text-xs text-textSecondary mb-2">How did you react emotionally or behaviorally?</p>
                  <textarea
                    value={responseInput}
                    onChange={(e) => setResponseInput(e.target.value)}
                    placeholder="Describe how you reacted..."
                    className="w-full h-24 p-3.5 rounded-xl outline-none text-sm text-textPrimary bg-purple-500/5 border border-purple-500/20 focus:border-purple-600 focus:ring-2 focus:ring-purple-400/20 resize-none"
                  />
                </div>

                {/* 3. HOW DOES THIS REACTION AFFECT YOUR LIFE? */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-card border border-rose-500/25 shadow-xs">
                  <label className="block font-extrabold text-sm text-rose-900 dark:text-rose-200 mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-center font-black">3</span>
                    <span>How does this reaction affect your life? *</span>
                  </label>
                  <p className="text-xs text-textSecondary mb-2">What impact does this response have on you?</p>
                  <textarea
                    value={lifeEffectInput}
                    onChange={(e) => setLifeEffectInput(e.target.value)}
                    placeholder="Describe the impact on your life..."
                    className="w-full h-24 p-3.5 rounded-xl outline-none text-sm text-textPrimary bg-rose-500/5 border border-rose-500/20 focus:border-rose-600 focus:ring-2 focus:ring-rose-400/20 resize-none"
                  />
                </div>

                {/* 4. WHAT MIGHT HELP NEXT TIME? */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-card border border-emerald-500/25 shadow-xs">
                  <label className="block font-extrabold text-sm text-emerald-900 dark:text-emerald-200 mb-1 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-center font-black">4</span>
                    <span>What might help next time? (Optional)</span>
                  </label>
                  <p className="text-xs text-textSecondary mb-2">What could help you respond differently or feel supported?</p>
                  <textarea
                    value={nextTimeHelpInput}
                    onChange={(e) => setNextTimeHelpInput(e.target.value)}
                    placeholder="What could help next time..."
                    className="w-full h-20 p-3.5 rounded-xl outline-none text-sm text-textPrimary bg-emerald-500/5 border border-emerald-500/20 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-400/20 resize-none"
                  />
                </div>

                {/* 5. INTENSITY METRIC SCALE */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-card border border-amber-500/25 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-extrabold text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-center font-black">5</span>
                      <span>How intense was this experience?</span>
                    </label>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                      Level {intensity} / 5
                    </span>
                  </div>
                  <p className="text-xs text-textSecondary mb-3">Self-reported intensity metric for your own observation.</p>

                  <div className="grid grid-cols-5 gap-2.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setIntensity(level)}
                        className={`
                          py-2.5 rounded-xl font-black text-sm flex flex-col items-center gap-1 transition-all border
                          ${intensity === level
                            ? "bg-amber-500 text-white border-amber-600 shadow-md scale-105"
                            : "bg-white dark:bg-card text-textSecondary border-border hover:border-amber-400"}
                        `}
                      >
                        <span>{level}</span>
                        <span className="text-[10px] font-medium opacity-80">
                          {level === 1 ? "Mild" : level === 3 ? "Moderate" : level === 5 ? "High" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-indigo-500/20 pt-5">
                {editingId !== null && (
                  <button
                    onClick={resetForm}
                    className="px-4 py-2.5 rounded-xl border border-border text-textSecondary font-bold text-xs hover:bg-gray-100 dark:hover:bg-card transition-colors"
                  >
                    Cancel Editing
                  </button>
                )}
                <Button
                  onClick={handleSave}
                  disabled={isLoading || !triggerInput.trim() || !responseInput.trim() || !lifeEffectInput.trim()}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  <FontAwesomeIcon icon={faFloppyDisk} />
                  <span>{isLoading ? "Saving..." : editingId !== null ? "Update Worksheet" : "Save Worksheet"}</span>
                </Button>
              </div>
            </div>

            {/* SEPARATE LIST: YOUR TRIGGER REFLECTIONS (ONLY TRIGGER WORKSHEET) */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-3">
                <h2 className="text-xl font-bold font-heading text-textPrimary flex items-center gap-2">
                  <span>YOUR TRIGGER REFLECTIONS</span>
                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                    {triggerEntries.length}
                  </span>
                </h2>
                <p className="text-xs text-textSecondary">Structured reflections & trigger logs</p>
              </div>

              {triggerEntries.length === 0 ? (
                <Card className="p-8 text-center flex flex-col items-center gap-3 glass-card-independent">
                  <span className="text-4xl">↗</span>
                  <p className="text-base font-bold text-textPrimary">No trigger reflections recorded yet</p>
                  <p className="text-xs text-textSecondary max-w-md">
                    Use the worksheet above to reflect on a specific trigger and how you responded.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {triggerEntries.map((item) => (
                    <Card key={item.id} className="p-6 glass-card-independent flex flex-col gap-3 hover:border-indigo-400/50 transition-all">
                      <div className="flex items-center justify-between text-xs text-textSecondary border-b border-border pb-2.5">
                        <div className="flex items-center gap-3">
                          <span className="font-bold flex items-center gap-1">
                            <FontAwesomeIcon icon={faCalendarDay} className="text-primary" />
                            {item.date}
                          </span>
                          <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                            Intensity: {item.intensity || 3}/5
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEdit(item)} className="hover:text-primary font-semibold flex items-center gap-1">
                            <FontAwesomeIcon icon={faPen} /> Edit
                          </button>
                          <button onClick={() => setDeleteId(item.id)} className="hover:text-red-500 font-semibold flex items-center gap-1">
                            <FontAwesomeIcon icon={faTrash} /> Delete
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-1">
                        <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/15">
                          <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block mb-1">
                            ⚡ Possible Trigger
                          </span>
                          <p className="text-xs font-medium text-textPrimary leading-relaxed">{item.trigger || item.text}</p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/15">
                          <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider block mb-1">
                            💭 Your Response
                          </span>
                          <p className="text-xs font-medium text-textPrimary leading-relaxed">{item.response || "Recorded response"}</p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/15">
                          <span className="text-[10px] font-extrabold text-rose-700 dark:text-rose-300 uppercase tracking-wider block mb-1">
                            🌊 Impact on Life
                          </span>
                          <p className="text-xs font-medium text-textPrimary leading-relaxed">{item.life_effect || "Recorded impact"}</p>
                        </div>
                        {item.next_time_help && (
                          <div className="sm:col-span-3 p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                            <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block mb-1">
                              💡 What Might Help Next Time
                            </span>
                            <p className="text-xs font-medium text-textPrimary leading-relaxed">{item.next_time_help}</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* ============================================================ */}
            {/* 6. TRIGGER PATTERN INSIGHTS ("Your Patterns")                */}
            {/* ============================================================ */}
            <section className="flex flex-col gap-6 mt-4 p-6 sm:p-8 rounded-3xl glass-card-independent border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-slate-500/5">
              <div>
                <h2 className="text-2xl font-bold font-heading text-textPrimary flex items-center gap-2.5">
                  <FontAwesomeIcon icon={faChartLine} className="text-indigo-600" />
                  <span>Your Patterns</span>
                </h2>
                <p className="text-xs text-textSecondary mt-0.5">
                  Notice patterns in your experiences over time based on your saved Trigger Worksheets.
                </p>
              </div>

              {triggerEntries.length < 1 ? (
                <div className="p-6 rounded-2xl bg-white/60 dark:bg-card border border-indigo-500/15 text-center">
                  <p className="text-xs font-semibold text-textSecondary">Not enough data yet</p>
                  <p className="text-[11px] text-textSecondary mt-0.5">Complete a few Trigger Reflections above to view your self-reported patterns.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* METRIC CARDS */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl glass-card-independent border border-indigo-500/20 flex flex-col gap-1">
                      <span className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Total Reflections</span>
                      <span className="text-3xl font-black text-textPrimary">{totalTriggerCount}</span>
                      <span className="text-[10px] text-textSecondary">Recorded trigger logs</span>
                    </div>

                    <div className="p-5 rounded-2xl glass-card-independent border border-amber-500/20 flex flex-col gap-1">
                      <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Avg. Intensity</span>
                      <span className="text-3xl font-black text-textPrimary">{avgIntensity} <span className="text-sm font-semibold opacity-70">/ 5</span></span>
                      <span className="text-[10px] text-textSecondary">Self-reported average intensity</span>
                    </div>

                    <div className="p-5 rounded-2xl glass-card-independent border border-purple-500/20 flex flex-col gap-1">
                      <span className="text-[11px] font-extrabold text-purple-700 dark:text-purple-300 uppercase tracking-wider">This Week</span>
                      <span className="text-3xl font-black text-textPrimary">{thisWeekTriggerCount}</span>
                      <span className="text-[10px] text-textSecondary">Reflections in last 7 days</span>
                    </div>
                  </div>

                  {/* VISUALIZATION CHARTS SIDE-BY-SIDE */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* CHART A: TRIGGER REFLECTIONS OVER TIME */}
                    <div className="p-5 rounded-2xl glass-card-independent border border-indigo-500/20 flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-textPrimary flex items-center justify-between">
                        <span>Trigger Reflections Over Time</span>
                        <span className="text-[10px] text-textSecondary font-normal">Count per log</span>
                      </h3>
                      {/* Lightweight SVG Bar Chart */}
                      <div className="h-40 w-full flex items-end justify-around gap-2 border-b border-indigo-500/20 pb-2 pt-4 px-2">
                        {triggerEntries.slice(-6).map((item, idx) => {
                          const barHeight = Math.min(Math.max((item.intensity || 3) * 20, 25), 100);
                          return (
                            <div key={item.id || idx} className="flex flex-col items-center gap-1 w-full max-w-[40px]">
                              <div
                                style={{ height: `${barHeight}%` }}
                                className="w-full bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t-lg transition-all duration-300 hover:brightness-110"
                                title={`Date: ${item.date} | Intensity: ${item.intensity || 3}/5`}
                              />
                              <span className="text-[9px] font-medium text-textSecondary truncate max-w-full">{item.date.slice(0, 6)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* CHART B: INTENSITY TREND */}
                    <div className="p-5 rounded-2xl glass-card-independent border border-amber-500/20 flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-textPrimary flex items-center justify-between">
                        <span>Self-Reported Intensity</span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          1 (Mild) – 5 (High)
                        </span>
                      </h3>
                      {/* Lightweight SVG Line Trend */}
                      <div className="h-40 w-full relative flex items-center justify-center border-b border-amber-500/20 pb-2">
                        <svg viewBox="0 0 300 120" className="w-full h-full overflow-visible">
                          {/* Y-axis guidelines */}
                          <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(245, 158, 11, 0.15)" strokeDasharray="3 3" />
                          <line x1="0" y1="60" x2="300" y2="60" stroke="rgba(245, 158, 11, 0.15)" strokeDasharray="3 3" />
                          <line x1="0" y1="100" x2="300" y2="100" stroke="rgba(245, 158, 11, 0.15)" strokeDasharray="3 3" />

                          {/* Data points line */}
                          {(() => {
                            const recent = triggerEntries.slice(-5);
                            if (recent.length === 0) return null;
                            const points = recent.map((item, i) => {
                              const x = (i / Math.max(recent.length - 1, 1)) * 280 + 10;
                              const y = 110 - ((item.intensity || 3) / 5) * 90;
                              return { x, y, val: item.intensity || 3, date: item.date };
                            });

                            const polylineStr = points.map((p) => `${p.x},${p.y}`).join(" ");

                            return (
                              <g>
                                <polyline fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={polylineStr} />
                                {points.map((p, idx) => (
                                  <g key={idx}>
                                    <circle cx={p.x} cy={p.y} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                                    <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="800" fill="#f59e0b">{p.val}</text>
                                  </g>
                                ))}
                              </g>
                            );
                          })()}
                        </svg>
                      </div>
                      <p className="text-[10px] text-textSecondary italic text-center">Your self-reported intensity levels over time.</p>
                    </div>

                  </div>

                  {/* FACTUAL RECURRING PATTERNS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* RECURRING TRIGGERS */}
                    <div className="p-5 rounded-2xl glass-card-independent border border-indigo-500/20">
                      <h3 className="text-sm font-bold text-textPrimary mb-3">Recent Triggers Recorded</h3>
                      {sortedTriggers.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {sortedTriggers.map(([trig, count]) => (
                            <div key={trig} className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs">
                              <span className="font-semibold text-textPrimary truncate">{trig}</span>
                              <span className="font-extrabold text-indigo-700 dark:text-indigo-300 shrink-0 ml-2">{count} record{count > 1 ? "s" : ""}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-textSecondary">No trigger topics recorded yet.</p>
                      )}
                    </div>

                    {/* RESPONSES RECORDED MOST OFTEN */}
                    <div className="p-5 rounded-2xl glass-card-independent border border-purple-500/20">
                      <h3 className="text-sm font-bold text-textPrimary mb-3">Responses You've Recorded</h3>
                      {responseList.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {responseList.map((resp, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-purple-500/5 border border-purple-500/10 text-xs text-textPrimary truncate font-medium">
                              "{resp}"
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-textSecondary">No response entries recorded yet.</p>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </section>
          </div>
        )}

      </div>

      {/* 5. DELETE CONFIRMATION MODAL */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs px-4">
          <div className="bg-white dark:bg-card rounded-3xl shadow-2xl p-6 sm:p-7 w-full max-w-md border border-purple-500/20">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center text-2xl shadow-inner">
                <FontAwesomeIcon icon={faTriangleExclamation} />
              </div>
            </div>

            <h3 className="text-xl font-bold text-center text-textPrimary">
              Delete this entry?
            </h3>
            <p className="text-xs text-textSecondary text-center mt-2 leading-relaxed">
              Are you sure you want to delete this journal entry? This action cannot be undone.
            </p>

            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => setDeleteId(null)}
                className="px-5 py-2.5 rounded-xl border border-border text-textSecondary font-bold text-xs hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow-md transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Journal;