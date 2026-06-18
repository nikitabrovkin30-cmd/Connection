import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getHardClues, SECRET_WORDS } from '../data/wordBank';
import { supabase } from '../lib/supabase';
import { AdModal } from './AdModal';

const GUEST_HISTORY_PREFIX = 'connection_guest_history';

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

function cleanMeaning(value: string) {
  return value
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWordMeaning(word: string) {
  const url = `https://ru.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(
    word,
  )}&prop=text&format=json&origin=*`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('meaning request failed');
  }

  const data = (await response.json()) as {
    parse?: {
      text?: {
        '*': string;
      };
    };
  };
  const html = data.parse?.text?.['*'];

  if (!html) {
    throw new Error('meaning not found');
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const items = Array.from(doc.querySelectorAll('.mw-parser-output ol li'));
  const definition = items
    .map((item) => cleanMeaning(item.textContent ?? ''))
    .find((text) => text.length > 20 && !text.includes('◆'));

  if (!definition) {
    throw new Error('meaning not found');
  }

  return definition;
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

function createGuestGuess(word: string, targetWord: string): Guess {
  return {
    id: `${Date.now()}-${word}`,
    guess_word: word,
    created_at: new Date().toISOString(),
    distance: getDistance(word, targetWord),
  };
}

function withDistance(item: StoredGuess, targetWord: string): Guess {
  return {
    ...item,
    distance: item.distance ?? getDistance(item.guess_word, targetWord),
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
  const [showAd, setShowAd] = useState(false);
  const [showWordMeaning, setShowWordMeaning] = useState(false);
  const [wordMeaning, setWordMeaning] = useState('');
  const [meaningLoading, setMeaningLoading] = useState(false);
  const [meaningSource, setMeaningSource] = useState('');

  const roundFinished = status !== 'playing';
  const availableClues = getHardClues(targetWord);

  async function loadHistory() {
    if (isGuest) {
      setHistory(loadGuestHistory(targetWord));
      return;
    }

    const { data, error } = await supabase
      .from('association_guesses')
      .select('id, guess_word, created_at')
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

  async function saveGuestAssociation(word: string) {
    const oldHistory = loadGuestHistory(targetWord);
    const alreadySaved = oldHistory.some((item) => item.guess_word === word);
    const nextHistory = alreadySaved ? oldHistory : [createGuestGuess(word, targetWord), ...oldHistory];
    localStorage.setItem(getGuestHistoryKey(targetWord), JSON.stringify(nextHistory));
    setHistory(nextHistory);
  }

  async function saveSignedInAssociation(word: string) {
    const { error } = await supabase
      .from('association_guesses')
      .upsert(
        {
          target_word: targetWord,
          guess_word: word,
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
    setShowAd(false);
    setShowWordMeaning(false);
    setWordMeaning('');
    setMeaningSource('');
  }

  function openAdForClue() {
    if (roundFinished || shownClues.length >= availableClues.length) return;
    setShowAd(true);
  }

  function closeAdAndShowClue() {
    setShownClues((currentClues) => [...currentClues, availableClues[currentClues.length]]);
    setShowAd(false);
  }

  function buyClue() {
    if (roundFinished || shownClues.length >= availableClues.length) return;

    if (!onSpendCoins()) {
      setMessage(`Нужно ${hintCost} монет для подсказки.`);
      return;
    }

    setShownClues((currentClues) => [...currentClues, availableClues[currentClues.length]]);
    setMessage(`Подсказка куплена за ${hintCost} монет.`);
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

    if (isGuest) {
      await saveGuestAssociation(word);
    } else {
      const saved = await saveSignedInAssociation(word);
      if (!saved) {
        setBusy(false);
        return;
      }
    }

    setLastResult({ word, distance: getDistance(word, targetWord) });
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
      const meaning = await fetchWordMeaning(word);
      setWordMeaning(meaning);
      setMeaningSource('Викисловарь');
    } catch {
      setWordMeaning(getLocalWordMeaning(word));
      setMeaningSource('локальный словарь');
    } finally {
      setMeaningLoading(false);
    }
  }

  return (
    <section className="game-shell">
      <div className="game-card">
        <p className="hello">Игрок: {userEmail}</p>
        <h2>Connection</h2>
        <p className="game-subtitle">
          Введи слово. Если это секретное слово, ты выиграешь. Если нет, игра покажет
          расстояние до ответа: чем меньше число, тем ближе твое слово.
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
            disabled={roundFinished || shownClues.length >= availableClues.length || coins < hintCost}
            type="button"
          >
            Подсказка за {hintCost} монет
          </button>
          <button
            className="soft-button"
            onClick={openAdForClue}
            disabled={roundFinished || shownClues.length >= availableClues.length || showAd}
            type="button"
          >
            Подсказка за рекламу
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
                {meaningLoading ? 'Ищем значение слова в интернете...' : wordMeaning}
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
