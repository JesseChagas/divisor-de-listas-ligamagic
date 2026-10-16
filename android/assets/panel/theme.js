(() => {
  'use strict';
  const media=matchMedia('(prefers-color-scheme: dark)');
  let preference=null;
  function apply(){
    const dark=preference?preference==='dark':media.matches;
    document.documentElement.dataset.theme=dark?'dark':'light';
    const button=document.getElementById('theme');
    if(button){button.textContent=dark?'☀':'☾';button.title=dark?'Ativar tema claro':'Ativar tema escuro';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(dark));}
  }
  apply();
  chrome.storage.local.get('theme').then(({theme})=>{preference=['light','dark'].includes(theme)?theme:null;apply();}).catch(()=>{});
  media.addEventListener('change',apply);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.theme){preference=['light','dark'].includes(changes.theme.newValue)?changes.theme.newValue:null;apply();}});
  document.addEventListener('DOMContentLoaded',()=>{
    apply();document.getElementById('theme').addEventListener('click',async()=>{
      const previous=preference;
      preference=document.documentElement.dataset.theme==='dark'?'light':'dark';apply();
      try{await chrome.storage.local.set({theme:preference});}catch{preference=previous;apply();}
    });
  });
})();
