import {useEffect,useRef,type ReactNode} from 'react';
import {Icon} from './Icon';
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog ref={ref} className="modal" onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="modal-heading"><h2>{title}</h2><button onClick={onClose} className="icon-button" aria-label="Cerrar"><Icon name="close"/></button></div>{children}</dialog>;
}
