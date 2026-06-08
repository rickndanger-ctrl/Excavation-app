import { LogIn, X } from 'lucide-react';
import { useState } from 'react';
import type { AuthState } from '../hooks/useAuth';

type Props = {
  auth: AuthState;
  onClose: () => void;
};

export function AuthModal({ auth, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    const err = await auth.signIn(email, password);
    setBusy(false);
    if (err) {
      setErrorMsg(err);
    } else {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">
            <LogIn size={16} /> Manager Sign In
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <p className="modal__subtitle">
          Sign in to upload and manage plan sheets. Crew members can view plans without signing in.
        </p>

        <form onSubmit={handleSubmit} className="modal__form">
          <label className="form-label">
            Email
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="form-label">
            Password
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {errorMsg && <p className="form-error">{errorMsg}</p>}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
