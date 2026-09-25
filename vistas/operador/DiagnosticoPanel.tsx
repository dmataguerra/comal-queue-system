import { useCallback, useEffect, useState } from 'react';
import type { Diagnostico } from '../../main/contrato';
import { useTurnero } from '../comun/turnero';

const fecha = (valor: string | null) =>
  valor ? new Date(valor).toLocaleString() : 'No disponible';
const siNo = (valor: boolean) => (valor ? 'Sí' : 'No');

export function DiagnosticoPanel() {
  const { diagnostico } = useTurnero();
  const [datos, setDatos] = useState<Diagnostico | null>(null);
  const [error, setError] = useState('');
  const actualizar = useCallback(() => {
    void diagnostico()
      .then((respuesta) => {
        setDatos(respuesta);
        setError('');
      })
      .catch(() => setError('No se pudieron actualizar los diagnósticos. Reintenta.'));
  }, [diagnostico]);
  useEffect(() => {
    actualizar();
    const id = setInterval(actualizar, 10_000);
    return () => clearInterval(id);
  }, [actualizar]);

  if (!datos && !error)
    return <section className="panel diagnostics-panel">Cargando diagnósticos…</section>;
  if (!datos)
    return (
      <section className="panel diagnostics-panel" role="alert">
        {error} <button onClick={actualizar}>Reintentar</button>
      </section>
    );
  const filas: [string, string | number][] = [
    ['Aplicación', datos.version],
    ['Electron', datos.electron],
    ['Node', datos.node],
    ['Sistema', `${datos.plataforma} · ${datos.arquitectura}`],
    ['Carpeta de datos', datos.carpetaDatos],
    ['Configuración', datos.rutaConfig],
    ['Estado', datos.rutaEstado],
    ['Registro', datos.rutaLog],
    ['Pantalla pública', datos.pantalla],
    ['Ventana de operador activa', siNo(datos.operadorActivo)],
    ['Ventana pública activa', siNo(datos.publicaActiva)],
    ['Persistencia', datos.persistencia],
    ['Último guardado correcto', fecha(datos.ultimoGuardado)],
    ['Último error de guardado', datos.ultimoErrorPersistencia ?? 'Ninguno'],
    ['Último error de aplicación', datos.ultimoErrorAplicacion ?? 'Ninguno'],
    ['Audio', datos.audio],
    ['YouTube', datos.youtube],
    ['Videos válidos', datos.videosValidos],
    ['Banners válidos', datos.bannersValidos],
    ['Voces válidas', datos.vocesValidas],
    [
      'Último anuncio',
      datos.ultimoAnuncio
        ? `${String(datos.ultimoAnuncio.n).padStart(2, '0')} · ${fecha(datos.ultimoAnuncio.fecha)}`
        : 'Ninguno',
    ],
    ['Turnos en pantalla', datos.longitudCola],
    [
      'Espacio libre',
      datos.espacioLibre === null
        ? 'No disponible'
        : `${(datos.espacioLibre / 1024 ** 3).toFixed(2)} GB`,
    ],
  ];
  return (
    <section className="panel diagnostics-panel">
      <div className="section-heading">
        <h2>Estado de la aplicación</h2>
        <button className="button secondary" onClick={actualizar}>
          Actualizar
        </button>
      </div>
      {error && <p role="alert">{error} Se muestran los últimos datos disponibles.</p>}
      {datos.accionPendiente && (
        <p role="alert">
          Hay una condición que requiere atención. Revisa los indicadores y la guía de recuperación.
        </p>
      )}
      <dl className="diagnostics-grid">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
