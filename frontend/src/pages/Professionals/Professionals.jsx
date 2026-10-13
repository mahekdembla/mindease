import { useState } from "react";
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
} from "@fortawesome/free-solid-svg-icons";
import { professionals } from "../../data/professionals";
import CrisisModal from "../../components/common/CrisisModal";

const onlyDigits = (value) => (value || "").replace(/[^\d]/g, "");

const CHAT_INTRO =
  "Hello, I found you through MindEase and would like to book a consultation.";

function Professionals() {
  const [showCrisisModal, setShowCrisisModal] = useState(false);
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

      <CrisisModal
        isOpen={showCrisisModal}
        onClose={() => setShowCrisisModal(false)}
      />
    </div>
  );
}

export default Professionals;
