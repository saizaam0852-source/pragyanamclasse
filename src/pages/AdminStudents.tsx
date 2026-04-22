import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Search, CheckCircle, XCircle, Users, Phone, MapPin, School, Eye, Calendar, BookOpen, Ban, Shield, Award, GraduationCap, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] } }),
  exit: { opacity: 0, y: -10, scale: 0.97, transition: { duration: 0.2 } },
};

const statVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({ opacity: 1, scale: 1, transition: { delay: i * 0.08, type: "spring" as const, stiffness: 200 } }),
};

type FilterType = "all" | "free" | "paid" | "pending" | "approved" | "disabled";

const AdminStudents = () => {
  const { language } = useLanguage();
  const isHi = language === "hi";
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);

  const fetchStudents = async () => {
    const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "student");
    const studentIds = (studentRoles || []).map((r: any) => r.user_id);
    if (studentIds.length === 0) { setStudents([]); setLoading(false); return; }

    const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", studentIds);

    const { data: enrollments } = await supabase.from("enrollments").select("user_id").in("user_id", studentIds);
    const enrollCounts: Record<string, number> = {};
    (enrollments || []).forEach((e: any) => { enrollCounts[e.user_id] = (enrollCounts[e.user_id] || 0) + 1; });

    const { data: attempts } = await supabase.from("test_attempts").select("user_id, percentage").in("user_id", studentIds);
    const testCounts: Record<string, number> = {};
    const testScores: Record<string, number[]> = {};
    (attempts || []).forEach((a: any) => {
      testCounts[a.user_id] = (testCounts[a.user_id] || 0) + 1;
      if (a.percentage != null) {
        if (!testScores[a.user_id]) testScores[a.user_id] = [];
        testScores[a.user_id].push(Number(a.percentage));
      }
    });

    // Get doubt counts
    const { data: doubts } = await supabase.from("doubts").select("user_id").in("user_id", studentIds);
    const doubtCounts: Record<string, number> = {};
    (doubts || []).forEach((d: any) => { doubtCounts[d.user_id] = (doubtCounts[d.user_id] || 0) + 1; });

    const enriched = (profiles || []).map((p: any) => ({
      ...p,
      enrollCount: enrollCounts[p.user_id] || 0,
      testCount: testCounts[p.user_id] || 0,
      doubtCount: doubtCounts[p.user_id] || 0,
      avgScore: testScores[p.user_id] ? Math.round(testScores[p.user_id].reduce((a: number, b: number) => a + b, 0) / testScores[p.user_id].length) : null,
    }));
    setStudents(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleVerify = async (userId: string, verified: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_verified: verified }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success(verified ? (isHi ? "छात्र स्वीकृत!" : "Student approved!") : (isHi ? "स्वीकृति हटाई" : "Approval revoked"));
    fetchStudents();
    if (selectedStudent?.user_id === userId) {
      setSelectedStudent((prev: any) => prev ? { ...prev, is_verified: verified } : null);
    }
  };

  const handleDisable = async (userId: string, disable: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_disabled: disable }).eq("user_id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success(disable ? (isHi ? "खाता अक्षम किया!" : "Account disabled!") : (isHi ? "खाता सक्रिय किया!" : "Account enabled!"));
    fetchStudents();
    if (selectedStudent?.user_id === userId) {
      setSelectedStudent((prev: any) => prev ? { ...prev, is_disabled: disable } : null);
    }
  };

  const handleMakeTeacher = async (userId: string) => {
    const { error: deleteErr } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "student");
    if (deleteErr) { toast.error(deleteErr.message); return; }
    const { error: insertErr } = await supabase.from("user_roles").insert({ user_id: userId, role: "teacher" });
    if (insertErr) { toast.error(insertErr.message); return; }
    toast.success(isHi ? "भूमिका बदली: अब शिक्षक है" : "Role changed: now a teacher");
    setSelectedStudent(null);
    fetchStudents();
  };

  const handleDelete = async (userId: string) => {
    const { error: roleErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (roleErr) { toast.error(roleErr.message); return; }
    const { error: profErr } = await supabase.from("profiles").delete().eq("user_id", userId);
    if (profErr) { toast.error(profErr.message); return; }
    toast.success(isHi ? "उपयोगकर्ता हटाया गया" : "User deleted");
    setSelectedStudent(null);
    fetchStudents();
  };

  let filtered = students.filter(
    (p) => p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search) || p.school?.toLowerCase().includes(search.toLowerCase())
  );
  if (filter === "free") filtered = filtered.filter((p) => p.is_free_student);
  if (filter === "paid") filtered = filtered.filter((p) => !p.is_free_student);
  if (filter === "pending") filtered = filtered.filter((p) => !p.is_verified && !p.is_disabled);
  if (filter === "approved") filtered = filtered.filter((p) => p.is_verified && !p.is_disabled);
  if (filter === "disabled") filtered = filtered.filter((p) => p.is_disabled);

  const freeCount = students.filter((p) => p.is_free_student).length;
  const paidCount = students.filter((p) => !p.is_free_student).length;
  const pendingCount = students.filter((p) => !p.is_verified && !p.is_disabled).length;
  const approvedCount = students.filter((p) => p.is_verified && !p.is_disabled).length;
  const disabledCount = students.filter((p) => p.is_disabled).length;

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
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              {isHi ? "छात्र प्रबंधन" : "Student Management"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{isHi ? "सभी छात्रों को मैनेज करें" : "Manage all platform students"}</p>
          </div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={isHi ? "नाम, फ़ोन, स्कूल..." : "Name, phone, school..."} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </motion.div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {[
            { key: "all" as FilterType, count: students.length, label: isHi ? "कुल" : "Total", color: "text-foreground", bg: "bg-primary/5" },
            { key: "approved" as FilterType, count: approvedCount, label: isHi ? "स्वीकृत" : "Approved", color: "text-emerald-500", bg: "bg-emerald-500/5" },
            { key: "pending" as FilterType, count: pendingCount, label: isHi ? "लंबित" : "Pending", color: "text-amber-500", bg: "bg-amber-500/5" },
            { key: "paid" as FilterType, count: paidCount, label: isHi ? "पेड" : "Paid", color: "text-primary", bg: "bg-primary/5" },
            { key: "free" as FilterType, count: freeCount, label: isHi ? "मुफ़्त" : "Free", color: "text-amber-500", bg: "bg-amber-500/5" },
            { key: "disabled" as FilterType, count: disabledCount, label: isHi ? "अक्षम" : "Disabled", color: "text-destructive", bg: "bg-destructive/5" },
          ].map((s, i) => (
            <motion.div key={s.key} custom={i} variants={statVariants} initial="hidden" animate="visible"
              className={`${s.bg} rounded-xl p-2.5 sm:p-3 border border-border text-center cursor-pointer hover:scale-105 transition-transform`}
              onClick={() => setFilter(s.key)}>
              <p className={`text-lg sm:text-xl font-extrabold ${s.color}`}>{s.count}</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter tabs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="flex gap-1 bg-muted rounded-lg p-1 w-fit overflow-x-auto">
          {([
            { key: "all" as FilterType, label: isHi ? "सभी" : "All" },
            { key: "approved" as FilterType, label: isHi ? "स्वीकृत" : "Approved" },
            { key: "pending" as FilterType, label: `${isHi ? "लंबित" : "Pending"}${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
            { key: "paid" as FilterType, label: isHi ? "पेड" : "Paid" },
            { key: "free" as FilterType, label: isHi ? "मुफ़्त" : "Free" },
            { key: "disabled" as FilterType, label: isHi ? "अक्षम" : "Disabled" },
          ]).map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap ${filter === f.key ? "bg-card text-foreground shadow-sm scale-105" : "text-muted-foreground hover:text-foreground"}`}>
              {f.label}
            </button>
          ))}
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-card rounded-xl border border-border">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-semibold text-foreground">{isHi ? "कोई छात्र नहीं मिला" : "No students found"}</p>
            <p className="text-xs text-muted-foreground mt-1">{isHi ? "खोज बदलें या फ़िल्टर हटाएँ" : "Try changing search or filters"}</p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((student, i) => (
                <motion.div key={student.id} custom={i} variants={cardVariants} initial="hidden" animate="visible" exit="exit" layout
                  className={`bg-card rounded-xl border p-4 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 ${student.is_disabled ? "border-destructive/30 opacity-60" : "border-border hover:border-primary/20"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary shrink-0 ring-2 ring-primary/10">
                      {student.avatar_url ? (
                        <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${student.avatar_url}`} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        student.full_name?.charAt(0)?.toUpperCase() || "S"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">{student.full_name || "—"}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {student.class_level && <Badge variant="outline" className="text-[9px] h-4 px-1.5">{isHi ? "कक्षा" : "Class"} {student.class_level}</Badge>}
                        {student.board && <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-primary border-primary/30">{student.board}</Badge>}
                        {student.is_disabled ? (
                          <Badge variant="destructive" className="text-[9px] h-4 px-1.5">{isHi ? "अक्षम" : "Disabled"}</Badge>
                        ) : student.is_verified ? (
                          <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">✓</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20">⏳</Badge>
                        )}
                        {student.is_free_student && <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-600">{isHi ? "मुफ़्त" : "Free"}</Badge>}
                      </div>
                    </div>
                  </div>

                  {/* Quick info */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-muted-foreground mb-3">
                    {student.school && <div className="flex items-center gap-1 bg-muted/40 rounded-lg px-2 py-1"><School className="w-3 h-3 text-primary/60" /><span className="truncate">{student.school}</span></div>}
                    {student.phone && <div className="flex items-center gap-1 bg-muted/40 rounded-lg px-2 py-1"><Phone className="w-3 h-3 text-primary/60" />{student.phone}</div>}
                    {student.created_at && (
                      <div className="flex items-center gap-1 bg-muted/40 rounded-lg px-2 py-1 col-span-2">
                        <Calendar className="w-3 h-3 text-primary/60" />
                        {isHi ? "शामिल हुए" : "Joined"}: {new Date(student.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    )}
                  </div>

                  {/* Mini stats */}
                  <div className="flex gap-2 mb-3">
                    {[
                      { val: student.enrollCount, label: isHi ? "कोर्स" : "Courses", emoji: "📚" },
                      { val: student.testCount, label: isHi ? "टेस्ट" : "Tests", emoji: "📝" },
                      { val: student.avgScore != null ? `${student.avgScore}%` : "—", label: isHi ? "औसत" : "Avg", emoji: "📊" },
                    ].map((s) => (
                      <div key={s.label} className="flex-1 text-center p-1.5 bg-muted/30 rounded-lg">
                        <p className="text-xs font-bold text-foreground">{s.emoji} {s.val}</p>
                        <p className="text-[8px] text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setSelectedStudent(student)} className="h-8 text-xs hover:scale-105 transition-transform">
                      <Eye className="w-3.5 h-3.5 mr-1" /> {isHi ? "विवरण" : "Details"}
                    </Button>
                    {!student.is_disabled && student.is_free_student && !student.is_verified && (
                      <Button size="sm" onClick={() => handleVerify(student.user_id, true)} className="flex-1 h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-105 transition-transform">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> {isHi ? "स्वीकृत" : "Approve"}
                      </Button>
                    )}
                    {!student.is_disabled && student.is_free_student && student.is_verified && (
                      <Button size="sm" variant="outline" onClick={() => handleVerify(student.user_id, false)} className="flex-1 h-8 text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10 hover:scale-105 transition-transform">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> {isHi ? "रिवोक" : "Revoke"}
                      </Button>
                    )}
                    {!student.is_disabled && (
                      <Button size="sm" variant="outline" onClick={() => handleDisable(student.user_id, true)} className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:scale-105 transition-transform">
                        <Ban className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {student.is_disabled && (
                      <Button size="sm" onClick={() => handleDisable(student.user_id, false)} className="flex-1 h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-105 transition-transform">
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

      {/* Student Detail Sheet */}
      <Sheet open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
          {selectedStudent && (
            <div>
              {/* Header with gradient */}
              <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-8">
                <SheetHeader>
                  <SheetTitle className="text-sm text-muted-foreground">{isHi ? "छात्र विवरण" : "Student Details"}</SheetTitle>
                </SheetHeader>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 mt-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-2xl font-bold text-primary shrink-0 overflow-hidden ring-4 ring-background shadow-xl">
                    {selectedStudent.avatar_url ? (
                      <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${selectedStudent.avatar_url}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedStudent.full_name?.charAt(0)?.toUpperCase() || "S"
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{selectedStudent.full_name || "—"}</h3>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {selectedStudent.is_disabled ? (
                        <Badge variant="destructive">{isHi ? "अक्षम" : "Disabled"}</Badge>
                      ) : selectedStudent.is_verified ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{isHi ? "स्वीकृत" : "Approved"}</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse">{isHi ? "लंबित" : "Pending"}</Badge>
                      )}
                      {selectedStudent.is_free_student && <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">{isHi ? "मुफ़्त छात्र" : "Free Student"}</Badge>}
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="p-4 sm:p-6 space-y-5">
                {/* Subscription Info */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isHi ? "सदस्यता" : "Subscription"}</p>
                  <div className="grid grid-cols-1 gap-2">
                    <DetailRow icon={Award} label={isHi ? "प्लान" : "Plan"} value={selectedStudent.is_free_student ? (isHi ? "मुफ़्त" : "Free") : (isHi ? "पेड" : "Paid")} />
                    <DetailRow icon={Calendar} label={isHi ? "ट्रायल शुरू" : "Trial Start"} value={selectedStudent.trial_starts_at ? new Date(selectedStudent.trial_starts_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null} />
                    <DetailRow icon={Calendar} label={isHi ? "ट्रायल समाप्त" : "Trial End"} value={selectedStudent.trial_ends_at ? new Date(selectedStudent.trial_ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null} />
                  </div>
                </div>

                <Separator />

                {/* Academic Info */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isHi ? "शैक्षणिक जानकारी" : "Academic Info"}</p>
                  <div className="grid grid-cols-1 gap-2">
                    <DetailRow icon={GraduationCap} label={isHi ? "कक्षा" : "Class Level"} value={selectedStudent.class_level ? `${isHi ? "कक्षा" : "Class"} ${selectedStudent.class_level}` : null} />
                    <DetailRow icon={BookOpen} label={isHi ? "बोर्ड" : "Board"} value={selectedStudent.board} />
                    <DetailRow icon={Award} label={isHi ? "भाषा" : "Preferred Language"} value={selectedStudent.language === "hindi" ? "हिंदी" : "English"} />
                  </div>
                </div>

                <Separator />

                {/* Contact Info */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isHi ? "संपर्क जानकारी" : "Contact Info"}</p>
                  <div className="grid grid-cols-1 gap-2">
                    <DetailRow icon={Phone} label={isHi ? "फ़ोन नंबर" : "Phone Number"} value={selectedStudent.phone} />
                    <DetailRow icon={Phone} label={isHi ? "अभिभावक फ़ोन" : "Parent's Phone"} value={selectedStudent.parent_phone} />
                  </div>
                </div>

                <Separator />

                {/* School & Location */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{isHi ? "स्कूल और स्थान" : "School & Location"}</p>
                  <div className="grid grid-cols-1 gap-2">
                    <DetailRow icon={School} label={isHi ? "स्कूल का नाम" : "School Name"} value={selectedStudent.school} />
                    <DetailRow icon={MapPin} label={isHi ? "जिला" : "District"} value={selectedStudent.district} />
                    <DetailRow icon={MapPin} label={isHi ? "राज्य" : "State"} value={selectedStudent.state} />
                    <DetailRow icon={Calendar} label={isHi ? "शामिल हुए" : "Joined"} value={selectedStudent.created_at ? new Date(selectedStudent.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : null} />
                  </div>
                </div>

                <Separator />

                {/* Activity Stats */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{isHi ? "गतिविधि सारांश" : "Activity Summary"}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: selectedStudent.enrollCount, label: isHi ? "कोर्स एनरोल" : "Enrolled Courses", icon: BookOpen, color: "text-primary" },
                      { val: selectedStudent.testCount, label: isHi ? "टेस्ट दिए" : "Tests Taken", icon: Award, color: "text-amber-500" },
                      { val: selectedStudent.avgScore != null ? `${selectedStudent.avgScore}%` : "—", label: isHi ? "औसत स्कोर" : "Avg Score", icon: GraduationCap, color: "text-emerald-500" },
                      { val: selectedStudent.doubtCount, label: isHi ? "डाउट पूछे" : "Doubts Asked", icon: Users, color: "text-primary" },
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

                  {!selectedStudent.is_disabled && selectedStudent.is_free_student && (
                    <div className="flex gap-2">
                      {!selectedStudent.is_verified ? (
                        <Button onClick={() => handleVerify(selectedStudent.user_id, true)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white hover:scale-[1.02] transition-transform">
                          <CheckCircle className="w-4 h-4 mr-1.5" /> {isHi ? "स्वीकृत करें" : "Approve Free Student"}
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => handleVerify(selectedStudent.user_id, false)} className="flex-1 text-amber-600 border-amber-500/30 hover:bg-amber-500/10">
                          <XCircle className="w-4 h-4 mr-1.5" /> {isHi ? "स्वीकृति हटाएँ" : "Revoke Approval"}
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!selectedStudent.is_disabled ? (
                      <Button variant="outline" onClick={() => handleDisable(selectedStudent.user_id, true)} className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                        <Ban className="w-4 h-4 mr-1.5" /> {isHi ? "खाता अक्षम करें" : "Disable Account"}
                      </Button>
                    ) : (
                      <Button onClick={() => handleDisable(selectedStudent.user_id, false)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">
                        <CheckCircle className="w-4 h-4 mr-1.5" /> {isHi ? "खाता सक्रिय करें" : "Enable Account"}
                      </Button>
                    )}
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Shield className="w-4 h-4 mr-1.5" /> {isHi ? "शिक्षक बनाएँ (भूमिका बदलें)" : "Make Teacher (Change Role)"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{isHi ? "क्या आप सुनिश्चित हैं?" : "Are you sure?"}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {isHi
                            ? `${selectedStudent.full_name} को छात्र से शिक्षक बना दिया जाएगा।`
                            : `${selectedStudent.full_name} will be changed from Student to Teacher.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{isHi ? "रद्द करें" : "Cancel"}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleMakeTeacher(selectedStudent.user_id)}>
                          {isHi ? "हाँ, बदलें" : "Yes, Change Role"}
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
                            ? `${selectedStudent.full_name} का खाता स्थायी रूप से हटा दिया जाएगा। यह वापस नहीं किया जा सकता।`
                            : `${selectedStudent.full_name}'s account will be permanently deleted. This cannot be undone.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{isHi ? "रद्द करें" : "Cancel"}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(selectedStudent.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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

export default AdminStudents;
