import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import LiveChatSidebar from "@/components/LiveChatSidebar";
import LiveClass from "@/components/LiveClass";
import { Video, Calendar, Clock, Users, Play, X, Trash2, Maximize2, Minimize2, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

const MAX_STUDENTS_PER_CLASS = 100;

const ElapsedTimer = ({ startTime }: { startTime: string }) => {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  return <span className="font-mono text-xs tabular-nums">{elapsed}</span>;
};

const CountdownTimer = ({ scheduledAt }: { scheduledAt: string }) => {
  const [text, setText] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(scheduledAt).getTime() - Date.now()) / 1000));
      if (diff <= 0) { setText("Starting soon"); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      if (d > 0) setText(`${d}d ${h}h`);
      else if (h > 0) setText(`${h}h ${m}m`);
      else setText(`${m}m`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [scheduledAt]);
  return <span className="text-xs font-semibold text-primary">{text}</span>;
};

const ParticipantToast = ({ name, action }: { name: string; action: "joined" | "left" }) => (
  <div className="flex items-center gap-2">
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${action === "joined" ? "bg-emerald-500" : "bg-muted-foreground"}`}>
      {name?.charAt(0)?.toUpperCase() || "?"}
    </div>
    <span className="text-sm"><b>{name}</b> {action === "joined" ? "joined" : "left"}</span>
  </div>
);

const LiveClasses = () => {
  const { user, role, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [classes, setClasses] = useState<any[]>([]);
  const [teacherProfiles, setTeacherProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [joiningClassId, setJoiningClassId] = useState<string | null>(null);

  const isTeacherOrAdmin = role === "teacher" || role === "admin";

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("live_classes").select("*").order("scheduled_at", { ascending: true });
    if (error) { toast.error("Failed to load classes: " + error.message); }
    else {
      setClasses(data || []);
      const teacherIds = [...new Set((data || []).map((c: any) => c.teacher_id))];
      if (teacherIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles")
          .select("user_id, full_name, avatar_url").in("user_id", teacherIds);
        if (profiles) {
          const map: Record<string, any> = {};
          profiles.forEach((p: any) => { map[p.user_id] = p; });
          setTeacherProfiles(map);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClasses();
    const channel = supabase.channel("live_classes_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_classes" }, () => fetchClasses())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const classIdFromQuery = searchParams.get("classId");

    if (!classIdFromQuery) return;

    const requestedClass = classes.find((item) => item.id === classIdFromQuery);
    if (!requestedClass) return;

    if (!isTeacherOrAdmin && requestedClass.status !== "live") {
      toast.error("Class has not started yet.");
      navigate("/dashboard/live-classes", { replace: true });
      return;
    }

    setActiveRoom((current) => current ?? requestedClass.room_id);
    setActiveClassId((current) => current ?? requestedClass.id);
    setShowChat(!isMobile);
  }, [searchParams, classes, isMobile, isTeacherOrAdmin, navigate]);

  const handleStartClass = async (classItem: any) => {
    const { data, error } = await supabase.from("live_classes")
      .update({ status: "live", current_students: 0, updated_at: new Date().toISOString() } as any)
      .eq("id", classItem.id)
      .eq("teacher_id", user?.id || "")
      .select("*")
      .single();
    if (error || !data) { toast.error("Failed to start class: " + (error?.message || "Unknown error")); return; }
    toast.success("🔴 Class is now LIVE!");
    await fetchClasses();
    setActiveRoom(data.room_id);
    setActiveClassId(data.id);
    setShowChat(!isMobile);
  };

  const handleJoinClass = async (classItem: any) => {
    if (joiningClassId) return;
    setJoiningClassId(classItem.id);

    const { data: freshClass, error } = await supabase
      .from("live_classes").select("*").eq("id", classItem.id).single();

    if (error || !freshClass) {
      toast.error("Unable to open class right now.");
      setJoiningClassId(null);
      return;
    }

    if (!isTeacherOrAdmin && freshClass.status !== "live") {
      toast.error("Class has not started yet.");
      setJoiningClassId(null);
      return;
    }

    if (!isTeacherOrAdmin && freshClass.current_students >= (freshClass.max_students || MAX_STUDENTS_PER_CLASS)) {
      toast.error(`Class is full (${freshClass.max_students || MAX_STUDENTS_PER_CLASS} students max)`);
      setJoiningClassId(null);
      return;
    }

    setActiveRoom(freshClass.room_id);
    setActiveClassId(freshClass.id);
    setShowChat(!isMobile);
    setJoiningClassId(null);
  };

  const handleLeaveClass = async () => {
    setActiveRoom(null);
    setActiveClassId(null);
    setShowChat(!isMobile);
    await fetchClasses();
  };

  const handleEndClass = async (classItem: any) => {
    const { error } = await supabase.from("live_classes").delete()
      .eq("id", classItem.id).eq("teacher_id", user?.id || "");
    if (error) { toast.error("Failed: " + error.message); return; }
    setActiveRoom(null);
    setActiveClassId(null);
    await fetchClasses();
    toast.success("Class ended & removed");
  };

  const handleDeleteClass = async (classItem: any) => {
    const { error } = await supabase.from("live_classes").delete()
      .eq("id", classItem.id).eq("teacher_id", user?.id || "");
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success("Class cancelled");
    await fetchClasses();
  };

  const upcomingClasses = classes.filter((c) => c.status === "scheduled");
  const liveClasses = classes.filter((c) => c.status === "live");

  const activeClassRef = useRef<any>(null);
  const activeClassIdRef = useRef<string | null>(null);
  const [livePeers, setLivePeers] = useState(0);

  useEffect(() => {
    activeClassRef.current = classes.find((item) => item.id === activeClassId) || null;
    activeClassIdRef.current = activeClassId;
  }, [classes, activeClassId]);

  // Stable refs — never change, so LiveClass effect won't re-init the room.
  const handleStudentJoin = useRef(async () => {
    const classId = activeClassIdRef.current;
    if (!classId) return;
    const { data } = await supabase.from("live_classes").select("current_students").eq("id", classId).single();
    const next = Math.max(0, (data?.current_students || 0) + 1);
    await supabase.from("live_classes").update({ current_students: next } as any).eq("id", classId);
  }).current;

  const handleStudentLeave = useRef(async () => {
    const classId = activeClassIdRef.current;
    if (!classId) return;
    const { data } = await supabase.from("live_classes").select("current_students").eq("id", classId).single();
    const next = Math.max(0, (data?.current_students || 0) - 1);
    await supabase.from("live_classes").update({ current_students: next } as any).eq("id", classId);
  }).current;

  const handleParticipantCount = useRef((count: number) => {
    setLivePeers(count);
  }).current;

  const handleLeaveRoom = useRef(() => {
    setActiveRoom(null);
    setActiveClassId(null);
    setShowChat(false);
    void fetchClasses();
  }).current;

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoWrapperRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await videoWrapperRef.current?.requestFullscreen();
        try { await (screen.orientation as any)?.lock?.('landscape'); } catch {}
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        try { screen.orientation?.unlock?.(); } catch {}
        setIsFullscreen(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ═══════════════ ACTIVE CLASS VIEW ═══════════════
  if (activeRoom && activeClassId) {
    const activeClass = classes.find((c) => c.id === activeClassId);
    const teacher = teacherProfiles[activeClass?.teacher_id];
    const studentCount = activeClass?.current_students || 0;
    const maxStudents = activeClass?.max_students || 100;
    const fillPercent = Math.min(100, Math.round((studentCount / maxStudents) * 100));

    return (
      <DashboardLayout>
        <div ref={videoWrapperRef} className={`${isFullscreen ? 'fixed inset-0 z-[9999]' : '-m-3 sm:-m-4 lg:-m-6'} flex flex-col h-[calc(100vh-48px)] lg:h-[calc(100vh-64px)] bg-black`}>
          {/* Top control bar */}
          {!isFullscreen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-3 py-2 bg-card/95 backdrop-blur-md border-b border-border flex items-center justify-between gap-2 z-10 shrink-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 text-destructive px-2 py-1 rounded-full shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">Live</span>
                </div>
                <h1 className="text-sm font-bold text-foreground truncate">
                  {activeClass?.title || "Live Class"}
                </h1>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {activeClass?.updated_at && (
                  <div className="hidden sm:flex items-center gap-1 text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3" />
                    <ElapsedTimer startTime={activeClass.updated_at} />
                  </div>
                )}
                <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-full">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{Math.max(livePeers, studentCount)}</span>
                  <span className="text-[10px] text-muted-foreground">/{maxStudents}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowChat(!showChat)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </Button>
                {isTeacherOrAdmin && activeClass?.teacher_id === user?.id && (
                  <Button variant="destructive" size="sm" onClick={() => handleEndClass(activeClass)} className="text-xs h-8 gap-1">
                    <X className="w-3 h-3" /> End
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleLeaveClass} className="text-xs h-8">Leave</Button>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden relative">
            {/* Video area */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0">
              <div className="relative w-full bg-black flex-1 min-h-[240px] lg:min-h-0">
                <LiveClass
                  roomID={activeRoom}
                  forceHost={isTeacherOrAdmin && activeClass?.teacher_id === user?.id}
                  onLeave={handleLeaveClass}
                  onStudentJoin={handleStudentJoin}
                  onStudentLeave={handleStudentLeave}
                  className="absolute inset-0 w-full h-full"
                />
                <button onClick={toggleFullscreen}
                  className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-lg p-2 transition-all backdrop-blur-sm">
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                  <span className="bg-emerald-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                    {isTeacherOrAdmin ? 'HD BROADCASTING' : 'HD LIVE'}
                  </span>
                </div>
              </div>

              {!isFullscreen && teacher && (
                <div className="px-3 py-2 bg-card border-b border-border flex items-center gap-3 shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                    {teacher.avatar_url ? (
                      <img src={teacher.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : teacher.full_name?.charAt(0)?.toUpperCase() || "T"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{teacher.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">Teacher</p>
                  </div>
                </div>
              )}
            </div>

            {/* Chat sidebar */}
            <AnimatePresence>
              {showChat && !isFullscreen && (
                <motion.div
                  initial={isMobile ? { y: "100%" } : { width: 0, opacity: 0 }}
                  animate={isMobile ? { y: 0 } : { width: "auto", opacity: 1 }}
                  exit={isMobile ? { y: "100%" } : { width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={isMobile
                    ? "absolute inset-x-0 bottom-0 z-20 h-[50vh] border-t border-border overflow-hidden bg-card shadow-2xl rounded-t-2xl"
                    : "lg:w-[340px] xl:w-[380px] lg:min-w-[300px] shrink-0 border-l border-border overflow-hidden"
                  }
                >
                  {isMobile && (
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                      <span className="text-sm font-semibold">Chat</span>
                      <button onClick={() => setShowChat(false)} className="p-1 rounded-full hover:bg-muted">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <LiveChatSidebar classId={activeClassId} isTeacher={isTeacherOrAdmin} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ═══════════════ CLASS LISTING ═══════════════
  return (
    <DashboardLayout>
      <div className="space-y-5 pb-20 lg:pb-0">
        <div>
          <h1 className="text-lg font-extrabold font-heading text-foreground flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" /> Live Classes
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isTeacherOrAdmin ? "Manage and start your live classes" : "Join live interactive classes"}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* LIVE NOW */}
            {liveClasses.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
                  </span>
                  <h2 className="text-base font-bold text-foreground">Live Now</h2>
                  <span className="text-xs bg-destructive/10 text-destructive font-semibold px-2 py-0.5 rounded-full">{liveClasses.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {liveClasses.map((c, i) => {
                    const tch = teacherProfiles[c.teacher_id];
                    const isFull = (c.current_students || 0) >= (c.max_students || MAX_STUDENTS_PER_CLASS);
                    const isOwner = isTeacherOrAdmin && c.teacher_id === user?.id;
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`group relative bg-card rounded-2xl overflow-hidden border-2 shadow-lg transition-all ${
                          isFull && !isTeacherOrAdmin ? "opacity-60 border-border" : "border-destructive/30 hover:border-destructive/50 cursor-pointer"
                        }`}
                        onClick={() => !isOwner && !isFull && handleJoinClass(c)}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-destructive/5 to-transparent pointer-events-none" />
                        <div className="relative aspect-video bg-gradient-to-br from-muted to-muted/30 overflow-hidden">
                          {c.thumbnail_url ? (
                            <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-destructive/10 to-primary/10 flex items-center justify-center">
                              <Video className="w-14 h-14 text-muted-foreground/15" />
                            </div>
                          )}
                          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-destructive text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                          </div>
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                            <span className="bg-black/70 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg flex items-center gap-1.5">
                              <Users className="w-3 h-3" /> {c.current_students || 0}/{c.max_students || 100}
                            </span>
                            <span className="bg-black/70 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg">
                              {c.duration_minutes}min
                            </span>
                          </div>
                          {!isFull && !isOwner && (
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                                <Play className="w-7 h-7 text-white fill-white ml-1" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-bold text-foreground text-sm truncate">{c.title}</h3>
                          {c.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>}
                          {tch && (
                            <div className="flex items-center gap-2 mt-2">
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary overflow-hidden">
                                {tch.avatar_url ? <img src={tch.avatar_url} alt="" className="w-full h-full object-cover" /> : tch.full_name?.charAt(0)?.toUpperCase() || "T"}
                              </div>
                              <span className="text-xs text-muted-foreground">{tch.full_name}</span>
                            </div>
                          )}
                          {isOwner ? (
                            <div className="flex gap-2 mt-2">
                              <Button onClick={(e) => { e.stopPropagation(); handleJoinClass(c); }}
                                className="flex-1 bg-destructive hover:bg-destructive/90 text-white" size="sm">
                                <Monitor className="w-3.5 h-3.5 mr-1" /> Open Studio
                              </Button>
                              <Button variant="outline" onClick={(e) => { e.stopPropagation(); handleEndClass(c); }} size="sm">
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : isFull ? (
                            <p className="text-xs text-destructive mt-2 font-semibold">Class is full</p>
                          ) : (
                            <p className="text-[11px] text-primary mt-2 font-medium">{joiningClassId === c.id ? "Joining..." : "Tap to join →"}</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* UPCOMING */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h2 className="text-base font-bold text-foreground">Upcoming Classes</h2>
                {upcomingClasses.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">{upcomingClasses.length}</span>
                )}
              </div>
              {upcomingClasses.length === 0 ? (
                <div className="text-center py-10 bg-card rounded-2xl border border-border">
                  <Calendar className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                  <h3 className="text-sm font-bold text-foreground mb-1">No Upcoming Classes</h3>
                  <p className="text-xs text-muted-foreground px-4">
                    {isTeacherOrAdmin ? "Schedule a class from your course page" : "Check back later for new classes"}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {upcomingClasses.map((c, i) => {
                    const tch = teacherProfiles[c.teacher_id];
                    const isOwner = isTeacherOrAdmin && c.teacher_id === user?.id;
                    const scheduledDate = new Date(c.scheduled_at);
                    const isToday = new Date().toDateString() === scheduledDate.toDateString();
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="bg-card rounded-2xl overflow-hidden border border-border hover:shadow-md transition-all group"
                      >
                        <div className="relative aspect-video bg-gradient-to-br from-muted to-muted/30 overflow-hidden">
                          {c.thumbnail_url ? (
                            <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
                              <Video className="w-10 h-10 text-muted-foreground/15" />
                            </div>
                          )}
                          <div className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-lg backdrop-blur-sm ${
                            isToday ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"
                          }`}>
                            {isToday ? "TODAY" : scheduledDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </div>
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-lg">
                            <CountdownTimer scheduledAt={c.scheduled_at} />
                          </div>
                        </div>
                        <div className="p-3">
                          <h3 className="font-bold text-foreground text-sm truncate">{c.title}</h3>
                          {tch && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary overflow-hidden">
                                {tch.avatar_url ? <img src={tch.avatar_url} alt="" className="w-full h-full object-cover" /> : tch.full_name?.charAt(0)?.toUpperCase() || "T"}
                              </div>
                              <span className="text-[11px] text-muted-foreground">{tch.full_name}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {scheduledDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> Max {c.max_students || 100}
                            </span>
                          </div>
                          {isOwner && (
                            <div className="flex gap-2 mt-2">
                              <Button onClick={() => handleStartClass(c)} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" size="sm">
                                <Play className="w-3.5 h-3.5 mr-1" /> Start
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteClass(c)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {liveClasses.length === 0 && upcomingClasses.length === 0 && (
              <div className="text-center py-16 bg-card rounded-2xl border border-border">
                <Video className="w-12 h-12 mx-auto text-primary/20 mb-3" />
                <h3 className="text-sm font-bold text-foreground mb-1">No Live Classes</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {isTeacherOrAdmin
                    ? "Go to your course page and schedule a live class."
                    : "Your teachers haven't scheduled any live classes yet."}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default LiveClasses;
