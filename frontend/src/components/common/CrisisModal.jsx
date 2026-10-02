import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faCommentDots,
  faXmark,
  faHeartPulse,
  faShieldHeart,
} from "@fortawesome/free-solid-svg-icons";

function CrisisModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/70 backdrop-blur-md transition-opacity duration-300">
      {/* Clickable Backdrop */}
      <div
        className="fixed inset-0 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div className="relative w-full max-w-lg my-auto rounded-3xl bg-white shadow-2xl border border-purple-100 p-6 sm:p-8 z-10 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Soft Background Decorative Radial Accent */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-purple-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-rose-200/40 rounded-full blur-3xl pointer-events-none" />

        {/* Header Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-150 z-20 cursor-pointer"
        >
          <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-sm shrink-0">
            <FontAwesomeIcon icon={faHeartPulse} className="text-2xl animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              You’re Not Alone 💜
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Immediate, 24/7 free & confidential crisis support
            </p>
          </div>
        </div>

        {/* Subtitle / Intro Message */}
        <p className="text-sm text-slate-600 leading-relaxed mb-5">
          If you are feeling overwhelmed, experiencing a mental health crisis, or having thoughts of self-harm, please reach out right now. Compassionate counselors are ready to support you.
        </p>

        {/* Support Options List */}
        <div className="space-y-3.5 mb-5">
          
          {/* Option 1: 988 Call Hotline */}
          <div className="group border border-purple-100 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-200 rounded-2xl p-4 transition-all duration-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform duration-200">
                <FontAwesomeIcon icon={faPhone} className="text-lg" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-base">National Crisis Hotline</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-200/70 text-purple-800">
                    24/7 Call
                  </span>
                </div>
                <p className="text-xl font-extrabold text-purple-700 tracking-wide mt-0.5">
                  988
                </p>
                <p className="text-xs text-slate-500">Free, confidential support across the US & Canada</p>
              </div>
            </div>
            
            <a
              href="tel:988"
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm shadow-sm transition-all duration-150 shrink-0 text-center whitespace-nowrap active:scale-95"
            >
              Call 988
            </a>
          </div>

          {/* Option 2: 741741 Text Line */}
          <div className="group border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-200 rounded-2xl p-4 transition-all duration-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0 group-hover:scale-105 transition-transform duration-200">
                <FontAwesomeIcon icon={faCommentDots} className="text-lg" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-base">Crisis Text Line</h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-200/70 text-indigo-800">
                    24/7 Text
                  </span>
                </div>
                <p className="text-sm font-semibold text-indigo-700 mt-0.5">
                  Text <span className="font-extrabold underline decoration-indigo-300">HELLO</span> to <span className="font-extrabold text-indigo-900">741741</span>
                </p>
                <p className="text-xs text-slate-500">Connect with a trained crisis counselor via text</p>
              </div>
            </div>
            
            <a
              href="sms:741741?body=HELLO"
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition-all duration-150 shrink-0 text-center whitespace-nowrap active:scale-95"
            >
              Text Now
            </a>
          </div>

        </div>

        {/* Safety Disclaimer Banner */}
        <div className="bg-slate-100/90 border border-slate-200 rounded-2xl p-3.5 flex items-start gap-3 text-xs text-slate-600 leading-relaxed mb-6">
          <FontAwesomeIcon icon={faShieldHeart} className="text-slate-400 text-base mt-0.5 shrink-0" />
          <div>
            <strong className="font-semibold text-slate-800">Important Note:</strong> MindEase is designed to aid your self-care journey and is not a substitute for professional mental health services. If you are in immediate physical danger, please contact local emergency services (911 / 112) immediately.
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-purple-500/20 active:scale-[0.99] transition-all duration-150 text-base cursor-pointer"
        >
          Close Window
        </button>

      </div>
    </div>,
    document.body
  );
}

export default CrisisModal;
