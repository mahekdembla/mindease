export function getReply(message) {
  const text = message.toLowerCase();

  if (text.includes("sad")) {
    return "I'm here for you. It's okay to feel sad sometimes 💙";
  }

  if (text.includes("alone")) {
    return "You're not alone. I'm here with you 🤝";
  }

  if (text.includes("anxious") || text.includes("anxiety")) {
    return "Take a deep breath. You're safe right now 🌿";
  }

  if (text.includes("happy") || text.includes("excited")) {
    return "That's amazing! Keep enjoying the moment ✨";
  }

  if (text.includes("medical") || text.includes("pain")) {
    return "It might be helpful to consult a professional 👩‍⚕️";
  }

  return "Tell me more about how you're feeling 💭";
}