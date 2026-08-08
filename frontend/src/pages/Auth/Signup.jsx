import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Signup() {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleSignup = (e) => {
        e.preventDefault();

        if (!name || !email || !password || !confirmPassword) {
            alert("Please fill in all fields.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        // Get existing users
        const existingUsers =
            JSON.parse(localStorage.getItem("users")) || [];

        // Check if email is already registered
        const userExists = existingUsers.some(
            (user) => user.email.toLowerCase() === email.toLowerCase()
        );

        if (userExists) {
            alert("An account with this email already exists. Please log in.");
            return;
        }

        // Create new user
        const newUser = {
            name,
            email,
            password,
        };

        // Add new user without deleting existing users
        const updatedUsers = [...existingUsers, newUser];

        localStorage.setItem(
            "users",
            JSON.stringify(updatedUsers)
        );

        // Store currently logged-in user
        localStorage.setItem(
            "currentUser",
            JSON.stringify(newUser)
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
                Create Your Account
            </h1>

            <p className="text-textSecondary mt-2">
                Start your wellness journey with MindEase.
            </p>
            </div>

            <form onSubmit={handleSignup} className="space-y-5">

            {/* Name */}
            <div>
                <label className="block text-sm font-medium text-textPrimary mb-2">
                Name
                </label>

                <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-border rounded-xl
                            focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

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
                placeholder="Create a password"
                className="w-full px-4 py-3 border border-border rounded-xl
                            focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Confirm Password */}
            <div>
                <label className="block text-sm font-medium text-textPrimary mb-2">
                Confirm Password
                </label>

                <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="w-full px-4 py-3 border border-border rounded-xl
                            focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Sign Up */}
            <button
                type="submit"
                className="w-full bg-primary text-white py-3 rounded-xl
                        hover:opacity-90 transition"
            >
                Create Account
            </button>

            </form>

            {/* Login */}
            <p className="text-center text-sm text-textSecondary mt-6">
            Already have an account?{" "}
            <button
                onClick={() => navigate("/login")}
                className="text-primary font-semibold"
            >
                Log In
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

export default Signup;