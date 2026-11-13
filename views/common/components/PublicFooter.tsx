import type { CSSProperties } from 'react';
import { useClock } from '../hooks/useClock';
import { useWeather } from '../hooks/useWeather';
import { Icon } from './Icon';
export function PublicFooter({ messages }: { messages: string[] }) {
  const clock = useClock();
  const weather = useWeather();
  const visible = messages.filter(
    (message) => !/^el caf[eé] tambi[eé]n nos une\.?$/i.test(message.trim()),
  );
  const tickerMessages = visible.length ? visible : ['Presenta tu ticket al recoger tu pedido'];
  const duration = Math.max(28, Math.min(72, tickerMessages.join(' ').length * 0.32 + 24));
  const sequence = (hidden = false) => (
    <div className="footer-ticker-sequence" aria-hidden={hidden || undefined}>
      <span className="footer-brand">
        <span className="footer-logo-plate comal">
          <img src="/assets/LOGO comal azul.png" alt="Comal · Facultad de Informática UAQ" />
        </span>
      </span>
      <span className="footer-brand">
        <span className="footer-logo-plate uaq">
          <img
            src="/assets/uaq-informatica-logo.png"
            alt="Universidad Autónoma de Querétaro · Facultad de Informática"
          />
        </span>
      </span>
      <span className="footer-ticker-item">
        <Icon name="calendar" />
        {clock.date}
      </span>
      <span className="footer-ticker-item footer-time">
        <Icon name="clock" />
        <strong>{clock.time}</strong>
      </span>
      {weather && (
        <span className="footer-ticker-item">
          <Icon name={weather.sunny ? 'sun' : 'cloud'} />
          <strong>{weather.temperature}°C</strong>
          {weather.description} en Querétaro
        </span>
      )}
      {tickerMessages.map((message, index) => (
        <span className="footer-ticker-item" key={`${index}-${message}`}>
          <Icon name={index % 2 === 0 ? 'receipt' : 'coffee'} />
          {message}
        </span>
      ))}
    </div>
  );
  return (
    <footer className="public-footer" aria-label="Información de la pantalla">
      <div className="footer-ticker" aria-live="off">
        <div
          className="footer-ticker-track"
          style={{ '--ticker-duration': `${duration}s` } as CSSProperties}
        >
          {sequence()}
          {sequence(true)}
        </div>
      </div>
    </footer>
  );
}
