import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  // Vira true quando a pessoa chega pelo link de "esqueci minha senha".
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const name =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
    user?.email?.split("@")[0] ||
    "";

  return {
    ready,
    user,
    name,
    recovering,
    doneRecovering: () => setRecovering(false),
    signOut: () => supabase.auth.signOut(),
    updateName: async (value: string) => {
      const { error } = await supabase.auth.updateUser({ data: { name: value } });
      if (error) throw error;
    },
  };
}
