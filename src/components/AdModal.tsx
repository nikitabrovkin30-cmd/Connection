import { useEffect, useState } from 'react';
import adPhoto from '../assets/5301289502691236295.jpg';

type AdModalProps = {
  onClose: () => void;
};

export function AdModal({ onClose }: AdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(15);
  const progress = ((15 - secondsLeft) / 15) * 100;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="ad-overlay" role="dialog" aria-modal="true" aria-label="Реклама">
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
            <h2>Заряд подсказки</h2>
            <p>
              {secondsLeft > 0
                ? `Подсказка откроется через ${secondsLeft} сек.`
                : 'Готово. Закрой рекламу и забирай подсказку.'}
            </p>
            <div className="ad-progress" aria-hidden="true">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
          <img src={adPhoto} alt="Реклама" />
        </div>
      </div>
    </div>
  );
}
