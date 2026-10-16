(()=>{
importScripts('core.js','cart-transfer.js');
const initial=()=>({version:1,revision:0,participants:[],shipping:'equal',history:[]});
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});
const supported=url=>{try{const u=new URL(url);return u.protocol==='https:'&&/(^|\.)ligamagic\.com(?:\.br)?$/.test(u.hostname);}catch{return false;}};
const state=async()=> (await chrome.storage.local.get('state')).state||initial();
const save=async s=>chrome.storage.local.set({state:s});
async function read(tabId){const tab=await chrome.tabs.get(tabId);if(!supported(tab.url))throw Error('Abra uma aba do carrinho da LigaMagic.');return chrome.tabs.sendMessage(tabId,{type:'READ'}).catch(()=>{throw Error('Recarregue a aba da LigaMagic após instalar a extensão.');});}
function validateState(s){
  if(!s||!Array.isArray(s.participants)||s.participants.length>100)throw Error('Arquivo de listas inválido (máximo 100 participantes).');
  const ids=new Set();
  const participants=s.participants.map((p,index)=>{
    if(typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||typeof p.text!=='string'||p.text.length>200000)throw Error('Participante inválido ou duplicado.');
    ids.add(p.id);return {id:p.id,name:p.name.trim(),text:p.text,active:p.active!==false,position:Number.isSafeInteger(p.position)&&p.position>=0?p.position:index};
  });
  if(!['equal','value','quantity'].includes(s.shipping))throw Error('Método de frete inválido.');
  return {participants,shipping:s.shipping};
}
// Executed only through a trusted extension message, never through page postMessage.
async function mutateOne(op){
  const inputs=[...document.querySelectorAll(`input[id="qty_${op.id}"],input[id="txt_qty_${op.id}"],input[name="qty_${op.id}"],input[name="txt_qty_${op.id}"]`)];
  if(!/^\d+$/.test(op.id)||!inputs.length||inputs.some(x=>Number(x.value)!==op.before))throw Error('Quantidade mudou antes da execução.');
  const input=inputs[0];let row=input.parentElement;
  while(row&&row!==document.body&&!row.querySelector('[cardtitle],.cardtitle'))row=row.parentElement;
  if(!row||row===document.body||![...row.querySelectorAll('[onclick]')].some(el=>new RegExp('^\\s*mpDel\\(\\s*'+op.id+'\\s*\\)\\s*;?\\s*$').test(el.getAttribute('onclick'))))throw Error('Remoção individual não validada.');
  if(op.after===0){
    if(typeof window.mpDel!=='function')throw Error('mpDel indisponível.');
    const original=window.confirm;
    let accepted=false;
    const once=function(message){
      const text=String(message).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
      if(!accepted && /^voce tem certeza que deseja remover (?:este|esse) item (?:de seu|do seu|do) carrinho\?$/i.test(text)) {accepted=true;return true;}
      return original.call(window,message);
    };
    // Only this synchronous, individually authorized mpDel call may accept its own prompt.
    try {window.confirm=once;window.mpDel(Number(op.id));}
    finally {if(window.confirm===once)window.confirm=original;}
  } else {
    if(!Number.isSafeInteger(op.after)||op.after<1||op.after>=op.before||typeof window.mpValidaQty!=='function'||!new RegExp('^\\s*mpValidaQty\\(\\s*this\\s*,\\s*'+op.id+'\\s*\\)\\s*;?\\s*$').test(input.getAttribute('onblur')||''))throw Error('Redução de quantidade não suportada nesta página.');
    input.value=String(op.after);window.mpValidaQty(input,Number(op.id));
  }
  return {started:true};
}
const rowSignature=r=>JSON.stringify([r.id,r.name,r.aliases,r.qty,r.total,r.lang,r.edition,r.quality,r.mutable]);
async function observeOperation(tabId,before,op){
  const others=c=>JSON.stringify(c.rows.filter(r=>r.id!==op.id).map(rowSignature).sort());
  let stableSince=0,last='';
  for(let attempt=0;attempt<100;attempt++){
    await new Promise(resolve=>setTimeout(resolve,250));
    let after;
    try{after=await read(tabId);}catch{stableSince=0;continue;} // A page reload destroys the old content script.
    const changed=after.rows.find(r=>r.id===op.id);
    const empty=op.after===0 && before.rows.length===1 && after.rows.length===0 && after.totals.items===0 && after.totals.cards===0;
    const errors=after.errors.filter(e=>!(empty && e.startsWith('Nenhum input real')));
    const expected=op.after===0?!changed:changed&&changed.qty===op.after&&changed.total!==null&&(changed.total<op.total||op.total===0&&changed.total===0)&&changed.name===before.rows.find(r=>r.id===op.id).name;
    if(errors.length||others(after)!==others(before)||!expected){stableSince=0;continue;}
    const key=LM.fingerprint(after);
    if(key!==last){last=key;stableSince=Date.now();}
    else if(stableSince && Date.now()-stableSince>=1000)return after;
  }
  throw Error('A página não confirmou o resultado esperado em 25 segundos. Recarregue e confira antes de tentar novamente.');
}

let busy=false;
async function handle(m,sender){
  if(m.type==='OPEN'&&sender.tab&&supported(sender.tab.url)){
    try{await chrome.sidePanel.open({tabId:sender.tab.id});}catch{await chrome.tabs.create({url:chrome.runtime.getURL('panel.html')+'?tab='+sender.tab.id});}return {};
  }
  if(sender.id!==chrome.runtime.id || sender.url?.split('?')[0]!==chrome.runtime.getURL('panel.html'))throw Error('Origem não autorizada.');
  if(m.type==='STATE')return {state:await state(),journal:(await chrome.storage.local.get('journal')).journal};
  if(m.type==='READ')return {cart:await read(m.tabId)};
  if(busy)throw Error('Há uma operação em andamento. Aguarde.');
  busy=true;
  try{
    const s=await state();
    if(m.type==='CART_EXPORT'||m.type==='CART_IMPORT'){
      const pending=(await chrome.storage.local.get('journal')).journal;
      if(pending&&pending.status!=='completed')throw Error('Confira a remoção pendente antes de transferir o carrinho.');
      const tab=await chrome.tabs.get(m.tabId),domain=LMCartTransfer.fromURL(tab.url);
      let storeId;
      if(chrome.cookies){const stores=await chrome.cookies.getAllCookieStores();storeId=stores.find(s=>s.tabIds.includes(m.tabId))?.id;if(!storeId)throw Error('Não foi possível identificar o perfil do carrinho.');}
      if(m.type==='CART_EXPORT'){
        const value=await LMCartTransfer.read(domain,storeId);
        if(!value)throw Error('Nenhum cookie de carrinho marketplace encontrado. Abra ou atualize o carrinho no site; cookies de login não serão exportados.');
        return {file:LMCartTransfer.pack(domain,value)};
      }
      const file=LMCartTransfer.parse(m.file);
      if(file.domain!==domain)throw Error('Abra https://www.'+file.domain+'/ no destino antes de importar este arquivo.');
      if(m.confirmed!==true)throw Error('Confirme a substituição do carrinho.');
      await chrome.storage.session.remove('removal');
      await LMCartTransfer.write(domain,file.cookie.value,storeId);
      let reloaded=true;try{await chrome.tabs.reload(m.tabId);}catch{reloaded=false;}
      return {reloaded};
    }

    if(m.type==='SAVE'){
      if(m.revision!==s.revision)throw Error('As listas foram alteradas em outro painel. Reabra antes de salvar.');
      const valid=validateState(m.state);await save({...s,...valid,revision:s.revision+1});return {state:await state()};
    }
    if(m.type==='HISTORY'){
      const cart=await read(m.tabId), result=LM.calculate(cart,s.participants,s.shipping);
      s.history.unshift({id:crypto.randomUUID(),date:new Date().toISOString(),cart,result,participants:s.participants,shipping:s.shipping});s.history=s.history.slice(0,50);s.revision++;await save(s);return {state:s};
    }
    if(m.type==='ACK'){
      await chrome.storage.session.remove('removal');
      await chrome.storage.local.remove('journal');return {};
    }
    if(m.type==='PREPARE_RESUME'){
      const journal=(await chrome.storage.local.get('journal')).journal;
      if(!journal||journal.status==='completed')throw Error('Não há uma remoção pendente.');
      const before=await read(m.tabId);
      await chrome.tabs.reload(m.tabId);
      let cart;
      for(let i=0;i<100;i++){
        await new Promise(r=>setTimeout(r,250));
        try{const tab=await chrome.tabs.get(m.tabId),fresh=await read(m.tabId);if(tab.status==='complete'&&fresh.documentSession&&fresh.documentSession!==before.documentSession){cart=fresh;break;}}catch{}
      }
      if(!cart)throw Error('O carrinho não terminou de recarregar. Tente revisar novamente.');
      const plan=LM.resumePlan(cart,s.participants,journal),token=crypto.randomUUID();
      await chrome.storage.session.set({removal:{token,plan,tabId:m.tabId,revision:s.revision,expires:Date.now()+120000}});return {token,plan,cart};
    }
    if(m.type==='PREPARE'){
      const journal=(await chrome.storage.local.get('journal')).journal;
      if(journal && journal.status!=='completed')throw Error('Existe uma remoção pendente. Use “Recarregar e revisar pendência”, no topo do painel, para continuar sem repetir itens.');
      const cart=await read(m.tabId), plan=LM.removalPlan(cart,s.participants,m.personId);
      const token=crypto.randomUUID();await chrome.storage.session.set({removal:{token,plan,tabId:m.tabId,revision:s.revision,expires:Date.now()+120000}});return {token,plan};
    }
    if(m.type==='EXECUTE'){
      const saved=(await chrome.storage.session.get('removal')).removal;
      await chrome.storage.session.remove('removal');
      if(!saved||saved.token!==m.token||saved.expires<Date.now()||saved.revision!==s.revision)throw Error('Prévia expirada ou listas alteradas. Gere uma nova prévia.');
      let cart=await read(saved.tabId);
      if(LM.fingerprint(cart)!==saved.plan.fingerprint)throw Error('Carrinho mudou após a prévia. Recalcule antes de remover.');
      const alreadyDone=saved.plan.alreadyDone||[];
      const journal={date:new Date().toISOString(),name:saved.plan.name,personId:saved.plan.personId,participantText:s.participants.find(p=>p.id===saved.plan.personId)?.text,status:'running',ops:[...alreadyDone,...saved.plan.ops],completed:alreadyDone.map(o=>o.id),inFlight:null};
      await chrome.storage.local.set({journal});
      try{
        for(const op of saved.plan.ops){
          const fresh=await read(saved.tabId);
          if(LM.fingerprint(fresh)!==LM.fingerprint(cart))throw Error('Carrinho mudou durante a operação.');
          journal.inFlight=op.id;await chrome.storage.local.set({journal});
          // Never retry the mutation. Navigation can destroy the execution context after the site accepted it.
          let dispatchError;
          try{const results=await chrome.scripting.executeScript({target:{tabId:saved.tabId},world:'MAIN',func:mutateOne,args:[op]});if(!results[0]?.result?.started)dispatchError='Resposta da página indisponível.';}catch(e){dispatchError=e.message;}
          let after;
          try{after=await observeOperation(saved.tabId,cart,op);}catch(e){throw Error(e.message+(dispatchError?' '+dispatchError:''));}
          journal.completed.push(op.id);journal.inFlight=null;cart=after;await chrome.storage.local.set({journal});
        }
        s.participants=s.participants.map(p=>p.id===saved.plan.personId?{...p,active:false}:p);s.revision++;
        await save(s);journal.status='completed';await chrome.storage.local.set({journal});return {state:s,cart,journal};
      }catch(e){journal.status='review';journal.error=e.message;await chrome.storage.local.set({journal});throw Error('Operação interrompida. '+e.message+' As alterações já realizadas não são desfeitas automaticamente.');}
    }
    throw Error('Comando desconhecido.');
  }finally{busy=false;}
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{handle(m,sender).then(data=>reply({ok:true,...data}),e=>reply({ok:false,error:e.message}));return true;});

})();