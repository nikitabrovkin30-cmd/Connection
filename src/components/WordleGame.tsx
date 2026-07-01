import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { SECRET_WORDS } from '../data/wordBank';
import { supabase } from '../lib/supabase';
import { AdModal } from './AdModal';

type WordLength = 4 | 5 | 6;
type WordleLanguage = 'ru' | 'kk' | 'en';
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
  language?: WordleLanguage;
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
  uiLanguage: 'ru' | 'kk' | 'en';
  userEmail: string;
};

const WORDLE_UI_TEXT = {
  ru: {
    player: 'Игрок',
    subtitle: 'Кликни по таблице и печатай буквы прямо в неё. Enter проверяет слово, Backspace стирает букву.',
    balance: (coins: number, reward: number, cost: number) => `Баланс: ${coins} монет. Победа дает ${reward}, подсказка стоит ${cost}.`,
    languageLabel: 'Выбор языка Wordle',
    lengthLabel: 'Длина слова',
    letters: 'букв',
    daily: 'Слово дня',
    campaign: 'Прохождение',
    level: (level: number, total: number, length: number) => `Уровень ${level}/${total}. Длина слова: ${length} букв.`,
    boardLabel: 'Поле ввода Wordle',
    inputLabel: 'Ввод слова Wordle',
    letterList: 'Список букв',
    erase: 'Стереть',
    checking: 'Проверяем...',
    check: 'Проверить',
    hint: (cost: number) => `Подсказка ${cost}`,
    ad: 'Реклама',
    correctWord: 'Правильное слово',
    wordWas: 'Слово было',
    dailyFinished: (time: string) => `Слово дня уже сыграно. Новое откроется через ${time}.`,
    nextLevel: 'Следующий уровень',
    retryLevel: 'Повторить уровень',
    newWord: 'Новое слово',
    adHint: (index: number, letter: string) => `Реклама просмотрена. Подсказка: буква ${index} - "${letter}".`,
    needCoins: (cost: number) => `Нужно ${cost} монет для подсказки.`,
    boughtHint: (cost: number, index: number, letter: string) => `Подсказка куплена за ${cost} монет: буква ${index} - "${letter}".`,
    needLetters: (length: number) => `Нужно слово из ${length} букв.`,
    aiWordError: 'ИИ недоступен, а такого слова нет в локальном словаре игры.',
    campaignWon: (level: number, word: string, reward: number) => `Уровень ${level} пройден! Слово: ${word}. +${reward} монет.`,
    won: (word: string, reward: number) => `Победа! Слово: ${word}. +${reward} монет.`,
  },
  kk: {
    player: 'Ойыншы',
    subtitle: 'Кестені басып, әріптерді тікелей енгіз. Enter сөзді тексереді, Backspace әріпті өшіреді.',
    balance: (coins: number, reward: number, cost: number) => `Баланс: ${coins} монета. Жеңіс ${reward} береді, кеңес ${cost} тұрады.`,
    languageLabel: 'Wordle тілін таңдау',
    lengthLabel: 'Сөз ұзындығы',
    letters: 'әріп',
    daily: 'Күн сөзі',
    campaign: 'Өту режимі',
    level: (level: number, total: number, length: number) => `Деңгей ${level}/${total}. Сөз ұзындығы: ${length} әріп.`,
    boardLabel: 'Wordle енгізу өрісі',
    inputLabel: 'Wordle сөзі',
    letterList: 'Әріптер тізімі',
    erase: 'Өшіру',
    checking: 'Тексерілуде...',
    check: 'Тексеру',
    hint: (cost: number) => `Кеңес ${cost}`,
    ad: 'Жарнама',
    correctWord: 'Дұрыс сөз',
    wordWas: 'Сөз',
    dailyFinished: (time: string) => `Күн сөзі ойналды. Жаңа сөз ${time} кейін ашылады.`,
    nextLevel: 'Келесі деңгей',
    retryLevel: 'Деңгейді қайталау',
    newWord: 'Жаңа сөз',
    adHint: (index: number, letter: string) => `Жарнама қаралды. Кеңес: ${index}-әріп - "${letter}".`,
    needCoins: (cost: number) => `Кеңес үшін ${cost} монета керек.`,
    boughtHint: (cost: number, index: number, letter: string) => `Кеңес ${cost} монетаға сатып алынды: ${index}-әріп - "${letter}".`,
    needLetters: (length: number) => `${length} әріптен тұратын сөз керек.`,
    aiWordError: 'ИИ қолжетімсіз, ал бұл сөз ойынның жергілікті сөздігінде жоқ.',
    campaignWon: (level: number, word: string, reward: number) => `${level}-деңгей өтті! Сөз: ${word}. +${reward} монета.`,
    won: (word: string, reward: number) => `Жеңіс! Сөз: ${word}. +${reward} монета.`,
  },
  en: {
    player: 'Player',
    subtitle: 'Tap the board and type letters into it. Enter checks the word, Backspace removes a letter.',
    balance: (coins: number, reward: number, cost: number) => `Balance: ${coins} coins. A win gives ${reward}, a hint costs ${cost}.`,
    languageLabel: 'Wordle language',
    lengthLabel: 'Word length',
    letters: 'letters',
    daily: 'Daily word',
    campaign: 'Campaign',
    level: (level: number, total: number, length: number) => `Level ${level}/${total}. Word length: ${length} letters.`,
    boardLabel: 'Wordle input board',
    inputLabel: 'Wordle word input',
    letterList: 'Letter list',
    erase: 'Erase',
    checking: 'Checking...',
    check: 'Check',
    hint: (cost: number) => `Hint ${cost}`,
    ad: 'Ad',
    correctWord: 'Correct word',
    wordWas: 'Word was',
    dailyFinished: (time: string) => `Daily word already played. New word opens in ${time}.`,
    nextLevel: 'Next level',
    retryLevel: 'Retry level',
    newWord: 'New word',
    adHint: (index: number, letter: string) => `Ad watched. Hint: letter ${index} - "${letter}".`,
    needCoins: (cost: number) => `You need ${cost} coins for a hint.`,
    boughtHint: (cost: number, index: number, letter: string) => `Hint bought for ${cost} coins: letter ${index} - "${letter}".`,
    needLetters: (length: number) => `You need a ${length}-letter word.`,
    aiWordError: 'AI is unavailable, and this word is not in the local game dictionary.',
    campaignWon: (level: number, word: string, reward: number) => `Level ${level} complete! Word: ${word}. +${reward} coins.`,
    won: (word: string, reward: number) => `Win! Word: ${word}. +${reward} coins.`,
  },
} as const;

const MAX_ATTEMPTS = 6;
const CAMPAIGN_LEVEL_COUNT = 2000;
const WORDLE_STATE_PREFIX = 'wordle_game_state';
const WORDLE_MODE_PREFIX = 'wordle_game_mode';
const WORDLE_LANGUAGE_PREFIX = 'wordle_game_language';
const WORDLE_VALIDATION_CACHE_PREFIX = 'wordle_ai_validation';
const WORDLE_LOCAL_LEARNED_WORDS_KEY = 'wordle_local_learned_words';
const RUSSIAN_ALPHABET = Array.from('абвгдежзийклмнопрстуфхцчшщъыьэюя');
const KAZAKH_ALPHABET = Array.from('аәбвгғдеёжзийкқлмнңоөпрстуұүфхһцчшщъыіьэюя');
const ENGLISH_ALPHABET = Array.from('abcdefghijklmnopqrstuvwxyz');
function getWordleLanguageFromUi(uiLanguage: 'ru' | 'kk' | 'en'): WordleLanguage {
  if (uiLanguage === 'kk') return 'kk';
  if (uiLanguage === 'en') return 'en';
  return 'ru';
}

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

const KAZAKH_WORDS: Record<WordLength, string[]> = {
  4: [
    'алма', 'қала', 'дала', 'бала', 'ағаш', 'қоян', 'суық', 'жылы', 'орын', 'төрт',
    'етік', 'киім', 'ойын', 'әнші', 'отын', 'жазу', 'айна', 'қора', 'кеме', 'қара',
    'ақша', 'асық', 'құрт', 'жоба', 'тана', 'қазы', 'сана', 'түбі', 'шана', 'мата',
    'жеке', 'сары', 'көне', 'бөрі', 'ерік', 'үміт', 'күші', 'көзі', 'қолы', 'аяғы',
    'жүзі', 'қапа', 'құмы', 'жары', 'тұқы', 'қыры', 'тасы', 'жолы', 'үйір', 'әнім',
  ],
  5: [
    'кітап', 'ұстаз', 'сабақ', 'қалам', 'жүрек', 'балық', 'теңіз', 'аспан', 'орман', 'түлкі',
    'мысық', 'жылқы', 'қымыз', 'бауыр', 'қасық', 'жалау', 'сағат', 'кілем', 'сөмке', 'көрпе',
    'кесеу', 'құдық', 'тарақ', 'құрал', 'жолақ', 'қабат', 'жазық', 'қатты', 'жұмыр', 'қоңыр',
    'шағын', 'жасыл', 'қызыл', 'құрақ', 'білім', 'арман', 'еңбек', 'дәуір', 'қазақ', 'ұлтты',
    'далақ', 'қамал', 'самал', 'бұлақ', 'қайық', 'көмір', 'құмыр', 'сұрақ', 'жауап', 'талап',
    'мерей', 'шабыт', 'намыс', 'қамыс', 'құнды', 'мұрат', 'сәуле', 'қайың', 'жусан', 'тұмар',
  ],
  6: [
    'мектеп', 'дәптер', 'жаңбыр', 'қасқыр', 'терезе', 'ұлттық', 'қазақы', 'жұлдыз', 'көйлек', 'көктем',
    'жазушы', 'саяхат', 'қантты', 'қалауы', 'дәстүр', 'мәдени', 'таңдау', 'құмған', 'жүрген', 'көркем',
    'жарқын', 'шалқар', 'ақиқат', 'тұлпар', 'күмбез', 'бүркіт', 'жомарт', 'қайрат', 'дәулет', 'ырысты',
    'сәулет', 'құндыз', 'қорған', 'қақпақ', 'шағала', 'табиғи', 'балғын', 'ақылды', 'береке', 'бірлік',
    'қасиет', 'отбасы', 'жастар', 'далада', 'сұлтан', 'қамқор', 'қазына', 'қаламы', 'тірлік', 'көкпар',
  ],
};

const KAZAKH_CAMPAIGN_TARGET_COUNTS: Record<WordLength, number> = {
  4: 600,
  5: 700,
  6: 800,
};

const KAZAKH_SYLLABLES = [
  'ба', 'бе', 'бі', 'бо', 'бө', 'бұ', 'бү',
  'ға', 'ге', 'гі', 'ғо', 'ғұ',
  'да', 'де', 'ді', 'до', 'дө', 'ды',
  'жа', 'же', 'жі', 'жо', 'жө', 'жу',
  'за', 'зе', 'зі', 'зо', 'зу',
  'қа', 'ке', 'кі', 'қо', 'кө', 'қу', 'кү',
  'ла', 'ле', 'лі', 'ло', 'лу',
  'ма', 'ме', 'мі', 'мо', 'мұ', 'мү',
  'на', 'не', 'ні', 'но', 'ну',
  'са', 'се', 'сі', 'со', 'су',
  'та', 'те', 'ті', 'то', 'ту',
  'ша', 'ше', 'ші', 'шо', 'шу',
  'ра', 'ре', 'рі', 'ро', 'ру',
];

const KAZAKH_SINGLE_ENDINGS = ['н', 'р', 'с', 'т', 'қ', 'к', 'м', 'л', 'й', 'з', 'ш'];
const KAZAKH_CASE_ENDINGS = ['ға', 'ге', 'қа', 'ке', 'да', 'де', 'та', 'те', 'ды', 'ді', 'ты', 'ті', 'мен', 'сыз'];

function isKazakhCandidateWord(word: string, length: WordLength) {
  if (word.length !== length || !getLanguagePattern('kk').test(word)) return false;
  if (new Set(word).size < 3) return false;

  const vowels = word.match(/[аәеёиоөұүыіэюя]/g)?.length ?? 0;
  return vowels > 0;
}

function addKazakhCandidate(words: Set<string>, word: string, length: WordLength) {
  const normalizedWord = normalizeDictionaryWord(word, 'kk');
  if (isKazakhCandidateWord(normalizedWord, length)) {
    words.add(normalizedWord);
  }
}

function fillKazakhWords(words: Set<string>, length: WordLength, targetCount: number) {
  KAZAKH_WORDS[length].forEach((word) => addKazakhCandidate(words, word, length));

  for (const baseWords of Object.values(KAZAKH_WORDS)) {
    for (const word of baseWords) {
      for (const ending of KAZAKH_CASE_ENDINGS) {
        addKazakhCandidate(words, `${word}${ending}`, length);
        if (words.size >= targetCount) return words;
      }
    }
  }

  for (const first of KAZAKH_SYLLABLES) {
    for (const second of KAZAKH_SYLLABLES) {
      if (length === 4) {
        addKazakhCandidate(words, `${first}${second}`, length);
      }

      if (length === 5) {
        for (const ending of KAZAKH_SINGLE_ENDINGS) {
          addKazakhCandidate(words, `${first}${second}${ending}`, length);
          if (words.size >= targetCount) return words;
        }
      }

      if (length === 6) {
        for (const third of KAZAKH_SYLLABLES) {
          addKazakhCandidate(words, `${first}${second}${third}`, length);
          if (words.size >= targetCount) return words;
        }
      }

      if (words.size >= targetCount) return words;
    }
  }

  return words;
}

function createKazakhTargetWords() {
  return {
    4: fillKazakhWords(new Set(KAZAKH_WORDS[4]), 4, KAZAKH_CAMPAIGN_TARGET_COUNTS[4]),
    5: fillKazakhWords(new Set(KAZAKH_WORDS[5]), 5, KAZAKH_CAMPAIGN_TARGET_COUNTS[5]),
    6: fillKazakhWords(new Set(KAZAKH_WORDS[6]), 6, KAZAKH_CAMPAIGN_TARGET_COUNTS[6]),
  } satisfies Record<WordLength, Set<string>>;
}

const wordValidationCache = new Map<string, boolean>();

const WORDLE_TARGET_WORDS: Record<WordLength, Set<string>> = {
  4: new Set([...WORDS[4], ...SECRET_WORDS.filter((word) => word.length === 4)]),
  5: new Set([...WORDS[5], ...SECRET_WORDS.filter((word) => word.length === 5)]),
  6: new Set([...WORDS[6], ...SECRET_WORDS.filter((word) => word.length === 6)]),
};

const KAZAKH_TARGET_WORDS = createKazakhTargetWords();

const ENGLISH_WORDS: Record<WordLength, string[]> = {
  4: [
    'game', 'word', 'play', 'time', 'star', 'moon', 'tree', 'fish', 'bird', 'wolf',
    'book', 'door', 'lamp', 'road', 'rain', 'snow', 'wind', 'fire', 'rock', 'sand',
    'ship', 'king', 'ring', 'gold', 'coin', 'desk', 'milk', 'cake', 'leaf', 'seed',
    'frog', 'bear', 'lion', 'duck', 'goat', 'hand', 'face', 'home', 'room', 'city',
    'song', 'note', 'ball', 'shoe', 'coat', 'boat', 'bike', 'bell', 'card', 'gift',
  ],
  5: [
    'apple', 'brain', 'chair', 'table', 'house', 'water', 'earth', 'cloud', 'storm', 'grass',
    'plant', 'stone', 'river', 'ocean', 'horse', 'tiger', 'zebra', 'mouse', 'snake', 'eagle',
    'bread', 'sugar', 'honey', 'lemon', 'grape', 'music', 'piano', 'phone', 'watch', 'paper',
    'pencil', 'brush', 'light', 'glass', 'plate', 'spoon', 'knife', 'shirt', 'train', 'plane',
    'smile', 'dream', 'quest', 'logic', 'riddle', 'magic', 'level', 'world', 'field', 'beach',
  ],
  6: [
    'planet', 'flower', 'forest', 'island', 'valley', 'desert', 'winter', 'summer', 'animal', 'rabbit',
    'monkey', 'donkey', 'turkey', 'turtle', 'dragon', 'bottle', 'camera', 'guitar', 'basket', 'pillow',
    'window', 'school', 'castle', 'bridge', 'garden', 'market', 'museum', 'rocket', 'ticket', 'wallet',
    'screen', 'button', 'letter', 'answer', 'secret', 'puzzle', 'memory', 'friend', 'family', 'doctor',
    'cookie', 'cheese', 'orange', 'tomato', 'carrot', 'pepper', 'silver', 'circle', 'square', 'yellow',
  ],
};

const ENGLISH_TARGET_WORDS: Record<WordLength, Set<string>> = {
  4: new Set(ENGLISH_WORDS[4]),
  5: new Set(ENGLISH_WORDS[5]),
  6: new Set(ENGLISH_WORDS[6]),
};

const WORDLE_TARGET_WORDS_BY_LANGUAGE: Record<WordleLanguage, Record<WordLength, Set<string>>> = {
  ru: WORDLE_TARGET_WORDS,
  kk: KAZAKH_TARGET_WORDS,
  en: ENGLISH_TARGET_WORDS,
};

const WORDLE_SOURCE_WORDS_BY_LANGUAGE: Record<WordleLanguage, Record<WordLength, string[]>> = {
  ru: WORDS,
  kk: KAZAKH_WORDS,
  en: ENGLISH_WORDS,
};

const RARE_LETTERS = new Set(Array.from('фхцчшщъыэюяь'));
const RARE_ENGLISH_LETTERS = new Set(Array.from('jqxz'));

function getWordDifficulty(word: string, language: WordleLanguage = 'ru') {
  const letters = Array.from(word);
  const rareLetters = language === 'en' ? RARE_ENGLISH_LETTERS : RARE_LETTERS;
  const rareScore = letters.filter((letter) => rareLetters.has(letter)).length * 9;
  const uniqueScore = new Set(letters).size * 3;
  const repeatPenalty = (letters.length - new Set(letters).size) * -4;

  return letters.length * 100 + rareScore + uniqueScore + repeatPenalty;
}

function getTargetWords(language: WordleLanguage, length: WordLength) {
  return WORDLE_TARGET_WORDS_BY_LANGUAGE[language][length];
}

function getAllowedWords(language: WordleLanguage, length: WordLength) {
  return WORDLE_ALLOWED_WORDS_BY_LANGUAGE[language][length];
}

function getSortedTargetWords(language: WordleLanguage, length: WordLength) {
  return Array.from(getTargetWords(language, length)).sort((firstWord, secondWord) => (
    getWordDifficulty(firstWord, language) - getWordDifficulty(secondWord, language) ||
    firstWord.localeCompare(secondWord, language === 'kk' ? 'kk' : language === 'en' ? 'en' : 'ru')
  ));
}

const CAMPAIGN_WORDS_BY_LANGUAGE: Record<WordleLanguage, Record<WordLength, string[]>> = {
  ru: {
    4: getSortedTargetWords('ru', 4),
    5: getSortedTargetWords('ru', 5),
    6: getSortedTargetWords('ru', 6),
  },
  kk: {
    4: getSortedTargetWords('kk', 4),
    5: getSortedTargetWords('kk', 5),
    6: getSortedTargetWords('kk', 6),
  },
  en: {
    4: getSortedTargetWords('en', 4),
    5: getSortedTargetWords('en', 5),
    6: getSortedTargetWords('en', 6),
  },
};

function getCampaignWordLength(level: number): WordLength {
  if (level <= 350) return 4;
  if (level <= 900) return level % 3 === 0 ? 5 : 4;
  if (level <= 1450) return level % 3 === 0 ? 6 : 5;
  return level % 5 === 0 ? 5 : 6;
}

function getCampaignWord(level: number, language: WordleLanguage) {
  const safeLevel = Math.max(1, Math.min(CAMPAIGN_LEVEL_COUNT, level));
  const length = getCampaignWordLength(safeLevel);
  const words = CAMPAIGN_WORDS_BY_LANGUAGE[language][length];
  const progress = (safeLevel - 1) / (CAMPAIGN_LEVEL_COUNT - 1);
  const baseIndex = Math.floor(progress * Math.max(0, words.length - 1));
  const randomOffset = (safeLevel * 17 + length * 31) % Math.max(1, Math.min(9, words.length));
  const index = Math.min(words.length - 1, baseIndex + randomOffset);

  return {
    length,
    word: words[index] ?? pickWord(length, language),
  };
}

function normalizeDictionaryWord(value: string, language: WordleLanguage = 'ru') {
  const normalizedValue = value.trim().toLowerCase();
  if (language === 'en') return normalizedValue;
  return language === 'ru' ? normalizedValue.replace(/ё/g, 'е') : normalizedValue;
}

function getLanguagePattern(language: WordleLanguage) {
  if (language === 'en') return /^[a-z]+$/;
  return language === 'kk' ? /^[а-яәғқңөұүһіё]+$/ : /^[а-я]+$/;
}

function getInputCleanupPattern(language: WordleLanguage) {
  if (language === 'en') return /[^a-z]/g;
  return language === 'kk' ? /[^а-яәғқңөұүһіё]/g : /[^а-я]/g;
}

function addWordByLength(target: Record<WordLength, Set<string>>, word: string, language: WordleLanguage) {
  const normalizedWord = normalizeDictionaryWord(word, language);
  const wordLength = normalizedWord.length;

  if (wordLength === 4 || wordLength === 5 || wordLength === 6) {
    target[wordLength].add(normalizedWord);
  }
}

function addWordForms(target: Record<WordLength, Set<string>>, word: string, language: WordleLanguage) {
  const normalizedWord = normalizeDictionaryWord(word, language);
  if (!getLanguagePattern(language).test(normalizedWord)) return;

  addWordByLength(target, normalizedWord, language);
  if (language === 'kk' || language === 'en') return;

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

  endings?.forEach((ending) => addWordByLength(target, `${withoutLastLetter}${ending}`, language));

  if (lastLetter && !'аеёиоуыэюяьй'.includes(lastLetter)) {
    ['а', 'у', 'е', 'ом', 'ы'].forEach((ending) => addWordByLength(target, `${normalizedWord}${ending}`, language));
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

function createWordleAllowedWords(language: WordleLanguage) {
  const targetWords = WORDLE_TARGET_WORDS_BY_LANGUAGE[language];
  const sourceWords = WORDLE_SOURCE_WORDS_BY_LANGUAGE[language];
  const allowedWords: Record<WordLength, Set<string>> = {
    4: new Set(targetWords[4]),
    5: new Set(targetWords[5]),
    6: new Set(targetWords[6]),
  };

  [...sourceWords[4], ...sourceWords[5], ...sourceWords[6], ...(language === 'ru' ? SECRET_WORDS : [])].forEach((word) => {
    addWordForms(allowedWords, word, language);
  });

  if (language === 'ru') {
    addFourLetterCheckVariants(allowedWords[4]);
    addFiveLetterCheckVariants(allowedWords[5]);
    addSixLetterCheckVariants(allowedWords[6]);
  }

  return allowedWords;
}

const WORDLE_ALLOWED_WORDS_BY_LANGUAGE: Record<WordleLanguage, Record<WordLength, Set<string>>> = {
  ru: createWordleAllowedWords('ru'),
  kk: createWordleAllowedWords('kk'),
  en: createWordleAllowedWords('en'),
};

function normalizeWord(value: string, language: WordleLanguage = 'ru') {
  return normalizeDictionaryWord(value, language);
}

function isPlausibleOfflineWord(word: string, length: WordLength, language: WordleLanguage) {
  if (word.length !== length || !getLanguagePattern(language).test(word)) return false;

  const uniqueLetters = new Set(word);
  if (uniqueLetters.size === 1) return false;

  const vowelPattern = language === 'en' ? /[aeiouy]/g : language === 'kk' ? /[аәеёиоөұүыіэюя]/g : /[аеёиоуыэюя]/g;
  const vowels = word.match(vowelPattern)?.length ?? 0;
  if (vowels === 0) return false;

  return true;
}

function getWordKey(word: string, length: WordLength, language: WordleLanguage) {
  return `${language}:${length}:${word}`;
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
      parsed.flatMap((item): string[] => {
        if (typeof item !== 'string') return [];
        if (/^(ru|kk):[456]:[а-яәғқңөұүһіё]+$/.test(item)) return [item];
        if (/^en:[456]:[a-z]+$/.test(item)) return [item];
        if (/^[456]:[а-я]+$/.test(item)) return [`ru:${item}`];
        return [];
      }),
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

function addLocalLearnedWord(word: string, length: WordLength, language: WordleLanguage) {
  const normalizedWord = normalizeWord(word, language);
  if (getAllowedWords(language, length).has(normalizedWord)) return;

  const learnedWords = readLocalLearnedWords();
  learnedWords.add(getWordKey(normalizedWord, length, language));
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

function getDailyWord(dateKey: string, language: WordleLanguage) {
  const words = Array.from(getTargetWords(language, 5)).sort();
  const seed = Array.from(dateKey).reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  return words[seed % words.length] ?? pickWord(5, language);
}

function getWordleModeKey(userEmail: string) {
  return `${WORDLE_MODE_PREFIX}_${userEmail}`;
}

function getWordleLanguageKey(userEmail: string) {
  return `${WORDLE_LANGUAGE_PREFIX}_${userEmail}`;
}

function loadWordleMode(userEmail: string): WordleMode {
  const savedMode = localStorage.getItem(getWordleModeKey(userEmail));
  if (savedMode === 'campaign') return 'campaign';
  return savedMode === 'daily' ? 'daily' : 'classic';
}

function getWordleStateKey(userEmail: string, mode: WordleMode, language: WordleLanguage, dateKey = getTodayKey()) {
  if (mode === 'campaign') {
    return `${WORDLE_STATE_PREFIX}_${userEmail}_${language}_campaign`;
  }

  return mode === 'daily'
    ? `${WORDLE_STATE_PREFIX}_${userEmail}_${language}_daily_${dateKey}`
    : `${WORDLE_STATE_PREFIX}_${userEmail}_${language}_classic`;
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

function loadWordleState(userEmail: string, mode: WordleMode, language: WordleLanguage, dateKey = getTodayKey()): SavedWordleState | null {
  const saved = localStorage.getItem(getWordleStateKey(userEmail, mode, language, dateKey));
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

async function isRealWord(word: string, length: WordLength, language: WordleLanguage) {
  const cacheKey = getWordKey(word, length, language);
  const cachedValue = readCachedValidation(cacheKey);
  if (cachedValue !== undefined) {
    if (cachedValue) {
      addLocalLearnedWord(word, length, language);
      void saveLearnedWord(word, length, language);
    }
    return cachedValue;
  }

  const languageName = language === 'kk' ? 'казахское' : language === 'en' ? 'английское' : 'русское';
  const languagePrompt = language === 'kk'
    ? 'Ты проверяешь слова для казахской игры Wordle. Верни только JSON вида {"valid": true} или {"valid": false}. true только если это реально существующее казахское слово в начальной форме или обычной словарной форме. Не принимай наборы букв, опечатки, имена людей, бренды, сокращения, русские слова и слова не той длины.'
    : language === 'en'
      ? 'You validate words for an English Wordle game. Return only JSON like {"valid": true} or {"valid": false}. true only if it is a real common English word in a normal dictionary form. Do not accept random letter strings, typos, names, brands, abbreviations, non-English words, or words with the wrong length.'
      : 'Ты проверяешь слова для русской игры Wordle. Верни только JSON вида {"valid": true} или {"valid": false}. true только если это реально существующее русское слово в начальной форме или обычной словарной форме. Не принимай наборы букв, опечатки, имена людей, бренды, сокращения, английские слова и слова не той длины.';

  const { data, error } = await supabase.functions.invoke<AiTextResponse>('ai', {
    body: {
      system: languagePrompt,
      prompt: language === 'en'
        ? `Word: "${word}". It must be exactly ${length} letters long. Is it a real English word for Wordle?`
        : `Слово: "${word}". Длина должна быть ровно ${length} букв. Это существующее ${languageName} слово для Wordle?`,
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
    addLocalLearnedWord(word, length, language);
    void saveLearnedWord(word, length, language);
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
      learnedWords.add(getWordKey(normalizeWord(item.word, 'ru'), item.length, 'ru'));
    }
  });

  writeLocalLearnedWords(learnedWords);
  return learnedWords;
}

async function saveLearnedWord(word: string, length: WordLength, language: WordleLanguage) {
  const normalizedWord = normalizeWord(word, language);

  if (getAllowedWords(language, length).has(normalizedWord)) return;

  addLocalLearnedWord(normalizedWord, length, language);

  if (language !== 'ru') return;

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

function isAllowedWord(word: string, length: WordLength, learnedWords: Set<string>, language: WordleLanguage) {
  return getAllowedWords(language, length).has(word) || learnedWords.has(getWordKey(word, length, language));
}

function pickWord(length: WordLength, language: WordleLanguage, currentWord?: string) {
  const knownWords = Array.from(getTargetWords(language, length));
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
  uiLanguage,
  userEmail,
}: WordleGameProps) {
  const text = WORDLE_UI_TEXT[uiLanguage];
  const syncedWordleLanguage = getWordleLanguageFromUi(uiLanguage);
  const boardRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const todayKey = getTodayKey();
  const initialLanguage = syncedWordleLanguage;
  const initialMode = loadWordleMode(userEmail);
  const savedState = loadWordleState(userEmail, initialMode, initialLanguage, todayKey);
  const initialDailyWord = getDailyWord(todayKey, initialLanguage);
  const initialCampaignLevel = Math.max(1, Math.min(CAMPAIGN_LEVEL_COUNT, savedState?.campaignLevel ?? 1));
  const initialCampaignWord = getCampaignWord(initialCampaignLevel, initialLanguage);
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
      : activeSavedState?.targetWord ?? pickWord(initialWordLength, initialLanguage);
  const [wordleLanguage, setWordleLanguage] = useState<WordleLanguage>(() => initialLanguage);
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
    localStorage.setItem(getWordleLanguageKey(userEmail), wordleLanguage);
    localStorage.setItem(getWordleModeKey(userEmail), wordleMode);
    localStorage.setItem(
      getWordleStateKey(userEmail, wordleMode, wordleLanguage, dailyDateKey),
      JSON.stringify({
        language: wordleLanguage,
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
  }, [campaignLevel, dailyDateKey, guess, hintIndex, message, rows, status, targetWord, userEmail, wordLength, wordleLanguage, wordleMode]);

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
  }, [dailyDateKey, wordleLanguage, wordleMode]);

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
  }, [dailyDateKey, wordleLanguage, wordleMode]);

  useEffect(() => {
    changeLanguage(syncedWordleLanguage);
  }, [syncedWordleLanguage]);

  function refreshDailyWordIfNeeded() {
    const currentTodayKey = getTodayKey();
    if (currentTodayKey === dailyDateKey) return;

    setDailyDateKey(currentTodayKey);

    if (wordleMode !== 'daily') return;

    const dailyWord = getDailyWord(currentTodayKey, wordleLanguage);
    const nextState = loadWordleState(userEmail, 'daily', wordleLanguage, currentTodayKey);
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
      const dailyWord = getDailyWord(currentTodayKey, wordleLanguage);
      const nextState = loadWordleState(userEmail, 'daily', wordleLanguage, currentTodayKey);
      applyState('daily', 5, dailyWord, nextState?.targetWord === dailyWord ? nextState : null);
      return;
    }

    if (wordleMode === 'campaign') {
      const nextLevel = status === 'won' ? Math.min(CAMPAIGN_LEVEL_COUNT, campaignLevel + 1) : campaignLevel;
      const nextCampaignWord = getCampaignWord(nextLevel, wordleLanguage);
      applyState('campaign', nextCampaignWord.length, nextCampaignWord.word, null, nextLevel);
      return;
    }

    setWordLength(nextLength);
    setTargetWord((currentWord) => pickWord(nextLength, wordleLanguage, currentWord));
    setGuess('');
    setRows([]);
    setStatus('playing');
    setMessage('');
    setHintIndex(null);
    setShowAd(false);
    window.setTimeout(focusBoard, 0);
  }

  function openClassicMode(nextLength: WordLength) {
    const nextState = loadWordleState(userEmail, 'classic', wordleLanguage, todayKey);
    const targetLength = nextState?.wordLength === nextLength ? nextLength : nextLength;
    const target = nextState?.wordLength === nextLength ? nextState.targetWord : pickWord(nextLength, wordleLanguage);
    applyState('classic', targetLength, target, nextState?.wordLength === nextLength ? nextState : null);
  }

  function openDailyMode() {
    const currentTodayKey = getTodayKey();
    setDailyDateKey(currentTodayKey);
    const dailyWord = getDailyWord(currentTodayKey, wordleLanguage);
    const nextState = loadWordleState(userEmail, 'daily', wordleLanguage, currentTodayKey);
    const validState = nextState?.targetWord === dailyWord ? nextState : null;
    applyState('daily', 5, dailyWord, validState);
  }

  function openCampaignMode() {
    const nextState = loadWordleState(userEmail, 'campaign', wordleLanguage, todayKey);
    const nextLevel = Math.max(1, Math.min(CAMPAIGN_LEVEL_COUNT, nextState?.campaignLevel ?? campaignLevel));
    const campaignWord = getCampaignWord(nextLevel, wordleLanguage);
    const validState = nextState?.targetWord === campaignWord.word ? nextState : null;
    applyState('campaign', campaignWord.length, campaignWord.word, validState, nextLevel);
  }

  function changeLanguage(nextLanguage: WordleLanguage) {
    if (nextLanguage === wordleLanguage) return;

    setWordleLanguage(nextLanguage);
    const currentTodayKey = getTodayKey();
    setDailyDateKey(currentTodayKey);

    if (wordleMode === 'daily') {
      const dailyWord = getDailyWord(currentTodayKey, nextLanguage);
      const nextState = loadWordleState(userEmail, 'daily', nextLanguage, currentTodayKey);
      applyState('daily', 5, dailyWord, nextState?.targetWord === dailyWord ? nextState : null);
      return;
    }

    if (wordleMode === 'campaign') {
      const nextState = loadWordleState(userEmail, 'campaign', nextLanguage, currentTodayKey);
      const nextLevel = Math.max(1, Math.min(CAMPAIGN_LEVEL_COUNT, nextState?.campaignLevel ?? 1));
      const campaignWord = getCampaignWord(nextLevel, nextLanguage);
      applyState('campaign', campaignWord.length, campaignWord.word, nextState?.targetWord === campaignWord.word ? nextState : null, nextLevel);
      return;
    }

    const nextState = loadWordleState(userEmail, 'classic', nextLanguage, currentTodayKey);
    const nextLength = nextState?.wordLength ?? wordLength;
    applyState('classic', nextLength, nextState?.targetWord ?? pickWord(nextLength, nextLanguage), nextState);
  }

  function openAdForHint() {
    if (status !== 'playing' || hintIndex !== null) return;
    setShowAd(true);
  }

  function closeAdAndRevealHint() {
    const nextHintIndex = getHintIndex(targetWord, rows);
    setHintIndex(nextHintIndex);
    setShowAd(false);
    setMessage(text.adHint(nextHintIndex + 1, targetWord[nextHintIndex]));
    window.setTimeout(focusBoard, 0);
  }

  function buyHint() {
    if (status !== 'playing' || hintIndex !== null) return;

    if (!onSpendCoins()) {
      setMessage(text.needCoins(hintCost));
      window.setTimeout(focusBoard, 0);
      return;
    }

    const nextHintIndex = getHintIndex(targetWord, rows);
    setHintIndex(nextHintIndex);
    setMessage(text.boughtHint(hintCost, nextHintIndex + 1, targetWord[nextHintIndex]));
    window.setTimeout(focusBoard, 0);
  }

  async function submitCurrentGuess() {
    const normalizedGuess = normalizeWord(guess, wordleLanguage);
    if (status !== 'playing' || checkingWord) return;

    if (normalizedGuess.length !== wordLength) {
      setMessage(text.needLetters(wordLength));
      focusBoard();
      return;
    }

    setCheckingWord(true);
    setMessage('Проверяем слово...');

    try {
      const validWord =
        isAllowedWord(normalizedGuess, wordLength, learnedWords, wordleLanguage) ||
        (await isRealWord(normalizedGuess, wordLength, wordleLanguage));

      if (!validWord) {
        setMessage('Такого слова нет в словаре игры. Попробуй другое.');
        focusBoard();
        return;
      }

      if (!getAllowedWords(wordleLanguage, wordLength).has(normalizedGuess)) {
        const wordKey = getWordKey(normalizedGuess, wordLength, wordleLanguage);
        setLearnedWords((currentLearnedWords) => new Set(currentLearnedWords).add(wordKey));
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Не получилось проверить слово через ИИ.');
      const validOfflineWord =
        isAllowedWord(normalizedGuess, wordLength, learnedWords, wordleLanguage) ||
        isPlausibleOfflineWord(normalizedGuess, wordLength, wordleLanguage);

      if (!validOfflineWord) {
        setMessage(text.aiWordError);
        focusBoard();
        return;
      }

      if (!getAllowedWords(wordleLanguage, wordLength).has(normalizedGuess)) {
        const wordKey = getWordKey(normalizedGuess, wordLength, wordleLanguage);
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
        setMessage(text.campaignWon(campaignLevel, targetWord, rewardCoins));
        return;
      }

      setMessage(text.won(targetWord, rewardCoins));
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

    const letter = normalizeWord(e.key, wordleLanguage).replace(getInputCleanupPattern(wordleLanguage), '');
    if (letter.length === 1 && guess.length < wordLength) {
      e.preventDefault();
      addLetter(letter);
      setMessage('');
    }
  }

  function handleMobileInputChange(value: string) {
    if (status !== 'playing' || checkingWord) return;

    const letters = normalizeWord(value, wordleLanguage).replace(getInputCleanupPattern(wordleLanguage), '').slice(0, wordLength);
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

  const currentAlphabet = wordleLanguage === 'kk'
    ? KAZAKH_ALPHABET
    : wordleLanguage === 'en'
      ? ENGLISH_ALPHABET
      : RUSSIAN_ALPHABET;

  return (
    <section className="wordle-shell">
      <div className="game-card">
        <p className="hello">{text.player}: {userEmail}</p>
        <h2>Wordle</h2>
        <p className="game-subtitle">{text.subtitle}</p>

        <p className="currency-note">
          {text.balance(coins, rewardCoins, hintCost)}
        </p>

        <div className="wordle-modes" aria-label={text.lengthLabel}>
          {([4, 5, 6] as const).map((length) => (
            <button
              className={wordleMode === 'classic' && wordLength === length ? 'mode-button active' : 'mode-button'}
              key={length}
              onClick={() => openClassicMode(length)}
              type="button"
            >
              {length} {text.letters}
            </button>
          ))}
          <button
            className={wordleMode === 'daily' ? 'mode-button active daily-word-button' : 'mode-button daily-word-button'}
            onClick={openDailyMode}
            type="button"
          >
            {text.daily}
          </button>
          <button
            className={wordleMode === 'campaign' ? 'mode-button active campaign-word-button' : 'mode-button campaign-word-button'}
            onClick={openCampaignMode}
            type="button"
          >
            {text.campaign}
          </button>
        </div>
        {wordleMode === 'campaign' && (
          <p className="daily-word-note campaign-progress">
            {text.level(campaignLevel, CAMPAIGN_LEVEL_COUNT, wordLength)}
          </p>
        )}

        <form className="wordle-form" onSubmit={submitGuess}>
          <div
            aria-label={text.boardLabel}
            className="wordle-board-button"
            onClick={focusBoard}
            onKeyDown={handleBoardKeyDown}
            ref={boardRef}
            role="textbox"
            tabIndex={0}
          >
            <input
              aria-label={text.inputLabel}
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

          <div className="letter-board" aria-label={text.letterList}>
            {currentAlphabet.map((letter) => {
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
                {text.erase}
              </button>
              <button disabled={status !== 'playing' || checkingWord} type="submit">
                {checkingWord ? text.checking : text.check}
              </button>
            </div>
            <div className="wordle-actions-group wordle-actions-hints">
              <button
                className="soft-button"
                disabled={status !== 'playing' || hintIndex !== null || coins < hintCost || checkingWord}
                onClick={buyHint}
                type="button"
              >
                {text.hint(hintCost)}
              </button>
              <button
                className="ad-button"
                disabled={status !== 'playing' || hintIndex !== null || showAd || checkingWord}
                onClick={openAdForHint}
                type="button"
              >
                {text.ad}
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
              <span>{status === 'won' ? text.correctWord : text.wordWas}</span>
              <strong>{targetWord}</strong>
            </div>
            {wordleMode === 'daily' ? (
              <p className="daily-word-note finished">
                {text.dailyFinished(dailyCountdown)}
              </p>
            ) : wordleMode === 'campaign' ? (
              <button className="next-button" onClick={() => resetGame()} type="button">
                {status === 'won' && campaignLevel < CAMPAIGN_LEVEL_COUNT ? text.nextLevel : text.retryLevel}
              </button>
            ) : (
              <button className="next-button" onClick={() => resetGame()} type="button">
                {text.newWord}
              </button>
            )}
          </>
        )}
      </div>

      {showAd && <AdModal onClose={closeAdAndRevealHint} uiLanguage={uiLanguage} />}
    </section>
  );
}
