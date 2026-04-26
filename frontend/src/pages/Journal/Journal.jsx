import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFloppyDisk,
  faTrash,
  faPen,
} from "@fortawesome/free-solid-svg-icons";

import Card from "../../components/common/Card";
import Button from "../../components/common/Button";

function Journal() {
  const [entry, setEntry] = useState("");
  const [entries, setEntries] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [selectedMood, setSelectedMood] = useState("");

  const moods = ["😊 Happy", "😟 Anxious", "😢 Sad", "😌 Calm", "😫 Stressed"];

  // Load
  useEffect(() => {
    const saved = localStorage.getItem("journalEntries");
    if (saved) setEntries(JSON.parse(saved));
  }, []);

  // Save
  useEffect(() => {
    localStorage.setItem("journalEntries", JSON.stringify(entries));
  }, [entries]);

  const handleSave = () => {
    if (!entry.trim()) return;

    const newEntry = {
      text: entry,
      mood: selectedMood,
     date: new Date().toISOString(),
    };

    if (editingIndex !== null) {
      const updated = [...entries];
      updated[editingIndex] = newEntry;
      setEntries(updated);
      setEditingIndex(null);
    } else {
      setEntries([newEntry, ...entries]);
    }

    setEntry("");
    setSelectedMood("");
  };

  const handleDelete = (index) => {
    const updated = entries.filter((_, i) => i !== index);
    setEntries(updated);
  };

  const handleEdit = (index) => {
    const item = entries[index];
    setEntry(item.text);
    setSelectedMood(item.mood);
    setEditingIndex(index);
  };

  return (
    <div className="p-8 w-full">

      {/* Header */}
      <h1 className="text-3xl font-heading font-semibold text-textPrimary">
        Journal
      </h1>
      <p className="text-textSecondary mt-1 mb-6">
        A safe space for your thoughts
      </p>

      {/* Input */}
      <Card className="mb-6">
        <h2 className="text-lg font-medium mb-3">New Entry</h2>

        {/* Mood Selector */}
        <div className="flex gap-3 mb-4 flex-wrap">
          {moods.map((mood) => (
            <div
              key={mood}
              onClick={() => setSelectedMood(mood)}
              className={`
                px-3 py-1 rounded-xl text-sm cursor-pointer border
                ${
                  selectedMood === mood
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
          onChange={(e) => setEntry(e.target.value)}
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

        {/* Button */}
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} className="flex items-center gap-2">
            <FontAwesomeIcon icon={faFloppyDisk} />
            {editingIndex !== null ? "Update Entry" : "Save Entry"}
          </Button>
        </div>
      </Card>

      {/* Entries */}
      <div className="flex flex-col gap-4">

        {entries.length === 0 && (
          <p className="text-textSecondary">No entries yet</p>
        )}

        {entries.map((item, index) => (
          <Card key={index} className="relative">

            {/* Top Row */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-textSecondary">
                {item.date}
              </span>

              <div className="flex gap-3">
                <FontAwesomeIcon
                  icon={faPen}
                  className="cursor-pointer text-textSecondary hover:text-primary"
                  onClick={() => handleEdit(index)}
                />
                <FontAwesomeIcon
                  icon={faTrash}
                  className="cursor-pointer text-textSecondary hover:text-red-500"
                  onClick={() => handleDelete(index)}
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

    </div>
  );
}

export default Journal;