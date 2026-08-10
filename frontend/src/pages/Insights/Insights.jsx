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
    const [chatHistory, setChatHistory] = useState([]);
    const [view, setView] = useState("weekly");
    const [isLoading, setIsLoading] = useState(true);

    // =========================
    // MOOD SCORES
    // =========================

    const moodScore = {
        "😊 Happy": 8,
        "😌 Calm": 7,
        "😟 Anxious": 5,
        "😢 Sad": 4,
        "😫 Stressed": 3,
    };

    // =========================
    // LOAD DATA
    // =========================

    useEffect(() => {
        const loadInsightsData = async () => {
            try {
                const [journalResponse, chatResponse] =
                    await Promise.all([
                        fetch("http://127.0.0.1:8000/journal"),
                        fetch("http://127.0.0.1:8000/chat-history"),
                    ]);

                if (!journalResponse.ok) {
                    throw new Error("Failed to load journal data");
                }

                if (!chatResponse.ok) {
                    throw new Error("Failed to load chat data");
                }

                const journalData =
                    await journalResponse.json();

                const chatData =
                    await chatResponse.json();

                setEntries(journalData);
                setChatHistory(chatData);

            } catch (error) {
                console.error(
                    "Failed to load insights:",
                    error
                );
            } finally {
                setIsLoading(false);
            }
        };

        loadInsightsData();
    }, []);

    // =========================
    // DATE HELPER
    // =========================

    const getDate = (item) => {
        const date = new Date(item.time || item.date);

        return isNaN(date.getTime())
            ? null
            : date;
    };

    // =========================
    // CURRENT DATE
    // =========================

    const now = new Date();

    /*
     * Weekly = last 7 days including today
     *
     * Monthly = last 32 days including today
     *
     * This means:
     * If today is Aug 9:
     * Monthly starts on Jul 9
     * and ends on Aug 9.
     */

    const daysToShow =
        view === "weekly"
            ? 7
            : 32;

    // =========================
    // START DATE
    // =========================

    const startDate = new Date(now);

    startDate.setDate(
        now.getDate() - (daysToShow - 1)
    );

    startDate.setHours(0, 0, 0, 0);

    // =========================
    // END DATE
    // =========================

    const endDate = new Date(now);

    endDate.setHours(
        23,
        59,
        59,
        999
    );

    // =========================
    // FILTER ENTRIES
    // =========================

    const filteredEntries = entries.filter(
        (entry) => {
            const date = getDate(entry);

            if (!date) {
                return false;
            }

            return (
                date >= startDate &&
                date <= endDate
            );
        }
    );

    // =========================
    // DAILY CHART DATA
    // =========================

    const chartData = [];

    for (
        let i = 0;
        i < daysToShow;
        i++
    ) {
        const currentDate =
            new Date(startDate);

        currentDate.setDate(
            startDate.getDate() + i
        );

        const year =
            currentDate.getFullYear();

        const month =
            currentDate.getMonth();

        const day =
            currentDate.getDate();

        const dayEntries =
            filteredEntries.filter(
                (entry) => {
                    const entryDate =
                        getDate(entry);

                    if (!entryDate) {
                        return false;
                    }

                    return (
                        entryDate.getFullYear() ===
                            year &&
                        entryDate.getMonth() ===
                            month &&
                        entryDate.getDate() ===
                            day
                    );
                }
            );

        let mood = null;

        if (dayEntries.length > 0) {
            const total =
                dayEntries.reduce(
                    (sum, entry) =>
                        sum +
                        (
                            moodScore[
                                entry.mood
                            ] || 5
                        ),
                    0
                );

            mood =
                total /
                dayEntries.length;
        }

        chartData.push({
            day: currentDate.toLocaleDateString(
                "en-US",
                {
                    month: "short",
                    day: "numeric",
                }
            ),
            mood,
        });
    }

    // =========================
    // AVERAGE MOOD
    // =========================

    const avgMood =
        filteredEntries.length > 0
            ? (
                filteredEntries.reduce(
                    (sum, entry) =>
                        sum +
                        (
                            moodScore[
                                entry.mood
                            ] || 5
                        ),
                    0
                ) /
                filteredEntries.length
            ).toFixed(1)
            : "0";

    // =========================
    // MOOD DISTRIBUTION
    // =========================

    const moodCount = {};

    filteredEntries.forEach(
        (entry) => {
            if (!entry.mood) {
                return;
            }

            moodCount[entry.mood] =
                (moodCount[entry.mood] || 0) + 1;
        }
    );

    const pieData =
        Object.keys(moodCount).map(
            (key) => ({
                name: key,
                value: moodCount[key],
            })
        );

    const COLORS = [
        "#A5D6A7",
        "#FFE082",
        "#90CAF9",
        "#CE93D8",
        "#EF9A9A",
    ];

    // =========================
    // MOST COMMON MOOD
    // =========================

    const mostMood =
        pieData.length > 0
            ? pieData.reduce(
                (a, b) =>
                    a.value > b.value
                        ? a
                        : b
            ).name
            : "-";

    // =========================
    // AI CONVERSATIONS
    // =========================

    const chatCount =
        chatHistory.length;

    // =========================
    // BEST DAY
    // =========================

    const bestEntry =
        filteredEntries.length > 0
            ? filteredEntries.reduce(
                (best, current) => {
                    const currentScore =
                        moodScore[
                            current.mood
                        ] || 5;

                    const bestScore =
                        moodScore[
                            best.mood
                        ] || 5;

                    return currentScore >
                        bestScore
                        ? current
                        : best;
                }
            )
            : null;

    const bestDay = bestEntry
        ? `${getDate(
            bestEntry
        ).toLocaleDateString(
            "en-US",
            {
                month: "long",
                day: "numeric",
            }
        )} (${moodScore[
            bestEntry.mood
        ] || 5}/10)`
        : "-";

    // =========================
    // INSIGHT
    // =========================

    const getInsight = () => {
        if (filteredEntries.length === 0) {
            return "Start journaling to see personalized insights about your emotional wellbeing.";
        }

        if (mostMood.includes("Happy")) {
            return "You've been feeling positive lately. Keep doing the things that bring you joy!";
        }

        if (mostMood.includes("Calm")) {
            return "You've been maintaining a calm state recently. Keep making time for activities that help you relax.";
        }

        if (mostMood.includes("Anxious")) {
            return "Anxiety appears frequently in your recent entries. Consider taking short breaks and practicing slow breathing.";
        }

        if (mostMood.includes("Stressed")) {
            return "Stress appears frequently in your recent entries. Try giving yourself time to rest between tasks.";
        }

        if (mostMood.includes("Sad")) {
            return "You've been feeling low recently. Writing about your thoughts can be a helpful way to process them.";
        }

        return "Keep tracking your emotions to better understand your wellbeing over time.";
    };

    // =========================
    // LOADING
    // =========================

    if (isLoading) {
        return (
            <div className="p-8 w-full min-w-0 overflow-x-hidden">

                <h1 className="text-3xl font-heading font-semibold text-textPrimary">
                    Mood Insights
                </h1>

                <p className="text-textSecondary mt-2">
                    Loading your insights...
                </p>

            </div>
        );
    }

    return (
        <div className="p-8 w-full min-w-0 overflow-x-hidden">

            {/* =========================
                HEADER
            ========================= */}

            <div className="flex items-start justify-between gap-4 mb-8">

                <div>
                    <h1 className="text-3xl font-heading font-semibold text-textPrimary">
                        Mood Insights
                    </h1>

                    <p className="text-textSecondary mt-1">
                        Track your emotional wellbeing
                    </p>
                </div>

                {/* Weekly / Monthly */}
                <div className="flex gap-2 shrink-0">

                    <button
                        onClick={() =>
                            setView("weekly")
                        }
                        className={`px-5 py-3 rounded-full transition ${
                            view === "weekly"
                                ? "bg-primary text-white"
                                : "bg-gray-200 text-textPrimary"
                        }`}
                    >
                        Weekly
                    </button>

                    <button
                        onClick={() =>
                            setView("monthly")
                        }
                        className={`px-5 py-3 rounded-full transition ${
                            view === "monthly"
                                ? "bg-primary text-white"
                                : "bg-gray-200 text-textPrimary"
                        }`}
                    >
                        Monthly
                    </button>

                </div>

            </div>

            {/* =========================
                STAT CARDS
            ========================= */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

                <div className="bg-card p-6 rounded-2xl border">
                    <p className="text-textSecondary">
                        Average Mood
                    </p>

                    <p className="text-4xl font-semibold text-primary mt-1">
                        {avgMood}
                    </p>

                    <p className="text-textSecondary">
                        out of 10
                    </p>
                </div>

                <div className="bg-card p-6 rounded-2xl border">
                    <p className="text-textSecondary">
                        Journal Entries
                    </p>

                    <p className="text-4xl font-semibold text-primary mt-1">
                        {filteredEntries.length}
                    </p>
                </div>

                <div className="bg-card p-6 rounded-2xl border">
                    <p className="text-textSecondary">
                        AI Conversations
                    </p>

                    <p className="text-4xl font-semibold text-primary mt-1">
                        {chatCount}
                    </p>
                </div>

            </div>

            {/* =========================
                MOOD TREND
            ========================= */}

            <div className="bg-card p-6 rounded-2xl border mb-8 min-w-0">

                <h2 className="text-xl font-semibold mb-6">
                    Mood Trend
                </h2>

                {/* ONLY THIS AREA CAN SCROLL */}
                <div className="w-full overflow-x-auto overflow-y-hidden">

                    <div
                        className={
                            view === "monthly"
                                ? "min-w-[1000px]"
                                : "min-w-0 w-full"
                        }
                    >

                        <ResponsiveContainer
                            width="100%"
                            height={300}
                        >
                            <LineChart
                                data={chartData}
                                margin={{
                                    top: 10,
                                    right: 20,
                                    left: 10,
                                    bottom: 10,
                                }}
                            >

                                <XAxis
                                    dataKey="day"
                                    interval={
                                        view === "monthly"
                                            ? 2
                                            : 0
                                    }
                                    tick={{
                                        fill: "#666",
                                    }}
                                />

                                <YAxis
                                    domain={[0, 10]}
                                    ticks={[
                                        0,
                                        3,
                                        6,
                                        10,
                                    ]}
                                />

                                <Tooltip />

                                <Line
                                    type="monotone"
                                    dataKey="mood"
                                    stroke="#9466F2"
                                    strokeWidth={3}
                                    dot={{
                                        r: 5,
                                        strokeWidth: 3,
                                        fill: "white",
                                    }}
                                    connectNulls={true}
                                />

                            </LineChart>
                        </ResponsiveContainer>

                    </div>

                </div>

            </div>

            {/* =========================
                BOTTOM CARDS
            ========================= */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                {/* Emotion Distribution */}

                <div className="bg-card p-6 rounded-2xl border min-w-0 overflow-hidden">

                    <h2 className="text-lg font-semibold mb-4">
                        Emotion Distribution
                    </h2>

                    {pieData.length === 0 ? (

                        <div className="h-[250px] flex items-center justify-center text-textSecondary">
                            No mood data available.
                        </div>

                    ) : (

                        <ResponsiveContainer
                            width="100%"
                            height={250}
                        >

                            <PieChart>

                                <Pie
                                    data={pieData}
                                    dataKey="value"
                                    outerRadius={90}
                                    labelLine={true}
                                    label={({
                                        name,
                                        percent,
                                    }) =>
                                        `${
                                            name.replace(
                                                /^.*?\s/,
                                                ""
                                            )
                                        } ${(
                                            percent * 100
                                        ).toFixed(0)}%`
                                    }
                                >

                                    {pieData.map(
                                        (_, index) => (
                                            <Cell
                                                key={index}
                                                fill={
                                                    COLORS[
                                                        index %
                                                        COLORS.length
                                                    ]
                                                }
                                            />
                                        )
                                    )}

                                </Pie>

                            </PieChart>

                        </ResponsiveContainer>

                    )}

                </div>

                {/* Summary */}

                <div className="bg-card p-6 rounded-2xl border flex flex-col justify-between h-full min-w-0 overflow-hidden">

                    <h2 className="text-lg font-semibold mb-6">
                        {view === "weekly"
                            ? "Weekly Summary"
                            : "Monthly Summary"}
                    </h2>

                    <div className="space-y-6">

                        <div>
                            <p className="text-sm text-textSecondary mb-1">
                                Most Common Mood
                            </p>

                            <p className="text-base font-semibold">
                                {mostMood}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-textSecondary mb-1">
                                Best Day
                            </p>

                            <p className="text-base font-semibold">
                                {bestDay}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm text-textSecondary mb-1">
                                AI Conversations
                            </p>

                            <p className="text-base font-semibold">
                                {chatCount}
                            </p>
                        </div>

                    </div>

                </div>

            </div>

            {/* =========================
                INSIGHT
            ========================= */}

            <div className="bg-primaryLight p-6 rounded-2xl w-full max-w-full overflow-hidden">

                <h2 className="font-semibold mb-2">
                    Insight
                </h2>

                <p className="text-textSecondary">
                    {getInsight()}
                </p>

            </div>

        </div>
    );
}

export default Insights;