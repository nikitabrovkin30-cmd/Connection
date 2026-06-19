import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { AdModal } from './AdModal';

type Puzzle = {
  id: string;
  question: string;
  answers: readonly string[];
  hint: string;
};

type PuzzleDifficulty = 'easy' | 'medium' | 'hard';

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

const PUZZLE_DIFFICULTIES: readonly { id: PuzzleDifficulty; title: string }[] = [
  { id: 'easy', title: 'Легко' },
  { id: 'medium', title: 'Средне' },
  { id: 'hard', title: 'Сложно' },
];

const EASY_PUZZLES: readonly Puzzle[] = [
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

const MEDIUM_PUZZLES: readonly Puzzle[] = [
  {
    id: 'echo',
    question: 'Отвечает тебе твоим же голосом, но своего голоса не имеет. Что это?',
    answers: ['эхо'],
    hint: 'Чаще слышно в горах или пустом помещении.',
  },
  {
    id: 'compass',
    question: 'Всегда знает, где север, хотя никогда там не был. Что это?',
    answers: ['компас'],
    hint: 'Его берут, чтобы не заблудиться.',
  },
  {
    id: 'calendar',
    question: 'Каждый день теряет по листу, но не становится деревом. Что это?',
    answers: ['календарь'],
    hint: 'Он помогает считать дни.',
  },
  {
    id: 'anchor',
    question: 'Падает вниз, чтобы корабль остался на месте. Что это?',
    answers: ['якорь'],
    hint: 'Связан с морем и цепью.',
  },
  {
    id: 'password',
    question: 'Его знают не все, но без него дверь в аккаунт закрыта. Что это?',
    answers: ['пароль'],
    hint: 'Лучше не говорить его другим.',
  },
  {
    id: 'magnet',
    question: 'Сам не зовет, а железо к себе притягивает. Что это?',
    answers: ['магнит'],
    hint: 'Он любит металл.',
  },
  {
    id: 'root',
    question: 'Его не видно над землей, но без него дерево не стоит. Что это?',
    answers: ['корень'],
    hint: 'Он держит растение и берет воду.',
  },
  {
    id: 'battery',
    question: 'Когда полная, дает силу устройству, когда пустая - просит зарядку. Что это?',
    answers: ['батарея', 'аккумулятор'],
    hint: 'Есть в телефоне.',
  },
  {
    id: 'thermometer',
    question: 'Молча показывает, жарко тебе или холодно. Что это?',
    answers: ['термометр', 'градусник'],
    hint: 'На нем смотрят температуру.',
  },
  {
    id: 'seed',
    question: 'Маленькое зерно, в котором спрятано будущее растение. Что это?',
    answers: ['семя', 'семечко'],
    hint: 'Его сажают в землю.',
  },
];

const HARD_PUZZLES: readonly Puzzle[] = [
  {
    id: 'silence',
    question: 'Чем больше его нарушают, тем меньше его остается. Что это?',
    answers: ['тишина'],
    hint: 'Она исчезает от звука.',
  },
  {
    id: 'time',
    question: 'Его нельзя увидеть, остановить или вернуть, но все его тратят. Что это?',
    answers: ['время'],
    hint: 'Его показывают часы.',
  },
  {
    id: 'secret',
    question: 'Пока он один - он твой, когда его рассказали - он уже общий. Что это?',
    answers: ['секрет', 'тайна'],
    hint: 'Его обычно не говорят всем.',
  },
  {
    id: 'promise',
    question: 'Его дают словами, а держат поступками. Что это?',
    answers: ['обещание'],
    hint: 'Если его нарушить, человеку обидно.',
  },
  {
    id: 'memory',
    question: 'Хранит прошлое без коробки и замка. Что это?',
    answers: ['память'],
    hint: 'Она есть у человека и компьютера.',
  },
  {
    id: 'choice',
    question: 'Появляется на развилке и меняет дорогу дальше. Что это?',
    answers: ['выбор'],
    hint: 'Его делают, когда есть несколько вариантов.',
  },
  {
    id: 'thought',
    question: 'Рождается в голове, но может изменить мир снаружи. Что это?',
    answers: ['мысль', 'идея'],
    hint: 'С нее часто начинается план.',
  },
  {
    id: 'name',
    question: 'Не человек, но помогает понять, кого зовут. Что это?',
    answers: ['имя'],
    hint: 'Его дают при рождении.',
  },
  {
    id: 'question',
    question: 'Его задают, когда ответа еще нет. Что это?',
    answers: ['вопрос'],
    hint: 'После него часто ждут объяснение.',
  },
  {
    id: 'border',
    question: 'Ее можно перейти, даже если она нарисована только в голове. Что это?',
    answers: ['граница'],
    hint: 'Она отделяет одно от другого.',
  },
];

const PUZZLES_BY_DIFFICULTY: Record<PuzzleDifficulty, readonly Puzzle[]> = {
  easy: EASY_PUZZLES,
  medium: MEDIUM_PUZZLES,
  hard: HARD_PUZZLES,
};

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function getPuzzleStateKey(userEmail: string, difficulty: PuzzleDifficulty) {
  return `${PUZZLE_STATE_PREFIX}_${userEmail}_${difficulty}`;
}

function pickPuzzle(puzzles: readonly Puzzle[], solvedIds: Set<string>, currentId?: string) {
  const unsolved = puzzles.filter((puzzle) => !solvedIds.has(puzzle.id) && puzzle.id !== currentId);
  const options = unsolved.length > 0 ? unsolved : puzzles.filter((puzzle) => puzzle.id !== currentId);
  const availablePuzzles = options.length > 0 ? options : puzzles;
  return availablePuzzles[Math.floor(Math.random() * availablePuzzles.length)];
}

function findSavedPuzzle(puzzles: readonly Puzzle[], puzzleId?: string) {
  return puzzles.find((puzzle) => puzzle.id === puzzleId);
}

function loadPuzzleState(userEmail: string, difficulty: PuzzleDifficulty): SavedPuzzleState | null {
  const saved = localStorage.getItem(getPuzzleStateKey(userEmail, difficulty));
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

function createInitialPuzzleState(userEmail: string, difficulty: PuzzleDifficulty) {
  const puzzles = PUZZLES_BY_DIFFICULTY[difficulty];
  const savedState = loadPuzzleState(userEmail, difficulty);
  const solvedIds = new Set(savedState?.solvedIds ?? []);
  const puzzle = findSavedPuzzle(puzzles, savedState?.puzzleId) ?? pickPuzzle(puzzles, solvedIds);

  return {
    puzzle,
    inputAnswer: savedState?.inputAnswer ?? '',
    message: savedState?.message ?? '',
    solvedIds,
    revealedHint: savedState?.revealedHint ?? false,
  };
}

export function PuzzleGame({ coins, hintCost, onReward, onSpendCoins, rewardCoins, userEmail }: PuzzleGameProps) {
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>('easy');
  const initialState = useMemo(() => createInitialPuzzleState(userEmail, difficulty), [difficulty, userEmail]);

  const [puzzle, setPuzzle] = useState<Puzzle>(initialState.puzzle);
  const [inputAnswer, setInputAnswer] = useState(initialState.inputAnswer);
  const [message, setMessage] = useState(initialState.message);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => initialState.solvedIds);
  const [revealedHint, setRevealedHint] = useState(initialState.revealedHint);
  const [showAd, setShowAd] = useState(false);

  const puzzles = PUZZLES_BY_DIFFICULTY[difficulty];
  const solvedCurrentPuzzle = solvedIds.has(puzzle.id);

  useEffect(() => {
    const nextState = createInitialPuzzleState(userEmail, difficulty);
    setPuzzle(nextState.puzzle);
    setInputAnswer(nextState.inputAnswer);
    setMessage(nextState.message);
    setSolvedIds(nextState.solvedIds);
    setRevealedHint(nextState.revealedHint);
    setShowAd(false);
  }, [difficulty, userEmail]);

  useEffect(() => {
    localStorage.setItem(
      getPuzzleStateKey(userEmail, difficulty),
      JSON.stringify({
        puzzleId: puzzle.id,
        inputAnswer,
        message,
        solvedIds: Array.from(solvedIds),
        revealedHint,
      } satisfies SavedPuzzleState),
    );
  }, [difficulty, inputAnswer, message, puzzle.id, revealedHint, solvedIds, userEmail]);

  function startNextPuzzle() {
    const nextPuzzle = pickPuzzle(puzzles, solvedIds, puzzle.id);
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

        <div className="puzzle-difficulties" aria-label="Сложность Puzzle">
          {PUZZLE_DIFFICULTIES.map((option) => (
            <button
              className={difficulty === option.id ? 'difficulty-button active' : 'difficulty-button'}
              key={option.id}
              onClick={() => setDifficulty(option.id)}
              type="button"
            >
              {option.title}
            </button>
          ))}
        </div>

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
          Разгадано: {solvedIds.size}/{puzzles.length}
        </p>
      </div>

      {showAd && <AdModal onClose={closeAdAndRevealHint} />}
    </section>
  );
}
