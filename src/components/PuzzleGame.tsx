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
type PuzzleStatus = 'playing' | 'solved' | 'gave-up';

type SavedPuzzleState = {
  puzzleId: string;
  inputAnswer: string;
  message: string;
  solvedIds: string[];
  revealedHints: number;
  status: PuzzleStatus;
};

type LegacySavedPuzzleState = Partial<SavedPuzzleState> & {
  revealedHint?: boolean;
};

type PuzzleGameProps = {
  coins: number;
  hintCost: number;
  onReward: () => void;
  onSpendCoins: () => boolean;
  rewardCoins: number;
  uiLanguage: 'ru' | 'kk' | 'en';
  userEmail: string;
};

type UiLanguage = PuzzleGameProps['uiLanguage'];

const PUZZLE_UI_TEXT = {
  ru: {
    player: 'Игрок',
    subtitle: 'Разгадай загадку и напиши ответ одним словом. За правильный ответ дается награда.',
    difficultyLabel: 'Сложность Puzzle',
    difficulty: { easy: 'Легко', medium: 'Средне', hard: 'Сложно' },
    question: 'Загадка',
    hint: (index: number) => `Подсказка ${index}`,
    answerPlaceholder: 'ответ',
    check: 'Проверить',
    hintCoins: (cost: number) => `Подсказка за ${cost} монет`,
    hintAd: 'Подсказка за рекламу',
    giveUp: 'Сдаться',
    newPuzzle: 'Новая загадка',
    correctAnswer: 'Правильный ответ',
    answerWas: 'Ответ был',
    progress: (solved: number, total: number) => `Разгадано: ${solved}/${total}`,
    needCoins: (cost: number) => `Нужно ${cost} монет для подсказки.`,
    hintBought: (cost: number) => `Подсказка куплена за ${cost} монет.`,
    adHintOpened: 'Реклама просмотрена. Подсказка открыта.',
    gaveUp: (answer: string) => `Ответ был: ${answer}. Попробуй следующую загадку.`,
    wrong: 'Пока не то. Попробуй другую ассоциацию.',
    correct: (answer: string, reward: number) => `Верно! Ответ: ${answer}. +${reward} монет.`,
  },
  kk: {
    player: 'Ойыншы',
    subtitle: 'Жұмбақты шешіп, жауапты бір сөзбен жаз. Дұрыс жауап үшін сыйлық беріледі.',
    difficultyLabel: 'Puzzle қиындығы',
    difficulty: { easy: 'Оңай', medium: 'Орташа', hard: 'Қиын' },
    question: 'Жұмбақ',
    hint: (index: number) => `Кеңес ${index}`,
    answerPlaceholder: 'жауап',
    check: 'Тексеру',
    hintCoins: (cost: number) => `${cost} монетаға кеңес`,
    hintAd: 'Жарнама арқылы кеңес',
    giveUp: 'Берілу',
    newPuzzle: 'Жаңа жұмбақ',
    correctAnswer: 'Дұрыс жауап',
    answerWas: 'Жауап',
    progress: (solved: number, total: number) => `Шешілді: ${solved}/${total}`,
    needCoins: (cost: number) => `Кеңес үшін ${cost} монета керек.`,
    hintBought: (cost: number) => `Кеңес ${cost} монетаға сатып алынды.`,
    adHintOpened: 'Жарнама қаралды. Кеңес ашылды.',
    gaveUp: (answer: string) => `Жауап: ${answer}. Келесі жұмбақты байқап көр.`,
    wrong: 'Әзірге дұрыс емес. Басқа жауапты байқап көр.',
    correct: (answer: string, reward: number) => `Дұрыс! Жауап: ${answer}. +${reward} монета.`,
  },
  en: {
    player: 'Player',
    subtitle: 'Solve the riddle and write the answer as one word. A correct answer gives a reward.',
    difficultyLabel: 'Puzzle difficulty',
    difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
    question: 'Riddle',
    hint: (index: number) => `Hint ${index}`,
    answerPlaceholder: 'answer',
    check: 'Check',
    hintCoins: (cost: number) => `Hint for ${cost} coins`,
    hintAd: 'Hint for ad',
    giveUp: 'Give up',
    newPuzzle: 'New riddle',
    correctAnswer: 'Correct answer',
    answerWas: 'Answer was',
    progress: (solved: number, total: number) => `Solved: ${solved}/${total}`,
    needCoins: (cost: number) => `You need ${cost} coins for a hint.`,
    hintBought: (cost: number) => `Hint bought for ${cost} coins.`,
    adHintOpened: 'Ad watched. Hint opened.',
    gaveUp: (answer: string) => `Answer was: ${answer}. Try the next riddle.`,
    wrong: 'Not yet. Try another association.',
    correct: (answer: string, reward: number) => `Correct! Answer: ${answer}. +${reward} coins.`,
  },
} as const;

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
  {
    id: 'umbrella',
    question: 'Над головой раскрывается, от дождя закрывается. Что это?',
    answers: ['зонт'],
    hint: 'Его берут в плохую погоду.',
  },
  {
    id: 'chair',
    question: 'Стоит на ножках, а садятся на него люди. Что это?',
    answers: ['стул'],
    hint: 'Он часто стоит у стола.',
  },
  {
    id: 'soap',
    question: 'Пены много создаёт, грязь с ладоней уберёт. Что это?',
    answers: ['мыло'],
    hint: 'Им моют руки.',
  },
  {
    id: 'ball',
    question: 'Круглый, прыгает, летит, играть с собой велит. Что это?',
    answers: ['мяч'],
    hint: 'Его пинают или бросают.',
  },
  {
    id: 'bag',
    question: 'В школу ходит вместе с тобой и несёт тетради за спиной. Что это?',
    answers: ['рюкзак', 'сумка'],
    hint: 'В него кладут учебники.',
  },
  {
    id: 'lamp',
    question: 'Ночью темноту прогоняет, но сама не солнце. Что это?',
    answers: ['лампа'],
    hint: 'Её включают выключателем.',
  },
  {
    id: 'spoon',
    question: 'Суп набирает, но сама не ест. Что это?',
    answers: ['ложка'],
    hint: 'Ею пользуются за столом.',
  },
  {
    id: 'bicycle',
    question: 'Два колеса, руль и педали, а бензин ему не нужен. Что это?',
    answers: ['велосипед'],
    hint: 'На нём ездят, крутя педали.',
  },
  {
    id: 'comb',
    question: 'По волосам гуляет, порядок оставляет. Что это?',
    answers: ['расческа', 'гребень'],
    hint: 'Ею пользуются перед зеркалом.',
  },
  {
    id: 'plate',
    question: 'На столе стоит, еду держит, но сама не ест. Что это?',
    answers: ['тарелка'],
    hint: 'Из неё едят.',
  },
  {
    id: 'pillow',
    question: 'Мягкая, молчаливая, ночью голову встречает. Что это?',
    answers: ['подушка'],
    hint: 'Она лежит на кровати.',
  },
  {
    id: 'door',
    question: 'Открывается, закрывается и решает, кто войдёт. Что это?',
    answers: ['дверь'],
    hint: 'У неё бывает ручка.',
  },
  {
    id: 'cup',
    question: 'Чай в себе держит, но пить не умеет. Что это?',
    answers: ['чашка', 'кружка'],
    hint: 'Её берут за ручку.',
  },
  {
    id: 'hat',
    question: 'На голове сидит, от холода или солнца защитит. Что это?',
    answers: ['шапка', 'кепка'],
    hint: 'Это надевают на голову.',
  },
  {
    id: 'brush',
    question: 'Зубы чистит каждый день, но сама улыбаться не умеет. Что это?',
    answers: ['щетка', 'щётка'],
    hint: 'Ей пользуются с пастой.',
  },
  {
    id: 'bed',
    question: 'Днём ждёт, ночью отдых даёт. Что это?',
    answers: ['кровать'],
    hint: 'На ней спят.',
  },
  {
    id: 'train',
    question: 'По рельсам длинной змейкой идёт и людей везёт. Что это?',
    answers: ['поезд'],
    hint: 'Он приезжает на вокзал.',
  },
  {
    id: 'apple',
    question: 'Круглое, сладкое, на дереве растёт. Что это?',
    answers: ['яблоко'],
    hint: 'Это фрукт.',
  },
];

const MEDIUM_PUZZLES: readonly Puzzle[] = [
  {
    id: 'echo',
    question: 'Я возвращаю сказанное, но никогда не начинаю разговор первым. Что это?',
    answers: ['эхо'],
    hint: 'Его можно услышать там, где звук отскакивает обратно.',
  },
  {
    id: 'compass',
    question: 'В кармане лежит маленький советчик, который молча спорит со всеми дорогами. Что это?',
    answers: ['компас'],
    hint: 'Он помогает выбрать направление.',
  },
  {
    id: 'calendar',
    question: 'У него много чисел, но он не решает примеры; он стареет быстрее человека. Что это?',
    answers: ['календарь'],
    hint: 'С ним удобно ждать праздники и важные даты.',
  },
  {
    id: 'anchor',
    question: 'Чтобы не уйти вперед, он специально падает вниз. Что это?',
    answers: ['якорь'],
    hint: 'Его используют на воде.',
  },
  {
    id: 'password',
    question: 'Это короткая тайна, которая открывает длинный путь внутрь. Что это?',
    answers: ['пароль'],
    hint: 'Без него часто не войти в аккаунт.',
  },
  {
    id: 'magnet',
    question: 'Он не просит подойти, но некоторые вещи сами идут к нему. Что это?',
    answers: ['магнит'],
    hint: 'Лучше всего он дружит с железом.',
  },
  {
    id: 'root',
    question: 'Спрятан ниже всех, но держит выше всех. Что это?',
    answers: ['корень'],
    hint: 'Это важная часть растения.',
  },
  {
    id: 'battery',
    question: 'Пока в ней есть запас, предмет живет; когда запас исчезает, предмет молчит. Что это?',
    answers: ['батарея', 'аккумулятор'],
    hint: 'Ее заряжают или меняют.',
  },
  {
    id: 'thermometer',
    question: 'Он не лечит, не греет и не охлаждает, но первым сообщает, что с теплом что-то не так. Что это?',
    answers: ['термометр', 'градусник'],
    hint: 'На нем смотрят градусы.',
  },
  {
    id: 'seed',
    question: 'Снаружи почти ничего, внутри целый будущий рост. Что это?',
    answers: ['семя', 'семечко'],
    hint: 'Его можно посадить.',
  },
  {
    id: 'ladder',
    question: 'Она не дорога, но по ней поднимаются выше. Что это?',
    answers: ['лестница'],
    hint: 'У неё есть ступени.',
  },
  {
    id: 'screen',
    question: 'Сам молчит, но показывает лица, игры, фильмы и сообщения. Что это?',
    answers: ['экран'],
    hint: 'Он есть у телефона и компьютера.',
  },
  {
    id: 'pocket',
    question: 'Маленькая комната на одежде, где живут ключи и мелочь. Что это?',
    answers: ['карман'],
    hint: 'Он бывает на куртке или брюках.',
  },
  {
    id: 'bridge_medium',
    question: 'Он не берег, не лодка и не вода, но помогает перейти через реку. Что это?',
    answers: ['мост'],
    hint: 'Он соединяет две стороны.',
  },
  {
    id: 'notebook',
    question: 'В нём мысли становятся строками, а уроки - страницами. Что это?',
    answers: ['тетрадь', 'блокнот'],
    hint: 'В него пишут ручкой.',
  },
  {
    id: 'traffic_light',
    question: 'Стоит у дороги и молча говорит: стой, жди или иди. Что это?',
    answers: ['светофор'],
    hint: 'У него три цвета.',
  },
  {
    id: 'telescope',
    question: 'Далёкое делает ближе, особенно если смотреть в небо. Что это?',
    answers: ['телескоп'],
    hint: 'С ним наблюдают звёзды.',
  },
  {
    id: 'thermos',
    question: 'Держит тепло внутри, даже когда вокруг холодно. Что это?',
    answers: ['термос'],
    hint: 'В него наливают чай или кофе.',
  },
  {
    id: 'dictionary',
    question: 'В нём живут слова, но сам он почти никогда не разговаривает. Что это?',
    answers: ['словарь'],
    hint: 'В нём ищут значение слова.',
  },
  {
    id: 'elevator',
    question: 'Комната без мебели, которая возит людей вверх и вниз. Что это?',
    answers: ['лифт'],
    hint: 'В нём нажимают кнопку этажа.',
  },
  {
    id: 'fountain',
    question: 'Стоит на месте, но воду вверх отправляет. Что это?',
    answers: ['фонтан'],
    hint: 'Его часто ставят в парке или на площади.',
  },
  {
    id: 'wallet',
    question: 'Маленький домик для денег и карточек. Что это?',
    answers: ['кошелек', 'кошелёк'],
    hint: 'Его носят в сумке или кармане.',
  },
  {
    id: 'glasses',
    question: 'Сидят на носу и помогают миру стать чётче. Что это?',
    answers: ['очки'],
    hint: 'Их носят для зрения.',
  },
  {
    id: 'microphone',
    question: 'Голос делает громче, но сам песни не поёт. Что это?',
    answers: ['микрофон'],
    hint: 'Его держат на сцене.',
  },
  {
    id: 'compass_school',
    question: 'Рисует круги ровно, хотя сам не художник. Что это?',
    answers: ['циркуль'],
    hint: 'Его используют на геометрии.',
  },
  {
    id: 'backpack',
    question: 'У него есть лямки, а внутри часто живёт школьный день. Что это?',
    answers: ['рюкзак'],
    hint: 'Его носят за спиной.',
  },
  {
    id: 'receipt',
    question: 'После покупки появляется маленькая бумажная память. Что это?',
    answers: ['чек'],
    hint: 'Его дают на кассе.',
  },
  {
    id: 'keyboard',
    question: 'Много кнопок в ряд, а из них рождаются слова на экране. Что это?',
    answers: ['клавиатура'],
    hint: 'Ею печатают текст.',
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
  {
    id: 'balance',
    question: 'Он исчезает, если одна сторона берет слишком много. Что это?',
    answers: ['баланс', 'равновесие'],
    hint: 'Он связан с равными силами или весом.',
  },
  {
    id: 'habit',
    question: 'Сначала ты делаешь это сам, потом оно будто делает тебя. Что это?',
    answers: ['привычка'],
    hint: 'Она появляется от повторения.',
  },
  {
    id: 'horizon',
    question: 'Ты идёшь к нему, а он всё равно остаётся впереди. Что это?',
    answers: ['горизонт'],
    hint: 'Он виден вдали.',
  },
  {
    id: 'doubt',
    question: 'Он не запрещает идти, но заставляет остановиться внутри. Что это?',
    answers: ['сомнение'],
    hint: 'Оно появляется, когда нет уверенности.',
  },
  {
    id: 'experience',
    question: 'Его нельзя купить сразу, но можно получить через ошибки и время. Что это?',
    answers: ['опыт'],
    hint: 'Он помогает действовать умнее.',
  },
  {
    id: 'trace',
    question: 'Он остаётся после того, кто уже ушёл. Что это?',
    answers: ['след'],
    hint: 'Его можно увидеть на снегу или в памяти.',
  },
  {
    id: 'rule',
    question: 'Оно ограничивает действие, чтобы всем было понятнее, как играть или жить. Что это?',
    answers: ['правило'],
    hint: 'Его можно соблюдать или нарушить.',
  },
  {
    id: 'mask',
    question: 'Она показывает лицо, пряча лицо. Что это?',
    answers: ['маска'],
    hint: 'Её надевают, чтобы скрыться или сыграть роль.',
  },
  {
    id: 'reputation',
    question: 'Её строят поступками, а разрушить может одно слово. Что это?',
    answers: ['репутация'],
    hint: 'Она связана с тем, как тебя видят другие.',
  },
  {
    id: 'compromise',
    question: 'Когда обе стороны немного уступают, появляется он. Что это?',
    answers: ['компромисс'],
    hint: 'Он помогает закончить спор.',
  },
  {
    id: 'contradiction',
    question: 'Внутри него две мысли толкаются и не могут быть правдой вместе. Что это?',
    answers: ['противоречие'],
    hint: 'Оно появляется, когда одно мешает другому.',
  },
  {
    id: 'responsibility',
    question: 'Её берут на себя, когда последствия тоже становятся твоими. Что это?',
    answers: ['ответственность'],
    hint: 'Она связана с выбором и обязанностью.',
  },
  {
    id: 'intuition',
    question: 'Она подсказывает без доказательств, но иногда попадает точно. Что это?',
    answers: ['интуиция'],
    hint: 'Это внутреннее чувство.',
  },
  {
    id: 'patience',
    question: 'Оно нужно, когда хочется быстрее, но приходится ждать спокойно. Что это?',
    answers: ['терпение'],
    hint: 'Без него трудно ждать.',
  },
  {
    id: 'observation',
    question: 'Оно начинается с тихого взгляда, но помогает заметить то, что другие пропустили. Что это?',
    answers: ['наблюдение'],
    hint: 'Оно требует внимания и терпения.',
  },
  {
    id: 'perspective',
    question: 'Меняется точка взгляда - меняется и она. Что это?',
    answers: ['перспектива'],
    hint: 'Она связана с тем, откуда смотреть.',
  },
  {
    id: 'discipline',
    question: 'Она держит порядок, даже когда настроение ушло гулять. Что это?',
    answers: ['дисциплина'],
    hint: 'Она помогает делать дело регулярно.',
  },
  {
    id: 'curiosity',
    question: 'Из-за него вопрос открывает дверь к новому знанию. Что это?',
    answers: ['любопытство'],
    hint: 'Оно заставляет узнавать больше.',
  },
];

const ENGLISH_PUZZLES: Record<PuzzleDifficulty, readonly Puzzle[]> = {
  easy: [
    { id: 'en-shadow', question: 'It follows you in the light, but disappears in the dark. What is it?', answers: ['shadow'], hint: 'You see it when something blocks light.' },
    { id: 'en-clock', question: 'It stands still, but tells you where the day is going. What is it?', answers: ['clock', 'watch'], hint: 'It has hands or numbers.' },
    { id: 'en-mirror', question: 'It shows your face, but never speaks. What is it?', answers: ['mirror'], hint: 'You often find it in a bathroom.' },
    { id: 'en-key', question: 'Small in your hand, but it can open a whole room. What is it?', answers: ['key'], hint: 'It works with a lock.' },
    { id: 'en-rain', question: 'It falls from clouds and wakes the ground. What is it?', answers: ['rain'], hint: 'You may need an umbrella.' },
  ],
  medium: [
    { id: 'en-candle', question: 'The longer it works, the shorter it becomes. What is it?', answers: ['candle'], hint: 'It gives light with a flame.' },
    { id: 'en-map', question: 'It shows roads and cities, but never travels. What is it?', answers: ['map'], hint: 'Travelers use it to find a route.' },
    { id: 'en-battery', question: 'While it has energy, a device lives; when it is empty, the device sleeps. What is it?', answers: ['battery'], hint: 'You charge it.' },
    { id: 'en-window', question: 'It lets light come in, but keeps the weather outside. What is it?', answers: ['window'], hint: 'It is often made of glass.' },
    { id: 'en-wallet', question: 'It is small, often folded, and guards money. What is it?', answers: ['wallet'], hint: 'People keep cards in it too.' },
  ],
  hard: [
    { id: 'en-secret', question: 'When it is kept, it is yours; when it is told, it belongs to others too. What is it?', answers: ['secret'], hint: 'You whisper it carefully.' },
    { id: 'en-memory', question: 'It has no weight, but can carry a whole childhood. What is it?', answers: ['memory'], hint: 'It lives in your mind.' },
    { id: 'en-echo', question: 'It answers you, but never starts the conversation. What is it?', answers: ['echo'], hint: 'Mountains and empty halls can make it.' },
    { id: 'en-time', question: 'You spend it, lose it, and wait for it, but cannot hold it. What is it?', answers: ['time'], hint: 'Clocks measure it.' },
    { id: 'en-idea', question: 'It can appear in silence and change what someone builds. What is it?', answers: ['idea'], hint: 'It begins in the head.' },
  ],
};

const KAZAKH_PUZZLES: Record<PuzzleDifficulty, readonly Puzzle[]> = {
  easy: [
    { id: 'kk-shadow', question: 'Жарықта артыңнан жүреді, қараңғыда жоғалады. Бұл не?', answers: ['көлеңке'], hint: 'Жарық бір нәрсеге түскенде пайда болады.' },
    { id: 'kk-clock', question: 'Өзі орнында тұрады, бірақ уақытты көрсетеді. Бұл не?', answers: ['сағат'], hint: 'Онда сандар немесе тілдер болады.' },
    { id: 'kk-mirror', question: 'Сені көрсетеді, бірақ сөйлемейді. Бұл не?', answers: ['айна'], hint: 'Оған қарағанда өзіңді көресің.' },
    { id: 'kk-key', question: 'Кішкентай ғана, бірақ есік ашады. Бұл не?', answers: ['кілт'], hint: 'Құлыппен бірге қолданылады.' },
    { id: 'kk-rain', question: 'Бұлттан түсіп, жерді суландырады. Бұл не?', answers: ['жаңбыр'], hint: 'Ол кезде қолшатыр керек болуы мүмкін.' },
  ],
  medium: [
    { id: 'kk-candle', question: 'Жанған сайын өзі қысқарады. Бұл не?', answers: ['шам'], hint: 'Жарық береді.' },
    { id: 'kk-map', question: 'Қалалар мен жолдарды көрсетеді, бірақ өзі жүрмейді. Бұл не?', answers: ['карта'], hint: 'Жол табуға көмектеседі.' },
    { id: 'kk-battery', question: 'Қуаты барда зат жұмыс істейді, қуаты бітсе тоқтайды. Бұл не?', answers: ['батарея'], hint: 'Оны зарядтауға болады.' },
    { id: 'kk-window', question: 'Жарықты кіргізеді, ал суықты сыртта ұстайды. Бұл не?', answers: ['терезе'], hint: 'Көбіне әйнектен жасалады.' },
    { id: 'kk-wallet', question: 'Кішкентай, бүктеледі, ақша сақтайды. Бұл не?', answers: ['әмиян'], hint: 'Ішінде карта да болуы мүмкін.' },
  ],
  hard: [
    { id: 'kk-secret', question: 'Іште сақталса сенікі, айтылса ортақ болады. Бұл не?', answers: ['құпия'], hint: 'Оны ақырын айтады.' },
    { id: 'kk-memory', question: 'Салмағы жоқ, бірақ бүкіл балалық шақты сақтай алады. Бұл не?', answers: ['естелік'], hint: 'Ол санада өмір сүреді.' },
    { id: 'kk-echo', question: 'Өзі бірінші сөйлемейді, бірақ саған жауап береді. Бұл не?', answers: ['жаңғырық'], hint: 'Тау мен бос залда естіледі.' },
    { id: 'kk-time', question: 'Оны күтесің, жоғалтасың, жұмсайсың, бірақ ұстай алмайсың. Бұл не?', answers: ['уақыт'], hint: 'Оны сағат өлшейді.' },
    { id: 'kk-idea', question: 'Тыныштықта пайда болып, үлкен нәрсе салуға себеп болады. Бұл не?', answers: ['идея'], hint: 'Ол басыңда туады.' },
  ],
};

const PUZZLES_BY_LANGUAGE: Record<UiLanguage, Record<PuzzleDifficulty, readonly Puzzle[]>> = {
  ru: {
    easy: EASY_PUZZLES,
    medium: MEDIUM_PUZZLES,
    hard: HARD_PUZZLES,
  },
  kk: KAZAKH_PUZZLES,
  en: ENGLISH_PUZZLES,
};

function getPuzzles(language: UiLanguage, difficulty: PuzzleDifficulty) {
  return PUZZLES_BY_LANGUAGE[language][difficulty];
}

function getMaxPuzzleHints(difficulty: PuzzleDifficulty) {
  return difficulty === 'hard' ? 2 : 1;
}

const EXTRA_PUZZLE_HINTS: Record<string, readonly string[]> = {
  shadow: ['Ее форма меняется в течение дня.', 'Без света ее почти невозможно увидеть.'],
  clock: ['Этот предмет связан с минутами.', 'Он помогает не опоздать.'],
  book: ['Внутри много страниц.', 'Она может быть бумажной или электронной.'],
  river: ['Это движется по руслу.', 'На карте часто выглядит как синяя линия.'],
  key: ['Обычно его носят в кармане или на связке.', 'Без него замок не откроется.'],
  snow: ['Он холодный и мягкий.', 'Из него можно слепить ком.'],
  mirror: ['Оно возвращает изображение.', 'Часто висит в ванной или прихожей.'],
  fire: ['Он опасен без контроля.', 'От него остается пепел.'],
  road: ['По ней идут, едут и путешествуют.', 'Она соединяет места.'],
  phone: ['В нем есть экран.', 'Он помогает говорить на расстоянии.'],
  sun: ['Без него днем было бы темно.', 'Оно находится в небе.'],
  pencil: ['У него есть грифель.', 'Его можно заточить.'],
  window: ['Через него проходит свет.', 'Оно бывает открытым или закрытым.'],
  letter: ['Из таких знаков собирают слова.', 'Она бывает строчной и заглавной.'],
  cloud: ['Оно закрывает солнце.', 'Может быть белым или темным.'],
  needle: ['Она проходит через ткань.', 'С ней часто используют нитку.'],
  bridge: ['Он помогает перейти через препятствие.', 'Может быть через реку или дорогу.'],
  map: ['На ней ищут маршрут.', 'Она показывает места сверху.'],
  candle: ['Она горит маленьким пламенем.', 'Ее используют, когда нужен мягкий свет.'],
  dream: ['Это происходит во сне.', 'Иногда его трудно вспомнить утром.'],
  umbrella: ['Его раскрывают над собой.', 'Он защищает от капель.'],
  chair: ['У него есть сиденье.', 'Он нужен, чтобы не стоять.'],
  soap: ['Оно скользкое, когда мокрое.', 'После него руки становятся чище.'],
  ball: ['Он часто бывает круглым.', 'С ним играют во дворе или спортзале.'],
  bag: ['Его носят на плечах или в руке.', 'Внутри могут лежать книги.'],
  lamp: ['Она дает искусственный свет.', 'Может стоять на столе или висеть на потолке.'],
  spoon: ['Она лежит рядом с тарелкой.', 'Ею удобно есть жидкую еду.'],
  bicycle: ['У него два колеса.', 'Он едет от силы ног.'],
  comb: ['У неё много зубчиков.', 'Она помогает уложить волосы.'],
  plate: ['Она бывает глубокой или плоской.', 'Её ставят перед едой.'],
  pillow: ['Она мягкая и прямоугольная.', 'На ней удобно лежать головой.'],
  door: ['Она может быть закрытой или открытой.', 'Через неё проходят в комнату.'],
  cup: ['В неё наливают напиток.', 'Она часто стоит на блюдце.'],
  hat: ['Она бывает зимней или летней.', 'Её снимают в помещении.'],
  brush: ['У неё есть щетинки.', 'Она нужна утром и вечером.'],
  bed: ['У неё есть матрас.', 'Она связана со сном.'],
  train: ['У него много вагонов.', 'Он движется по рельсам.'],
  apple: ['У него бывает кожура и сердцевина.', 'Оно может быть красным или зелёным.'],
  echo: ['Оно появляется после громкого звука.', 'Это не новый голос, а возвращение старого.'],
  compass: ['У него есть стрелка.', 'Он связан со сторонами света.'],
  calendar: ['В нем есть месяцы.', 'Он помогает помнить дату.'],
  anchor: ['Он тяжелый.', 'Его бросают с корабля.'],
  password: ['Его лучше делать сложным.', 'Он защищает доступ.'],
  magnet: ['Он может прилипать к металлу.', 'У него есть невидимая сила притяжения.'],
  root: ['Он находится под землей.', 'Через него растение получает воду.'],
  battery: ['В ней хранится энергия.', 'Когда она садится, устройство выключается.'],
  thermometer: ['Он показывает число.', 'Его используют при болезни или погоде.'],
  seed: ['Из него может вырасти растение.', 'Оно маленькое, но живое внутри.'],
  ladder: ['По ней идут вверх или вниз.', 'Она помогает достать что-то высоко.'],
  screen: ['Он светится и показывает картинку.', 'На него долго смотрят во время игры или фильма.'],
  pocket: ['Он пришит к одежде.', 'В него можно спрятать маленькую вещь.'],
  bridge_medium: ['Он находится над препятствием.', 'По нему можно перейти с одной стороны на другую.'],
  notebook: ['Внутри у него страницы.', 'Он нужен для записей.'],
  traffic_light: ['Он управляет движением.', 'Красный, желтый и зеленый помогают понять команду.'],
  telescope: ['Он нужен для дальнего взгляда.', 'Через него рассматривают космос.'],
  thermos: ['Он похож на бутылку, но сохраняет температуру.', 'Его берут в дорогу.'],
  dictionary: ['Он стоит рядом с языком и словами.', 'В нём слова идут по порядку.'],
  elevator: ['Он находится внутри здания.', 'В нём двери открываются сами.'],
  fountain: ['В нём вода движется красиво.', 'Он часто украшает место.'],
  wallet: ['Он маленький и складной.', 'В нём могут лежать монеты.'],
  glasses: ['У них есть две линзы.', 'Они помогают лучше видеть.'],
  microphone: ['Он принимает звук.', 'Его используют ведущие и певцы.'],
  compass_school: ['У него есть игла или карандаш.', 'Он связан с окружностью.'],
  backpack: ['У него есть карманы.', 'Его часто берут в школу.'],
  receipt: ['Он подтверждает покупку.', 'На нём указана цена.'],
  keyboard: ['На ней есть буквы.', 'Она лежит перед экраном.'],
  silence: ['Ее можно услышать только когда ничего не звучит.', 'Она исчезает, если начать говорить.'],
  time: ['Его считают секундами и минутами.', 'Оно всегда идет вперед.'],
  secret: ['Его скрывают от других.', 'Если рассказать всем, он перестает быть таким.'],
  promise: ['Оно связано с доверием.', 'Его можно выполнить или нарушить.'],
  memory: ['Она хранит события.', 'Она помогает вспоминать.'],
  choice: ['Он появляется, когда есть варианты.', 'После него путь может измениться.'],
  thought: ['Она появляется в голове.', 'Из нее может родиться идея.'],
  name: ['Им называют человека или предмет.', 'Оно помогает отличать одного от другого.'],
  question: ['Он требует ответа.', 'В конце него часто ставят особый знак.'],
  border: ['Она разделяет две стороны.', 'Ее можно провести на карте или в правилах.'],
  balance: ['Его легко нарушить перекосом.', 'Он важен в весах, спорте и решениях.'],
  habit: ['Она становится автоматической.', 'Она может быть полезной или вредной.'],
  horizon: ['Он виден там, где небо будто встречается с землей.', 'К нему нельзя дойти до конца.'],
  doubt: ['Оно спорит с уверенностью.', 'Из-за него человек перепроверяет решение.'],
  experience: ['Он приходит после практики.', 'Чем больше пробуешь, тем больше его становится.'],
  trace: ['Он показывает, что кто-то был здесь.', 'Он может быть физическим или переносным.'],
  rule: ['Оно задает порядок.', 'В игре без него было бы непонятно, что можно делать.'],
  mask: ['Ее надевают на лицо.', 'Она может скрывать или изображать другого.'],
  reputation: ['Она растёт из доверия.', 'Её можно испортить плохим поступком.'],
  compromise: ['В нём никто не получает всё полностью.', 'Он помогает договориться.'],
  contradiction: ['В нём части не сходятся.', 'Оно делает мысль спорной.'],
  responsibility: ['Она появляется вместе с последствиями.', 'Её нельзя просто переложить без причины.'],
  intuition: ['Она работает без длинных объяснений.', 'Её часто называют внутренним голосом.'],
  patience: ['Оно помогает не сорваться.', 'Оно нужно при ожидании.'],
  observation: ['Оно помогает замечать детали.', 'Без него легко пропустить важное.'],
  perspective: ['Она меняется вместе с углом зрения.', 'В рисунке она создаёт глубину.'],
  discipline: ['Она держится на повторении.', 'Она помогает не бросать начатое.'],
  curiosity: ['Она начинается с вопроса.', 'Она тянет к новому знанию.'],
};

const ALTERNATE_PUZZLE_ANSWERS: Record<string, readonly string[]> = {
  shadow: ['тень человека', 'силуэт'],
  clock: ['часики', 'будильник'],
  book: ['книжка', 'роман', 'учебник'],
  river: ['ручей', 'поток'],
  key: ['ключик', 'отмычка'],
  snow: ['снежок', 'снежинка'],
  mirror: ['зеркальце'],
  fire: ['пламя', 'костер', 'костёр'],
  road: ['путь', 'трасса', 'шоссе'],
  phone: ['смартфон', 'мобильник', 'сотовый'],
  sun: ['солнышко', 'светило'],
  pencil: ['простой карандаш'],
  window: ['окошко'],
  letter: ['литера', 'символ'],
  cloud: ['облачко'],
  needle: ['швейная игла'],
  bridge: ['мостик', 'переправа'],
  map: ['карта мира', 'план'],
  candle: ['свечка'],
  dream: ['сновидение'],
  umbrella: ['зонтик'],
  chair: ['стульчик', 'кресло'],
  soap: ['мыльце'],
  ball: ['мячик'],
  bag: ['ранец', 'портфель'],
  lamp: ['светильник', 'лампочка'],
  spoon: ['ложечка'],
  bicycle: ['велик', 'байк'],
  comb: ['расчёска'],
  plate: ['блюдо'],
  pillow: ['подушка для сна'],
  door: ['дверца'],
  cup: ['стакан'],
  hat: ['головной убор'],
  brush: ['зубная щетка', 'зубная щётка'],
  bed: ['кроватка'],
  train: ['электричка', 'состав'],
  apple: ['яблочко'],
  echo: ['отзвук', 'отголосок'],
  compass: ['компасик'],
  calendar: ['календарик'],
  anchor: ['якорек', 'якорёк'],
  password: ['код', 'пинкод', 'пин-код'],
  magnet: ['магнитик'],
  root: ['корешок'],
  battery: ['акб', 'батарейка'],
  thermometer: ['термометр', 'градусник'],
  seed: ['зерно', 'зернышко', 'зёрнышко'],
  ladder: ['стремянка'],
  screen: ['дисплей', 'монитор'],
  pocket: ['кармашек'],
  bridge_medium: ['мостик', 'переправа'],
  notebook: ['записная книжка', 'блокнот'],
  traffic_light: ['светофорчик'],
  telescope: ['подзорная труба'],
  thermos: ['термокружка'],
  dictionary: ['словарик'],
  elevator: ['лифт', 'подъемник', 'подъёмник'],
  fountain: ['фонтанчик'],
  wallet: ['портмоне', 'бумажник'],
  glasses: ['очки для зрения'],
  microphone: ['микрофончик'],
  compass_school: ['циркуль'],
  backpack: ['ранец', 'портфель', 'сумка'],
  receipt: ['квитанция', 'кассовый чек'],
  keyboard: ['клава'],
  silence: ['молчание'],
  time: ['времечко'],
  secret: ['тайна', 'секретик'],
  promise: ['клятва', 'слово'],
  memory: ['воспоминание'],
  choice: ['решение', 'вариант'],
  thought: ['идея', 'мысль'],
  name: ['название', 'имя'],
  question: ['вопросик'],
  border: ['граница', 'рубеж'],
  balance: ['равновесие'],
  habit: ['обычка'],
  horizon: ['горизонт'],
  doubt: ['неуверенность'],
  experience: ['практика', 'навык'],
  trace: ['след', 'отпечаток'],
  rule: ['закон', 'условие'],
  mask: ['маска', 'личина'],
  reputation: ['имидж', 'слава'],
  compromise: ['уступка', 'договоренность', 'договорённость'],
  contradiction: ['несостыковка', 'противоречие'],
  responsibility: ['обязанность'],
  intuition: ['чутье', 'чутьё'],
  patience: ['выдержка'],
  observation: ['наблюдение', 'замечание'],
  perspective: ['ракурс', 'точка зрения'],
  discipline: ['порядок', 'самоконтроль'],
  curiosity: ['интерес', 'любознательность'],
};

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function normalizeHint(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е').replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
}

function getAcceptedPuzzleAnswers(puzzle: Puzzle) {
  return [...puzzle.answers, ...(ALTERNATE_PUZZLE_ANSWERS[puzzle.id] ?? [])];
}

function getLetterHint(answer: string, language: UiLanguage) {
  const normalizedAnswer = normalizeAnswer(answer);
  if (language === 'en') {
    return `The answer starts with "${normalizedAnswer[0]}" and has ${normalizedAnswer.length} letters.`;
  }
  if (language === 'kk') {
    return `Жауап "${normalizedAnswer[0]}" әрпінен басталады және ${normalizedAnswer.length} әріптен тұрады.`;
  }
  return `Ответ начинается на "${normalizedAnswer[0]}" и состоит из ${normalizedAnswer.length} букв.`;
}

function getEndingHint(answer: string, language: UiLanguage) {
  const normalizedAnswer = normalizeAnswer(answer);
  if (language === 'en') {
    return `The last letter is "${normalizedAnswer[normalizedAnswer.length - 1]}".`;
  }
  if (language === 'kk') {
    return `Соңғы әріп - "${normalizedAnswer[normalizedAnswer.length - 1]}".`;
  }
  return `Последняя буква ответа - "${normalizedAnswer[normalizedAnswer.length - 1]}".`;
}

function getVowelHint(answer: string, language: UiLanguage) {
  const normalizedAnswer = normalizeAnswer(answer);
  if (language === 'en') {
    const vowelCount = normalizedAnswer.match(/[aeiou]/g)?.length ?? 0;
    return `The answer has ${vowelCount} vowel${vowelCount === 1 ? '' : 's'}.`;
  }
  if (language === 'kk') {
    const vowelCount = normalizedAnswer.match(/[аәеёиоөұүуыіэюя]/g)?.length ?? 0;
    return `Жауапта ${vowelCount} дауысты әріп бар.`;
  }
  const vowelCount = normalizedAnswer.match(/[аеёиоуыэюя]/g)?.length ?? 0;
  return `В ответе ${vowelCount} ${vowelCount === 1 ? 'гласная' : vowelCount > 1 && vowelCount < 5 ? 'гласные' : 'гласных'}.`;
}

function getPatternHint(answer: string, language: UiLanguage) {
  const letters = Array.from(normalizeAnswer(answer));
  const pattern = letters
    .map((letter, index) => (index === 0 || index === letters.length - 1 || index % 3 === 1 ? letter : '_'))
    .join(' ');

  if (language === 'en') {
    return `Part of the word: ${pattern}.`;
  }
  if (language === 'kk') {
    return `Сөздің бір бөлігі: ${pattern}.`;
  }
  return `Часть слова: ${pattern}.`;
}

function getPuzzleHints(puzzle: Puzzle, difficulty: PuzzleDifficulty, language: UiLanguage) {
  const uniqueHints: string[] = [];
  const seenHints = new Set<string>();

  [
    puzzle.hint,
    ...(EXTRA_PUZZLE_HINTS[puzzle.id] ?? []),
    getLetterHint(puzzle.answers[0], language),
    getEndingHint(puzzle.answers[0], language),
    getVowelHint(puzzle.answers[0], language),
    getPatternHint(puzzle.answers[0], language),
  ].forEach((hint) => {
    const normalizedHint = normalizeHint(hint);
    if (seenHints.has(normalizedHint)) return;

    seenHints.add(normalizedHint);
    uniqueHints.push(hint);
  });

  return uniqueHints.slice(0, getMaxPuzzleHints(difficulty));
}

function getPuzzleStateKey(userEmail: string, difficulty: PuzzleDifficulty, language: UiLanguage) {
  return `${PUZZLE_STATE_PREFIX}_${userEmail}_${language}_${difficulty}`;
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

function loadPuzzleState(userEmail: string, difficulty: PuzzleDifficulty, language: UiLanguage): SavedPuzzleState | null {
  const saved = localStorage.getItem(getPuzzleStateKey(userEmail, difficulty, language));
  if (!saved) return null;

  try {
    const parsed = JSON.parse(saved) as LegacySavedPuzzleState;
    if (typeof parsed.puzzleId !== 'string') return null;
    const savedSolvedIds = Array.isArray(parsed.solvedIds)
      ? parsed.solvedIds.filter((id): id is string => typeof id === 'string')
      : [];
    const solvedByLegacy = savedSolvedIds.includes(parsed.puzzleId);

    return {
      puzzleId: parsed.puzzleId,
      inputAnswer: typeof parsed.inputAnswer === 'string' ? parsed.inputAnswer : '',
      message: typeof parsed.message === 'string' ? parsed.message : '',
      solvedIds: savedSolvedIds,
      revealedHints:
        typeof parsed.revealedHints === 'number'
          ? Math.min(getMaxPuzzleHints(difficulty), Math.max(0, parsed.revealedHints))
          : parsed.revealedHint === true
            ? 1
            : 0,
      status:
        parsed.status === 'solved' || parsed.status === 'gave-up' || parsed.status === 'playing'
          ? parsed.status
          : solvedByLegacy
            ? 'solved'
            : 'playing',
    };
  } catch {
    return null;
  }
}

function createInitialPuzzleState(userEmail: string, difficulty: PuzzleDifficulty, language: UiLanguage) {
  const puzzles = getPuzzles(language, difficulty);
  const savedState = loadPuzzleState(userEmail, difficulty, language);
  const solvedIds = new Set(savedState?.solvedIds ?? []);
  const puzzle = findSavedPuzzle(puzzles, savedState?.puzzleId) ?? pickPuzzle(puzzles, solvedIds);

  return {
    puzzle,
    inputAnswer: savedState?.inputAnswer ?? '',
    message: savedState?.message ?? '',
    solvedIds,
    revealedHints: savedState?.revealedHints ?? 0,
    status: savedState?.status ?? (solvedIds.has(puzzle.id) ? 'solved' : 'playing'),
  };
}

export function PuzzleGame({ coins, hintCost, onReward, onSpendCoins, rewardCoins, uiLanguage, userEmail }: PuzzleGameProps) {
  const text = PUZZLE_UI_TEXT[uiLanguage];
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>('easy');
  const initialState = useMemo(() => createInitialPuzzleState(userEmail, difficulty, uiLanguage), [difficulty, uiLanguage, userEmail]);

  const [puzzle, setPuzzle] = useState<Puzzle>(initialState.puzzle);
  const [inputAnswer, setInputAnswer] = useState(initialState.inputAnswer);
  const [message, setMessage] = useState(initialState.message);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => initialState.solvedIds);
  const [revealedHints, setRevealedHints] = useState(initialState.revealedHints);
  const [status, setStatus] = useState<PuzzleStatus>(initialState.status);
  const [showAd, setShowAd] = useState(false);

  const puzzles = getPuzzles(uiLanguage, difficulty);
  const roundFinished = status !== 'playing';
  const puzzleHints = getPuzzleHints(puzzle, difficulty, uiLanguage);
  const shownHints = puzzleHints.slice(0, revealedHints);
  const hasMoreHints = revealedHints < puzzleHints.length;

  useEffect(() => {
    const nextState = createInitialPuzzleState(userEmail, difficulty, uiLanguage);
    setPuzzle(nextState.puzzle);
    setInputAnswer(nextState.inputAnswer);
    setMessage(nextState.message);
    setSolvedIds(nextState.solvedIds);
    setRevealedHints(nextState.revealedHints);
    setStatus(nextState.status);
    setShowAd(false);
  }, [difficulty, uiLanguage, userEmail]);

  useEffect(() => {
    localStorage.setItem(
      getPuzzleStateKey(userEmail, difficulty, uiLanguage),
      JSON.stringify({
        puzzleId: puzzle.id,
        inputAnswer,
        message,
        solvedIds: Array.from(solvedIds),
        revealedHints,
        status,
      } satisfies SavedPuzzleState),
    );
  }, [difficulty, inputAnswer, message, puzzle.id, revealedHints, solvedIds, status, uiLanguage, userEmail]);

  function startNextPuzzle() {
    const nextPuzzle = pickPuzzle(puzzles, solvedIds, puzzle.id);
    setPuzzle(nextPuzzle);
    setInputAnswer('');
    setMessage('');
    setRevealedHints(0);
    setStatus('playing');
    setShowAd(false);
  }

  function revealNextHint() {
    if (!hasMoreHints || roundFinished) return;
    setRevealedHints((currentHints) => Math.min(puzzleHints.length, currentHints + 1));
  }

  function buyHint() {
    if (!hasMoreHints || roundFinished) return;

    if (coins < hintCost || !onSpendCoins()) {
      setMessage(text.needCoins(hintCost));
      return;
    }

    revealNextHint();
    setMessage(text.hintBought(hintCost));
  }

  function openAdForHint() {
    if (!hasMoreHints || roundFinished) return;
    setShowAd(true);
  }

  function closeAdAndRevealHint() {
    setShowAd(false);
    revealNextHint();
    setMessage(text.adHintOpened);
  }

  function giveUp() {
    if (roundFinished) return;
    setStatus('gave-up');
    setInputAnswer('');
    setShowAd(false);
    setMessage(text.gaveUp(puzzle.answers[0]));
  }

  function submitAnswer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const normalizedAnswer = normalizeAnswer(inputAnswer);
    if (!normalizedAnswer || roundFinished) return;

    const correct = getAcceptedPuzzleAnswers(puzzle).some((answer) => normalizeAnswer(answer) === normalizedAnswer);

    if (!correct) {
      setMessage(text.wrong);
      return;
    }

    setSolvedIds((currentSolvedIds) => {
      if (currentSolvedIds.has(puzzle.id)) return currentSolvedIds;

      const nextSolvedIds = new Set(currentSolvedIds).add(puzzle.id);
      onReward();
      return nextSolvedIds;
    });
    setStatus('solved');
    setMessage(text.correct(puzzle.answers[0], rewardCoins));
  }

  return (
    <section className="puzzle-shell">
      <div className="game-card puzzle-card">
        <p className="hello">{text.player}: {userEmail}</p>
        <h2>Puzzle</h2>
        <p className="game-subtitle">{text.subtitle}</p>

        <div className="puzzle-difficulties" aria-label={text.difficultyLabel}>
          {PUZZLE_DIFFICULTIES.map((option) => (
            <button
              className={difficulty === option.id ? 'difficulty-button active' : 'difficulty-button'}
              key={option.id}
              onClick={() => setDifficulty(option.id)}
              type="button"
            >
              {text.difficulty[option.id]}
            </button>
          ))}
        </div>

        <div className="puzzle-question">
          <span>{text.question}</span>
          <strong>{puzzle.question}</strong>
        </div>

        {shownHints.map((hint, index) => (
          <p className="puzzle-hint" key={`${puzzle.id}-${index}`}>
            {text.hint(index + 1)}: {hint}
          </p>
        ))}

        <form className="guess-form" onSubmit={submitAnswer}>
          <input
            disabled={roundFinished}
            onChange={(e) => {
              setInputAnswer(e.target.value);
              setMessage('');
            }}
            placeholder={text.answerPlaceholder}
            value={inputAnswer}
          />
          <button disabled={roundFinished} type="submit">
            {text.check}
          </button>
        </form>

        <div className="puzzle-actions">
          <button
            className="soft-button"
            disabled={!hasMoreHints || roundFinished || coins < hintCost}
            onClick={buyHint}
            type="button"
          >
            {text.hintCoins(hintCost)}
          </button>
          <button
            className="ad-button"
            disabled={!hasMoreHints || roundFinished || showAd}
            onClick={openAdForHint}
            type="button"
          >
            {text.hintAd}
          </button>
          {!roundFinished && (
            <button className="danger-button" onClick={giveUp} type="button">
              {text.giveUp}
            </button>
          )}
          {roundFinished && (
            <button className="next-button" onClick={startNextPuzzle} type="button">
              {text.newPuzzle}
            </button>
          )}
        </div>

        {roundFinished && (
          <div className={status === 'solved' ? 'puzzle-answer-reveal solved' : 'puzzle-answer-reveal gave-up'}>
            <span>{status === 'solved' ? text.correctAnswer : text.answerWas}</span>
            <strong>{puzzle.answers[0]}</strong>
          </div>
        )}

        {message && <p className={status === 'solved' ? 'success-message' : 'message'}>{message}</p>}

        <p className="puzzle-progress">
          {text.progress(solvedIds.size, puzzles.length)}
        </p>
      </div>

      {showAd && <AdModal onClose={closeAdAndRevealHint} uiLanguage={uiLanguage} />}
    </section>
  );
}
