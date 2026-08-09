const API_URL = "http://127.0.0.1:8000";

export async function sendChatMessage(message) {
    const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            message: message,
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to connect to MindEase backend");
    }

    return await response.json();
}