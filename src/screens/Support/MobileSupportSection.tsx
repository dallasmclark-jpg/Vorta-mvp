import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Shield,
  Ticket,
  Zap,
} from "lucide-react";
import { DetailDrawer, DrawerCloseButton } from "../../components/DetailDrawer";
import { MobilePageHeader } from "../../components/MobilePageHeader";

type SupportTicket = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  lastUpdated: string;
  response: string;
};

const tickets: SupportTicket[] = [
  {
    id: "VRT-0041",
    subject: "Skills matrix not updating after bulk import",
    category: "Skills Matrix",
    priority: "High",
    status: "In progress",
    lastUpdated: "Today, 10:42",
    response: "The demonstration support team is reviewing the import parsing scenario.",
  },
  {
    id: "VRT-0038",
    subject: "AI matching score explanation for contractor",
    category: "Capability Matching",
    priority: "Medium",
    status: "Resolved",
    lastUpdated: "Yesterday",
    response: "The score uses skill coverage, certification status, availability and recorded experience.",
  },
  {
    id: "VRT-0035",
    subject: "Training booking not showing in engineer profile",
    category: "Training",
    priority: "Medium",
    status: "Waiting on customer",
    lastUpdated: "3 days ago",
    response: "The demonstration scenario is awaiting additional booking details.",
  },
];

const faqs = [
  {
    title: "Update engineer skills",
    body: "Open Engineers, select the engineer and review their capability evidence. Manager validation remains controlled by the relevant site workflow.",
    icon: Shield,
  },
  {
    title: "Understand matching scores",
    body: "Capability Matching combines recorded skill ratings, certification validity, experience and availability. It supports review and does not make an automated staffing decision.",
    icon: Zap,
  },
  {
    title: "Review training needs",
    body: "Open Training to see priority gaps, certification exposure, current bookings and matched courses.",
    icon: BookOpen,
  },
  {
    title: "Find equipment evidence",
    body: "Open Equipment, select an asset and use Documents or Ask Vorta to review manuals, drawings and linked maintenance evidence.",
    icon: HelpCircle,
  },
];

function priorityTone(value: string): string {
  if (value === "High") return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (value === "Urgent") return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

function statusTone(value: string): string {
  if (value === "Resolved") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (value === "In progress") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

export function MobileSupportSection(): JSX.Element {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((ticket) =>
      [ticket.id, ticket.subject, ticket.category, ticket.status]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [search]);

  return (
    <section
      data-vorta-mobile-support="true"
      className="flex w-full flex-col gap-4 overflow-x-hidden px-3 pt-4"
    >
      <DetailDrawer open={Boolean(selectedTicket)} onClose={() => setSelectedTicket(null)}>
        <div className="flex items-start justify-between border-b border-gray-800 p-5">
          <div className="min-w-0 pr-3">
            <p className="font-mono text-xs text-slate-500">{selectedTicket?.id ?? "Ticket"}</p>
            <h2 className="mt-2 text-lg font-semibold leading-6 text-slate-50">
              {selectedTicket?.subject ?? "Support ticket"}
            </h2>
          </div>
          <DrawerCloseButton onClose={() => setSelectedTicket(null)} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-800 border-b border-gray-800">
          <div className="p-3"><p className="text-[9px] text-slate-500">Category</p><p className="mt-1 text-xs font-semibold text-slate-200">{selectedTicket?.category ?? "—"}</p></div>
          <div className="p-3"><p className="text-[9px] text-slate-500">Priority</p><p className="mt-1 text-xs font-semibold text-orange-300">{selectedTicket?.priority ?? "—"}</p></div>
          <div className="p-3"><p className="text-[9px] text-slate-500">Status</p><p className="mt-1 text-xs font-semibold text-blue-300">{selectedTicket?.status ?? "—"}</p></div>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">Latest response</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{selectedTicket?.response}</p>
            <p className="mt-3 text-xs text-slate-500">Updated {selectedTicket?.lastUpdated}</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4 text-sm leading-5 text-amber-100/80">
            This is a demonstration ticket. No reply, status change or support request is submitted from this screen.
          </div>
        </div>
      </DetailDrawer>

      <MobilePageHeader
        eyebrow="Help and guidance"
        title="Support"
        description="Find workflow guidance and review demonstration support scenarios."
      />

      <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-4">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-blue-200">Need operational help?</p>
            <p className="mt-1 text-sm leading-5 text-slate-400">
              Ask Vorta for equipment and maintenance evidence. Use Support for account, access or platform issues.
            </p>
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-50">Help topics</h2>
            <p className="text-xs text-slate-500">Common Maintenance Manager workflows</p>
          </div>
          <HelpCircle className="h-4 w-4 text-slate-600" aria-hidden="true" />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {faqs.map((faq) => {
            const Icon = faq.icon;
            const open = openFaq === faq.title;
            return (
              <div key={faq.title} className="rounded-xl border border-gray-800 bg-[#141820]">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : faq.title)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-slate-100">{faq.title}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {open ? <p className="border-t border-gray-800 px-4 py-4 text-sm leading-6 text-slate-400">{faq.body}</p> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-50">Demonstration tickets</h2>
            <p className="text-xs text-slate-500">Review the support workflow without submitting changes</p>
          </div>
          <Ticket className="h-4 w-4 text-slate-600" aria-hidden="true" />
        </div>

        <label className="mt-3 flex min-h-12 items-center gap-2 rounded-xl border border-gray-800 bg-[#10151d] px-3">
          <MessageSquare className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span className="sr-only">Search support tickets</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tickets"
            className="min-w-0 flex-1 bg-transparent text-base text-slate-200 outline-none placeholder:text-slate-600"
          />
        </label>

        <div className="mt-3 flex flex-col gap-2">
          {filteredTickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => setSelectedTicket(ticket)}
              className="w-full rounded-xl border border-gray-800 bg-[#141820] p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 active:bg-[#1a2030]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] text-slate-500">{ticket.id}</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-slate-100">{ticket.subject}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${priorityTone(ticket.priority)}`}>{ticket.priority}</span>
                <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusTone(ticket.status)}`}>{ticket.status}</span>
                <span className="text-[10px] text-slate-500">{ticket.lastUpdated}</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
