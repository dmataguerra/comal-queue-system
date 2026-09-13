import {Icon} from './Icon';
export function CounterLabel({counter}:{counter:number}){return counter?<span className="counter-label"><Icon name="counter"/><span>Mostrador {counter}</span></span>:null;}
