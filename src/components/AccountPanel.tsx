import { useState } from "react";
import { LogIn, LogOut, UserCircle2 } from "lucide-react";
import type { Account } from "../useUser";

interface AccountPanelProps {
  account: Account | null;
  onSignup: (username: string, password: string, email?: string) => Promise<{ ok: boolean; error?: string }>;
  onLogin: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  onLogout: () => Promise<void>;
}

type Mode = "closed" | "signup" | "login";

export default function AccountPanel({ account, onSignup, onLogin, onLogout }: AccountPanelProps) {
  const [mode, setMode] = useState<Mode>("closed");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    setUsername("");
    setPassword("");
    setEmail("");
    setError(null);
  };

  const submit = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setError(null);
    const result = mode === "signup" ? await onSignup(username, password, email) : await onLogin(username, password);
    setIsBusy(false);
    if (result.ok) {
      setMode("closed");
      reset();
    } else {
      setError(result.error ?? "Something went wrong.");
    }
  };

  if (account) {
    return (
      <section className="mb-6">
        <div className="border border-matcha/30 rounded-2xl bg-white p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserCircle2 className="w-8 h-8 text-[#2E9D70] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-espresso truncate">{account.username}</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-espresso/45">
                Your plan is saved
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onLogout()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-matcha text-[10px] font-mono font-bold uppercase text-espresso/70 hover:text-espresso cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <div className="border border-matcha/30 rounded-2xl bg-white p-4 space-y-3">
        <div className="flex items-start gap-2.5">
          <LogIn className="w-5 h-5 text-bakedclay shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-espresso">Save your plan</p>
            <p className="text-[11px] text-espresso/60 leading-snug">
              Right now your food plan lives only in this browser. Create an account and it follows you
              to any device.
            </p>
          </div>
        </div>

        {mode === "closed" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                reset();
                setMode("signup");
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#2E9D70] text-white text-[11px] font-bold cursor-pointer"
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setMode("login");
              }}
              className="flex-1 py-2.5 rounded-xl border border-matcha text-[11px] font-bold text-espresso cursor-pointer"
            >
              Log in
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <input
              value={username}
              onChange={(e) => {
                setError(null);
                setUsername(e.target.value);
              }}
              autoComplete="username"
              placeholder="Username"
              className="w-full bg-[#F1F3ED] border border-matcha/30 px-3 py-2.5 rounded-xl text-xs font-semibold text-espresso"
            />
            <input
              value={password}
              onChange={(e) => {
                setError(null);
                setPassword(e.target.value);
              }}
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="Password"
              className="w-full bg-[#F1F3ED] border border-matcha/30 px-3 py-2.5 rounded-xl text-xs font-semibold text-espresso"
            />
            {mode === "signup" && (
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="Email (optional — for password recovery)"
                className="w-full bg-[#F1F3ED] border border-matcha/30 px-3 py-2.5 rounded-xl text-xs font-semibold text-espresso"
              />
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-[11px] text-red-700 p-2.5 rounded-xl">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("closed");
                  reset();
                }}
                disabled={isBusy}
                className="flex-1 py-2.5 rounded-xl border border-matcha text-[11px] font-bold text-espresso cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isBusy}
                className="flex-1 py-2.5 rounded-xl bg-[#2E9D70] text-white text-[11px] font-bold cursor-pointer disabled:opacity-40"
              >
                {isBusy ? "…" : mode === "signup" ? "Create account" : "Log in"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
