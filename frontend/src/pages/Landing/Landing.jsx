import { useNavigate } from "react-router-dom";

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* Navbar */}
      <div className="flex justify-between items-center px-10 py-5">
        <div className="flex items-center gap-2">
          <span className="text-primary text-2xl">💜</span>
          <h1 className="text-xl font-heading font-semibold">
            MindEase
          </h1>
        </div>

        <div className="flex gap-4 items-center">
          <button
            onClick={() => navigate("/login")}
            className="
                text-textSecondary
                transition-all duration-200
                hover:text-primary
                hover:scale-105
            "
          >
            Log In
          </button>

          <button
              onClick={() => navigate("/signup")}
              className="
                  bg-primary text-white px-4 py-2 rounded-xl
                  transition-all duration-200
                  hover:bg-primary/90
                  hover:scale-105
                  hover:shadow-lg
              "
          >
            Sign Up
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="flex flex-1 items-center px-10 gap-10">

        {/* Left */}
        <div className="flex-1">
          <h1 className="text-5xl font-heading font-bold text-textPrimary mb-4">
            Your AI Companion for Mental Wellness
          </h1>

          <p className="text-textSecondary mb-6">
            Experience compassionate, 24/7 emotional support powered by AI.
            Track your mood, journal your thoughts, and gain insights into
            your mental wellbeing.
          </p>

          <div className="flex gap-4">

            {/* Get Started → Login */}
            <button
              onClick={() => navigate("/login")}
              className="bg-primary text-white px-6 py-3 rounded-xl"
            >
              Get Started
            </button>

            {/* Try Demo → Dashboard */}
            <button
              onClick={() => navigate("/dashboard")}
              className="border border-border px-6 py-3 rounded-xl"
            >
              Try Demo
            </button>

          </div>
        </div>

        {/* Right Image */}
        <div className="flex-1">
          <img
            src="/src/assets/hero.png"
            alt="meditation"
            className="rounded-2xl shadow-md"
          />
        </div>

      </div>
    </div>
  );
}

export default Landing;