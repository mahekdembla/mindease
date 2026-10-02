import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComments, faBook, faWind, faCheckCircle } from "@fortawesome/free-solid-svg-icons";

// Authoritative 5-Core Feeling Wheel Taxonomy
export const FEELING_WHEEL_DATA = [
  {
    core: "Calm",
    color: "#059669", // Rich Teal/Emerald
    activeColor: "#047857",
    bgClass: "emerald",
    emoji: "😌",
    specifics: [
      { name: "Peaceful", granular: ["Serene", "Relaxed", "Safe"] },
      { name: "Grounded", granular: ["Present", "Comfortable", "Trusting"] },
      { name: "Caring", granular: ["Content", "Loving", "Inspired"] }
    ]
  },
  {
    core: "Happy",
    color: "#d97706", // Rich Amber/Gold
    activeColor: "#b45309",
    bgClass: "amber",
    emoji: "😊",
    specifics: [
      { name: "Joyful", granular: ["Excited", "Optimistic", "Enthusiastic"] },
      { name: "Strong", granular: ["Inspired", "Confident", "Proud"] },
      { name: "Cheerful", granular: ["Creative", "Amused", "Delighted"] }
    ]
  },
  {
    core: "Sad",
    color: "#2563eb", // Rich Royal Blue
    activeColor: "#1d4ed8",
    bgClass: "blue",
    emoji: "😢",
    specifics: [
      { name: "Lonely", granular: ["Bored", "Tired", "Desolate"] },
      { name: "Depressed", granular: ["Hopeless", "Stupid", "Miserable"] },
      { name: "Ashamed", granular: ["Guilty", "Hurt", "Inadequate"] }
    ]
  },
  {
    core: "Angry",
    color: "#dc2626", // Rich Coral Red
    activeColor: "#b91c1c",
    bgClass: "rose",
    emoji: "😠",
    specifics: [
      { name: "Mad", granular: ["Hostile", "Defensive", "Sarcastic"] },
      { name: "Frustrated", granular: ["Annoyed", "Jealous", "Selfish"] },
      { name: "Critical", granular: ["Hateful", "Rejected", "Skeptical"] }
    ]
  },
  {
    core: "Fearful",
    color: "#9333ea", // Rich Deep Purple
    activeColor: "#7e22ce",
    bgClass: "purple",
    emoji: "😟",
    specifics: [
      { name: "Scared", granular: ["Helpless", "Baffled", "Insecure"] },
      { name: "Anxious", granular: ["Worried", "Overwhelmed", "Nervous"] },
      { name: "Confused", granular: ["Vulnerable", "Doubtful", "Hesitant"] }
    ]
  }
];

// SVG Helper Functions for Donut Sector Arcs
function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function describeArc(x, y, innerRadius, outerRadius, startAngle, endAngle) {
  const angleDelta = endAngle - startAngle;
  const effectiveEnd = angleDelta >= 360 ? startAngle + 359.99 : endAngle;

  const startOuter = polarToCartesian(x, y, outerRadius, effectiveEnd);
  const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
  const startInner = polarToCartesian(x, y, innerRadius, effectiveEnd);
  const endInner = polarToCartesian(x, y, innerRadius, startAngle);

  const largeArcFlag = angleDelta <= 180 ? "0" : "1";

  return [
    "M", startOuter.x, startOuter.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 0, endOuter.x, endOuter.y,
    "L", endInner.x, endInner.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, startInner.x, startInner.y,
    "Z"
  ].join(" ");
}

export default function FeelingWheel({
  selectedCore,
  selectedSpecific,
  selectedGranular,
  onSelectCore,
  onSelectSpecific,
  onSelectGranular,
  onNavigate,
  savingCheckin
}) {
  const [hoveredSlice, setHoveredSlice] = useState(null);

  const cx = 250;
  const cy = 250;

  // Concentric Ring Radii
  const rCoreInner = 54;
  const rCoreOuter = 114;

  const rSpecInner = 118;
  const rSpecOuter = 176;

  const rGranInner = 180;
  const rGranOuter = 238;

  const coreAngleStep = 360 / FEELING_WHEEL_DATA.length; // 72° per core

  // Current active label string
  const activeLabel = selectedGranular
    ? selectedGranular
    : selectedSpecific
      ? selectedSpecific.name
      : selectedCore
        ? selectedCore.core
        : null;

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-7 glass-card-independent transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-textPrimary">Feeling Wheel Check-in</h2>
          <p className="text-sm text-textSecondary">
            Click segments to move from core emotion → specific → granular feeling
          </p>
        </div>
        {savingCheckin ? (
          <span className="text-xs text-primary animate-pulse font-semibold flex items-center gap-1.5 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            Saving...
          </span>
        ) : activeLabel ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
            <FontAwesomeIcon icon={faCheckCircle} />
            Checked In
          </span>
        ) : null}
      </div>

      {/* Interactive Radial SVG Wheel */}
      <div className="relative w-full max-w-[420px] mx-auto aspect-square flex items-center justify-center select-none">
        <svg
          viewBox="0 0 500 500"
          className="w-full h-full drop-shadow-md overflow-visible"
          role="region"
          aria-label="3-Level Interactive Radial Feeling Wheel"
        >
          <defs>
            {/* Soft Ambient Radial Blur Glow for Center Hub */}
            <filter id="centerGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* BACKGROUND GUIDELINE CIRCLES */}
          <circle cx={cx} cy={cy} r={rGranOuter} fill="none" stroke="rgba(216, 180, 254, 0.25)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={rSpecOuter} fill="none" stroke="rgba(216, 180, 254, 0.3)" strokeWidth="1" />
          <circle cx={cx} cy={cy} r={rCoreOuter} fill="none" stroke="rgba(216, 180, 254, 0.35)" strokeWidth="1" />

          {/* RENDER ALL 3 CONCENTRIC RINGS */}
          {FEELING_WHEEL_DATA.map((coreObj, coreIdx) => {
            const coreStartAngle = coreIdx * coreAngleStep;
            const coreEndAngle = coreStartAngle + coreAngleStep;
            const coreMidAngle = (coreStartAngle + coreEndAngle) / 2;

            const isCoreSelected = selectedCore?.core === coreObj.core;
            const isCoreHovered = hoveredSlice?.type === "core" && hoveredSlice?.key === coreObj.core;
            const specCount = coreObj.specifics.length;
            const specAngleStep = coreAngleStep / specCount; // 24° per specific

            return (
              <g key={coreObj.core} className="wheel-branch-group">
                {/* 1. CORE EMOTION SLICE (INNER RING) */}
                {(() => {
                  const pathD = describeArc(cx, cy, rCoreInner, rCoreOuter, coreStartAngle, coreEndAngle);
                  const textPos = polarToCartesian(cx, cy, (rCoreInner + rCoreOuter) / 2, coreMidAngle);
                  const isDimmed = selectedCore && !isCoreSelected;

                  return (
                    <g
                      role="button"
                      tabIndex={0}
                      aria-label={`Core emotion: ${coreObj.core}`}
                      onClick={() => onSelectCore(coreObj)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectCore(coreObj);
                        }
                      }}
                      onMouseEnter={() => setHoveredSlice({ type: "core", key: coreObj.core })}
                      onMouseLeave={() => setHoveredSlice(null)}
                      className="cursor-pointer transition-all duration-300 focus:outline-none"
                    >
                      <path
                        d={pathD}
                        fill={coreObj.color}
                        fillOpacity={isCoreSelected ? 0.95 : isCoreHovered ? 0.85 : isDimmed ? 0.45 : 0.75}
                        stroke={isCoreSelected ? "#ffffff" : "rgba(255,255,255,0.7)"}
                        strokeWidth={isCoreSelected ? 3 : 1.5}
                        className="transition-all duration-300 hover:brightness-110"
                      />
                      {/* Label & Emoji */}
                      <text
                        x={textPos.x}
                        y={textPos.y - 6}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        fontSize="13"
                        fontWeight="800"
                        className="pointer-events-none"
                      >
                        {coreObj.emoji}
                      </text>
                      <text
                        x={textPos.x}
                        y={textPos.y + 9}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="800"
                        className="pointer-events-none tracking-wide"
                      >
                        {coreObj.core}
                      </text>
                    </g>
                  );
                })()}

                {/* 2. SPECIFIC EMOTION SLICES (MIDDLE RING) */}
                {coreObj.specifics.map((specObj, specIdx) => {
                  const specStartAngle = coreStartAngle + specIdx * specAngleStep;
                  const specEndAngle = specStartAngle + specAngleStep;
                  const specMidAngle = (specStartAngle + specEndAngle) / 2;

                  const isSpecSelected = selectedSpecific?.name === specObj.name;
                  const isSpecHovered = hoveredSlice?.type === "spec" && hoveredSlice?.key === specObj.name;
                  const isBranchActive = isCoreSelected;
                  const isDimmed = (selectedCore && !isCoreSelected) || (selectedSpecific && !isSpecSelected);

                  // Always render specific text labels visible even when not selected
                  const showSpecLabel = true;

                  const granCount = specObj.granular.length;
                  const granAngleStep = specAngleStep / granCount; // 8° per granular

                  const specPathD = describeArc(cx, cy, rSpecInner, rSpecOuter, specStartAngle, specEndAngle);
                  const specTextPos = polarToCartesian(cx, cy, (rSpecInner + rSpecOuter) / 2, specMidAngle);

                  return (
                    <g key={specObj.name}>
                      <g
                        role="button"
                        tabIndex={0}
                        aria-label={`Specific emotion: ${specObj.name}`}
                        onClick={() => {
                          if (!selectedCore || selectedCore.core !== coreObj.core) {
                            onSelectCore(coreObj);
                          }
                          onSelectSpecific(specObj);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (!selectedCore || selectedCore.core !== coreObj.core) {
                              onSelectCore(coreObj);
                            }
                            onSelectSpecific(specObj);
                          }
                        }}
                        onMouseEnter={() => setHoveredSlice({ type: "spec", key: specObj.name })}
                        onMouseLeave={() => setHoveredSlice(null)}
                        className="cursor-pointer transition-all duration-300 focus:outline-none"
                      >
                        <title>{specObj.name} ({coreObj.core})</title>
                        <path
                          d={specPathD}
                          fill={coreObj.color}
                          fillOpacity={
                            isSpecSelected
                              ? 0.95
                              : isSpecHovered
                                ? 0.85
                                : isBranchActive
                                  ? 0.7
                                  : isDimmed
                                    ? 0.35
                                    : 0.55
                          }
                          stroke={isSpecSelected ? "#ffffff" : "rgba(255,255,255,0.6)"}
                          strokeWidth={isSpecSelected ? 2.5 : 1}
                          className="transition-all duration-300 hover:brightness-110"
                        />
                        {showSpecLabel && (
                          <text
                            x={specTextPos.x}
                            y={specTextPos.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#ffffff"
                            fontSize={isSpecSelected ? "10.5" : "9.5"}
                            fontWeight={isSpecSelected ? "800" : "700"}
                            className="pointer-events-none select-none transition-opacity duration-300"
                            transform={`rotate(${specMidAngle > 90 && specMidAngle < 270 ? specMidAngle + 180 : specMidAngle}, ${specTextPos.x}, ${specTextPos.y})`}
                          >
                            {specObj.name}
                          </text>
                        )}
                      </g>

                      {/* 3. GRANULAR EMOTION SLICES (OUTER RING) */}
                      {specObj.granular.map((granName, granIdx) => {
                        const granStartAngle = specStartAngle + granIdx * granAngleStep;
                        const granEndAngle = granStartAngle + granAngleStep;
                        const granMidAngle = (granStartAngle + granEndAngle) / 2;

                        const isGranSelected = selectedGranular === granName;
                        const isGranHovered = hoveredSlice?.type === "gran" && hoveredSlice?.key === granName;
                        const isGranActiveBranch = isSpecSelected;
                        const isGranDimmed = selectedGranular && !isGranSelected;

                        // Always render outer granular text labels visible even when not selected
                        const showGranLabel = true;

                        const granPathD = describeArc(cx, cy, rGranInner, rGranOuter, granStartAngle, granEndAngle);
                        const granTextPos = polarToCartesian(cx, cy, (rGranInner + rGranOuter) / 2, granMidAngle);

                        const textRotationAngle = granMidAngle > 180 ? granMidAngle + 90 : granMidAngle - 90;

                        return (
                          <g
                            key={granName}
                            role="button"
                            tabIndex={0}
                            aria-label={`Granular emotion: ${granName}`}
                            onClick={() => {
                              if (!selectedCore || selectedCore.core !== coreObj.core) {
                                onSelectCore(coreObj);
                              }
                              if (!selectedSpecific || selectedSpecific.name !== specObj.name) {
                                onSelectSpecific(specObj);
                              }
                              onSelectGranular(granName);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                if (!selectedCore || selectedCore.core !== coreObj.core) {
                                  onSelectCore(coreObj);
                                }
                                if (!selectedSpecific || selectedSpecific.name !== specObj.name) {
                                  onSelectSpecific(specObj);
                                }
                                onSelectGranular(granName);
                              }
                            }}
                            onMouseEnter={() => setHoveredSlice({ type: "gran", key: granName })}
                            onMouseLeave={() => setHoveredSlice(null)}
                            className="cursor-pointer transition-all duration-300 focus:outline-none"
                          >
                            <title>{granName} ({specObj.name} → {coreObj.core})</title>
                            <path
                              d={granPathD}
                              fill={coreObj.color}
                              fillOpacity={
                                isGranSelected
                                  ? 1
                                  : isGranHovered
                                    ? 0.9
                                    : isGranActiveBranch
                                      ? 0.75
                                      : isGranDimmed
                                        ? 0.25
                                        : 0.45
                              }
                              stroke={isGranSelected ? "#ffffff" : "rgba(255,255,255,0.6)"}
                              strokeWidth={isGranSelected ? 2.5 : 0.8}
                              className="transition-all duration-300 hover:brightness-110"
                            />
                            {showGranLabel && (
                              <text
                                x={granTextPos.x}
                                y={granTextPos.y}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="#ffffff"
                                fontSize={isGranSelected ? "9.5" : "8"}
                                fontWeight={isGranSelected ? "800" : "700"}
                                className="pointer-events-none select-none transition-opacity duration-300"
                                transform={`rotate(${textRotationAngle}, ${granTextPos.x}, ${granTextPos.y})`}
                              >
                                {granName}
                              </text>
                            )}
                          </g>
                        );
                      })}

                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* CENTER HUB (SELECTED STATE & PULSING GLOW) */}
          <g className="center-hub-group">
            {/* Outer Glow Halo Ring */}
            <circle
              cx={cx}
              cy={cy}
              r={rCoreInner - 2}
              fill={selectedCore ? selectedCore.color : "#9333ea"}
              fillOpacity={0.2}
              filter="url(#centerGlow)"
              className="feeling-wheel-pulse pointer-events-none"
            />
            {/* Main Center Circle */}
            <circle
              cx={cx}
              cy={cy}
              r={rCoreInner - 4}
              fill="rgba(255, 255, 255, 0.95)"
              stroke={selectedCore ? selectedCore.color : "rgba(216, 180, 254, 0.8)"}
              strokeWidth="3"
              className="drop-shadow-sm transition-all duration-300"
            />

            {/* Center Display Text */}
            {activeLabel ? (
              <g className="pointer-events-none">
                <text x={cx} y={cy - 16} textAnchor="middle" fontSize="20">
                  {selectedCore?.emoji || "💜"}
                </text>
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="800"
                  fill="#1E1B4B"
                  className="tracking-tight"
                >
                  {activeLabel}
                </text>
                <text x={cx} y={cy + 19} textAnchor="middle" fontSize="8" fontWeight="700" fill="#6B21A8">
                  {selectedGranular ? "Checked In 💜" : selectedSpecific ? "Select Granular" : "Select Specific"}
                </text>
              </g>
            ) : (
              <g className="pointer-events-none">
                <text x={cx} y={cy - 12} textAnchor="middle" fontSize="18">
                  🌱
                </text>
                <text x={cx} y={cy + 6} textAnchor="middle" fontSize="11" fontWeight="800" fill="#1E1B4B">
                  Select Emotion
                </text>
                <text x={cx} y={cy + 19} textAnchor="middle" fontSize="8" fontWeight="700" fill="#6B21A8">
                  Inner → Middle → Outer
                </text>
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* Immediate Contextual Action Buttons Below Wheel */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-violet-500/10 border border-purple-500/20 flex flex-col gap-3 transition-all duration-300">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-textPrimary">
            {activeLabel ? (
              <span>
                Selected: <strong className="text-primary font-bold">{activeLabel}</strong>
              </span>
            ) : (
              <span>How would you like to reflect on your feeling?</span>
            )}
          </p>
          <span className="text-[11px] text-purple-800 dark:text-purple-200 font-bold bg-purple-100/90 dark:bg-purple-900/60 px-2.5 py-0.5 rounded-full border border-purple-200/80">Immediate Support</span>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => onNavigate("/support")}
            className="px-3.5 py-2 rounded-xl bg-white/80 dark:bg-card border border-border text-textPrimary hover:border-primary text-xs font-medium transition-all hover:scale-102 shadow-xs flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faComments} className="text-primary" />
            <span>Talk to MindEase</span>
          </button>
          <button
            onClick={() => onNavigate("/journal")}
            className="px-3.5 py-2 rounded-xl bg-white/80 dark:bg-card border border-border text-textPrimary hover:border-primary text-xs font-medium transition-all hover:scale-102 shadow-xs flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faBook} className="text-primary" />
            <span>Journal it</span>
          </button>
          <button
            onClick={() => onNavigate("/safeplace")}
            className="px-3.5 py-2 rounded-xl bg-white/80 dark:bg-card border border-border text-textPrimary hover:border-primary text-xs font-medium transition-all hover:scale-102 shadow-xs flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faWind} className="text-primary" />
            <span>Try a reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
