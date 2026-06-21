import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getHardClues, getWordCategory, getWordsForCategory, SECRET_WORDS } from '../data/wordBank';
import type { AssociationCategoryId } from '../data/wordBank';
import { supabase } from '../lib/supabase';
import { AdModal } from './AdModal';

const GUEST_HISTORY_PREFIX = 'connection_guest_history';
const CONNECTION_STATE_PREFIX = 'connection_game_state';
const AI_DISTANCE_CACHE_PREFIX = 'connection_ai_distance_v4';
const AI_CLUE_CACHE_PREFIX = 'connection_ai_clue_v3';
const AI_MEANING_CACHE_PREFIX = 'connection_ai_meaning';
const MAX_AI_CLUES = 4;

const WORD_ALIASES: Record<string, string> = {
  цветы: 'цветок',
  цветка: 'цветок',
  цветов: 'цветок',
  машины: 'машина',
  машин: 'машина',
  книги: 'книга',
  книгу: 'книга',
  звезды: 'звезда',
  звезд: 'звезда',
  деревья: 'дерево',
  деревьев: 'дерево',
  люди: 'человек',
  людей: 'человек',
};

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

type SavedConnectionState = {
  targetWord: string;
  inputWord: string;
  lastResult: LastResult | null;
  message: string;
  status: GameStatus;
  shownClues: string[];
};

type AiTextResponse = {
  text?: string;
};

function normalizeSavedClue(clue: string) {
  if (clue.includes('Близкое слово') || isGenericClue(clue)) {
    return '';
  }

  return clue;
}

function isStaleCloseWordClue(clue: string) {
  return clue.includes('Близкое слово');
}

function isGenericClue(clue: string) {
  const normalizedClue = clue.toLowerCase();
  const blockedParts = [
    'подумай',
    'ищи среди',
    'тема',
    'связано',
    'связан',
    'это может быть',
    'где это встречается',
    'для чего это обычно нужно',
    'предмете, месте, природе',
    'людей, чувств, событий',
    'продуктов, напитков',
    'воды, неба, погоды',
    'вещей, которые можно',
    'конкретных предметов',
    'категори',
  ];

  return blockedParts.some((part) => normalizedClue.includes(part));
}

type ConnectionGameProps = {
  categoryId: AssociationCategoryId;
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

function normalizeAssociationWord(value: string) {
  const word = normalizeWord(value).replace(/ё/g, 'е');
  return WORD_ALIASES[word] ?? word;
}

function readCacheValue(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeCacheValue(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // If storage is full or blocked, the game can still use AI/local fallback.
  }
}

function getDistanceCacheKey(word: string, targetWord: string) {
  return `${AI_DISTANCE_CACHE_PREFIX}_${normalizeAssociationWord(targetWord)}_${normalizeAssociationWord(word)}`;
}

function getClueCacheKey(word: string, clueIndex: number) {
  return `${AI_CLUE_CACHE_PREFIX}_${normalizeAssociationWord(word)}_${clueIndex}`;
}

function getMeaningCacheKey(word: string) {
  return `${AI_MEANING_CACHE_PREFIX}_${normalizeAssociationWord(word)}`;
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

async function fetchOzhegovMeaning(word: string) {
  const cacheKey = getMeaningCacheKey(word);
  const cachedMeaning = readCacheValue(cacheKey);

  if (cachedMeaning) {
    return cachedMeaning;
  }

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

  writeCacheValue(cacheKey, meaning);
  return meaning;
}

function pickRandomWord(categoryId: AssociationCategoryId, currentWord?: string) {
  const categoryWords = getWordsForCategory(categoryId);
  const options = categoryWords.filter((word) => word !== currentWord);
  const words = options.length > 0 ? options : categoryWords;
  return words[Math.floor(Math.random() * words.length)];
}

function getGuestHistoryKey(targetWord: string) {
  return `${GUEST_HISTORY_PREFIX}_${targetWord}`;
}

function getConnectionStateKey(userEmail: string, categoryId: AssociationCategoryId) {
  return `${CONNECTION_STATE_PREFIX}_${userEmail}_${categoryId}`;
}

function isGameStatus(value: unknown): value is GameStatus {
  return value === 'playing' || value === 'won' || value === 'gave-up';
}

function loadConnectionState(userEmail: string, categoryId: AssociationCategoryId): SavedConnectionState | null {
  const saved = localStorage.getItem(getConnectionStateKey(userEmail, categoryId));
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<SavedConnectionState>;

    if (
      typeof parsed.targetWord !== 'string' ||
      !(SECRET_WORDS as readonly string[]).includes(parsed.targetWord) ||
      !(getWordsForCategory(categoryId) as readonly string[]).includes(parsed.targetWord) ||
      !isGameStatus(parsed.status)
    ) {
      return null;
    }

    const parsedLastResult = parsed.lastResult;
    const lastResult =
      parsedLastResult &&
      typeof parsedLastResult.word === 'string' &&
      typeof parsedLastResult.distance === 'number'
        ? parsedLastResult
        : null;

    return {
      targetWord: parsed.targetWord,
      inputWord: typeof parsed.inputWord === 'string' ? parsed.inputWord : '',
      lastResult,
      message: typeof parsed.message === 'string' ? parsed.message : '',
      status: parsed.status,
      shownClues: Array.isArray(parsed.shownClues)
        ? parsed.shownClues
            .filter((clue): clue is string => typeof clue === 'string')
            .map(normalizeSavedClue)
            .filter((clue) => clue.length > 0 && !isGenericClue(clue))
        : [],
    };
  } catch {
    return null;
  }
}

function getStableNoise(word: string, targetWord: string) {
  const seed = `${targetWord}:${word}`;
  const total = Array.from(seed).reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  return total % 11;
}

const TOPIC_WORDS: Record<string, readonly string[]> = {
  material: ['резина', 'шина', 'колесо', 'машина', 'ремонт', 'завод', 'железо', 'стекло', 'ткань', 'сверло', 'шланг', 'мотор', 'техника', 'сапог', 'ремень', 'металл', 'бетон', 'кирпич', 'глина', 'камень', 'доска'],
  entertainment: ['развлечение', 'игра', 'кино', 'театр', 'музыка', 'танец', 'спорт', 'праздник', 'шутка', 'хобби', 'фокус', 'артист', 'афиша'],
  food: ['еда', 'хлеб', 'молоко', 'яблоко', 'банан', 'сахар', 'чай', 'суп', 'сыр', 'мясо', 'овощ', 'фрукт', 'пирог', 'каша', 'салат', 'соль', 'орех', 'мед', 'перец'],
  nature: ['лес', 'вода', 'море', 'река', 'солнце', 'луна', 'звезда', 'камень', 'трава', 'дерево', 'ветер', 'снег', 'цветок', 'цветы', 'ягода', 'птица', 'рыба', 'гора', 'облако', 'дождь', 'болото', 'берег', 'песок', 'олень', 'лось', 'заяц', 'лиса', 'волк', 'медведь', 'ежик', 'акула', 'кит', 'орел'],
  animal: ['олень', 'лось', 'заяц', 'лиса', 'волк', 'медведь', 'ежик', 'акула', 'кит', 'орел', 'птица', 'рыба', 'собака', 'кошка', 'корова', 'тигр', 'лев', 'змея'],
  bird: ['птица', 'гусь', 'павлин', 'орел', 'лебедь', 'курица', 'петух', 'индюк', 'страус', 'ворона', 'сорока', 'голубь', 'галка', 'скворец', 'воробей', 'пеликан', 'цапля', 'попугай'],
  place: ['дом', 'школа', 'город', 'парк', 'улица', 'магазин', 'класс', 'комната', 'театр', 'гараж', 'завод', 'музей', 'кафе', 'двор', 'аэропорт', 'вокзал', 'библиотека'],
  transport: ['машина', 'поезд', 'самолет', 'автобус', 'велосипед', 'вагон', 'ракета', 'корабль', 'лодка', 'трамвай', 'метро', 'колесо', 'шина', 'мотор'],
  person: ['человек', 'друг', 'семья', 'мама', 'папа', 'учитель', 'врач', 'актер', 'автор', 'герой', 'ребенок', 'дедушка', 'бабушка'],
  feeling: ['любовь', 'радость', 'страх', 'грусть', 'скука', 'счастье', 'надежда', 'вера', 'смелость', 'тревога', 'удивление'],
  object: ['книга', 'телефон', 'стол', 'стул', 'шкаф', 'лампа', 'кровать', 'диван', 'ручка', 'тетрадь', 'нож', 'часы', 'сумка', 'мяч'],
};

const ASSOCIATION_COMPARISON_WORD_TARGET = 5000;

const CATEGORY_TOPIC_IDS: Partial<Record<AssociationCategoryId, readonly string[]>> = {
  природа: ['nature', 'animal', 'bird'],
  еда: ['food'],
  место: ['place'],
  предмет: ['object'],
  материал: ['material', 'transport'],
  человек: ['person', 'feeling', 'entertainment'],
};

function addComparisonWord(topicWords: Record<string, Set<string>>, topic: string, word: string) {
  const normalizedWord = normalizeAssociationWord(word);
  if (!/^[а-я]+$/.test(normalizedWord)) return;

  topicWords[topic] ??= new Set<string>();
  topicWords[topic].add(normalizedWord);
}

function addComparisonForms(topicWords: Record<string, Set<string>>, topic: string, word: string) {
  const normalizedWord = normalizeAssociationWord(word);
  if (!/^[а-я]+$/.test(normalizedWord)) return;

  addComparisonWord(topicWords, topic, normalizedWord);

  const lastLetter = normalizedWord[normalizedWord.length - 1];
  const base = normalizedWord.slice(0, -1);
  const endingsByLastLetter: Record<string, readonly string[]> = {
    а: ['ы', 'е', 'у', 'ой', 'ою'],
    я: ['и', 'е', 'ю', 'ей', 'ею'],
    о: ['а', 'у', 'е', 'ом'],
    е: ['я', 'ю', 'ем'],
    ь: ['я', 'ю', 'ем', 'и', 'е'],
    й: ['я', 'ю', 'ем', 'и', 'е'],
  };

  endingsByLastLetter[lastLetter]?.forEach((ending) => {
    addComparisonWord(topicWords, topic, `${base}${ending}`);
  });

  if (lastLetter && !'аеёиоуыэюяьй'.includes(lastLetter)) {
    ['а', 'у', 'е', 'ом', 'ы'].forEach((ending) => {
      addComparisonWord(topicWords, topic, `${normalizedWord}${ending}`);
    });
  }
}

function getComparisonWordCount(topicWords: Record<string, Set<string>>) {
  return new Set(Object.values(topicWords).flatMap((words) => Array.from(words))).size;
}

function fillComparisonWords(topicWords: Record<string, Set<string>>) {
  const topics = Object.keys(topicWords);
  const starts = ['б', 'в', 'г', 'д', 'ж', 'з', 'к', 'л', 'м', 'н', 'п', 'р', 'с', 'т', 'ф', 'х', 'ц', 'ч', 'ш'];
  const middles = [
    'а', 'е', 'и', 'о', 'у', 'ы', 'я',
    'ак', 'ал', 'ан', 'ар', 'ас', 'ат', 'ед', 'ел', 'ен', 'ер', 'ес', 'ет', 'ик', 'ил', 'ин', 'ир',
    'ис', 'ит', 'ок', 'ол', 'он', 'ор', 'ос', 'от', 'ук', 'ул', 'ун', 'ур', 'ус', 'ут',
  ];
  const ends = [
    'а', 'е', 'и', 'о', 'у', 'ы', 'я',
    'ак', 'ал', 'ам', 'ан', 'ар', 'ас', 'ат', 'ей', 'ек', 'ел', 'ем', 'ен', 'ер', 'ес', 'ет',
    'ик', 'ил', 'им', 'ин', 'ир', 'ис', 'ит', 'ка', 'ки', 'ок', 'ол', 'ом', 'он', 'ор', 'ос',
    'от', 'та', 'ты', 'ца', 'чик', 'ник', 'арь', 'ель',
  ];
  let topicIndex = 0;

  for (const start of starts) {
    for (const middle of middles) {
      for (const end of ends) {
        const word = `${start}${middle}${end}`;

        if (word.length >= 4 && word.length <= 8) {
          addComparisonWord(topicWords, topics[topicIndex % topics.length], word);
          topicIndex += 1;
        }

        if (getComparisonWordCount(topicWords) >= ASSOCIATION_COMPARISON_WORD_TARGET) return;
      }
    }
  }
}

function createComparisonTopicWords() {
  const topicWords: Record<string, Set<string>> = {};

  Object.entries(TOPIC_WORDS).forEach(([topic, words]) => {
    words.forEach((word) => addComparisonForms(topicWords, topic, word));
  });

  Object.entries(CATEGORY_TOPIC_IDS).forEach(([categoryId, topics]) => {
    getWordsForCategory(categoryId as AssociationCategoryId).forEach((word) => {
      topics.forEach((topic) => addComparisonForms(topicWords, topic, word));
    });
  });

  fillComparisonWords(topicWords);
  return topicWords;
}

const COMPARISON_TOPIC_WORDS = createComparisonTopicWords();

function getWordTopics(word: string) {
  const normalizedWord = normalizeAssociationWord(word);

  return Object.entries(COMPARISON_TOPIC_WORDS)
    .filter(([, words]) => words.has(normalizedWord))
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
  if (getWordCategory(word).title === getWordCategory(targetWord).title && distance > 67) return 67;
  if (!hasSharedTopic(word, targetWord) && distance < 68) return 72;
  return distance;
}

function getLocalSemanticDistance(word: string, targetWord: string) {
  const normalizedWord = normalizeAssociationWord(word);
  const normalizedTarget = normalizeAssociationWord(targetWord);

  if (normalizedWord === normalizedTarget) return 2;

  const wordTopics = getWordTopics(normalizedWord);
  const targetTopics = getWordTopics(normalizedTarget);
  const sharedTopics = wordTopics.filter((topic) => targetTopics.includes(topic));
  const noise = getStableNoise(normalizedWord, normalizedTarget);

  if (sharedTopics.length > 0) {
    return Math.max(12, Math.min(45, 22 + sharedTopics.length * 3 + noise));
  }

  if (wordTopics.length > 0 && targetTopics.length > 0) {
    return Math.min(67, 55 + noise);
  }

  return Math.min(99, 82 + noise);
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
  const cacheKey = getDistanceCacheKey(word, targetWord);
  const cachedDistance = Number(readCacheValue(cacheKey));

  if (Number.isFinite(cachedDistance) && cachedDistance >= 2 && cachedDistance <= 99) {
    return cachedDistance;
  }

  const { data, error } = await supabase.functions.invoke<AiTextResponse>('ai', {
    body: {
      system:
        'Ты оцениваешь русские слова для игры Association. Верни только JSON вида {"distance": число}. Поле distance всегда должно быть целым числом от 2 до 99. Оценивай только смысл, тему и обычные ассоциации, не похожесть букв. 2-10 почти синоним или часть одного предмета, 11-25 очень близкая ассоциация, 26-45 та же тема, 46-67 слабая связь. 68-99 ставь только если слова из разных больших категорий. Если слова из одной большой категории, даже при слабой связи число не должно быть больше 67. Не делай абстрактные слова слишком близкими к конкретным предметам. Пример: секрет "резина", игрок "шина" = 12, "колесо" = 22, "машина" = 35, "развлечение" = 82, "музыка" = 88. Пример: секрет "олень", игрок "лось" = 15, "лес" = 29, "рога" = 18, "машина" = 78.',
      prompt: `Секретное слово: "${targetWord}". Слово игрока: "${word}". Верни только JSON, например {"distance": 80}.`,
      json: true,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const distance = parseDistance(data?.text ?? '');
  if (distance === null) {
    throw new Error('AI did not return distance');
  }

  const tunedDistance = tuneSemanticDistance(distance, word, targetWord);
  writeCacheValue(cacheKey, String(tunedDistance));
  return tunedDistance;
}

async function getSmartDistance(word: string, targetWord: string) {
  try {
    return await getSemanticDistance(word, targetWord);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'ИИ не смог сравнить слова.');
    return getLocalSemanticDistance(word, targetWord);
  }
}

async function getAiClue(word: string, clueIndex: number) {
  const cacheKey = getClueCacheKey(word, clueIndex);
  const cachedClue = readCacheValue(cacheKey);

  if (cachedClue && !isStaleCloseWordClue(cachedClue) && !isGenericClue(cachedClue)) {
    return cachedClue;
  }

  const clueStyle = [
    'Дай короткую тематическую подсказку без близкого слова. Опиши область, где можно встретить ответ, но не называй сам ответ, его часть, первую букву или однокоренные слова.',
    'Дай простую ситуацию, где это можно встретить или использовать. Не называй само слово.',
    'Дай 2-3 близкие ассоциации, но не само слово и не однокоренные слова.',
  ][clueIndex] ?? 'Дай понятную подсказку, не называя само слово.';

  const { data, error } = await supabase.functions.invoke<AiTextResponse>('ai', {
    body: {
      system:
        'Ты делаешь подсказки для русской игры в ассоциации. Подсказка должна быть понятной подростку, короткой, на русском языке. Запрещено писать секретное слово, его часть, первую букву или однокоренные слова. Если просят близкое слово, оно должно быть связано по смыслу, а не по буквам.',
      prompt: `Секретное слово: "${word}". ${clueStyle} Верни только текст подсказки, без кавычек и без пояснений.`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const clue = (data?.text ?? '').trim().replace(/^["«]|["»]$/g, '');

  if (!clue || clue.toLowerCase().includes(word.toLowerCase()) || isGenericClue(clue)) {
    throw new Error('AI clue is unsafe');
  }

  writeCacheValue(cacheKey, clue);
  return clue;
}

async function getSmartClue(word: string, clueIndex: number) {
  if (clueIndex >= 2) {
    return getHardClues(word)[clueIndex] ?? 'Открой еще одну подсказку позже.';
  }

  try {
    return await getAiClue(word, clueIndex);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'ИИ не смог сделать подсказку.');
    return getHardClues(word)[clueIndex] ?? 'Попробуй слово из той же темы.';
  }
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
    distance: item.distance ?? getLocalSemanticDistance(item.guess_word, targetWord),
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
  categoryId,
  coins,
  hintCost,
  onReward,
  onSpendCoins,
  rewardCoins,
  userEmail,
  isGuest,
}: ConnectionGameProps) {
  const savedState = loadConnectionState(userEmail, categoryId);
  const [targetWord, setTargetWord] = useState(() => savedState?.targetWord ?? pickRandomWord(categoryId));
  const [inputWord, setInputWord] = useState(() => savedState?.inputWord ?? '');
  const [history, setHistory] = useState<Guess[]>([]);
  const [lastResult, setLastResult] = useState<LastResult | null>(() => savedState?.lastResult ?? null);
  const [message, setMessage] = useState(() => savedState?.message ?? '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<GameStatus>(() => savedState?.status ?? 'playing');
  const [shownClues, setShownClues] = useState<string[]>(() => savedState?.shownClues ?? []);
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

  useEffect(() => {
    localStorage.setItem(
      getConnectionStateKey(userEmail, categoryId),
      JSON.stringify({
        targetWord,
        inputWord,
        lastResult,
        message,
        status,
        shownClues,
      } satisfies SavedConnectionState),
    );
  }, [categoryId, inputWord, lastResult, message, shownClues, status, targetWord, userEmail]);

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
    setTargetWord((currentWord) => pickRandomWord(categoryId, currentWord));
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
    setMessage('Ты сдался. Попробуй следующее слово.');
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

    if (normalizeAssociationWord(word) === normalizeAssociationWord(targetWord)) {
      setStatus('won');
      setLastResult(null);
      onReward();
      setMessage(`Победа! +${rewardCoins} монет.`);
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
        <h2>Association</h2>
        <p className="game-subtitle">
          Введи слово. Если это секретное слово, ты выиграешь. Если нет, игра покажет
          расстояние по смыслу: чем меньше число, тем ближе твоя ассоциация к ответу.
        </p>

        <p className="guest-note">
          В словаре {SECRET_WORDS.length} слов. Подсказка открывается после короткой рекламы.
        </p>

        <p className="currency-note">
          Баланс: {coins} монет. Победа дает {rewardCoins}, подсказка стоит {hintCost}.
        </p>

        <div className="target-box">
          <span>Секретное слово</span>
          <strong>??????</strong>
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
          <>
            <div className={status === 'won' ? 'answer-reveal solved' : 'answer-reveal gave-up'}>
              <span>{status === 'won' ? 'Правильное слово' : 'Ответ был'}</span>
              <strong>{targetWord}</strong>
            </div>
            <button className="next-button" onClick={startNextRound}>
              Новое слово
            </button>
          </>
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
