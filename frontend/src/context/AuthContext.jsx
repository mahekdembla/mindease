/**
 * AuthContext.jsx
 *
 * Provides a centralized React context for authentication state across the
 * entire MindEase application.
 *
 * Features:
 *  - Persists the JWT token in localStorage ("mindease_token").
 *  - On mount, re-validates the stored token against /auth/me so the UI
 *    always reflects the server-side session state.
 *  - Exposes login(), signup(), logout(), and the current user object.
 *  - Handles OAuth token injection from URL query params (Google / GitHub
 *    redirect flow appends ?token=<jwt>).
 *  - Works alongside the existing App.jsx demo-timer logic without conflicts.
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { loginUser, signupUser, logoutUser, getCurrentUser } from "../services/api";

// ---------------------------------------------------------------------------
// Context Definition
// ---------------------------------------------------------------------------

const AuthContext = createContext(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        // Seed from localStorage for instant first-render (avoids flash of
        // unauthenticated UI). Always re-verified against the server below.
        try {
            const cached = localStorage.getItem("currentUser");
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null;
        }
    });

    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError]     = useState(null);

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /** Persist user info + token in localStorage. */
    const _persistUser = useCallback((userData, token) => {
        if (userData) {
            localStorage.setItem("currentUser", JSON.stringify(userData));
        }
        if (token) {
            localStorage.setItem("mindease_token", token);
        }
    }, []);

    /** Remove all auth data from localStorage. */
    const _clearStorage = useCallback(() => {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("mindease_token");
        localStorage.removeItem("demoStartedAt");
        localStorage.removeItem("demoLocked");
    }, []);

    // -----------------------------------------------------------------------
    // Initial Auth Verification
    // Runs once on mount (and again if the pathname changes — handled by App).
    // -----------------------------------------------------------------------

    useEffect(() => {
        const verify = async () => {
            // Capture OAuth token injected into the URL by Google/GitHub callback.
            const params       = new URLSearchParams(window.location.search);
            const urlToken     = params.get("token");
            if (urlToken) {
                localStorage.setItem("mindease_token", urlToken);
                // Clean the token out of the address bar.
                window.history.replaceState({}, document.title, window.location.pathname);
            }

            try {
                const currentUser = await getCurrentUser();
                if (currentUser) {
                    setUser(currentUser);
                    _persistUser(currentUser, null);
                    // Authenticated users are never subject to demo locks.
                    localStorage.removeItem("demoStartedAt");
                    localStorage.removeItem("demoLocked");
                } else {
                    // Token missing or expired — clear stale data.
                    setUser(null);
                    localStorage.removeItem("currentUser");
                }
            } catch (err) {
                // Network error: keep whatever is cached so the UI doesn't flash.
                console.warn("[AuthContext] Could not verify session:", err.message);
            } finally {
                setAuthLoading(false);
            }
        };

        verify();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Log in with email + password.
     * Stores the JWT and updates user state.
     * Throws on failure so callers can surface error messages.
     */
    const login = useCallback(async (email, password) => {
        setAuthError(null);
        try {
            const data = await loginUser(email, password);
            if (data?.user) {
                setUser(data.user);
                _persistUser(data.user, data.token);
                // Clear any demo residue on real login.
                localStorage.removeItem("demoStartedAt");
                localStorage.removeItem("demoLocked");
            }
            return data;
        } catch (err) {
            setAuthError(err.message || "Login failed.");
            throw err;
        }
    }, [_persistUser]);

    /**
     * Create a new account.
     * Stores the JWT and updates user state.
     * Throws on failure so callers can surface error messages.
     */
    const signup = useCallback(async (name, email, password) => {
        setAuthError(null);
        try {
            const data = await signupUser(name, email, password);
            if (data?.user) {
                setUser(data.user);
                _persistUser(data.user, data.token);
                localStorage.removeItem("demoStartedAt");
                localStorage.removeItem("demoLocked");
            }
            return data;
        } catch (err) {
            setAuthError(err.message || "Signup failed.");
            throw err;
        }
    }, [_persistUser]);

    /**
     * Log out — invalidates the token on the server and clears local state.
     */
    const logout = useCallback(async () => {
        try {
            await logoutUser();
        } catch (err) {
            console.warn("[AuthContext] Logout API call failed:", err.message);
        } finally {
            setUser(null);
            _clearStorage();
        }
    }, [_clearStorage]);

    /**
     * Manually refresh the user object from the server.
     * Useful after a profile update.
     */
    const refreshUser = useCallback(async () => {
        try {
            const currentUser = await getCurrentUser();
            if (currentUser) {
                setUser(currentUser);
                _persistUser(currentUser, null);
            }
        } catch (err) {
            console.warn("[AuthContext] refreshUser failed:", err.message);
        }
    }, [_persistUser]);

    // -----------------------------------------------------------------------
    // Context Value
    // -----------------------------------------------------------------------

    const value = {
        /** The authenticated user object, or null if unauthenticated. */
        user,
        /** True while the initial token verification is in progress. */
        authLoading,
        /** Last authentication error string, or null. */
        authError,
        /** True when a user is authenticated. */
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        refreshUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// ---------------------------------------------------------------------------
// Custom Hook
// ---------------------------------------------------------------------------

/**
 * useAuth() — consume the AuthContext.
 *
 * Example:
 *   const { user, login, logout, isAuthenticated } = useAuth();
 */
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth() must be used inside an <AuthProvider>.");
    }
    return ctx;
}

export default AuthContext;
