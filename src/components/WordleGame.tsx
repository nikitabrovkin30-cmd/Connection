import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { SECRET_WORDS } from '../data/wordBank';
import { supabase } from '../lib/supabase';
import { AdModal } from './AdModal';

type WordLength = 4 | 5 | 6;
type TileStatus = 'correct' | 'present' | 'absent';
type LetterStatus = TileStatus | 'unused';
type GameStatus = 'playing' | 'won' | 'lost';

type GuessRow = {
  id: string;
  word: string;
  tiles: TileStatus[];
};

type SavedWordleState = {
  wordLength: WordLength;
  targetWord: string;
  guess: string;
  rows: GuessRow[];
  status: GameStatus;
  message: string;
  hintIndex: number | null;
};

type AiTextResponse = {
  text?: string;
};

type LearnedWordRow = {
  word: string;
  length: number;
};

type WordleGameProps = {
  coins: number;
  hintCost: number;
  onReward: () => void;
  onSpendCoins: () => boolean;
  rewardCoins: number;
  userEmail: string;
};

const MAX_ATTEMPTS = 6;
const WORDLE_STATE_PREFIX = 'wordle_game_state';
const WORDLE_VALIDATION_CACHE_PREFIX = 'wordle_ai_validation';
const RUSSIAN_ALPHABET = Array.from('абвгдежзийклмнопрстуфхцчшщъыьэюя');

const WORDS: Record<WordLength, string[]> = {
  4: [
    'море', 'игра', 'зима', 'лето', 'парк', 'река', 'луна', 'гора',
    'лист', 'мост', 'снег', 'стол', 'крот', 'волк', 'пень', 'поле',
    'хлеб', 'окно', 'рыба', 'каша', 'соль', 'день', 'ночь', 'свет',
    'тень', 'шкаф', 'стул', 'друг', 'врач', 'ключ', 'кран', 'метр',
    'язык', 'рука', 'нога', 'глаз', 'диск', 'кино', 'клей', 'клен',
    'бант', 'бобр', 'борт', 'брат', 'брус', 'бусы', 'ваза', 'веко', 'вкус', 'гимн',
    'град', 'гусь', 'дача', 'душа', 'жаба', 'знак', 'зонт', 'изба', 'кадр', 'каша',
    'кедр', 'клад', 'клуб', 'кожа', 'корм', 'край', 'круг', 'куст', 'лифт', 'лучи',
    'медь', 'нить', 'нора', 'парк', 'пена', 'пила', 'плот',
    'пруд', 'пыль', 'роль', 'сено', 'сила', 'такт', 'танк',
    'труд', 'утка', 'флаг', 'хлеб', 'храм', 'цель',
  ],
  5: [
    'школа', 'город', 'музей', 'театр', 'книга', 'поезд', 'океан', 'ветер',
    'сахар', 'лампа', 'зебра', 'робот', 'пирог', 'спорт', 'берег', 'песня',
    'кошка', 'ложка', 'чашка', 'ручка', 'дверь', 'доска', 'земля', 'трава',
    'адрес', 'автор', 'билет', 'вагон', 'вечер', 'голос', 'герой', 'груша',
    'дождь', 'закон', 'замок', 'камин', 'камыш', 'катер', 'ковер', 'маска',
    'месяц', 'мечта', 'мотор', 'палец', 'песок', 'рынок', 'салат', 'север',
    'сумка', 'топор', 'номер', 'ответ', 'пакет', 'парус', 'перец', 'сосна',
    'арбуз', 'банан', 'банка', 'башня', 'белка', 'бетон', 'билет', 'блеск', 'бочка', 'броня',
    'будка', 'вагон', 'ванна', 'весна', 'ветка', 'вишня', 'волна', 'ворон', 'выбор', 'гараж',
    'глина', 'голод', 'гонка', 'гость', 'грань', 'грязь', 'дверь', 'длина',
    'доска', 'драка', 'дымка', 'жажда', 'жизнь', 'забор', 'завод', 'закат',
    'залив', 'зверь', 'зерно', 'зубец', 'камин', 'камыш', 'карта', 'касса', 'каток',
    'киоск', 'класс', 'книга', 'козёл', 'конец', 'кошка', 'кулак', 'лаваш', 'линия',
    'лодка', 'маска', 'метро', 'место', 'мышка', 'народ', 'олень', 'орден',
  ],
  6: [
    'космос', 'дружба', 'музыка', 'камень', 'дорога', 'машина', 'огурец', 'ракета',
    'газета', 'комета', 'болото', 'солнце', 'дерево', 'дворец', 'кружка', 'письмо',
    'собака', 'молоко', 'облако', 'яблоко', 'банкир', 'бархат', 'беседа', 'бревно',
    'бумага', 'ворота', 'гвоздь', 'гитара', 'глобус', 'голубь', 'группа', 'дверца',
    'доктор', 'дракон', 'журнал', 'звонок', 'кактус', 'камера', 'карман', 'клетка',
    'колесо', 'корова', 'костер', 'краска', 'кресло', 'медаль', 'молния', 'одежда',
    'остров', 'пальто', 'платок', 'правда', 'работа', 'рюкзак', 'секрет', 'стакан',
    'страна', 'футбол', 'цветок', 'чайник', 'анкета', 'аптека', 'артист', 'балкон',
    'воздух', 'вокзал', 'голова', 'горшок', 'график', 'гранат', 'долина', 'добыча',
    'железо', 'желток', 'забота', 'задача', 'зелень', 'золото', 'кабина', 'кабель',
    'капкан', 'картон', 'кассир', 'костюм', 'куртка', 'ладонь', 'магнит', 'мебель',
    'металл', 'минута', 'монета', 'осадок', 'пещера', 'победа', 'погода', 'поднос',
    'порция', 'портал', 'посуда', 'пример', 'проект', 'размер', 'резина', 'родина',
    'рубаха', 'свечка', 'сигнал', 'сказка', 'стекло', 'сумрак', 'улыбка', 'фактор',
    'фигура', 'фонтан', 'хижина', 'чердак', 'чеснок', 'январь',
    'август', 'ананас', 'барьер', 'бензин',
    'бизнес', 'блюдце', 'борода', 'веерок', 'версия',
    'власть', 'восход', 'глоток', 'гнездо',
    'дворик', 'десерт', 'диалог', 'доклад', 'доспех', 'желток',
    'здание', 'золото', 'зрение', 'кабель',
    'карета', 'кирпич', 'кнопка', 'компас',
    'корень', 'краска', 'крышка', 'кувшин', 'лагерь', 'лебедь', 'лекция', 'лопата',
    'медуза', 'микроб', 'молния',
  ],
};

const wordValidationCache = new Map<string, boolean>();

const WORDLE_ALLOWED_WORDS: Record<WordLength, Set<string>> = {
  4: new Set([...WORDS[4], ...SECRET_WORDS.filter((word) => word.length === 4)]),
  5: new Set([...WORDS[5], ...SECRET_WORDS.filter((word) => word.length === 5)]),
  6: new Set([...WORDS[6], ...SECRET_WORDS.filter((word) => word.length === 6)]),
};

function normalizeWord(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function isPlausibleOfflineRussianWord(word: string, length: WordLength) {
  if (word.length !== length || !/^[а-я]+$/.test(word)) return false;

  const uniqueLetters = new Set(word);
  if (uniqueLetters.size === 1) return false;

  const vowels = word.match(/[аеёиоуыэюя]/g)?.length ?? 0;
  if (vowels === 0) return false;

  return true;
}

function getWordKey(word: string, length: WordLength) {
  return `${length}:${word}`;
}

function readCachedValidation(cacheKey: string) {
  const memoryValue = wordValidationCache.get(cacheKey);
  if (memoryValue !== undefined) return memoryValue;

  try {
    const savedValue = localStorage.getItem(`${WORDLE_VALIDATION_CACHE_PREFIX}_${cacheKey}`);
    if (savedValue === 'true' || savedValue === 'false') {
      const validation = savedValue === 'true';
      wordValidationCache.set(cacheKey, validation);
      return validation;
    }
  } catch {
    // If localStorage is blocked, in-memory cache still works.
  }

  return undefined;
}

function writeCachedValidation(cacheKey: string, validation: boolean) {
  wordValidationCache.set(cacheKey, validation);

  try {
    localStorage.setItem(`${WORDLE_VALIDATION_CACHE_PREFIX}_${cacheKey}`, String(validation));
  } catch {
    // If localStorage is blocked, in-memory cache still works.
  }
}

function getWordleStateKey(userEmail: string) {
  return `${WORDLE_STATE_PREFIX}_${userEmail}`;
}

function isWordLength(value: unknown): value is WordLength {
  return value === 4 || value === 5 || value === 6;
}

function isTileStatus(value: unknown): value is TileStatus {
  return value === 'correct' || value === 'present' || value === 'absent';
}

function isGameStatus(value: unknown): value is GameStatus {
  return value === 'playing' || value === 'won' || value === 'lost';
}

function loadWordleState(userEmail: string): SavedWordleState | null {
  const saved = localStorage.getItem(getWordleStateKey(userEmail));
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<SavedWordleState>;
    if (
      !isWordLength(parsed.wordLength) ||
      typeof parsed.targetWord !== 'string' ||
      parsed.targetWord.length !== parsed.wordLength ||
      !isGameStatus(parsed.status)
    ) {
      return null;
    }

    const rows = Array.isArray(parsed.rows)
      ? parsed.rows.filter((row): row is GuessRow => (
          typeof row.id === 'string' &&
          typeof row.word === 'string' &&
          row.word.length === parsed.wordLength &&
          Array.isArray(row.tiles) &&
          row.tiles.length === parsed.wordLength &&
          row.tiles.every(isTileStatus)
        ))
      : [];

    const hintIndex =
      typeof parsed.hintIndex === 'number' &&
      parsed.hintIndex >= 0 &&
      parsed.hintIndex < parsed.wordLength
        ? parsed.hintIndex
        : null;

    return {
      wordLength: parsed.wordLength,
      targetWord: parsed.targetWord,
      guess: typeof parsed.guess === 'string' ? parsed.guess.slice(0, parsed.wordLength) : '',
      rows,
      status: parsed.status,
      message: typeof parsed.message === 'string' ? parsed.message : '',
      hintIndex,
    };
  } catch {
    return null;
  }
}

function parseWordValidation(value: string) {
  const jsonMatch = value.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { valid?: unknown };
      if (typeof parsed.valid === 'boolean') return parsed.valid;
    } catch {
      // Gemini may answer with plain text; fall through to text parsing.
    }
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue.includes('true') || normalizedValue.includes('да')) return true;
  if (normalizedValue.includes('false') || normalizedValue.includes('нет')) return false;

  return null;
}

async function isRealRussianWord(word: string, length: WordLength) {
  const cacheKey = getWordKey(word, length);
  const cachedValue = readCachedValidation(cacheKey);
  if (cachedValue !== undefined) return cachedValue;

  const { data, error } = await supabase.functions.invoke<AiTextResponse>('ai', {
    body: {
      system:
        'Ты проверяешь слова для русской игры Wordle. Верни только JSON вида {"valid": true} или {"valid": false}. true только если это реально существующее русское слово в начальной форме или обычной словарной форме. Не принимай наборы букв, опечатки, имена людей, бренды, сокращения, английские слова и слова не той длины.',
      prompt: `Слово: "${word}". Длина должна быть ровно ${length} букв. Это существующее русское слово для Wordle?`,
      json: true,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const validation = parseWordValidation(data?.text ?? '');
  if (validation === null) {
    throw new Error('AI did not validate word');
  }

  writeCachedValidation(cacheKey, validation);
  if (validation) {
    void saveLearnedWord(word, length);
  }
  return validation;
}

async function loadLearnedWords() {
  const { data, error } = await supabase
    .from('wordle_learned_words')
    .select('word, length');

  if (error) {
    console.error(error.message);
    return new Set<string>();
  }

  const learnedWords = new Set<string>();

  (data as LearnedWordRow[] | null)?.forEach((item) => {
    if (isWordLength(item.length)) {
      learnedWords.add(getWordKey(normalizeWord(item.word), item.length));
    }
  });

  return learnedWords;
}

async function saveLearnedWord(word: string, length: WordLength) {
  const normalizedWord = normalizeWord(word);

  if (WORDLE_ALLOWED_WORDS[length].has(normalizedWord)) return;

  const { error } = await supabase
    .from('wordle_learned_words')
    .upsert(
      {
        word: normalizedWord,
        length,
      },
      {
        onConflict: 'word,length',
        ignoreDuplicates: true,
      },
    );

  if (error) {
    console.error(error.message);
  }
}

function isAllowedWord(word: string, length: WordLength, learnedWords: Set<string>) {
  return WORDLE_ALLOWED_WORDS[length].has(word) || learnedWords.has(getWordKey(word, length));
}

function pickWord(length: WordLength, currentWord?: string) {
  const knownWords = Array.from(WORDLE_ALLOWED_WORDS[length]);
  const options = knownWords.filter((word) => word !== currentWord);
  const words = options.length > 0 ? options : knownWords;
  return words[Math.floor(Math.random() * words.length)];
}

function scoreGuess(guess: string, answer: string): TileStatus[] {
  const result: TileStatus[] = Array.from({ length: answer.length }, () => 'absent');
  const remaining = new Map<string, number>();

  Array.from(answer).forEach((letter, index) => {
    if (guess[index] === letter) {
      result[index] = 'correct';
      return;
    }

    remaining.set(letter, (remaining.get(letter) ?? 0) + 1);
  });

  Array.from(guess).forEach((letter, index) => {
    if (result[index] === 'correct') return;

    const count = remaining.get(letter) ?? 0;
    if (count > 0) {
      result[index] = 'present';
      remaining.set(letter, count - 1);
    }
  });

  return result;
}

function getHintIndex(word: string, rows: GuessRow[]) {
  const openedIndexes = new Set<number>();

  rows.forEach((row) => {
    row.tiles.forEach((tile, index) => {
      if (tile === 'correct') {
        openedIndexes.add(index);
      }
    });
  });

  const indexesByPriority = Array.from({ length: word.length }, (_, index) => index).sort(
    (firstIndex, secondIndex) => {
      const middle = (word.length - 1) / 2;
      return Math.abs(firstIndex - middle) - Math.abs(secondIndex - middle);
    },
  );

  return indexesByPriority.find((index) => !openedIndexes.has(index)) ?? 0;
}

function getBetterLetterStatus(current: LetterStatus | undefined, next: TileStatus) {
  if (current === 'correct' || next === 'correct') return 'correct';
  if (current === 'present' || next === 'present') return 'present';
  return next;
}

export function WordleGame({
  coins,
  hintCost,
  onReward,
  onSpendCoins,
  rewardCoins,
  userEmail,
}: WordleGameProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const savedState = loadWordleState(userEmail);
  const [wordLength, setWordLength] = useState<WordLength>(() => savedState?.wordLength ?? 5);
  const [targetWord, setTargetWord] = useState(() => savedState?.targetWord ?? pickWord(5));
  const [guess, setGuess] = useState(() => savedState?.guess ?? '');
  const [rows, setRows] = useState<GuessRow[]>(() => savedState?.rows ?? []);
  const [status, setStatus] = useState<GameStatus>(() => savedState?.status ?? 'playing');
  const [message, setMessage] = useState(() => savedState?.message ?? '');
  const [hintIndex, setHintIndex] = useState<number | null>(() => savedState?.hintIndex ?? null);
  const [showAd, setShowAd] = useState(false);
  const [checkingWord, setCheckingWord] = useState(false);
  const [learnedWords, setLearnedWords] = useState<Set<string>>(() => new Set());

  const emptyRows = useMemo(
    () => Array.from({ length: Math.max(0, MAX_ATTEMPTS - rows.length) }),
    [rows.length],
  );

  const letterStatuses = useMemo(() => {
    const statuses: Partial<Record<string, LetterStatus>> = {};

    rows.forEach((row) => {
      Array.from(row.word).forEach((letter, index) => {
        statuses[letter] = getBetterLetterStatus(statuses[letter], row.tiles[index]);
      });
    });

    return statuses;
  }, [rows]);

  function focusBoard() {
    boardRef.current?.focus();
    mobileInputRef.current?.focus();
  }

  useEffect(() => {
    localStorage.setItem(
      getWordleStateKey(userEmail),
      JSON.stringify({
        wordLength,
        targetWord,
        guess,
        rows,
        status,
        message,
        hintIndex,
      } satisfies SavedWordleState),
    );
  }, [guess, hintIndex, message, rows, status, targetWord, userEmail, wordLength]);

  useEffect(() => {
    let active = true;

    void loadLearnedWords().then((nextLearnedWords) => {
      if (active) {
        setLearnedWords(nextLearnedWords);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  function resetGame(nextLength = wordLength) {
    setWordLength(nextLength);
    setTargetWord((currentWord) => pickWord(nextLength, currentWord));
    setGuess('');
    setRows([]);
    setStatus('playing');
    setMessage('');
    setHintIndex(null);
    setShowAd(false);
    window.setTimeout(focusBoard, 0);
  }

  function openAdForHint() {
    if (status !== 'playing' || hintIndex !== null) return;
    setShowAd(true);
  }

  function closeAdAndRevealHint() {
    const nextHintIndex = getHintIndex(targetWord, rows);
    setHintIndex(nextHintIndex);
    setShowAd(false);
    setMessage(
      `Реклама просмотрена. Подсказка: буква ${nextHintIndex + 1} - "${targetWord[nextHintIndex]}".`,
    );
    window.setTimeout(focusBoard, 0);
  }

  function buyHint() {
    if (status !== 'playing' || hintIndex !== null) return;

    if (!onSpendCoins()) {
      setMessage(`Нужно ${hintCost} монет для подсказки.`);
      window.setTimeout(focusBoard, 0);
      return;
    }

    const nextHintIndex = getHintIndex(targetWord, rows);
    setHintIndex(nextHintIndex);
    setMessage(`Подсказка куплена за ${hintCost} монет: буква ${nextHintIndex + 1} - "${targetWord[nextHintIndex]}".`);
    window.setTimeout(focusBoard, 0);
  }

  async function submitCurrentGuess() {
    const normalizedGuess = normalizeWord(guess);
    if (status !== 'playing' || checkingWord) return;

    if (normalizedGuess.length !== wordLength) {
      setMessage(`Нужно слово из ${wordLength} букв.`);
      focusBoard();
      return;
    }

    setCheckingWord(true);
    setMessage('Проверяем слово...');

    try {
      const validWord =
        isAllowedWord(normalizedGuess, wordLength, learnedWords) ||
        (await isRealRussianWord(normalizedGuess, wordLength));

      if (!validWord) {
        setMessage('Такого слова нет в словаре игры. Попробуй другое.');
        focusBoard();
        return;
      }

      if (!WORDLE_ALLOWED_WORDS[wordLength].has(normalizedGuess)) {
        const wordKey = getWordKey(normalizedGuess, wordLength);
        setLearnedWords((currentLearnedWords) => new Set(currentLearnedWords).add(wordKey));
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Не получилось проверить слово через ИИ.');
      const validOfflineWord =
        isAllowedWord(normalizedGuess, wordLength, learnedWords) ||
        isPlausibleOfflineRussianWord(normalizedGuess, wordLength);

      if (!validOfflineWord) {
        setMessage('ИИ недоступен, а такого слова нет в локальном словаре игры.');
        focusBoard();
        return;
      }

      if (!WORDLE_ALLOWED_WORDS[wordLength].has(normalizedGuess)) {
        const wordKey = getWordKey(normalizedGuess, wordLength);
        setLearnedWords((currentLearnedWords) => new Set(currentLearnedWords).add(wordKey));
      }
    } finally {
      setCheckingWord(false);
    }

    const nextRow: GuessRow = {
      id: `${rows.length}-${normalizedGuess}`,
      word: normalizedGuess,
      tiles: scoreGuess(normalizedGuess, targetWord),
    };
    const nextRows = [...rows, nextRow];

    setRows(nextRows);
    setGuess('');

    if (normalizedGuess === targetWord) {
      setStatus('won');
      onReward();
      setMessage(`Победа! Слово: ${targetWord}. +${rewardCoins} монет.`);
      return;
    }

    if (nextRows.length === MAX_ATTEMPTS) {
      setStatus('lost');
      setMessage(`Попытки закончились. Слово было: ${targetWord}.`);
      return;
    }

    setMessage('');
    window.setTimeout(focusBoard, 0);
  }

  function submitGuess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void submitCurrentGuess();
  }

  function handleBoardKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (status !== 'playing' || checkingWord) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      void submitCurrentGuess();
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      removeLetter();
      return;
    }

    const letter = normalizeWord(e.key).replace(/[^а-я]/g, '');
    if (letter.length === 1 && guess.length < wordLength) {
      e.preventDefault();
      addLetter(letter);
      setMessage('');
    }
  }

  function handleMobileInputChange(value: string) {
    if (status !== 'playing' || checkingWord) return;

    const letters = normalizeWord(value).replace(/[^а-я]/g, '').slice(0, wordLength);
    setGuess(letters);
    setMessage('');
  }

  function addLetter(letter: string) {
    if (status !== 'playing' || checkingWord) return;

    setGuess((current) => {
      if (current.length >= wordLength) return current;
      return `${current}${letter}`;
    });
    setMessage('');
    window.setTimeout(focusBoard, 0);
  }

  function removeLetter() {
    if (status !== 'playing' || checkingWord) return;

    setGuess((current) => current.slice(0, -1));
    setMessage('');
    window.setTimeout(focusBoard, 0);
  }

  return (
    <section className="wordle-shell">
      <div className="game-card">
        <p className="hello">Игрок: {userEmail}</p>
        <h2>Wordle</h2>
        <p className="game-subtitle">
          Кликни по таблице и печатай буквы прямо в неё. Enter проверяет слово,
          Backspace стирает букву.
        </p>

        <p className="currency-note">
          Баланс: {coins} монет. Победа дает {rewardCoins}, подсказка стоит {hintCost}.
        </p>

        <div className="wordle-modes" aria-label="Длина слова">
          {([4, 5, 6] as const).map((length) => (
            <button
              className={wordLength === length ? 'mode-button active' : 'mode-button'}
              key={length}
              onClick={() => resetGame(length)}
              type="button"
            >
              {length} {length === 4 ? 'буквы' : 'букв'}
            </button>
          ))}
        </div>

        <form className="wordle-form" onSubmit={submitGuess}>
          <div
            aria-label="Поле ввода Wordle"
            className="wordle-board-button"
            onClick={focusBoard}
            onKeyDown={handleBoardKeyDown}
            ref={boardRef}
            role="textbox"
            tabIndex={0}
          >
            <input
              aria-label="Ввод слова Wordle"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className="wordle-mobile-input"
              disabled={status !== 'playing' || checkingWord}
              inputMode="text"
              maxLength={wordLength}
              onChange={(e) => handleMobileInputChange(e.target.value)}
              ref={mobileInputRef}
              spellCheck={false}
              type="text"
              value={guess}
            />
            <span className="wordle-board">
              {rows.map((row) => (
                <span className="wordle-row" key={row.id}>
                  {Array.from(row.word).map((letter, index) => (
                    <span className={`wordle-tile ${row.tiles[index]}`} key={`${row.id}-${index}`}>
                      {letter}
                    </span>
                  ))}
                </span>
              ))}

              {emptyRows.map((_, rowIndex) => (
                <span className="wordle-row" key={`empty-${rowIndex}`}>
                  {Array.from({ length: wordLength }).map((__, index) => {
                    const isActiveRow = rowIndex === 0 && status === 'playing';
                    const typedLetter = isActiveRow ? guess[index] ?? '' : '';
                    const hintLetter =
                      isActiveRow && hintIndex === index && !typedLetter ? targetWord[index] : '';

                    return (
                      <span
                        className={hintLetter ? 'wordle-tile hint' : 'wordle-tile empty'}
                        key={index}
                      >
                        {typedLetter || hintLetter}
                      </span>
                    );
                  })}
                </span>
              ))}
            </span>
          </div>

          <div className="letter-board" aria-label="Список букв">
            {RUSSIAN_ALPHABET.map((letter) => {
              const letterStatus = letterStatuses[letter] ?? 'unused';

              return (
                <button
                  className={`letter-key ${letterStatus}`}
                  disabled={status !== 'playing' || checkingWord}
                  key={letter}
                  onClick={() => addLetter(letter)}
                  type="button"
                >
                  {letter}
                </button>
              );
            })}
          </div>

          <div className="wordle-actions">
            <button
              className="soft-button"
              disabled={status !== 'playing' || checkingWord || guess.length === 0}
              onClick={removeLetter}
              type="button"
            >
              Стереть
            </button>
            <button disabled={status !== 'playing' || checkingWord} type="submit">
              {checkingWord ? 'Проверяем...' : 'Проверить'}
            </button>
            <button
              className="soft-button"
              disabled={status !== 'playing' || hintIndex !== null || coins < hintCost || checkingWord}
              onClick={buyHint}
              type="button"
            >
              Подсказка за {hintCost} монет
            </button>
            <button
              className="ad-button"
              disabled={status !== 'playing' || hintIndex !== null || showAd || checkingWord}
              onClick={openAdForHint}
              type="button"
            >
              Смотреть рекламу за подсказку
            </button>
          </div>
        </form>

        {message && (
          <p className={status === 'won' ? 'success-message' : 'message'}>{message}</p>
        )}

        {status !== 'playing' && (
          <>
            <div className={status === 'won' ? 'answer-reveal solved' : 'answer-reveal gave-up'}>
              <span>{status === 'won' ? 'Правильное слово' : 'Слово было'}</span>
              <strong>{targetWord}</strong>
            </div>
            <button className="next-button" onClick={() => resetGame()} type="button">
              Новое слово
            </button>
          </>
        )}
      </div>

      {showAd && <AdModal onClose={closeAdAndRevealHint} />}
    </section>
  );
}
