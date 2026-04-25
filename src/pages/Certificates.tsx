import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Award, Download, Share2 } from "lucide-react";
import { toast } from "sonner";

interface Certificate {
  id: string;
  course_id: string;
  certificate_number: string;
  issued_at: string;
  course_title: string;
  course_title_hi: string;
}

const Certificates = () => {
  const { user, profile } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("certificates")
        .select("*, courses(title, title_hi)")
        .eq("user_id", user.id)
        .order("issued_at", { ascending: false });

      setCertificates(
        (data || []).map((c: any) => ({
          id: c.id,
          course_id: c.course_id,
          certificate_number: c.certificate_number,
          issued_at: c.issued_at,
          course_title: c.courses?.title || "Course",
          course_title_hi: c.courses?.title_hi || "",
        }))
      );
      setLoading(false);
    };
    fetch();
  }, [user]);

  const downloadPDF = (cert: Certificate) => {
    // Generate a simple PDF-like printable page
    const win = window.open("", "_blank");
    if (!win) { toast.error("Please allow popups"); return; }

    const studentName = profile?.full_name || "Student";
    const date = new Date(cert.issued_at).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });

    // SECURITY: escape all user-controlled values before injecting into HTML
    const esc = (s: string) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const safeTitle = esc(cert.course_title);
    const safeTitleHi = esc(cert.course_title_hi);
    const safeStudent = esc(studentName);
    const safeCertNo = esc(cert.certificate_number);
    const safeDate = esc(date);

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Certificate - ${safeTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f5f5; }
          .cert {
            width: 800px; height: 560px; background: white; position: relative;
            border: 3px solid #1a365d; padding: 48px; text-align: center;
            font-family: 'Inter', sans-serif;
          }
          .cert::before {
            content: ''; position: absolute; inset: 8px;
            border: 1px solid #c9913d; pointer-events: none;
          }
          .logo { font-family: 'Playfair Display', serif; font-size: 28px; color: #1a365d; margin-bottom: 4px; }
          .logo span { color: #c9913d; }
          .subtitle { font-size: 11px; color: #888; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 32px; }
          .heading { font-size: 14px; color: #c9913d; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 16px; }
          .name { font-family: 'Playfair Display', serif; font-size: 32px; color: #1a365d; margin-bottom: 12px; }
          .course { font-size: 16px; color: #333; margin-bottom: 8px; }
          .course-hi { font-size: 14px; color: #666; margin-bottom: 24px; }
          .details { font-size: 11px; color: #999; }
          .footer { position: absolute; bottom: 32px; left: 48px; right: 48px; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; }
          @media print { body { background: white; } .cert { border: 3px solid #1a365d; } }
        </style>
      </head>
      <body>
        <div class="cert">
          <div class="logo">प्रज्ञानम् <span>Pragyanam</span></div>
          <div class="subtitle">Excellence in Education</div>
          <div class="heading">Certificate of Completion</div>
          <p style="font-size:13px;color:#666;margin-bottom:12px;">This is to certify that</p>
          <div class="name">${safeStudent}</div>
          <p style="font-size:13px;color:#666;margin-bottom:8px;">has successfully completed the course</p>
          <div class="course">${safeTitle}</div>
          ${safeTitleHi ? `<div class="course-hi">${safeTitleHi}</div>` : '<div style="margin-bottom:24px"></div>'}
          <div class="details">Issued on ${safeDate}</div>
          <div class="footer">
            <span>Certificate No: ${safeCertNo}</span>
            <span>Pragyanam Education Platform</span>
          </div>
        </div>
        <script>setTimeout(() => window.print(), 500);</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold font-heading text-foreground">
            Certificates / प्रमाणपत्र
          </h1>
          <p className="text-sm text-muted-foreground">Your earned certificates</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-2xl border border-border">
            <Award className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-1">No Certificates Yet</h3>
            <p className="text-sm text-muted-foreground">
              Complete a course to earn your certificate!<br />
              कोर्स पूरा करें और प्रमाणपत्र प्राप्त करें!
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-card transition-all"
              >
                {/* Certificate Preview Card */}
                <div className="relative bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 p-6 text-center border-b border-border">
                  <div className="absolute inset-3 border border-primary/20 rounded-lg pointer-events-none" />
                  <Award className="w-10 h-10 mx-auto text-primary mb-2" />
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Certificate of Completion</p>
                  <h3 className="text-lg font-bold text-foreground">{cert.course_title}</h3>
                  {cert.course_title_hi && (
                    <p className="text-sm text-primary">{cert.course_title_hi}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {profile?.full_name || "Student"}
                  </p>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(cert.issued_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{cert.certificate_number}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `I completed "${cert.course_title}" on Pragyanam! Certificate: ${cert.certificate_number}`
                        );
                        toast.success("Copied to clipboard!");
                      }}
                    >
                      <Share2 className="w-3 h-3 mr-1" /> Share
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => downloadPDF(cert)}
                      className="bg-primary text-primary-foreground"
                    >
                      <Download className="w-3 h-3 mr-1" /> PDF
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Certificates;
