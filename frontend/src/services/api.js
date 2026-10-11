// In development this defaults to http://127.0.0.1:8000.
// For production, set VITE_API_URL in your Vercel / Netlify environment to your
// Render / Railway backend URL (e.g. https://mindease-backend.onrender.com).
export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function getAuthHeaders() {
    const headers = {
        "Content-Type": "application/json",
    };
    const token = localStorage.getItem("mindease_token");
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

export async function loginUser(email, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || "Login failed");
    }

    if (data.token) {
        localStorage.setItem("mindease_token", data.token);
    }
    return data;
}

export async function signupUser(name, email, password) {
    const response = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || "Signup failed");
    }

    if (data.token) {
        localStorage.setItem("mindease_token", data.token);
    }
    return data;
}

export async function getCurrentUser() {
    const response = await fetch(`${API_URL}/auth/me`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    if (!response.ok) {
        return null;
    }

    return await response.json();
}

export async function logoutUser() {
    try {
        await fetch(`${API_URL}/auth/logout`, {
            method: "POST",
            headers: getAuthHeaders(),
            credentials: "include",
        });
    } catch (e) {
        console.error("Logout API error:", e);
    }
    localStorage.removeItem("mindease_token");
    localStorage.removeItem("currentUser");
}

export async function sendChatMessage(message, conversationId = null) {
    const payload = { message };
    if (conversationId) {
        payload.conversation_id = conversationId;
    }

    const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error("Failed to connect to MindEase backend");
    }

    return await response.json();
}

export async function fetchConversations() {
    const response = await fetch(`${API_URL}/conversations`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    if (!response.ok) {
        return [];
    }

    return await response.json();
}

export async function fetchConversationMessages(conversationId) {
    const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    if (!response.ok) {
        return [];
    }

    return await response.json();
}

export async function deleteConversation(conversationId) {
    const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to delete conversation");
    }

    return await response.json();
}

export async function fetchChatHistory() {
    const response = await fetch(`${API_URL}/chat-history`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    if (!response.ok) {
        return [];
    }

    return await response.json();
}

export async function fetchJournalEntries() {
    const response = await fetch(`${API_URL}/journal`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    if (!response.ok) {
        return [];
    }

    return await response.json();
}

export async function saveJournalEntry(entryData, moodArg = "") {
    const payload = typeof entryData === "object" && entryData !== null
        ? entryData
        : { text: entryData, mood: moodArg };

    const response = await fetch(`${API_URL}/journal`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error("Failed to save journal entry");
    }

    return await response.json();
}

export async function updateJournalEntry(id, entryData, moodArg = "") {
    const payload = typeof entryData === "object" && entryData !== null
        ? entryData
        : { text: entryData, mood: moodArg };

    const response = await fetch(`${API_URL}/journal/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error("Failed to update journal entry");
    }

    return await response.json();
}

export async function deleteJournalEntry(id) {
    const response = await fetch(`${API_URL}/journal/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to delete journal entry");
    }

    return await response.json();
}

export async function fetchInsights(view = "weekly") {
    const response = await fetch(`${API_URL}/insights?view=${encodeURIComponent(view)}`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch insights");
    }

    return await response.json();
}

export async function fetchDashboard() {
    const response = await fetch(`${API_URL}/dashboard`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
    }

    return await response.json();
}

export async function saveMoodCheckin(core_emotion, specific_feeling = null, granular_feeling = null) {
    const response = await fetch(`${API_URL}/mood-checkin`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({
            core_emotion,
            specific_feeling,
            granular_feeling
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to save mood check-in");
    }

    return await response.json();
}
export async function fetchQuestionnairePrompts() {
    const response = await fetch(`${API_URL}/questionnaire/prompts`, {
        method: "GET",
        headers: getAuthHeaders(),
        credentials: "include",
    });

    if (!response.ok) {
        throw new Error("Failed to fetch questionnaire prompts");
    }

    return await response.json();
}

export async function submitQuestionnaire(answers, note = "") {
    const response = await fetch(`${API_URL}/questionnaire`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ ...answers, note }),
    });

    if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
            const data = await response.json();
            if (typeof data.detail === "string") {
                detail = data.detail;
            } else if (Array.isArray(data.detail)) {
                detail = data.detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
            }
        } catch {
            // response body wasn't JSON - keep the HTTP status as the detail
        }
        throw new Error(`Failed to submit questionnaire: ${detail}`);
    }

    return await response.json();
}

// Sends an SOS email to the logged-in user's SOS-enabled trusted contacts.
// Resolves to { sent, simulated, message }; throws with the server's reason on failure.
export async function sendSosAlert(emails = [], automatic = false) {
    const response = await fetch(`${API_URL}/api/sos`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ emails, automatic }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(
            response.status === 401
                ? "Please log in to send SOS alerts."
                : data.detail || "Failed to send SOS alert"
        );
    }
    return data;
}

export async function updateProfile(name, email) {
    const response = await fetch(`${API_URL}/auth/me`, {
        method: "PUT",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ name, email }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.detail || "Failed to update profile");
    }
    return data;
}

// Streams a chat reply from /chat/stream (Server-Sent Events).
// onDelta(textPiece) is called as the reply is written; resolves with the final payload
// (same fields as sendChatMessage). Throws if the stream fails; err.receivedText tells the
// caller whether part of the reply had already arrived.
export async function streamChatMessage(message, conversationId = null, onDelta = () => {}) {
    const payload = { message };
    if (conversationId) {
        payload.conversation_id = conversationId;
    }

    const response = await fetch(`${API_URL}/chat/stream`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
        throw new Error("Failed to connect to MindEase backend");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let receivedText = false;

    const fail = (msg) => {
        const err = new Error(msg);
        err.receivedText = receivedText;
        return err;
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const line = raw.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;

            const event = JSON.parse(line.slice(5).trim());
            if (event.type === "delta") {
                receivedText = true;
                onDelta(event.text);
            } else if (event.type === "done") {
                return event;
            } else if (event.type === "error") {
                throw fail(event.message || "Stream error");
            }
        }
    }

    throw fail("The reply was interrupted");
}
