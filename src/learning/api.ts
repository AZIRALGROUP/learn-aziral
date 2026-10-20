export async function learningApi<T>(path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<T> {
  const timeout=AbortSignal.timeout(30000);
  const response=await fetch(`${import.meta.env.VITE_API_BASE_URL||''}/api/learning${path}`,{method,credentials:'include',signal:signal?AbortSignal.any([signal,timeout]):timeout,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(data.error||'Не удалось загрузить общий прогресс'),{status:response.status});
  return data as T;
}
