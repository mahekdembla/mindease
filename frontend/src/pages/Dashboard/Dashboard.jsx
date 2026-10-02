import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faComments,
  faBook,
  faWind,
  faChartLine,
  faLightbulb,
  faCalendarCheck,
  faArrowRight,
  faHeart,
  faLeaf
} from "@fortawesome/free-solid-svg-icons";
import { fetchDashboard, saveMoodCheckin } from "../../services/api";
import FeelingWheel, { FEELING_WHEEL_DATA } from "../../components/FeelingWheel";

function Dashboard() {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Feeling Wheel Interactive State
  const [selectedCore, setSelectedCore] = useState(null);
  const [selectedSpecific, setSelectedSpecific] = useState(null);
  const [selectedGranular, setSelectedGranular] = useState(null);
  const [savingCheckin, setSavingCheckin] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await fetchDashboard();
        setDashboardData(data);
        if (data.latest_checkin) {
          const coreMatch = FEELING_WHEEL_DATA.find(c => c.core === data.latest_checkin.core_emotion);
          if (coreMatch) {
            setSelectedCore(coreMatch);
            if (data.latest_checkin.specific_feeling) {
              const specMatch = coreMatch.specifics.find(s => s.name === data.latest_checkin.specific_feeling);
              if (specMatch) setSelectedSpecific(specMatch);
            }
            if (data.latest_checkin.granular_feeling) {
              setSelectedGranular(data.latest_checkin.granular_feeling);
            }
          }
        }
      } catch (err) {
        console.error("Dashboard data load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const handleSelectCore = (coreObj) => {
    setSelectedCore(coreObj);
    setSelectedSpecific(null);
    setSelectedGranular(null);
    triggerCheckinSave(coreObj.core, null, null);
  };

  const handleSelectSpecific = (specificObj) => {
    setSelectedSpecific(specificObj);
    setSelectedGranular(null);
    triggerCheckinSave(selectedCore?.core, specificObj.name, null);
  };

  const handleSelectGranular = (granularName) => {
    setSelectedGranular(granularName);
    triggerCheckinSave(selectedCore?.core, selectedSpecific?.name, granularName);
  };

  const triggerCheckinSave = async (core, spec, gran) => {
    setSavingCheckin(true);
    try {
      await saveMoodCheckin(core, spec, gran);
      // Refresh timeline silently to update journey and context
      const updated = await fetchDashboard();
      setDashboardData(updated);
    } catch (e) {
      console.error("Check-in save error:", e);
    } finally {
      setSavingCheckin(false);
    }
  };

  // Dynamic Greeting by Hour
  const getGreetingText = () => {
    const hour = new Date().getHours();
    const name = dashboardData?.first_name || "Friend";
    if (hour >= 5 && hour < 12) return { text: `Good Morning, ${name}!`, emoji: "☀️" };
    if (hour >= 12 && hour < 17) return { text: `Good Afternoon, ${name}!`, emoji: "☀️" };
    if (hour >= 17 && hour < 22) return { text: `Good Evening, ${name}!`, emoji: "👋" };
    return { text: `Good Night, ${name}!`, emoji: "🌙" };
  };

  const greetingObj = getGreetingText();

  return (
    <div className="relative p-6 sm:p-8 max-w-5xl mx-auto w-full flex flex-col gap-8 overflow-hidden">


      {/* BACKGROUND BOTANICAL LEAF DECORATIONS (SUBTLE TOP-RIGHT ATMOSPHERE) */}
      <div className="absolute top-2 right-4 pointer-events-none opacity-25 z-0 select-none hidden sm:block">
        <svg width="240" height="240" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M40,160 C70,120 120,90 180,60 C140,110 100,150 40,160 Z" fill="#9333ea" />
          <path d="M90,130 C110,90 140,70 190,40 C160,80 130,110 90,130 Z" fill="#c084fc" />
          <path d="M30,110 C60,80 100,60 150,30 C120,70 80,100 30,110 Z" fill="#a855f7" />
        </svg>
      </div>

      {/* 1. GREETING HEADER */}
      <header className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-heading text-textPrimary flex items-center gap-3">
            <span>{greetingObj.text}</span>
            <span>{greetingObj.emoji}</span>
          </h1>
          <p className="text-textSecondary mt-1 text-base">
            Let's check in with yourself. MindEase is here to support you.
          </p>
        </div>

        {/* RIGHT DECORATIVE BADGE (Small Steps Brighter Days) */}
        <div className="self-start sm:self-auto p-3.5 px-5 rounded-2xl glass-card-independent border border-purple-500/25 flex items-center gap-3 shadow-xs">
          <div className="text-right">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 leading-tight">
              Small Steps
            </p>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 leading-tight">
              Brighter Days 💜
            </p>
          </div>
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-300 flex items-center justify-center text-sm shadow-inner">
            <FontAwesomeIcon icon={faLeaf} />
          </div>
        </div>
      </header>

      {/* 2. DYNAMIC EVENT-DRIVEN DAILY REMINDER */}
      <section className="relative z-10 overflow-hidden glass-card-independent p-6 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-violet-500/10 border border-purple-500/25 shadow-sm transition-all duration-300">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 text-xl font-bold shadow-inner">
            <FontAwesomeIcon icon={faLightbulb} />
          </div>
          <div className="flex-1 reminder-reveal" key={dashboardData?.daily_reminder?.message}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-500/15 px-3 py-0.5 rounded-full border border-purple-500/20">
                DAILY REMINDER
              </span>
              <span className="text-[11px] font-medium text-purple-600 dark:text-purple-300 bg-white/60 dark:bg-card px-2.5 py-0.5 rounded-full border border-purple-300/30">
                {dashboardData?.daily_reminder?.category_pill || "Daily Reminder"}
              </span>
            </div>
            <p className="text-lg font-medium text-textPrimary leading-relaxed">
              {dashboardData?.daily_reminder?.message || "Take a moment to breathe deeply and check in with yourself. Small steps matter 💜"}
            </p>
          </div>
        </div>
      </section>

      {/* 3. RADIAL FEELING WHEEL & WEEKLY VIEW (SIDE-BY-SIDE) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* RADIAL FEELING WHEEL COMPONENT */}
        <div className="lg:col-span-7">
          <FeelingWheel
            selectedCore={selectedCore}
            selectedSpecific={selectedSpecific}
            selectedGranular={selectedGranular}
            onSelectCore={handleSelectCore}
            onSelectSpecific={handleSelectSpecific}
            onSelectGranular={handleSelectGranular}
            onNavigate={(path) => navigate(path)}
            savingCheckin={savingCheckin}
          />
        </div>

        {/* WEEKLY EMOTIONAL CHECK-IN VIEW (INLINE COMPACT CARD) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4 p-5 sm:p-6 glass-card-independent h-full">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-bold text-textPrimary">Weekly View</h2>
              <button
                onClick={() => navigate('/insights')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Full Insights</span>
                <FontAwesomeIcon icon={faArrowRight} />
              </button>
            </div>

            <p className="text-xs text-textSecondary mb-4">
              Real-time weekly tracking synced directly with your Feeling Wheel check-ins
            </p>

            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {dashboardData?.weekly_timeline?.map((item) => (
                <div
                  key={item.day}
                  className={`
                    flex flex-col items-center p-2 rounded-2xl border text-center transition-all duration-200
                    ${item.is_today ? "border-purple-500 ring-2 ring-purple-500/20 bg-purple-50 dark:bg-purple-950/40 shadow-xs" : "border-border bg-white/60 dark:bg-card"}
                    ${item.has_activity ? "hover:border-purple-400 hover:scale-105 cursor-pointer" : "opacity-70"}
                  `}
                >
                  <span className="text-[10px] font-semibold text-textSecondary uppercase tracking-wider">{item.day}</span>
                  <span className="text-2xl my-2">{item.emoji}</span>
                  <span className="text-[10px] font-medium text-textPrimary truncate w-full">{item.emotion}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Summary Banner */}
          <div className="p-3.5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200/80 flex items-center justify-between mt-2">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faCalendarCheck} className="text-purple-600 text-lg shrink-0" />
              <div>
                <p className="text-xs font-bold text-purple-900 dark:text-purple-200">Weekly Check-in Rhythm</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {dashboardData?.activity_counts?.checkins > 0
                    ? `${dashboardData.activity_counts.checkins} Feeling Wheel check-in${dashboardData.activity_counts.checkins > 1 ? 's' : ''} recorded this week`
                    : "No check-ins yet this week. Tap any feeling on the wheel to start!"}
                </p>
              </div>
            </div>
          </div>
        </div>


      </div>

      {/* 4. WHAT WOULD YOU LIKE TO DO? */}
      <section className="relative z-10 flex flex-col gap-5">
        <div>
          <h2 className="text-2xl font-bold text-textPrimary">What Would You Like to Do?</h2>
          <p className="text-sm text-textSecondary mt-0.5">
            Choose a space that feels right for you
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Journal */}
          <div
            onClick={() => navigate('/journal')}
            className="p-6 glass-card-independent flex flex-col justify-between cursor-pointer group hover:-translate-y-1.5 transition-all duration-300"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                <FontAwesomeIcon icon={faBook} />
              </div>
              <h3 className="font-bold text-textPrimary text-base mb-1 group-hover:text-primary transition-colors">
                Journal
              </h3>
              <p className="text-xs text-textSecondary leading-relaxed">
                Put your thoughts into words
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
              <span>Open Journal</span>
              <FontAwesomeIcon icon={faArrowRight} className="ml-1.5" />
            </div>
          </div>

          {/* Card 2: Talk to MindEase */}
          <div
            onClick={() => navigate('/support')}
            className="p-6 glass-card-independent flex flex-col justify-between cursor-pointer group hover:-translate-y-1.5 transition-all duration-300"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                <FontAwesomeIcon icon={faComments} />
              </div>
              <h3 className="font-bold text-textPrimary text-base mb-1 group-hover:text-primary transition-colors">
                Talk to MindEase
              </h3>
              <p className="text-xs text-textSecondary leading-relaxed">
                Get support and guidance
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
              <span>Start Session</span>
              <FontAwesomeIcon icon={faArrowRight} className="ml-1.5" />
            </div>
          </div>

          {/* Card 3: Healing Space */}
          <div
            onClick={() => navigate('/safeplace')}
            className="p-6 glass-card-independent flex flex-col justify-between cursor-pointer group hover:-translate-y-1.5 transition-all duration-300"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                <FontAwesomeIcon icon={faWind} />
              </div>
              <h3 className="font-bold text-textPrimary text-base mb-1 group-hover:text-primary transition-colors">
                Healing Space
              </h3>
              <p className="text-xs text-textSecondary leading-relaxed">
                Take a calming break
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
              <span>Enter Space</span>
              <FontAwesomeIcon icon={faArrowRight} className="ml-1.5" />
            </div>
          </div>

          {/* Card 4: View Insights */}
          <div
            onClick={() => navigate('/insights')}
            className="p-6 glass-card-independent flex flex-col justify-between cursor-pointer group hover:-translate-y-1.5 transition-all duration-300"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                <FontAwesomeIcon icon={faChartLine} />
              </div>
              <h3 className="font-bold text-textPrimary text-base mb-1 group-hover:text-primary transition-colors">
                View Insights
              </h3>
              <p className="text-xs text-textSecondary leading-relaxed">
                Explore your patterns
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
              <span>View Patterns</span>
              <FontAwesomeIcon icon={faArrowRight} className="ml-1.5" />
            </div>
          </div>
        </div>
      </section>

      {/* 5. YOUR MINDEASE JOURNEY */}
      <section className="relative z-10 flex flex-col gap-5">
        <div>
          <h2 className="text-2xl font-bold text-textPrimary">Your MindEase Journey</h2>
          <p className="text-sm text-textSecondary mt-0.5">
            A gentle view of your recent activity
          </p>
        </div>

        {dashboardData?.journey_activities && dashboardData.journey_activities.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboardData.journey_activities.map((item) => (
              <div
                key={item.id}
                className="p-5 glass-card-independent flex items-start gap-4 transition-all duration-300 hover:-translate-y-1 hover:border-purple-400/60"
              >
                <div className="w-11 h-11 rounded-2xl bg-purple-500/15 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xl shrink-0 shadow-inner">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-extrabold text-purple-700 dark:text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md uppercase tracking-wider inline-block mb-1">
                    {item.title}
                  </span>
                  <h3 className="font-bold text-textPrimary text-sm truncate mb-1">
                    {item.subtitle}
                  </h3>
                  <span className="text-xs text-textSecondary font-medium block">
                    {item.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 glass-card-independent text-center flex flex-col items-center gap-3">
            <span className="text-3xl">🌱</span>
            <p className="text-sm font-semibold text-textPrimary">Your journey is just beginning</p>
            <p className="text-xs text-textSecondary max-w-md">
              Complete a Feeling Wheel check-in, write a journal entry, or talk to MindEase to see your reflections here.
            </p>
          </div>
        )}
      </section>

      {/* 6. A MOMENT TO NOTICE */}
      <section className="relative z-10 p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-violet-500/10 border border-purple-500/25 flex items-center gap-4 transition-all duration-300 shadow-xs">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center text-lg shrink-0">
          <FontAwesomeIcon icon={faHeart} />
        </div>
        <div>
          <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider block mb-0.5">
            A Moment to Notice
          </span>
          <p className="text-sm font-medium text-textPrimary">
            {dashboardData?.a_moment_to_notice || "Taking a moment to check in with yourself builds a gentle rhythm of self-care."}
          </p>
        </div>
      </section>

    </div>
  );
}

export default Dashboard;