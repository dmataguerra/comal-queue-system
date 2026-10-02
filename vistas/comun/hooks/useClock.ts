import { useEffect, useState } from 'react';
export function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return {
    time: now
      .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      .toLowerCase(),
    date: now.toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  };
}
