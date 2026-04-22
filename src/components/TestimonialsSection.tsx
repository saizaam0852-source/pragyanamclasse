import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const TestimonialsSection = () => {
  const { t } = useLanguage();

  const testimonials = [
    { name: t("testimonials.name1"), role: t("testimonials.role1"), text: t("testimonials.text1"), avatar: "R", tone: "saffron" },
    { name: t("testimonials.name2"), role: t("testimonials.role2"), text: t("testimonials.text2"), avatar: "P", tone: "indigo" },
    { name: t("testimonials.name3"), role: t("testimonials.role3"), text: t("testimonials.text3"), avatar: "A", tone: "mint" },
  ];

  const toneBg: Record<string, string> = {
    saffron: "var(--gradient-saffron)",
    indigo: "var(--gradient-indigo)",
    mint: "var(--gradient-mint)",
  };

  return (
    <section className="py-20 sm:py-28 relative" style={{ perspective: "1400px" }}>
      <div className="max-w-6xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 30, rotateX: -15 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="text-center mb-14"
        >
          <p className="text-[12px] font-bold text-accent uppercase tracking-[0.2em] mb-3">{t("testimonials.label")}</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-3">
            {t("testimonials.title")}
          </h2>
          <p className="text-[15px] text-muted-foreground max-w-md mx-auto">{t("testimonials.subtitle")}</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {testimonials.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 50, rotateY: -15, rotateX: -10 }}
              whileInView={{ opacity: 1, y: 0, rotateY: 0, rotateX: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -8, rotateY: 4, rotateX: 4, scale: 1.02 }}
              style={{ transformStyle: "preserve-3d" }}
              className="relative rounded-3xl p-6"
            >
              <div
                className="rounded-3xl p-6 h-full flex flex-col"
                style={{ background: "hsl(var(--card))", boxShadow: "var(--shadow-clay)" }}
              >
                <Quote className="w-8 h-8 text-accent/40 mb-4" />
                <p className="text-[13px] text-foreground leading-relaxed mb-6 flex-1">"{item.text}"</p>
                <div className="flex items-center gap-3 mt-auto">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-primary-foreground text-[12px] font-bold shrink-0"
                    style={{ background: toneBg[item.tone], boxShadow: "var(--shadow-clay-sm)" }}
                  >
                    {item.avatar}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-foreground">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground">{item.role}</div>
                  </div>
                </div>
                <div className="flex gap-0.5 mt-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-accent text-accent" />
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats panel */}
        <motion.div
          initial={{ opacity: 0, y: 40, rotateX: -10 }}
          whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="mt-16 rounded-3xl p-7 sm:p-10 max-w-4xl mx-auto"
        >
          <div
            className="rounded-3xl p-7 sm:p-10"
            style={{ background: "var(--gradient-aurora)", boxShadow: "var(--shadow-clay-lg)" }}
          >
            <h3 className="text-xl sm:text-2xl font-extrabold text-primary-foreground text-center mb-7">
              {t("testimonials.successTitle")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              {[
                { value: "5,000+", label: t("testimonials.stat1") },
                { value: "95%", label: t("testimonials.stat2") },
                { value: "₹299", label: t("testimonials.stat3") },
                { value: "50+", label: t("testimonials.stat4") },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.6, rotateZ: -10 }}
                  whileInView={{ opacity: 1, scale: 1, rotateZ: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 + i * 0.08, type: "spring", stiffness: 180 }}
                  whileHover={{ scale: 1.1 }}
                  className="text-center"
                >
                  <div className="text-2xl sm:text-4xl font-extrabold text-primary-foreground tracking-tight">
                    {stat.value}
                  </div>
                  <div className="text-[11px] sm:text-[12px] text-primary-foreground/80 font-semibold mt-1">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
