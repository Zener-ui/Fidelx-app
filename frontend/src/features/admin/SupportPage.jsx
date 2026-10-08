import { useMemo, useState } from "react";
import { MessageCircle, Search, Send, ShieldAlert, UserRound, Clock3, ChevronRight } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import { getAdminTickets, replyToAdminTicket } from "@/api/admin";
import Button from "@/components/common/Button";
import EmptyState from "@/components/common/EmptyState";
import { Skeleton } from "@/components/common/Loader";

const FILTERS = ["ALL", "OPEN", "IN_PROGRESS", "CRITICAL", "HIGH", "RESOLVED"];
const PRIORITY_STYLE = {
  CRITICAL: "bg-coral",
  HIGH: "bg-sun",
  NORMAL: "bg-peach",
  LOW: "bg-white",
};
const STATUS_STYLE = {
  OPEN: "bg-sun",
  IN_PROGRESS: "bg-mint",
  RESOLVED: "bg-lime",
  CLOSED: "bg-white",
};

const pretty = (value) => String(value || "").replace(/_/g, " ");

export default function AdminSupportPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: getAdminTickets,
    refetchInterval: 30000,
  });
  const tickets = data?.tickets || [];

  const filtered = useMemo(() => tickets.filter((t) => {
    const matchesFilter = filter === "ALL" || t.status === filter || t.priority === filter;
    const matchesRole = roleFilter === "ALL" || t.role === roleFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [t.subject, t.message, t.users?.full_name, t.users?.email, t.order_id].some((v) => String(v || "").toLowerCase().includes(q));
    return matchesFilter && matchesRole && matchesSearch;
  }), [tickets, filter, roleFilter, search]);

  const stats = useMemo(() => ({
    open: tickets.filter((t) => ["OPEN", "IN_PROGRESS"].includes(t.status)).length,
    critical: tickets.filter((t) => t.priority === "CRITICAL").length,
    unassigned: tickets.filter((t) => !t.assigned_to && ["OPEN", "IN_PROGRESS"].includes(t.status)).length,
  }), [tickets]);

  const replyMutation = useMutation({
    mutationFn: ({ id, message }) => replyToAdminTicket(id, message),
    onSuccess: async () => {
      toast.success("Reply sent to the user.");
      setReply("");
      const result = await qc.fetchQuery({ queryKey: ["admin-tickets"] });
      const updated = (result?.tickets || []).find((t) => t.id === selected?.id);
      if (updated) setSelected(updated);
    },
    onError: (err) => toast.error(err.message || "Couldn't send the reply."),
  });

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-teal">Operations</p>
          <h1 className="mt-1 text-2xl font-display font-extrabold tracking-tight text-ink">Support centre</h1>
          <p className="mt-1 text-sm font-semibold text-slate-muted">Reply to customers, vendors and riders from one inbox.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 md:w-[360px]">
          <div className="rounded-2xl border border-surface-border bg-surface p-3"><p className="text-[10px] font-bold text-slate-muted">Open</p><p className="mt-1 text-lg font-extrabold text-ink">{stats.open}</p></div>
          <div className="rounded-2xl border border-surface-border bg-surface p-3"><p className="text-[10px] font-bold text-slate-muted">Critical</p><p className="mt-1 text-lg font-extrabold text-ink">{stats.critical}</p></div>
          <div className="rounded-2xl border border-surface-border bg-surface p-3"><p className="text-[10px] font-bold text-slate-muted">Unassigned</p><p className="mt-1 text-lg font-extrabold text-ink">{stats.unassigned}</p></div>
        </div>
      </div>

      <div className="mb-4 space-y-3 rounded-2xl border border-surface-border bg-surface p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets, people or order IDs…" className="w-full rounded-xl border border-surface-border bg-navy py-2.5 pl-9 pr-3 text-sm text-ink outline-none focus:border-teal" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((item) => (
            <button key={item} type="button" onClick={() => setFilter(item)} className={clsx("shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-all", filter === item ? "border-teal bg-teal/10 text-teal" : "border-surface-border text-slate-muted")}>{pretty(item)}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {["ALL", "customer", "vendor", "rider"].map((item) => (
            <button key={item} type="button" onClick={() => setRoleFilter(item)} className={clsx("rounded-full border px-3 py-1.5 text-xs font-bold", roleFilter === item ? "border-teal bg-teal/10 text-teal" : "border-surface-border text-slate-muted")}>{item === "ALL" ? "All roles" : item}</button>
          ))}
        </div>
      </div>

      {isLoading ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="mb-3 h-24 rounded-2xl" />)
        : filtered.length === 0 ? <EmptyState icon={MessageCircle} title="No matching tickets" description="New support requests will appear here automatically." />
        : <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,460px)]">
          <div className="space-y-3">
            {filtered.map((t) => (
              <button key={t.id} type="button" onClick={() => { setSelected(t); setReply(""); }} className={clsx("w-full rounded-2xl border p-4 text-left transition-all", selected?.id === t.id ? "border-teal bg-teal/5" : "border-surface-border bg-surface hover:border-navy-light")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-ink">{t.subject}</p><p className="mt-1 text-xs font-semibold text-slate-muted">{t.users?.full_name || "Unknown user"} · {t.role} · {t.order_id ? `Order ${String(t.order_id).slice(0, 8)}` : "No order linked"}</p></div>
                  <span className={clsx("shrink-0 rounded-full border border-surface-border px-2 py-1 text-[10px] font-extrabold", PRIORITY_STYLE[t.priority] || "bg-white")}>{t.priority}</span>
                </div>
                <div className="mt-3 flex items-center justify-between"><span className={clsx("rounded-full px-2 py-1 text-[10px] font-bold", STATUS_STYLE[t.status] || "bg-white")}>{pretty(t.status)}</span><ChevronRight className="h-4 w-4 text-slate-muted" /></div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-surface-border bg-surface p-4 lg:sticky lg:top-4 lg:h-fit">
            {!selected ? <div className="grid min-h-[360px] place-items-center text-center"><div><MessageCircle className="mx-auto mb-3 h-8 w-8 text-slate-muted" /><p className="font-extrabold text-ink">Select a ticket</p><p className="mt-1 text-xs font-semibold text-slate-muted">The full conversation and reply box will appear here.</p></div></div> : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-extrabold text-ink">{selected.subject}</p><p className="mt-1 text-xs font-semibold text-slate-muted">{selected.users?.full_name} · {selected.users?.email}</p></div><span className={clsx("rounded-full px-2 py-1 text-[10px] font-extrabold", STATUS_STYLE[selected.status] || "bg-white")}>{pretty(selected.status)}</span></div>
                <div className="flex flex-wrap gap-2 text-[10px] font-bold text-slate-muted"><span className="rounded-full border border-surface-border px-2 py-1"><UserRound className="mr-1 inline h-3 w-3" />{selected.role}</span>{selected.order_id && <span className="rounded-full border border-surface-border px-2 py-1"><Package className="mr-1 inline h-3 w-3" />Order {String(selected.order_id).slice(0, 8)}</span>}{selected.sla_deadline && <span className="rounded-full border border-surface-border px-2 py-1"><Clock3 className="mr-1 inline h-3 w-3" />SLA {new Date(selected.sla_deadline).toLocaleString("en-NG")}</span>}</div>
                <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
                  <div className="rounded-xl border border-surface-border bg-navy p-3"><p className="mb-1 text-[10px] font-bold text-slate-muted">Original request</p><p className="whitespace-pre-wrap text-sm font-semibold text-ink">{selected.message}</p></div>
                  {(selected.messages || []).map((m, i) => <div key={`${m.sent_at || "m"}-${i}`} className={clsx("rounded-xl border p-3", m.sender === "admin" ? "ml-4 border-teal/20 bg-teal/5" : "border-surface-border bg-navy")}><p className="mb-1 text-[10px] font-bold text-slate-muted">{m.sender === "admin" ? "Admin" : selected.users?.full_name || "User"}</p><p className="whitespace-pre-wrap text-sm text-ink">{m.message}</p></div>)}
                </div>
                <div className="border-t border-surface-border pt-3"><textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} placeholder="Write a helpful reply…" className="w-full resize-none rounded-xl border border-surface-border bg-navy px-3 py-3 text-sm text-ink outline-none focus:border-teal" /><Button className="mt-2 w-full" size="lg" loading={replyMutation.isPending} disabled={!reply.trim()} onClick={() => replyMutation.mutate({ id: selected.id, message: reply.trim() })}><Send className="mr-2 h-4 w-4" /> Reply to user</Button></div>
                <div className="flex items-center gap-2 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-3 text-xs font-semibold text-slate-muted"><ShieldAlert className="h-4 w-4 shrink-0 text-yellow-400" />Keep replies specific and avoid asking users to resend sensitive credentials, PINs or OTPs.</div>
              </div>
            )}
          </div>
        </div>}
    </div>
  );
}
