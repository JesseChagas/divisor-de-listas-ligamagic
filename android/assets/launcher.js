(()=>{
  if(document.getElementById('lm-mobile-launcher'))return;
  function add(){
    if(document.getElementById('lm-mobile-launcher')||!document.querySelector('#main_preco,input[id^="qty_"],input[id^="txt_qty_"]'))return;
    const host=document.createElement('div');host.id='lm-mobile-launcher';const shadow=host.attachShadow({mode:'closed'});
    const style=document.createElement('style');style.textContent='a{position:fixed;bottom:18px;right:14px;z-index:2147483647;color:#fff;background:#214c40;border:1px solid #8ed0ac;border-radius:30px;padding:14px 18px;text-decoration:none;font:600 14px system-ui;box-shadow:0 4px 16px #0004}';
    const link=document.createElement('a');link.href='ligadivisor://open';link.textContent='◈ Dividir carrinho';shadow.append(style,link);document.documentElement.append(host);
  }
  let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(add,250);}).observe(document.documentElement,{childList:true,subtree:true});add();
})();
