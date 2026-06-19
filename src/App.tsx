import { useEffect, useState } from 'react';
import { Auth } from './components/Auth';
import { ConnectionGame } from './components/ConnectionGame';
import { WordleGame } from './components/WordleGame';
import chestImage from './assets/chest.svg';
import { supabase, supabaseConfigError } from './lib/supabase';

const HINT_COST = 100;
const WIN_REWARD = 10;
const GIFT_INTERVAL = 5;
const GIFT_AMOUNTS = [40, 50, 60, 70];
const LOCAL_GUEST_NAME = 'Гость';
const LOCAL_GUEST_COINS_KEY = 'association_guest_coins';
const LOCAL_GUEST_SOLVED_KEY = 'association_guest_solved_words';

type GameMode = 'connection' | 'wordle';
type PlayerProfile = {
  user_id: string;
  nickname: string;
  coins: number;
  solved_words: number;
};

function isMissingSessionError(message: string) {
  return message.toLowerCase().includes('auth session missing');
}

function getRedirectUrl() {
  const origin = window.location.origin;

  if (origin.startsWith('http://') || origin.startsWith('https://')) {
    return origin;
  }

  return `https://${origin}`;
}

export default function App() {
  const [userId, setUserId] = useState('');
  const [nickname, setNickname] = useState('');
  const [coins, setCoins] = useState(0);
  const [solvedWords, setSolvedWords] = useState(0);
  const [giftOptions, setGiftOptions] = useState<number[] | null>(null);
  const [lastGiftCoins, setLastGiftCoins] = useState<number | null>(null);
  const [mode, setMode] = useState<GameMode>('connection');
  const [authScreenKey, setAuthScreenKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    void loadCurrentProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        return;
      }

      if (!session?.user) return;

      setLoading(true);
      setAuthError('');

      void ensureProfile(
        session.user.id,
        getNicknameFromUser(
          session.user.email,
          session.user.user_metadata?.full_name as string | undefined,
        ),
      )
        .then(() => {
          setGiftOptions(null);
          setLastGiftCoins(null);
          setIsGuest(false);
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Неизвестная ошибка Supabase.';
          console.error(message);
          setAuthError(
            message.includes('player_profiles')
              ? 'Не применены миграции Supabase. Нужно запустить npm run db:push.'
              : `Ошибка входа: ${message}`,
          );
        })
        .finally(() => {
          setLoading(false);
        });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  function getNicknameFromEmail(email: string) {
    return email.split('@')[0] || 'Игрок';
  }

  function getNicknameFromUser(email?: string, fullName?: string) {
    return fullName?.trim() || (email ? getNicknameFromEmail(email) : 'Игрок');
  }

  function loadLocalNumber(key: string) {
    const savedValue = Number(localStorage.getItem(key) ?? '0');
    return Number.isFinite(savedValue) ? savedValue : 0;
  }

  function saveLocalGuestPatch(patch: Partial<Pick<PlayerProfile, 'coins' | 'solved_words'>>) {
    if (patch.coins !== undefined) {
      localStorage.setItem(LOCAL_GUEST_COINS_KEY, String(patch.coins));
    }

    if (patch.solved_words !== undefined) {
      localStorage.setItem(LOCAL_GUEST_SOLVED_KEY, String(patch.solved_words));
    }
  }

  function startLocalGuestGame() {
    setUserId('');
    setNickname(LOCAL_GUEST_NAME);
    setCoins(loadLocalNumber(LOCAL_GUEST_COINS_KEY));
    setSolvedWords(loadLocalNumber(LOCAL_GUEST_SOLVED_KEY));
    setGiftOptions(null);
    setLastGiftCoins(null);
    setAuthError('');
    setIsGuest(true);
  }

  async function loadCurrentProfile() {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error(sessionError.message);

      if (!sessionData.session) return;

      const { data, error } = await supabase.auth.getUser();
      if (error) {
        if (isMissingSessionError(error.message)) return;
        throw new Error(error.message);
      }

      const currentUser = data.user;

      if (!currentUser) return;

      const profile = await loadProfile(currentUser.id);
      if (profile) {
        applyProfile(profile);
      } else {
        await ensureProfile(
          currentUser.id,
          getNicknameFromUser(
            currentUser.email,
            currentUser.user_metadata?.full_name as string | undefined,
          ),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка Supabase.';
      if (isMissingSessionError(message)) return;

      console.error(message);
      setAuthError(
        message.includes('player_profiles')
          ? 'Не применены миграции Supabase. Нужно запустить npm run db:push.'
          : `Ошибка входа: ${message}`,
      );
    } finally {
      setLoading(false);
    }
  }

  function applyProfile(profile: PlayerProfile) {
    setUserId(profile.user_id);
    setNickname(profile.nickname);
    setCoins(profile.coins);
    setSolvedWords(profile.solved_words);
    setIsGuest(false);
  }

  async function loadProfile(nextUserId: string) {
    const { data, error } = await supabase
      .from('player_profiles')
      .select('user_id, nickname, coins, solved_words')
      .eq('user_id', nextUserId)
      .maybeSingle();

    if (error) {
      console.error(error.message);
      return null;
    }

    return data as PlayerProfile | null;
  }

  async function saveProfilePatch(patch: Partial<Pick<PlayerProfile, 'coins' | 'nickname' | 'solved_words'>>) {
    if (!userId) return;

    const { error } = await supabase
      .from('player_profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error(error.message);
    }
  }

  async function ensureProfile(nextUserId: string, nextNickname: string) {
    const existingProfile = await loadProfile(nextUserId);

    if (existingProfile) {
      applyProfile(existingProfile);
      return;
    }

    const newProfile: PlayerProfile = {
      user_id: nextUserId,
      nickname: nextNickname,
      coins: 0,
      solved_words: 0,
    };
    const { error } = await supabase.from('player_profiles').insert(newProfile);

    if (error) {
      throw new Error(error.message);
    }

    applyProfile(newProfile);
  }

  async function startGame(email: string, password: string) {
    try {
      setAuthError('');
      const nextNickname = getNicknameFromEmail(email);
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInData.user) {
        await ensureProfile(signInData.user.id, nextNickname);
        setGiftOptions(null);
        setLastGiftCoins(null);
        setIsGuest(false);
        return '';
      }

      if (signInError && !signInError.message.toLowerCase().includes('invalid')) {
        return signInError.message;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        return signUpError.message.toLowerCase().includes('registered')
          ? 'Неверный пароль для этого mail.'
          : signUpError.message;
      }

      if (!signUpData.user) {
        return 'Не получилось создать игрока.';
      }

      if (!signUpData.session) {
        return 'Аккаунт создан. Проверь почту и потом войди с этим mail и паролем.';
      }

      await ensureProfile(signUpData.user.id, nextNickname);
      setGiftOptions(null);
      setLastGiftCoins(null);
      setIsGuest(false);
      return '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка Supabase.';
      return message.includes('player_profiles')
        ? 'Не применены миграции Supabase. Нужно запустить npm run db:push.'
        : `Ошибка входа: ${message}`;
    }
  }

  async function startGoogleGame() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectUrl(),
      },
    });

    if (error) {
      console.error(error.message);
      setAuthError('Google вход не сработал. Проверь, включен ли Google provider в Supabase Auth.');
    }
  }

  async function startGuestGame() {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error || !data.user) {
      console.error(error?.message ?? 'Не получилось войти гостем.');
      startLocalGuestGame();
      return;
    }

    try {
      setAuthError('');
      await ensureProfile(data.user.id, 'Гость');
      setGiftOptions(null);
      setLastGiftCoins(null);
      setIsGuest(false);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Неизвестная ошибка Supabase.');
      startLocalGuestGame();
    }
  }

  async function leaveGame() {
    if (!isGuest) {
      await supabase.auth.signOut();
    }
    setUserId('');
    setNickname('');
    setCoins(0);
    setSolvedWords(0);
    setGiftOptions(null);
    setLastGiftCoins(null);
    setMode('connection');
    setIsGuest(false);
    setAuthScreenKey((currentKey) => currentKey + 1);
  }

  function changeCoins(amount: number) {
    if (!nickname) return;

    setCoins((currentCoins) => {
      const nextCoins = Math.max(0, currentCoins + amount);
      if (isGuest) {
        saveLocalGuestPatch({ coins: nextCoins });
      } else {
        void saveProfilePatch({ coins: nextCoins });
      }
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
        if (isGuest) {
          saveLocalGuestPatch({ solved_words: 0 });
        } else {
          void saveProfilePatch({ solved_words: 0 });
        }
        setGiftOptions(createGiftOptions());
        setLastGiftCoins(null);
        return 0;
      }

      if (isGuest) {
        saveLocalGuestPatch({ solved_words: nextSolvedWords });
      } else {
        void saveProfilePatch({ solved_words: nextSolvedWords });
      }
      return nextSolvedWords;
    });
  }

  function chooseGift(amount: number) {
    changeCoins(amount);
    setGiftOptions(null);
    setLastGiftCoins(amount);
  }

  if (supabaseConfigError) {
    return (
      <main className="container">
        <section className="card lobby-card">
          <h1>Association Wordle</h1>
          <p className="message">{supabaseConfigError}</p>
          <p className="auth-subtitle">
            В Vercel открой Project Settings {'->'} Environment Variables и проверь переменные.
          </p>
        </section>
      </main>
    );
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
        <h1>Association Wordle</h1>
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
        <>
          <Auth
            key={authScreenKey}
            onGoogleStart={startGoogleGame}
            onGuestStart={startGuestGame}
            onStart={startGame}
          />
          {authError && <p className="message">{authError}</p>}
        </>
      ) : (
        <>
          <div className="mode-tabs" aria-label="Режим игры">
            <button
              className={mode === 'connection' ? 'mode-tab active' : 'mode-tab'}
              onClick={() => setMode('connection')}
              type="button"
            >
              Association
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
              isGuest={isGuest}
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
