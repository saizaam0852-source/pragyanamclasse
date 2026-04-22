import { GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const FooterSection = () => {
  const { t, language } = useLanguage();
  const isHi = language === "hi";

  return (
    <footer id="about" className="relative pt-12 pb-8 px-5">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-6xl mx-auto"
      >
        <div
          className="rounded-3xl p-8 sm:p-12"
          style={{ background: "var(--gradient-indigo)", boxShadow: "var(--shadow-clay-lg)" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 mb-10">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--gradient-saffron)", boxShadow: "var(--shadow-glow-saffron)" }}
                >
                  <GraduationCap className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-[16px] font-extrabold text-primary-foreground">Pragyanam Academy</span>
              </div>
              <p className="text-[13px] text-primary-foreground/75 max-w-sm leading-relaxed">{t("footer.desc")}</p>
            </div>
            <div>
              <h4 className="text-[12px] font-bold text-primary-foreground uppercase tracking-wider mb-4">{t("footer.platform")}</h4>
              <ul className="space-y-2.5 text-[13px] text-primary-foreground/70">
                <li><a href="#courses" className="hover:text-primary-foreground transition-colors">{t("nav.courses")}</a></li>
                <li><a href="#features" className="hover:text-primary-foreground transition-colors">{t("nav.features")}</a></li>
                <li><a href="#pricing" className="hover:text-primary-foreground transition-colors">{t("nav.pricing")}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-[12px] font-bold text-primary-foreground uppercase tracking-wider mb-4">{t("footer.support")}</h4>
              <ul className="space-y-2.5 text-[13px] text-primary-foreground/70">
                <li><a href="#" className="hover:text-primary-foreground transition-colors">{t("footer.helpCenter")}</a></li>
                <li><a href="#" className="hover:text-primary-foreground transition-colors">{t("footer.contact")}</a></li>
                <li><Link to="/privacy" className="hover:text-primary-foreground transition-colors">{t("footer.privacy")}</Link></li>
                <li><Link to="/terms" className="hover:text-primary-foreground transition-colors">{isHi ? "नियम और शर्तें" : "Terms & Conditions"}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/15 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[12px] text-primary-foreground/60">{t("footer.rights")}</p>
            <p className="text-[12px] text-primary-foreground/60">{t("footer.madeFor")}</p>
          </div>
        </div>
      </motion.div>
    </footer>
  );
};

export default FooterSection;
