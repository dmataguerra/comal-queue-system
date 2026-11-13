import { useCallback, useEffect, useState } from 'react';
import type { Diagnostics } from '../../shared/contract';
import { useQueue } from '../common/queue-context';
const date = (value: string | null) => (value ? new Date(value).toLocaleString() : 'No disponible');
const yesNo = (value: boolean) => (value ? 'Sí' : 'No');
export function DiagnosticsPanel() {
  const { diagnostico: diagnostics } = useQueue();
  const [data, setDatos] = useState<Diagnostics | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(() => {
    void diagnostics()
      .then((response) => {
        setDatos(response);
        setError('');
      })
      .catch(() => setError('No se pudieron actualizar los diagnósticos. Reintenta.'));
  }, [diagnostics]);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [refresh]);
  if (!data && !error)
    return <section className="panel diagnostics-panel">Cargando diagnósticos…</section>;
  if (!data)
    return (
      <section className="panel diagnostics-panel" role="alert">
        {error} <button onClick={refresh}>Reintentar</button>
      </section>
    );
  const rows: [string, string | number][] = [
    ['Aplicación', data.version],
    ['Electron', data.electron],
    ['Node', data.node],
    ['Sistema', `${data.plataforma} · ${data.arquitectura}`],
    ['Carpeta de datos', data.carpetaDatos],
    ['Configuración', data.rutaConfig],
    ['Estado', data.rutaEstado],
    ['Registro', data.rutaLog],
    ['Pantalla pública', data.pantalla],
    ['Ventana de operador activa', yesNo(data.operadorActivo)],
    ['Ventana pública activa', yesNo(data.publicaActiva)],
    ['Persistencia', data.persistencia],
    ['Último guardado correcto', date(data.ultimoGuardado)],
    ['Último error de guardado', data.ultimoErrorPersistencia ?? 'Ninguno'],
    ['Último error de aplicación', data.ultimoErrorAplicacion ?? 'Ninguno'],
    ['Audio', data.audio],
    ['YouTube', data.youtube],
    ['Videos válidos', data.videosValidos],
    ['Banners válidos', data.bannersValidos],
    ['Voces válidas', data.vocesValidas],
    [
      'Último anuncio',
      data.ultimoAnuncio
        ? `${String(data.ultimoAnuncio.n).padStart(2, '0')} · ${date(data.ultimoAnuncio.fecha)}`
        : 'Ninguno',
    ],
    ['Turnos en pantalla', data.longitudCola],
    [
      'Espacio libre',
      data.espacioLibre === null
        ? 'No disponible'
        : `${(data.espacioLibre / 1024 ** 3).toFixed(2)} GB`,
    ],
  ];
  return (
    <section className="panel diagnostics-panel">
      <div className="section-heading">
        <h2>Estado de la aplicación</h2>
        <button className="button secondary" onClick={refresh}>
          Actualizar
        </button>
      </div>
      {error && <p role="alert">{error} Se muestran los últimos datos disponibles.</p>}
      {data.accionPendiente && (
        <p role="alert">
          Hay una condición que requiere atención. Revisa los indicadores y la guía de recuperación.
        </p>
      )}
      <dl className="diagnostics-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
