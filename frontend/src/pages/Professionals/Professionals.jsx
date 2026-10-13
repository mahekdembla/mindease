import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserDoctor,
  faPhone,
  faCommentDots,
  faEnvelope,
  faClock,
  faLocationDot,
  faLanguage,
  faShieldHeart,
  faLocationCrosshairs,
  faRotate,
  faGlobe,
  faSpinner,
  faGraduationCap,
  faMagnifyingGlass,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { fetchNearbyProfessionals } from "../../services/api";
import { FALLBACK_PROFESSIONALS } from "../../data/professionals";
import CrisisModal from "../../components/common/CrisisModal";

const onlyDigits = (value) => (value || "").replace(/[^\d]/g, "");

const CHAT_INTRO =
  "Hello, I found you through MindEase and would like to book a consultation.";

function Professionals() {
  const [professionalsList, setProfessionalsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [userCoords, setUserCoords] = useState(null);
  const [userLocality, setUserLocality] = useState("Detecting...");
  const [locationSource, setLocationSource] = useState("gps");
  const [showCrisisModal, setShowCrisisModal] = useState(false);

  // Fetch professionals given user coords and optional search query
  const loadProfessionals = useCallback(async (coords, searchQuery = "") => {
    setLoading(true);

    try {
      const payload = {
        lat: coords ? coords.lat : null,
        lon: coords ? coords.lon : null,
        query: searchQuery.trim() || undefined,
        limit: 8,
      };

      const res = await fetchNearbyProfessionals(payload);
      const list = Array.isArray(res) ? res : res.professionals || res.data || [];
      setProfessionalsList(list.length > 0 ? list : FALLBACK_PROFESSIONALS);

      const resolvedUserLocality = res.user_location?.locality || res.location?.locality || "Mumbai";
      setUserLocality(resolvedUserLocality);
      setLocationSource(res.user_location?.source || res.location?.source || "gps");
    } catch (err) {
      console.warn("Failed to fetch professionals, using fallback:", err);
      setProfessionalsList(FALLBACK_PROFESSIONALS);
      setUserLocality("Chembur, Mumbai");
      setLocationSource("fallback");
    } finally {
      setLoading(false);
    }
  }, []);

  // W3C Geolocation on load
  const detectLiveLocation = useCallback(() => {
    setLoading(true);
    setUserLocality("Detecting exact device location...");

    if (!navigator.geolocation) {
      loadProfessionals(null, activeSearch);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setUserCoords(coords);
        loadProfessionals(coords, activeSearch);
      },
      (error) => {
        console.warn("Geolocation prompt error:", error);
        loadProfessionals(null, activeSearch);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      }
    );
  }, [loadProfessionals, activeSearch]);

  // Initial load
  useEffect(() => {
    detectLiveLocation();
  }, [detectLiveLocation]);

  // Handle Search Submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchInput.trim();
    setActiveSearch(query);
    loadProfessionals(userCoords, query);
  };

  // Clear Search
  const handleClearSearch = () => {
    setSearchInput("");
    setActiveSearch("");
    loadProfessionals(userCoords, "");
  };

  return (
    <div className="p-6 sm:p-8 w-full flex flex-col min-h-screen bg-background relative overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex items-center gap-3 mb-6">
          <FontAwesomeIcon icon={faUserDoctor} className="text-3xl text-purple-600" />
          <div>
            <h1 className="text-3xl font-heading font-bold text-textPrimary">Professional Help</h1>
            <p className="text-textSecondary">
              Talk to a licensed psychiatrist by phone or chat. Distances are calculated from your exact location.
            </p>
          </div>
        </div>

        {/* 24x7 Emergency Helplines Quick Banner */}
        <div className="mb-6 p-4 rounded-2xl border border-red-200 bg-red-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shrink-0">
              <FontAwesomeIcon icon={faPhone} />
            </div>
            <div>
              <div className="text-sm font-bold text-red-950 flex items-center gap-2">
                <span>In Crisis or Need Urgent Free Support?</span>
                <span className="text-[10px] font-bold uppercase bg-red-200 text-red-800 px-2 py-0.5 rounded-full">
                  24×7 Free
                </span>
              </div>
              <p className="text-xs text-red-700">
                Call TeleMANAS at <a href="tel:14416" className="font-extrabold underline">14416</a> / <a href="tel:18008914416" className="font-extrabold underline">1800-891-4416</a> or browse verified crisis helplines.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href="tel:14416"
              className="flex-1 sm:flex-none text-center text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl transition shadow-2xs"
            >
              Call 14416
            </a>
            <button
              onClick={() => setShowCrisisModal(true)}
              className="flex-1 sm:flex-none text-xs font-bold bg-white border border-red-300 hover:bg-red-100 text-red-800 px-4 py-2 rounded-xl transition cursor-pointer"
            >
              View All Helplines
            </button>
          </div>
        </div>

        {/* Exact Location Status Banner */}
        <div className="mb-4 p-4 rounded-2xl border border-border bg-card shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                locationSource === "gps"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              <FontAwesomeIcon
                icon={locationSource === "gps" ? faLocationCrosshairs : faGlobe}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-textPrimary">
                  {locationSource === "gps" ? "Your Location" : "IP Resolved Location"}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    locationSource === "gps"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  📍 {userLocality}
                </span>
              </div>
              <p className="text-xs text-textSecondary mt-0.5">
                {activeSearch ? (
                  <span>
                    Searching in <strong>"{activeSearch}"</strong> • All distances calculated from your exact location in{" "}
                    <strong>{userLocality}</strong>.
                  </span>
                ) : (
                  <span>
                    Showing psychiatrists nearest to your location, sorted strictly by physical distance.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {activeSearch && (
              <button
                onClick={handleClearSearch}
                className="text-xs font-semibold text-gray-600 hover:text-textPrimary px-2.5 py-1.5 rounded-xl border border-border hover:bg-gray-50 transition cursor-pointer flex items-center gap-1.5"
                title="Clear search filter"
              >
                <FontAwesomeIcon icon={faXmark} />
                <span>Clear Search</span>
              </button>
            )}
            <button
              onClick={detectLiveLocation}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-textPrimary px-3 py-1.5 rounded-xl transition cursor-pointer disabled:opacity-50"
              title="Re-detect GPS location"
            >
              <FontAwesomeIcon icon={faRotate} className={loading ? "animate-spin" : ""} />
              <span>{loading ? "Locating..." : "Re-detect GPS"}</span>
            </button>
          </div>
        </div>

        {/* Clean Search Option */}
        <form onSubmit={handleSearchSubmit} className="mb-6 flex items-center gap-2">
          <div className="relative flex-1">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search city, locality, or doctor (e.g. Pune, Chembur, Bandra)..."
              className="w-full pl-9 pr-9 py-2.5 text-xs rounded-xl border border-border bg-white text-textPrimary placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-2xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="text-xs font-bold bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl transition shadow-2xs cursor-pointer disabled:opacity-50 shrink-0"
          >
            Search
          </button>
        </form>

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="bg-card border border-border p-6 rounded-2xl flex flex-col gap-4 animate-pulse"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2 w-3/4">
                    <div className="h-5 bg-gray-200 rounded-md w-3/4"></div>
                    <div className="h-3.5 bg-gray-200 rounded-md w-1/2"></div>
                  </div>
                  <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
                </div>
                <div className="space-y-2 mt-2">
                  <div className="h-3.5 bg-gray-200 rounded-md w-5/6"></div>
                  <div className="h-3.5 bg-gray-200 rounded-md w-2/3"></div>
                  <div className="h-3.5 bg-gray-200 rounded-md w-1/2"></div>
                </div>
                <div className="flex gap-2 mt-auto pt-4 border-t border-border/50">
                  <div className="h-8 bg-gray-200 rounded-xl w-20"></div>
                  <div className="h-8 bg-gray-200 rounded-xl w-32"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Professional Cards Grid */}
        {!loading && professionalsList.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {professionalsList.map((p) => {
              const hasContact = p.phone || p.whatsapp || p.email;
              const hasDistance = p.distance_km !== undefined && p.distance_km !== null;

              return (
                <div
                  key={p.id}
                  className="bg-card border border-border p-6 rounded-2xl flex flex-col gap-4 hover:shadow-sm transition-all relative"
                >
                  {/* Card Header & Distance Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-textPrimary">{p.name}</h2>
                      </div>
                      <p className="text-sm text-primary font-medium">{p.title}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {hasDistance && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs">
                          <FontAwesomeIcon icon={faLocationDot} className="text-purple-600" />
                          <span>{p.distance_km} km away</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <FontAwesomeIcon icon={faShieldHeart} /> Verified
                      </span>
                    </div>
                  </div>

                  {/* Specialties & Tags */}
                  {p.specialties?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.specialties.map((spec, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-medium bg-gray-100 text-textSecondary px-2 py-0.5 rounded-md"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Clinic and Meta Information */}
                  <div className="space-y-2 text-sm text-textSecondary">
                    {p.clinic && (
                      <p className="font-semibold text-textPrimary text-xs flex items-center gap-1.5">
                        <span>🏥</span>
                        <span>{p.clinic}</span>
                      </p>
                    )}
                    {p.location && (
                      <p className="flex items-start gap-2">
                        <FontAwesomeIcon icon={faLocationDot} className="mt-0.5 text-primary shrink-0" />
                        <span className="font-medium text-textPrimary">{p.location}</span>
                      </p>
                    )}
                    {p.availability && (
                      <p className="flex items-start gap-2">
                        <FontAwesomeIcon icon={faClock} className="mt-0.5 text-primary shrink-0" />
                        <span>{p.availability}</span>
                      </p>
                    )}
                    {p.languages?.length > 0 && (
                      <p className="flex items-start gap-2">
                        <FontAwesomeIcon icon={faLanguage} className="mt-0.5 text-primary shrink-0" />
                        <span>{p.languages.join(", ")}</span>
                      </p>
                    )}
                    {p.experience_years && (
                      <p className="flex items-center gap-2 text-xs text-textSecondary">
                        <FontAwesomeIcon icon={faGraduationCap} className="text-primary shrink-0" />
                        <span>{p.experience_years} years clinical experience</span>
                      </p>
                    )}
                  </div>

                  {/* Actions & Contact CTAs */}
                  {hasContact ? (
                    <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-border/60">
                      {p.phone && (
                        <a
                          href={`tel:${p.phone}`}
                          className="flex items-center gap-2 text-xs font-semibold bg-primary text-white px-4 py-2 rounded-xl hover:opacity-90 transition shadow-2xs"
                        >
                          <FontAwesomeIcon icon={faPhone} /> Call Clinic
                        </a>
                      )}
                      {p.whatsapp && (
                        <a
                          href={`https://wa.me/${onlyDigits(p.whatsapp)}?text=${encodeURIComponent(
                            CHAT_INTRO
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs font-semibold text-primary bg-primaryLight border border-primary/40 px-4 py-2 rounded-xl hover:bg-primary hover:text-white transition"
                        >
                          <FontAwesomeIcon icon={faCommentDots} /> WhatsApp
                        </a>
                      )}
                      {p.email && (
                        <a
                          href={`mailto:${p.email}?subject=MindEase%20Consultation%20Inquiry`}
                          className="flex items-center gap-2 text-xs font-semibold text-textPrimary bg-white border border-border px-4 py-2 rounded-xl hover:bg-gray-50 transition"
                        >
                          <FontAwesomeIcon icon={faEnvelope} /> Email
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-textSecondary mt-auto pt-3 border-t border-border">
                      Contact details coming soon.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!loading && professionalsList.length === 0 && (
          <div className="p-8 text-center bg-card border border-border rounded-2xl">
            <FontAwesomeIcon icon={faUserDoctor} className="text-4xl text-purple-400 mb-3" />
            <h3 className="text-lg font-bold text-textPrimary">No psychiatrists found for "{activeSearch}"</h3>
            <p className="text-sm text-textSecondary max-w-md mx-auto mt-1 mb-4">
              Try searching for another city (e.g. Pune, Chembur, Mumbai) or clear the search to view nearby specialists.
            </p>
            <button
              onClick={handleClearSearch}
              className="text-xs font-bold bg-primary text-white px-4 py-2 rounded-xl hover:opacity-90 transition cursor-pointer"
            >
              Reset to Nearby Location
            </button>
          </div>
        )}

        {/* Informational Guidance Box */}
        <div className="mt-8 p-5 rounded-2xl border border-border bg-primaryLight/50 text-sm text-textSecondary space-y-2">
          <p>
            <strong className="text-textPrimary">How this works:</strong> Calls and chats happen directly
            with the doctor or clinic, outside MindEase. Nothing from your MindEase chats or journal is shared unless
            you choose to share it yourself.
          </p>
          <p>
            These listings are verified professionals sorted by physical distance. If you are in immediate danger, call{" "}
            <a href="tel:14416" className="font-bold underline text-red-700">
              TeleMANAS 14416
            </a>{" "}
            right now, or reach a trusted contact from{" "}
            <Link to="/safeplace" className="text-primary font-semibold underline">
              Safe Place
            </Link>
            .
          </p>
        </div>
      </div>

      <CrisisModal
        isOpen={showCrisisModal}
        onClose={() => setShowCrisisModal(false)}
      />
    </div>
  );
}

export default Professionals;
