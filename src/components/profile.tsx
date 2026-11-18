import { useState, type FormEvent } from "react";
import { Check, LogOut } from "lucide-react";
import { Modal } from "./modal";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return (words.length > 1 ? [words[0], words[words.length - 1]] : words)
    .map((word) => Array.from(word)[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}

export function ProfileButton({ name, onEdit }: { name: string; onEdit: () => void }) {
  return (
    <button className="avatar-button" onClick={onEdit} aria-label={`Minha conta: ${name}`} title={name}>
      <span className="avatar" aria-hidden="true">
        {initials(name)}
      </span>
    </button>
  );
}

export function ProfileModal({
  name,
  email,
  onSave,
  onSignOut,
  onClose,
}: {
  name: string;
  email: string;
  onSave: (name: string) => Promise<void>;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = value.trim().replace(/\s+/g, " ");
    if (!normalized) return setError("Informe seu nome.");
    setBusy(true);
    try {
      await onSave(normalized);
    } catch {
      setError("Não foi possível salvar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Minha conta" description={email} onClose={onClose} small>
      <form className="modal-body" onSubmit={submit}>
        <div className="profile-preview" aria-hidden="true">
          <span className="avatar">{initials(value || name)}</span>
          <span>{value.trim() || name}</span>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="profile-name">
            Nome
          </label>
          <input
            id="profile-name"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            maxLength={60}
            autoComplete="name"
            data-initial-focus
            aria-invalid={Boolean(error)}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="modal-actions spread">
          <button type="button" className="button" onClick={onSignOut}>
            <LogOut aria-hidden="true" /> Sair da conta
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            <Check aria-hidden="true" /> Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
