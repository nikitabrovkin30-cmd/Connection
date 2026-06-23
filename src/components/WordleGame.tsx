import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { SECRET_WORDS } from '../data/wordBank';
import { supabase } from '../lib/supabase';
import { AdModal } from './AdModal';

type WordLength = 4 | 5 | 6;
type WordleMode = 'classic' | 'daily' | 'campaign';
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
  campaignLevel?: number;
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
const CAMPAIGN_LEVEL_COUNT = 2000;
const WORDLE_STATE_PREFIX = 'wordle_game_state';
const WORDLE_MODE_PREFIX = 'wordle_game_mode';
const WORDLE_VALIDATION_CACHE_PREFIX = 'wordle_ai_validation';
const WORDLE_LOCAL_LEARNED_WORDS_KEY = 'wordle_local_learned_words';
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

const WORDLE_TARGET_WORDS: Record<WordLength, Set<string>> = {
  4: new Set([...WORDS[4], ...SECRET_WORDS.filter((word) => word.length === 4)]),
  5: new Set([...WORDS[5], ...SECRET_WORDS.filter((word) => word.length === 5)]),
  6: new Set([...WORDS[6], ...SECRET_WORDS.filter((word) => word.length === 6)]),
};

const RARE_LETTERS = new Set(Array.from('фхцчшщъыэюяь'));

function getWordDifficulty(word: string) {
  const letters = Array.from(word);
  const rareScore = letters.filter((letter) => RARE_LETTERS.has(letter)).length * 9;
  const uniqueScore = new Set(letters).size * 3;
  const repeatPenalty = (letters.length - new Set(letters).size) * -4;

  return letters.length * 100 + rareScore + uniqueScore + repeatPenalty;
}

function getSortedTargetWords(length: WordLength) {
  return Array.from(WORDLE_TARGET_WORDS[length]).sort((firstWord, secondWord) => (
    getWordDifficulty(firstWord) - getWordDifficulty(secondWord) ||
    firstWord.localeCompare(secondWord, 'ru')
  ));
}

const CAMPAIGN_WORDS_BY_LENGTH: Record<WordLength, string[]> = {
  4: getSortedTargetWords(4),
  5: getSortedTargetWords(5),
  6: getSortedTargetWords(6),
};

function getCampaignWordLength(level: number): WordLength {
  if (level <= 350) return 4;
  if (level <= 900) return level % 3 === 0 ? 5 : 4;
  if (level <= 1450) return level % 3 === 0 ? 6 : 5;
  return level % 5 === 0 ? 5 : 6;
}

function getCampaignWord(level: number) {
  const safeLevel = Math.max(1, Math.min(CAMPAIGN_LEVEL_COUNT, level));
  const length = getCampaignWordLength(safeLevel);
  const words = CAMPAIGN_WORDS_BY_LENGTH[length];
  const progress = (safeLevel - 1) / (CAMPAIGN_LEVEL_COUNT - 1);
  const baseIndex = Math.floor(progress * Math.max(0, words.length - 1));
  const randomOffset = (safeLevel * 17 + length * 31) % Math.max(1, Math.min(9, words.length));
  const index = Math.min(words.length - 1, baseIndex + randomOffset);

  return {
    length,
    word: words[index] ?? pickWord(length),
  };
}

function normalizeDictionaryWord(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function addWordByLength(target: Record<WordLength, Set<string>>, word: string) {
  const normalizedWord = normalizeDictionaryWord(word);
  const wordLength = normalizedWord.length;

  if (wordLength === 4 || wordLength === 5 || wordLength === 6) {
    target[wordLength].add(normalizedWord);
  }
}

function addWordForms(target: Record<WordLength, Set<string>>, word: string) {
  const normalizedWord = normalizeDictionaryWord(word);
  if (!/^[а-я]+$/.test(normalizedWord)) return;

  addWordByLength(target, normalizedWord);

  const lastLetter = normalizedWord[normalizedWord.length - 1];
  const withoutLastLetter = normalizedWord.slice(0, -1);
  const formEndingsByLastLetter: Record<string, readonly string[]> = {
    а: ['ы', 'е', 'у', 'ой', 'ою'],
    я: ['и', 'е', 'ю', 'ей', 'ею'],
    о: ['а', 'у', 'е', 'ом'],
    е: ['я', 'ю', 'ем'],
    ь: ['я', 'ю', 'ем', 'и', 'е'],
    й: ['я', 'ю', 'ем', 'и', 'е'],
  };
  const endings = lastLetter ? formEndingsByLastLetter[lastLetter] : undefined;

  endings?.forEach((ending) => addWordByLength(target, `${withoutLastLetter}${ending}`));

  if (lastLetter && !'аеёиоуыэюяьй'.includes(lastLetter)) {
    ['а', 'у', 'е', 'ом', 'ы'].forEach((ending) => addWordByLength(target, `${normalizedWord}${ending}`));
  }
}

function addFiveLetterCheckVariants(words: Set<string>) {
  const consonantStarts = [
    'б', 'в', 'г', 'д', 'ж', 'з', 'к', 'л', 'м', 'н', 'п', 'р', 'с', 'т', 'ф', 'х', 'ц', 'ч', 'ш',
    'бр', 'вр', 'гр', 'др', 'жр', 'зл', 'кр', 'кл', 'мл', 'пл', 'пр', 'ск', 'сл', 'см', 'ст', 'тр',
    'фл', 'хл', 'шк',
  ];
  const wordMiddles = [
    'а', 'е', 'и', 'о', 'у', 'ы', 'я',
    'ак', 'ал', 'ан', 'ар', 'ас', 'ат', 'ед', 'ел', 'ен', 'ер', 'ес', 'ет', 'ик', 'ил', 'ин', 'ир',
    'ис', 'ит', 'ок', 'ол', 'он', 'ор', 'ос', 'от', 'ук', 'ул', 'ун', 'ур', 'ус', 'ут',
  ];
  const wordEnds = [
    'а', 'е', 'и', 'о', 'у', 'ы', 'я',
    'ак', 'ал', 'ам', 'ан', 'ар', 'ас', 'ат', 'ач', 'ей', 'ек', 'ел', 'ем', 'ен', 'ер', 'ес', 'ет',
    'ик', 'ил', 'им', 'ин', 'ир', 'ис', 'ит', 'ка', 'ки', 'ко', 'ок', 'ол', 'ом', 'он', 'ор', 'ос',
    'от', 'та', 'ты', 'ца', 'ый', 'ий', 'ой',
  ];

  for (const start of consonantStarts) {
    for (const middle of wordMiddles) {
      for (const end of wordEnds) {
        const word = `${start}${middle}${end}`;
        if (word.length === 5) {
          words.add(word);
        }

        if (words.size >= 1500) return;
      }
    }
  }
}

function addSixLetterCheckVariants(words: Set<string>) {
  const consonantStarts = [
    'б', 'в', 'г', 'д', 'ж', 'з', 'к', 'л', 'м', 'н', 'п', 'р', 'с', 'т', 'ф', 'х', 'ц', 'ч', 'ш',
    'бр', 'вр', 'гр', 'др', 'зл', 'кр', 'кл', 'мл', 'пл', 'пр', 'ск', 'сл', 'см', 'ст', 'тр', 'фл',
    'хл', 'шк',
  ];
  const wordMiddles = [
    'а', 'е', 'и', 'о', 'у', 'ы', 'я',
    'ак', 'ал', 'ан', 'ар', 'ас', 'ат', 'ед', 'ел', 'ен', 'ер', 'ес', 'ет', 'ик', 'ил', 'ин', 'ир',
    'ис', 'ит', 'ок', 'ол', 'он', 'ор', 'ос', 'от', 'ук', 'ул', 'ун', 'ур', 'ус', 'ут',
    'ова', 'ево', 'ина', 'ени', 'оро', 'ере',
  ];
  const wordEnds = [
    'а', 'е', 'и', 'о', 'у', 'ы', 'я',
    'ак', 'ал', 'ам', 'ан', 'ар', 'ас', 'ат', 'ач', 'ей', 'ек', 'ел', 'ем', 'ен', 'ер', 'ес', 'ет',
    'ик', 'ил', 'им', 'ин', 'ир', 'ис', 'ит', 'ка', 'ки', 'ко', 'ок', 'ол', 'ом', 'он', 'ор', 'ос',
    'от', 'та', 'ты', 'ца', 'чик', 'ник', 'арь', 'ель', 'ить', 'ать', 'ный', 'ная', 'ное',
  ];

  for (const start of consonantStarts) {
    for (const middle of wordMiddles) {
      for (const end of wordEnds) {
        const word = `${start}${middle}${end}`;
        if (word.length === 6) {
          words.add(word);
        }

        if (words.size >= 2000) return;
      }
    }
  }
}

function addFourLetterCheckVariants(words: Set<string>) {
  const consonantStarts = [
    'б', 'в', 'г', 'д', 'ж', 'з', 'к', 'л', 'м', 'н', 'п', 'р', 'с', 'т', 'ф', 'х', 'ц', 'ч', 'ш',
    'бр', 'вр', 'гр', 'др', 'зл', 'кр', 'кл', 'мл', 'пл', 'пр', 'ск', 'сл', 'см', 'ст', 'тр', 'фл',
  ];
  const wordMiddles = [
    'а', 'е', 'и', 'о', 'у', 'ы', 'я',
    'ак', 'ал', 'ан', 'ар', 'ас', 'ат', 'ек', 'ел', 'ен', 'ер', 'ес', 'ик', 'ил', 'ин', 'ир', 'ис',
    'ок', 'ол', 'он', 'ор', 'ос', 'от', 'ук', 'ул', 'ун', 'ур', 'ус',
  ];
  const wordEnds = [
    'а', 'е', 'и', 'о', 'у', 'ы', 'я', 'ь', 'й',
    'ак', 'ал', 'ам', 'ан', 'ар', 'ас', 'ат', 'ек', 'ел', 'ем', 'ен', 'ер', 'ес', 'ик', 'ил', 'им',
    'ин', 'ир', 'ис', 'ит', 'ка', 'ок', 'ол', 'ом', 'он', 'ор', 'ос', 'от', 'та', 'ца', 'ый', 'ий',
  ];

  for (const start of consonantStarts) {
    for (const middle of wordMiddles) {
      for (const end of wordEnds) {
        const word = `${start}${middle}${end}`;
        if (word.length === 4) {
          words.add(word);
        }

        if (words.size >= 1500) return;
      }
    }
  }
}

function createWordleAllowedWords() {
  const allowedWords: Record<WordLength, Set<string>> = {
    4: new Set(WORDLE_TARGET_WORDS[4]),
    5: new Set(WORDLE_TARGET_WORDS[5]),
    6: new Set(WORDLE_TARGET_WORDS[6]),
  };

  [...WORDS[4], ...WORDS[5], ...WORDS[6], ...SECRET_WORDS].forEach((word) => {
    addWordForms(allowedWords, word);
  });

  addFourLetterCheckVariants(allowedWords[4]);
  addFiveLetterCheckVariants(allowedWords[5]);
  addSixLetterCheckVariants(allowedWords[6]);

  return allowedWords;
}

const WORDLE_ALLOWED_WORDS = createWordleAllowedWords();

function normalizeWord(value: string) {
  return normalizeDictionaryWord(value);
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

function readLocalLearnedWords() {
  try {
    const savedValue = localStorage.getItem(WORDLE_LOCAL_LEARNED_WORDS_KEY);
    if (!savedValue) return new Set<string>();

    const parsed = JSON.parse(savedValue) as unknown;
    if (!Array.isArray(parsed)) return new Set<string>();

    return new Set(
      parsed.filter((item): item is string => (
        typeof item === 'string' &&
        /^[456]:[а-я]+$/.test(item)
      )),
    );
  } catch {
    return new Set<string>();
  }
}

function writeLocalLearnedWords(words: Set<string>) {
  try {
    localStorage.setItem(WORDLE_LOCAL_LEARNED_WORDS_KEY, JSON.stringify(Array.from(words).sort()));
  } catch {
    // If storage is full or blocked, Supabase/shared dictionary still works.
  }
}

function addLocalLearnedWord(word: string, length: WordLength) {
  const normalizedWord = normalizeWord(word);
  if (WORDLE_ALLOWED_WORDS[length].has(normalizedWord)) return;

  const learnedWords = readLocalLearnedWords();
  learnedWords.add(getWordKey(normalizedWord, length));
  writeLocalLearnedWords(learnedWords);
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMillisecondsUntilNextLocalDay() {
  const now = new Date();
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 0, 0);
  return Math.max(0, nextDay.getTime() - now.getTime());
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function getDailyWord(dateKey: string) {
  const words = Array.from(WORDLE_TARGET_WORDS[5]).sort();
  const seed = Array.from(dateKey).reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  return words[seed % words.length] ?? pickWord(5);
}

function getWordleModeKey(userEmail: string) {
  return `${WORDLE_MODE_PREFIX}_${userEmail}`;
}

function loadWordleMode(userEmail: string): WordleMode {
  const savedMode = localStorage.getItem(getWordleModeKey(userEmail));
  if (savedMode === 'campaign') return 'campaign';
  return savedMode === 'daily' ? 'daily' : 'classic';
}

function getWordleStateKey(userEmail: string, mode: WordleMode, dateKey = getTodayKey()) {
  if (mode === 'campaign') {
    return `${WORDLE_STATE_PREFIX}_${userEmail}_campaign`;
  }

  return mode === 'daily'
    ? `${WORDLE_STATE_PREFIX}_${userEmail}_daily_${dateKey}`
    : `${WORDLE_STATE_PREFIX}_${userEmail}_classic`;
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

function loadWordleState(userEmail: string, mode: WordleMode, dateKey = getTodayKey()): SavedWordleState | null {
  const saved = localStorage.getItem(getWordleStateKey(userEmail, mode, dateKey));
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
  if (cachedValue !== undefined) {
    if (cachedValue) {
      addLocalLearnedWord(word, length);
      void saveLearnedWord(word, length);
    }
    return cachedValue;
  }

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
    addLocalLearnedWord(word, length);
    void saveLearnedWord(word, length);
  }
  return validation;
}

async function loadLearnedWords() {
  const learnedWords = readLocalLearnedWords();

  const { data, error } = await supabase
    .from('wordle_learned_words')
    .select('word, length');

  if (error) {
    console.error(error.message);
    return learnedWords;
  }

  (data as LearnedWordRow[] | null)?.forEach((item) => {
    if (isWordLength(item.length)) {
      learnedWords.add(getWordKey(normalizeWord(item.word), item.length));
    }
  });

  writeLocalLearnedWords(learnedWords);
  return learnedWords;
}

async function saveLearnedWord(word: string, length: WordLength) {
  const normalizedWord = normalizeWord(word);

  if (WORDLE_ALLOWED_WORDS[length].has(normalizedWord)) return;

  addLocalLearnedWord(normalizedWord, length);

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
  const knownWords = Array.from(WORDLE_TARGET_WORDS[length]);
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
  const todayKey = getTodayKey();
  const initialMode = loadWordleMode(userEmail);
  const savedState = loadWordleState(userEmail, initialMode, todayKey);
  const initialDailyWord = getDailyWord(todayKey);
  const initialCampaignLevel = Math.max(1, Math.min(CAMPAIGN_LEVEL_COUNT, savedState?.campaignLevel ?? 1));
  const initialCampaignWord = getCampaignWord(initialCampaignLevel);
  const activeSavedState =
    (initialMode === 'daily' && savedState?.targetWord !== initialDailyWord) ||
    (initialMode === 'campaign' && savedState?.targetWord !== initialCampaignWord.word)
      ? null
      : savedState;
  const initialWordLength =
    initialMode === 'daily' ? 5 : initialMode === 'campaign' ? initialCampaignWord.length : activeSavedState?.wordLength ?? 5;
  const initialTargetWord =
    initialMode === 'daily'
      ? initialDailyWord
      : initialMode === 'campaign'
        ? initialCampaignWord.word
      : activeSavedState?.targetWord ?? pickWord(initialWordLength);
  const [wordleMode, setWordleMode] = useState<WordleMode>(() => initialMode);
  const [dailyDateKey, setDailyDateKey] = useState(() => todayKey);
  const [campaignLevel, setCampaignLevel] = useState(() => initialCampaignLevel);
  const [wordLength, setWordLength] = useState<WordLength>(() => initialWordLength);
  const [targetWord, setTargetWord] = useState(() => initialTargetWord);
  const [guess, setGuess] = useState(() => activeSavedState?.guess ?? '');
  const [rows, setRows] = useState<GuessRow[]>(() => activeSavedState?.rows ?? []);
  const [status, setStatus] = useState<GameStatus>(() => activeSavedState?.status ?? 'playing');
  const [message, setMessage] = useState(() => activeSavedState?.message ?? '');
  const [hintIndex, setHintIndex] = useState<number | null>(() => activeSavedState?.hintIndex ?? null);
  const [showAd, setShowAd] = useState(false);
  const [checkingWord, setCheckingWord] = useState(false);
  const [learnedWords, setLearnedWords] = useState<Set<string>>(() => new Set());
  const [dailyCountdownMs, setDailyCountdownMs] = useState(() => getMillisecondsUntilNextLocalDay());

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

  const dailyCountdown = formatCountdown(dailyCountdownMs);

  function focusBoard() {
    boardRef.current?.focus();
    mobileInputRef.current?.focus();
  }

  useEffect(() => {
    localStorage.setItem(getWordleModeKey(userEmail), wordleMode);
    localStorage.setItem(
      getWordleStateKey(userEmail, wordleMode, dailyDateKey),
      JSON.stringify({
        wordLength,
        targetWord,
        guess,
        rows,
        status,
        message,
        hintIndex,
        campaignLevel,
      } satisfies SavedWordleState),
    );
  }, [campaignLevel, dailyDateKey, guess, hintIndex, message, rows, status, targetWord, userEmail, wordLength, wordleMode]);

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

  useEffect(() => {
    if (wordleMode !== 'daily') return undefined;

    const timer = window.setInterval(() => {
      refreshDailyWordIfNeeded();
      setDailyCountdownMs(getMillisecondsUntilNextLocalDay());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [dailyDateKey, wordleMode]);

  useEffect(() => {
    function handleReturnToGame() {
      refreshDailyWordIfNeeded();
      setDailyCountdownMs(getMillisecondsUntilNextLocalDay());
    }

    window.addEventListener('focus', handleReturnToGame);
    document.addEventListener('visibilitychange', handleReturnToGame);

    return () => {
      window.removeEventListener('focus', handleReturnToGame);
      document.removeEventListener('visibilitychange', handleReturnToGame);
    };
  }, [dailyDateKey, wordleMode]);

  function refreshDailyWordIfNeeded() {
    const currentTodayKey = getTodayKey();
    if (currentTodayKey === dailyDateKey) return;

    setDailyDateKey(currentTodayKey);

    if (wordleMode !== 'daily') return;

    const dailyWord = getDailyWord(currentTodayKey);
    const nextState = loadWordleState(userEmail, 'daily', currentTodayKey);
    applyState('daily', 5, dailyWord, nextState?.targetWord === dailyWord ? nextState : null);
  }

  function applyState(
    nextMode: WordleMode,
    nextLength: WordLength,
    nextTargetWord: string,
    nextState?: SavedWordleState | null,
    nextCampaignLevel = campaignLevel,
  ) {
    setWordleMode(nextMode);
    setCampaignLevel(nextCampaignLevel);
    setWordLength(nextLength);
    setTargetWord(nextTargetWord);
    setGuess(nextState?.guess ?? '');
    setRows(nextState?.rows ?? []);
    setStatus(nextState?.status ?? 'playing');
    setMessage(nextState?.message ?? '');
    setHintIndex(nextState?.hintIndex ?? null);
    setShowAd(false);
    window.setTimeout(focusBoard, 0);
  }

  function resetGame(nextLength = wordLength) {
    if (wordleMode === 'daily') {
      const currentTodayKey = getTodayKey();
      setDailyDateKey(currentTodayKey);
      const dailyWord = getDailyWord(currentTodayKey);
      const nextState = loadWordleState(userEmail, 'daily', currentTodayKey);
      applyState('daily', 5, dailyWord, nextState?.targetWord === dailyWord ? nextState : null);
      return;
    }

    if (wordleMode === 'campaign') {
      const nextLevel = status === 'won' ? Math.min(CAMPAIGN_LEVEL_COUNT, campaignLevel + 1) : campaignLevel;
      const nextCampaignWord = getCampaignWord(nextLevel);
      applyState('campaign', nextCampaignWord.length, nextCampaignWord.word, null, nextLevel);
      return;
    }

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

  function openClassicMode(nextLength: WordLength) {
    const nextState = loadWordleState(userEmail, 'classic', todayKey);
    const targetLength = nextState?.wordLength === nextLength ? nextLength : nextLength;
    const target = nextState?.wordLength === nextLength ? nextState.targetWord : pickWord(nextLength);
    applyState('classic', targetLength, target, nextState?.wordLength === nextLength ? nextState : null);
  }

  function openDailyMode() {
    const currentTodayKey = getTodayKey();
    setDailyDateKey(currentTodayKey);
    const dailyWord = getDailyWord(currentTodayKey);
    const nextState = loadWordleState(userEmail, 'daily', currentTodayKey);
    const validState = nextState?.targetWord === dailyWord ? nextState : null;
    applyState('daily', 5, dailyWord, validState);
  }

  function openCampaignMode() {
    const nextState = loadWordleState(userEmail, 'campaign', todayKey);
    const nextLevel = Math.max(1, Math.min(CAMPAIGN_LEVEL_COUNT, nextState?.campaignLevel ?? campaignLevel));
    const campaignWord = getCampaignWord(nextLevel);
    const validState = nextState?.targetWord === campaignWord.word ? nextState : null;
    applyState('campaign', campaignWord.length, campaignWord.word, validState, nextLevel);
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
      if (wordleMode === 'campaign') {
        setMessage(`Уровень ${campaignLevel} пройден! Слово: ${targetWord}. +${rewardCoins} монет.`);
        return;
      }

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
              className={wordleMode === 'classic' && wordLength === length ? 'mode-button active' : 'mode-button'}
              key={length}
              onClick={() => openClassicMode(length)}
              type="button"
            >
              {length} {length === 4 ? 'буквы' : 'букв'}
            </button>
          ))}
          <button
            className={wordleMode === 'daily' ? 'mode-button active daily-word-button' : 'mode-button daily-word-button'}
            onClick={openDailyMode}
            type="button"
          >
            Слово дня
          </button>
          <button
            className={wordleMode === 'campaign' ? 'mode-button active campaign-word-button' : 'mode-button campaign-word-button'}
            onClick={openCampaignMode}
            type="button"
          >
            Прохождение
          </button>
        </div>
        {wordleMode === 'campaign' && (
          <p className="daily-word-note campaign-progress">
            Уровень {campaignLevel}/{CAMPAIGN_LEVEL_COUNT}. Длина слова: {wordLength} букв.
          </p>
        )}

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
            <div className="wordle-actions-group wordle-actions-main">
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
            </div>
            <div className="wordle-actions-group wordle-actions-hints">
              <button
                className="soft-button"
                disabled={status !== 'playing' || hintIndex !== null || coins < hintCost || checkingWord}
                onClick={buyHint}
                type="button"
              >
                Подсказка {hintCost}
              </button>
              <button
                className="ad-button"
                disabled={status !== 'playing' || hintIndex !== null || showAd || checkingWord}
                onClick={openAdForHint}
                type="button"
              >
                Реклама
              </button>
            </div>
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
            {wordleMode === 'daily' ? (
              <p className="daily-word-note finished">
                Слово дня уже сыграно. Новое откроется через {dailyCountdown}.
              </p>
            ) : wordleMode === 'campaign' ? (
              <button className="next-button" onClick={() => resetGame()} type="button">
                {status === 'won' && campaignLevel < CAMPAIGN_LEVEL_COUNT ? 'Следующий уровень' : 'Повторить уровень'}
              </button>
            ) : (
              <button className="next-button" onClick={() => resetGame()} type="button">
                Новое слово
              </button>
            )}
          </>
        )}
      </div>

      {showAd && <AdModal onClose={closeAdAndRevealHint} />}
    </section>
  );
}
