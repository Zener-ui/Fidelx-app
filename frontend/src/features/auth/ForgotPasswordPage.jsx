import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { forgotPassword } from "@/api/auth";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: forgotPassword,
    // No onError branching into a different UI state on purpose — the
    // backend always returns success here (that's the anti-enumeration
    // design), so the only real failure mode is a network/server error,
    // which we still show as a toast-free inline message below.
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter the email you registered with");
      return;
    }
    setError("");
    mutation.mutate({ email: email.trim() });
  };

  if (mutation.isSuccess) {
    return (
      <div className="animate-fade-in text-center">
        <h2 className="text-ink text-xl font-bold mb-2">Check your email</h2>
        <p className="text-slate-muted text-sm mb-6">
          If an account exists for <span className="text-ink font-medium">{email}</span>, we've sent a link to reset your password. It expires in 20 minutes.
        </p>
        <Link to="/login" className="text-teal text-sm font-medium hover:underline">
          ← Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h2 className="font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-ink">Forgot your password?</h2>
      <p className="mb-6 mt-2 font-medium text-slate-muted">
        Enter your email and we'll send you a link to reset it.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          autoComplete="email"
        />

        {mutation.isError && (
          <p className="text-sm font-semibold text-red-400">
            Something went wrong. Please try again in a moment.
          </p>
        )}

        <Button type="submit" size="xl" loading={mutation.isPending} disabled={mutation.isPending}>
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm font-semibold text-slate-muted">
        Remembered it?{" "}
        <Link to="/login" className="font-extrabold text-ink underline decoration-2 underline-offset-4">
          Back to login
        </Link>
      </p>

      <div className="mt-6 border-t-2 border-dashed border-ink/30 pt-6 text-center">
        <p className="mb-2 text-xs font-bold text-slate-muted">Still can't get in?</p>
        <Link to="/customer/support" className="text-sm font-extrabold text-ink underline decoration-2 underline-offset-4">
          Contact support
        </Link>
      </div>
    </div>
  );
}
