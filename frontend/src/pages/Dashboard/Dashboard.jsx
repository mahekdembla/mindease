import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHand,
  faComments,
  faBook,
  faChartLine,
  faLightbulb,
} from "@fortawesome/free-solid-svg-icons";

function Dashboard() {

  const user = JSON.parse(localStorage.getItem("user"));

  const firstName =
    user?.name && user.name.length > 0
      ? user.name.split(" ")[0]
      : "";
  const moods = [
    { name: "Happy", emoji: "😊" },
    { name: "Anxious", emoji: "😟" },
    { name: "Sad", emoji: "😢" },
    { name: "Calm", emoji: "😌" },
    { name: "Stressed", emoji: "😫" },
  ];

  const getHoverStyle = (mood) => {
    const styles = {
      Happy: "hover:bg-happy/20 hover:border-green-500 hover:text-green-600",
      Anxious: "hover:bg-anxious/20 hover:border-yellow-500 hover:text-yellow-600",
      Sad: "hover:bg-sad/20 hover:border-blue-500 hover:text-blue-600",
      Calm: "hover:bg-calm/20 hover:border-purple-500 hover:text-purple-600",
      Stressed: "hover:bg-stressed/20 hover:border-red-500 hover:text-red-600",
    };

    return styles[mood];
  };

  return (
    <div className="p-8 w-full flex flex-col items-start">

      {/* Header */}
      <h1 className="text-3xl font-bold font-heading text-textPrimary flex items-center gap-2 mb-2">
        Welcome back, {firstName && `${firstName}`} 
        <FontAwesomeIcon icon={faHand} className="text-primary" />
      </h1>

      <p className="text-textSecondary mb-6">
        How are you feeling today?
      </p>

      {/* Mood Section */}
      <h2 className="text-lg font-semibold text-textPrimary mb-4">
        Select your mood
      </h2>

      <div className="grid grid-cols-5 gap-6 w-full">

        {moods.map((mood) => (
          <div
            key={mood.name}
            className={`
              h-28 w-full
              rounded-2xl border border-border bg-card
              transition-all duration-200 cursor-pointer
              flex flex-col items-center justify-center
              hover:shadow-sm

              ${getHoverStyle(mood.name)}
            `}
          >
            {/* ✅ EMOJI BACK */}
            <div className="text-3xl">{mood.emoji}</div>

            <p className="mt-2 font-medium">
              {mood.name}
            </p>
          </div>
        ))}

      </div>

      {/* Quick Access */}
      <h2 className="text-lg font-semibold text-textPrimary mt-10 mb-4">
        Quick Access
      </h2>

      <div className="grid grid-cols-3 gap-6 w-full">

        {/* AI Support */}
        <div className="p-6 bg-card border border-border rounded-2xl hover:shadow-md hover:-translate-y-1 transition cursor-pointer">
          <div className="w-12 h-12 flex items-center justify-center bg-primaryLight rounded-xl mb-4">
            <FontAwesomeIcon icon={faComments} className="text-primary" />
          </div>
          <h3 className="font-semibold text-textPrimary mb-1">
            AI Support
          </h3>
          <p className="text-sm text-textSecondary">
            Chat with your AI companion for emotional support and guidance
          </p>
        </div>

        {/* Journal */}
        <div className="p-6 bg-card border border-border rounded-2xl hover:shadow-md hover:-translate-y-1 transition cursor-pointer">
          <div className="w-12 h-12 flex items-center justify-center bg-primaryLight rounded-xl mb-4">
            <FontAwesomeIcon icon={faBook} className="text-primary" />
          </div>
          <h3 className="font-semibold text-textPrimary mb-1">
            Journal
          </h3>
          <p className="text-sm text-textSecondary">
            Write down your thoughts and reflect on your feelings
          </p>
        </div>

        {/* Mood Insights */}
        <div className="p-6 bg-card border border-border rounded-2xl hover:shadow-md hover:-translate-y-1 transition cursor-pointer">
          <div className="w-12 h-12 flex items-center justify-center bg-primaryLight rounded-xl mb-4">
            <FontAwesomeIcon icon={faChartLine} className="text-primary" />
          </div>
          <h3 className="font-semibold text-textPrimary mb-1">
            Mood Insights
          </h3>
          <p className="text-sm text-textSecondary">
            Track your emotional patterns and progress over time
          </p>
        </div>

      </div>
      {/* Reminder Section */}
      <div className="w-full mt-10">

        <div className="bg-primary/20 border border-primary/40 rounded-2xl p-6 flex items-start gap-4 hover:shadow-md transition">
          {/* Icon */}
          <div className="w-12 h-12 flex items-center justify-center bg-primary/20 rounded-xl">
            <FontAwesomeIcon icon={faLightbulb} className="text-primary text-lg" />
          </div>

          {/* Content */}
          <div>
            <h3 className="font-semibold text-lg text-textPrimary mb-1">
              Daily Reminder
            </h3>
            <p className="text-sm text-textSecondary">
              Take a moment to breathe deeply and check in with yourself. Small steps matter 💜
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}

export default Dashboard;