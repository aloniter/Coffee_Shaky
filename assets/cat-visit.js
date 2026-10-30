(() => {
  const trigger=document.getElementById('employeeBanner');
  const visit=document.getElementById('catVisit');
  const picture=document.getElementById('catPounce');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let timer=0,generation=0;
  const dismiss=()=>{generation++;clearTimeout(timer);visit.hidden=true;};
  trigger.addEventListener('click',async()=>{
    if(!visit.hidden){dismiss();return;}
    const request=++generation;
    // Never reveal a broken cutout if the optional asset is still downloading.
    try{await picture.decode();}catch{return;}
    if(request!==generation)return;
    visit.classList.toggle('is-gentle',motion.matches);
    visit.hidden=false;
    timer=setTimeout(dismiss,motion.matches?1700:2850);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')dismiss();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)dismiss();});
  document.addEventListener('coffee:select',dismiss);
  motion.addEventListener('change',dismiss);
})();
