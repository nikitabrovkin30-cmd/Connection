import { useState } from 'react';
import type { FormEvent } from 'react';

type AuthProps = {
  onStart: (nickname: string) => void;
};

function normalizeNickname(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function Auth({ onStart }: AuthProps) {
  const [nickname, setNickname] = useState('');
  const [message, setMessage] = useState('');

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const nextNickname = normalizeNickname(nickname);

    if (nextNickname.length < 2) {
      setMessage('Напиши никнейм хотя бы из 2 символов.');
      return;
    }

    onStart(nextNickname);
  }

  return (
    <section className="card lobby-card">
      <div className="lobby-badges" aria-hidden="true">
        <span>звезда</span>
        <span>море</span>
        <span>книга</span>
      </div>

      <h2>Вход в игру</h2>
      <p className="auth-subtitle">Придумай никнейм и выбирай режим: ассоциации или Wordle.</p>

      <div className="lobby-preview" aria-hidden="true">
        <span>Connection</span>
        <span>Wordle</span>
      </div>

      <form onSubmit={handleSubmit} className="form">
        <input
          type="text"
          placeholder="твой никнейм"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setMessage('');
          }}
          maxLength={24}
          autoFocus
          required
        />
        <button type="submit">Играть</button>
      </form>

      {message && <p className="message">{message}</p>}
    </section>
  );
}
