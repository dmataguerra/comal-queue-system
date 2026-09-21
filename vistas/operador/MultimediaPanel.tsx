import {useState} from 'react';
import './multimedia.css';
import type {CategoriaContenido} from '../../main/contrato';
import {Icon} from '../comun/components/Icon';
import {useTurnero} from '../comun/turnero';

const nombreArchivo=(url:string)=>decodeURIComponent(url.split('/').pop()??url);

interface BibliotecaProps {
 categoria:CategoriaContenido;
 titulo:string;
 descripcion:string;
 archivos:string[];
 ocupado:boolean;
 agregar:(categoria:CategoriaContenido)=>void;
 abrir:(categoria:CategoriaContenido)=>void;
 quitar:(url:string)=>void;
}

function Biblioteca({categoria,titulo,descripcion,archivos,ocupado,agregar,abrir,quitar}:BibliotecaProps){
 const esVideo=categoria==='videos';
 return <section className="panel media-library-panel">
  <div className="media-library-heading">
   <span className="section-icon"><Icon name={esVideo?'media':'image'}/></span>
   <div><h2>{titulo}</h2><p>{descripcion}</p></div>
   <span className="media-count">{archivos.length} {archivos.length===1?'archivo':'archivos'}</span>
  </div>
  <div className="media-actions">
   <button className="button primary" disabled={ocupado} onClick={()=>agregar(categoria)}><Icon name="plus"/>Agregar {esVideo?'videos':'imágenes'}</button>
   <button className="button secondary" disabled={ocupado} onClick={()=>abrir(categoria)}><Icon name="folder"/>Abrir carpeta</button>
  </div>
  {archivos.length?<div className="media-file-grid">
   {archivos.map(url=><article className="media-file" key={url}>
    <div className="media-preview">{esVideo?<video src={url} muted preload="metadata"/>:<img src={url} alt=""/>}<span><Icon name={esVideo?'play':'image'}/></span></div>
    <div className="media-file-info"><strong title={nombreArchivo(url)}>{nombreArchivo(url)}</strong><small>{esVideo?'Video de la rotación':'Imagen del carrusel'}</small></div>
    <button className="icon-button media-remove" disabled={ocupado} onClick={()=>quitar(url)} aria-label={`Quitar ${nombreArchivo(url)}`} title={`Quitar ${nombreArchivo(url)}`}><Icon name="trash"/></button>
   </article>)}
  </div>:<div className="media-empty"><Icon name={esVideo?'media':'image'}/><div><strong>{esVideo?'No hay videos cargados':'No hay imágenes cargadas'}</strong><p>{esVideo?'La pantalla 2 mostrará el carrusel de imágenes.':'Si tampoco hay videos, se mostrarán los logotipos de bienvenida.'}</p></div></div>}
 </section>;
}

export function MultimediaPanel({notificar}:{notificar:(mensaje:string,error?:boolean)=>void}){
 const {inventario,importarContenido,quitarContenido,abrirCarpetaContenido}=useTurnero();
 const [ocupado,setOcupado]=useState(false);

 async function agregar(categoria:CategoriaContenido){
  setOcupado(true);
  try{
   const resultado=await importarContenido(categoria);
   if(resultado.cancelado)return;
   if(resultado.agregados.length){
    const cantidad=resultado.agregados.length;
    notificar(`${cantidad} ${cantidad===1?'archivo agregado':'archivos agregados'} a la pantalla 2.${resultado.omitidos.length?` ${resultado.omitidos.length} no compatible(s) se omitieron.`:''}`);
   }else notificar('No se agregó ningún archivo compatible.',true);
  }catch(error){notificar((error as Error).message,true);}
  finally{setOcupado(false);}
 }

 async function abrir(categoria:CategoriaContenido){
  try{await abrirCarpetaContenido(categoria);}
  catch(error){notificar((error as Error).message,true);}
 }

 async function quitar(url:string){
  const nombre=nombreArchivo(url);
  if(!window.confirm(`¿Quitar “${nombre}” de la pantalla 2? El archivo se eliminará de la carpeta de contenido.`))return;
  setOcupado(true);
  try{
   const eliminado=await quitarContenido(url);
   notificar(eliminado?`${nombre} se quitó de la pantalla 2.`:'El archivo ya no estaba disponible.',!eliminado);
  }catch(error){notificar((error as Error).message,true);}
  finally{setOcupado(false);}
 }

 return <div className="multimedia-workspace">
  <section className="panel media-overview">
   <div><span className="eyebrow">PANTALLA 2</span><h2>Contenido que acompaña la espera</h2><p>Los cambios se reflejan automáticamente, sin cerrar ni reiniciar la aplicación.</p></div>
   <div className="media-flow"><span className={inventario.videos.length?'active':''}><Icon name="media"/>{inventario.videos.length} videos</span><Icon name="arrow"/><span className={!inventario.videos.length&&inventario.banner.length?'active':''}><Icon name="image"/>{inventario.banner.length} imágenes</span></div>
  </section>
  <div className="media-library-layout">
   <Biblioteca categoria="videos" titulo="Videos" descripcion="Se reproducen en orden aleatorio y de forma continua." archivos={inventario.videos} ocupado={ocupado} agregar={agregar} abrir={abrir} quitar={quitar}/>
   <Biblioteca categoria="banner" titulo="Imágenes" descripcion="Aparecen como carrusel cuando no hay videos disponibles." archivos={inventario.banner} ocupado={ocupado} agregar={agregar} abrir={abrir} quitar={quitar}/>
  </div>
  <div className="media-note"><Icon name="info"/><p>Formatos admitidos: MP4 y WebM para video; JPG, PNG y WebP para imágenes. Al agregar un archivo con el mismo nombre, se conserva el anterior y se crea una copia numerada.</p></div>
 </div>;
}
