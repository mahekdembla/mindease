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
import { fetchInsights } from "../../services/api";

function Insights() {
    const [view, setView] = useState("weekly");
    const [isLoading, setIsLoading] = useState(true);
    const [insightsData, setInsightsData] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const loadInsightsData = async () => {
            setIsLoading(true);
            try {
                const data = await fetchInsights(view);
                if (isMounted) {
                    setInsightsData(data);
                }
            } catch (error) {
                console.error("Failed to load insights:", error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        loadInsightsData();
        return () => {
            isMounted = false;
        };
    }, [view]);

    const EMOTION_COLORS = {
        Happy: "#81C784",
        Positive: "#81C784",
        Calm: "#64B5F6",
        Balanced: "#4DD0E1",
        Sad: "#9FA8DA",
        Anxious: "#FFD54F",
        Fear: "#FFB74D",
        Stressed: "#E57373",
        Anger: "#EF5350",
        Crisis: "#BA68C8",
    };

    const FALLBACK_COLORS = [
        "#81C784",
        "#FFD54F",
        "#64B5F6",
        "#BA68C8",
        "#E57373",
        "#FF8A65",
        "#4DD0E1",
    ];


    if (isLoading) {
        return (
            <div className="p-6 sm:p-8 w-full min-h-screen bg-background relative overflow-y-auto">
                <div className="w-full max-w-5xl mx-auto mb-6">
                    <span className="text-xs uppercase tracking-wider font-semibold text-purple-700 bg-purple-100 px-3.5 py-1.5 rounded-full border border-purple-200">
                        Mood & Growth Insights 📊
                    </span>
                </div>
                <div className="max-w-5xl mx-auto w-full bg-white border border-border rounded-3xl p-8 shadow-xs text-center text-slate-500 text-sm">
                    Loading your mood insights...
                </div>
            </div>
        );
    }

    const hasData = insightsData?.has_data ?? false;
    const avgMood = insightsData?.average_mood ?? 0;
    const journalCount = insightsData?.journal_count ?? 0;
    const chatCount = insightsData?.chat_conversation_count ?? 0;
    const chartData = insightsData?.chart_data ?? [];
    const pieData = insightsData?.emotion_distribution ?? [];
    const mostMood = insightsData?.most_common_mood ?? "-";
    const bestDay = insightsData?.best_day ?? "-";
    const insightSummary = insightsData?.insight_summary || "Keep tracking your emotions to better understand your wellbeing over time.";

    return (
        <div className="p-6 sm:p-8 w-full min-h-screen bg-background relative overflow-y-auto">
            
            {/* Top Navigation Badge */}
            <div className="w-full max-w-5xl mx-auto flex items-center justify-between mb-6">
                <span className="text-xs uppercase tracking-wider font-semibold text-purple-700 bg-purple-100 px-3.5 py-1.5 rounded-full border border-purple-200">
                    Mood & Growth Insights 📊
                </span>
            </div>

            {/* Header Title Section */}
            <div className="max-w-5xl mx-auto w-full mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-heading font-bold text-textPrimary">
                        Mood Insights
                    </h1>
                    <p className="text-textSecondary text-sm sm:text-base leading-relaxed mt-1">
                        Track your emotional wellbeing and review your reflection progress over time.
                    </p>
                </div>

                {/* Weekly / Monthly Selector */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    <button
                        onClick={() => setView("weekly")}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            view === "weekly"
                                ? "bg-purple-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        Weekly
                    </button>

                    <button
                        onClick={() => setView("monthly")}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            view === "monthly"
                                ? "bg-purple-600 text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                    >
                        Monthly
                    </button>
                </div>
            </div>

            {/* Main Enclosed Centered White Box Container */}
            <div className="max-w-5xl mx-auto w-full bg-white border border-border rounded-3xl p-6 sm:p-8 shadow-xs space-y-8">
                
                {/* 1. Stat Metric Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    <div className="bg-slate-50/70 border border-slate-200/80 p-5 rounded-2xl flex flex-col justify-between">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Average Mood
                        </p>
                        <div className="my-2">
                            <span className="text-3xl sm:text-4xl font-extrabold text-purple-700">
                                {avgMood}
                            </span>
                            <span className="text-xs text-slate-500 ml-1 font-medium">/ 10</span>
                        </div>
                        <p className="text-[11px] text-slate-400">Based on recent entries</p>
                    </div>

                    <div className="bg-slate-50/70 border border-slate-200/80 p-5 rounded-2xl flex flex-col justify-between">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Journal Entries
                        </p>
                        <div className="my-2">
                            <span className="text-3xl sm:text-4xl font-extrabold text-purple-700">
                                {journalCount}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Total reflections logged</p>
                    </div>

                    <div className="bg-slate-50/70 border border-slate-200/80 p-5 rounded-2xl flex flex-col justify-between">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            AI Conversations
                        </p>
                        <div className="my-2">
                            <span className="text-3xl sm:text-4xl font-extrabold text-purple-700">
                                {chatCount}
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-400">Support sessions held</p>
                    </div>
                </div>

                {/* 2. Mood Trend Line Chart */}
                <div className="bg-slate-50/50 border border-slate-200/80 p-5 sm:p-6 rounded-2xl">
                    <h2 className="text-base font-bold text-textPrimary mb-4">
                        Mood Trend
                    </h2>

                    <div className="w-full overflow-x-auto overflow-y-hidden">
                        <div className={view === "monthly" ? "min-w-[700px]" : "w-full"}>
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart
                                    data={chartData}
                                    margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
                                >
                                    <XAxis
                                        dataKey="day"
                                        interval={view === "monthly" ? 2 : 0}
                                        tick={{ fill: "#64748B", fontSize: 12 }}
                                    />
                                    <YAxis
                                        domain={[0, 10]}
                                        ticks={[0, 3, 6, 10]}
                                        tick={{ fill: "#64748B", fontSize: 12 }}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#1E1B4B",
                                            borderColor: "#4338CA",
                                            borderRadius: "12px",
                                            color: "#FFF",
                                            fontSize: "12px",
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="mood"
                                        stroke="#9333EA"
                                        strokeWidth={3}
                                        dot={{
                                            r: 5,
                                            strokeWidth: 2,
                                            fill: "#9333EA",
                                            stroke: "#FFFFFF",
                                        }}
                                        connectNulls={true}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* 3. Bottom Cards: Distribution & Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Emotion Distribution */}
                    <div className="bg-slate-50/50 border border-slate-200/80 p-5 sm:p-6 rounded-2xl flex flex-col justify-between">
                        <h2 className="text-base font-bold text-textPrimary mb-3">
                            Emotion Distribution
                        </h2>

                        {!hasData || pieData.length === 0 ? (
                            <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs">
                                No mood data available yet.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        outerRadius={75}
                                        labelLine={false}
                                        label={({ name, percent }) =>
                                            `${name} ${(percent * 100).toFixed(0)}%`
                                        }
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell
                                                key={index}
                                                fill={EMOTION_COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                                            />
                                        ))}

                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* Summary Card */}
                    <div className="bg-slate-50/50 border border-slate-200/80 p-5 sm:p-6 rounded-2xl flex flex-col justify-between">
                        <h2 className="text-base font-bold text-textPrimary mb-4">
                            {view === "weekly" ? "Weekly Summary" : "Monthly Summary"}
                        </h2>

                        <div className="space-y-4 text-xs sm:text-sm">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                <span className="text-slate-500 font-medium">Most Common Mood</span>
                                <span className="font-bold text-purple-900">{mostMood}</span>
                            </div>

                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                <span className="text-slate-500 font-medium">Best Day</span>
                                <span className="font-bold text-purple-900">{bestDay}</span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-slate-500 font-medium">AI Conversations</span>
                                <span className="font-bold text-purple-900">{chatCount}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Insight Summary Box */}
                <div className="bg-purple-50 border border-purple-200/80 p-5 rounded-2xl">
                    <h2 className="text-xs uppercase tracking-wider font-extrabold text-purple-900 mb-1">
                        Personalized Insight
                    </h2>
                    <p className="text-xs sm:text-sm font-medium text-slate-700 leading-relaxed">
                        {insightSummary}
                    </p>
                </div>

            </div>

        </div>
    );
}

export default Insights;