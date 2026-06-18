import { useEffect, useState } from 'react';
import { Auth } from './components/Auth';
import { ConnectionGame } from './components/ConnectionGame';
import { WordleGame } from './components/WordleGame';
import chestImage from './assets/chest.svg';

const NICKNAME_KEY = 'connection_nickname';
const COINS_KEY_PREFIX = 'connection_coins';
const SOLVED_KEY_PREFIX = 'connection_solved_words';
const HINT_COST = 100;
const WIN_REWARD = 10;
const GIFT_INTERVAL = 5;
const GIFT_AMOUNTS = [40, 50, 60, 70];

type GameMode = 'connection' | 'wordle';

export default function App() {
  const [nickname, setNickname] = useState('');
  const [coins, setCoins] = useState(0);
  const [solvedWords, setSolvedWords] = useState(0);
  const [giftOptions, setGiftOptions] = useState<number[] | null>(null);
  const [lastGiftCoins, setLastGiftCoins] = useState<number | null>(null);
  const [mode, setMode] = useState<GameMode>('connection');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedNickname = localStorage.getItem(NICKNAME_KEY) ?? '';
    setNickname(savedNickname);
    setCoins(loadCoins(savedNickname));
    setSolvedWords(loadSolvedWords(savedNickname));
    setLoading(false);
  }, []);

  function startGame(nextNickname: string) {
    localStorage.setItem(NICKNAME_KEY, nextNickname);
    setNickname(nextNickname);
    setCoins(loadCoins(nextNickname));
    setSolvedWords(loadSolvedWords(nextNickname));
    setGiftOptions(null);
    setLastGiftCoins(null);
  }

  function leaveGame() {
    localStorage.removeItem(NICKNAME_KEY);
    setNickname('');
    setCoins(0);
    setSolvedWords(0);
    setGiftOptions(null);
    setLastGiftCoins(null);
    setMode('connection');
  }

  function getCoinsKey(playerName: string) {
    return `${COINS_KEY_PREFIX}_${playerName}`;
  }

  function getSolvedKey(playerName: string) {
    return `${SOLVED_KEY_PREFIX}_${playerName}`;
  }

  function loadCoins(playerName: string) {
    if (!playerName) return 0;

    const savedCoins = Number(localStorage.getItem(getCoinsKey(playerName)) ?? '0');
    return Number.isFinite(savedCoins) ? savedCoins : 0;
  }

  function loadSolvedWords(playerName: string) {
    if (!playerName) return 0;

    const savedSolvedWords = Number(localStorage.getItem(getSolvedKey(playerName)) ?? '0');
    return Number.isFinite(savedSolvedWords) ? savedSolvedWords : 0;
  }

  function changeCoins(amount: number) {
    if (!nickname) return;

    setCoins((currentCoins) => {
      const nextCoins = Math.max(0, currentCoins + amount);
      localStorage.setItem(getCoinsKey(nickname), String(nextCoins));
      return nextCoins;
    });
  }

  function spendCoins(amount: number) {
    if (coins < amount) return false;
    changeCoins(-amount);
    return true;
  }

  function createGiftOptions() {
    return [...GIFT_AMOUNTS].sort(() => Math.random() - 0.5);
  }

  function rewardSolvedWord() {
    if (!nickname) return;

    changeCoins(WIN_REWARD);

    setSolvedWords((currentSolvedWords) => {
      const nextSolvedWords = currentSolvedWords + 1;

      if (nextSolvedWords >= GIFT_INTERVAL) {
        localStorage.setItem(getSolvedKey(nickname), '0');
        setGiftOptions(createGiftOptions());
        setLastGiftCoins(null);
        return 0;
      }

      localStorage.setItem(getSolvedKey(nickname), String(nextSolvedWords));
      return nextSolvedWords;
    });
  }

  function chooseGift(amount: number) {
    changeCoins(amount);
    setGiftOptions(null);
    setLastGiftCoins(amount);
  }

  if (loading) {
    return (
      <main className="container">
        <p>Загрузка...</p>
      </main>
    );
  }

  return (
    <main className="container">
      <header className="header">
        <h1>Connection Wordle</h1>
        {nickname && (
          <div className="header-actions">
          <span className="coin-balance">
            {coins} монет
          </span>
          <span className="solved-counter">
            {solvedWords}/{GIFT_INTERVAL} слов
          </span>
          <button className="ghost" onClick={leaveGame}>
            Выйти
          </button>
          </div>
        )}
      </header>

      {!nickname ? (
        <Auth onStart={startGame} />
      ) : (
        <>
          <div className="mode-tabs" aria-label="Режим игры">
            <button
              className={mode === 'connection' ? 'mode-tab active' : 'mode-tab'}
              onClick={() => setMode('connection')}
              type="button"
            >
              Connection
            </button>
            <button
              className={mode === 'wordle' ? 'mode-tab active' : 'mode-tab'}
              onClick={() => setMode('wordle')}
              type="button"
            >
              Wordle
            </button>
          </div>

          {lastGiftCoins !== null && (
            <p className="gift-result">Из сундука выпало {lastGiftCoins} монет!</p>
          )}

          {mode === 'connection' ? (
            <ConnectionGame
              coins={coins}
              hintCost={HINT_COST}
              isGuest
              onReward={rewardSolvedWord}
              onSpendCoins={() => spendCoins(HINT_COST)}
              rewardCoins={WIN_REWARD}
              userEmail={nickname}
            />
          ) : (
            <WordleGame
              coins={coins}
              hintCost={HINT_COST}
              onReward={rewardSolvedWord}
              onSpendCoins={() => spendCoins(HINT_COST)}
              rewardCoins={WIN_REWARD}
              userEmail={nickname}
            />
          )}
        </>
      )}

      {giftOptions && (
        <div className="gift-overlay" role="dialog" aria-modal="true" aria-label="Подарок за 5 слов">
          <div className="gift-card">
            <span className="gift-kicker">Разгадано 5 слов</span>
            <h2>Выбери сундук</h2>
            <p>В сундуках спрятаны 40, 50, 60 или 70 монет. Можно открыть только один.</p>
            <div className="gift-grid">
              {giftOptions.map((amount, index) => (
                <button
                  className="gift-button"
                  key={`${amount}-${index}`}
                  onClick={() => chooseGift(amount)}
                  type="button"
                >
                  <img src={chestImage} alt="" />
                  <span>{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
