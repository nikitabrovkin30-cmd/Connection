import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { AdModal } from './AdModal';

type Puzzle = {
  id: string;
  question: string;
  answers: readonly string[];
  hint: string;
};

type SavedPuzzleState = {
  puzzleId: string;
  inputAnswer: string;
  message: string;
  solvedIds: string[];
  revealedHint: boolean;
};

type PuzzleGameProps = {
  coins: number;
  hintCost: number;
  onReward: () => void;
  onSpendCoins: () => boolean;
  rewardCoins: number;
  userEmail: string;
};

const PUZZLE_STATE_PREFIX = 'puzzle_game_state';

const PUZZLES: readonly Puzzle[] = [
  {
    id: 'shadow',
    question: 'Идет за тобой весь день, но ночью пропадает без следа. Что это?',
    answers: ['тень'],
    hint: 'Появляется, когда рядом есть свет.',
  },
  {
    id: 'clock',
    question: 'Стоит на месте, а время показывает. Что это?',
    answers: ['часы'],
    hint: 'У них могут быть стрелки.',
  },
  {
    id: 'book',
    question: 'Молчит, но может рассказать целую историю. Что это?',
    answers: ['книга'],
    hint: 'Ее читают.',
  },
  {
    id: 'river',
    question: 'Бежит без ног и не устает. Что это?',
    answers: ['река', 'вода'],
    hint: 'Часто течет к морю.',
  },
  {
    id: 'key',
    question: 'Маленький предмет, который открывает большие двери. Что это?',
    answers: ['ключ'],
    hint: 'Его вставляют в замок.',
  },
  {
    id: 'snow',
    question: 'Падает с неба белым, а в руках становится водой. Что это?',
    answers: ['снег'],
    hint: 'Бывает зимой.',
  },
  {
    id: 'mirror',
    question: 'Показывает тебя, но говорить не умеет. Что это?',
    answers: ['зеркало'],
    hint: 'В него смотрят утром.',
  },
  {
    id: 'fire',
    question: 'Ест дрова, но не имеет рта. Что это?',
    answers: ['огонь'],
    hint: 'Он греет и светит.',
  },
  {
    id: 'road',
    question: 'Лежит от города к городу, а сама никуда не идет. Что это?',
    answers: ['дорога'],
    hint: 'По ней ездят.',
  },
  {
    id: 'phone',
    question: 'В кармане живет, с людьми на расстоянии говорит. Что это?',
    answers: ['телефон'],
    hint: 'Им звонят и пишут.',
  },
  {
    id: 'sun',
    question: 'Утром приходит, вечером уходит, весь день землю греет. Что это?',
    answers: ['солнце'],
    hint: 'Это звезда.',
  },
  {
    id: 'pencil',
    question: 'Стирается, когда работает, но оставляет след. Что это?',
    answers: ['карандаш'],
    hint: 'Им пишут или рисуют.',
  },
  {
    id: 'window',
    question: 'В стене стоит, наружу смотреть велит. Что это?',
    answers: ['окно'],
    hint: 'Через него видно улицу.',
  },
  {
    id: 'letter',
    question: 'Маленький знак, а из него строятся слова. Что это?',
    answers: ['буква'],
    hint: 'Она часть алфавита.',
  },
  {
    id: 'cloud',
    question: 'По небу плывет, но весла не берет. Что это?',
    answers: ['облако', 'туча'],
    hint: 'Из него может пойти дождь.',
  },
  {
    id: 'needle',
    question: 'Маленькая, острая, одежду чинит. Что это?',
    answers: ['игла', 'иголка'],
    hint: 'К ней нужна нитка.',
  },
  {
    id: 'bridge',
    question: 'Соединяет два берега, но сам не лодка. Что это?',
    answers: ['мост'],
    hint: 'По нему можно перейти реку.',
  },
  {
    id: 'map',
    question: 'Показывает города и дороги, но сама не путешествует. Что это?',
    answers: ['карта'],
    hint: 'Ее берут в путешествие.',
  },
  {
    id: 'candle',
    question: 'Плачет воском, когда светит. Что это?',
    answers: ['свеча'],
    hint: 'Ее зажигают.',
  },
  {
    id: 'dream',
    question: 'Видишь ночью, а утром можешь забыть. Что это?',
    answers: ['сон'],
    hint: 'Он приходит, когда спишь.',
  },
];

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function getPuzzleStateKey(userEmail: string) {
  return `${PUZZLE_STATE_PREFIX}_${userEmail}`;
}

function pickPuzzle(solvedIds: Set<string>, currentId?: string) {
  const unsolved = PUZZLES.filter((puzzle) => !solvedIds.has(puzzle.id) && puzzle.id !== currentId);
  const options = unsolved.length > 0 ? unsolved : PUZZLES.filter((puzzle) => puzzle.id !== currentId);
  const puzzles = options.length > 0 ? options : PUZZLES;
  return puzzles[Math.floor(Math.random() * puzzles.length)];
}

function loadPuzzleState(userEmail: string): SavedPuzzleState | null {
  const saved = localStorage.getItem(getPuzzleStateKey(userEmail));
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<SavedPuzzleState>;
    if (typeof parsed.puzzleId !== 'string') return null;

    return {
      puzzleId: parsed.puzzleId,
      inputAnswer: typeof parsed.inputAnswer === 'string' ? parsed.inputAnswer : '',
      message: typeof parsed.message === 'string' ? parsed.message : '',
      solvedIds: Array.isArray(parsed.solvedIds)
        ? parsed.solvedIds.filter((id): id is string => typeof id === 'string')
        : [],
      revealedHint: parsed.revealedHint === true,
    };
  } catch {
    return null;
  }
}

export function PuzzleGame({ coins, hintCost, onReward, onSpendCoins, rewardCoins, userEmail }: PuzzleGameProps) {
  const savedState = useMemo(() => loadPuzzleState(userEmail), [userEmail]);
  const initialSolvedIds = useMemo(() => new Set(savedState?.solvedIds ?? []), [savedState]);
  const initialPuzzle = useMemo(
    () => PUZZLES.find((puzzle) => puzzle.id === savedState?.puzzleId) ?? pickPuzzle(initialSolvedIds),
    [initialSolvedIds, savedState],
  );

  const [puzzle, setPuzzle] = useState<Puzzle>(initialPuzzle);
  const [inputAnswer, setInputAnswer] = useState(savedState?.inputAnswer ?? '');
  const [message, setMessage] = useState(savedState?.message ?? '');
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => initialSolvedIds);
  const [revealedHint, setRevealedHint] = useState(savedState?.revealedHint ?? false);
  const [showAd, setShowAd] = useState(false);

  const solvedCurrentPuzzle = solvedIds.has(puzzle.id);

  useEffect(() => {
    localStorage.setItem(
      getPuzzleStateKey(userEmail),
      JSON.stringify({
        puzzleId: puzzle.id,
        inputAnswer,
        message,
        solvedIds: Array.from(solvedIds),
        revealedHint,
      } satisfies SavedPuzzleState),
    );
  }, [inputAnswer, message, puzzle.id, revealedHint, solvedIds, userEmail]);

  function startNextPuzzle() {
    const nextPuzzle = pickPuzzle(solvedIds, puzzle.id);
    setPuzzle(nextPuzzle);
    setInputAnswer('');
    setMessage('');
    setRevealedHint(false);
    setShowAd(false);
  }

  function revealHint() {
    if (revealedHint || solvedCurrentPuzzle) return;
    setRevealedHint(true);
  }

  function buyHint() {
    if (revealedHint || solvedCurrentPuzzle) return;

    if (coins < hintCost || !onSpendCoins()) {
      setMessage(`Нужно ${hintCost} монет для подсказки.`);
      return;
    }

    revealHint();
    setMessage(`Подсказка куплена за ${hintCost} монет.`);
  }

  function openAdForHint() {
    if (revealedHint || solvedCurrentPuzzle) return;
    setShowAd(true);
  }

  function closeAdAndRevealHint() {
    setShowAd(false);
    revealHint();
    setMessage('Реклама просмотрена. Подсказка открыта.');
  }

  function submitAnswer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const normalizedAnswer = normalizeAnswer(inputAnswer);
    if (!normalizedAnswer || solvedCurrentPuzzle) return;

    const correct = puzzle.answers.some((answer) => normalizeAnswer(answer) === normalizedAnswer);

    if (!correct) {
      setMessage('Пока не то. Попробуй другую ассоциацию.');
      return;
    }

    setSolvedIds((currentSolvedIds) => {
      if (currentSolvedIds.has(puzzle.id)) return currentSolvedIds;

      const nextSolvedIds = new Set(currentSolvedIds).add(puzzle.id);
      onReward();
      return nextSolvedIds;
    });
    setMessage(`Верно! Ответ: ${puzzle.answers[0]}. +${rewardCoins} монет.`);
  }

  return (
    <section className="puzzle-shell">
      <div className="game-card puzzle-card">
        <p className="hello">Игрок: {userEmail}</p>
        <h2>Puzzle</h2>
        <p className="game-subtitle">
          Разгадай загадку и напиши ответ одним словом. За правильный ответ дается награда.
        </p>

        <div className="puzzle-question">
          <span>Загадка</span>
          <strong>{puzzle.question}</strong>
        </div>

        {revealedHint && <p className="puzzle-hint">{puzzle.hint}</p>}

        <form className="guess-form" onSubmit={submitAnswer}>
          <input
            disabled={solvedCurrentPuzzle}
            onChange={(e) => {
              setInputAnswer(e.target.value);
              setMessage('');
            }}
            placeholder="ответ"
            value={inputAnswer}
          />
          <button disabled={solvedCurrentPuzzle} type="submit">
            Проверить
          </button>
        </form>

        <div className="puzzle-actions">
          <button
            className="soft-button"
            disabled={revealedHint || solvedCurrentPuzzle || coins < hintCost}
            onClick={buyHint}
            type="button"
          >
            Подсказка за {hintCost} монет
          </button>
          <button
            className="ad-button"
            disabled={revealedHint || solvedCurrentPuzzle || showAd}
            onClick={openAdForHint}
            type="button"
          >
            Подсказка за рекламу
          </button>
          <button className="next-button" onClick={startNextPuzzle} type="button">
            Новая загадка
          </button>
        </div>

        {message && <p className={solvedCurrentPuzzle ? 'success-message' : 'message'}>{message}</p>}

        <p className="puzzle-progress">
          Разгадано: {solvedIds.size}/{PUZZLES.length}
        </p>
      </div>

      {showAd && <AdModal onClose={closeAdAndRevealHint} />}
    </section>
  );
}
