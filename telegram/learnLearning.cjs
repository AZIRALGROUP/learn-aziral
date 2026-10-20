const createStore=require('./learnLearningStore.cjs');
module.exports=function createLearningRoutes({db,jwtAuth,clock}) {
  const store=createStore({db,clock});
  function send(res,fn) {
    res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
    try {res.end(JSON.stringify(fn()));} catch(e){res.statusCode=e.status||500;res.end(JSON.stringify({error:e.status?e.message:'Не удалось загрузить общий прогресс'}));}
  }
  function authenticated(req,res,fn) {
    return jwtAuth(req,res,()=>send(res,()=>{
      if(req.method!=='GET') {
        const origin=req.headers.origin;
        const allowed=['https://learn.aziral.com','https://aziral.com','https://www.aziral.com'];
        const local=process.env.NODE_ENV!=='production'&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin||'');
        if(!allowed.includes(origin)&&!local&&!(req.headers.authorization?.startsWith('Bearer ')&&!origin)) {const e=new Error('Запрос должен прийти с сайта Aziral');e.status=403;throw e;}
      }
      return fn();
    }));
  }
  const middleware=(req,res)=>authenticated(req,res,()=>store.handle(req.user.id,req.method,new URL(req.url,'http://localhost').pathname,req.body||{},false));
  middleware.completeLesson=(req,res)=>authenticated(req,res,()=>store.completeLesson(req.user.id,Number(req.params.id)));
  middleware.submitQuiz=(req,res)=>authenticated(req,res,()=>store.legacyQuiz(req.user.id,Number(req.params.id),req.body||{}));
  return middleware;
};
