import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Eye, EyeOff, ArrowLeft } from "lucide-react";
import PlanSelection from "@/components/PlanSelection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LanguageToggle from "@/components/LanguageToggle";
import { useLanguage } from "@/contexts/LanguageContext";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh",
];

const CLASS_LEVELS = ["6", "7", "8", "9", "10", "11", "12"];

const Auth = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPlanSelection, setShowPlanSelection] = useState(false);
  const [signedUpUserId, setSignedUpUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "", password: "", fullName: "",
    role: "student" as "student" | "teacher",
    phone: "", parentPhone: "", school: "",
    classLevel: "", state: "", district: "",
    qualification: "", subjectsTaught: "",
  });

  const isStudent = formData.role === "student";

  const handlePlanSelect = async (plan: "paid" | "free") => {
    if (!signedUpUserId) return;
    setLoading(true);
    try {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await supabase.from("profiles").update({
        subscription_plan: plan,
        is_free_student: plan === "free",
        trial_starts_at: plan === "paid" ? now.toISOString() : null,
        trial_ends_at: plan === "paid" ? trialEnd.toISOString() : null,
        is_verified: plan === "paid" ? true : false,
      }).eq("user_id", signedUpUserId);

      if (plan === "paid") {
        toast.success("🎉 7-day free trial started! Enjoy full access.");
      } else {
        toast.success("Request sent! Admin will approve your free access.");
      }
      navigate("/dashboard");
    } catch (error: any) { toast.error(error.message); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
        if (error) throw error;
        toast.success("Login successful!");
        navigate("/dashboard");
      } else {
        // Validate required fields
        if (!formData.phone || !formData.state || !formData.district) {
          toast.error(t("auth.fillAllFields"));
          setLoading(false);
          return;
        }
        if (isStudent && (!formData.parentPhone || !formData.school || !formData.classLevel)) {
          toast.error(t("auth.fillAllFields"));
          setLoading(false);
          return;
        }
        if (!isStudent && (!formData.qualification || !formData.subjectsTaught)) {
          toast.error(t("auth.fillAllFields"));
          setLoading(false);
          return;
        }

        const { data: signUpData, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              role: formData.role,
              phone: formData.phone,
              parent_phone: formData.parentPhone || null,
              school: formData.school || null,
              class_level: isStudent ? formData.classLevel : null,
              state: formData.state,
              district: formData.district,
              qualification: !isStudent ? formData.qualification : null,
              subjects_taught: !isStudent ? formData.subjectsTaught : null,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        if (signUpData.user && isStudent) {
          setSignedUpUserId(signUpData.user.id);
          setShowPlanSelection(true);
          setLoading(false);
          return;
        }

        toast.success(t("auth.accountCreated"));
        navigate("/dashboard");
      }
    } catch (error: any) { toast.error(error.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 gradient-navy items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-gold blur-3xl" />
          <div className="absolute bottom-20 right-20 w-48 h-48 rounded-full bg-gold blur-3xl" />
        </div>
        <div className="relative text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gold flex items-center justify-center mx-auto">
            <GraduationCap className="w-8 h-8 text-navy-dark" />
          </div>
          <h2 className="text-3xl font-extrabold text-white font-heading">Pragyanam</h2>
          <p className="text-white/60 text-sm max-w-sm">{t("auth.brandDesc")}</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="w-full max-w-sm my-4">
          <div className="flex items-center justify-between mb-6">
            <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> {t("auth.backToHome")}
            </Link>
            <LanguageToggle />
          </div>

          <div className="bg-card rounded-xl p-7 shadow-card border border-border">
            <div className="flex items-center gap-2 mb-7 lg:hidden">
              <div className="w-8 h-8 rounded-lg gradient-navy flex items-center justify-center">
                <GraduationCap className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-[15px] font-semibold text-foreground tracking-tight">Pragyanam</span>
            </div>

            {showPlanSelection ? (
              <PlanSelection onSelect={handlePlanSelect} loading={loading} />
            ) : (
            <>
            <h2 className="text-xl font-bold text-foreground tracking-tight mb-1">
              {isLogin ? t("auth.welcomeBack") : t("auth.createAccount")}
            </h2>
            <p className="text-[13px] text-muted-foreground mb-6">
              {isLogin ? t("auth.signInDesc") : t("auth.getStartedDesc")}
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {!isLogin && (
                <>
                  <div>
                    <Label className="text-[13px] text-foreground">{t("auth.iAmA")}</Label>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      {(["student", "teacher"] as const).map((r) => (
                        <button key={r} type="button" onClick={() => setFormData({ ...formData, role: r })}
                          className={`py-2 px-3 rounded-lg border text-[13px] font-medium transition-all ${formData.role === r ? "border-gold bg-gold/10 text-gold-warm" : "border-border text-muted-foreground hover:border-gold/30"}`}>
                          {r === "student" ? t("auth.student") : t("auth.teacher")}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-[13px] text-foreground">{t("auth.fullName")} *</Label>
                    <Input required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder={t("auth.yourName")} className="mt-1.5 h-9 text-[13px]" />
                  </div>

                  <div>
                    <Label className="text-[13px] text-foreground">{t("auth.phone")} *</Label>
                    <Input required type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="9876543210" className="mt-1.5 h-9 text-[13px]" />
                  </div>

                  {isStudent && (
                    <>
                      <div>
                        <Label className="text-[13px] text-foreground">{t("auth.parentPhone")} *</Label>
                        <Input required type="tel" value={formData.parentPhone} onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })} placeholder="9876543210" className="mt-1.5 h-9 text-[13px]" />
                      </div>
                      <div>
                        <Label className="text-[13px] text-foreground">{t("auth.school")} *</Label>
                        <Input required value={formData.school} onChange={(e) => setFormData({ ...formData, school: e.target.value })} placeholder={t("auth.schoolPlaceholder")} className="mt-1.5 h-9 text-[13px]" />
                      </div>
                      <div>
                        <Label className="text-[13px] text-foreground">{t("auth.class")} *</Label>
                        <Select value={formData.classLevel} onValueChange={(v) => setFormData({ ...formData, classLevel: v })}>
                          <SelectTrigger className="mt-1.5 h-9 text-[13px]"><SelectValue placeholder={t("auth.selectClass")} /></SelectTrigger>
                          <SelectContent>
                            {CLASS_LEVELS.map((c) => <SelectItem key={c} value={c}>{t("auth.classLabel")} {c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {!isStudent && (
                    <>
                      <div>
                        <Label className="text-[13px] text-foreground">{t("auth.qualification")} *</Label>
                        <Select value={formData.qualification} onValueChange={(v) => setFormData({ ...formData, qualification: v })}>
                          <SelectTrigger className="mt-1.5 h-9 text-[13px]"><SelectValue placeholder={t("auth.selectQualification")} /></SelectTrigger>
                          <SelectContent>
                            {["B.Ed", "M.Ed", "B.A", "M.A", "B.Sc", "M.Sc", "B.Tech", "M.Tech", "PhD", "D.El.Ed", "Other"].map((q) => (
                              <SelectItem key={q} value={q}>{q}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[13px] text-foreground">{t("auth.subjectsTaught")} *</Label>
                        <Input required value={formData.subjectsTaught} onChange={(e) => setFormData({ ...formData, subjectsTaught: e.target.value })} placeholder={t("auth.subjectsPlaceholder")} className="mt-1.5 h-9 text-[13px]" />
                      </div>
                      <div>
                        <Label className="text-[13px] text-foreground">{t("auth.school")}</Label>
                        <Input value={formData.school} onChange={(e) => setFormData({ ...formData, school: e.target.value })} placeholder={t("auth.schoolPlaceholder")} className="mt-1.5 h-9 text-[13px]" />
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[13px] text-foreground">{t("auth.state")} *</Label>
                      <Select value={formData.state} onValueChange={(v) => setFormData({ ...formData, state: v, district: "" })}>
                        <SelectTrigger className="mt-1.5 h-9 text-[13px]"><SelectValue placeholder={t("auth.selectState")} /></SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[13px] text-foreground">{t("auth.district")} *</Label>
                      <Input required value={formData.district} onChange={(e) => setFormData({ ...formData, district: e.target.value })} placeholder={t("auth.districtPlaceholder")} className="mt-1.5 h-9 text-[13px]" />
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label className="text-[13px] text-foreground">{t("auth.email")} {!isLogin && "*"}</Label>
                <Input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="you@example.com" className="mt-1.5 h-9 text-[13px]" />
              </div>
              <div>
                <Label className="text-[13px] text-foreground">{t("auth.password")} {!isLogin && "*"}</Label>
                <div className="relative mt-1.5">
                  <Input type={showPassword ? "text" : "password"} required minLength={6} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" className="h-9 text-[13px] pr-9" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {!isLogin && (
                <div className="flex items-start gap-2 mt-1">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className="text-[11px] text-muted-foreground leading-tight cursor-pointer">
                    {t("auth.iAgree") || "I agree to the"}{" "}
                    <Link to="/terms" target="_blank" className="text-gold-warm underline">{t("auth.terms") || "Terms & Conditions"}</Link>
                    {" & "}
                    <Link to="/privacy" target="_blank" className="text-gold-warm underline">{t("auth.privacy") || "Privacy Policy"}</Link>
                  </label>
                </div>
              )}
              <Button type="submit" disabled={loading || (!isLogin && !agreedToTerms)} className="w-full h-9 text-[13px] font-medium gradient-navy text-white hover:opacity-90">
                {loading ? t("auth.pleaseWait") : isLogin ? t("auth.signIn") : t("auth.createAccount")}
              </Button>
            </form>

            <p className="text-[13px] text-center text-muted-foreground mt-5">
              {isLogin ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
              <button onClick={() => setIsLogin(!isLogin)} className="text-gold-warm font-medium hover:underline">
                {isLogin ? t("auth.signUp") : t("auth.signIn")}
              </button>
            </p>
            </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
