import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Users, BookOpen, Brain, TrendingUp, BarChart3, DollarSign } from "lucide-react";

const formatINR = (amountInPaise: number) => `₹${Math.round(amountInPaise / 100).toLocaleString("en-IN")}`;

const AdminAnalytics = () => {
  const [stats, setStats] = useState({
    users: 0, courses: 0, tests: 0, enrollments: 0, doubts: 0, revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [u, c, t, e, d, payments] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }),
        supabase.from("tests").select("id", { count: "exact", head: true }),
        supabase.from("enrollments").select("id", { count: "exact", head: true }),
        supabase.from("doubts").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount").eq("status", "paid"),
      ]);

      setStats({
        users: u.count || 0,
        courses: c.count || 0,
        tests: t.count || 0,
        enrollments: e.count || 0,
        doubts: d.count || 0,
        revenue: (payments.data || []).reduce((sum, payment: any) => sum + (payment.amount || 0), 0),
      });
      setLoading(false);
    };
    fetch();
  }, []);

  const cards = [
    { icon: Users, label: "Total Users", value: stats.users, color: "bg-navy/10 text-navy dark:bg-gold/10 dark:text-gold" },
    { icon: BookOpen, label: "Total Courses", value: stats.courses, color: "bg-gold/10 text-gold-warm" },
    { icon: Brain, label: "Total Tests", value: stats.tests, color: "bg-emerald/10 text-emerald" },
    { icon: TrendingUp, label: "Enrollments", value: stats.enrollments, color: "bg-saffron/10 text-saffron-dark" },
    { icon: BarChart3, label: "Doubts", value: stats.doubts, color: "bg-navy/10 text-navy dark:bg-navy-light/20 dark:text-gold-light" },
    { icon: DollarSign, label: "Revenue", value: formatINR(stats.revenue), color: "bg-destructive/10 text-destructive" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-heading text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Platform-wide analytics and insights</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-gold border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <div key={card.label} className="bg-card rounded-2xl p-6 border border-border hover:shadow-card hover:border-gold/20 transition-all">
                <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center mb-4`}>
                  <card.icon className="w-6 h-6" />
                </div>
                <p className="text-3xl font-extrabold font-heading text-foreground">{card.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{card.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminAnalytics;
