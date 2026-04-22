import { motion } from "framer-motion";
import { Check, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const PricingSection = () => {
  const { t } = useLanguage();

  const plans = [
    {
      name: t("pricing.pro"), price: "₹299", period: "/mo",
      desc: t("pricing.proDesc"),
      features: [t("pricing.f.liveClasses"), t("pricing.f.recordedLectures"), t("pricing.f.pdfStudyMaterial"), t("pricing.f.mockExams"), t("pricing.f.priorityDoubt"), t("pricing.f.progressAnalytics"), t("pricing.f.competitivePrep")],
      popular: true, cta: t("pricing.getStarted"),
    },
    {
      name: t("pricing.free"), price: "₹0", period: "",
      desc: t("pricing.freeDesc"),
      features: [t("pricing.f.fullAccess"), t("pricing.f.adminApproval"), t("pricing.f.community"), t("pricing.f.noCompromise")],
      popular: false, cta: t("pricing.applyNow"), isFree: true,
    },
  ];

  return (
    <section id="pricing" className="py-20 sm:py-28 relative" style={{ perspective: "1400px" }}>
      <div className="max-w-5xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: -15 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="text-center mb-14"
        >
          <p className="text-[12px] font-bold text-accent uppercase tracking-[0.2em] mb-3">{t("pricing.label")}</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-3">
            {t("pricing.title")}
          </h2>
          <p className="text-[15px] text-muted-foreground max-w-md mx-auto">{t("pricing.subtitle")}</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 max-w-3xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 50, rotateY: i === 0 ? -20 : 20, scale: 0.92 }}
              whileInView={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -10, rotateY: i === 0 ? 4 : -4, scale: 1.02 }}
              style={{ transformStyle: "preserve-3d" }}
              className="relative rounded-3xl p-7 sm:p-8"
            >
              <div
                className="absolute inset-0 rounded-3xl"
                style={{
                  background: plan.popular ? "var(--gradient-saffron)" : "hsl(var(--card))",
                  boxShadow: plan.popular
                    ? "var(--shadow-glow-saffron), var(--shadow-clay-lg)"
                    : "var(--shadow-clay)",
                }}
              />
              <div className="relative">
                {plan.popular && (
                  <div
                    className="absolute -top-10 left-1/2 -translate-x-1/2 text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1 text-foreground"
                    style={{ background: "hsl(var(--card))", boxShadow: "var(--shadow-clay-sm)" }}
                  >
                    <Sparkles className="w-3 h-3 text-accent" />
                    {t("pricing.mostPopular")}
                  </div>
                )}
                {plan.isFree && (
                  <div
                    className="absolute -top-10 left-1/2 -translate-x-1/2 text-[11px] font-bold px-3 py-1.5 rounded-full whitespace-nowrap flex items-center gap-1 text-accent-foreground"
                    style={{ background: "var(--gradient-mint)", boxShadow: "var(--shadow-glow-mint)" }}
                  >
                    <Heart className="w-3 h-3" /> {t("pricing.socialImpact")}
                  </div>
                )}
                <h3 className={`text-[16px] font-extrabold mb-3 ${plan.popular ? "text-primary-foreground" : "text-foreground"}`}>
                  {plan.name}
                </h3>
                <div className="mb-1">
                  <span className={`text-5xl font-extrabold tracking-tight ${plan.popular ? "text-primary-foreground" : "text-foreground"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-[13px] ${plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`text-[13px] mb-6 ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {plan.desc}
                </p>
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className={`flex items-start gap-2 text-[13px] ${plan.popular ? "text-primary-foreground" : "text-foreground"}`}
                    >
                      <Check
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${plan.popular ? "text-primary-foreground" : "text-accent"}`}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/auth">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      className={`w-full h-11 text-[13px] font-bold rounded-xl border-0 ${
                        plan.popular ? "text-primary" : "text-primary-foreground"
                      }`}
                      style={{
                        background: plan.popular ? "hsl(var(--card))" : "var(--gradient-indigo)",
                        boxShadow: plan.popular ? "var(--shadow-clay-sm)" : "var(--shadow-glow-indigo)",
                      }}
                    >
                      {plan.cta}
                    </Button>
                  </motion.div>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
