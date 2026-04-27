import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faCommentDots,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

function CrisisModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">

      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-black"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        {/* Title */}
        <h2 className="text-xl font-semibold mb-1">
          You’re Not Alone 💜
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Help is available 24/7
        </p>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-5">
          If you're experiencing a mental health crisis or thinking about harming yourself,
          please reach out for immediate support. You deserve help and care.
        </p>

        {/* Call */}
        <div className="border rounded-xl p-4 mb-4 flex items-start gap-3">
          <div className="bg-primaryLight text-primary p-3 rounded-lg">
            <FontAwesomeIcon icon={faPhone} />
          </div>

          <div>
            <p className="font-medium">National Crisis Hotline</p>
            <p className="text-xl font-bold text-primary">988</p>
            <p className="text-xs text-gray-500">
              Available 24/7 for free, confidential support
            </p>
          </div>
        </div>

        {/* Text */}
        <div className="border rounded-xl p-4 mb-4 flex items-start gap-3">
          <div className="bg-primaryLight text-primary p-3 rounded-lg">
            <FontAwesomeIcon icon={faCommentDots} />
          </div>

          <div>
            <p className="font-medium">Crisis Text Line</p>
            <p className="text-sm">
              Text <span className="text-primary font-semibold">HELLO</span> to{" "}
              <span className="text-primary font-semibold">741741</span>
            </p>
            <p className="text-xs text-gray-500">
              Connect with a crisis counselor via text
            </p>
          </div>
        </div>

        {/* Warning */}
        <div className="bg-gray-100 rounded-xl p-3 text-xs text-gray-600">
          Remember: MindEase is not a substitute for professional mental health care.
          If you're in immediate danger, contact emergency services.
        </div>

        {/* Button */}
        <button
          onClick={onClose}
          className="mt-5 w-full bg-primary text-white py-2 rounded-xl hover:opacity-90"
        >
          Close
        </button>

      </div>
    </div>
  );
}

export default CrisisModal;