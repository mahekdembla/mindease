import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

function Insights() {
  const [entries, setEntries] = useState([]);
  const [view, setView] = useState("weekly");

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("journalEntries")) || [];
    setEntries(data);
  }, []);

  // ✅ Mood scoring
  const moodScore = {
    "😊 Happy": 8,
    "😌 Calm": 7,
    "😟 Anxious": 5,
    "😢 Sad": 4,
    "😫 Stressed": 3,
  };

  // ✅ Filter data
  const filtered =
    view === "weekly" ? entries.slice(0, 7) : entries.slice(0, 30);

  // ✅ Chart data FIXED
  const chartData = filtered.reverse().map((item) => {
    const dateObj = new Date(item.date);

    return {
      day: isNaN(dateObj)
        ? "—"
        : dateObj.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      mood: moodScore[item.mood] || 5,
    };
  });

  // ✅ Average
  const avgMood =
    entries.length > 0
      ? (
        entries.reduce((sum, e) => sum + (moodScore[e.mood] || 5), 0) /
        entries.length
      ).toFixed(1)
      : 0;

  // ✅ Distribution
  const moodCount = {};
  entries.forEach((e) => {
    moodCount[e.mood] = (moodCount[e.mood] || 0) + 1;
  });

  const pieData = Object.keys(moodCount).map((key) => ({
    name: key,
    value: moodCount[key],
  }));

  const COLORS = ["#A5D6A7", "#FFE082", "#90CAF9", "#CE93D8", "#EF9A9A"];

  // ✅ Most mood
  const mostMood =
    pieData.length > 0
      ? pieData.reduce((a, b) => (a.value > b.value ? a : b)).name
      : "-";

  // ✅ AI conversations count
  const chatCount = localStorage.getItem("chatCount") || 0;

  // ✅ Insight
  const getInsight = () => {
    if (!mostMood) return "Start journaling to see insights.";

    if (mostMood.includes("Happy"))
      return "You're doing great emotionally. Keep it up!";
    if (mostMood.includes("Sad"))
      return "You've been feeling low. Try talking more.";
    if (mostMood.includes("Anxious"))
      return "You seem anxious lately. Try breathing exercises.";
    if (mostMood.includes("Stressed"))
      return "Stress levels are high. Take breaks.";
    if (mostMood.includes("Calm"))
      return "You're maintaining calm. Great progress.";

    return "Keep tracking your emotions.";
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-heading font-semibold text-textPrimary">
            Mood Insights
          </h1>
          <p className="text-textSecondary">
            Track your emotional wellbeing
          </p>
        </div>

        {/* Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setView("weekly")}
            className={`px-4 py-1 rounded-full ${view === "weekly"
                ? "bg-primary text-white"
                : "bg-gray-200"
              }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setView("monthly")}
            className={`px-4 py-1 rounded-full ${view === "monthly"
                ? "bg-primary text-white"
                : "bg-gray-200"
              }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-card p-6 rounded-2xl border">
          <p className="text-sm text-textSecondary">Average Mood</p>
          <h2 className="text-3xl font-bold text-primary">{avgMood}</h2>
          <p className="text-sm text-textSecondary">out of 10</p>
        </div>

        <div className="bg-card p-6 rounded-2xl border">
          <p className="text-sm text-textSecondary">Journal Entries</p>
          <h2 className="text-3xl font-bold text-primary">
            {entries.length}
          </h2>
        </div>

        <div className="bg-card p-6 rounded-2xl border">
          <p className="text-sm text-textSecondary">AI Conversations</p>
          <h2 className="text-3xl font-bold text-primary">
            {chatCount}
          </h2>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card p-6 rounded-2xl border mb-8">
        <h2 className="text-lg font-semibold mb-4">Mood Trend</h2>

        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <XAxis dataKey="day" />
            <YAxis domain={[0, 10]} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="mood"
              stroke="#9B6DFF"
              strokeWidth={3}
              dot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-2 gap-6 mb-8">

        {/* Pie FIXED */}
        <div className="bg-card p-6 rounded-2xl border">
          <h2 className="text-lg font-semibold mb-4">
            Emotion Distribution
          </h2>

          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                outerRadius={100}
                label={({ name, percent }) =>
                  `${name.split(" ")[1]} ${(percent * 100).toFixed(0)}%`
                }
              >
                {pieData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Summary */}
        <div className="bg-card p-6 rounded-2xl border flex flex-col justify-between h-full">

          <h2 className="text-lg font-semibold mb-6">
            Weekly Summary
          </h2>

          <div className="space-y-6">

            {/* Most Mood */}
            <div>
              <p className="text-sm text-textSecondary mb-1">
                Most Common Mood
              </p>
              <p className="text-base font-semibold">
                {mostMood}
              </p>
            </div>

            {/* Best Day */}
            <div>
              <p className="text-sm text-textSecondary mb-1">
                Best Day
              </p>
              <p className="text-base font-semibold">
                April 20 (8/10)
              </p>
            </div>

            {/* Progress */}
            <div>
              <p className="text-sm text-textSecondary mb-1">
                Progress
              </p>
              <p className="text-base font-semibold text-green-600">
                ↑ 15% improvement
              </p>
              <p className="text-xs text-textSecondary">
                compared to last week
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="bg-primaryLight p-6 rounded-2xl">
        <h2 className="font-semibold mb-2">Insight</h2>
        <p className="text-textSecondary">{getInsight()}</p>
      </div>
    </div>
  );
}

export default Insights;