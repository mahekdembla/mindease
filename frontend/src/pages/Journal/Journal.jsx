import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faFloppyDisk,
    faTrash,
    faPen,
    faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

import Card from "../../components/common/Card";
import Button from "../../components/common/Button";

function Journal() {
    const [entry, setEntry] = useState("");
    const [entries, setEntries] = useState([]);
    const [editingIndex, setEditingIndex] = useState(null);
    const [selectedMood, setSelectedMood] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Delete confirmation
    const [deleteIndex, setDeleteIndex] = useState(null);

    // Reference to journal editor
    const inputRef = useRef(null);

    const moods = [
        "😊 Happy",
        "😟 Anxious",
        "😢 Sad",
        "😌 Calm",
        "😫 Stressed",
    ];

    // Load journal entries from FastAPI
    useEffect(() => {
        const loadEntries = async () => {
            try {
                const response = await fetch(
                    "http://127.0.0.1:8000/journal"
                );

                if (!response.ok) {
                    throw new Error("Failed to load journal");
                }

                const data = await response.json();

                const formattedEntries = data.map((item) => ({
                    id: item.id,
                    text: item.text,
                    mood: item.mood || "",
                    date: item.time,
                }));

                setEntries(formattedEntries);

            } catch (error) {
                console.error(
                    "Failed to load journal:",
                    error
                );
            }
        };

        loadEntries();
    }, []);

    // Save / Update journal entry
    const handleSave = async () => {
        if (!entry.trim() || isLoading) return;

        setIsLoading(true);

        try {
            let response;

            // UPDATE existing entry
            if (editingIndex !== null) {
                const existingEntry =
                    entries[editingIndex];

                response = await fetch(
                    `http://127.0.0.1:8000/journal/${existingEntry.id}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            text: entry.trim(),
                            mood: selectedMood,
                        }),
                    }
                );

            // CREATE new entry
            } else {
                response = await fetch(
                    "http://127.0.0.1:8000/journal",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            text: entry.trim(),
                            mood: selectedMood,
                        }),
                    }
                );
            }

            if (!response.ok) {
                throw new Error(
                    "Failed to save journal"
                );
            }

            const data = await response.json();

            const updatedEntry = {
                id: data.entry.id,
                text: data.entry.text,
                mood: data.entry.mood,
                date: data.entry.time,
            };

            // Update existing entry in UI
            if (editingIndex !== null) {
                const updated = [...entries];

                updated[editingIndex] =
                    updatedEntry;

                setEntries(updated);
                setEditingIndex(null);

            // Add new entry
            } else {
                setEntries([
                    updatedEntry,
                    ...entries,
                ]);
            }

            setEntry("");
            setSelectedMood("");

        } catch (error) {
            console.error(
                "Failed to save journal:",
                error
            );

            alert(
                "Could not save your journal entry."
            );

        } finally {
            setIsLoading(false);
        }
    };

    // Start editing
    const handleEdit = (index) => {
        const item = entries[index];

        setEntry(item.text);
        setSelectedMood(item.mood || "");
        setEditingIndex(index);

        // Automatically scroll to editor
        setTimeout(() => {
            inputRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 100);
    };

    // Open delete confirmation
    const handleDeleteClick = (index) => {
        setDeleteIndex(index);
    };

    // Confirm delete
    const confirmDelete = async () => {
        if (deleteIndex === null) return;

        const item = entries[deleteIndex];

        try {
            const response = await fetch(
                `http://127.0.0.1:8000/journal/${item.id}`,
                {
                    method: "DELETE",
                }
            );

            if (!response.ok) {
                throw new Error(
                    "Failed to delete journal entry"
                );
            }

            setEntries(
                entries.filter(
                    (_, i) => i !== deleteIndex
                )
            );

            setDeleteIndex(null);

        } catch (error) {
            console.error(
                "Delete error:",
                error
            );

            alert(
                "Could not delete journal entry."
            );
        }
    };

    // Cancel delete
    const cancelDelete = () => {
        setDeleteIndex(null);
    };

    return (
        <div className="w-full p-8">

            {/* Header */}
            <h1 className="text-3xl font-heading font-semibold text-textPrimary">
                Journal
            </h1>

            <p className="text-textSecondary mt-1 mb-6">
                A safe space for your thoughts
            </p>

            {/* Journal Editor */}
            <div ref={inputRef}>
                <Card className="mb-6">

                    <h2 className="text-lg font-medium mb-3">
                        {editingIndex !== null
                            ? "Edit Entry"
                            : "New Entry"}
                    </h2>

                    {/* Mood Selector */}
                    <div className="flex gap-3 mb-4 flex-wrap">

                        {moods.map((mood) => (
                            <div
                                key={mood}
                                onClick={() =>
                                    setSelectedMood(
                                        mood
                                    )
                                }
                                className={`
                                    px-3 py-1 rounded-xl text-sm cursor-pointer border
                                    ${
                                        selectedMood ===
                                        mood
                                            ? "bg-primaryLight text-primary border-primary"
                                            : "border-border text-textSecondary hover:bg-primaryLight"
                                    }
                                `}
                            >
                                {mood}
                            </div>
                        ))}

                    </div>

                    {/* Textarea */}
                    <textarea
                        value={entry}
                        onChange={(e) =>
                            setEntry(e.target.value)
                        }
                        placeholder="What's on your mind? Write freely without judgment..."
                        className="
                            w-full h-40 p-4 rounded-2xl outline-none resize-none text-textPrimary
                            bg-[#FAFAFF]
                            border border-[#D6CCFF]
                            focus:border-[#B8A9FF]
                            focus:ring-2 focus:ring-[#D6CCFF]/40
                            transition-all duration-200
                        "
                    />

                    {/* Enter Button */}
                    <div className="mt-4 flex justify-end">

                        <Button
                            onClick={handleSave}
                            disabled={
                                isLoading ||
                                !entry.trim()
                            }
                            className="flex items-center gap-2"
                        >
                            <FontAwesomeIcon
                                icon={faFloppyDisk}
                            />

                            {isLoading
                                ? "Entering..."
                                : "Enter"}
                        </Button>

                    </div>

                </Card>
            </div>

            {/* Entries */}
            <div className="flex flex-col gap-4">

                {entries.length === 0 && (
                    <p className="text-textSecondary">
                        No entries yet
                    </p>
                )}

                {entries.map((item, index) => (

                    <Card
                        key={item.id}
                        className="relative"
                    >

                        {/* Top Row */}
                        <div className="flex justify-between items-center mb-2">

                            <span className="text-sm text-textSecondary">
                                {item.date}
                            </span>

                            <div className="flex gap-3">

                                {/* Edit */}
                                <FontAwesomeIcon
                                    icon={faPen}
                                    className="cursor-pointer text-textSecondary hover:text-primary"
                                    onClick={() =>
                                        handleEdit(
                                            index
                                        )
                                    }
                                />

                                {/* Delete */}
                                <FontAwesomeIcon
                                    icon={faTrash}
                                    className="cursor-pointer text-textSecondary hover:text-red-500"
                                    onClick={() =>
                                        handleDeleteClick(
                                            index
                                        )
                                    }
                                />

                            </div>

                        </div>

                        {/* Mood */}
                        {item.mood && (
                            <div className="text-sm mb-2 text-primary font-medium">
                                {item.mood}
                            </div>
                        )}

                        {/* Text */}
                        <p className="text-textPrimary leading-relaxed">
                            {item.text}
                        </p>

                    </Card>

                ))}

            </div>

            {/* Delete Confirmation Modal */}
            {deleteIndex !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">

                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">

                        {/* Warning Icon */}
                        <div className="flex justify-center mb-4">

                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">

                                <FontAwesomeIcon
                                    icon={
                                        faTriangleExclamation
                                    }
                                    className="text-red-500 text-xl"
                                />

                            </div>

                        </div>

                        {/* Title */}
                        <h2 className="text-xl font-semibold text-center text-textPrimary">
                            Delete this entry?
                        </h2>

                        {/* Message */}
                        <p className="text-sm text-textSecondary text-center mt-2">
                            Are you sure you want to
                            delete this journal entry?
                            This action cannot be undone.
                        </p>

                        {/* Buttons */}
                        <div className="flex justify-center gap-3 mt-6">

                            <button
                                onClick={cancelDelete}
                                className="px-5 py-2 rounded-xl border border-border text-textSecondary hover:bg-gray-100 transition"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={confirmDelete}
                                className="px-5 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition"
                            >
                                Delete
                            </button>

                        </div>

                    </div>

                </div>
            )}

        </div>
    );
}

export default Journal;