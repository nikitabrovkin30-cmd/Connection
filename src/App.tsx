import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Auth } from './components/Auth';
import { ConnectionGame } from './components/ConnectionGame';
import { PuzzleGame } from './components/PuzzleGame';
import { WhoAmIGame } from './components/WhoAmIGame';
import { WordleGame } from './components/WordleGame';
import chestImage from './assets/chest.svg';
import backgroundMusicSrc from './music/ludovico-einaudi.mp3';
import { ASSOCIATION_CATEGORIES } from './data/wordBank';
import type { AssociationCategoryId } from './data/wordBank';
import { supabase, supabaseConfigError } from './lib/supabase';

const HINT_COST = 100;
const WIN_REWARD = 10;
const REGISTRATION_BONUS_COINS = 50;
const GIFT_INTERVAL = 5;
const GIFT_AMOUNTS = [40, 50, 60, 70];
const LOCAL_GUEST_NAME = 'Гость';
const LOCAL_GUEST_COINS_KEY = 'association_guest_coins';
const LOCAL_GUEST_SOLVED_KEY = 'association_guest_solved_words';
const LOCAL_GAME_MODE_KEY = 'association_game_mode';
const LOCAL_ASSOCIATION_CATEGORY_KEY = 'association_category';
const LOCAL_MUSIC_ENABLED_KEY = 'association_music_enabled';
const LOCAL_UI_LANGUAGE_KEY = 'word_games_hub_ui_language';
const BACKGROUND_MUSIC_SRC = backgroundMusicSrc;
const PRODUCTION_APP_URL = 'https://connection-cyan.vercel.app';
const ASSOCIATION_CATEGORY_STICKERS: Record<AssociationCategoryId, string> = {
  all: '🎲',
  природа: '🌿',
  еда: '🍔',
  место: '🏠',
  предмет: '🎒',
  материал: '🧱',
  человек: '🧑',
};

type GameMode = 'connection' | 'wordle' | 'puzzle' | 'who';
type UiLanguage = 'ru' | 'kk' | 'en';
type PlayerProfile = {
  user_id: string;
  nickname: string;
  coins: number;
  solved_words: number;
  is_admin: boolean;
};

const UI_LANGUAGES: readonly { id: UiLanguage; title: string }[] = [
  { id: 'ru', title: 'RU' },
  { id: 'kk', title: 'KZ' },
  { id: 'en', title: 'EN' },
];

const UI_TEXT: Record<UiLanguage, {
  loading: string;
  coins: string;
  words: string;
  exit: string;
  gameModeLabel: string;
  addReview: string;
  hideReviews: string;
  readReviews: string;
  reviewPlaceholder: string;
  sendingReview: string;
  sendReview: string;
  noReviews: string;
  noEmail: string;
  categoryLabel: string;
  giftLabel: string;
  giftKicker: string;
  chooseChest: string;
  giftDescription: string;
  rewardLabel: string;
  close: string;
  chestOpened: string;
  youGot: string;
}> = {
  ru: {
    loading: 'Загрузка...',
    coins: 'монет',
    words: 'слов',
    exit: 'Выйти',
    gameModeLabel: 'Режим игры',
    addReview: 'Добавить отзыв',
    hideReviews: 'Скрыть отзывы',
    readReviews: 'Читать отзывы',
    reviewPlaceholder: 'Напиши отзыв...',
    sendingReview: 'Отправляем...',
    sendReview: 'Отправить отзыв',
    noReviews: 'Отзывов пока нет.',
    noEmail: 'Без почты',
    categoryLabel: 'Категория слов',
    giftLabel: 'Подарок за 5 слов',
    giftKicker: 'Разгадано 5 слов',
    chooseChest: 'Выбери сундук',
    giftDescription: 'В сундуках спрятаны 40, 50, 60 или 70 монет. Можно открыть только один.',
    rewardLabel: 'Награда из сундука',
    close: 'Закрыть',
    chestOpened: 'Сундук открыт',
    youGot: 'Тебе выпало',
  },
  kk: {
    loading: 'Жүктелуде...',
    coins: 'монета',
    words: 'сөз',
    exit: 'Шығу',
    gameModeLabel: 'Ойын режимі',
    addReview: 'Пікір қосу',
    hideReviews: 'Пікірлерді жасыру',
    readReviews: 'Пікірлерді оқу',
    reviewPlaceholder: 'Пікір жаз...',
    sendingReview: 'Жіберілуде...',
    sendReview: 'Пікір жіберу',
    noReviews: 'Әзірге пікір жоқ.',
    noEmail: 'Пошта жоқ',
    categoryLabel: 'Сөз санаты',
    giftLabel: '5 сөз үшін сыйлық',
    giftKicker: '5 сөз шешілді',
    chooseChest: 'Сандық таңда',
    giftDescription: 'Сандықтарда 40, 50, 60 немесе 70 монета бар. Тек біреуін ашуға болады.',
    rewardLabel: 'Сандықтан сыйлық',
    close: 'Жабу',
    chestOpened: 'Сандық ашылды',
    youGot: 'Саған түсті',
  },
  en: {
    loading: 'Loading...',
    coins: 'coins',
    words: 'words',
    exit: 'Exit',
    gameModeLabel: 'Game mode',
    addReview: 'Add review',
    hideReviews: 'Hide reviews',
    readReviews: 'Read reviews',
    reviewPlaceholder: 'Write a review...',
    sendingReview: 'Sending...',
    sendReview: 'Send review',
    noReviews: 'No reviews yet.',
    noEmail: 'No email',
    categoryLabel: 'Word category',
    giftLabel: 'Gift for 5 words',
    giftKicker: '5 words solved',
    chooseChest: 'Choose a chest',
    giftDescription: 'The chests hide 40, 50, 60 or 70 coins. You can open only one.',
    rewardLabel: 'Chest reward',
    close: 'Close',
    chestOpened: 'Chest opened',
    youGot: 'You got',
  },
};

const CATEGORY_TITLES: Record<UiLanguage, Partial<Record<AssociationCategoryId, string>>> = {
  ru: {},
  kk: {
    all: 'Барлық санаттар',
    природа: 'Табиғат',
    еда: 'Тамақ',
    место: 'Орын',
    предмет: 'Зат',
    материал: 'Материал және техника',
    человек: 'Адам және өмір',
  },
  en: {
    all: 'All categories',
    природа: 'Nature',
    еда: 'Food',
    место: 'Place',
    предмет: 'Object',
    материал: 'Material and tech',
    человек: 'People and life',
  },
};

type Review = {
  id: string;
  author_email: string | null;
  body: string;
  created_at: string;
};

function isMissingSessionError(message: string) {
  return message.toLowerCase().includes('auth session missing');
}

function loadSavedMode(): GameMode {
  const savedMode = localStorage.getItem(LOCAL_GAME_MODE_KEY);
  if (savedMode === 'who') return 'who';
  if (savedMode === 'puzzle') return 'puzzle';
  return savedMode === 'wordle' ? 'wordle' : 'connection';
}

function loadSavedAssociationCategory(): AssociationCategoryId {
  const savedCategory = localStorage.getItem(LOCAL_ASSOCIATION_CATEGORY_KEY);
  return ASSOCIATION_CATEGORIES.some((category) => category.id === savedCategory)
    ? (savedCategory as AssociationCategoryId)
    : 'all';
}

function loadSavedMusicEnabled() {
  return localStorage.getItem(LOCAL_MUSIC_ENABLED_KEY) === 'true';
}

function loadSavedUiLanguage(): UiLanguage {
  const savedLanguage = localStorage.getItem(LOCAL_UI_LANGUAGE_KEY);
  return savedLanguage === 'kk' || savedLanguage === 'en' ? savedLanguage : 'ru';
}

function getRedirectUrl() {
  const origin = window.location.origin;

  if (origin.includes('localhost')) {
    return origin;
  }

  if (origin.includes('connection-cyan.vercel.app')) {
    return PRODUCTION_APP_URL;
  }

  if (origin.includes('vercel.app')) {
    return PRODUCTION_APP_URL;
  }

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
  const [mode, setMode] = useState<GameMode>(() => loadSavedMode());
  const [associationCategory, setAssociationCategory] = useState<AssociationCategoryId>(
    () => loadSavedAssociationCategory(),
  );
  const [authScreenKey, setAuthScreenKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(() => loadSavedMusicEnabled());
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(() => loadSavedUiLanguage());
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const text = UI_TEXT[uiLanguage];

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

  useEffect(() => {
    localStorage.setItem(LOCAL_GAME_MODE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem(LOCAL_ASSOCIATION_CATEGORY_KEY, associationCategory);
  }, [associationCategory]);

  useEffect(() => {
    localStorage.setItem(LOCAL_MUSIC_ENABLED_KEY, String(musicEnabled));

    const music = musicRef.current;
    if (!music) return;

    if (!musicEnabled) {
      music.pause();
      return;
    }

    music.volume = 0.35;
    music.muted = false;
    void music.play().catch((error: unknown) => {
      console.warn('Music did not start. Press the music button again.', error);
    });
  }, [musicEnabled]);

  useEffect(() => {
    localStorage.setItem(LOCAL_UI_LANGUAGE_KEY, uiLanguage);
    document.documentElement.lang = uiLanguage === 'kk' ? 'kk' : uiLanguage === 'en' ? 'en' : 'ru';
  }, [uiLanguage]);

  function toggleMusic() {
    setMusicEnabled((enabled) => !enabled);
  }

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
    setIsAdmin(profile.is_admin);
    setIsGuest(false);
  }

  async function loadProfile(nextUserId: string) {
    const { data, error } = await supabase
      .from('player_profiles')
      .select('user_id, nickname, coins, solved_words, is_admin')
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

  async function loadReviews() {
    if (!isAdmin) return;

    setReviewsError('');
    const { data, error } = await supabase
      .from('reviews')
      .select('id, author_email, body, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      setReviewsError(error.message.includes('reviews')
        ? 'Отзывы еще не включены в Supabase. Нужно запустить npm run db:push.'
        : error.message);
      return;
    }

    setReviews((data as Review[] | null) ?? []);
  }

  async function submitReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const nextReview = reviewText.trim();
    if (nextReview.length < 3) {
      setReviewMessage('Напиши отзыв чуть подробнее.');
      return;
    }

    setReviewBusy(true);
    setReviewMessage('');

    const { error } = await supabase.from('reviews').insert({
      author_email: nickname,
      body: nextReview,
      user_id: userId || null,
    });

    setReviewBusy(false);

    if (error) {
      setReviewMessage(error.message.includes('reviews')
        ? 'Отзывы еще не включены в Supabase. Нужно запустить npm run db:push.'
        : `Не получилось отправить отзыв: ${error.message}`);
      return;
    }

    setReviewText('');
    setShowReviewForm(false);
    setReviewMessage('Спасибо! Отзыв отправлен.');

    if (isAdmin && reviewsOpen) {
      void loadReviews();
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
      coins: REGISTRATION_BONUS_COINS,
      solved_words: 0,
      is_admin: nextNickname.trim().toLowerCase() === 'nikita brovkin',
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
    setIsAdmin(false);
    setReviews([]);
    setReviewsOpen(false);
    setReviewsError('');
    setShowReviewForm(false);
    setReviewText('');
    setReviewMessage('');
    setReviewBusy(false);
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

  function closeGiftResult() {
    setLastGiftCoins(null);
  }

  if (supabaseConfigError) {
    return (
      <main className="container">
        <section className="card lobby-card">
          <h1>WORD GAMES HUB</h1>
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
        <p>{text.loading}</p>
      </main>
    );
  }

  return (
    <main className="container">
      <audio ref={musicRef} loop preload="auto" src={BACKGROUND_MUSIC_SRC} />
      <div className="top-controls">
        <div className="language-toggle" aria-label="Language">
          {UI_LANGUAGES.map((language) => (
            <button
              className={uiLanguage === language.id ? 'active' : ''}
              key={language.id}
              onClick={() => setUiLanguage(language.id)}
              type="button"
            >
              {language.title}
            </button>
          ))}
        </div>
        <button
          aria-label={musicEnabled ? 'Выключить музыку' : 'Включить музыку'}
          className={musicEnabled ? 'music-toggle active' : 'music-toggle'}
          onClick={toggleMusic}
          type="button"
        >
          {musicEnabled ? '♫ ON' : '♫ OFF'}
        </button>
      </div>
      <header className="header">
        <h1>WORD GAMES HUB</h1>
        {nickname && (
          <div className="header-actions">
          <span className="coin-balance">
            {coins} {text.coins}
          </span>
          <span className="solved-counter">
            {solvedWords}/{GIFT_INTERVAL} {text.words}
          </span>
          <button className="ghost" onClick={leaveGame}>
            {text.exit}
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
            uiLanguage={uiLanguage}
          />
          {authError && <p className="message">{authError}</p>}
        </>
      ) : (
        <>
          <div className="mode-tabs" aria-label={text.gameModeLabel}>
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
            <button
              className={mode === 'puzzle' ? 'mode-tab active' : 'mode-tab'}
              onClick={() => setMode('puzzle')}
              type="button"
            >
              Puzzle
            </button>
            <button
              className={mode === 'who' ? 'mode-tab active' : 'mode-tab'}
              onClick={() => setMode('who')}
              type="button"
            >
              Who am I?
            </button>
          </div>

          <section className="feedback-panel">
            <div className="feedback-actions">
              <button
                className="review-button"
                disabled={reviewBusy}
                onClick={() => {
                  setShowReviewForm((current) => !current);
                  setReviewMessage('');
                }}
                type="button"
              >
                {text.addReview}
              </button>

              {isAdmin && (
                <button
                  className="admin-toggle"
                  onClick={() => {
                    const nextOpen = !reviewsOpen;
                    setReviewsOpen(nextOpen);
                    if (nextOpen) {
                      void loadReviews();
                    }
                  }}
                  type="button"
                >
                  {reviewsOpen ? text.hideReviews : text.readReviews}
                </button>
              )}
            </div>

            {showReviewForm && (
              <form className="review-form" onSubmit={submitReview}>
                <textarea
                  disabled={reviewBusy}
                  onChange={(e) => {
                    setReviewText(e.target.value);
                    setReviewMessage('');
                  }}
                  placeholder={text.reviewPlaceholder}
                  rows={4}
                  value={reviewText}
                />
                <button disabled={reviewBusy} type="submit">
                  {reviewBusy ? text.sendingReview : text.sendReview}
                </button>
              </form>
            )}

            {reviewMessage && <p className="message">{reviewMessage}</p>}
          </section>

          {isAdmin && reviewsOpen && (
            <section className="admin-panel">
              <div className="reviews-list">
                {reviewsError && <p className="message">{reviewsError}</p>}
                {!reviewsError && reviews.length === 0 && <p>{text.noReviews}</p>}
                {reviews.map((review) => (
                  <article className="review-item" key={review.id}>
                    <strong>{review.author_email || text.noEmail}</strong>
                    <span>{new Date(review.created_at).toLocaleString(uiLanguage === 'en' ? 'en-US' : uiLanguage === 'kk' ? 'kk-KZ' : 'ru-RU')}</span>
                    <p>{review.body}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {mode === 'connection' && (
            <div className="category-tabs" aria-label={text.categoryLabel}>
              {ASSOCIATION_CATEGORIES.map((category) => (
                <button
                  className={associationCategory === category.id ? 'category-tab active' : 'category-tab'}
                  key={category.id}
                  onClick={() => setAssociationCategory(category.id)}
                  title={category.description}
                  type="button"
                >
                  <span className="category-sticker" aria-hidden="true">
                    {ASSOCIATION_CATEGORY_STICKERS[category.id]}
                  </span>
                  <span>{CATEGORY_TITLES[uiLanguage][category.id] ?? category.title}</span>
                </button>
              ))}
            </div>
          )}

          {mode === 'connection' && (
            <ConnectionGame
              categoryId={associationCategory}
              coins={coins}
              hintCost={HINT_COST}
              isGuest={isGuest}
              key={`association-${uiLanguage}-${associationCategory}`}
              onReward={rewardSolvedWord}
              onSpendCoins={() => spendCoins(HINT_COST)}
              rewardCoins={WIN_REWARD}
              uiLanguage={uiLanguage}
              userEmail={nickname}
            />
          )}

          {mode === 'wordle' && (
            <WordleGame
              coins={coins}
              hintCost={HINT_COST}
              onReward={rewardSolvedWord}
              onSpendCoins={() => spendCoins(HINT_COST)}
              rewardCoins={WIN_REWARD}
              uiLanguage={uiLanguage}
              userEmail={nickname}
              key={`wordle-${uiLanguage}`}
            />
          )}

          {mode === 'puzzle' && (
            <PuzzleGame
              coins={coins}
              hintCost={HINT_COST}
              onReward={rewardSolvedWord}
              onSpendCoins={() => spendCoins(HINT_COST)}
              rewardCoins={WIN_REWARD}
              uiLanguage={uiLanguage}
              userEmail={nickname}
              key={`puzzle-${uiLanguage}`}
            />
          )}

          {mode === 'who' && (
            <WhoAmIGame
              coins={coins}
              hintCost={HINT_COST}
              onReward={rewardSolvedWord}
              onSpendCoins={() => spendCoins(HINT_COST)}
              rewardCoins={WIN_REWARD}
              uiLanguage={uiLanguage}
              userEmail={nickname}
              key={`who-${uiLanguage}`}
            />
          )}
        </>
      )}

      {giftOptions && (
        <div className="gift-overlay" role="dialog" aria-modal="true" aria-label={text.giftLabel}>
          <div className="gift-card">
            <span className="gift-kicker">{text.giftKicker}</span>
            <h2>{text.chooseChest}</h2>
            <p>{text.giftDescription}</p>
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

      {lastGiftCoins !== null && (
        <div className="gift-overlay" role="dialog" aria-modal="true" aria-label={text.rewardLabel}>
          <div className="gift-card gift-result-card">
            <button
              aria-label={text.close}
              className="gift-close-button"
              onClick={closeGiftResult}
              type="button"
            >
              ×
            </button>
            <span className="gift-kicker">{text.chestOpened}</span>
            <h2>{text.youGot}</h2>
            <strong>{lastGiftCoins}</strong>
            <p>{text.coins}</p>
          </div>
        </div>
      )}
    </main>
  );
}
