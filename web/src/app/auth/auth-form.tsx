"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signUp, logIn, type AuthState } from "./actions";

const initialState: AuthState = { error: null };

export default function AuthForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signup" | "login">(
    searchParams.get("mode") === "login" ? "login" : "signup",
  );
  const action = mode === "signup" ? signUp : logIn;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="wrap-narrow">
      <div className="card-panel">
        <div className="auth-tabs">
          <div
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => setMode("signup")}
          >
            Sign Up
          </div>
          <div
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
          >
            Log In
          </div>
        </div>

        <form action={formAction}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
            {pending ? "Please wait..." : mode === "signup" ? "Create Account" : "Log In"}
          </button>
          <div className={`msg ${state.error ? "error" : ""}`}>{state.error}</div>
        </form>
      </div>
    </div>
  );
}
