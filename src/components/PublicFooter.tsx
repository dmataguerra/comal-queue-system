import {useEffect,useState} from 'react';
import {useClock} from '../hooks/useClock';
import {Brand} from './Brand';
import {Icon} from './Icon';
export function PublicFooter({messages}:{messages:string[]}){
 const clock=useClock();const [slide,setSlide]=useState(0);
 useEffect(()=>{const id=setInterval(()=>setSlide(s=>(s+1)%(messages.length+1)),8000);return()=>clearInterval(id);},[messages.length]);
 return <footer className="public-footer"><Brand compact/><div className="footer-carousel" aria-live="off"><div className="footer-slide" key={slide}>{slide===0?<><span className="footer-date"><Icon name="calendar"/>{clock.date}</span><i className="footer-divider"/><span className="footer-time"><Icon name="clock"/><strong>{clock.time}</strong></span></>:<span className="footer-message">{messages[(slide-1)%messages.length]}</span>}</div></div></footer>;
}
