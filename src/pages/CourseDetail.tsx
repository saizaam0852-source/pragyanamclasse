import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BookOpen, Play, Plus, Trash2, Video, FileText, Download,
  Upload, Clock, Calendar, ArrowLeft, Users, Loader2, CheckCircle,
  Award, ArrowRight, ChevronDown, ChevronRight, MessageCircle, Brain,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import VideoPlayer from "@/components/VideoPlayer";

interface SubjectData {
  id: string; title: string; title_hi: string; sort_order: number;
  chapters: ChapterData[];
}
interface ChapterData {
  id: string; title: string; title_hi: string; sort_order: number;
  lessons: LessonData[];
}
interface LessonData {
  id: string; title: string; title_hi: string; type: string;
  video_url: string | null; pdf_url: string | null; content: string | null;
  duration_minutes: number | null; sort_order: number; is_free_preview: boolean;
  chapter_id: string;
}

const CourseDetail = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, role } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isHi = language === "hi";

  const [course, setCourse] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [lessonProgress, setLessonProgress] = useState<Record<string, boolean>>({});
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<LessonData | null>(null);
  
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [courseTests, setCourseTests] = useState<any[]>([]);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [testPassed, setTestPassed] = useState(false);
  const [bestTestScore, setBestTestScore] = useState<number | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  // Lesson-specific doubts
  const [lessonDoubts, setLessonDoubts] = useState<any[]>([]);
  const [newDoubtText, setNewDoubtText] = useState("");
  const [postingDoubt, setPostingDoubt] = useState(false);

  const isTeacherOrAdmin = role === "teacher" || role === "admin";
  const isOwner = course?.created_by === user?.id;
  const canManage = isTeacherOrAdmin && isOwner;

  // Live class scheduling
  const [showLiveForm, setShowLiveForm] = useState(false);
  const [liveForm, setLiveForm] = useState({ title: "", title_hi: "", scheduled_at: "", duration_minutes: 60 });
  const [liveThumbnail, setLiveThumbnail] = useState<File | null>(null);
  const [schedulingLive, setSchedulingLive] = useState(false);

  const totalLessons = subjects.reduce((s, sub) => s + sub.chapters.reduce((c, ch) => c + ch.lessons.length, 0), 0);
  const completedCount = Object.values(lessonProgress).filter(Boolean).length;
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const fetchCourse = async () => {
    if (!courseId) return;
    const { data } = await supabase.from("courses").select("*").eq("id", courseId).single();
    if (data) {
      setCourse(data);
      if (data.created_by) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", data.created_by).single();
        setTeacher(prof);
      }
    }
  };

  const fetchHierarchy = async () => {
    if (!courseId) return;
    const { data: subs } = await supabase.from("subjects").select("*").eq("course_id", courseId).order("sort_order");
    if (!subs || subs.length === 0) { setSubjects([]); return; }

    const subIds = subs.map(s => s.id);
    const { data: chaps } = await supabase.from("chapters").select("*").in("subject_id", subIds).order("sort_order");
    const chapIds = (chaps || []).map(c => c.id);
    const { data: lsns } = chapIds.length > 0
      ? await supabase.from("lessons").select("*").in("chapter_id", chapIds).order("sort_order")
      : { data: [] };

    const hierarchy: SubjectData[] = subs.map(sub => ({
      ...sub,
      chapters: (chaps || []).filter(c => c.subject_id === sub.id).map(ch => ({
        ...ch,
        lessons: (lsns || []).filter(l => l.chapter_id === ch.id) as LessonData[],
      })),
    }));
    setSubjects(hierarchy);

    // Auto-expand first subject/chapter
    if (hierarchy.length > 0) {
      setExpandedSubjects(new Set([hierarchy[0].id]));
      if (hierarchy[0].chapters.length > 0) {
        setExpandedChapters(new Set([hierarchy[0].chapters[0].id]));
      }
    }
  };

  const fetchLessonProgress = async () => {
    if (!courseId || !user) return;
    const { data: subs } = await supabase.from("subjects").select("id").eq("course_id", courseId);
    if (!subs || subs.length === 0) return;
    const { data: chaps } = await supabase.from("chapters").select("id").in("subject_id", subs.map(s => s.id));
    if (!chaps || chaps.length === 0) return;
    const { data: lsns } = await supabase.from("lessons").select("id").in("chapter_id", chaps.map(c => c.id));
    if (!lsns || lsns.length === 0) return;
    const { data: prog } = await supabase
      .from("lesson_progress").select("lesson_id, is_completed")
      .eq("user_id", user.id).in("lesson_id", lsns.map(l => l.id));
    const map: Record<string, boolean> = {};
    (prog || []).forEach(p => { if (p.is_completed) map[p.lesson_id] = true; });
    setLessonProgress(map);
  };

  const fetchEnrollment = async () => {
    if (!courseId || !user) return;
    const { data } = await supabase.from("enrollments").select("id").eq("user_id", user.id).eq("course_id", courseId).limit(1);
    setIsEnrolled((data || []).length > 0);
  };

  const fetchCourseTests = async () => {
    if (!courseId) return;
    const { data } = await supabase.from("tests").select("*").eq("course_id", courseId).eq("is_published", true);
    setCourseTests(data || []);
    if (user && data && data.length > 0) {
      const testIds = data.map((t: any) => t.id);
      const { data: attempts } = await supabase
        .from("test_attempts").select("percentage, test_id")
        .eq("user_id", user.id).in("test_id", testIds);
      if (attempts && attempts.length > 0) {
        const best = Math.max(...attempts.map((a: any) => a.percentage || 0));
        setBestTestScore(best);
        setTestPassed(best >= 40);
      }
    }
  };

  const fetchCertificate = async () => {
    if (!courseId || !user) return;
    const { data } = await supabase.from("certificates").select("id").eq("user_id", user.id).eq("course_id", courseId).limit(1);
    setHasCertificate((data || []).length > 0);
  };

  const fetchLiveClasses = async () => {
    if (!courseId) return;
    const { data } = await supabase
      .from("live_classes").select("*").eq("course_id", courseId)
      .in("status", ["scheduled", "live"]).order("scheduled_at");
    setLiveClasses(data || []);
  };

  const fetchEnrolledStudents = async () => {
    if (!courseId) return;
    const { data: enrollments } = await supabase
      .from("enrollments").select("user_id, enrolled_at, progress").eq("course_id", courseId);
    if (!enrollments || enrollments.length === 0) { setEnrolledStudents([]); return; }
    const userIds = enrollments.map(e => e.user_id);
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds);
    const profileMap: Record<string, any> = {};
    (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
    setEnrolledStudents(enrollments.map(e => ({
      ...e,
      profile: profileMap[e.user_id] || { full_name: "Student", avatar_url: null },
    })));
  };

  const fetchLessonDoubts = async (lessonId: string) => {
    // Use chapter_id from the lesson to find relevant doubts
    const lesson = subjects.flatMap(s => s.chapters.flatMap(c => c.lessons)).find(l => l.id === lessonId);
    if (!lesson) return;
    const { data } = await supabase
      .from("doubts").select("*, doubt_replies(*)")
      .eq("chapter_id", lesson.chapter_id)
      .order("created_at", { ascending: false }).limit(10);
    setLessonDoubts(data || []);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([
        fetchCourse(), fetchHierarchy(), fetchLiveClasses(),
        fetchEnrolledStudents(), fetchLessonProgress(),
        fetchEnrollment(), fetchCourseTests(), fetchCertificate(),
      ]);
      setLoading(false);
    };
    load();
  }, [courseId, user]);

  useEffect(() => {
    if (activeLesson) fetchLessonDoubts(activeLesson.id);
  }, [activeLesson?.id]);

  const markLessonComplete = async (lessonId: string) => {
    if (!user) return;
    if (lessonProgress[lessonId]) return;
    const { error } = await supabase.from("lesson_progress").upsert(
      { user_id: user.id, lesson_id: lessonId, is_completed: true, completed_at: new Date().toISOString() },
      { onConflict: "user_id,lesson_id" }
    );
    if (error) {
      await supabase.from("lesson_progress").insert({
        user_id: user.id, lesson_id: lessonId, is_completed: true, completed_at: new Date().toISOString(),
      });
    }
    setLessonProgress(prev => ({ ...prev, [lessonId]: true }));
    toast.success(isHi ? "पाठ पूरा हुआ! ✓" : "Lesson completed! ✓");
    if (courseId) {
      const newCompleted = completedCount + 1;
      const pct = Math.round((newCompleted / totalLessons) * 100);
      await supabase.from("enrollments").update({ progress: pct }).eq("user_id", user.id).eq("course_id", courseId);
    }
  };

  const handleVideoProgress = async (lessonId: string, percent: number) => {
    if (!user) return;
    if (percent % 10 === 0 || percent >= 90) {
      await supabase.from("lesson_progress").upsert(
        { user_id: user.id, lesson_id: lessonId, last_position: percent, is_completed: percent >= 90, ...(percent >= 90 ? { completed_at: new Date().toISOString() } : {}) },
        { onConflict: "user_id,lesson_id" }
      );
    }
  };

  const postLessonDoubt = async () => {
    if (!user || !activeLesson || !newDoubtText.trim()) return;
    setPostingDoubt(true);
    const { error } = await supabase.from("doubts").insert({
      user_id: user.id,
      title: `Doubt: ${activeLesson.title}`,
      description: newDoubtText,
      chapter_id: activeLesson.chapter_id,
      course_id: courseId,
      status: "open",
    });
    if (error) toast.error("Failed to post doubt");
    else {
      toast.success(isHi ? "डाउट पोस्ट हुआ!" : "Doubt posted!");
      setNewDoubtText("");
      fetchLessonDoubts(activeLesson.id);
    }
    setPostingDoubt(false);
  };

  const getNextLesson = (): LessonData | null => {
    const allLessons = subjects.flatMap(s => s.chapters.flatMap(c => c.lessons));
    if (!activeLesson) return allLessons[0] || null;
    const idx = allLessons.findIndex(l => l.id === activeLesson.id);
    return idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null;
  };

  const checkAndIssueCertificate = async () => {
    if (!user || !courseId || hasCertificate) return;
    const allLessons = subjects.flatMap(s => s.chapters.flatMap(c => c.lessons));
    const allDone = allLessons.every(l => lessonProgress[l.id]);
    if (!allDone) { toast.error(isHi ? "पहले सभी पाठ पूरे करें!" : "Complete all lessons first!"); return; }
    if (courseTests.length > 0 && !testPassed) { toast.error(isHi ? "पहले कोर्स टेस्ट पास करें!" : "Pass the course test first!"); return; }
    const { error } = await supabase.from("certificates").insert({ user_id: user.id, course_id: courseId });
    if (!error) {
      setHasCertificate(true);
      toast.success(isHi ? "🎉 बधाई हो! प्रमाणपत्र प्राप्त हुआ!" : "🎉 Certificate earned!");
    }
  };

  const handleScheduleLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !user) return;
    setSchedulingLive(true);
    let thumbnailUrl: string | null = null;
    if (liveThumbnail) {
      const ext = liveThumbnail.name.split(".").pop();
      const path = `live-class-thumbnails/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("course-thumbnails").upload(path, liveThumbnail);
      if (!upErr) { const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(path); thumbnailUrl = data.publicUrl; }
    }
    const { error } = await supabase.from("live_classes").insert({
      title: liveForm.title, title_hi: liveForm.title_hi || "", course_id: courseId,
      teacher_id: user.id, scheduled_at: new Date(liveForm.scheduled_at).toISOString(),
      duration_minutes: liveForm.duration_minutes, status: "scheduled", thumbnail_url: thumbnailUrl,
    } as any);
    if (error) toast.error("Failed: " + error.message);
    else {
      toast.success(isHi ? "लाइव क्लास शेड्यूल हुई!" : "Live class scheduled!");
      setLiveForm({ title: "", title_hi: "", scheduled_at: "", duration_minutes: 60 });
      setLiveThumbnail(null); setShowLiveForm(false); await fetchLiveClasses();
    }
    setSchedulingLive(false);
  };

  const handleDeleteLiveClass = async (classId: string) => {
    const { error } = await supabase.from("live_classes").delete().eq("id", classId);
    if (error) toast.error("Failed: " + error.message);
    else { toast.success("Class removed"); await fetchLiveClasses(); }
  };

  const toggleSubject = (id: string) => {
    setExpandedSubjects(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleChapter = (id: string) => {
    setExpandedChapters(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!course) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Course not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // =========== LESSON DETAIL VIEW ===========
  if (activeLesson) {
    const nextLesson = getNextLesson();
    return (
      <DashboardLayout>
        <div className="space-y-5 max-w-5xl pb-20 lg:pb-0">
          <Button variant="ghost" size="sm" onClick={() => setActiveLesson(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> {isHi ? "कोर्स पर वापस" : "Back to Course"}
          </Button>

          {/* Lesson Title */}
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-foreground">{activeLesson.title}</h1>
            {activeLesson.title_hi && <p className="text-primary font-medium text-sm">{activeLesson.title_hi}</p>}
          </div>

          {/* Video Lecture */}
          {activeLesson.video_url && (
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <VideoPlayer
                url={activeLesson.video_url}
                lessonId={activeLesson.id}
                durationMinutes={activeLesson.duration_minutes || undefined}
                onProgress={handleVideoProgress}
                onComplete={markLessonComplete}
              />
            </div>
          )}

          {/* Video Download */}
          {activeLesson.video_url && !activeLesson.video_url.includes("youtube") && !activeLesson.video_url.includes("youtu.be") && (
            <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-3">
                <Download className="w-4 h-4 text-primary" /> {isHi ? "वीडियो डाउनलोड करें" : "Download Video"}
              </h3>
              <a href={activeLesson.video_url} download target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors">
                <Download className="w-4 h-4" /> {isHi ? "वीडियो डाउनलोड" : "Download Video"}
              </a>
            </div>
          )}

          {/* Downloadable Notes */}
          {activeLesson.pdf_url && (
            <div className="bg-card rounded-2xl p-4 sm:p-5 border border-border">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-primary" /> {isHi ? "डाउनलोड करें नोट्स" : "Downloadable Notes"}
              </h3>
              <a href={activeLesson.pdf_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors">
                <Download className="w-4 h-4" /> {isHi ? "PDF डाउनलोड करें" : "Download PDF"}
              </a>
            </div>
          )}

          {/* Text Content */}
          {activeLesson.content && (
            <div className="bg-card rounded-2xl p-5 border border-border">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-primary" /> {isHi ? "पाठ सामग्री" : "Lesson Notes"}
              </h3>
              <div className="prose prose-sm max-w-none text-foreground">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{activeLesson.content}</p>
              </div>
            </div>
          )}

          {/* Course Tests for this chapter */}
          {courseTests.length > 0 && (
            <div className="bg-card rounded-2xl p-5 border border-border">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-primary" /> {isHi ? "प्रैक्टिस क्विज़" : "Practice Quiz / MCQs"}
              </h3>
              <div className="space-y-2">
                {courseTests.map(test => (
                  <div key={test.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{test.title}</p>
                      <p className="text-xs text-muted-foreground">{test.duration_minutes} min · {test.total_marks} marks</p>
                    </div>
                    <Button size="sm" onClick={() => navigate("/dashboard/tests")} className="bg-primary text-primary-foreground text-xs">
                      {isHi ? "टेस्ट दें" : "Take Test"} <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lesson-Specific Doubt Forum */}
          <div className="bg-card rounded-2xl p-5 border border-border">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-primary" /> {isHi ? "इस पाठ पर डाउट पूछें" : "Lesson Doubt Forum"}
            </h3>
            {role === "student" && (
              <div className="flex gap-2 mb-4">
                <Textarea
                  value={newDoubtText}
                  onChange={(e) => setNewDoubtText(e.target.value)}
                  placeholder={isHi ? "अपना सवाल यहाँ लिखें..." : "Write your question here..."}
                  className="flex-1 min-h-[60px]"
                />
                <Button size="sm" onClick={postLessonDoubt} disabled={postingDoubt || !newDoubtText.trim()} className="self-end bg-primary text-primary-foreground">
                  {postingDoubt ? <Loader2 className="w-4 h-4 animate-spin" /> : isHi ? "पूछें" : "Ask"}
                </Button>
              </div>
            )}
            {lessonDoubts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{isHi ? "कोई डाउट नहीं" : "No doubts yet"}</p>
            ) : (
              <div className="space-y-3">
                {lessonDoubts.map(d => (
                  <div key={d.id} className="p-3 rounded-xl border border-border">
                    <p className="text-sm font-semibold text-foreground">{d.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{d.description}</p>
                    {d.doubt_replies && d.doubt_replies.length > 0 && (
                      <div className="mt-2 pl-3 border-l-2 border-primary/20 space-y-1">
                        {d.doubt_replies.map((r: any) => (
                          <p key={r.id} className="text-xs text-foreground">{r.content}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next Lesson / Mark Complete */}
          <div className="flex items-center gap-3">
            {!lessonProgress[activeLesson.id] && (
              <Button onClick={() => markLessonComplete(activeLesson.id)} className="bg-primary text-primary-foreground">
                <CheckCircle className="w-4 h-4 mr-1" /> {isHi ? "पूरा करें" : "Mark as Complete"}
              </Button>
            )}
            {lessonProgress[activeLesson.id] && (
              <span className="text-sm text-primary font-semibold flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> {isHi ? "पूरा हुआ" : "Completed"}
              </span>
            )}
            {nextLesson && (
              <Button variant="outline" onClick={() => setActiveLesson(nextLesson)}>
                {isHi ? "अगला पाठ" : "Next Lesson"} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // =========== COURSE OVERVIEW ===========
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl pb-20 lg:pb-0">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> {isHi ? "वापस" : "Back"}
        </Button>

        {/* Course Header */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="relative h-36 sm:h-56">
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full gradient-hero flex items-center justify-center">
                <BookOpen className="w-16 h-16 text-primary-foreground/30" />
              </div>
            )}
          </div>
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{course.category}</span>
              {course.class_level && <span className="text-xs text-muted-foreground">Class {course.class_level}</span>}
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold font-heading text-foreground">{course.title}</h1>
            {course.title_hi && <p className="text-primary font-medium">{course.title_hi}</p>}
            {course.description && <p className="text-sm text-muted-foreground mt-2">{course.description}</p>}
            {teacher && (
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {teacher.full_name?.charAt(0)?.toUpperCase() || "T"}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{teacher.full_name || "Teacher"}</p>
                  <p className="text-xs text-muted-foreground">{isHi ? "शिक्षक" : "Instructor"}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        {isEnrolled && role === "student" && totalLessons > 0 && (
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-foreground text-sm">{isHi ? "कोर्स प्रगति" : "Course Progress"}</h3>
              <span className="text-sm font-bold text-primary">{progressPct}%</span>
            </div>
            <Progress value={progressPct} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {completedCount}/{totalLessons} {isHi ? "पाठ पूरे" : "lessons completed"}
              {courseTests.length > 0 && (
                <span className={`ml-2 ${testPassed ? "text-primary" : "text-destructive"}`}>
                  · Test: {testPassed ? `Passed (${bestTestScore?.toFixed(0)}%)` : bestTestScore !== null ? `Failed (${bestTestScore?.toFixed(0)}%)` : isHi ? "प्रयास नहीं" : "Not attempted"}
                </span>
              )}
            </p>
            {hasCertificate && (
              <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <Award className="w-5 h-5 text-primary" />
                <span className="text-sm font-semibold text-primary">{isHi ? "प्रमाणपत्र प्राप्त!" : "Certificate Earned!"}</span>
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => navigate("/dashboard/certificates")}>
                  View <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            )}
            {progressPct === 100 && (courseTests.length === 0 || testPassed) && !hasCertificate && (
              <Button size="sm" className="mt-3 bg-primary text-primary-foreground" onClick={checkAndIssueCertificate}>
                <Award className="w-4 h-4 mr-1" /> {isHi ? "प्रमाणपत्र लें" : "Claim Certificate"}
              </Button>
            )}
          </div>
        )}

        {/* Live Classes */}
        <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold font-heading text-foreground flex items-center gap-2">
              <Video className="w-5 h-5 text-destructive" /> {isHi ? "लाइव क्लास" : "Live Classes"}
            </h2>
            {canManage && (
              <Button size="sm" onClick={() => setShowLiveForm(!showLiveForm)} className="gradient-saffron border-0 text-primary-foreground">
                <Plus className="w-4 h-4 mr-1" /> Schedule
              </Button>
            )}
          </div>
          {showLiveForm && canManage && (
            <form onSubmit={handleScheduleLive} className="border border-border rounded-xl p-4 mb-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Title</Label><Input required value={liveForm.title} onChange={(e) => setLiveForm({ ...liveForm, title: e.target.value })} className="mt-1" /></div>
                <div><Label className="text-xs">{isHi ? "हिंदी शीर्षक" : "Hindi Title"}</Label><Input value={liveForm.title_hi} onChange={(e) => setLiveForm({ ...liveForm, title_hi: e.target.value })} className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Date & Time</Label><Input type="datetime-local" required value={liveForm.scheduled_at} onChange={(e) => setLiveForm({ ...liveForm, scheduled_at: e.target.value })} className="mt-1" /></div>
                <div><Label className="text-xs">Duration (min)</Label><Input type="number" min={15} max={180} value={liveForm.duration_minutes} onChange={(e) => setLiveForm({ ...liveForm, duration_minutes: Number(e.target.value) })} className="mt-1 w-32" /></div>
              </div>
              <div><Label className="text-xs">Thumbnail</Label><Input type="file" accept="image/*" onChange={(e) => setLiveThumbnail(e.target.files?.[0] || null)} className="mt-1" /></div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={schedulingLive} className="gradient-saffron border-0 text-primary-foreground">
                  {schedulingLive ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3 mr-1" />} Schedule
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowLiveForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
          {liveClasses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{isHi ? "कोई लाइव क्लास नहीं" : "No live classes"}</p>
          ) : (
            <div className="space-y-2">
              {liveClasses.map((lc) => (
                <div key={lc.id} className="flex items-center justify-between border border-border rounded-xl p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {lc.status === "live" && <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
                      <p className="font-semibold text-foreground text-sm">{lc.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(lc.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {new Date(lc.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {lc.status === "live" ? (
                      <Button
                        size="sm"
                        className="gradient-saffron border-0 text-primary-foreground"
                        onClick={() => navigate(`/dashboard/live-classes?classId=${lc.id}`)}
                      >
                        <Play className="w-3 h-3 mr-1" /> Join
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">Upcoming</span>}
                    {canManage && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDeleteLiveClass(lc.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* =========== SUBJECT → CHAPTER → LESSON HIERARCHY =========== */}
        <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border">
          <h2 className="text-lg font-bold font-heading text-foreground flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-primary" /> {isHi ? "पाठ्यक्रम" : "Syllabus"} ({totalLessons} {isHi ? "पाठ" : "lessons"})
          </h2>

          {subjects.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">{isHi ? "अभी कोई content नहीं" : "No content yet"}</p>
              {canManage && (
                <Button size="sm" className="mt-3" onClick={() => navigate("/dashboard/upload")}>
                  <Plus className="w-4 h-4 mr-1" /> {isHi ? "कंटेंट जोड़ें" : "Add Content"}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {subjects.map((sub) => (
                <div key={sub.id} className="border border-border rounded-xl overflow-hidden">
                  {/* Subject Header */}
                  <button
                    onClick={() => toggleSubject(sub.id)}
                    className="w-full flex items-center justify-between p-3 sm:p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <p className="font-bold text-foreground text-sm">{sub.title}</p>
                        {sub.title_hi && <p className="text-xs text-primary">{sub.title_hi}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{sub.chapters.reduce((s, c) => s + c.lessons.length, 0)} {isHi ? "पाठ" : "lessons"}</span>
                      {expandedSubjects.has(sub.id) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {/* Chapters */}
                  {expandedSubjects.has(sub.id) && (
                    <div className="border-t border-border">
                      {sub.chapters.map((ch) => (
                        <div key={ch.id}>
                          <button
                            onClick={() => toggleChapter(ch.id)}
                            className="w-full flex items-center justify-between p-3 pl-6 sm:pl-8 hover:bg-muted/30 transition-colors text-left border-b border-border/50"
                          >
                            <div>
                              <p className="font-semibold text-foreground text-sm">{ch.title}</p>
                              {ch.title_hi && <p className="text-xs text-muted-foreground">{ch.title_hi}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{ch.lessons.length} {isHi ? "पाठ" : "lessons"}</span>
                              {expandedChapters.has(ch.id) ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                            </div>
                          </button>

                          {/* Lessons */}
                          {expandedChapters.has(ch.id) && (
                            <div className="bg-background">
                              {ch.lessons.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-3 pl-10">{isHi ? "कोई पाठ नहीं" : "No lessons"}</p>
                              ) : (
                                ch.lessons.map((lesson, idx) => {
                                  const isCompleted = lessonProgress[lesson.id];
                                  return (
                                    <button
                                      key={lesson.id}
                                      onClick={() => setActiveLesson(lesson)}
                                      className="w-full flex items-center gap-3 p-3 pl-10 sm:pl-12 hover:bg-muted/40 transition-colors text-left border-b border-border/30 last:border-b-0"
                                    >
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                        isCompleted ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                                      }`}>
                                        {isCompleted ? <CheckCircle className="w-3.5 h-3.5" /> : idx + 1}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className={`font-medium text-sm truncate ${isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}>
                                          {lesson.title}
                                        </p>
                                        {lesson.title_hi && <p className="text-xs text-primary/70 truncate">{lesson.title_hi}</p>}
                                      </div>
                                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                        {lesson.duration_minutes && <span className="text-[10px] text-muted-foreground">{lesson.duration_minutes}m</span>}
                                        {lesson.video_url && <Video className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />}
                                        {lesson.pdf_url && <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />}
                                        {(lesson.video_url || lesson.pdf_url) && <Download className="w-3 h-3 text-muted-foreground" />}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Course Tests */}
        {courseTests.length > 0 && (
          <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border">
            <h2 className="text-lg font-bold font-heading text-foreground mb-4 flex items-center gap-2">
              📝 {isHi ? "कोर्स टेस्ट" : "Course Tests"}
            </h2>
            <div className="space-y-2">
              {courseTests.map(test => (
                <div key={test.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{test.title}</p>
                    <p className="text-xs text-muted-foreground">{test.duration_minutes} min · {test.total_marks} marks</p>
                  </div>
                  <Button size="sm" onClick={() => navigate("/dashboard/tests")} className="bg-primary text-primary-foreground text-xs">
                    {isHi ? "टेस्ट दें" : "Take Test"} <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Course-Level Doubt Forum */}
        <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border">
          <h2 className="text-lg font-bold font-heading text-foreground mb-3 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" /> {isHi ? "कोर्स डाउट फोरम" : "Course Doubt Forum"}
          </h2>
          <Button size="sm" variant="outline" onClick={() => navigate("/dashboard/doubts")}>
            {isHi ? "सभी डाउट देखें" : "View All Doubts"} <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {/* Enrolled Students - Teacher Only */}
        {canManage && (
          <div className="bg-card rounded-2xl p-4 sm:p-6 border border-border">
            <h2 className="text-lg font-bold font-heading text-foreground mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> {isHi ? "नामांकित छात्र" : "Enrolled Students"} ({enrolledStudents.length})
            </h2>
            {enrolledStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{isHi ? "कोई छात्र नामांकित नहीं" : "No students enrolled yet"}</p>
            ) : (
              <div className="space-y-2">
                {enrolledStudents.map((s) => (
                  <div key={s.user_id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {s.profile.full_name?.charAt(0)?.toUpperCase() || "S"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{s.profile.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.enrolled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CourseDetail;