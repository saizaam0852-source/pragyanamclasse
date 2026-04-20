import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { BookOpen, Brain, MessageCircle, Users, Award, Plus, ArrowRight, Calendar, Video, Eye, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = () => {
  const { user, role, profile } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ courses: 0, tests: 0, doubts: 0, students: 0, revenue: 0 });
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [scheduledTests, setScheduledTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isHi = language === "hi";

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      if (role === "teacher") {
        const [coursesRes, testsRes, doubtsRes, myCoursesRes, schedRes, enrollCountRes] = await Promise.all([
          supabase.from("courses").select("id", { count: "exact", head: true }).eq("created_by", user.id),
          supabase.from("tests").select("id", { count: "exact", head: true }).eq("created_by", user.id),
          supabase.from("doubts").select("id", { count: "exact", head: true }).eq("status", "open"),
          supabase.from("courses").select("id, title, title_hi, thumbnail_url, is_published, category").eq("created_by", user.id).order("created_at", { ascending: false }).limit(6),
          supabase.from("tests").select("id, title, scheduled_at, course_id, courses(title)").eq("created_by", user.id).not("scheduled_at", "is", null).eq("is_published", false).order("scheduled_at").limit(5),
          supabase.from("enrollments").select("id", { count: "exact", head: true }),
        ]);
        setStats({
          courses: coursesRes.count || 0,
          tests: testsRes.count || 0,
          doubts: doubtsRes.count || 0,
          students: enrollCountRes.count || 0,
        });
        setMyCourses(myCoursesRes.data || []);
        setScheduledTests(schedRes.data || []);
      } else if (role === "admin") {
        const [courses, tests, doubts, usersCount, payments] = await Promise.all([
          supabase.from("courses").select("id", { count: "exact", head: true }),
          supabase.from("tests").select("id", { count: "exact", head: true }),
          supabase.from("doubts").select("id", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("payments").select("amount").eq("status", "paid"),
        ]);
        setStats({
          courses: courses.count || 0,
          tests: tests.count || 0,
          doubts: doubts.count || 0,
          students: usersCount.count || 0,
          revenue: (payments.data || []).reduce((sum, payment: any) => sum + (payment.amount || 0), 0),
        });
      } else {
        const [courses, tests, doubts] = await Promise.all([
          supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("test_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("doubts").select("id", { count: "exact", head: true }),
        ]);
        setStats({ courses: courses.count || 0, tests: tests.count || 0, doubts: doubts.count || 0, students: 0 });
      }
      setLoading(false);
    };
    fetchStats();
  }, [user, role]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dash.goodMorning");
    if (hour < 17) return t("dash.goodAfternoon");
    return t("dash.goodEvening");
  };

  // Teacher Dashboard
  if (role === "teacher") {
    return (
      <DashboardLayout>
        <div className="space-y-5 animate-slide-up">
          {/* Greeting */}
          <div className="gradient-navy rounded-2xl p-5 text-white">
            <h1 className="text-xl font-extrabold font-heading">{greeting()} 👋</h1>
            <p className="text-white/60 text-sm mt-0.5">{profile?.full_name || "Teacher"}, {isHi ? "यहाँ आपका सारांश है" : "here's your overview"}</p>
          </div>

          {/* Stats */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={<BookOpen className="w-6 h-6 text-primary" />} value={stats.courses} label={isHi ? "मेरे कोर्सेज़" : "My Courses"} />
              <StatCard icon={<Brain className="w-6 h-6 text-primary" />} value={stats.tests} label={isHi ? "बनाए गए टेस्ट" : "Tests Created"} />
              <StatCard icon={<MessageCircle className="w-6 h-6 text-primary" />} value={stats.doubts} label={isHi ? "खुले डाउट" : "Open Doubts"} />
              <StatCard icon={<Users className="w-6 h-6 text-primary" />} value={stats.students} label={isHi ? "कुल एनरोलमेंट" : "Total Enrollments"} />
            </div>
          )}

          {/* My Courses */}
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold font-heading text-foreground">{isHi ? "मेरे कोर्स" : "My Courses"}</h2>
              <Button size="sm" onClick={() => navigate("/dashboard/upload")} className="bg-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-1" /> {isHi ? "नया कोर्स" : "New Course"}
              </Button>
            </div>
            {loading ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {[1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : myCourses.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <BookOpen className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">{isHi ? "अभी कोई कोर्स नहीं" : "No courses yet"}</p>
                <p className="text-xs text-muted-foreground mb-3">{isHi ? "अपना पहला कोर्स बनाएँ!" : "Create your first course!"}</p>
                <Button size="sm" onClick={() => navigate("/dashboard/upload")} className="bg-primary text-primary-foreground text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> {isHi ? "कोर्स बनाएँ" : "Create Course"}
                </Button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {myCourses.map((course) => (
                  <div
                    key={course.id}
                    onClick={() => navigate(`/dashboard/course/${course.id}`)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{course.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{course.category}</span>
                        <span className={`text-[10px] ${course.is_published ? "text-primary" : "text-muted-foreground"}`}>
                          {course.is_published ? (isHi ? "प्रकाशित" : "Published") : (isHi ? "ड्राफ्ट" : "Draft")}
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scheduled Tests */}
          {scheduledTests.length > 0 && (
            <div className="bg-card rounded-2xl p-5 border border-border">
              <h2 className="text-lg font-bold font-heading text-foreground mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" /> {isHi ? "शेड्यूल्ड टेस्ट" : "Scheduled Tests"}
              </h2>
              <div className="space-y-2">
                {scheduledTests.map((test: any) => (
                  <div key={test.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{test.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {(test as any).courses?.title && `${(test as any).courses.title} · `}
                        {new Date(test.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}
                        {new Date(test.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{isHi ? "आने वाला" : "Upcoming"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions — Enhanced */}
          <div>
            <h2 className="text-base font-bold font-heading text-foreground mb-3">{t("dash.quickActions")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <QuickAction icon="📝" label={isHi ? "टेस्ट बनाएँ" : "Create Test"} onClick={() => navigate("/dashboard/manual-test")} />
              <QuickAction icon="✨" label={isHi ? "AI टेस्ट" : "AI Test"} onClick={() => navigate("/dashboard/ai-test")} />
              <QuickAction icon="💬" label={isHi ? "डाउट का जवाब दें" : "Answer Doubts"} onClick={() => navigate("/dashboard/doubts")} />
              <QuickAction icon="📤" label={isHi ? "कंटेंट अपलोड" : "Upload Content"} onClick={() => navigate("/dashboard/upload")} />
              <QuickAction icon="👁️" label={isHi ? "रिस्पांस देखें" : "View Responses"} onClick={() => navigate("/dashboard/test-responses")} />
              <QuickAction icon="📹" label={isHi ? "लाइव क्लास शेड्यूल" : "Schedule Live Class"} onClick={() => navigate("/dashboard/live-classes")} />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Admin Dashboard
  const adminStatCards = [
    { icon: Users, label: t("dash.totalUsers"), value: loading ? "—" : stats.students, color: "bg-primary/10 text-primary" },
    { icon: BookOpen, label: t("dash.totalCourses"), value: loading ? "—" : stats.courses, color: "bg-primary/10 text-primary" },
    { icon: Brain, label: t("dash.totalTests"), value: loading ? "—" : stats.tests, color: "bg-primary/10 text-primary" },
    { icon: Award, label: t("dash.revenue"), value: `₹${Math.round(stats.revenue / 100).toLocaleString("en-IN")}`, color: "bg-primary/10 text-primary" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 animate-slide-up">
        <div className="gradient-navy rounded-xl sm:rounded-2xl p-4 sm:p-6 text-white">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold font-heading">{greeting()} 👋</h1>
          <p className="text-white/60 text-xs sm:text-sm mt-0.5">{profile?.full_name || t("common.user")}, {t("dash.overview")}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {loading ? (
            [1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            adminStatCards.map((stat) => (
              <div key={stat.label} className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-border">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${stat.color} flex items-center justify-center mb-2 sm:mb-3`}>
                  <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <p className="text-lg sm:text-2xl font-extrabold font-heading text-foreground">{stat.value}</p>
                <p className="text-[11px] sm:text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))
          )}
        </div>

        <div className="bg-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-border">
          <h2 className="text-sm sm:text-lg font-bold font-heading text-foreground mb-3 sm:mb-4">{t("dash.quickActions")}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <QuickAction icon="👥" label={t("dash.manageUsers")} onClick={() => navigate("/dashboard/users")} />
            <QuickAction icon="📚" label={t("dash.manageCourses")} onClick={() => navigate("/dashboard/all-courses")} />
            <QuickAction icon="📊" label={t("dash.viewAnalytics")} onClick={() => navigate("/dashboard/analytics")} />
            <QuickAction icon="⚙️" label={t("dash.settings")} onClick={() => navigate("/dashboard/settings")} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const StatCard = ({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) => (
  <div className="bg-card rounded-2xl p-4 border border-border text-center">
    <div className="mx-auto mb-1">{icon}</div>
    <p className="text-xl font-extrabold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

const QuickAction = ({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl border border-border hover:border-primary/40 transition-all text-center w-full active:scale-[0.97]">
    <span className="text-xl sm:text-2xl">{icon}</span>
    <span className="text-[11px] sm:text-sm font-medium text-foreground leading-tight">{label}</span>
  </button>
);

export default Dashboard;
