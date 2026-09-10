"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

type AuthFormProps = { mode: "login" | "signup" };

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    setSuccess(null);
    if (!identifier.trim() || !password.trim() || (isSignup && !name.trim()))
      return;

    setIsSubmitting(true);
    try {
      if (isSignup) {
        const result = await signUp(name, identifier, password);
        if (result.requiresEmailConfirmation) {
          setSuccess(
            "Account created. Check your email to confirm your address, then sign in.",
          );
          return;
        }
      } else {
        await signIn(identifier, password);
      }
      router.replace("/chat");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We could not complete that request. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10"
      id="main-content"
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-3 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-navy)] text-[11px] font-bold tracking-tight text-white">
              BIS
            </span>
            <span className="text-left">
              <span className="block text-base font-semibold text-[var(--color-text-primary)]">
                BIS Sahayak
              </span>
              <span className="block text-xs text-[var(--color-text-muted)]">
                Bureau of Indian Standards
              </span>
            </span>
          </Link>
          <h1 className="mt-8 text-2xl font-bold text-gray-900">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isSignup
              ? "Start exploring Indian Standards and BIS services."
              : "Sign in to continue to BIS Sahayak."}
          </p>
        </div>
        <section className="rounded-xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
          {error && (
            <p
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          )}
          {success && (
            <p
              className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              role="status"
            >
              {success}
            </p>
          )}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {isSignup && (
              <div>
                <label
                  htmlFor="name"
                  className="text-sm font-semibold text-gray-900"
                >
                  Name
                </label>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
                />
                {submitted && !name.trim() && (
                  <p className="mt-1 text-xs text-red-700">Enter your name.</p>
                )}
              </div>
            )}
            <div>
              <label
                htmlFor="identifier"
                className="text-sm font-semibold text-gray-900"
              >
                Email or username
              </label>
              <input
                id="identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
              />
              {submitted && !identifier.trim() && (
                <p className="mt-1 text-xs text-red-700">
                  Enter your email or username.
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="password"
                className="text-sm font-semibold text-gray-900"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                className="mt-2 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 shadow-sm focus:border-[var(--color-navy)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)]/20"
              />
              {submitted && !password.trim() && (
                <p className="mt-1 text-xs text-red-700">
                  Enter your password.
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-lg bg-[var(--color-navy)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-navy-light)] focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] focus:ring-offset-2"
            >
              {isSubmitting
                ? isSignup
                  ? "Creating account..."
                  : "Signing in..."
                : isSignup
                  ? "Sign Up"
                  : "Sign In"}
            </button>
          </form>
        </section>
        <p className="mt-5 text-center text-sm text-gray-600">
          {isSignup ? "Already have an account? " : "Don't have an account? "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="font-semibold text-[var(--color-navy)] hover:underline"
          >
            {isSignup ? "Sign in" : "Sign up"}
          </Link>
        </p>
      </div>
    </main>
  );
}
