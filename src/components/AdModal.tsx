import { useEffect, useState } from 'react';
import adPhoto from '../assets/5301289502691236295.jpg';

type AdModalProps = {
  onClose: () => void;
};

export function AdModal({ onClose }: AdModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(15);

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
          <img src={adPhoto} alt="Реклама" />
          <p>
            {secondsLeft > 0
              ? `Рекламу можно закрыть через ${secondsLeft} сек.`
              : 'Нажми крестик, чтобы получить подсказку.'}
          </p>
        </div>
      </div>
    </div>
  );
}
