import { useState } from 'react';
import type { FormEvent } from 'react';

type AuthProps = {
  onGuestStart: () => Promise<void>;
  onGoogleStart: () => Promise<void>;
  onStart: (email: string, password: string) => Promise<string>;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
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
        <h2>WORD GAMES HUB</h2>

        <div className="intro-grid">
          <article className="intro-panel wordle-panel">
            <h3>Wordle</h3>
            <p>
              Wordle - это игра, где нужно угадать слово за 6 попыток. После каждой попытки
              буквы меняют цвет.
            </p>
            <ul>
              <li><strong>Зеленый:</strong> буква стоит на своем месте.</li>
              <li><strong>Желтый:</strong> буква есть в слове, но в другом месте.</li>
              <li><strong>Серый:</strong> такой буквы в слове нет.</li>
            </ul>
          </article>

          <article className="intro-panel association-panel">
            <h3>Association</h3>
            <p>
              Association - это режим про смысл и ассоциации. Нужно найти загаданное слово,
              пробуя близкие по теме варианты.
            </p>
            <ul>
              <li>Пиши любое слово или ответ.</li>
              <li>Меньшее число значит, что ассоциация ближе.</li>
              <li>Подсказки помогают понять тему слова.</li>
            </ul>
          </article>

          <article className="intro-panel puzzle-panel">
            <h3>Puzzle</h3>
            <p>
              Puzzle - режим с загадками. Нужно понять описание, написать ответ одним словом и получить монеты за правильную разгадку.
            </p>
            <ul>
              <li>Есть три сложности: легко, средне и сложно.</li>
              <li>Загадки бывают про предметы, природу, идеи и скрытый смысл.</li>
              <li>Чем сложнее режим, тем больше нужно думать над формулировкой.</li>
            </ul>
          </article>

          <article className="intro-panel who-panel">
            <h3>Who am I?</h3>
            <p>
              Who am I? - это игра, где нужно угадать секретное слово через вопросы. Игра отвечает только
              “да” или “нет”, а ты постепенно сужаешь варианты.
            </p>
            <ul>
              <li>Задавай вопросы вроде: “это живое?”, “это можно есть?”, “это предмет?”.</li>
              <li>Когда появилась догадка, напиши ответ в поле ниже.</li>
              <li>Если застрял, можно открыть подсказку за монеты или рекламу.</li>
            </ul>
          </article>
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
