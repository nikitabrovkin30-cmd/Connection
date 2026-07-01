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
  uiLanguage: 'ru' | 'kk' | 'en';
  userEmail: string;
};

type UiLanguage = WhoAmIGameProps['uiLanguage'];

const WHO_UI_TEXT = {
  ru: {
    player: 'Игрок',
    subtitle: 'Задавай вопросы, на которые можно ответить только да или нет. Потом попробуй угадать слово.',
    secretWord: 'Секретное слово',
    questionPlaceholder: 'например: это живое?',
    answering: 'Отвечаю...',
    ask: 'Спросить',
    guessPlaceholder: 'твой ответ',
    guess: 'Угадать',
    hintCoins: (cost: number) => `Подсказка за ${cost} монет`,
    hintAd: 'Подсказка за рекламу',
    giveUp: 'Сдаться',
    newWord: 'Новое слово',
    questions: 'Вопросы',
    noQuestions: 'Пока нет вопросов.',
    yes: 'Да',
    no: 'Нет',
    aiUnavailable: 'ИИ сейчас недоступен, поэтому я не могу ответить да или нет.',
    correct: (word: string, reward: number) => `Верно! Это слово: ${word}. +${reward} монет.`,
    wrong: 'Пока нет. Задай еще вопрос или попробуй другое слово.',
    answerWas: (word: string) => `Ответ был: ${word}.`,
    needCoins: (cost: number) => `Нужно ${cost} монет для подсказки.`,
    hintBought: (cost: number) => `Подсказка куплена за ${cost} монет.`,
    adHintOpened: 'Реклама просмотрена. Подсказка открыта.',
  },
  kk: {
    player: 'Ойыншы',
    subtitle: 'Тек иә немесе жоқ деп жауап беруге болатын сұрақтар қой. Кейін сөзді тап.',
    secretWord: 'Жасырын сөз',
    questionPlaceholder: 'мысалы: бұл тірі ме?',
    answering: 'Жауап беруде...',
    ask: 'Сұрау',
    guessPlaceholder: 'жауабың',
    guess: 'Табу',
    hintCoins: (cost: number) => `${cost} монетаға кеңес`,
    hintAd: 'Жарнама арқылы кеңес',
    giveUp: 'Берілу',
    newWord: 'Жаңа сөз',
    questions: 'Сұрақтар',
    noQuestions: 'Әзірге сұрақ жоқ.',
    yes: 'Иә',
    no: 'Жоқ',
    aiUnavailable: 'ИИ қазір қолжетімсіз, сондықтан иә немесе жоқ деп жауап бере алмаймын.',
    correct: (word: string, reward: number) => `Дұрыс! Бұл сөз: ${word}. +${reward} монета.`,
    wrong: 'Әзірге жоқ. Тағы сұрақ қой немесе басқа сөзді байқап көр.',
    answerWas: (word: string) => `Жауап: ${word}.`,
    needCoins: (cost: number) => `Кеңес үшін ${cost} монета керек.`,
    hintBought: (cost: number) => `Кеңес ${cost} монетаға сатып алынды.`,
    adHintOpened: 'Жарнама қаралды. Кеңес ашылды.',
  },
  en: {
    player: 'Player',
    subtitle: 'Ask questions that can be answered only yes or no. Then try to guess the word.',
    secretWord: 'Secret word',
    questionPlaceholder: 'for example: is it alive?',
    answering: 'Answering...',
    ask: 'Ask',
    guessPlaceholder: 'your answer',
    guess: 'Guess',
    hintCoins: (cost: number) => `Hint for ${cost} coins`,
    hintAd: 'Hint for ad',
    giveUp: 'Give up',
    newWord: 'New word',
    questions: 'Questions',
    noQuestions: 'No questions yet.',
    yes: 'Yes',
    no: 'No',
    aiUnavailable: 'AI is unavailable, so I cannot answer yes or no right now.',
    correct: (word: string, reward: number) => `Correct! The word is: ${word}. +${reward} coins.`,
    wrong: 'Not yet. Ask another question or try another word.',
    answerWas: (word: string) => `Answer was: ${word}.`,
    needCoins: (cost: number) => `You need ${cost} coins for a hint.`,
    hintBought: (cost: number) => `Hint bought for ${cost} coins.`,
    adHintOpened: 'Ad watched. Hint opened.',
  },
} as const;

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

const WHO_LOCAL_TOPICS_EN = {
  animal: ['dog', 'cat', 'wolf', 'bear', 'lion', 'tiger', 'rabbit', 'eagle', 'duck', 'fish', 'horse', 'cow', 'goat', 'shark', 'dolphin', 'snake', 'frog', 'spider', 'turtle', 'whale'],
  nature: ['river', 'ocean', 'forest', 'mountain', 'cloud', 'storm', 'flower', 'grass', 'planet', 'island', 'stone', 'sand', 'snow', 'rain', 'wind', 'tree', 'leaf', 'sun', 'moon', 'star'],
  object: ['chair', 'table', 'phone', 'camera', 'guitar', 'bottle', 'window', 'wallet', 'pencil', 'mirror', 'key', 'lamp', 'spoon', 'bicycle', 'pillow', 'door', 'cup', 'hat', 'brush', 'bed', 'train', 'motor'],
} as const;

const WHO_LOCAL_TOPICS_KK = {
  animal: ['ит', 'мысық', 'қасқыр', 'аю', 'арыстан', 'жолбарыс', 'қоян', 'бүркіт', 'үйрек', 'балық', 'жылқы', 'сиыр', 'ешкі', 'акула', 'дельфин', 'жылан', 'бақа', 'өрмекші', 'тасбақа', 'кит'],
  nature: ['өзен', 'теңіз', 'орман', 'тау', 'бұлт', 'дауыл', 'гүл', 'шөп', 'ғаламшар', 'арал', 'тас', 'құм', 'қар', 'жаңбыр', 'жел', 'ағаш', 'жапырақ', 'күн', 'ай', 'жұлдыз'],
  object: ['орындық', 'үстел', 'телефон', 'камера', 'гитара', 'бөтелке', 'терезе', 'әмиян', 'қарындаш', 'айна', 'кілт', 'шам', 'қасық', 'велосипед', 'жастық', 'есік', 'кесе', 'қалпақ', 'щетка', 'төсек', 'пойыз', 'мотор'],
} as const;

const WHO_LOCAL_TOPICS_BY_LANGUAGE = {
  ru: WHO_LOCAL_TOPICS,
  en: WHO_LOCAL_TOPICS_EN,
  kk: WHO_LOCAL_TOPICS_KK,
} as const;

const WHO_AM_I_WORDS_BY_LANGUAGE: Record<UiLanguage, string[]> = {
  ru: WHO_AM_I_WORDS,
  en: Array.from(new Set(Object.values(WHO_LOCAL_TOPICS_EN).flat())),
  kk: Array.from(new Set(Object.values(WHO_LOCAL_TOPICS_KK).flat())),
};

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

const WHO_FUNCTION_QUESTION_RULES: readonly {
  keywords: readonly string[];
  yesWords: readonly string[];
}[] = [
  {
    keywords: ['сидень', 'сидеть', 'сесть', 'садятся', 'посидеть'],
    yesWords: ['стул', 'кресло', 'диван', 'скамейка', 'табурет', 'лавка'],
  },
  {
    keywords: ['писать', 'записывать', 'рисовать', 'чертить'],
    yesWords: ['ручка', 'карандаш', 'перо', 'мел', 'кисть'],
  },
  {
    keywords: ['резать', 'отрезать', 'рубить', 'разрезать'],
    yesWords: ['нож', 'ножницы', 'топор', 'пила'],
  },
  {
    keywords: ['светить', 'освещать', 'свет', 'темноте'],
    yesWords: ['лампа', 'фонарь', 'свеча'],
  },
  {
    keywords: ['пить', 'наливать', 'напиток'],
    yesWords: ['стакан', 'чашка', 'кружка', 'бутылка', 'чайник'],
  },
  {
    keywords: ['звонить', 'сообщение', 'связи'],
    yesWords: ['телефон'],
  },
  {
    keywords: ['хранить', 'складывать', 'носить вещи', 'положить внутрь'],
    yesWords: ['шкаф', 'ящик', 'сумка', 'рюкзак', 'чемодан', 'корзина', 'банка'],
  },
  {
    keywords: ['двигатель', 'мотор', 'заводит', 'запускает', 'вращает'],
    yesWords: ['мотор'],
  },
];

function normalizeWord(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function getWhoAmIStateKey(userEmail: string, language: UiLanguage) {
  return `${WHO_AM_I_STATE_PREFIX}_${userEmail}_${language}`;
}

function pickWord(currentWord: string | undefined, language: UiLanguage) {
  const languageWords = WHO_AM_I_WORDS_BY_LANGUAGE[language];
  const options = languageWords.filter((word) => word !== currentWord);
  const words = options.length > 0 ? options : languageWords;
  return words[Math.floor(Math.random() * words.length)] ?? 'книга';
}

function parseYesNo(value: string): 'Да' | 'Нет' | null {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue.startsWith('да') || normalizedValue.includes('"да"')) return 'Да';
  if (normalizedValue.startsWith('нет') || normalizedValue.includes('"нет"')) return 'Нет';
  if (normalizedValue.startsWith('yes') || normalizedValue.includes('"yes"')) return 'Да';
  if (normalizedValue.startsWith('no') || normalizedValue.includes('"no"')) return 'Нет';
  if (normalizedValue.startsWith('�?') || normalizedValue.includes('"�?"')) return 'Да';
  if (normalizedValue.startsWith('��?') || normalizedValue.includes('"��?"')) return 'Нет';

  return null;
}

function hasTopic(word: string, topic: keyof typeof WHO_LOCAL_TOPICS, language: UiLanguage = 'ru') {
  if (language !== 'ru') {
    const localizedTopic = topic as 'animal' | 'nature' | 'object';
    const words = (WHO_LOCAL_TOPICS_BY_LANGUAGE[language][localizedTopic] ?? []) as readonly string[];
    return words.includes(normalizeWord(word));
  }
  return WHO_LOCAL_TOPICS[topic].includes(normalizeWord(word));
}

function answerFromLocalDictionary(question: string, targetWord: string, language: UiLanguage): 'Да' | 'Нет' | null {
  const normalizedQuestion = normalizeWord(question)
    .replace(/[?!.,:;()"«»]/g, ' ')
    .replace(/\s+/g, ' ');
  const normalizedTarget = normalizeWord(targetWord);
  const questionWords = normalizedQuestion.split(' ').filter(Boolean);

  if (language !== 'ru') {
    const topics = WHO_LOCAL_TOPICS_BY_LANGUAGE[language];
    const animalWords = topics.animal as readonly string[];
    const natureWords = topics.nature as readonly string[];
    const objectWords = topics.object as readonly string[];
    const allWords = new Set(WHO_AM_I_WORDS_BY_LANGUAGE[language].map(normalizeWord));
    const yes: 'Да' = 'Да';
    const no: 'Нет' = 'Нет';
    const hasAny = (keywords: readonly string[]) => keywords.some((keyword) => normalizedQuestion.includes(normalizeWord(keyword)));

    if (hasAny(language === 'en' ? ['animal', 'alive', 'living', 'creature', 'bird', 'fish'] : ['жануар', 'тірі', 'құс', 'балық'])) {
      return animalWords.includes(normalizedTarget) ? yes : no;
    }

    if (hasAny(language === 'en' ? ['nature', 'natural', 'plant', 'weather', 'sky', 'water', 'forest', 'earth'] : ['табиғат', 'өсімдік', 'ауа райы', 'аспан', 'су', 'орман', 'жер'])) {
      return natureWords.includes(normalizedTarget) || animalWords.includes(normalizedTarget) ? yes : no;
    }

    if (hasAny(language === 'en' ? ['object', 'thing', 'item', 'tool', 'use', 'hold', 'take'] : ['зат', 'нәрсе', 'құрал', 'қолдан', 'ұста', 'алуға'])) {
      return objectWords.includes(normalizedTarget) ? yes : no;
    }

    if (hasAny(language === 'en' ? ['sit', 'seat', 'sitting'] : ['отыру', 'отырғыш', 'отыратын'])) {
      return ['chair', 'sofa', 'bench', 'bed', 'орындық', 'диван', 'төсек'].includes(normalizedTarget) ? yes : no;
    }

    if (questionWords.some((word) => allWords.has(word))) {
      return questionWords.includes(normalizedTarget) ? yes : no;
    }

    return null;
  }

  const matchedFunctionRule = WHO_FUNCTION_QUESTION_RULES.find((rule) => (
    rule.keywords.some((keyword) => normalizedQuestion.includes(normalizeWord(keyword)))
  ));

  if (matchedFunctionRule) {
    return matchedFunctionRule.yesWords.includes(normalizedTarget) ? 'Да' : 'Нет';
  }

  const matchedRule = WHO_LOCAL_QUESTION_RULES.find((rule) => (
    rule.keywords.some((keyword) => normalizedQuestion.includes(normalizeWord(keyword)))
  ));

  if (matchedRule) {
    if (matchedRule.answerTopic === 'nature') {
      return hasTopic(targetWord, 'nature') || hasTopic(targetWord, 'animal') ? 'Да' : 'Нет';
    }

    return hasTopic(targetWord, matchedRule.answerTopic) ? 'Да' : 'Нет';
  }

  if (questionWords.some((word) => WHO_AM_I_TARGET_SET.has(word))) {
    return questionWords.includes(normalizedTarget) ? 'Да' : 'Нет';
  }

  return null;
}

function getWordTopics(word: string, language: UiLanguage) {
  return Object.entries(WHO_LOCAL_TOPICS_BY_LANGUAGE[language])
    .filter(([, words]) => words.includes(normalizeWord(word)))
    .map(([topic]) => topic);
}

function getTopicHint(topic: string, language: UiLanguage) {
  if (language === 'en') {
    const topicHints: Record<string, string> = {
      animal: 'It belongs to the living world.',
      nature: 'It is connected with nature.',
      object: 'It is a thing people can use or see.',
    };

    return topicHints[topic] ?? 'Try asking which broad group it belongs to.';
  }

  if (language === 'kk') {
    const topicHints: Record<string, string> = {
      animal: 'Бұл тірі әлемге қатысты.',
      nature: 'Бұл табиғатпен байланысты.',
      object: 'Бұл адам қолдана алатын немесе көре алатын зат.',
    };

    return topicHints[topic] ?? 'Алдымен оның қай үлкен топқа жататынын сұрап көр.';
  }

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

function getWhoHints(word: string, language: UiLanguage) {
  const letters = Array.from(word);
  const topics = getWordTopics(word, language);
  const topicHint = topics[0] ? getTopicHint(topics[0], language) : `В слове ${letters.length} букв.`;
  const letterWord = letters.length === 1 ? 'буква' : letters.length > 1 && letters.length < 5 ? 'буквы' : 'букв';
  const middleIndex = Math.floor(letters.length / 2);
  const openedLetters = letters
    .map((letter, index) => (index === middleIndex ? letter : '_'))
    .join(' ');

  if (language === 'en') {
    return getUniqueHints([
      topicHint,
      `The word has ${letters.length} letters.`,
      `Opened letter: ${openedLetters}.`,
    ]);
  }

  if (language === 'kk') {
    return getUniqueHints([
      topicHint,
      `�?��� ${letters.length} ?�� ���.`,
      `����?�� ?��: ${openedLetters}.`,
    ]);
  }

  return getUniqueHints([
    topicHint,
    `В слове ${letters.length} ${letterWord}.`,
    `Открытая буква: ${openedLetters}.`,
  ]);
}

function loadWhoAmIState(userEmail: string, language: UiLanguage): SavedWhoAmIState | null {
  const saved = localStorage.getItem(getWhoAmIStateKey(userEmail, language));
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as Partial<SavedWhoAmIState>;

    if (
      typeof parsed.targetWord !== 'string' ||
      !WHO_AM_I_WORDS_BY_LANGUAGE[language].includes(parsed.targetWord) ||
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

async function askYesNo(question: string, targetWord: string, language: UiLanguage) {
  const localAnswer = answerFromLocalDictionary(question, targetWord, language);
  if (localAnswer) return localAnswer;

  const { data, error } = await supabase.functions.invoke<AiTextResponse>('ai', {
    body: {
      system:
        'Ты ведущий игры Who am I. Игрок пытается угадать секретное русское слово. Отвечай строго только одним словом: "Да" или "Нет". Сначала проверь точное свойство или назначение, о котором спрашивает игрок. Если вопрос про "предмет для сиденья", отвечай "Да" только для стула, кресла, дивана, скамейки и похожих вещей, на которых сидят. Не отвечай "Да" всем предметам только потому, что они предметы. Не объясняй, не давай подсказок, не раскрывай секретное слово. Если вопрос нельзя уверенно проверить для секретного слова, отвечай "Нет".',
      prompt: `Секретное слово: "${targetWord}". Вопрос игрока: "${question}". Ответь только "Да" или "Нет" по точному смыслу вопроса.`,
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
  uiLanguage,
  userEmail,
}: WhoAmIGameProps) {
  const text = WHO_UI_TEXT[uiLanguage];
  const savedState = loadWhoAmIState(userEmail, uiLanguage);
  const [targetWord, setTargetWord] = useState(() => savedState?.targetWord ?? pickWord(undefined, uiLanguage));
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
  const hints = useMemo(() => getWhoHints(targetWord, uiLanguage), [targetWord, uiLanguage]);
  const shownHints = hints.slice(0, revealedHints);

  useEffect(() => {
    localStorage.setItem(
      getWhoAmIStateKey(userEmail, uiLanguage),
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
  }, [guess, history, message, question, revealedHints, status, targetWord, uiLanguage, userEmail]);

  function startNewRound() {
    setTargetWord((currentWord) => pickWord(currentWord, uiLanguage));
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
      const answer = await askYesNo(cleanQuestion, targetWord, uiLanguage);
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
      setMessage(text.aiUnavailable);
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
      setMessage(text.correct(targetWord, rewardCoins));
      onReward();
      return;
    }

    setMessage(text.wrong);
    setGuess('');
  }

  function giveUp() {
    if (roundFinished) return;
    setStatus('gave-up');
    setShowAd(false);
    setMessage(text.answerWas(targetWord));
  }

  function revealHint() {
    if (roundFinished || revealedHints >= hints.length) return;
    setRevealedHints((currentHints) => Math.min(hints.length, currentHints + 1));
    setMessage('');
  }

  function buyHint() {
    if (roundFinished || revealedHints >= hints.length) return;

    if (coins < hintCost || !onSpendCoins()) {
      setMessage(text.needCoins(hintCost));
      return;
    }

    revealHint();
    setMessage(text.hintBought(hintCost));
  }

  function openAdForHint() {
    if (roundFinished || revealedHints >= hints.length) return;
    setShowAd(true);
  }

  function closeAdAndRevealHint() {
    setShowAd(false);
    revealHint();
    setMessage(text.adHintOpened);
  }

  return (
    <section className="who-shell">
      <div className="game-card who-card">
        <p className="hello">{text.player}: {userEmail}</p>
        <h2>Who am I?</h2>
        <p className="game-subtitle">{text.subtitle}</p>

        <div className={`secret-box who-secret${roundFinished ? ' who-secret-finished' : ''}`}>
          {roundFinished ? (
            <div className="who-answer-reveal">
              <span>{text.secretWord}:</span>
              <strong>{targetWord}</strong>
            </div>
          ) : (
            <>
              <span>{text.secretWord}</span>
              <strong>{'?'.repeat(targetWord.length)}</strong>
            </>
          )}
        </div>

        <form className="who-form" onSubmit={submitQuestion}>
          <input
            disabled={roundFinished || loading}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={text.questionPlaceholder}
            type="text"
            value={question}
          />
          <button disabled={roundFinished || loading || question.trim().length < 3} type="submit">
            {loading ? text.answering : text.ask}
          </button>
        </form>

        <form className="who-form" onSubmit={submitGuess}>
          <input
            disabled={roundFinished}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={text.guessPlaceholder}
            type="text"
            value={guess}
          />
          <button disabled={roundFinished || !guess.trim()} type="submit">
            {text.guess}
          </button>
        </form>

        <div className="who-actions">
          <button
            className="soft-button"
            disabled={roundFinished || revealedHints >= hints.length || coins < hintCost}
            onClick={buyHint}
            type="button"
          >
            {text.hintCoins(hintCost)}
          </button>
          <button
            className="ad-button"
            disabled={roundFinished || revealedHints >= hints.length || showAd}
            onClick={openAdForHint}
            type="button"
          >
            {text.hintAd}
          </button>
          <button className="danger-button" disabled={roundFinished} onClick={giveUp} type="button">
            {text.giveUp}
          </button>
          {roundFinished && (
            <button className="next-button" onClick={startNewRound} type="button">
              {text.newWord}
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
          <h3>{text.questions}</h3>
          {history.length === 0 ? (
            <p>{text.noQuestions}</p>
          ) : (
            <ul>
              {history.map((item) => (
                <li key={item.id}>
                  <span>{item.question}</span>
                  <strong>{item.answer === 'Да' ? text.yes : text.no}</strong>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {showAd && <AdModal onClose={closeAdAndRevealHint} uiLanguage={uiLanguage} />}
    </section>
  );
}
