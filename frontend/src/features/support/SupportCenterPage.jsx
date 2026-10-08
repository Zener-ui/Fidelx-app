import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  MessageCircle,
  Package,
  Send,
  ShieldAlert,
  Sparkles,
  Wallet,
} from "lucide-react";
import { createTicket, getMyTickets, replyToTicket } from "@/api/support";
import TopBar from "@/components/layout/TopBar";
import Button from "@/components/common/Button";
import Card from "@/components/common/Card";
import Input from "@/components/common/Input";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import { Skeleton } from "@/components/common/Loader";

const CONFIG = {
  customer: {
    title: "Help & support",
    intro: "Get answers quickly or tell the Fidelx team what went wrong.",
    categories: [
      { label: "My order", icon: Package, subject: "Order issue" },
      { label: "Payment", icon: Wallet, subject: "Payment problem" },
      { label: "Delivery", icon: Clock3, subject: "Delivery problem" },
      { label: "Wrong or missing item", icon: ShieldAlert, subject: "Wrong or missing item" },
      { label: "Refund", icon: Wallet, subject: "Refund issue" },
      { label: "Account", icon: CircleHelp, subject: "Account problem" },
      { label: "Something else", icon: MessageCircle, subject: "Other support request" },
    ],
    faqs: [
      ["Where is my order?", "Open Orders to see its latest status. If the delivery looks stuck or the rider cannot reach you, create a support ticket and include the order ID."],
      ["I was charged but my order is not showing", "Keep your payment confirmation and create a Payment ticket. Do not pay again until the issue is checked."],
      ["My order is wrong or damaged", "Create a ticket as soon as you notice the problem. Tell us what is missing or damaged and include the order ID."],
      ["How do refunds work?", "If an eligible refund is needed, Fidelx support can review the order and explain the next step."],
    ],
  },
  vendor: {
    title: "Vendor support",
    intro: "Need help running your store? We can help with orders, products, payouts and your account.",
    categories: [
      { label: "Order problem", icon: Package, subject: "Vendor order problem" },
      { label: "Products or store", icon: Sparkles, subject: "Product or store problem" },
      { label: "Payments or earnings", icon: Wallet, subject: "Payment or earnings problem" },
      { label: "Customer issue", icon: ShieldAlert, subject: "Customer issue" },
      { label: "Account or verification", icon: CircleHelp, subject: "Account or verification problem" },
      { label: "Something else", icon: MessageCircle, subject: "Other vendor support request" },
    ],
    faqs: [
      ["Why can't I receive orders?", "Check that your store is approved, open and has products available. If everything looks right, contact support with the problem you are seeing."],
      ["I have an order problem", "Open the order first and keep its order ID handy. A support ticket can be linked to the order using the optional order ID field."],
      ["I have a payout or earnings issue", "Create a Payments or earnings ticket and include the amount, date and relevant order or payout reference."],
      ["A customer says their item is wrong", "Describe exactly what was prepared and what the customer reported. Support can review the order and the dispute."],
    ],
  },
  rider: {
    title: "Rider support",
    intro: "Something went wrong on a delivery? Get help with deliveries, payouts, verification and safety.",
    categories: [
      { label: "Delivery problem", icon: Package, subject: "Delivery problem" },
      { label: "Customer issue", icon: MessageCircle, subject: "Customer issue" },
      { label: "Payout or earnings", icon: Wallet, subject: "Payout or earnings problem" },
      { label: "Verification", icon: CircleHelp, subject: "Verification problem" },
      { label: "Safety", icon: ShieldAlert, subject: "Safety issue" },
      { label: "Something else", icon: MessageCircle, subject: "Other rider support request" },
    ],
    faqs: [
      ["The customer is unreachable", "Follow the delivery instructions available in the order. If you cannot complete the delivery, contact support with the order ID and what happened."],
      ["I have not received an expected payout", "Create a Payout or earnings ticket and include the order or payout reference if you have it."],
      ["I have a verification problem", "Tell us which verification step is failing and what you see on screen. Never send your PIN or password."],
      ["I have a safety issue", "If you are in immediate danger, contact the appropriate emergency service first. Then create a Safety ticket so Fidelx can review the delivery."],
    ],
  },
};

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

function prettyStatus(status) {
  return String(status || "OPEN").replace(/_/g, " ");
}

function TicketCard({ ticket, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(ticket)} className="w-full text-left">
      <Card className="p-4 transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold text-ink">{ticket.subject}</p>
            <p className="mt-1 text-xs font-semibold text-slate-muted">
              {new Date(ticket.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
          <span className={clsx("shrink-0 rounded-full border-2 border-ink px-2.5 py-0.5 text-[10px] font-extrabold", PRIORITY_STYLE[ticket.priority] || PRIORITY_STYLE.LOW)}>
            {ticket.priority || "LOW"}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={clsx("rounded-full border-2 border-ink px-2.5 py-1 text-[10px] font-extrabold", STATUS_STYLE[ticket.status] || STATUS_STYLE.OPEN)}>
            {prettyStatus(ticket.status)}
          </span>
          <span className="flex items-center gap-1 text-xs font-extrabold text-text-brand-deep">
            Open ticket <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      </Card>
    </button>
  );
}

function TicketDetail({ ticket, onBack, onReply, isReplying, reply, setReply }) {
  const messages = ticket?.messages || [];
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm font-extrabold text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to support
      </button>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-display font-extrabold tracking-tight">{ticket.subject}</p>
            <p className="mt-1 text-xs font-bold text-slate-muted">Ticket #{String(ticket.id).slice(0, 8)}</p>
          </div>
          <span className={clsx("shrink-0 rounded-full border-2 border-ink px-2.5 py-1 text-[10px] font-extrabold", STATUS_STYLE[ticket.status] || STATUS_STYLE.OPEN)}>
            {prettyStatus(ticket.status)}
          </span>
        </div>
      </Card>

      <div className="space-y-3">
        <div className="rounded-[22px] border-[2.5px] border-ink bg-white p-4 shadow-pop-sm">
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-muted">You</p>
          <p className="whitespace-pre-wrap text-sm font-semibold text-ink">{ticket.message}</p>
        </div>
        {messages.map((m, index) => {
          const isAdmin = m.sender === "admin";
          return (
            <div key={`${m.sent_at || "message"}-${index}`} className={clsx("rounded-[22px] border-[2.5px] border-ink p-4 shadow-pop-sm", isAdmin ? "bg-mint ml-5" : "bg-white mr-5")}>
              <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide">{isAdmin ? "Fidelx support" : "You"}</p>
              <p className="whitespace-pre-wrap text-sm font-semibold text-ink">{m.message}</p>
              {m.sent_at && <p className="mt-2 text-[10px] font-bold opacity-60">{new Date(m.sent_at).toLocaleString("en-NG")}</p>}
            </div>
          );
        })}
      </div>

      <Card className="p-4">
        <p className="mb-2 text-sm font-extrabold">Need to add something?</p>
        <textarea
          rows={4}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Add more details or answer the support team…"
          className="w-full resize-none rounded-[18px] border-[2.5px] border-ink bg-white px-3.5 py-3 text-sm font-semibold text-ink shadow-pop-sm outline-none focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-pop"
        />
        <Button className="mt-3 w-full" size="lg" loading={isReplying} disabled={!reply.trim()} onClick={() => onReply(reply.trim())}>
          <Send className="mr-2 h-4 w-4" /> Send reply
        </Button>
      </Card>
    </div>
  );
}

export default function SupportCenterPage({ role }) {
  const config = CONFIG[role] || CONFIG.customer;
  const qc = useQueryClient();
  const [form, setForm] = useState({ subject: "", message: "", order_id: "" });
  const [errors, setErrors] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [reply, setReply] = useState("");
  const [openFaq, setOpenFaq] = useState(0);

  const queryKey = ["my-support-tickets", role];
  const { data, isLoading, isError, refetch } = useQuery({ queryKey, queryFn: getMyTickets });
  const tickets = data?.tickets || [];

  const createMutation = useMutation({
    mutationFn: createTicket,
    onSuccess: (res) => {
      toast.success(res?.message || "Ticket submitted.");
      setForm({ subject: "", message: "", order_id: "" });
      setSelectedCategory(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(err.message || "Couldn't submit your ticket. Please try again."),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, message }) => replyToTicket(id, message),
    onSuccess: async () => {
      toast.success("Reply sent.");
      setReply("");
      const result = await qc.fetchQuery({ queryKey });
      const updated = (result?.tickets || []).find((t) => t.id === selectedTicket?.id);
      if (updated) setSelectedTicket(updated);
    },
    onError: (err) => toast.error(err.message || "Couldn't send your reply."),
  });

  const activeTicket = useMemo(() => selectedTicket && tickets.find((t) => t.id === selectedTicket.id) || selectedTicket, [selectedTicket, tickets]);

  const chooseCategory = (category) => {
    setSelectedCategory(category.label);
    setForm((f) => ({ ...f, subject: category.subject }));
    setErrors((e) => ({ ...e, subject: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.subject.trim()) e.subject = "Choose a topic or add a short subject";
    if (!form.message.trim()) e.message = "Please tell us what happened";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({
      subject: form.subject.trim(),
      message: form.message.trim(),
      ...(form.order_id.trim() ? { order_id: form.order_id.trim() } : {}),
    });
  };

  if (activeTicket) {
    return (
      <div data-theme="pop" className="min-h-screen bg-navy">
        <TopBar title="Support" showBack={false} />
        <div className="mx-auto max-w-2xl space-y-5 px-4 py-5">
          <TicketDetail
            ticket={activeTicket}
            onBack={() => setSelectedTicket(null)}
            onReply={(message) => replyMutation.mutate({ id: activeTicket.id, message })}
            isReplying={replyMutation.isPending}
            reply={reply}
            setReply={setReply}
          />
        </div>
      </div>
    );
  }

  return (
    <div data-theme="pop" className="min-h-screen bg-navy">
      <TopBar title={config.title} showBack />
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 pb-8">
        <div className="rounded-[26px] border-[2.5px] border-ink bg-brand p-5 shadow-pop">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] border-2 border-ink bg-white shadow-pop-xs">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight">We're here to help.</h1>
              <p className="mt-1 text-sm font-bold text-text-brand-deep">{config.intro}</p>
            </div>
          </div>
        </div>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold tracking-tight">What do you need help with?</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-muted">Start here so we can route your issue properly.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {config.categories.map((category) => {
              const Icon = category.icon;
              const active = selectedCategory === category.label;
              return (
                <button
                  key={category.label}
                  type="button"
                  onClick={() => chooseCategory(category)}
                  className={clsx("rounded-[20px] border-[2.5px] border-ink p-3 text-left shadow-pop-sm transition-all duration-150 active:translate-x-[2px] active:translate-y-[2px] active:shadow-pop-xs", active ? "bg-brand" : "bg-white")}
                >
                  <Icon className="mb-4 h-5 w-5" strokeWidth={2.5} />
                  <span className="text-sm font-extrabold leading-tight">{category.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border-[2.5px] border-ink bg-white p-4 shadow-pop">
          <div className="mb-4 flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border-2 border-ink bg-peach">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-extrabold">Tell us what happened</h2>
              <p className="text-xs font-semibold text-slate-muted">Give us enough detail to help without making you repeat yourself.</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Input
              label="Subject"
              placeholder="Choose a topic above or write your own"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              error={errors.subject}
            />
            <div>
              <label htmlFor={`support-message-${role}`} className="mb-1.5 block text-sm font-extrabold text-ink">Describe your issue</label>
              <textarea
                id={`support-message-${role}`}
                rows={5}
                placeholder="What happened? Include anything that may help us understand the problem."
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                className={clsx("w-full resize-none rounded-[18px] border-[2.5px] bg-white px-3.5 py-3 text-sm font-semibold text-ink shadow-pop-sm outline-none transition-all duration-150 placeholder:text-slate-soft focus:-translate-x-0.5 focus:-translate-y-0.5 focus:shadow-pop", errors.message ? "border-bad" : "border-ink")}
              />
              {errors.message && <p className="mt-1 text-xs font-bold text-bad">{errors.message}</p>}
            </div>
            <Input
              label="Related order ID (optional)"
              placeholder="Add the order ID if this is about a specific order"
              value={form.order_id}
              onChange={(e) => setForm((f) => ({ ...f, order_id: e.target.value }))}
            />
            <Button type="submit" size="xl" className="w-full" loading={createMutation.isPending}>Submit support request</Button>
          </form>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <CircleHelp className="h-5 w-5" />
            <h2 className="font-display text-xl font-extrabold">Quick answers</h2>
          </div>
          <div className="space-y-2.5">
            {config.faqs.map(([question, answer], index) => {
              const open = openFaq === index;
              return (
                <div key={question} className="rounded-[20px] border-[2.5px] border-ink bg-white shadow-pop-xs">
                  <button type="button" onClick={() => setOpenFaq(open ? -1 : index)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                    <span className="text-sm font-extrabold">{question}</span>
                    <ChevronDown className={clsx("h-5 w-5 shrink-0 transition-transform", open && "rotate-180")} />
                  </button>
                  {open && <p className="border-t-2 border-ink px-4 pb-4 pt-3 text-sm font-semibold leading-6 text-slate-muted">{answer}</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-extrabold">Your support requests</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-muted">Keep the conversation in one place.</p>
            </div>
          </div>
          {isLoading ? (
            <div className="space-y-3"><Skeleton className="h-28 w-full rounded-[22px]" /><Skeleton className="h-28 w-full rounded-[22px]" /></div>
          ) : isError ? (
            <ErrorState message="Couldn't load your support requests." onRetry={refetch} />
          ) : tickets.length === 0 ? (
            <EmptyState icon={MessageCircle} title="No support requests yet" description="If something goes wrong, start with a topic above and we'll take it from there." />
          ) : (
            <div className="space-y-3">{tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} onOpen={setSelectedTicket} />)}</div>
          )}
        </section>

        <div className="flex items-start gap-2 rounded-[18px] border-2 border-ink bg-peach p-3 text-xs font-bold text-ink">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          Never send your password, PIN, OTP or full card details in a support message.
        </div>
      </div>
    </div>
  );
}
