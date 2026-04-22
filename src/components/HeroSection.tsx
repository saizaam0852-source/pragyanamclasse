import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import AnimatedCounter from "@/components/AnimatedCounter";

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section
      id="home"
      className="relative min-h-[92vh] flex items-center pt-16 overflow-hidden"
      style={{ perspective: "1200px" }}
    >
      {/* Layered claymorphic background blobs */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
        className="absolute -top-32 -right-24 w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{ background: "var(--gradient-saffron)", filter: "blur(90px)", opacity: 0.35 }}
      />
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: "easeOut", delay: 0.15 }}
        className="absolute -bottom-32 -left-24 w-[460px] h-[460px] rounded-full pointer-events-none"
        style={{ background: "var(--gradient-indigo)", filter: "blur(90px)", opacity: 0.3 }}
      />
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, delay: 0.3 }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: "var(--gradient-mint)", filter: "blur(110px)", opacity: 0.18 }}
      />

      <div className="max-w-6xl mx-auto px-5 relative z-10 w-full">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30, rotateX: -25 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformStyle: "preserve-3d" }}
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold text-primary mb-8"
              style={{ background: "hsl(var(--card))", boxShadow: "var(--shadow-clay-sm)" }}
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              {t("hero.badge")}
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40, rotateX: -20 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformStyle: "preserve-3d" }}
            className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-[1.05] tracking-tight mb-5"
          >
            {t("hero.title1")}
            <span
              className="block bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--gradient-sunset)" }}
            >
              {t("hero.titleHighlight")}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-[14px] sm:text-[16px] text-muted-foreground leading-relaxed mb-10 max-w-xl mx-auto px-2"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-col sm:flex-row gap-3 justify-center mb-14 px-4 sm:px-0"
          >
            <Link to="/auth">
              <motion.div whileHover={{ y: -3, scale: 1.02 }} whileTap={{ y: 1, scale: 0.98 }} transition={{ type: "spring", stiffness: 400 }}>
                <Button
                  size="lg"
                  className="h-12 px-7 text-[14px] font-bold rounded-2xl text-primary-foreground border-0 w-full sm:w-auto"
                  style={{ background: "var(--gradient-saffron)", boxShadow: "var(--shadow-glow-saffron), var(--shadow-clay)" }}
                >
                  {t("hero.cta1")} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            </Link>
            <a href="#features">
              <motion.div whileHover={{ y: -3, scale: 1.02 }} whileTap={{ y: 1, scale: 0.98 }} transition={{ type: "spring", stiffness: 400 }}>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-7 text-[14px] font-bold rounded-2xl border-0 text-foreground w-full sm:w-auto"
                  style={{ background: "hsl(var(--card))", boxShadow: "var(--shadow-clay-sm)" }}
                >
                  {t("hero.cta2")}
                </Button>
              </motion.div>
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="grid grid-cols-3 gap-3 sm:gap-5 max-w-2xl mx-auto"
          >
            {[
              { end: 5000, suffix: "+", label: t("hero.students") },
              { end: 20, suffix: "+", label: t("hero.coursesCount") },
              { end: 95, suffix: "%", label: t("hero.passRate") },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30, rotateX: -30 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ duration: 0.7, delay: 0.6 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4, rotateX: 8, scale: 1.03 }}
                style={{ transformStyle: "preserve-3d" }}
                className="rounded-2xl p-3 sm:p-5"
                // semantic surface via index.css token
              >
                <div
                  className="rounded-2xl p-3 sm:p-5"
                  style={{ background: "hsl(var(--card))", boxShadow: "var(--shadow-clay)" }}
                >
                  <AnimatedCounter end={stat.end} suffix={stat.suffix} label={stat.label} />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
