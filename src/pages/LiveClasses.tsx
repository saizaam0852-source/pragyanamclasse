import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import LiveClass from "@/components/LiveClass";
import { Video, Calendar, Clock, Users, Play, X, Trash2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface LiveClassRow {
  id: string;
  title: string;
  title_hi: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  teacher_id: string;
  course_id: string | null;
  current_students: number;
  max_students: number;
  thumbnail_url: string | null;
  room_id: string;
}

const LiveClasses = () => {
  const { user, role } = useAuth();
  const { language } = useLanguage();
  const isHi = language === "hi";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeClassId = searchParams.get("classId");

  const [classes, setClasses] = useState<LiveClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    title_hi: "",
    description: "",
    scheduled_at: "",
    duration_minutes: 60,
  });

  const canManage = role === "teacher" || role === "admin";

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("live_classes")
      .select("*")
      .order("scheduled_at", { ascending: true });
    if (error) {
      toast.error(error.message);
    } else {
      setClasses((data || []) as LiveClassRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  // Realtime updates so status changes appear instantly
  useEffect(() => {
    const channel = supabase
      .channel("live_classes_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_classes" }, () => {
        fetchClasses();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchClasses]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.title || !form.scheduled_at) {
      toast.error(isHi ? "शीर्षक और समय आवश्यक है" : "Title and time are required");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("live_classes").insert({
      title: form.title,
      title_hi: form.title_hi || form.title,
      description: form.description || null,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: form.duration_minutes,
      teacher_id: user.id,
      status: "scheduled",
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isHi ? "लाइव क्लास शेड्यूल हो गई" : "Live class scheduled");
    setForm({ title: "", title_hi: "", description: "", scheduled_at: "", duration_minutes: 60 });
    setShowForm(false);
    fetchClasses();
  };

  const handleStart = async (cls: LiveClassRow) => {
    const { error } = await supabase
      .from("live_classes")
      .update({ status: "live", started_at: new Date().toISOString() })
      .eq("id", cls.id);
    if (error) { toast.error(error.message); return; }
    setSearchParams({ classId: cls.id });
  };

  const handleEnd = async (cls: LiveClassRow) => {
    await supabase.from("live_classes")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", cls.id);
    fetchClasses();
  };

  const [attendanceFor, setAttendanceFor] = useState<LiveClassRow | null>(null);

  const handleJoin = (cls: LiveClassRow) => {
    if (cls.status !== "live") {
      toast.error(isHi ? "क्लास अभी लाइव नहीं है" : "Class is not live yet");
      return;
    }
    setSearchParams({ classId: cls.id });
  };

  const handleDelete = async (cls: LiveClassRow) => {
    if (!confirm(isHi ? "क्या आप इस क्लास को हटाना चाहते हैं?" : "Delete this class?")) return;
    const { error } = await supabase.from("live_classes").delete().eq("id", cls.id);
    if (error) { toast.error(error.message); return; }
    toast.success(isHi ? "हटा दिया गया" : "Deleted");
    fetchClasses();
  };

  const handleLeave = useCallback(async () => {
    const cls = classes.find(c => c.id === activeClassId);
    if (cls && (cls.teacher_id === user?.id || role === "admin")) {
      await handleEnd(cls);
    }
    setSearchParams({});
  }, [activeClassId, classes, user?.id, role, setSearchParams]);

  // ------ ACTIVE CLASS VIEW ------
  if (activeClassId) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-background/95 backdrop-blur border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-full animate-pulse">● LIVE</span>
            <span className="text-sm font-medium text-foreground truncate max-w-[60vw]">
              {classes.find(c => c.id === activeClassId)?.title || (isHi ? "लाइव क्लास" : "Live Class")}
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={handleLeave}>
            <X className="w-4 h-4 mr-1" /> {isHi ? "बाहर निकलें" : "Leave"}
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <LiveClass classId={activeClassId} onLeave={handleLeave} />
        </div>
      </div>
    );
  }

  // ------ LIST VIEW ------
  const live = classes.filter(c => c.status === "live");
  const upcoming = classes.filter(c => c.status === "scheduled");
  const ended = classes.filter(c => c.status === "ended");

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <Video className="w-7 h-7 text-primary" />
              {isHi ? "लाइव क्लासेस" : "Live Classes"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isHi ? "वीडियो लाइव क्लासेस में शामिल हों" : "Join interactive live video classes"}
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setShowForm(v => !v)} className="gradient-saffron border-0 text-primary-foreground">
              <Plus className="w-4 h-4 mr-1" /> {isHi ? "नई क्लास" : "Schedule"}
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showForm && canManage && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSchedule}
              className="bg-card border border-border rounded-2xl p-4 space-y-3 overflow-hidden"
            >
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{isHi ? "शीर्षक (English)" : "Title (English)"}</Label>
                  <Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">{isHi ? "शीर्षक (हिंदी)" : "Title (Hindi)"}</Label>
                  <Input value={form.title_hi} onChange={e => setForm({ ...form, title_hi: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">{isHi ? "विवरण" : "Description"}</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1" rows={2} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{isHi ? "तिथि और समय" : "Date & time"}</Label>
                  <Input type="datetime-local" required value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">{isHi ? "अवधि (मिनट)" : "Duration (min)"}</Label>
                  <Input type="number" min={15} max={180} value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} className="mt-1" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting} className="gradient-saffron border-0 text-primary-foreground">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (isHi ? "शेड्यूल करें" : "Schedule")}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  {isHi ? "रद्द करें" : "Cancel"}
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <Section title={isHi ? "अभी लाइव" : "Live now"} count={live.length} accent>
              {live.length === 0 ? <Empty text={isHi ? "अभी कोई क्लास लाइव नहीं" : "No classes live right now"} /> : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {live.map(c => (
                    <ClassCard key={c.id} cls={c} isHi={isHi} canManage={canManage} userId={user?.id}
                      onJoin={() => handleJoin(c)} onEnd={() => handleEnd(c)} onDelete={() => handleDelete(c)} />
                  ))}
                </div>
              )}
            </Section>

            <Section title={isHi ? "आने वाली क्लासेस" : "Upcoming"} count={upcoming.length}>
              {upcoming.length === 0 ? <Empty text={isHi ? "कोई आगामी क्लास नहीं" : "No upcoming classes"} /> : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {upcoming.map(c => (
                    <ClassCard key={c.id} cls={c} isHi={isHi} canManage={canManage} userId={user?.id}
                      onStart={() => handleStart(c)} onDelete={() => handleDelete(c)} />
                  ))}
                </div>
              )}
            </Section>

            {ended.length > 0 && (
              <Section title={isHi ? "समाप्त" : "Ended"} count={ended.length}>
                <div className="grid sm:grid-cols-2 gap-3">
                  {ended.slice(0, 6).map(c => (
                    <ClassCard key={c.id} cls={c} isHi={isHi} canManage={canManage} userId={user?.id}
                      ended onDelete={() => handleDelete(c)} />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

const Section = ({ title, count, children, accent }: { title: string; count: number; children: React.ReactNode; accent?: boolean }) => (
  <section>
    <div className="flex items-center gap-2 mb-3">
      <h2 className={`text-base font-bold ${accent ? "text-destructive" : "text-foreground"}`}>{title}</h2>
      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{count}</span>
    </div>
    {children}
  </section>
);

const Empty = ({ text }: { text: string }) => (
  <div className="text-sm text-muted-foreground text-center py-6 bg-card border border-border border-dashed rounded-xl">{text}</div>
);

const ClassCard = ({ cls, isHi, canManage, userId, onJoin, onStart, onEnd, onDelete, ended }: {
  cls: LiveClassRow;
  isHi: boolean;
  canManage: boolean;
  userId?: string;
  onJoin?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
  onDelete?: () => void;
  ended?: boolean;
}) => {
  const isOwner = canManage && cls.teacher_id === userId;
  const date = new Date(cls.scheduled_at);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {cls.status === "live" && (
            <span className="inline-block text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full mb-1 animate-pulse">● LIVE</span>
          )}
          <h3 className="font-semibold text-foreground truncate">{isHi && cls.title_hi ? cls.title_hi : cls.title}</h3>
          {cls.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{cls.description}</p>}
        </div>
        {(canManage && (isOwner || cls.teacher_id === userId)) && (
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{cls.duration_minutes}m</span>
      </div>

      <div className="mt-3 flex gap-2">
        {cls.status === "live" && onJoin && (
          <Button size="sm" className="gradient-saffron border-0 text-primary-foreground flex-1" onClick={onJoin}>
            <Play className="w-3.5 h-3.5 mr-1" />{isHi ? "जॉइन करें" : "Join"}
          </Button>
        )}
        {cls.status === "live" && isOwner && onEnd && (
          <Button size="sm" variant="destructive" onClick={onEnd}>{isHi ? "समाप्त" : "End"}</Button>
        )}
        {cls.status === "scheduled" && isOwner && onStart && (
          <Button size="sm" className="gradient-saffron border-0 text-primary-foreground flex-1" onClick={onStart}>
            <Play className="w-3.5 h-3.5 mr-1" />{isHi ? "शुरू करें" : "Start now"}
          </Button>
        )}
        {cls.status === "scheduled" && !isOwner && (
          <span className="text-xs text-muted-foreground self-center">{isHi ? "जल्द ही" : "Starts soon"}</span>
        )}
        {ended && <span className="text-xs text-muted-foreground self-center">{isHi ? "समाप्त" : "Ended"}</span>}
      </div>
    </motion.div>
  );
};

export default LiveClasses;
