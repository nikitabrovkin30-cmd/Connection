import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { SECRET_WORDS } from '../data/wordBank';
import { supabase } from '../lib/supabase';
import { AdModal } from './AdModal';

const GUEST_HISTORY_PREFIX = 'connection_guest_history';
const MAX_AI_CLUES = 3;

type GameStatus = 'playing' | 'won' | 'gave-up';

type Guess = {
  id: string;
  guess_word: string;
  created_at: string;
  distance: number;
};

type StoredGuess = Omit<Guess, 'distance'> & {
  distance?: number;
};

type LastResult = {
  word: string;
  distance: number;
};

type AiTextResponse = {
  text?: string;
};

type ConnectionGameProps = {
  coins: number;
  hintCost: number;
  onReward: () => void;
  onSpendCoins: () => boolean;
  rewardCoins: number;
  userEmail: string;
  isGuest: boolean;
};

const WORD_MEANINGS: Record<string, string> = {
  кровать: 'Мебель для спанья: длинная рама с ножками и спинками, на которую кладут матрас и постельные принадлежности.',
  диван: 'Мягкая мебель для сидения или отдыха, обычно со спинкой и подлокотниками.',
  стол: 'Предмет мебели с горизонтальной поверхностью, за которым едят, пишут или работают.',
  стул: 'Мебель для сидения одного человека, обычно со спинкой и четырьмя ножками.',
  шкаф: 'Высокая мебель с дверцами, где хранят одежду, книги или другие вещи.',
  лампа: 'Прибор, который дает свет и помогает освещать комнату или рабочее место.',
  книга: 'Печатное или электронное произведение с текстом и страницами, которое читают.',
  телефон: 'Устройство для связи, звонков, сообщений и разных приложений.',
  машина: 'Транспортное средство или механизм, который выполняет работу с помощью двигателя.',
  поезд: 'Транспорт из вагонов, который движется по рельсам.',
  самолет: 'Летательный аппарат с крыльями и двигателями для полета по воздуху.',
  дом: 'Здание, в котором живут люди или находится чье-то жилье.',
  школа: 'Место, где учатся дети и проходят уроки.',
  город: 'Крупный населенный пункт с улицами, домами, дорогами и разными службами.',
  парк: 'Открытое место для прогулок и отдыха, обычно с деревьями и дорожками.',
  море: 'Большое пространство соленой воды, меньше океана и часто у берега.',
  река: 'Поток воды, который течет по руслу к морю, озеру или другой реке.',
  лес: 'Большая территория, где растет много деревьев, кустов и растений.',
  солнце: 'Звезда, которая освещает и согревает Землю.',
  луна: 'Естественный спутник Земли, который виден на ночном небе.',
  звезда: 'Светящееся небесное тело, похожее на маленькую точку на ночном небе.',
  вода: 'Прозрачная жидкость без вкуса и запаха, необходимая для жизни.',
  огонь: 'Горение с теплом и светом, которое может греть, освещать или сжигать.',
  хлеб: 'Пищевой продукт из муки и воды, который выпекают и едят с разной едой.',
  молоко: 'Белая питательная жидкость, которую получают от животных или делают из растений.',
  яблоко: 'Круглый фрукт с кожурой, сочной мякотью и семечками внутри.',
  банан: 'Длинный сладкий фрукт с желтой кожурой и мягкой мякотью.',
  сахар: 'Сладкое вещество, которое добавляют в еду и напитки.',
  чай: 'Горячий напиток, который заваривают из листьев чайного растения или трав.',
  друг: 'Близкий человек, с которым приятно общаться и которому доверяют.',
  семья: 'Группа близких людей, связанных родством или совместной жизнью.',
  любовь: 'Сильное теплое чувство привязанности, заботы и симпатии к кому-то или чему-то.',
  радость: 'Приятное чувство, которое появляется, когда случается что-то хорошее.',
  работа: 'Дело или занятие, которое человек выполняет для результата или заработка.',
  игра: 'Занятие для развлечения, тренировки или соревнования по правилам.',
  музыка: 'Искусство звуков, мелодий и ритма, которое слушают или исполняют.',
  космос: 'Пространство за пределами Земли, где находятся планеты, звезды и галактики.',
};

function normalizeWord(value: string) {
  return value.trim().toLowerCase();
}

function getLocalWordMeaning(word: string) {
  return WORD_MEANINGS[word] ?? `Пока не получилось найти точное определение для слова "${word}". Это слово можно использовать как ассоциацию, а по числу рядом понять, насколько оно близко к загаданному.`;
}

void getLocalWordMeaning;

function cleanMeaning(value: string) {
  return value
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchOzhegovMeaning(word: string) {
  const { data, error } = await supabase.functions.invoke<AiTextResponse>('ai', {
    body: {
      system:
        'Ты помогаешь со значениями русских слов для игры. Дай краткое толковое определение на русском языке в стиле словаря Ожегова: понятно, строго, 1-2 предложения. Не пиши длинные цитаты, примеры из литературы, этимологию и лишние пояснения. Если у слова несколько значений, выбери самое обычное.',
      prompt: `Дай толковое значение слова "${word}" как для школьного словаря.`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const meaning = cleanMeaning(data?.text ?? '').replace(/^["«]|["»]$/g, '');

  if (meaning.length < 12) {
    throw new Error('meaning not found');
  }

  return meaning;
}

function pickRandomWord(currentWord?: string) {
  const options = SECRET_WORDS.filter((word) => word !== currentWord);
  const words = options.length > 0 ? options : SECRET_WORDS;
  return words[Math.floor(Math.random() * words.length)];
}

function getGuestHistoryKey(targetWord: string) {
  return `${GUEST_HISTORY_PREFIX}_${targetWord}`;
}

function getStableNoise(word: string, targetWord: string) {
  const seed = `${targetWord}:${word}`;
  const total = Array.from(seed).reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  return total % 11;
}

function getDistance(word: string, targetWord: string) {
  const wordLetters = new Set(Array.from(word));
  const targetLetters = new Set(Array.from(targetWord));
  const sharedLetters = Array.from(wordLetters).filter((letter) => targetLetters.has(letter)).length;
  const lengthGap = Math.abs(word.length - targetWord.length);
  const overlapBonus = sharedLetters * 8;
  const rawDistance = 70 + lengthGap * 4 + getStableNoise(word, targetWord) - overlapBonus;

  return Math.max(2, Math.min(99, rawDistance));
}

const TOPIC_WORDS: Record<string, readonly string[]> = {
  material: ['резина', 'шина', 'колесо', 'машина', 'ремонт', 'завод', 'железо', 'стекло', 'ткань', 'сверло', 'шланг', 'мотор', 'техника', 'сапог', 'ремень'],
  entertainment: ['развлечение', 'игра', 'кино', 'театр', 'музыка', 'танец', 'спорт', 'праздник', 'шутка', 'хобби', 'фокус', 'артист', 'афиша'],
  food: ['еда', 'хлеб', 'молоко', 'яблоко', 'банан', 'сахар', 'чай', 'суп', 'сыр', 'мясо', 'овощ', 'фрукт'],
  nature: ['лес', 'вода', 'море', 'река', 'солнце', 'луна', 'звезда', 'камень', 'трава', 'дерево', 'ветер', 'снег'],
  place: ['дом', 'школа', 'город', 'парк', 'улица', 'магазин', 'класс', 'комната', 'театр', 'гараж', 'завод'],
};

function getWordTopics(word: string) {
  return Object.entries(TOPIC_WORDS)
    .filter(([, words]) => words.includes(word))
    .map(([topic]) => topic);
}

function hasSharedTopic(word: string, targetWord: string) {
  const wordTopics = getWordTopics(word);
  const targetTopics = getWordTopics(targetWord);

  if (wordTopics.length === 0 || targetTopics.length === 0) return true;
  return wordTopics.some((topic) => targetTopics.includes(topic));
}

function tuneSemanticDistance(distance: number, word: string, targetWord: string) {
  if (word === targetWord) return 2;
  if (!hasSharedTopic(word, targetWord) && distance < 68) return 72;
  return distance;
}

function parseDistance(value: string) {
  const jsonMatch = value.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { distance?: unknown };
      const distance = Number(parsed.distance);

      if (Number.isFinite(distance)) {
        return Math.max(2, Math.min(99, Math.round(distance)));
      }
    } catch {
      // Gemini may answer with plain text; fall through to number parsing.
    }
  }

  const numberMatch = value.match(/\d+/);
  if (!numberMatch) return null;

  const distance = Number(numberMatch[0]);
  return Number.isFinite(distance) ? Math.max(2, Math.min(99, Math.round(distance))) : null;
}

async function getSemanticDistance(word: string, targetWord: string) {
  const { data, error } = await supabase.functions.invoke<AiTextResponse>('ai', {
    body: {
      system:
        'Ты оцениваешь русские слова для игры Association. Верни только JSON вида {"distance": число}. Оценивай только смысл, тему и обычные ассоциации, не похожесть букв. 2-10 почти синоним или часть одного предмета, 11-25 очень близкая ассоциация, 26-45 та же тема, 46-67 слабая связь, 68-99 другая тема. Не делай абстрактные слова слишком близкими к конкретным предметам. Пример: секрет "резина", игрок "шина" = 12, "колесо" = 22, "машина" = 35, "развлечение" = 82, "музыка" = 88.',
      prompt: `Секретное слово: "${targetWord}". Слово игрока: "${word}". Верни расстояние по смыслу.`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const distance = parseDistance(data?.text ?? '');
  if (distance === null) {
    throw new Error('AI did not return distance');
  }

  return tuneSemanticDistance(distance, word, targetWord);
}

async function getSmartDistance(word: string, targetWord: string) {
  return getSemanticDistance(word, targetWord);
}

async function getAiClue(word: string, clueIndex: number) {
  const clueStyle = [
    'Дай очень простую категорию слова, например: предмет, место, еда, природа, чувство, действие. Не называй само слово.',
    'Дай простую ситуацию, где это можно встретить или использовать. Не называй само слово.',
    'Дай 2-3 близкие ассоциации, но не само слово и не однокоренные слова.',
  ][clueIndex] ?? 'Дай понятную подсказку, не называя само слово.';

  const { data, error } = await supabase.functions.invoke<AiTextResponse>('ai', {
    body: {
      system:
        'Ты делаешь подсказки для русской игры в ассоциации. Подсказка должна быть понятной подростку, короткой, на русском языке. Запрещено писать секретное слово, его часть, первую букву, длину слова или однокоренные слова.',
      prompt: `Секретное слово: "${word}". ${clueStyle} Верни только текст подсказки, без кавычек и без пояснений.`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const clue = (data?.text ?? '').trim().replace(/^["«]|["»]$/g, '');

  if (!clue || clue.toLowerCase().includes(word.toLowerCase())) {
    throw new Error('AI clue is unsafe');
  }

  return clue;
}

async function getSmartClue(word: string, clueIndex: number) {
  return getAiClue(word, clueIndex);
}

function createGuestGuess(word: string, distance: number): Guess {
  return {
    id: `${Date.now()}-${word}`,
    guess_word: word,
    created_at: new Date().toISOString(),
    distance,
  };
}

function withDistance(item: StoredGuess, targetWord: string): Guess {
  return {
    ...item,
    distance: item.distance ?? tuneSemanticDistance(getDistance(item.guess_word, targetWord), item.guess_word, targetWord),
  };
}

function loadGuestHistory(targetWord: string) {
  const saved = localStorage.getItem(getGuestHistoryKey(targetWord));
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved) as StoredGuess[];
    return parsed
      .filter((item) => item.id && item.guess_word && item.created_at)
      .map((item) => withDistance(item, targetWord));
  } catch {
    return [];
  }
}

export function ConnectionGame({
  coins,
  hintCost,
  onReward,
  onSpendCoins,
  rewardCoins,
  userEmail,
  isGuest,
}: ConnectionGameProps) {
  const [targetWord, setTargetWord] = useState(() => pickRandomWord());
  const [inputWord, setInputWord] = useState('');
  const [history, setHistory] = useState<Guess[]>([]);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [shownClues, setShownClues] = useState<string[]>([]);
  const [clueLoading, setClueLoading] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [showWordMeaning, setShowWordMeaning] = useState(false);
  const [wordMeaning, setWordMeaning] = useState('');
  const [meaningLoading, setMeaningLoading] = useState(false);
  const [meaningSource, setMeaningSource] = useState('');

  const roundFinished = status !== 'playing';
  const availableCluesCount = MAX_AI_CLUES;

  async function loadHistory() {
    if (isGuest) {
      setHistory(loadGuestHistory(targetWord));
      return;
    }

    const { data, error } = await supabase
      .from('association_guesses')
      .select('id, guess_word, created_at, distance')
      .eq('target_word', targetWord)
      .order('created_at', { ascending: false });

    if (error) {
      setMessage(error.message);
      return;
    }

    setHistory((data ?? []).map((item) => withDistance(item, targetWord)));
  }

  useEffect(() => {
    loadHistory();
  }, [isGuest, targetWord]);

  async function saveGuestAssociation(word: string, distance: number) {
    const oldHistory = loadGuestHistory(targetWord);
    const alreadySaved = oldHistory.some((item) => item.guess_word === word);
    const nextHistory = alreadySaved ? oldHistory : [createGuestGuess(word, distance), ...oldHistory];
    localStorage.setItem(getGuestHistoryKey(targetWord), JSON.stringify(nextHistory));
    setHistory(nextHistory);
  }

  async function saveSignedInAssociation(word: string, distance: number) {
    const { error } = await supabase
      .from('association_guesses')
      .upsert(
        {
          target_word: targetWord,
          guess_word: word,
          distance,
        },
        {
          onConflict: 'user_id,target_word,guess_word',
          ignoreDuplicates: true,
        },
      );

    if (error) {
      setMessage(error.message);
      return false;
    }

    await loadHistory();
    return true;
  }

  function startNextRound() {
    setTargetWord((currentWord) => pickRandomWord(currentWord));
    setInputWord('');
    setLastResult(null);
    setMessage('');
    setStatus('playing');
    setShownClues([]);
    setClueLoading(false);
    setShowAd(false);
    setShowWordMeaning(false);
    setWordMeaning('');
    setMeaningSource('');
  }

  function openAdForClue() {
    if (roundFinished || shownClues.length >= availableCluesCount) return;
    setShowAd(true);
  }

  async function revealNextClue() {
    if (roundFinished || shownClues.length >= availableCluesCount || clueLoading) return false;

    setClueLoading(true);
    setMessage('');

    try {
      const clue = await getSmartClue(targetWord, shownClues.length);
      setShownClues((currentClues) => [...currentClues, clue]);
      return true;
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'ИИ не смог сделать подсказку.');
      setMessage('ИИ сейчас недоступен. Проверь Supabase функцию ai и GEMINI_API_KEY.');
      return false;
    } finally {
      setClueLoading(false);
    }
  }

  async function closeAdAndShowClue() {
    setShowAd(false);
    await revealNextClue();
  }

  async function buyClue() {
    if (roundFinished || shownClues.length >= availableCluesCount || clueLoading) return;

    if (coins < hintCost) {
      setMessage(`Нужно ${hintCost} монет для подсказки.`);
      return;
    }

    const clueRevealed = await revealNextClue();

    if (clueRevealed && onSpendCoins()) {
      setMessage(`Подсказка куплена за ${hintCost} монет.`);
    }
  }

  function giveUp() {
    setStatus('gave-up');
    setLastResult(null);
    setInputWord('');
    setShowAd(false);
    setMessage(`Ответ был: ${targetWord}. Попробуй следующее слово.`);
  }

  async function submitWord(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const word = normalizeWord(inputWord);
    if (!word || roundFinished) return;

    setBusy(true);
    setMessage('');
    setShowWordMeaning(false);
    setWordMeaning('');
    setMeaningSource('');

    if (word === targetWord) {
      setStatus('won');
      setLastResult(null);
      onReward();
      setMessage(`Победа! Ты угадал слово: ${targetWord}. +${rewardCoins} монет.`);
      setInputWord('');
      setBusy(false);
      return;
    }

    let distance: number;

    try {
      distance = await getSmartDistance(word, targetWord);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'ИИ не смог сравнить слова.');
      setMessage('ИИ сейчас недоступен. Без ИИ Association не может сравнить слова по смыслу.');
      setBusy(false);
      return;
    }

    if (isGuest) {
      await saveGuestAssociation(word, distance);
    } else {
      const saved = await saveSignedInAssociation(word, distance);
      if (!saved) {
        setBusy(false);
        return;
      }
    }

    setLastResult({ word, distance });
    setInputWord('');
    setBusy(false);
  }

  async function toggleWordMeaning(word: string) {
    if (showWordMeaning) {
      setShowWordMeaning(false);
      return;
    }

    setShowWordMeaning(true);

    if (wordMeaning) return;

    setMeaningLoading(true);
    setMeaningSource('');

    try {
      const meaning = await fetchOzhegovMeaning(word);
      setWordMeaning(meaning);
      setMeaningSource('толковый словарь Ожегова');
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'ИИ не смог найти значение слова.');
      setWordMeaning('ИИ сейчас недоступен. Не получилось получить толковое значение слова.');
      setMeaningSource('');
    } finally {
      setMeaningLoading(false);
    }
  }

  return (
    <section className="game-shell">
      <div className="game-card">
        <p className="hello">Игрок: {userEmail}</p>
        <h2>Association</h2>
        <p className="game-subtitle">
          Введи слово. Если это секретное слово, ты выиграешь. Если нет, игра покажет
          расстояние по смыслу: чем меньше число, тем ближе твоя ассоциация к ответу.
        </p>

        <p className="guest-note">
          В словаре 1000 слов. Подсказка открывается после короткой рекламы.
        </p>

        <p className="currency-note">
          Баланс: {coins} монет. Победа дает {rewardCoins}, подсказка стоит {hintCost}.
        </p>

        <div className="target-box">
          <span>Секретное слово</span>
          <strong>{roundFinished ? targetWord : '??????'}</strong>
        </div>

        <form onSubmit={submitWord} className="guess-form">
          <input
            placeholder="ассоциация или ответ"
            value={inputWord}
            onChange={(e) => setInputWord(e.target.value)}
            disabled={busy || roundFinished}
          />
          <button type="submit" disabled={busy || roundFinished}>
            {busy ? 'Проверяем...' : 'Проверить'}
          </button>
        </form>

        <div className="round-actions">
          <button
            className="soft-button"
            onClick={buyClue}
            disabled={roundFinished || shownClues.length >= availableCluesCount || coins < hintCost || clueLoading}
            type="button"
          >
            {clueLoading ? 'Готовим...' : `Подсказка за ${hintCost} монет`}
          </button>
          <button
            className="soft-button"
            onClick={openAdForClue}
            disabled={roundFinished || shownClues.length >= availableCluesCount || showAd || clueLoading}
            type="button"
          >
            {clueLoading ? 'Готовим...' : 'Подсказка за рекламу'}
          </button>
          <button className="danger-button" onClick={giveUp} disabled={roundFinished}>
            Сдаться
          </button>
        </div>

        {shownClues.length > 0 && (
          <ul className="clue-list">
            {shownClues.map((clue) => (
              <li key={clue}>{clue}</li>
            ))}
          </ul>
        )}

        {message && (
          <p className={status === 'won' ? 'success-message' : 'message'}>{message}</p>
        )}

        {lastResult && !roundFinished && (
          <div className="result-box">
            <span>{lastResult.word}</span>
            <strong>{lastResult.distance}</strong>
            <p className="result-title">расстояние до секретного слова</p>
            <button
              className="meaning-button"
              disabled={meaningLoading}
              onClick={() => toggleWordMeaning(lastResult.word)}
              type="button"
            >
              {meaningLoading ? 'Ищем...' : 'Значение'}
            </button>
            {showWordMeaning && (
              <p className="distance-help">
                {meaningLoading ? 'Ищем значение в толковом словаре...' : wordMeaning}
                {!meaningLoading && meaningSource && (
                  <span className="meaning-source">Источник: {meaningSource}</span>
                )}
              </p>
            )}
          </div>
        )}

        {roundFinished && (
          <button className="next-button" onClick={startNextRound}>
            Новое слово
          </button>
        )}
      </div>

      <div className="history-panel">
        <h3>Твои ассоциации</h3>
        {history.length === 0 ? (
          <p className="empty">Пока пусто. Напиши первое слово.</p>
        ) : (
          <ul className="history-list">
            {history.map((item) => (
              <li key={item.id}>
                <span>{item.guess_word}</span>
                <strong>{item.distance}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showAd && <AdModal onClose={closeAdAndShowClue} />}
    </section>
  );
}
