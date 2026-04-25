import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "teacher" | "student";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refetchProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const fetchUserData = async (userId: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      let [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      ]);

      if (!profileRes.data || !roleRes.data?.role) {
        const { data: healed, error: healError } = await supabase.functions.invoke("ensure-user-account");
        if (!healError) {
          profileRes = { ...profileRes, data: healed?.profile ?? profileRes.data } as typeof profileRes;
          roleRes = { ...roleRes, data: healed?.role ? { role: healed.role } : roleRes.data } as typeof roleRes;
        }
      }

      setProfile(profileRes.data ?? null);

      if (roleRes.data?.role) {
        setRole(roleRes.data.role as UserRole);
      } else {
        // SECURITY: never trust client-side user_metadata.role — always fall back to 'student'.
        setRole("student");
      }
    } finally {
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    // IMPORTANT: Set up listener BEFORE getSession to avoid race conditions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Use setTimeout to avoid blocking the auth state change callback
          // but DON'T do any async Supabase calls directly in this callback
          setTimeout(() => {
            if (mounted) fetchUserData(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  const refetchProfile = async () => {
    if (user) {
      fetchingRef.current = false; // allow refetch
      await fetchUserData(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, signOut, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
