(() => {
  const sheet=document.getElementById('orderForm');
  const shell=document.querySelector('.shell');
  const dock=document.querySelector('.app-dock');
  const backdrop=document.getElementById('orderBackdrop');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let lastCard=null;

  document.addEventListener('coffee:select',event=>{
    lastCard=event.detail.card;
    document.getElementById('sheetDescription').textContent=lastCard.querySelector('.product-note').textContent;
    shell.inert=true;dock.inert=true;document.body.style.overflow='hidden';
  });
  document.addEventListener('coffee:close',()=>{
    shell.inert=false;dock.inert=false;document.body.style.overflow='';
    lastCard?.focus({preventScroll:true});
  });
  backdrop.addEventListener('click',()=>resetOrderForm());
  document.getElementById('changeDrink').addEventListener('click',()=>{
    const note=document.getElementById('specialRequest').value;
    cancelOrder();
    document.getElementById('specialRequest').value=note;
  });
  document.addEventListener('keydown',event=>{
    if(!sheet.classList.contains('is-up'))return;
    if(event.key==='Escape'){event.preventDefault();resetOrderForm();return;}
    if(event.key!=='Tab')return;
    const items=[...sheet.querySelectorAll('button:not(:disabled),input,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });

  // Tilt is pointer-driven only; mobile uses the inexpensive press state.
  if(matchMedia('(hover: hover) and (pointer: fine)').matches){
    document.querySelectorAll('.drink').forEach(card=>{
      let frame=0;
      card.addEventListener('pointermove',event=>{
        if(reduced.matches||frame)return;
        frame=requestAnimationFrame(()=>{
          const box=card.getBoundingClientRect();
          card.style.setProperty('--tilt-y',`${((event.clientX-box.x)/box.width-.5)*7}deg`);
          card.style.setProperty('--tilt-x',`${-((event.clientY-box.y)/box.height-.5)*7}deg`);frame=0;
        });
      });
      card.addEventListener('pointerleave',()=>{cancelAnimationFrame(frame);frame=0;card.style.removeProperty('--tilt-x');card.style.removeProperty('--tilt-y');});
    });
  }
})();
