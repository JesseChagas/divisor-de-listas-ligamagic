(() => {
  'use strict';
  let host,observer,timer;
  const documentSession=Date.now()+'-'+Math.random();
  const alive=()=>{try{return !!chrome.runtime?.id;}catch{return false;}};
  function stop(){clearTimeout(timer);observer?.disconnect();}
  function mount(){
    if(!alive()){stop();return;}
    if(host?.isConnected || !document.querySelector('#main_preco,input[id^="qty_"],input[id^="txt_qty_"]'))return;
    document.getElementById('lm-divisor-launcher')?.remove();
    host=document.createElement('div');host.id='lm-divisor-launcher';
    const shadow=host.attachShadow({mode:'closed'}), style=document.createElement('style');
    style.textContent='button{position:fixed;right:24px;bottom:24px;z-index:2147483647;background:#163d37;color:#fff;border:1px solid #65bda8;border-radius:999px;padding:15px 21px;font:600 14px system-ui;box-shadow:0 5px 24px #0003;cursor:pointer}button:focus-visible{outline:3px solid #e7a450;outline-offset:3px}';
    const button=document.createElement('button');button.textContent='◈ Dividir carrinho';
    let reloadRequired=false;
    button.addEventListener('click',async()=>{
      if(reloadRequired){location.reload();return;}
      try{
        if(!alive())throw Error('Extension context invalidated');
        // sendMessage can throw synchronously after an extension update, before returning a Promise.
        const response=await chrome.runtime.sendMessage({type:'OPEN'});
        if(!response?.ok)throw Error(response?.error||'A extensão não respondeu. Recarregue a página.');
      }catch(error){
        const reason=String(error?.message||error);
        reloadRequired=!alive()||/context invalidated|receiving end does not exist|extension.*reload/i.test(reason);
        if(reloadRequired){stop();button.textContent='Extensão atualizada · Recarregar página';}
        else button.textContent='Não foi possível abrir · Tentar novamente';
        button.title=reason;button.setAttribute('aria-label',button.textContent+'. '+reason);
      }
    });
    shadow.append(style,button);document.documentElement.append(host);
  }
  observer=new MutationObserver(()=>{if(!alive()){stop();return;}clearTimeout(timer);timer=setTimeout(mount,300);});observer.observe(document.documentElement,{childList:true,subtree:true});mount();
  try{chrome.runtime.onMessage.addListener((message,sender,reply)=>{if(!alive()){stop();return;}if(sender.id!==chrome.runtime.id)return;if(message.type==='READ')reply({...LMRead(),documentSession});});}catch{stop();}
})();
