import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { login } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { roleHomePath } from "@/utils";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import AuthTabs from "./AuthTabs";
import { Capacitor } from "@capacitor/core";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: storeLogin, logout } = useAuthStore();
  const nativeAppRole = Capacitor.isNativePlatform() ? (import.meta.env.VITE_APP_ROLE || "customer") : null;

  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.identifier.trim()) e.identifier = "Enter your email or phone number";
    if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: (payload) => login({ ...payload, persistent_session: Boolean(nativeAppRole) }),
    onSuccess: (data) => {
      if (nativeAppRole && data.user?.role !== nativeAppRole) {
        logout();
        toast.error(`This app is for ${nativeAppRole}s. Please use the correct Fidelx app for your account.`);
        return;
      }
      storeLogin(data.token, data.user);
      toast.success(`Welcome back, ${data.user.full_name.split(" ")[0]}!`);
      const from = location.state?.from?.pathname || roleHomePath(data.user.role);
      navigate(from, { replace: true });
    },
    onError: (err) => {
      toast.error(err.message || "Login failed. Check your credentials.");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate(form);
  };

  return (
    <div className="animate-fade-in">
      <AuthTabs active="login" state={location.state} />

      <h2 className="font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-ink">Welcome back</h2>
      <p className="mb-6 mt-2 font-medium text-slate-muted">Sign in to your account</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email or phone number"
          type="text"
          placeholder="you@example.com or 08012345678"
          value={form.identifier}
          onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
          error={errors.identifier}
          autoComplete="username"
        />
        <Input
          label="Password"
          type="password"
          placeholder="Your password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          error={errors.password}
          autoComplete="current-password"
        />

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-bold text-ink underline decoration-2 underline-offset-4">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          size="xl"
          loading={mutation.isPending}
          disabled={mutation.isPending}
        >
          Sign in
        </Button>
      </form>
    </div>
  );
}
