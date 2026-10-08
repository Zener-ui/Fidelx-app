import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { changePassword } from "@/api/auth";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import TopBar from "@/components/layout/TopBar";

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.current_password) e.current_password = "Required";
    if (form.new_password.length < 8) e.new_password = "At least 8 characters";
    if (form.new_password !== form.confirm) e.confirm = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => changePassword({
      current_password: form.current_password,
      new_password: form.new_password,
    }),
    onSuccess: () => {
      toast.success("Password changed successfully");
      navigate(-1);
    },
    onError: (err) => toast.error(err.message || "Failed to change password"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  };

  return (
    <div className="animate-fade-in">
      {/* The top bar keeps its back button; the negative margins let it span the auth card edge to edge. */}
      <div className="-mx-5 -mt-6 mb-6">
        <TopBar title="Change Password" showBack />
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Current password"
          type="password"
          value={form.current_password}
          onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
          error={errors.current_password}
        />
        <Input
          label="New password"
          type="password"
          placeholder="At least 8 characters"
          value={form.new_password}
          onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
          error={errors.new_password}
        />
        <Input
          label="Confirm new password"
          type="password"
          value={form.confirm}
          onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          error={errors.confirm}
        />
        <Button type="submit" size="xl" loading={mutation.isPending}>
          Update password
        </Button>
      </form>
    </div>
  );
}
