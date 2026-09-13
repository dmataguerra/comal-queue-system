import type { Counter, Multimedia, Settings, Turn } from '../types';
export async function request<T>(path:string, method='GET', body?:unknown):Promise<T> {
  const response=await fetch(`/api${path}`,{method,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(typeof data?.message==='string'?data.message:'No se pudo guardar el cambio. Revisa la conexión local.');
  return data as T;
}
export const newRequestId=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const api={
 createTurn:(number:string,counter:Counter,requestId:string)=>request<Turn>('/turns','POST',{number,counter,requestId}),
 announce:(id:string,requestId:string)=>request<Turn>(`/turns/${encodeURIComponent(id)}/announce`,'POST',{requestId}),
 updateTurn:(id:string,update:{counter?:Counter;status?:'delivered'|'cancelled'})=>request<Turn>(`/turns/${encodeURIComponent(id)}`,'PATCH',update),
 multimedia:(update:Partial<Multimedia>)=>request<Multimedia>('/multimedia','PUT',update),
 settings:(update:Partial<Settings>)=>request<Settings>('/settings','PUT',update),
 refreshCatalog:()=>request('/playlists/refresh','POST',{})
};
