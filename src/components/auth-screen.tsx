import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

type Mode = "login" | "signup" | "forgot";

// Traduz as mensagens mais comuns do Supabase.
function message(error: { message: string; code?: string }) {
  const text = error.message.toLowerCase();
  if (text.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (text.includes("email not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (text.includes("already registered")) return "Já existe uma conta com esse e-mail. Tente entrar.";
  if (text.includes("password should be")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (text.includes("rate limit") || text.includes("security purposes"))
    return "Muitas tentativas seguidas. Espere um pouco e tente de novo.";
  if (text.includes("valid email") || text.includes("invalid format")) return "Informe um e-mail válido.";
  if (text.includes("fetch")) return "Sem conexão com o servidor. Verifique sua internet.";
  return "Não foi possível concluir. Tente de novo.";
}

const redirectTo = () => window.location.origin + window.location.pathname;

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  function switchTo(next: Mode) {
    setMode(next);
    setError("");
    setInfo("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    if (mode === "signup" && name.trim().length < 2) return setError("Informe seu nome.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Informe um e-mail válido.");
    if (mode !== "forgot" && password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(message(error));
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: redirectTo() },
        });
        if (error) setError(message(error));
        else if (!data.session) {
          setInfo(`Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail e depois entre aqui.`);
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectTo() });
        if (error) setError(message(error));
        else setInfo(`Se existir uma conta com ${email.trim()}, você vai receber um link para criar uma nova senha.`);
      }
    } catch {
      setError("Sem conexão com o servidor. Verifique sua internet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            f
          </span>
          <span className="brand-word">finance flow</span>
        </div>

        {mode !== "forgot" ? (
          <div className="segmented wide auth-tabs" role="tablist" aria-label="Acesso">
            <button type="button" role="tab" aria-selected={mode === "login"} aria-pressed={mode === "login"} onClick={() => switchTo("login")}>
              Entrar
            </button>
            <button type="button" role="tab" aria-selected={mode === "signup"} aria-pressed={mode === "signup"} onClick={() => switchTo("signup")}>
              Criar conta
            </button>
          </div>
        ) : (
          <h1 className="auth-title">Recuperar senha</h1>
        )}

        <form onSubmit={submit} noValidate className="auth-form">
          {mode === "signup" && (
            <div className="field">
              <label className="field-label" htmlFor="auth-name">
                Nome
              </label>
              <input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} />
            </div>
          )}
          <div className="field">
            <label className="field-label" htmlFor="auth-email">
              E-mail
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </div>
          {mode !== "forgot" && (
            <div className="field">
              <label className="field-label" htmlFor="auth-password">
                Senha
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
          )}

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="auth-info" role="status">
              {info}
            </p>
          )}

          <button type="submit" className="button primary full" disabled={busy}>
            {busy ? "Aguarde…" : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
          </button>
        </form>

        {mode === "login" && (
          <button type="button" className="link auth-alt" onClick={() => switchTo("forgot")}>
            Esqueci minha senha
          </button>
        )}
        {mode === "forgot" && (
          <button type="button" className="link auth-alt" onClick={() => switchTo("login")}>
            Voltar para entrar
          </button>
        )}
      </div>
    </div>
  );
}

export function NewPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(message(error));
    else onDone();
  }
  return (
    <div className="auth">
      <div className="auth-card">
        <h1 className="auth-title">Nova senha</h1>
        <form onSubmit={submit} noValidate className="auth-form">
          <div className="field">
            <label className="field-label" htmlFor="new-password">
              Nova senha
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              autoComplete="new-password"
              autoFocus
            />
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button primary full" disabled={busy}>
            {busy ? "Salvando…" : "Salvar senha"}
          </button>
        </form>
      </div>
    </div>
  );
}
