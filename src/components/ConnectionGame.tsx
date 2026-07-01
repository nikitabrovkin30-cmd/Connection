import { useEffect, useMemo, useState } from 'react';
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

type ClueProgress = 'start' | 'middle' | 'close';

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
  uiLanguage: 'ru' | 'kk' | 'en';
  userEmail: string;
  isGuest: boolean;
};

type UiLanguage = ConnectionGameProps['uiLanguage'];

const ASSOCIATION_WORDS_BY_LANGUAGE: Record<Exclude<UiLanguage, 'ru'>, Record<AssociationCategoryId, string[]>> = {
  en: {
    all: [],
    природа: [
      'river', 'ocean', 'forest', 'mountain', 'cloud', 'storm', 'flower', 'grass', 'planet', 'island',
      'desert', 'valley', 'winter', 'summer', 'sun', 'moon', 'star', 'rain', 'snow', 'wind',
    ],
    еда: [
      'apple', 'bread', 'cheese', 'honey', 'lemon', 'orange', 'tomato', 'carrot', 'pepper', 'cookie',
      'milk', 'sugar', 'coffee', 'tea', 'water', 'cake', 'banana', 'grape', 'potato', 'salad',
    ],
    место: [
      'school', 'market', 'museum', 'castle', 'garden', 'bridge', 'airport', 'library', 'theater', 'village',
      'city', 'park', 'beach', 'room', 'house', 'street', 'station', 'garage', 'cafe', 'office',
    ],
    предмет: [
      'chair', 'table', 'phone', 'camera', 'guitar', 'bottle', 'basket', 'pillow', 'window', 'wallet',
      'screen', 'button', 'letter', 'ticket', 'pencil', 'brush', 'knife', 'spoon', 'plate', 'lamp',
    ],
    материал: [
      'metal', 'wood', 'glass', 'paper', 'stone', 'silver', 'gold', 'plastic', 'cotton', 'rubber',
      'steel', 'brick', 'clay', 'fabric', 'leather', 'wool', 'sand', 'carbon', 'copper', 'iron',
    ],
    человек: [
      'friend', 'family', 'doctor', 'teacher', 'artist', 'player', 'pilot', 'writer', 'singer', 'driver',
      'mother', 'father', 'child', 'guest', 'hero', 'worker', 'leader', 'neighbor', 'student', 'people',
    ],
  },
  kk: {
    all: [],
    природа: [
      'өзен', 'теңіз', 'орман', 'тау', 'бұлт', 'дауыл', 'гүл', 'шөп', 'ғаламшар', 'арал',
      'шөл', 'аңғар', 'қыс', 'жаз', 'күн', 'ай', 'жұлдыз', 'жаңбыр', 'қар', 'жел',
    ],
    еда: [
      'алма', 'нан', 'ірімшік', 'бал', 'лимон', 'апельсин', 'қызанақ', 'сәбіз', 'бұрыш', 'печенье',
      'сүт', 'қант', 'кофе', 'шай', 'су', 'торт', 'банан', 'жүзім', 'картоп', 'салат',
    ],
    место: [
      'мектеп', 'базар', 'музей', 'сарай', 'бақ', 'көпір', 'әуежай', 'кітапхана', 'театр', 'ауыл',
      'қала', 'саябақ', 'жағажай', 'бөлме', 'үй', 'көше', 'бекет', 'гараж', 'кафе', 'кеңсе',
    ],
    предмет: [
      'орындық', 'үстел', 'телефон', 'камера', 'гитара', 'бөтелке', 'себет', 'жастық', 'терезе', 'әмиян',
      'экран', 'батырма', 'хат', 'билет', 'қарындаш', 'қылқалам', 'пышақ', 'қасық', 'тәрелке', 'шам',
    ],
    материал: [
      'металл', 'ағаш', 'әйнек', 'қағаз', 'тас', 'күміс', 'алтын', 'пластик', 'мақта', 'резеңке',
      'болат', 'кірпіш', 'саз', 'мата', 'тері', 'жүн', 'құм', 'көміртек', 'мыс', 'темір',
    ],
    человек: [
      'дос', 'отбасы', 'дәрігер', 'мұғалім', 'суретші', 'ойыншы', 'ұшқыш', 'жазушы', 'әнші', 'жүргізуші',
      'ана', 'әке', 'бала', 'қонақ', 'батыр', 'жұмысшы', 'көшбасшы', 'көрші', 'оқушы', 'адамдар',
    ],
  },
};

ASSOCIATION_WORDS_BY_LANGUAGE.en.all = Array.from(new Set(
  Object.entries(ASSOCIATION_WORDS_BY_LANGUAGE.en)
    .filter(([category]) => category !== 'all')
    .flatMap(([, words]) => words),
));

ASSOCIATION_WORDS_BY_LANGUAGE.kk.all = Array.from(new Set(
  Object.entries(ASSOCIATION_WORDS_BY_LANGUAGE.kk)
    .filter(([category]) => category !== 'all')
    .flatMap(([, words]) => words),
));

function getAssociationWords(categoryId: AssociationCategoryId, language: UiLanguage) {
  if (language === 'ru') return getWordsForCategory(categoryId);
  return ASSOCIATION_WORDS_BY_LANGUAGE[language][categoryId];
}

function getAssociationWordCount(language: UiLanguage) {
  return language === 'ru' ? SECRET_WORDS.length : ASSOCIATION_WORDS_BY_LANGUAGE[language].all.length;
}

const CONNECTION_UI_TEXT = {
  ru: {
    player: 'Игрок',
    subtitle: 'Введи слово. Если это секретное слово, ты выиграешь. Если нет, игра покажет расстояние по смыслу: чем меньше число, тем ближе твоя ассоциация к ответу.',
    dictionary: (count: number) => `В словаре ${count} слов. Подсказка открывается после короткой рекламы.`,
    balance: (coins: number, reward: number, cost: number) => `Баланс: ${coins} монет. Победа дает ${reward}, подсказка стоит ${cost}.`,
    secretWord: 'Секретное слово',
    input: 'ассоциация или ответ',
    checking: 'Проверяем...',
    check: 'Проверить',
    preparing: 'Готовим...',
    hintCoins: (cost: number) => `Подсказка за ${cost} монет`,
    hintAd: 'Подсказка за рекламу',
    giveUp: 'Сдаться',
    distance: 'расстояние до секретного слова',
    searching: 'Ищем...',
    meaning: 'Значение',
    searchingMeaning: 'Ищем значение в толковом словаре...',
    source: 'Источник',
    correctWord: 'Правильное слово',
    answerWas: 'Ответ был',
    newWord: 'Новое слово',
    historyTitle: 'Твои ассоциации',
    emptyHistory: 'Пока пусто. Напиши первое слово.',
    noMoreHints: 'Все разные подсказки уже открыты.',
    aiHintError: 'ИИ сейчас недоступен. Проверь Supabase функцию ai и GEMINI_API_KEY.',
    needCoins: (cost: number) => `Нужно ${cost} монет для подсказки.`,
    hintBought: (cost: number) => `Подсказка куплена за ${cost} монет.`,
    adHintOpened: 'Реклама просмотрена. Подсказка открыта.',
    win: (reward: number) => `Победа! +${reward} монет.`,
    aiDistanceError: 'ИИ сейчас недоступен. Без ИИ Association не может сравнить слова по смыслу.',
  },
  kk: {
    player: 'Ойыншы',
    subtitle: 'Сөз енгіз. Егер бұл жасырын сөз болса, сен жеңесің. Егер болмаса, ойын мағына бойынша арақашықтықты көрсетеді: сан аз болған сайын жауапқа жақын.',
    dictionary: (count: number) => `Сөздікте ${count} сөз бар. Кеңес қысқа жарнамадан кейін ашылады.`,
    balance: (coins: number, reward: number, cost: number) => `Баланс: ${coins} монета. Жеңіс ${reward} береді, кеңес ${cost} тұрады.`,
    secretWord: 'Жасырын сөз',
    input: 'ассоциация немесе жауап',
    checking: 'Тексерілуде...',
    check: 'Тексеру',
    preparing: 'Дайындауда...',
    hintCoins: (cost: number) => `${cost} монетаға кеңес`,
    hintAd: 'Жарнама арқылы кеңес',
    giveUp: 'Берілу',
    distance: 'жасырын сөзге дейінгі арақашықтық',
    searching: 'Ізделуде...',
    meaning: 'Мағынасы',
    searchingMeaning: 'Мағынасы сөздіктен ізделуде...',
    source: 'Дереккөз',
    correctWord: 'Дұрыс сөз',
    answerWas: 'Жауап',
    newWord: 'Жаңа сөз',
    historyTitle: 'Сенің ассоциацияларың',
    emptyHistory: 'Әзірге бос. Бірінші сөзді жаз.',
    noMoreHints: 'Барлық әртүрлі кеңестер ашылды.',
    aiHintError: 'ИИ қазір қолжетімсіз. Supabase ai функциясын және GEMINI_API_KEY тексер.',
    needCoins: (cost: number) => `Кеңес үшін ${cost} монета керек.`,
    hintBought: (cost: number) => `Кеңес ${cost} монетаға сатып алынды.`,
    adHintOpened: 'Жарнама қаралды. Кеңес ашылды.',
    win: (reward: number) => `Жеңіс! +${reward} монета.`,
    aiDistanceError: 'ИИ қазір қолжетімсіз. ИИ болмаса Association сөздерді мағына бойынша салыстыра алмайды.',
  },
  en: {
    player: 'Player',
    subtitle: 'Enter a word. If it is the secret word, you win. If not, the game shows semantic distance: the smaller the number, the closer your association is.',
    dictionary: (count: number) => `The dictionary has ${count} words. A hint opens after a short ad.`,
    balance: (coins: number, reward: number, cost: number) => `Balance: ${coins} coins. A win gives ${reward}, a hint costs ${cost}.`,
    secretWord: 'Secret word',
    input: 'association or answer',
    checking: 'Checking...',
    check: 'Check',
    preparing: 'Preparing...',
    hintCoins: (cost: number) => `Hint for ${cost} coins`,
    hintAd: 'Hint for ad',
    giveUp: 'Give up',
    distance: 'distance to the secret word',
    searching: 'Searching...',
    meaning: 'Meaning',
    searchingMeaning: 'Searching meaning in the dictionary...',
    source: 'Source',
    correctWord: 'Correct word',
    answerWas: 'Answer was',
    newWord: 'New word',
    historyTitle: 'Your associations',
    emptyHistory: 'Empty for now. Write the first word.',
    noMoreHints: 'All different hints are already open.',
    aiHintError: 'AI is unavailable. Check the Supabase ai function and GEMINI_API_KEY.',
    needCoins: (cost: number) => `You need ${cost} coins for a hint.`,
    hintBought: (cost: number) => `Hint bought for ${cost} coins.`,
    adHintOpened: 'Ad watched. Hint opened.',
    win: (reward: number) => `Win! +${reward} coins.`,
    aiDistanceError: 'AI is unavailable. Association cannot compare words by meaning without AI.',
  },
} as const;

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

function getClueProgress(bestDistance?: number): ClueProgress {
  if (typeof bestDistance !== 'number') return 'start';
  if (bestDistance <= 25) return 'close';
  if (bestDistance <= 55) return 'middle';
  return 'start';
}

function getClueCacheKey(word: string, clueIndex: number, progress: ClueProgress) {
  return `${AI_CLUE_CACHE_PREFIX}_${normalizeAssociationWord(word)}_${clueIndex}_${progress}`;
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

function pickRandomWord(categoryId: AssociationCategoryId, language: UiLanguage, currentWord?: string) {
  const categoryWords = getAssociationWords(categoryId, language);
  const options = categoryWords.filter((word) => word !== currentWord);
  const words = options.length > 0 ? options : categoryWords;
  return words[Math.floor(Math.random() * words.length)];
}

function getGuestHistoryKey(targetWord: string) {
  return `${GUEST_HISTORY_PREFIX}_${targetWord}`;
}

function getConnectionStateKey(userEmail: string, categoryId: AssociationCategoryId, language: UiLanguage) {
  return `${CONNECTION_STATE_PREFIX}_${userEmail}_${language}_${categoryId}`;
}

function isGameStatus(value: unknown): value is GameStatus {
  return value === 'playing' || value === 'won' || value === 'gave-up';
}

function loadConnectionState(userEmail: string, categoryId: AssociationCategoryId, language: UiLanguage): SavedConnectionState | null {
  const saved = localStorage.getItem(getConnectionStateKey(userEmail, categoryId, language));
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

async function getSemanticDistance(word: string, targetWord: string, language: UiLanguage) {
  const languageName = language === 'en' ? 'English' : language === 'kk' ? 'Kazakh' : 'Russian';
  const cacheKey = getDistanceCacheKey(word, targetWord);
  const cachedDistance = Number(readCacheValue(cacheKey));

  if (Number.isFinite(cachedDistance) && cachedDistance >= 2 && cachedDistance <= 99) {
    return cachedDistance;
  }

  const { data, error } = await supabase.functions.invoke<AiTextResponse>('ai', {
    body: {
      system:
        'Ты оцениваешь русские слова для игры Association. Верни только JSON вида {"distance": число}. Поле distance всегда должно быть целым числом от 2 до 99. Оценивай только смысл, тему и обычные ассоциации, не похожесть букв. 2-10 почти синоним или часть одного предмета, 11-25 очень близкая ассоциация, 26-45 та же тема, 46-67 слабая связь. 68-99 ставь только если слова из разных больших категорий. Если слова из одной большой категории, даже при слабой связи число не должно быть больше 67. Не делай абстрактные слова слишком близкими к конкретным предметам. Пример: секрет "резина", игрок "шина" = 12, "колесо" = 22, "машина" = 35, "развлечение" = 82, "музыка" = 88. Пример: секрет "олень", игрок "лось" = 15, "лес" = 29, "рога" = 18, "машина" = 78.',
      prompt: `Language: ${languageName}. Secret word: "${targetWord}". Player word: "${word}". Compare only meaning, topic and common associations in this language, not letters. Return only JSON, for example {"distance": 80}.`,
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

async function getSmartDistance(word: string, targetWord: string, language: UiLanguage) {
  try {
    return await getSemanticDistance(word, targetWord, language);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'ИИ не смог сравнить слова.');
    return getLocalSemanticDistance(word, targetWord);
  }
}

async function getAiClue(word: string, clueIndex: number, bestDistance: number | undefined, language: UiLanguage) {
  const progress = getClueProgress(bestDistance);
  const languageName = language === 'en' ? 'English' : language === 'kk' ? 'Kazakh' : 'Russian';
  const cacheKey = getClueCacheKey(`${languageName}-${word}`, clueIndex, progress);
  const cachedClue = readCacheValue(cacheKey);

  if (cachedClue && !isStaleCloseWordClue(cachedClue) && !isGenericClue(cachedClue)) {
    return cachedClue;
  }

  const clueStyleByProgress: Record<ClueProgress, readonly string[]> = {
    start: [
      'Игрок еще далеко или только начал. Дай базовую подсказку по широкой теме: где это обычно встречается или к какой области относится. Не делай подсказку слишком прямой.',
      'Игрок еще не близко. Дай простую жизненную ситуацию, где это можно встретить, но не называй ответ.',
      'Дай мягкую подсказку через назначение или роль ответа, без букв и без близкого слова.',
    ],
    middle: [
      'Игрок уже в правильной стороне. Дай более полезную подсказку: уточни подгруппу, материал, действие или место, связанное с ответом.',
      'Игрок уже близко к теме. Дай конкретную ситуацию использования или узнаваемый признак, но не раскрывай слово.',
      'Дай одну сильную ассоциацию и один признак ответа, но не само слово и не однокоренные слова.',
    ],
    close: [
      'Игрок почти разгадал. Дай очень полезную подсказку: укажи главное отличие ответа от близких слов, но не называй ответ, его часть, первую букву или однокоренные слова.',
      'Игрок очень близко. Дай точный признак, функцию или контекст, который помогает выбрать именно секретное слово среди похожих.',
      'Дай подсказку через форму, действие или типичный пример, чтобы можно было добить ответ, но не раскрывай слово.',
    ],
  };
  const clueStyle = `${clueStyleByProgress[progress][clueIndex] ?? 'Дай понятную подсказку, не называя само слово.'} Write the hint in ${languageName}.`;

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

function getLocalLetterClue(word: string, clueIndex: number, progress: ClueProgress, language: UiLanguage = 'ru') {
  if (language === 'en') {
    const letters = Array.from(word);
    const visibleIndex = clueIndex % letters.length;
    const pattern = letters.map((letter, index) => (index === visibleIndex ? letter : '_')).join(' ');
    return `The word has ${letters.length} letters. Opened pattern: ${pattern}.`;
  }

  if (language === 'kk') {
    const letters = Array.from(word);
    const visibleIndex = clueIndex % letters.length;
    const pattern = letters.map((letter, index) => (index === visibleIndex ? letter : '_')).join(' ');
    return `�?��� ${letters.length} ?�� ���. ����?�� ?��: ${pattern}.`;
  }

  const hardClues = getHardClues(word);
  const localIndex = progress === 'close' ? clueIndex + 2 : clueIndex;
  const fallbackIndex = localIndex % hardClues.length;

  return hardClues[localIndex] ?? hardClues[fallbackIndex] ?? `В слове ${Array.from(word).length} букв.`;
}

function normalizeClueText(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
}

function getUniqueLocalLetterClue(word: string, clueIndex: number, progress: ClueProgress, shownClues: readonly string[], language: UiLanguage = 'ru') {
  const shownClueTexts = new Set(shownClues.map(normalizeClueText));
  const hardClues = getHardClues(word);

  for (let offset = 0; offset < hardClues.length; offset += 1) {
    const clue = getLocalLetterClue(word, clueIndex + offset, progress, language);
    if (!shownClueTexts.has(normalizeClueText(clue))) return clue;
  }

  return `В слове ${Array.from(word).length} букв.`;
}

async function getSmartClue(word: string, clueIndex: number, bestDistance: number | undefined, language: UiLanguage) {
  const progress = getClueProgress(bestDistance);

  if (clueIndex >= 2) {
    return getLocalLetterClue(word, clueIndex, progress, language);
  }

  try {
    return await getAiClue(word, clueIndex, bestDistance, language);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'ИИ не смог сделать подсказку.');
    return getLocalLetterClue(word, clueIndex, progress, language);
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

function sortGuessesByDistance(guesses: Guess[]) {
  return [...guesses].sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function loadGuestHistory(targetWord: string) {
  const saved = localStorage.getItem(getGuestHistoryKey(targetWord));
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved) as StoredGuess[];
    return sortGuessesByDistance(
      parsed
        .filter((item) => item.id && item.guess_word && item.created_at)
        .map((item) => withDistance(item, targetWord)),
    );
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
  uiLanguage,
  userEmail,
  isGuest,
}: ConnectionGameProps) {
  const text = CONNECTION_UI_TEXT[uiLanguage];
  const savedState = loadConnectionState(userEmail, categoryId, uiLanguage);
  const [targetWord, setTargetWord] = useState(() => savedState?.targetWord ?? pickRandomWord(categoryId, uiLanguage));
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
  const bestDistance = useMemo(() => {
    const distances = [
      ...(lastResult ? [lastResult.distance] : []),
      ...history.map((item) => item.distance),
    ].filter((distance) => Number.isFinite(distance));

    return distances.length > 0 ? Math.min(...distances) : undefined;
  }, [history, lastResult]);

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

    setHistory(sortGuessesByDistance((data ?? []).map((item) => withDistance(item, targetWord))));
  }

  useEffect(() => {
    loadHistory();
  }, [isGuest, targetWord]);

  useEffect(() => {
    localStorage.setItem(
      getConnectionStateKey(userEmail, categoryId, uiLanguage),
      JSON.stringify({
        targetWord,
        inputWord,
        lastResult,
        message,
        status,
        shownClues,
      } satisfies SavedConnectionState),
    );
  }, [categoryId, inputWord, lastResult, message, shownClues, status, targetWord, uiLanguage, userEmail]);

  async function saveGuestAssociation(word: string, distance: number) {
    const oldHistory = loadGuestHistory(targetWord);
    const alreadySaved = oldHistory.some((item) => item.guess_word === word);
    const nextHistory = sortGuessesByDistance(alreadySaved ? oldHistory : [createGuestGuess(word, distance), ...oldHistory]);
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
    setTargetWord((currentWord) => pickRandomWord(categoryId, uiLanguage, currentWord));
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
      const clue = await getSmartClue(targetWord, shownClues.length, bestDistance, uiLanguage);
      const shownClueTexts = new Set(shownClues.map(normalizeClueText));
      const nextClue = shownClueTexts.has(normalizeClueText(clue))
        ? getUniqueLocalLetterClue(targetWord, shownClues.length, getClueProgress(bestDistance), shownClues, uiLanguage)
        : clue;

      if (shownClueTexts.has(normalizeClueText(nextClue))) {
        setMessage(text.noMoreHints);
        return false;
      }

      setShownClues((currentClues) => [...currentClues, nextClue]);
      return true;
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'ИИ не смог сделать подсказку.');
      setMessage(text.aiHintError);
      return false;
    } finally {
      setClueLoading(false);
    }
  }

  async function closeAdAndShowClue() {
    setShowAd(false);
    const clueRevealed = await revealNextClue();
    if (clueRevealed) {
      setMessage(text.adHintOpened);
    }
  }

  async function buyClue() {
    if (roundFinished || shownClues.length >= availableCluesCount || clueLoading) return;

    if (coins < hintCost) {
      setMessage(text.needCoins(hintCost));
      return;
    }

    const clueRevealed = await revealNextClue();

    if (clueRevealed && onSpendCoins()) {
      setMessage(text.hintBought(hintCost));
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
      setMessage(text.win(rewardCoins));
      setInputWord('');
      setBusy(false);
      return;
    }

    let distance: number;

    try {
      distance = await getSmartDistance(word, targetWord, uiLanguage);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'ИИ не смог сравнить слова.');
      setMessage(text.aiDistanceError);
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
        <p className="hello">{text.player}: {userEmail}</p>
        <h2>Association</h2>
        <p className="game-subtitle">{text.subtitle}</p>

        <p className="guest-note">
          {text.dictionary(getAssociationWordCount(uiLanguage))}
        </p>

        <p className="currency-note">
          {text.balance(coins, rewardCoins, hintCost)}
        </p>

        <div className="target-box">
          <span>{text.secretWord}</span>
          <strong>??????</strong>
        </div>

        <form onSubmit={submitWord} className="guess-form">
          <input
            placeholder={text.input}
            value={inputWord}
            onChange={(e) => setInputWord(e.target.value)}
            disabled={busy || roundFinished}
          />
          <button type="submit" disabled={busy || roundFinished}>
            {busy ? text.checking : text.check}
          </button>
        </form>

        <div className="round-actions">
          <button
            className="soft-button"
            onClick={buyClue}
            disabled={roundFinished || shownClues.length >= availableCluesCount || coins < hintCost || clueLoading}
            type="button"
          >
            {clueLoading ? text.preparing : text.hintCoins(hintCost)}
          </button>
          <button
            className="soft-button"
            onClick={openAdForClue}
            disabled={roundFinished || shownClues.length >= availableCluesCount || showAd || clueLoading}
            type="button"
          >
            {clueLoading ? text.preparing : text.hintAd}
          </button>
          <button className="danger-button" onClick={giveUp} disabled={roundFinished}>
            {text.giveUp}
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
            <p className="result-title">{text.distance}</p>
            <button
              className="meaning-button"
              disabled={meaningLoading}
              onClick={() => toggleWordMeaning(lastResult.word)}
              type="button"
            >
              {meaningLoading ? text.searching : text.meaning}
            </button>
            {showWordMeaning && (
              <p className="distance-help">
                {meaningLoading ? text.searchingMeaning : wordMeaning}
                {!meaningLoading && meaningSource && (
                  <span className="meaning-source">{text.source}: {meaningSource}</span>
                )}
              </p>
            )}
          </div>
        )}

        {roundFinished && (
          <>
            <div className={status === 'won' ? 'answer-reveal solved' : 'answer-reveal gave-up'}>
              <span>{status === 'won' ? text.correctWord : text.answerWas}</span>
              <strong>{targetWord}</strong>
            </div>
            <button className="next-button" onClick={startNextRound}>
              {text.newWord}
            </button>
          </>
        )}
      </div>

      <div className="history-panel">
        <h3>{text.historyTitle}</h3>
        {history.length === 0 ? (
          <p className="empty">{text.emptyHistory}</p>
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

      {showAd && <AdModal onClose={closeAdAndShowClue} uiLanguage={uiLanguage} />}
    </section>
  );
}
