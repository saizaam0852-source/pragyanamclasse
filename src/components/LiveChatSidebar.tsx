import { useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, HelpCircle, CheckCircle2, CornerDownRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface ChatMessage {
  id: string;
  class_id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
  parent_id: string | null;
  message_type: string; // 'chat' | 'doubt'
  is_resolved: boolean;
}

interface LiveChatSidebarProps {
  classId: string;
  isHost: boolean;
  currentUserId: string;
  currentUserName: string;
}

const LiveChatSidebar = ({ classId, isHost, currentUserId, currentUserName }: LiveChatSidebarProps) => {
  const { language } = useLanguage();
  const isHi = language === "hi";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [tab, setTab] = useState<"chat" | "doubt">("chat");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("live_chat_messages")
        .select("*")
        .eq("class_id", classId)
        .order("created_at", { ascending: true });
      if (mounted) {
        setMessages((data || []) as ChatMessage[]);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`chat_${classId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_chat_messages", filter: `class_id=eq.${classId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setMessages((m) => [...m, payload.new as ChatMessage]);
        } else if (payload.eventType === "UPDATE") {
          setMessages((m) => m.map((x) => (x.id === (payload.new as any).id ? (payload.new as ChatMessage) : x)));
        }
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, [classId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, tab]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { error } = await supabase.from("live_chat_messages").insert({
      class_id: classId,
      user_id: currentUserId,
      user_name: currentUserName,
      message: body,
      message_type: replyTo ? "chat" : tab,
      parent_id: replyTo?.id || null,
    });
    setSending(false);
    if (!error) { setText(""); setReplyTo(null); }
  };

  const resolveDoubt = async (id: string) => {
    await supabase.from("live_chat_messages").update({ is_resolved: true }).eq("id", id);
  };

  const { chats, doubts, repliesByParent } = useMemo(() => {
    const chats: ChatMessage[] = [];
    const doubts: ChatMessage[] = [];
    const repliesByParent = new Map<string, ChatMessage[]>();
    for (const m of messages) {
      if (m.parent_id) {
        const arr = repliesByParent.get(m.parent_id) || [];
        arr.push(m);
        repliesByParent.set(m.parent_id, arr);
      } else if (m.message_type === "doubt") doubts.push(m);
      else chats.push(m);
    }
    return { chats, doubts, repliesByParent };
  }, [messages]);

  const visible = tab === "chat" ? chats : doubts;

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="flex border-b border-border">
        <button
          onClick={() => { setTab("chat"); setReplyTo(null); }}
          className={cn("flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5", tab === "chat" ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}
        >
          <MessageCircle className="w-4 h-4" />{isHi ? "चैट" : "Chat"}
        </button>
        <button
          onClick={() => { setTab("doubt"); setReplyTo(null); }}
          className={cn("flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5", tab === "doubt" ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}
        >
          <HelpCircle className="w-4 h-4" />{isHi ? "शंका" : "Doubts"}
          {doubts.some(d => !d.is_resolved) && <span className="w-1.5 h-1.5 rounded-full bg-destructive" />}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : visible.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">
            {tab === "chat" ? (isHi ? "अभी कोई संदेश नहीं" : "No messages yet") : (isHi ? "कोई शंका नहीं" : "No doubts yet")}
          </div>
        ) : (
          visible.map((m) => {
            const replies = repliesByParent.get(m.id) || [];
            const isMine = m.user_id === currentUserId;
            return (
              <div key={m.id} className="space-y-1.5">
                <div className={cn("rounded-xl px-3 py-2 text-sm", tab === "doubt" ? "bg-accent/10 border border-accent/30" : isMine ? "bg-primary/10" : "bg-muted")}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[11px] font-semibold text-foreground/80 truncate">{m.user_name || (isHi ? "उपयोगकर्ता" : "User")}</span>
                    {tab === "doubt" && m.is_resolved && (
                      <span className="text-[10px] text-success flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />{isHi ? "हल" : "Resolved"}</span>
                    )}
                  </div>
                  <p className="text-foreground break-words whitespace-pre-wrap">{m.message}</p>
                  <div className="flex gap-2 mt-1">
                    {(isHost || tab === "doubt") && (
                      <button onClick={() => setReplyTo(m)} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                        <CornerDownRight className="w-3 h-3" />{isHi ? "उत्तर" : "Reply"}
                      </button>
                    )}
                    {tab === "doubt" && isHost && !m.is_resolved && (
                      <button onClick={() => resolveDoubt(m.id)} className="text-[10px] text-success hover:underline">
                        {isHi ? "हल चिह्नित करें" : "Mark resolved"}
                      </button>
                    )}
                  </div>
                </div>
                {replies.length > 0 && (
                  <div className="ml-4 space-y-1.5 border-l-2 border-border pl-2">
                    {replies.map((r) => (
                      <div key={r.id} className="rounded-lg px-2.5 py-1.5 text-xs bg-muted/50">
                        <span className="font-semibold text-foreground/80">{r.user_name}: </span>
                        <span className="text-foreground">{r.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {replyTo && (
        <div className="px-3 py-1.5 bg-muted/50 border-t border-border text-xs flex items-center justify-between">
          <span className="truncate text-muted-foreground">{isHi ? "उत्तर देने के लिए" : "Replying to"} <b>{replyTo.user_name}</b></span>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-2 border-t border-border flex gap-1.5">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={tab === "doubt" && !replyTo ? (isHi ? "अपनी शंका पूछें…" : "Ask a doubt…") : (isHi ? "संदेश लिखें…" : "Type a message…")}
          className="text-sm h-9"
        />
        <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!text.trim() || sending}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </div>
  );
};

export default LiveChatSidebar;
