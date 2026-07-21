import { BellRing, BookOpen, MessageCircle, MessageSquareReply, PencilLine, Plus } from "lucide-react";
import Link from "next/link";
import type {
  ActivityNotificationType,
  PendingEntryAttention,
} from "@/lib/database.types";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function itemPresentation(type: ActivityNotificationType) {
  if (type === "entry_created") return { label: "发布回忆", Icon: Plus };
  if (type === "entry_updated") return { label: "修改回忆", Icon: PencilLine };
  if (type === "follow_up_replied") return { label: "回复追评", Icon: MessageSquareReply };
  return { label: "追评", Icon: MessageCircle };
}

export function PendingEntryInbox({
  items,
}: {
  items: PendingEntryAttention[];
}) {
  return (
    <section id="inbox" className="attention-panel scroll-mt-6">
      <div className="attention-head">
        <div>
          <span className="eyebrow"><BellRing size={14} /> For you</span>
          <h2>待你看看</h2>
          <p>打开一篇回忆，或在里面补一句追评，它就会从这里安静地退场。</p>
        </div>
        <span>{items.length} 篇</span>
      </div>

      {items.length ? (
        <div className="attention-list">
          {items.map((entry) => (
            <article key={entry.entry_id} className="attention-entry">
              <div className="attention-entry-head">
                <BookOpen size={17} />
                <div>
                  <Link href={entry.href}>《{entry.entry_title}》</Link>
                  <time>{formatTime(entry.latest_at)} 有新动态</time>
                </div>
              </div>
              <div className="attention-events">
                {entry.items.map((item) => {
                  const { Icon, label } = itemPresentation(item.type);
                  return (
                    <Link key={item.id} href={item.href} className="attention-event">
                      <span aria-hidden="true"><Icon size={14} /></span>
                      <div>
                        <small>{label} · {item.actor?.display_name ?? "对方"} · {formatTime(item.created_at)}</small>
                        <b>{item.title}</b>
                        {item.body && <p>{item.body}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="attention-empty">
          <BellRing size={21} />
          <span>现在没有待你看的新回忆，足迹流会继续把每一刻好好留着。</span>
        </div>
      )}
    </section>
  );
}
