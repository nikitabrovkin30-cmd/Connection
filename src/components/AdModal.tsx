import { useEffect, useState } from 'react';
import adPhoto from '../assets/ad-placeholder.svg';

type AdModalProps = {
  onClose: () => void;
  uiLanguage?: 'ru' | 'kk' | 'en';
};

const AD_TEXT = {
  ru: {
    label: 'Реклама',
    title: 'Заряд подсказки',
    wait: (seconds: number) => `Подсказка откроется через ${seconds} сек.`,
    ready: 'Готово. Закрой рекламу и забирай подсказку.',
  },
  kk: {
    label: 'Жарнама',
    title: 'Кеңес қуаты',
    wait: (seconds: number) => `Кеңес ${seconds} сек. кейін ашылады.`,
    ready: 'Дайын. Жарнаманы жауып, кеңесті ал.',
  },
  en: {
    label: 'Ad',
    title: 'Hint charge',
    wait: (seconds: number) => `Hint opens in ${seconds} sec.`,
    ready: 'Done. Close the ad and take the hint.',
  },
} as const;

export function AdModal({ onClose, uiLanguage = 'ru' }: AdModalProps) {
  const text = AD_TEXT[uiLanguage];
  const [secondsLeft, setSecondsLeft] = useState(15);
  const progress = ((15 - secondsLeft) / 15) * 100;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="ad-overlay" role="dialog" aria-modal="true" aria-label={text.label}>
      <div className="ad-card">
        <button
          className="ad-close"
          disabled={secondsLeft > 0}
          onClick={onClose}
          type="button"
        >
          {secondsLeft > 0 ? secondsLeft : 'x'}
        </button>
        <div className="ad-image">
          <div className="ad-copy">
            <span>Turbo Hint</span>
            <h2>{text.title}</h2>
            <p>
              {secondsLeft > 0
                ? text.wait(secondsLeft)
                : text.ready}
            </p>
            <div className="ad-progress" aria-hidden="true">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
          <img src={adPhoto} alt={text.label} />
        </div>
      </div>
    </div>
  );
}
