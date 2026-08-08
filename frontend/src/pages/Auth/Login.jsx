import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = (e) => {
        e.preventDefault();

        if (!email || !password) {
            alert("Please enter your email and password.");
            return;
        }

        const users =
            JSON.parse(localStorage.getItem("users")) || [];

        const matchedUser = users.find(
            (user) =>
            user.email.toLowerCase() === email.toLowerCase() &&
            user.password === password
        );

        if (!matchedUser) {
            alert("Invalid email or password.");
            return;
        }

        // Store currently logged-in user
        localStorage.setItem(
            "currentUser",
            JSON.stringify(matchedUser)
        );

        navigate("/dashboard");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">

        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">

            {/* Logo */}
            <div className="text-center mb-8">
            <div className="text-primary text-3xl mb-2">💜</div>

            <h1 className="text-3xl font-heading font-bold text-textPrimary">
                Welcome Back
            </h1>

            <p className="text-textSecondary mt-2">
                Log in to continue your MindEase journey.
            </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">

            {/* Email */}
            <div>
                <label className="block text-sm font-medium text-textPrimary mb-2">
                Email
                </label>

                <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-border rounded-xl
                            focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Password */}
            <div>
                <label className="block text-sm font-medium text-textPrimary mb-2">
                Password
                </label>

                <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-border rounded-xl
                            focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Login */}
            <button
                type="submit"
                className="w-full bg-primary text-white py-3 rounded-xl
                        hover:opacity-90 transition"
            >
                Log In
            </button>

            </form>

            {/* Sign Up */}
            <p className="text-center text-sm text-textSecondary mt-6">
            Don't have an account?{" "}
            <button
                onClick={() => navigate("/signup")}
                className="text-primary font-semibold"
            >
                Sign Up
            </button>
            </p>

            {/* Back */}
            <button
            onClick={() => navigate("/")}
            className="block mx-auto mt-4 text-sm text-textSecondary"
            >
            ← Back to Home
            </button>

        </div>

        </div>
    );
}

export default Login;