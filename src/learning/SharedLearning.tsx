import { useEffect,useRef,useState } from 'react';
import { useNavigate,useParams } from 'react-router-dom';
import { learningApi as api } from './api';
import { useAuth } from '../app/contexts/AuthContext';
import { LearningHome } from '../telegram/LearningHome';
import { PracticeSession } from '../telegram/PracticeSession';
import { AttemptResult } from './AttemptResult';
import type { Attempt,Course,Learning,Me } from '../telegram/api';
import '../telegram/telegram.css';

export function SharedLearningPanel({onXp,siteOrigin=''}:{onXp:(value:number)=>void;siteOrigin?:string}) {
  const {user}=useAuth();const navigate=useNavigate();const [learning,setLearning]=useState<Learning|null>(null);const [error,setError]=useState('');
  const refresh=useRef<()=>void>(()=>{});
  useEffect(()=>{
    const c=new AbortController();let running=false;
    const load=async()=>{if(running||document.visibilityState==='hidden')return;running=true;try{const data=await api<Learning>('/summary','GET',undefined,c.signal);if(!c.signal.aborted){setLearning(data);onXp(data.stats.xp||0);setError('');}}catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'Не удалось загрузить прогресс');}finally{running=false;}};
    refresh.current=()=>void load();void load();const timer=setInterval(()=>void load(),15000);window.addEventListener('focus',refresh.current);document.addEventListener('visibilitychange',refresh.current);
    return()=>{c.abort();clearInterval(timer);window.removeEventListener('focus',refresh.current);document.removeEventListener('visibilitychange',refresh.current);};
  },[onXp]);
  if(!user)return null;
  const me:Me={user:{id:String(user.id),name:user.name},dev:false,botUsername:'Learn_Aziral_bot',aiAvailable:false};
  const open=(path:string)=>{if(siteOrigin)window.location.assign(siteOrigin+path);else navigate(path);};
  return <div className="tg-app tg-site-learning"><p className="tg-notice">Общая история сайта и Telegram. Данные обновляются автоматически.</p><LearningHome me={me} learning={learning} error={error} busy={false} heading={false} onRetry={()=>refresh.current()} onOpen={id=>open('/practice/'+id)} onOpenCourse={id=>open(id.startsWith('site-')?'/courses/'+id.slice(5)+'/learn':'/practice/course/'+id)} onBrowse={()=>open('/study')} onRefreshAccount={()=>{}} onConnectAccount={()=>{}}/></div>;
}

export function SharedTrainingPage({testKey}:{testKey?:string}) {
  const {attemptId}=useParams();const navigate=useNavigate();const [attempt,setAttempt]=useState<Attempt|null>(null);const [preview,setPreview]=useState<{title:string;count:number}|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const exit=useRef<(()=>void)|null>(null);
  useEffect(()=>{
    const c=new AbortController();setAttempt(null);setError('');setPreview(null);
    if(attemptId)void api<Attempt>('/attempts/'+attemptId,'GET',undefined,c.signal).then(a=>{if(!c.signal.aborted)setAttempt(a);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});
    else if(testKey)void api<{title:string;count:number}>('/tests/'+testKey,'GET',undefined,c.signal).then(p=>{if(!c.signal.aborted)setPreview(p);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});
    return()=>c.abort();
  },[attemptId,testKey]);
  async function action(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить');}finally{setBusy(false);}}
  const back=()=>navigate('/profile?tab=progress');
  return <div className="tg-app tg-site-practice"><main className="tg-main">{error&&<p className="tg-error" role="alert">{error}</p>}{attempt?.result?<AttemptResult result={attempt.result} busy={busy} onBack={back} onRetry={mode=>void action(async()=>{const a=await api<Attempt>('/attempts/'+attempt.id+'/retry','POST',{mode});navigate('/practice/'+a.id);})}/>:attempt?<PracticeSession key={attempt.id+':'+attempt.revision} attempt={attempt} exitRef={exit} transport={api} onLeave={back} onResult={result=>setAttempt({...attempt,result})} onReload={async()=>setAttempt(await api<Attempt>('/attempts/'+attempt.id))}/>:preview?<><h1>{preview.title}</h1><p>{preview.count} вопросов · ответы сохраняются автоматически.</p><p className="tg-muted">Можно продолжить на сайте или в Telegram с того же места.</p><button className="tg-primary" disabled={busy} onClick={()=>void action(async()=>{const a=await api<Attempt>('/tests/'+testKey+'/attempts','POST');navigate('/practice/'+a.id);})}>{busy?'Открываем…':'Открыть тренировку'}</button></>:!error&&<p role="status">Загружаем тренировку…</p>}{!attempt&&<button className="tg-back" onClick={back}>К прогрессу</button>}</main></div>;
}

export function SharedCoursePage() {
  const {courseKey}=useParams();const navigate=useNavigate();const [course,setCourse]=useState<Course|null>(null);const [lesson,setLesson]=useState(0);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{const c=new AbortController();void api<Course>('/courses/'+courseKey,'GET',undefined,c.signal).then(v=>{if(!c.signal.aborted){setCourse(v);setLesson(Math.max(0,v.lessons.findIndex((_,i)=>!v.completed.includes(i))));}}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[courseKey]);
  return <div className="tg-app tg-site-practice"><main className="tg-main"><button className="tg-back" onClick={()=>navigate('/profile?tab=progress')}>К прогрессу</button>{error&&<p className="tg-error" role="alert">{error}</p>}{course?<><h1>{course.title}</h1><p>{course.completed.length}/{course.lessons.length} уроков пройдено</p><label className="tg-field">Урок<select value={lesson} onChange={e=>setLesson(Number(e.target.value))}>{course.lessons.map((l,i)=><option key={i} value={i}>{course.completed.includes(i)?'✓ ':''}{i+1}. {l.title}</option>)}</select></label><article className="tg-card tg-lesson"><h2>{course.lessons[lesson].title}</h2><p>{course.lessons[lesson].content}</p></article><button className="tg-primary" disabled={busy||course.completed.includes(lesson)} onClick={()=>{setBusy(true);void api('/courses/'+courseKey+'/complete','POST',{lesson}).then(()=>setCourse({...course,completed:[...course.completed,lesson]})).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>{course.completed.includes(lesson)?'Урок пройден':'Отметить пройденным'}</button></>:!error&&<p role="status">Загружаем курс…</p>}</main></div>;
}
