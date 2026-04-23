import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  GraduationCap, LayoutDashboard, BookOpen, Brain,
  MessageCircle, BarChart3, Users, Settings, LogOut, Menu, X,
  Upload, Video, Sparkles, UserCircle, PenTool, Eye, Bell, CreditCard
} from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import NotificationPanel from "@/components/NotificationPanel";
import SearchBar from "@/components/SearchBar";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { role, profile, signOut } = useAuth();
  const { t, language } = useLanguage();
  const isHi = language === "hi";
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const studentLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("sidebar.dashboard") },
    { to: "/dashboard/classes", icon: GraduationCap, label: t("sidebar.classes") },
    { to: "/dashboard/recorded", icon: BookOpen, label: t("sidebar.recorded") },
    { to: "/dashboard/courses", icon: BookOpen, label: t("sidebar.courses") },
    { to: "/dashboard/live-classes", icon: Video, label: t("sidebar.liveClasses") },
    { to: "/dashboard/teachers", icon: Users, label: t("sidebar.teachers") },
    { to: "/dashboard/tests", icon: Brain, label: t("sidebar.tests") },
    { to: "/dashboard/doubts", icon: MessageCircle, label: t("sidebar.doubts") },
    { to: "/dashboard/progress", icon: BarChart3, label: t("sidebar.progress") },
    { to: "/dashboard/payments", icon: CreditCard, label: isHi ? "भुगतान" : "Payments" },
    { to: "/dashboard/notifications", icon: Bell, label: "Notifications" },
    { to: "/dashboard/profile", icon: UserCircle, label: t("sidebar.profile") },
  ];

  const teacherLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("sidebar.dashboard") },
    { to: "/dashboard/my-courses", icon: BookOpen, label: t("sidebar.myCourses") },
    { to: "/dashboard/manual-test", icon: PenTool, label: "Create Test" },
    { to: "/dashboard/ai-test", icon: Sparkles, label: "AI Test" },
    { to: "/dashboard/test-responses", icon: Eye, label: "Responses" },
    { to: "/dashboard/doubts", icon: MessageCircle, label: t("sidebar.doubts") },
    { to: "/dashboard/notifications", icon: Bell, label: "Notifications" },
    { to: "/dashboard/profile", icon: UserCircle, label: t("sidebar.profile") },
  ];

  const adminLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("sidebar.dashboard") },
    { to: "/dashboard/teachers-manage", icon: GraduationCap, label: isHi ? "शिक्षक" : "Teachers" },
    { to: "/dashboard/students-manage", icon: Users, label: isHi ? "छात्र" : "Students" },
    { to: "/dashboard/all-courses", icon: BookOpen, label: t("sidebar.courses") },
    { to: "/dashboard/live-classes", icon: Video, label: t("sidebar.liveClasses") },
    { to: "/dashboard/ai-test", icon: Sparkles, label: "AI Test" },
    { to: "/dashboard/manual-test", icon: PenTool, label: "Manual Test" },
    { to: "/dashboard/tests", icon: Brain, label: t("sidebar.tests") },
    { to: "/dashboard/test-responses", icon: Eye, label: isHi ? "रिस्पांस" : "Responses" },
    { to: "/dashboard/analytics", icon: BarChart3, label: t("sidebar.analytics") },
    { to: "/dashboard/notifications", icon: Bell, label: isHi ? "सूचनाएँ" : "Notifications" },
    { to: "/dashboard/settings", icon: Settings, label: t("sidebar.settings") },
  ];

  const links = role === "admin" ? adminLinks : role === "teacher" ? teacherLinks : studentLinks;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const roleLabel = role === "admin" ? t("sidebar.admin") : role === "teacher" ? t("sidebar.teacher") : t("sidebar.student");

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] sm:w-[220px] gradient-navy transform transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex flex-col h-screen">
          <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="Pragyanam Classes" className="w-9 h-9 rounded-full object-cover" />
              <span className="text-[15px] font-bold text-white tracking-tight font-heading">Pragyanam</span>
            </Link>
            <button className="lg:hidden p-1.5 text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto overscroll-contain min-h-0">
            {links.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <Link key={link.to} to={link.to} onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] ${isActive ? "bg-gold/20 text-gold shadow-sm" : "text-white/60 hover:bg-white/10 hover:text-white"}`}>
                  <link.icon className="w-4.5 h-4.5 shrink-0" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 p-3 border-t border-white/10 safe-area-bottom">
            <div className="flex items-center gap-2.5 mb-2.5 px-1">
              <div className="w-9 h-9 rounded-full bg-gold/20 overflow-hidden flex items-center justify-center text-[13px] font-semibold text-gold">
                {profile?.avatar_url ? (
                  <img src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`} alt="" className="w-full h-full object-cover" />
                ) : (
                  profile?.full_name?.charAt(0)?.toUpperCase() || "U"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white truncate">{profile?.full_name || t("common.user")}</p>
                <p className="text-[11px] text-white/50">{roleLabel}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-[12px] text-white/50 hover:text-red-400 hover:bg-white/5 h-9 active:scale-[0.97]">
              <LogOut className="w-3.5 h-3.5 mr-2" />
              {t("sidebar.logOut")}
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-[220px] min-w-0">
        <header className="sticky top-0 z-30 glass border-b border-border/50">
          <div className="flex items-center gap-1 sm:gap-2 h-12 px-2 sm:px-4">
            <button className="lg:hidden p-2 -ml-1 text-foreground rounded-lg hover:bg-muted active:scale-95 transition-transform shrink-0" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0 flex justify-center">
              <SearchBar />
            </div>
            <div className="flex items-center gap-0 sm:gap-1 shrink-0">
              <LanguageToggle />
              <ThemeToggle />
              <NotificationPanel />
            </div>
          </div>
        </header>
        <main className="p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
