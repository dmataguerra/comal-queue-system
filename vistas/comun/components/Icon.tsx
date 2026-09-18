import type {CSSProperties} from 'react';
const paths:Record<string,string>={
 coffee:'M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm12 1h2a3 3 0 0 1 0 6h-2M7 2v2m4-2v2m4-2v2M2 23h18',
 receipt:'M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 5h6m-6 4h6',
 counter:'M3 10h18v11H3V10Zm-1 4h20M7 10V6h10v4M9 3h6',
 headphones:'M3 14v-2a9 9 0 0 1 18 0v2M3 13h4v8H3v-8Zm14 0h4v8h-4v-8Z',
 ticket:'M4 12h16l-1 9H5l-1-9Zm4-8h7v4a3.5 3.5 0 0 1-7 0V4Zm7 1h2a2 2 0 0 1 0 4h-2M9 1h4',
 play:'m9 5 11 7-11 7V5Z',
 media:'M3 4h18v16H3V4Zm6 4 7 4-7 4V8Z',settings:'m10 2-.6 3-2 1.1L4.5 5l-2 3.5L5 10v3l-2.5 1.5 2 3.5 2.9-1.1 2 1.1.6 3h4l.6-3 2-1.1 2.9 1.1 2-3.5L19 13v-3l2.5-1.5-2-3.5-2.9 1.1-2-1.1L14 2h-4Zm5 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
 calendar:'M4 5h16v16H4V5ZM8 2v6m8-6v6M4 10h16m-12 4h.01m4 0h.01m4 0h.01',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l4 2',
 chevron:'m6 9 6 6 6-6',link:'m10 13 4-4m-7 6-2 2a3 3 0 0 0 4 4l4-4a3 3 0 0 0 0-4m-2-2a3 3 0 0 1 0-4l4-4a3 3 0 0 1 4 4l-2 2',
 music:'M9 17V5l11-2v12M9 9l11-2M9 17c0 4-6 5-6 2s6-5 6-2Zm11-2c0 4-6 5-6 2s6-5 6-2Z',check:'m5 12 4 4L19 6',
 checkCircle:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-4 9 3 3 5-6',external:'M14 3h7v7m0-7L10 14m0-11H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
 volume:'m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',mute:'m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6',
 pause:'M8 5v14M16 5v14',stop:'M5 5h14v14H5V5Z',close:'m6 6 12 12M6 18 18 6',more:'M5 12h.01M12 12h.01M19 12h.01',
 monitor:'M2 3h20v14H2V3Zm6 18h8m-4-4v4',expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',refresh:'M3 10a9 9 0 1 1 1.5 7M3 4v6h6',
 info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10h.01',folder:'M3 5h6l2 3h10v13H3V5Z',undo:'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',arrow:'M5 12h14m-6-6 6 6-6 6',warning:'m12 3 10 18H2L12 3Zm0 6v5m0 3h.01'
};
export function Icon({name,className='',style}:{name:string;className?:string;style?:CSSProperties}){return <svg aria-hidden="true" className={`icon ${className}`} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]||paths.info}/></svg>;}
