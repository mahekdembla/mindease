export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#9B6DFF",
        primaryLight: "#EDE7FF",

        background: "#F9FAFB",
        card: "#FFFFFF",
        border: "#E5E7EB",

        textPrimary: "#1F2937",
        textSecondary: "#6B7280",

        happy: "#A5D6A7",
        anxious: "#FFE082",
        sad: "#90CAF9",
        calm: "#CE93D8",
        stressed: "#EF9A9A",
      },
      fontFamily: {
      heading: ["Poppins", "sans-serif"],
      body: ["Inter", "sans-serif"],
    },
    },
  },
  plugins: [],
}