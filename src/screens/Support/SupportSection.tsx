import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleUser as UserCircle,
  Clock,
  Download,
  ExternalLink,
  HelpCircle,
  Inbox,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Ticket,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { ContextHelp } from "../../components/ContextHelp";
import { Select } from "../../components/Select";
import { ExplainWithAi } from "../../components/ExplainWithAi";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  lastUpdated: string;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-[#0b1a12] px-4 py-3 shadow-lg">
      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      <span className="text-sm font-medium text-slate-200">{message}</span>
      <button type="button" onClick={onDismiss} className="ml-2 text-slate-500 hover:text-slate-300">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "Urgent": return "bg-[#ef444420] text-red-500";
    case "High":   return "bg-[#f9731620] text-orange-400";
    case "Medium": return "bg-[#facc1520] text-yellow-400";
    default:       return "bg-[#10b98120] text-emerald-500";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Open":                return "bg-[#3b82f620] text-blue-400";
    case "In progress":         return "bg-[#f9731620] text-orange-400";
    case "Waiting on customer": return "bg-[#facc1520] text-yellow-400";
    case "Resolved":            return "bg-[#10b98120] text-emerald-500";
    default:                    return "bg-gray-800 text-slate-400";
  }
}

// ─── Initial mock tickets ─────────────────────────────────────────────────────

const INITIAL_TICKETS: SupportTicket[] = [
  { id: "VRT-0041", subject: "Skills matrix not updating after bulk import",            category: "Skills Matrix",     priority: "High",   status: "In progress",         lastUpdated: "Today, 10:42"     },
  { id: "VRT-0038", subject: "AI matching score explanation for contractor",            category: "AI Matching",       priority: "Medium", status: "Resolved",             lastUpdated: "Yesterday"        },
  { id: "VRT-0035", subject: "Training booking not showing in engineer profile",        category: "Training Bookings", priority: "Medium", status: "Waiting on customer",  lastUpdated: "3 days ago"       },
  { id: "VRT-0031", subject: "Cannot add new user — invite email not received",        category: "Account / Billing", priority: "Low",    status: "Resolved",             lastUpdated: "1 week ago"       },
  { id: "VRT-0028", subject: "PLC requirement showing incorrect engineer count",       category: "Skills Matrix",     priority: "High",   status: "Resolved",             lastUpdated: "1 week ago"       },
];

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    icon: Shield,
    title: "How to update engineer skills",
    body: "Navigate to Engineers → select an engineer → open the Skills tab. You can update competency ratings directly from the drawer. Changes are saved immediately and reflected in the skills matrix. Manager validation can be required via Settings → Skills Matrix Rules.",
  },
  {
    icon: Zap,
    title: "How AI matching scores are calculated",
    body: "Vorta AI scores engineers against open requirements using weighted skill ratings, certification status, shift availability, and SPOF risk. Scores are normalised to a 0–100 scale. Higher confidence scores reflect more complete skills data for that engineer.",
  },
  {
    icon: BookOpen,
    title: "How to book training",
    body: "Go to Training → click Add Booking. Select the engineer, course and provider. Bookings under the auto-approve threshold are confirmed immediately. Above the threshold, a manager approval request is triggered. You can manage thresholds in Settings → Training Approval Rules.",
  },
  {
    icon: AlertTriangle,
    title: "How to manage equipment requirements",
    body: "The Equipment page lets you view asset risk and linked skills. Open any asset to see required skills, current coverage and recommended training. To link a requirement to an asset, go to Requirements and associate the skill area with the relevant equipment.",
  },
  {
    icon: UserCircle,
    title: "How to add or remove users",
    body: "Go to Settings → Team Access. Click Invite to send an email invite with a role assignment. To remove a user, click the remove icon on their row. Changes take effect immediately. Only Admins can add or remove users.",
  },
  {
    icon: Download,
    title: "How to export reports",
    body: "Most pages have an Export button in the top-right header. The AI Reports page provides PDF and CSV export for executive summaries, skills risk and compliance reports. Data exports are generated from your live skills matrix and training records.",
  },
];

// ─── Ticket Drawer ────────────────────────────────────────────────────────────

const TICKET_REPLIES: Record<string, string> = {
  "VRT-0041": "Our team is investigating the import parsing issue. We'll push a fix in the next maintenance window. In the meantime, you can manually update skills from the engineer profile drawer.",
  "VRT-0038": "The AI matching score is calculated from 4 weighted dimensions: skills coverage, certification status, shift availability and SPOF risk. Scores above 85 are classified as a Strong Match.",
  "VRT-0035": "This is a sync delay caused by a caching issue on the engineer profile page. We've identified the cause — please clear your browser cache and reload. If it persists, reply here with your browser version.",
  "VRT-0031": "The invite email was sent but landed in spam for some domains. Please ask your colleague to check their spam folder. You can also re-send the invite from Settings → Team Access.",
  "VRT-0028": "The PLC requirement count discrepancy was caused by a deleted engineer record still being counted. This has been corrected — the count should now be accurate.",
};

function TicketDrawer({
  ticket,
  onClose,
  onToast,
}: {
  ticket: SupportTicket | null;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const isOpen = ticket !== null;
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ticket && scrollRef.current) scrollRef.current.scrollTop = 0; }, [ticket?.id]);

  const reply = ticket ? TICKET_REPLIES[ticket.id] ?? "Our team is reviewing your request. We'll respond within 4 business hours during Monday–Friday, 8:00–18:00." : "";

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-gray-800 bg-[#0d1117] shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 pr-3">
            <span className="font-mono text-xs text-slate-500">{ticket?.id ?? "—"}</span>
            <h2 className="text-sm font-semibold leading-snug text-slate-50">{ticket?.subject ?? "—"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-[#ffffff10] hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Badges strip */}
        <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
          <div className="flex flex-col gap-0.5 px-3 py-3">
            <p className="text-[10px] font-medium text-slate-500">Category</p>
            <p className="text-xs font-semibold text-slate-300">{ticket?.category ?? "—"}</p>
          </div>
          <div className="flex flex-col gap-0.5 px-3 py-3">
            <p className="text-[10px] font-medium text-slate-500">Priority</p>
            {ticket && (
              <Badge className={`inline-flex h-auto w-fit rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${priorityBadgeClass(ticket.priority)}`}>
                {ticket.priority}
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-0.5 px-3 py-3">
            <p className="text-[10px] font-medium text-slate-500">Status</p>
            {ticket && (
              <Badge className={`inline-flex h-auto w-fit rounded px-1.5 py-0.5 text-[9px] font-medium shadow-none ${statusBadgeClass(ticket.status)}`}>
                {ticket.status}
              </Badge>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          {/* Latest reply */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Vorta Support Response</p>
            <div className="rounded-lg border border-blue-500/20 bg-[#3b82f608] p-4">
              <p className="text-xs leading-relaxed text-slate-300">{reply}</p>
            </div>
          </div>

          {/* Last updated */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            Last updated: {ticket?.lastUpdated ?? "—"}
          </div>

          {/* Reply box */}
          {ticket?.status !== "Resolved" && (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Add Reply</p>
              <ReplyBox ticketId={ticket?.id ?? ""} onSend={(msg) => { onToast(`Reply added to ${ticket?.id}`); }} />
            </div>
          )}

          {ticket?.status === "Resolved" && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">This ticket has been resolved.</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ReplyBox({ ticketId, onSend }: { ticketId: string; onSend: (msg: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <textarea
        rows={3}
        placeholder="Add more detail or a reply…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="resize-none rounded-lg border border-[#ffffff15] bg-[#0d0d0d] px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500/60"
      />
      <button
        type="button"
        disabled={!value.trim()}
        onClick={() => { onSend(value); setValue(""); }}
        className="flex h-8 items-center justify-center gap-2 rounded-lg bg-blue-600 text-xs font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Send className="h-3.5 w-3.5" />
        Send Reply
      </button>
    </div>
  );
}

// ─── FAQ Accordion item ───────────────────────────────────────────────────────

function FaqItem({ item }: { item: typeof FAQ_ITEMS[number] }) {
  const [open, setOpen] = useState(false);
  const Icon = item.icon;
  return (
    <div className="rounded-lg border border-gray-800 bg-[#111620] transition-colors hover:border-gray-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 shrink-0 text-blue-400" />
          <span className="text-sm font-medium text-slate-200">{item.title}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>
      {open && (
        <div className="border-t border-gray-800 px-4 pb-4 pt-3">
          <p className="text-sm leading-relaxed text-slate-400">{item.body}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const SupportSection = (): JSX.Element => {
  const [toast,         setToast]         = useState<string | null>(null);
  const [tickets,       setTickets]       = useState<SupportTicket[]>(INITIAL_TICKETS);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  // Form state
  const [category,     setCategory]     = useState("Skills Matrix");
  const [priority,     setPriority]     = useState("Medium");
  const [subject,      setSubject]      = useState("");
  const [description,  setDescription]  = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [formSuccess,  setFormSuccess]  = useState(false);

  // KPI calcs
  const openCount     = tickets.filter((t) => t.status === "Open" || t.status === "In progress").length;
  const awaitingCount = tickets.filter((t) => t.status === "Waiting on customer").length;
  const resolvedCount = tickets.filter((t) => t.status === "Resolved").length;

  function handleSubmit() {
    if (!subject.trim() || !description.trim()) {
      setToast("Please fill in both subject and description.");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      const nextId = `VRT-${String(Math.floor(1000 + Math.random() * 9000)).slice(0, 4)}`;
      const newTicket: SupportTicket = {
        id:          nextId,
        subject:     subject.trim(),
        category,
        priority,
        status:      "Open",
        lastUpdated: "Just now",
      };
      setTickets((prev) => [newTicket, ...prev]);
      setSubject("");
      setDescription("");
      setCategory("Skills Matrix");
      setPriority("Medium");
      setSubmitting(false);
      setFormSuccess(true);
      setToast(`Support request ${nextId} raised successfully`);
      setTimeout(() => setFormSuccess(false), 4000);
    }, 900);
  }

  return (
    <section className="relative flex min-w-0 w-full max-w-full flex-1 grow flex-col items-start gap-6 overflow-x-hidden px-4 pb-12 pt-0 md:gap-8 md:px-6 xl:px-8">

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <TicketDrawer ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onToast={(msg) => setToast(msg)} />

      {/* ── Page header ──────────────────────────────────────────────── */}
      <header className="flex w-full flex-col justify-between gap-4 py-5 lg:flex-row lg:items-center">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2">
            <h1 className="mt-[-1.00px] font-text-xl-semibold text-[length:var(--text-xl-semibold-font-size)] font-[number:var(--text-xl-semibold-font-weight)] leading-[var(--text-xl-semibold-line-height)] tracking-[var(--text-xl-semibold-letter-spacing)] text-slate-50 [font-style:var(--text-xl-semibold-font-style)]">
              Support
            </h1>
            <ContextHelp content={{
              title: "Support",
              body:  "Raise support requests, track open tickets and access help guides for all Vorta features. The Vorta team responds within 4 business hours during Monday–Friday, 8:00–18:00.",
              usage: "Use Raise Support Request to report issues. View Recent Tickets to track status. Browse Help Guides for step-by-step answers.",
            }} />
          </div>
          <p className="text-sm text-slate-400">
            Get help with skills matrix, engineers, training, bookings and account setup.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          <Button
            type="button"
            className="h-auto gap-2 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            onClick={() => document.getElementById("raise-request")?.scrollIntoView({ behavior: "smooth" })}
          >
            <Plus className="h-4 w-4" /> Raise Support Request
          </Button>
          <Button type="button" variant="outline"
            className="h-auto gap-2 border-[#ffffff20] bg-[#ffffff1a] px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-[#ffffff24] hover:text-slate-50"
            onClick={() => document.getElementById("help-guides")?.scrollIntoView({ behavior: "smooth" })}
          >
            <BookOpen className="h-4 w-4" /> View Help Guides
          </Button>
          <ExplainWithAi pageId="support" />
          <button type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-[#ffffff1a] hover:text-slate-200">
            <UserCircle className="h-8 w-8" />
          </button>
        </div>
      </header>

      {/* ── KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Open Tickets",           value: openCount,     sub: "Active or in progress",        icon: Ticket,       vc: openCount > 0     ? "text-orange-400"  : "text-emerald-400" },
          { label: "Awaiting Response",      value: awaitingCount, sub: "Waiting on your input",        icon: Inbox,        vc: awaitingCount > 0 ? "text-yellow-400"  : "text-emerald-400" },
          { label: "Resolved This Month",    value: resolvedCount, sub: "Closed requests",              icon: CheckCircle2, vc: "text-emerald-400"                                           },
          { label: "Avg. Response Time",     value: "< 4 hrs",     sub: "Business hours, Mon–Fri",      icon: Clock,        vc: "text-blue-400"                                              },
        ].map(({ label, value, sub, icon: Icon, vc }) => (
          <Card key={label} className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <Icon className="h-4 w-4 shrink-0 text-slate-600" />
              </div>
              <p className={`text-2xl font-semibold tabular-nums ${vc}`}>{value}</p>
              <p className="text-[11px] text-slate-500">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Two-column: form + tickets ─────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">

        {/* Raise a support request */}
        <Card id="raise-request" className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-5 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3b82f615]">
                <MessageSquare className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-50">Raise a Support Request</h2>
                <p className="text-xs text-slate-500">Describe your issue and we'll respond shortly</p>
              </div>
            </div>

            {formSuccess ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-emerald-500/20 bg-[#10b98110] py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                <p className="font-medium text-emerald-400">Request submitted</p>
                <p className="text-xs text-slate-500">Your ticket has been raised. We'll respond within 4 business hours.</p>
                <button type="button" onClick={() => setFormSuccess(false)}
                  className="mt-1 rounded-lg border border-gray-700 px-4 py-1.5 text-xs font-medium text-slate-400 hover:bg-[#ffffff0a] hover:text-slate-200">
                  Raise another
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400">Issue category</label>
                  <Select
                    value={category}
                    onChange={setCategory}
                    options={["Skills Matrix", "Engineer Profiles", "Training Bookings", "AI Matching", "Equipment", "Account / Billing", "Technical Issue"].map((o) => ({ value: o, label: o }))}
                    className="h-9"
                  />
                </div>

                {/* Priority */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400">Priority</label>
                  <Select
                    value={priority}
                    onChange={setPriority}
                    options={["Low", "Medium", "High", "Urgent"].map((o) => ({ value: o, label: o }))}
                    className="h-9"
                  />
                </div>

                {/* Subject */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400">Subject</label>
                  <input
                    type="text"
                    placeholder="Brief description of the issue"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-9 rounded-lg border border-[#ffffff15] bg-[#0d0d0d] px-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500/60"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400">Description</label>
                  <textarea
                    rows={4}
                    placeholder="Provide as much detail as possible — steps to reproduce, what you expected, what happened…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="resize-none rounded-lg border border-[#ffffff15] bg-[#0d0d0d] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500/60"
                  />
                </div>

                {/* Urgent notice */}
                {priority === "Urgent" && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-[#ef444408] p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-xs leading-relaxed text-slate-400">
                      Urgent requests are triaged immediately during business hours. For after-hours production-critical issues, include your phone number in the description.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-70"
                >
                  {submitting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {submitting ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent support tickets */}
        <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-4 p-0">
            <div className="flex items-center justify-between gap-3 px-5 pt-5">
              <div>
                <h2 className="font-semibold text-slate-50">Recent Support Tickets</h2>
                <p className="text-sm text-slate-400">{tickets.length} ticket{tickets.length !== 1 ? "s" : ""} on record</p>
              </div>
              <Badge className="inline-flex h-auto items-center gap-1.5 rounded bg-[#3b82f620] px-2 py-1 text-[10px] font-medium text-blue-500 shadow-none hover:bg-[#3b82f620]">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />Live
              </Badge>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-max min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-[#0f1318]">
                    {[
                      { label: "Ticket ID",    cls: "min-w-[90px]"  },
                      { label: "Subject",      cls: "min-w-[240px]" },
                      { label: "Category",     cls: "min-w-[150px]" },
                      { label: "Priority",     cls: "min-w-[90px]"  },
                      { label: "Status",       cls: "min-w-[150px]" },
                      { label: "Last Updated", cls: "min-w-[130px]" },
                    ].map(({ label, cls }) => (
                      <th key={label} className={`px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                        No tickets yet.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t, idx) => {
                      const rowBg = idx % 2 === 0 ? "bg-[#141820]" : "bg-[#111620]";
                      return (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTicket(t)}
                          className={`cursor-pointer border-b border-gray-800/50 ${rowBg} transition-colors hover:bg-[#1a2030]`}
                        >
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-xs font-medium text-slate-400">{t.id}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-sm font-medium text-slate-200 leading-tight">{t.subject}</span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-slate-400">{t.category}</td>
                          <td className="px-4 py-2.5">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${priorityBadgeClass(t.priority)}`}>
                              {t.priority}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge className={`inline-flex h-auto rounded px-2 py-0.5 text-[10px] font-medium shadow-none ${statusBadgeClass(t.status)}`}>
                              {t.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{t.lastUpdated}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Help guides + Contact ─────────────────────────────────────── */}
      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">

        {/* FAQ accordion */}
        <Card id="help-guides" className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
          <CardContent className="flex flex-col gap-5 p-5 md:p-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3b82f615]">
                <HelpCircle className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-50">Help Guides</h2>
                <p className="text-xs text-slate-500">Common questions and step-by-step guidance</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {FAQ_ITEMS.map((item) => (
                <FaqItem key={item.title} item={item} />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Contact card */}
        <div className="flex flex-col gap-4">
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-5 p-5 md:p-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3b82f615]">
                  <Mail className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-50">Contact Vorta Support</h2>
                  <p className="text-xs text-slate-500">We're here to help</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3 rounded-lg border border-gray-800 bg-[#111620] px-4 py-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Email</span>
                    <a href="mailto:support@vorta.network" className="text-sm font-medium text-blue-400 hover:underline">
                      support@vorta.network
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-gray-800 bg-[#111620] px-4 py-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Response hours</span>
                    <span className="text-sm font-medium text-slate-200">Monday – Friday, 8:00–18:00</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-orange-400/20 bg-[#f9731608] px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-orange-400">Production-critical issues</span>
                    <span className="text-xs leading-relaxed text-slate-400">
                      Mark your support request as <strong className="font-semibold text-slate-200">Urgent</strong> and include your contact number. Urgent tickets are triaged immediately during business hours.
                    </span>
                  </div>
                </div>
              </div>

              <a
                href="mailto:support@vorta.network"
                className="flex h-9 items-center justify-center gap-2 rounded-lg border border-[#ffffff20] bg-[#ffffff1a] text-sm font-semibold text-slate-200 transition-colors hover:bg-[#ffffff24]"
              >
                <ExternalLink className="h-4 w-4" />
                Email support
              </a>
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card className="rounded-xl border border-gray-800 bg-[#141820] shadow-none">
            <CardContent className="flex flex-col gap-4 p-5">
              <h2 className="font-semibold text-slate-50">Quick Links</h2>
              <div className="flex flex-col gap-2">
                {[
                  { label: "System status",          icon: CheckCircle2, toast: "All systems operational — last checked just now"       },
                  { label: "Release notes",           icon: BookOpen,     toast: "Release notes: v2.4.1 — AI matching improvements"       },
                  { label: "Download data export",    icon: Download,     toast: "Data export queued — you'll receive an email when ready" },
                  { label: "View all help articles",  icon: HelpCircle,   toast: "Help centre scrolled into view"                         },
                ].map(({ label, icon: Icon, toast: msg }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setToast(msg);
                      if (label === "View all help articles") {
                        document.getElementById("help-guides")?.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className="flex items-center gap-3 rounded-lg border border-gray-800 bg-[#111620] px-3 py-2.5 text-left transition-colors hover:border-gray-700 hover:bg-[#1a2030]"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="text-sm text-slate-300">{label}</span>
                    <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-slate-600" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

    </section>
  );
};
