import type {CSSProperties} from 'react';
import {useClock} from '../hooks/useClock';
import {Icon} from './Icon';
export function PublicFooter({messages}:{messages:string[]}){
 const clock=useClock();
 const tickerMessages=messages.length?messages:['Presenta tu ticket al recoger tu pedido'];
 const duration=Math.max(28,Math.min(72,tickerMessages.join(' ').length*.32+24));
 const sequence=(hidden=false)=><div className="footer-ticker-sequence" aria-hidden={hidden||undefined}>
  <span className="footer-brand"><span className="footer-brand-mark">C<sup>++</sup></span><span>COMAL++</span></span>
  <span className="footer-ticker-item"><Icon name="calendar"/>{clock.date}</span>
  <span className="footer-ticker-item footer-time"><Icon name="clock"/><strong>{clock.time}</strong></span>
  {tickerMessages.map((message,index)=><span className="footer-ticker-item" key={`${index}-${message}`}><Icon name={index%2===0?'receipt':'coffee'}/>{message}</span>)}
 </div>;
 return <footer className="public-footer" aria-label="Información de la pantalla">
  <div className="footer-ticker" aria-live="off">
   <div className="footer-ticker-track" style={{'--ticker-duration':`${duration}s`} as CSSProperties}>{sequence()}{sequence(true)}</div>
  </div>
 </footer>;
}
