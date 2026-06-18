import { useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
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

type WordleGameProps = {
  coins: number;
  hintCost: number;
  onReward: () => void;
  onSpendCoins: () => boolean;
  rewardCoins: number;
  userEmail: string;
};

const MAX_ATTEMPTS = 6;
const RUSSIAN_ALPHABET = Array.from('абвгдежзийклмнопрстуфхцчшщъыьэюя');

const WORDS: Record<WordLength, string[]> = {
  4: [
    'море', 'игра', 'зима', 'лето', 'парк', 'река', 'луна', 'гора',
    'лист', 'мост', 'снег', 'стол', 'крот', 'волк', 'пень', 'поле',
    'хлеб', 'окно', 'рыба', 'каша', 'соль', 'день', 'ночь', 'свет',
    'тень', 'шкаф', 'стул', 'друг', 'врач', 'ключ', 'кран', 'метр',
    'язык', 'рука', 'нога', 'глаз', 'диск', 'кино', 'клей', 'клен',
  ],
  5: [
    'школа', 'город', 'музей', 'театр', 'книга', 'поезд', 'океан', 'ветер',
    'сахар', 'лампа', 'зебра', 'робот', 'пирог', 'спорт', 'берег', 'песня',
    'кошка', 'ложка', 'чашка', 'ручка', 'дверь', 'доска', 'земля', 'трава',
    'адрес', 'автор', 'билет', 'вагон', 'вечер', 'голос', 'герой', 'груша',
    'дождь', 'закон', 'замок', 'камин', 'камыш', 'катер', 'ковер', 'маска',
    'месяц', 'мечта', 'мотор', 'палец', 'песок', 'рынок', 'салат', 'север',
    'сумка', 'топор', 'номер', 'ответ', 'пакет', 'парус', 'перец', 'сосна',
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
  ],
};

const WORDLE_ALLOWED_WORDS: Record<WordLength, Set<string>> = {
  4: new Set(WORDS[4]),
  5: new Set(WORDS[5]),
  6: new Set(WORDS[6]),
};

function normalizeWord(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function pickWord(length: WordLength, currentWord?: string) {
  const options = WORDS[length].filter((word) => word !== currentWord);
  const words = options.length > 0 ? options : WORDS[length];
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
  const [wordLength, setWordLength] = useState<WordLength>(5);
  const [targetWord, setTargetWord] = useState(() => pickWord(5));
  const [guess, setGuess] = useState('');
  const [rows, setRows] = useState<GuessRow[]>([]);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [message, setMessage] = useState('');
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [showAd, setShowAd] = useState(false);

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
  }

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

  function submitCurrentGuess() {
    const normalizedGuess = normalizeWord(guess);
    if (status !== 'playing') return;

    if (normalizedGuess.length !== wordLength) {
      setMessage(`Нужно слово из ${wordLength} букв.`);
      focusBoard();
      return;
    }

    if (!WORDLE_ALLOWED_WORDS[wordLength].has(normalizedGuess)) {
      setMessage('Такого слова нет в словаре игры.');
      focusBoard();
      return;
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
    submitCurrentGuess();
  }

  function handleBoardKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (status !== 'playing') return;

    if (e.key === 'Enter') {
      e.preventDefault();
      submitCurrentGuess();
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      setGuess((current) => current.slice(0, -1));
      setMessage('');
      return;
    }

    const letter = normalizeWord(e.key).replace(/[^а-я]/g, '');
    if (letter.length === 1 && guess.length < wordLength) {
      e.preventDefault();
      addLetter(letter);
      setMessage('');
    }
  }

  function addLetter(letter: string) {
    if (status !== 'playing') return;

    setGuess((current) => {
      if (current.length >= wordLength) return current;
      return `${current}${letter}`;
    });
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
                  disabled={status !== 'playing'}
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
            <button disabled={status !== 'playing'} type="submit">
              Проверить
            </button>
            <button
              className="soft-button"
              disabled={status !== 'playing' || hintIndex !== null || coins < hintCost}
              onClick={buyHint}
              type="button"
            >
              Подсказка за {hintCost} монет
            </button>
            <button
              className="ad-button"
              disabled={status !== 'playing' || hintIndex !== null || showAd}
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
          <button className="next-button" onClick={() => resetGame()} type="button">
            Новое слово
          </button>
        )}
      </div>

      {showAd && <AdModal onClose={closeAdAndRevealHint} />}
    </section>
  );
}
