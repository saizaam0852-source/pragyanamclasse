import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Search, CheckCircle, XCircle, GraduationCap, Phone, MapPin, School, Eye, Calendar, Ban, UserX, Shield, BookOpen, Clock, Award, Users, Trash2, UserPlus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } }),
  exit: { opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.2 } },
};

const statVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({ opacity: 1, scale: 1, transition: { delay: i * 0.08, type: "spring" as const, stiffness: 200 } }),
};

const AdminTeachers = () => {
  const { language } = useLanguage();
  const isHi = language === "hi";
  const [teachers, setTeachers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "disabled">("all");
  const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ email: "", password: "", full_name: "", phone: "", qualification: "", subjects_taught: "" });

  const handleCreateTeacher = async () => {
    if (!newTeacher.email || !newTeacher.password || !newTeacher.full_name) {
      toast.error(isHi ? "नाम, ईमेल और पासवर्ड आवश्यक हैं" : "Name, email and password are required");
      return;
    }
    if (newTeacher.password.length < 6) {
      toast.error(isHi ? "पासवर्ड कम से कम 6 अक्षर का होना चाहिए" : "Password must be at least 6 characters");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-teacher-account", { body: newTeacher });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(isHi ? "शिक्षक खाता बनाया गया" : "Teacher account created");
      setCreateOpen(false);
      setNewTeacher({ email: "", password: "", full_name: "", phone: "", qualification: "", subjects_taught: "" });
      await fetchTeachers();
    } catch (e: any) {
      toast.error(e?.message || (isHi ? "खाता बनाने में विफल" : "Failed to create teacher"));
    } finally {
      setCreating(false);
    }
  };

  const fetchTeachers = async () => {
    const { data: teacherRoles } = await supabase.from("user_roles").select("user_id").eq("role", "teacher");
    const teacherIds = (teacherRoles || []).map((r: any) => r.user_id);
    if (teacherIds.length === 0) { setTeachers([]); setLoading(false); return; }

    const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", teacherIds);

    const { data: courses } = await supabase.from("courses").select("created_by").in("created_by", teacherIds);
    const courseCounts: Record<string, number> = {};
    (courses || []).forEach((c: any) => { courseCounts[c.created_by] = (courseCounts[c.created_by] || 0) + 1; });

    const { data: liveClasses } = await supabase.from("live_classes").select("teacher_id").in("teacher_id", teacherIds);
    const liveCounts: Record<string, number> = {};
    (liveClasses || []).forEach((l: any) => { liveCounts[l.teacher_id] = (liveCounts[l.teacher_id] || 0) + 1; });

    const { data: tests } = await supabase.from("tests").select("created_by").in("created_by", teacherIds);
    const testCounts: Record<string, number> = {};
    (tests || []).forEach((t: any) => { if (t.created_by) testCounts[t.created_by] = (testCounts[t.created_by] || 0) + 1; });

    // Get enrolled student counts per teacher's courses
    const { data: allCourses } = await supabase.from("courses").select("id, created_by").in("created_by", teacherIds);
    const courseIdMap: Record<string, string> = {};
    (allCourses || []).forEach((c: any) => { courseIdMap[c.id] = c.created_by; });
    const courseIds = Object.keys(courseIdMap);
    let studentCounts: Record<string, number> = {};
    if (courseIds.length > 0) {
      const { data: enrollments } = await supabase.from("enrollments").select("course_id").in("course_id", courseIds);
      (enrollments || []).forEach((e: any) => {
        const teacherId = courseIdMap[e.course_id];
        if (teacherId) studentCounts[teacherId] = (studentCounts[teacherId] || 0) + 1;
      });
    }

    const enriched = (profiles || []).map((p: any) => ({
      ...p,
      courseCount: courseCounts[p.user_id] || 0,
      liveClassCount: liveCounts[p.user_id] || 0,
      testCount: testCounts[p.user_id] || 0,
      studentCount: studentCounts[p.user_id] || 0,
    }));
    setTeachers(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchTeachers(); }, []);

  const handleVerify = async (userId: string, verified: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_verified: verified }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success(verified ? (isHi ? "शिक्षक स्वीकृत!" : "Teacher approved!") : (isHi ? "स्वीकृति हटाई" : "Approval revoked"));
    fetchTeachers();
    if (selectedTeacher?.user_id === userId) {
      setSelectedTeacher((prev: any) => prev ? { ...prev, is_verified: verified } : null);
    }
  };

  const handleDisable = async (userId: string, disable: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_disabled: disable }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success(disable ? (isHi ? "खाता अक्षम किया!" : "Account disabled!") : (isHi ? "खाता सक्रिय किया!" : "Account enabled!"));
    fetchTeachers();
    if (selectedTeacher?.user_id === userId) {
      setSelectedTeacher((prev: any) => prev ? { ...prev, is_disabled: disable } : null);
    }
  };

  const handleRemoveRole = async (userId: string) => {
    const { error: deleteErr } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "teacher");
    if (deleteErr) { toast.error(deleteErr.message); return; }
    const { error: insertErr } = await supabase.from("user_roles").insert({ user_id: userId, role: "student" });
    if (insertErr) { toast.error(insertErr.message); return; }
    toast.success(isHi ? "शिक्षक भूमिका हटाई, अब छात्र है" : "Teacher role removed, now a student");
    setSelectedTeacher(null);
    fetchTeachers();
  };

  const handleDelete = async (userId: string) => {
    const { error: roleErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (roleErr) { toast.error(roleErr.message); return; }
    const { error: profErr } = await supabase.from("profiles").delete().eq("user_id", userId);
    if (profErr) { toast.error(profErr.message); return; }
    toast.success(isHi ? "उपयोगकर्ता हटाया गया" : "User deleted");
    setSelectedTeacher(null);
    fetchTeachers();
  };

  let filtered = teachers.filter(
    (p) => p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search) || p.school?.toLowerCase().includes(search.toLowerCase())
  );
  if (filter === "pending") filtered = filtered.filter((p) => !p.is_verified && !p.is_disabled);
  if (filter === "approved") filtered = filtered.filter((p) => p.is_verified && !p.is_disabled);
  if (filter === "disabled") filtered = filtered.filter((p) => p.is_disabled);

  const pendingCount = teachers.filter((p) => !p.is_verified && !p.is_disabled).length;
  const approvedCount = teachers.filter((p) => p.is_verified && !p.is_disabled).length;
  const disabledCount = teachers.filter((p) => p.is_disabled).length;

  const DetailRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => {
    const displayValue = value || (isHi ? "अपडेट नहीं किया" : "Not updated");
    return (
      <div className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-xl">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={`text-sm font-medium truncate ${value ? "text-foreground" : "text-muted-foreground italic"}`}>{displayValue}</p>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-2xl font-extrabold font-heading text-foreground flex items-center gap-2">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              {isHi ? "शिक्षक प्रबंधन" : "Teacher Management"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{isHi ? "सभी शिक्षकों को मैनेज करें" : "Manage all platform teachers"}</p>
          </div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={isHi ? "नाम, फ़ोन, स्कूल..." : "Name, phone, school..."} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </motion.div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {[
            { key: "all" as const, count: teachers.length, label: isHi ? "कुल" : "Total", color: "text-foreground", bg: "bg-primary/5" },
            { key: "approved" as const, count: approvedCount, label: isHi ? "स्वीकृत" : "Approved", color: "text-emerald-500", bg: "bg-emerald-500/5" },
            { key: "pending" as const, count: pendingCount, label: isHi ? "लंबित" : "Pending", color: "text-amber-500", bg: "bg-amber-500/5" },
            { key: "disabled" as const, count: disabledCount, label: isHi ? "अक्षम" : "Disabled", color: "text-destructive", bg: "bg-destructive/5" },
          ].map((s, i) => (
            <motion.div key={s.key} custom={i} variants={statVariants} initial="hidden" animate="visible"
              className={`${s.bg} rounded-xl p-2.5 sm:p-4 border border-border text-center cursor-pointer hover:scale-105 transition-transform`}
              onClick={() => setFilter(s.key)}>
              <p className={`text-lg sm:text-2xl font-extrabold ${s.color}`}>{s.count}</p>
              <p className="text-[9px] sm:text-sm text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter tabs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="flex gap-1 bg-muted rounded-lg p-1 w-fit overflow-x-auto">
          {([
            { key: "all" as const, label: isHi ? "सभी" : "All" },
            { key: "approved" as const, label: isHi ? "स्वीकृत" : "Approved" },
            { key: "pending" as const, label: `${isHi ? "लंबित" : "Pending"}${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
            { key: "disabled" as const, label: isHi ? "अक्षम" : "Disabled" },
          ]).map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap ${filter === f.key ? "bg-card text-foreground shadow-sm scale-105" : "text-muted-foreground hover:text-foreground"}`}>
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-card rounded-xl border border-border">
            <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">{isHi ? "कोई शिक्षक नहीं मिला" : "No teachers found"}</p>
            <p className="text-xs text-muted-foreground mt-1">{isHi ? "खोज बदलें या फ़िल्टर हटाएँ" : "Try changing search or filters"}</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((teacher, i) => (
                <motion.div key={teacher.id} custom={i} variants={cardVariants} initial="hidden" animate="visible" exit="exit" layout
                  className={`bg-card rounded-xl border p-4 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 ${teacher.is_disabled ? "border-destructive/30 opacity-60" : "border-border hover:border-primary/20"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary shrink-0 ring-2 ring-primary/10">
                      {teacher.avatar_url ? (
                        <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${teacher.avatar_url}`} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        teacher.full_name?.charAt(0)?.toUpperCase() || "T"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-foreground text-sm truncate">{teacher.full_name || "—"}</p>
                        {teacher.is_disabled ? (
                          <Badge variant="destructive" className="text-[9px] h-4 px-1.5">{isHi ? "अक्षम" : "Disabled"}</Badge>
                        ) : teacher.is_verified ? (
                          <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{isHi ? "स्वीकृत" : "Approved"}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20">{isHi ? "लंबित" : "Pending"}</Badge>
                        )}
                      </div>
                      {teacher.qualification && <p className="text-[10px] text-primary/80 mt-0.5">🎓 {teacher.qualification}</p>}
                      {teacher.bio && <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{teacher.bio}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] sm:text-xs text-muted-foreground mb-3">
                    {teacher.phone && <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1"><Phone className="w-3 h-3 text-primary/60" />{teacher.phone}</div>}
                    {teacher.school && <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1"><School className="w-3 h-3 text-primary/60" /><span className="truncate">{teacher.school}</span></div>}
                    {teacher.state && <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1"><MapPin className="w-3 h-3 text-primary/60" />{teacher.district ? `${teacher.district}, ` : ""}{teacher.state}</div>}
                    {teacher.experience_years && <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1"><Clock className="w-3 h-3 text-primary/60" />{teacher.experience_years} {isHi ? "वर्ष" : "yrs exp"}</div>}
                    {teacher.created_at && (
                      <div className="flex items-center gap-1.5 bg-muted/40 rounded-lg px-2 py-1 col-span-2">
                        <Calendar className="w-3 h-3 text-primary/60" />
                        {isHi ? "शामिल हुए" : "Joined"}: {new Date(teacher.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    )}
                  </div>

                  {/* Mini stats */}
                  <div className="flex gap-2 mb-3">
                    {[
                      { val: teacher.courseCount, label: isHi ? "कोर्स" : "Courses", emoji: "📚" },
                      { val: teacher.studentCount, label: isHi ? "छात्र" : "Students", emoji: "👥" },
                      { val: teacher.testCount, label: isHi ? "टेस्ट" : "Tests", emoji: "📝" },
                    ].map((s) => (
                      <div key={s.label} className="flex-1 text-center p-1.5 bg-muted/30 rounded-lg">
                        <p className="text-xs font-bold text-foreground">{s.emoji} {s.val}</p>
                        <p className="text-[8px] text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setSelectedTeacher(teacher)} className="h-8 text-xs hover:scale-105 transition-transform">
                      <Eye className="w-3.5 h-3.5 mr-1" /> {isHi ? "विवरण" : "Details"}
                    </Button>
                    {!teacher.is_disabled && !teacher.is_verified && (
                      <Button size="sm" onClick={() => handleVerify(teacher.user_id, true)} className="flex-1 h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-105 transition-transform">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> {isHi ? "स्वीकृत" : "Approve"}
                      </Button>
                    )}
                    {!teacher.is_disabled && teacher.is_verified && (
                      <Button size="sm" variant="outline" onClick={() => handleVerify(teacher.user_id, false)} className="flex-1 h-8 text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10 hover:scale-105 transition-transform">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> {isHi ? "रिवोक" : "Revoke"}
                      </Button>
                    )}
                    {!teacher.is_disabled && (
                      <Button size="sm" variant="outline" onClick={() => handleDisable(teacher.user_id, true)} className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:scale-105 transition-transform">
                        <Ban className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {teacher.is_disabled && (
                      <Button size="sm" onClick={() => handleDisable(teacher.user_id, false)} className="flex-1 h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-105 transition-transform">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> {isHi ? "सक्रिय" : "Enable"}
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Teacher Detail Sheet */}
      <Sheet open={!!selectedTeacher} onOpenChange={(open) => !open && setSelectedTeacher(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          {selectedTeacher && (
            <div>
              {/* Header with gradient */}
              <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-8">
                <SheetHeader>
                  <SheetTitle className="text-sm text-muted-foreground">{isHi ? "शिक्षक विवरण" : "Teacher Details"}</SheetTitle>
                </SheetHeader>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mt-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0 overflow-hidden ring-4 ring-background shadow-xl">
                    {selectedTeacher.avatar_url ? (
                      <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${selectedTeacher.avatar_url}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedTeacher.full_name?.charAt(0)?.toUpperCase() || "T"
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{selectedTeacher.full_name || "—"}</h3>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {selectedTeacher.is_disabled ? (
                        <Badge variant="destructive">{isHi ? "अक्षम" : "Disabled"}</Badge>
                      ) : selectedTeacher.is_verified ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{isHi ? "स्वीकृत" : "Approved"}</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse">{isHi ? "लंबित" : "Pending"}</Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="p-4 sm:p-6 space-y-5">
                {/* Bio */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isHi ? "परिचय" : "About"}</p>
                  <p className={`text-sm leading-relaxed bg-muted/30 rounded-xl p-3 ${selectedTeacher.bio ? "text-foreground" : "text-muted-foreground italic"}`}>
                    {selectedTeacher.bio || (isHi ? "कोई परिचय नहीं जोड़ा" : "No bio added")}
                  </p>
                </div>

                {/* Qualification & Experience */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isHi ? "शिक्षा और अनुभव" : "Education & Experience"}</p>
                  <div className="grid grid-cols-1 gap-2">
                    <DetailRow icon={Award} label={isHi ? "योग्यता" : "Qualification"} value={selectedTeacher.qualification} />
                    <DetailRow icon={Clock} label={isHi ? "अनुभव" : "Experience"} value={selectedTeacher.experience_years ? `${selectedTeacher.experience_years} ${isHi ? "वर्ष" : "years"}` : null} />
                    <DetailRow icon={BookOpen} label={isHi ? "विषय" : "Subjects Taught"} value={selectedTeacher.subjects_taught} />
                  </div>
                </div>

                <Separator />

                {/* Contact Info */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isHi ? "संपर्क और स्थान" : "Contact & Location"}</p>
                  <div className="grid grid-cols-1 gap-2">
                    <DetailRow icon={Phone} label={isHi ? "फ़ोन नंबर" : "Phone Number"} value={selectedTeacher.phone} />
                    <DetailRow icon={School} label={isHi ? "स्कूल/संस्थान" : "School/Institution"} value={selectedTeacher.school} />
                    <DetailRow icon={MapPin} label={isHi ? "जिला" : "District"} value={selectedTeacher.district} />
                    <DetailRow icon={MapPin} label={isHi ? "राज्य" : "State"} value={selectedTeacher.state} />
                    <DetailRow icon={Calendar} label={isHi ? "शामिल हुए" : "Joined"} value={selectedTeacher.created_at ? new Date(selectedTeacher.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : null} />
                  </div>
                </div>

                <Separator />

                {/* Activity Stats */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{isHi ? "गतिविधि सारांश" : "Activity Summary"}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: selectedTeacher.courseCount, label: isHi ? "कोर्स बनाए" : "Courses Created", icon: BookOpen, color: "text-primary" },
                      { val: selectedTeacher.studentCount, label: isHi ? "कुल छात्र" : "Total Students", icon: Users, color: "text-emerald-500" },
                      { val: selectedTeacher.liveClassCount, label: isHi ? "लाइव क्लासेज" : "Live Classes", icon: Clock, color: "text-amber-500" },
                      { val: selectedTeacher.testCount, label: isHi ? "टेस्ट बनाए" : "Tests Created", icon: Award, color: "text-primary" },
                    ].map((s) => (
                      <div key={s.label} className="text-center p-2.5 bg-muted/40 rounded-xl">
                        <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                        <p className="text-lg font-bold text-foreground">{s.val}</p>
                        <p className="text-[9px] text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isHi ? "कार्रवाई" : "Actions"}</p>

                  {!selectedTeacher.is_disabled && (
                    <div className="flex gap-2">
                      {!selectedTeacher.is_verified ? (
                        <Button onClick={() => handleVerify(selectedTeacher.user_id, true)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">
                          <CheckCircle className="w-4 h-4 mr-1.5" /> {isHi ? "स्वीकृत करें" : "Approve Teacher"}
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => handleVerify(selectedTeacher.user_id, false)} className="flex-1 text-amber-600 border-amber-500/30 hover:bg-amber-500/10">
                          <XCircle className="w-4 h-4 mr-1.5" /> {isHi ? "स्वीकृति हटाएँ" : "Revoke Approval"}
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!selectedTeacher.is_disabled ? (
                      <Button variant="outline" onClick={() => handleDisable(selectedTeacher.user_id, true)} className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                        <Ban className="w-4 h-4 mr-1.5" /> {isHi ? "खाता अक्षम करें" : "Disable Account"}
                      </Button>
                    ) : (
                      <Button onClick={() => handleDisable(selectedTeacher.user_id, false)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">
                        <CheckCircle className="w-4 h-4 mr-1.5" /> {isHi ? "खाता सक्रिय करें" : "Enable Account"}
                      </Button>
                    )}
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10">
                        <UserX className="w-4 h-4 mr-1.5" /> {isHi ? "शिक्षक भूमिका हटाएँ (छात्र बनाएँ)" : "Remove Teacher Role (Make Student)"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{isHi ? "क्या आप सुनिश्चित हैं?" : "Are you sure?"}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {isHi
                            ? `${selectedTeacher.full_name} की शिक्षक भूमिका हटाकर छात्र बना दिया जाएगा।`
                            : `${selectedTeacher.full_name} will be changed from Teacher to Student.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{isHi ? "रद्द करें" : "Cancel"}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemoveRole(selectedTeacher.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {isHi ? "हाँ, हटाएँ" : "Yes, Remove"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4 mr-1.5" /> {isHi ? "खाता हटाएँ (डिलीट)" : "Delete Account"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{isHi ? "क्या आप सुनिश्चित हैं?" : "Are you sure?"}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {isHi
                            ? `${selectedTeacher.full_name} का खाता स्थायी रूप से हटा दिया जाएगा। यह वापस नहीं किया जा सकता।`
                            : `${selectedTeacher.full_name}'s account will be permanently deleted. This cannot be undone.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{isHi ? "रद्द करें" : "Cancel"}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(selectedTeacher.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {isHi ? "हाँ, हटाएँ" : "Yes, Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default AdminTeachers;
