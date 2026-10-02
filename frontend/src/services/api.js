const API_URL = "http://127.0.0.1:8000";

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