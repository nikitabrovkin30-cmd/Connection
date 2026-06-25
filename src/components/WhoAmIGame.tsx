import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { SECRET_WORDS } from '../data/wordBank';
import { supabase } from '../lib/supabase';
import { AdModal } from './AdModal';

type WhoAmIStatus = 'playing' | 'won' | 'gave-up';

type QuestionAnswer = {
  id: string;
  question: string;
  answer: 'Да' | 'Нет';
};

type SavedWhoAmIState = {
  targetWord: string;
  question: string;
  guess: string;
  history: QuestionAnswer[];
  revealedHints: number;
  status: WhoAmIStatus;
  message: string;
};

type AiTextResponse = {
  text?: string;
};

type WhoAmIGameProps = {
  coins: number;
  hintCost: number;
  onReward: () => void;
  onSpendCoins: () => boolean;
  rewardCoins: number;
  userEmail: string;
};

const WHO_AM_I_STATE_PREFIX = 'who_am_i_state';

const WHO_LOCAL_TOPICS: Record<string, readonly string[]> = {
  animal: [
    'акула', 'бегемот', 'белка', 'бобр', 'бык', 'волк', 'ворона', 'гусь', 'дельфин', 'ежик',
    'жаба', 'жираф', 'заяц', 'зебра', 'змея', 'индюк', 'кабан', 'кит', 'коза', 'конь',
    'корова', 'кот', 'кошка', 'крот', 'курица', 'лебедь', 'лев', 'лиса', 'лось', 'медведь',
    'мышь', 'олень', 'орел', 'ослик', 'павлин', 'паук', 'петух', 'птица', 'рыба', 'свинья',
    'скворец', 'слон', 'собака', 'сорока', 'страус', 'тигр', 'черепаха',
  ],
  food: [
    'абрикос', 'ананас', 'арбуз', 'банан', 'блин', 'борщ', 'булка', 'варенье', 'вафля',
    'виноград', 'вишня', 'горошек', 'груша', 'джем', 'дыня', 'еда', 'икра', 'каша',
    'капуста', 'картофель', 'колбаса', 'конфета', 'кофе', 'кукуруза', 'лимон', 'малина',
    'мандарин', 'масло', 'мед', 'молоко', 'мясо', 'напиток', 'овощ', 'огурец', 'орех',
    'перец', 'пирог', 'помидор', 'салат', 'сахар', 'соль', 'суп', 'сыр', 'торт', 'фрукт',
    'хлеб', 'чай', 'чеснок', 'шоколад', 'яблоко', 'ягода',
  ],
  place: [
    'аэропорт', 'аптека', 'арена', 'архив', 'базар', 'балкон', 'бассейн', 'библиотека',
    'вокзал', 'вход', 'выставка', 'галерея', 'гараж', 'город', 'двор', 'дворец', 'деревня',
    'дом', 'зал', 'замок', 'изба', 'кабинет', 'кафе', 'квартира', 'кино', 'киоск', 'класс',
    'комната', 'магазин', 'метро', 'музей', 'огород', 'парк', 'пещера', 'площадь', 'порт',
    'рынок', 'страна', 'театр', 'улица', 'фабрика', 'храм', 'цирк', 'чердак', 'школа',
  ],
  nature: [
    'айсберг', 'берег', 'береза', 'болото', 'буря', 'ветер', 'ветка', 'вода', 'водопад',
    'воздух', 'волна', 'вулкан', 'гора', 'гриб', 'гром', 'дерево', 'дождь', 'долина',
    'дым', 'жара', 'звезда', 'земля', 'зима', 'иней', 'искра', 'кактус', 'камень',
    'капля', 'кедр', 'лес', 'лист', 'луна', 'лужа', 'луч', 'море', 'мороз', 'небо',
    'облако', 'озеро', 'остров', 'пейзаж', 'песок', 'планета', 'поле', 'природа',
    'радуга', 'река', 'север', 'скала', 'снег', 'солнце', 'сосна', 'трава', 'туман',
    'цветок', 'ягода',
  ],
  object: [
    'абажур', 'альбом', 'багаж', 'банка', 'барабан', 'батарея', 'билет', 'бинокль',
    'блокнот', 'ботинок', 'бочка', 'браслет', 'букет', 'бумага', 'бутылка', 'ваза',
    'ведро', 'велосипед', 'веник', 'веревка', 'вилка', 'витрина', 'ворота', 'гвоздь',
    'гитара', 'глобус', 'дверь', 'диван', 'дневник', 'доска', 'забор', 'зеркало',
    'зонт', 'игла', 'инструмент', 'камера', 'карта', 'картина', 'кисть', 'клетка',
    'книга', 'ковер', 'колесо', 'колокол', 'конверт', 'копейка', 'корзина', 'краска',
    'кресло', 'крыша', 'кубик', 'кукла', 'лампа', 'лента', 'лодка', 'ложка', 'лыжи',
    'маска', 'машина', 'мешок', 'молоток', 'мост', 'мотор', 'мыло', 'мяч', 'нож',
    'одеяло', 'окно', 'очки', 'палатка', 'пальто', 'паспорт', 'пенал', 'перо', 'письмо',
    'платок', 'плитка', 'подушка', 'поезд', 'полка', 'потолок', 'ручка', 'рюкзак',
    'сапог', 'свеча', 'скатерть', 'скрипка', 'стакан', 'стена', 'стол', 'стрела',
    'струна', 'стул', 'сумка', 'телефон', 'тетрадь', 'топор', 'труба', 'фонарь',
    'фото', 'часы', 'чайник', 'чемодан', 'шапка', 'шар', 'шкаф', 'штора', 'щетка',
    'экран', 'ящик',
  ],
  transport: [
    'автобус', 'автомобиль', 'вагон', 'велосипед', 'карета', 'катер', 'корабль', 'лодка',
    'машина', 'метро', 'поезд', 'ракета', 'самокат', 'самолет', 'трамвай',
  ],
  person: [
    'автор', 'актер', 'бабушка', 'брат', 'врач', 'герой', 'гость', 'девочка', 'дедушка',
    'директор', 'доктор', 'дочь', 'друг', 'жена', 'житель', 'мама', 'народ', 'папа',
    'певец', 'ребенок', 'семья', 'строитель', 'учитель', 'человек',
  ],
};

const WHO_AM_I_TARGET_TOPICS = ['animal', 'nature', 'object'] as const;

const WHO_AM_I_TARGET_SET = new Set(
  WHO_AM_I_TARGET_TOPICS.flatMap((topic) => WHO_LOCAL_TOPICS[topic]),
);

const WHO_AM_I_WORDS = SECRET_WORDS.filter((word) => (
  word.length >= 4 &&
  word.length <= 10 &&
  /^[а-яё]+$/.test(word) &&
  WHO_AM_I_TARGET_SET.has(normalizeWord(word))
));

const WHO_LOCAL_QUESTION_RULES: readonly {
  answerTopic: keyof typeof WHO_LOCAL_TOPICS;
  keywords: readonly string[];
}[] = [
  { answerTopic: 'animal', keywords: ['живое', 'животное', 'зверь', 'птица', 'рыба'] },
  { answerTopic: 'food', keywords: ['еда', 'пища', 'продукт', 'съесть', 'есть', 'пьют', 'напиток', 'кухня', 'вкус'] },
  { answerTopic: 'place', keywords: ['место', 'здание', 'комната', 'улица', 'город', 'там бывают', 'туда ходят'] },
  { answerTopic: 'nature', keywords: ['природа', 'растение', 'погода', 'небо', 'вода', 'лес', 'земля'] },
  { answerTopic: 'object', keywords: ['предмет', 'вещь', 'объект', 'держат', 'используют', 'можно взять'] },
  { answerTopic: 'transport', keywords: ['транспорт', 'ездит', 'летает', 'плывет', 'перевозит'] },
  { answerTopic: 'person', keywords: ['человек', 'люди', 'профессия', 'родственник', 'персонаж'] },
];

function normalizeWord(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function getWhoAmIStateKey(userEmail: string) {
  return `${WHO_AM_I_STATE_PREFIX}_${userEmail}`;
}

function pickWord(currentWord?: string) {
  const options = WHO_AM_I_WORDS.filter((word) => word !== currentWord);
  const words = options.length > 0 ? options : WHO_AM_I_WORDS;
  return words[Math.floor(Math.random() * words.length)] ?? 'книга';
}

function parseYesNo(value: string): 'Да' | 'Нет' | null {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue.startsWith('да') || normalizedValue.includes('"да"')) return 'Да';
  if (normalizedValue.startsWith('нет') || normalizedValue.includes('"нет"')) return 'Нет';

  return null;
}

function hasTopic(word: string, topic: keyof typeof WHO_LOCAL_TOPICS) {
  return WHO_LOCAL_TOPICS[topic].includes(normalizeWord(word));
}

function answerFromLocalDictionary(question: string, targetWord: string): 'Да' | 'Нет' | null {
  const normalizedQuestion = normalizeWord(question)
    .replace(/[?!.,:;()"«»]/g, ' ')
    .replace(/\s+/g, ' ');

  const matchedRule = WHO_LOCAL_QUESTION_RULES.find((rule) => (
    rule.keywords.some((keyword) => normalizedQuestion.includes(normalizeWord(keyword)))
  ));

  if (!matchedRule) return null;

  return hasTopic(targetWord, matchedRule.answerTopic) ? 'Да' : 'Нет';
}

function getWordTopics(word: string) {
  return Object.entries(WHO_LOCAL_TOPICS)
    .filter(([, words]) => words.includes(normalizeWord(word)))
    .map(([topic]) => topic);
}

function getTopicHint(topic: string) {
  const topicHints: Record<string, string> = {
    animal: 'Это относится к живому миру.',
    food: 'Это связано с едой, вкусом или кухней.',
    place: 'Это место, куда можно попасть или где можно быть.',
    nature: 'Это связано с природой.',
    object: 'Это предмет или вещь.',
    transport: 'Это помогает перемещаться.',
    person: 'Это связано с человеком.',
  };

  return topicHints[topic] ?? 'Попробуй сначала спросить, к какой теме это относится.';
}

function normalizeHintText(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
}

function getUniqueHints(hints: readonly string[]) {
  const seenHints = new Set<string>();
  const uniqueHints: string[] = [];

  hints.forEach((hint) => {
    const normalizedHint = normalizeHintText(hint);
    if (seenHints.has(normalizedHint)) return;

    seenHints.add(normalizedHint);
    uniqueHints.push(hint);
  });

  return uniqueHints;
}

function getWhoHints(word: string) {
  const letters = Array.from(word);
  const topics = getWordTopics(word);
  const topicHint = topics[0] ? getTopicHint(topics[0]) : `В слове ${letters.length} букв.`;
  const letterWord = letters.length === 1 ? 'буква' : letters.length > 1 && letters.length < 5 ? 'буквы' : 'букв';
  const middleIndex = Math.floor(letters.length / 2);
  const openedLetters = letters
    .map((letter, index) => (index === middleIndex ? letter : '_'))
    .join(' ');

  return getUniqueHints([
    topicHint,
    `В слове ${letters.length} ${letterWord}.`,
    `Открытая буква: ${openedLetters}.`,
  ]);
}

function loadWhoAmIState(userEmail: string): SavedWhoAmIState | null {
  const saved = localStorage.getItem(getWhoAmIStateKey(userEmail));
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<SavedWhoAmIState>;

    if (
      typeof parsed.targetWord !== 'string' ||
      !WHO_AM_I_WORDS.includes(parsed.targetWord) ||
      (parsed.status !== 'playing' && parsed.status !== 'won' && parsed.status !== 'gave-up')
    ) {
      return null;
    }

    const history = Array.isArray(parsed.history)
      ? parsed.history.filter((item): item is QuestionAnswer => (
          typeof item.id === 'string' &&
          typeof item.question === 'string' &&
          (item.answer === 'Да' || item.answer === 'Нет')
        ))
      : [];

    return {
      targetWord: parsed.targetWord,
      question: typeof parsed.question === 'string' ? parsed.question : '',
      guess: typeof parsed.guess === 'string' ? parsed.guess : '',
      history,
      revealedHints: typeof parsed.revealedHints === 'number' ? Math.max(0, Math.min(3, parsed.revealedHints)) : 0,
      status: parsed.status,
      message: typeof parsed.message === 'string' ? parsed.message : '',
    };
  } catch {
    return null;
  }
}

async function askYesNo(question: string, targetWord: string) {
  const localAnswer = answerFromLocalDictionary(question, targetWord);
  if (localAnswer) return localAnswer;

  const { data, error } = await supabase.functions.invoke<AiTextResponse>('ai', {
    body: {
      system:
        'Ты ведущий игры Who am I. Игрок пытается угадать секретное русское слово. Отвечай строго только одним словом: "Да" или "Нет". Не объясняй, не давай подсказок, не раскрывай секретное слово. Если вопрос нельзя уверенно проверить для секретного слова, отвечай "Нет".',
      prompt: `Секретное слово: "${targetWord}". Вопрос игрока: "${question}". Ответь только "Да" или "Нет".`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const answer = parseYesNo(data?.text ?? '');
  if (!answer) {
    throw new Error('AI did not return yes/no');
  }

  return answer;
}

export function WhoAmIGame({
  coins,
  hintCost,
  onReward,
  onSpendCoins,
  rewardCoins,
  userEmail,
}: WhoAmIGameProps) {
  const savedState = loadWhoAmIState(userEmail);
  const [targetWord, setTargetWord] = useState(() => savedState?.targetWord ?? pickWord());
  const [question, setQuestion] = useState(() => savedState?.question ?? '');
  const [guess, setGuess] = useState(() => savedState?.guess ?? '');
  const [history, setHistory] = useState<QuestionAnswer[]>(() => savedState?.history ?? []);
  const [revealedHints, setRevealedHints] = useState(() => savedState?.revealedHints ?? 0);
  const [status, setStatus] = useState<WhoAmIStatus>(() => savedState?.status ?? 'playing');
  const [message, setMessage] = useState(() => savedState?.message ?? '');
  const [loading, setLoading] = useState(false);
  const [showAd, setShowAd] = useState(false);

  const roundFinished = status !== 'playing';
  const normalizedTarget = useMemo(() => normalizeWord(targetWord), [targetWord]);
  const hints = useMemo(() => getWhoHints(targetWord), [targetWord]);
  const shownHints = hints.slice(0, revealedHints);

  useEffect(() => {
    localStorage.setItem(
      getWhoAmIStateKey(userEmail),
      JSON.stringify({
        targetWord,
        question,
        guess,
        history,
        revealedHints,
        status,
        message,
      } satisfies SavedWhoAmIState),
    );
  }, [guess, history, message, question, revealedHints, status, targetWord, userEmail]);

  function startNewRound() {
    setTargetWord((currentWord) => pickWord(currentWord));
    setQuestion('');
    setGuess('');
    setHistory([]);
    setRevealedHints(0);
    setStatus('playing');
    setMessage('');
    setLoading(false);
    setShowAd(false);
  }

  async function submitQuestion(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const cleanQuestion = question.trim();
    if (roundFinished || loading || cleanQuestion.length < 3) return;

    setLoading(true);
    setMessage('Думаю над ответом...');

    try {
      const answer = await askYesNo(cleanQuestion, targetWord);
      setHistory((currentHistory) => [
        {
          id: `${Date.now()}-${currentHistory.length}`,
          question: cleanQuestion,
          answer,
        },
        ...currentHistory,
      ]);
      setQuestion('');
      setMessage('');
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'AI yes/no failed');
      setMessage('ИИ сейчас недоступен, поэтому я не могу ответить да или нет.');
    } finally {
      setLoading(false);
    }
  }

  function submitGuess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const normalizedGuess = normalizeWord(guess);
    if (roundFinished || !normalizedGuess) return;

    if (normalizedGuess === normalizedTarget) {
      setStatus('won');
      setMessage(`Верно! Это слово: ${targetWord}. +${rewardCoins} монет.`);
      onReward();
      return;
    }

    setMessage('Пока нет. Задай еще вопрос или попробуй другое слово.');
    setGuess('');
  }

  function giveUp() {
    if (roundFinished) return;
    setStatus('gave-up');
    setShowAd(false);
    setMessage(`Ответ был: ${targetWord}.`);
  }

  function revealHint() {
    if (roundFinished || revealedHints >= hints.length) return;
    setRevealedHints((currentHints) => Math.min(hints.length, currentHints + 1));
    setMessage('');
  }

  function buyHint() {
    if (roundFinished || revealedHints >= hints.length) return;

    if (coins < hintCost || !onSpendCoins()) {
      setMessage(`Нужно ${hintCost} монет для подсказки.`);
      return;
    }

    revealHint();
    setMessage(`Подсказка куплена за ${hintCost} монет.`);
  }

  function openAdForHint() {
    if (roundFinished || revealedHints >= hints.length) return;
    setShowAd(true);
  }

  function closeAdAndRevealHint() {
    setShowAd(false);
    revealHint();
    setMessage('Реклама просмотрена. Подсказка открыта.');
  }

  return (
    <section className="who-shell">
      <div className="game-card who-card">
        <p className="hello">Игрок: {userEmail}</p>
        <h2>Who am I?</h2>
        <p className="game-subtitle">
          Задавай вопросы, на которые можно ответить только да или нет. Потом попробуй угадать слово.
        </p>

        <div className="secret-box who-secret">
          {roundFinished ? (
            <span>
              Секретное слово: <strong>{targetWord}</strong>
            </span>
          ) : (
            <>
              <span>Секретное слово</span>
              <strong>{'?'.repeat(targetWord.length)}</strong>
            </>
          )}
        </div>

        <form className="who-form" onSubmit={submitQuestion}>
          <input
            disabled={roundFinished || loading}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="например: это живое?"
            type="text"
            value={question}
          />
          <button disabled={roundFinished || loading || question.trim().length < 3} type="submit">
            {loading ? 'Отвечаю...' : 'Спросить'}
          </button>
        </form>

        <form className="who-form" onSubmit={submitGuess}>
          <input
            disabled={roundFinished}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="твой ответ"
            type="text"
            value={guess}
          />
          <button disabled={roundFinished || !guess.trim()} type="submit">
            Угадать
          </button>
        </form>

        <div className="who-actions">
          <button
            className="soft-button"
            disabled={roundFinished || revealedHints >= hints.length || coins < hintCost}
            onClick={buyHint}
            type="button"
          >
            Подсказка за {hintCost} монет
          </button>
          <button
            className="ad-button"
            disabled={roundFinished || revealedHints >= hints.length || showAd}
            onClick={openAdForHint}
            type="button"
          >
            Подсказка за рекламу
          </button>
          <button className="danger-button" disabled={roundFinished} onClick={giveUp} type="button">
            Сдаться
          </button>
          {roundFinished && (
            <button className="next-button" onClick={startNewRound} type="button">
              Новое слово
            </button>
          )}
        </div>

        {shownHints.length > 0 && (
          <ul className="clue-list">
            {shownHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        )}

        {message && (
          <p className={status === 'won' ? 'success-message' : 'message'}>{message}</p>
        )}

        <aside className="who-history">
          <h3>Вопросы</h3>
          {history.length === 0 ? (
            <p>Пока нет вопросов.</p>
          ) : (
            <ul>
              {history.map((item) => (
                <li key={item.id}>
                  <span>{item.question}</span>
                  <strong>{item.answer}</strong>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {showAd && <AdModal onClose={closeAdAndRevealHint} />}
    </section>
  );
}
