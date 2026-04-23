import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Brain, Users, Clock, CheckCircle, XCircle, ArrowLeft, Eye, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TestResponses = () => {
  const { user, role } = useAuth();
  const [tests, setTests] = useState<any[]>([]);
  const [selectedTest, setSelectedTest] = useState<any | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const isTeacherOrAdmin = role === "teacher" || role === "admin";

  useEffect(() => {
    if (!isTeacherOrAdmin) return;
    fetchTests();
  }, [user, role]);

  const fetchTests = async () => {
    setLoading(true);
    const { data } = await supabase.from("tests").select("*").order("created_at", { ascending: false });
    setTests(data || []);
    setLoading(false);
  };

  const fetchAttempts = async (test: any) => {
    setSelectedTest(test);
    setSelectedAttempt(null);
    setLoading(true);

    const [attRes, qRes] = await Promise.all([
      supabase.from("test_attempts").select("*").eq("test_id", test.id).order("submitted_at", { ascending: false }),
      supabase.from("test_questions").select("*").eq("test_id", test.id).order("sort_order", { ascending: true }),
    ]);

    const attData = attRes.data || [];
    setAttempts(attData);
    setQuestions(qRes.data || []);

    // Fetch profiles for all users
    const userIds = [...new Set(attData.map((a: any) => a.user_id))];
    if (userIds.length > 0) {
      const { data: profData } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const map: Record<string, any> = {};
      (profData || []).forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  const viewAttemptDetail = (attempt: any) => {
    setSelectedAttempt(attempt);
  };

  // ─── Attempt Detail View ───
  if (selectedAttempt && selectedTest) {
    const studentAnswers = (selectedAttempt.answers || {}) as Record<string, string>;
    const studentName = profiles[selectedAttempt.user_id]?.full_name || "Student";
    let correctCount = 0;
    let wrongCount = 0;

    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-3xl">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setSelectedAttempt(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div>
              <h1 className="text-xl font-extrabold font-heading text-foreground">{studentName}'s Response</h1>
              <p className="text-sm text-muted-foreground">{selectedTest.title} · Score: {selectedAttempt.percentage?.toFixed(0)}%</p>
            </div>
          </div>

          <div className="space-y-4">
            {questions.map((q, i) => {
              const selected = studentAnswers[q.id];
              const qType = q.question_type || "mcq";

              if (qType === "short" || qType === "long") {
                return (
                  <div key={q.id} className="bg-card rounded-2xl p-5 border border-border">
                    <div className="flex items-start justify-between mb-3">
                      <p className="font-bold text-foreground text-sm">Q{i + 1}. {q.question}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        qType === "short" ? "bg-emerald/10 text-emerald" : "bg-accent text-accent-foreground"
                      }`}>
                        {qType === "short" ? "Short" : "Long"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Student's Answer:</p>
                        <div className="bg-muted/50 rounded-xl p-3 text-sm text-foreground whitespace-pre-wrap">
                          {selected || <span className="italic text-muted-foreground">Not answered</span>}
                        </div>
                      </div>
                      {q.answer_text && (
                        <div>
                          <p className="text-xs font-medium text-emerald mb-1">Expected Answer:</p>
                          <div className="bg-emerald/5 border border-emerald/20 rounded-xl p-3 text-sm text-foreground whitespace-pre-wrap">
                            {q.answer_text}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // MCQ
              const isCorrect = selected === q.correct_option;
              const options = [
                { key: "A", value: q.option_a },
                { key: "B", value: q.option_b },
                { key: "C", value: q.option_c },
                { key: "D", value: q.option_d },
              ];

              return (
                <div key={q.id} className="bg-card rounded-2xl p-5 border border-border">
                  <div className="flex items-start justify-between mb-3">
                    <p className="font-bold text-foreground text-sm">Q{i + 1}. {q.question}</p>
                    {isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-emerald shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-destructive shrink-0" />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {options.map((opt) => {
                      const isSelected = selected === opt.key;
                      const isRight = q.correct_option === opt.key;
                      let style = "border-border text-muted-foreground";
                      if (isRight) style = "border-emerald bg-emerald/10 text-foreground font-medium";
                      else if (isSelected && !isRight) style = "border-destructive bg-destructive/10 text-foreground";

                      return (
                        <div key={opt.key} className={`text-xs px-3 py-2 rounded-lg border ${style}`}>
                          <span className="font-bold mr-1">{opt.key}.</span> {opt.value}
                        </div>
                      );
                    })}
                  </div>
                  {!selected && <p className="text-xs text-muted-foreground mt-2 italic">Not answered</p>}
                </div>
              );
            })}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Attempts List View ───
  if (selectedTest) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => { setSelectedTest(null); setAttempts([]); }}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div>
              <h1 className="text-xl font-extrabold font-heading text-foreground">{selectedTest.title}</h1>
              <p className="text-sm text-muted-foreground">{attempts.length} student response{attempts.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-gold border-t-transparent rounded-full" />
            </div>
          ) : attempts.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold text-foreground mb-1">No Responses Yet</h3>
              <p className="text-sm text-muted-foreground">No students have taken this test yet</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-card rounded-2xl p-4 border border-border text-center">
                  <p className="text-2xl font-extrabold text-navy dark:text-gold">{attempts.length}</p>
                  <p className="text-xs text-muted-foreground">Attempts</p>
                </div>
                <div className="bg-card rounded-2xl p-4 border border-border text-center">
                  <p className="text-2xl font-extrabold text-emerald">
                    {(attempts.reduce((s: number, a: any) => s + (a.percentage || 0), 0) / attempts.length).toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
                <div className="bg-card rounded-2xl p-4 border border-border text-center">
                  <p className="text-2xl font-extrabold text-foreground">
                    {Math.max(...attempts.map((a: any) => a.percentage || 0)).toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Highest</p>
                </div>
              </div>

              {/* Attempts Table - desktop */}
              <div className="hidden sm:block bg-card rounded-2xl border border-border overflow-hidden">
                <div className="grid grid-cols-5 gap-2 px-5 py-3 bg-muted/50 text-xs font-bold text-muted-foreground">
                  <span>Student</span>
                  <span>Score</span>
                  <span>Percentage</span>
                  <span>Time</span>
                  <span>Action</span>
                </div>
                {attempts.map((att: any) => (
                  <div key={att.id} className="grid grid-cols-5 gap-2 px-5 py-3 border-t border-border items-center text-sm">
                    <span className="font-medium text-foreground truncate">
                      {profiles[att.user_id]?.full_name || "Student"}
                    </span>
                    <span className="text-foreground">{att.score}/{att.total_marks}</span>
                    <span className={`font-bold ${(att.percentage || 0) >= 60 ? "text-emerald" : "text-destructive"}`}>
                      {att.percentage?.toFixed(0)}%
                    </span>
                    <span className="text-muted-foreground">
                      {att.time_taken_seconds ? `${Math.floor(att.time_taken_seconds / 60)}m ${att.time_taken_seconds % 60}s` : "—"}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => viewAttemptDetail(att)}>
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                  </div>
                ))}
              </div>

              {/* Attempts Cards - mobile */}
              <div className="sm:hidden space-y-2.5">
                {attempts.map((att: any) => (
                  <div key={att.id} className="bg-card rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-semibold text-sm text-foreground truncate flex-1 min-w-0">
                        {profiles[att.user_id]?.full_name || "Student"}
                      </span>
                      <span className={`font-bold text-sm shrink-0 ${(att.percentage || 0) >= 60 ? "text-emerald" : "text-destructive"}`}>
                        {att.percentage?.toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mb-2.5">
                      <span>Score: <span className="text-foreground font-medium">{att.score}/{att.total_marks}</span></span>
                      <span>{att.time_taken_seconds ? `${Math.floor(att.time_taken_seconds / 60)}m ${att.time_taken_seconds % 60}s` : "—"}</span>
                    </div>
                    <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => viewAttemptDetail(att)}>
                      <Eye className="w-3 h-3 mr-1" /> View Details
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ─── Tests List ───
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-heading text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-navy dark:text-gold" />
            Student Responses
          </h1>
          <p className="text-sm text-muted-foreground">View and review student test attempts</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-gold border-t-transparent rounded-full" />
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-1">No Tests</h3>
            <p className="text-sm text-muted-foreground">Create a test first to see student responses</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tests.map((test) => (
              <div key={test.id} className="bg-card rounded-2xl p-5 border border-border hover:shadow-card hover:border-gold/20 transition-all cursor-pointer" onClick={() => fetchAttempts(test)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-navy/10 dark:bg-gold/10 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-navy dark:text-gold" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    test.is_published ? "bg-emerald/10 text-emerald" : "bg-muted text-muted-foreground"
                  }`}>
                    {test.is_published ? "Published" : "Draft"}
                  </span>
                </div>
                <h3 className="font-bold text-foreground mb-1">{test.title}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span><Clock className="w-3 h-3 inline mr-1" />{test.duration_minutes} min</span>
                  <span>{test.total_marks} marks</span>
                </div>
                <p className="text-xs text-navy dark:text-gold font-medium mt-3">Click to view responses →</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TestResponses;
