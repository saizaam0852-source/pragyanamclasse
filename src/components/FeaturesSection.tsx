import { motion } from "framer-motion";
import { Video, FileText, Brain, MessageCircle, BarChart3, Globe, PlayCircle, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const FeaturesSection = () => {
  const { t } = useLanguage();

  const features = [
    { icon: Video, title: t("features.liveClasses"), desc: t("features.liveClassesDesc"), tone: "saffron" },
    { icon: PlayCircle, title: t("features.recorded"), desc: t("features.recordedDesc"), tone: "indigo" },
    { icon: FileText, title: t("features.studyMaterial"), desc: t("features.studyMaterialDesc"), tone: "mint" },
    { icon: Brain, title: t("features.smartTests"), desc: t("features.smartTestsDesc"), tone: "saffron" },
    { icon: MessageCircle, title: t("features.doubtSolving"), desc: t("features.doubtSolvingDesc"), tone: "indigo" },
    { icon: BarChart3, title: t("features.progressTracking"), desc: t("features.progressTrackingDesc"), tone: "mint" },
    { icon: Globe, title: t("features.multiLanguage"), desc: t("features.multiLanguageDesc"), tone: "saffron" },
    { icon: BookOpen, title: t("features.allSubjects"), desc: t("features.allSubjectsDesc"), tone: "indigo" },
  ];

  const toneStyles: Record<string, { bg: string; glow: string }> = {
    saffron: { bg: "var(--gradient-saffron)", glow: "var(--shadow-glow-saffron)" },
    indigo: { bg: "var(--gradient-indigo)", glow: "var(--shadow-glow-indigo)" },
    mint: { bg: "var(--gradient-mint)", glow: "var(--shadow-glow-mint)" },
  };

  return (
    <section id="features" className="py-20 sm:py-28 relative overflow-hidden" style={{ perspective: "1400px" }}>
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
        className="absolute top-10 right-10 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: "var(--gradient-aurora)", filter: "blur(120px)", opacity: 0.25 }}
      />

      <div className="max-w-6xl mx-auto px-5 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: -15 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="text-center mb-14"
        >
          <p className="text-[12px] font-bold text-accent uppercase tracking-[0.2em] mb-3">{t("features.label")}</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-3">
            {t("features.title")}
          </h2>
          <p className="text-[15px] text-muted-foreground max-w-md mx-auto">{t("features.subtitle")}</p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {features.map((feature, i) => {
            const tone = toneStyles[feature.tone];
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 40, rotateY: -15, rotateX: -10 }}
                whileInView={{ opacity: 1, y: 0, rotateY: 0, rotateX: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -8, rotateY: 6, rotateX: 4, scale: 1.03 }}
                style={{ transformStyle: "preserve-3d" }}
                className="rounded-3xl p-5 sm:p-6 cursor-pointer"
              >
                <div
                  className="rounded-3xl p-5 sm:p-6 h-full"
                  style={{ background: "hsl(var(--card))", boxShadow: "var(--shadow-clay)" }}
                >
                  <motion.div
                    whileHover={{ rotateZ: 12, scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: tone.bg, boxShadow: tone.glow }}
                  >
                    <feature.icon className="w-5 h-5 text-primary-foreground" />
                  </motion.div>
                  <h3 className="text-[14px] font-bold text-foreground mb-1.5 line-clamp-2">{feature.title}</h3>
                  <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-3">{feature.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
