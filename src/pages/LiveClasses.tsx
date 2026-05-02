import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Video, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const LiveClasses = () => {
  const { language } = useLanguage();
  const isHi = language === "hindi";

  return (
    <DashboardLayout>
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full text-center"
        >
          <div className="relative mx-auto mb-6 w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 blur-2xl" />
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
              <Video className="w-12 h-12 text-white" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3">
            <Sparkles className="w-3 h-3" />
            {isHi ? "जल्द आ रहा है" : "Coming Soon"}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            {isHi ? "लाइव क्लास नया रूप ले रही है" : "Live Classes Are Getting an Upgrade"}
          </h1>

          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-6">
            {isHi
              ? "हम लाइव क्लास सिस्टम को बेहतर बनाने के लिए फिर से बना रहे हैं। बहुत जल्द एक नया, स्थिर और शानदार अनुभव मिलेगा।"
              : "We're rebuilding the live class system to give you a smoother, more reliable experience. Stay tuned — something great is on the way."}
          </p>

          <div className="text-xs text-muted-foreground/70">
            {isHi ? "आपकी समझदारी के लिए धन्यवाद 🙏" : "Thank you for your patience 🙏"}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default LiveClasses;
