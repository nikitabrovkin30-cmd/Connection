import { useState } from 'react';
import type { FormEvent } from 'react';

type AuthProps = {
  onGuestStart: () => Promise<void>;
  onGoogleStart: () => Promise<void>;
  onStart: (email: string, password: string) => Promise<string>;
};

type GamePreviewKind = 'wordle' | 'association' | 'puzzle' | 'who';

const INTRO_GAMES: readonly { title: string; kind: GamePreviewKind }[] = [
  { title: 'Wordle', kind: 'wordle' },
  { title: 'Association', kind: 'association' },
  { title: 'Puzzle', kind: 'puzzle' },
  { title: 'Who am I?', kind: 'who' },
];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function GameModePicture({ kind, title }: { kind: GamePreviewKind; title: string }) {
  if (kind === 'wordle') {
    return (
      <div className="mode-picture wordle-picture" aria-label={title}>
        <div className="wordle-mini-row">
          <span className="tile-green">С</span>
          <span className="tile-gold">Л</span>
          <span className="tile-gray">О</span>
          <span className="tile-green">В</span>
          <span className="tile-gray">О</span>
        </div>
        <div className="wordle-keyboard-mini">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  if (kind === 'association') {
    return (
      <div className="mode-picture association-picture" aria-label={title}>
        <span className="assoc-center">?</span>
        <span className="assoc-node assoc-node-top">звезда</span>
        <span className="assoc-node assoc-node-right">небо</span>
        <span className="assoc-node assoc-node-bottom">планета</span>
        <span className="assoc-node assoc-node-left">ночь</span>
      </div>
    );
  }

  if (kind === 'puzzle') {
    return (
      <div className="mode-picture puzzle-picture" aria-label={title}>
        <span className="puzzle-piece piece-one">?</span>
        <span className="puzzle-piece piece-two">!</span>
        <span className="puzzle-piece piece-three">✓</span>
      </div>
    );
  }

  return (
    <div className="mode-picture who-picture" aria-label={title}>
      <span className="secret-card">Кто я?</span>
      <span className="answer-chip yes-chip">Да</span>
      <span className="answer-chip no-chip">Нет</span>
      <span className="question-mark">?</span>
    </div>
  );
}

export function Auth({ onGoogleStart, onGuestStart, onStart }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [showIntro, setShowIntro] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const nextEmail = normalizeEmail(email);

    if (!nextEmail.includes('@')) {
      setMessage('Напиши mail правильно.');
      return;
    }

    if (password.length < 4) {
      setMessage('Пароль должен быть хотя бы из 4 символов.');
      return;
    }

    setBusy(true);
    const errorMessage = await onStart(nextEmail, password);
    setBusy(false);

    if (errorMessage) {
      setMessage(errorMessage);
    }
  }

  async function handleGuestStart() {
    setBusy(true);
    setMessage('');
    await onGuestStart();
    setBusy(false);
  }

  async function handleGoogleStart() {
    setBusy(true);
    setMessage('');
    await onGoogleStart();
    setBusy(false);
  }

  if (showIntro) {
    return (
      <section className="card intro-card">
        <span className="intro-kicker">Игры в проекте</span>

        <div className="intro-grid">
          {INTRO_GAMES.map((game) => (
            <button
              aria-label={`Открыть регистрацию: ${game.title}`}
              className={`intro-panel intro-panel-button ${game.kind}-panel`}
              key={game.kind}
              onClick={() => setShowIntro(false)}
              type="button"
            >
              <GameModePicture kind={game.kind} title={game.title} />
            </button>
          ))}
        </div>

        <button className="next-button" onClick={() => setShowIntro(false)} type="button">
          Продолжить
        </button>
      </section>
    );
  }

  return (
    <section className="card lobby-card">
      <div className="lobby-badges" aria-hidden="true">
        <span>звезда</span>
        <span>море</span>
        <span>книга</span>
      </div>

      <h2>Вход в игру</h2>
      <p className="auth-subtitle">Войди по mail и выбирай режим: Association, Wordle, Puzzle или Who am I?.</p>

      <div className="lobby-preview" aria-hidden="true">
        <span>Association</span>
        <span>Wordle</span>
        <span>Puzzle</span>
        <span>Who am I?</span>
      </div>

      <form onSubmit={handleSubmit} className="form">
        <input
          type="email"
          placeholder="mail"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setMessage('');
          }}
          autoFocus
          required
          disabled={busy}
        />
        <input
          type="password"
          placeholder="пароль"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setMessage('');
          }}
          minLength={4}
          required
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Входим...' : 'Играть'}
        </button>
      </form>

      <button className="guest-button" disabled={busy} onClick={handleGuestStart} type="button">
        {busy ? 'Входим...' : 'Играть гостем'}
      </button>

      <button className="google-button" disabled={busy} onClick={handleGoogleStart} type="button">
        Войти через Google
      </button>

      {message && <p className="message">{message}</p>}
    </section>
  );
}
