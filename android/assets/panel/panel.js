'use strict';
const $=id=>document.getElementById(id), brl=v=>v===null||v===undefined?'—':(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let state,cart,result,tabId,editing=null,token=null,busy=false,journal;
const call=async m=>{const r=await chrome.runtime.sendMessage(m);if(!r?.ok)throw Error(r?.error||'Extensão sem resposta.');return r;};
const message=(s='')=>{$('message').textContent=s;$('message').hidden=!s;};
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
function button(text,fn,cls){const b=el('button',text,cls);b.onclick=()=>run(fn);return b;}
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{message();await fn();}catch(e){message(e.message);if($('editor').open)$('parseFeedback').textContent=e.message;}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
async function commit(){try{const r=await call({type:'SAVE',revision:state.revision,state});state=r.state;render();}catch(e){state=(await call({type:'STATE'})).state;render();throw e;}}
async function recalc(){
  const fixed=new URLSearchParams(location.search).get('tab');
  if(fixed)tabId=Number(fixed);else{const tabs=await chrome.tabs.query({active:true,currentWindow:true});tabId=tabs[0]?.id;}
  cart=(await call({type:'READ',tabId})).cart;render();
}

function visualPeople(){return state.participants.map((p,i)=>({p,i})).sort((a,b)=>Number(a.p.active===false)-Number(b.p.active===false)||(a.p.position??a.i)-(b.p.position??b.i)||a.i-b.i).map(x=>x.p);}
let draggingId=null;
async function moveCard(fromId,toId){
  const list=visualPeople(),from=list.find(p=>p.id===fromId),to=list.find(p=>p.id===toId);
  if(!from||!to||from===to)return;
  if((from.active===false)!==(to.active===false)){message('Os ativos ficam juntos no início. Arraste dentro do mesmo grupo.');return;}
  const target=list.indexOf(to);list.splice(list.indexOf(from),1);list.splice(target,0,from);
  // Store only display positions; accounting keeps its original participant order.
  const positions=new Map(list.map((p,i)=>[p.id,i]));state.participants=state.participants.map(p=>({...p,position:positions.get(p.id)}));
  await commit();message('Ordem dos cards salva.');
  [...$('people').querySelectorAll('.person')].find(e=>e.dataset.personId===fromId)?.querySelector('.drag-handle')?.focus();
}
function wireDrag(box,handle,person){
  box.dataset.personId=person.id;box.draggable=true;
  const clear=()=>{$('people').querySelectorAll('.dragging,.drop-target').forEach(e=>e.classList.remove('dragging','drop-target'));};
  box.addEventListener('dragstart',e=>{
    if(busy||e.target.closest('input,textarea,select,a,summary,button:not(.drag-handle)')){e.preventDefault();return;}
    draggingId=person.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',person.id);box.classList.add('dragging');
  });
  box.addEventListener('dragover',e=>{const from=state.participants.find(p=>p.id===draggingId);if(!from||busy||(from.active===false)!==(person.active===false))return;e.preventDefault();e.dataTransfer.dropEffect='move';box.classList.add('drop-target');});
  box.addEventListener('dragleave',()=>box.classList.remove('drop-target'));
  box.addEventListener('drop',e=>{e.preventDefault();const from=draggingId;draggingId=null;clear();if(from)run(()=>moveCard(from,person.id));});
  box.addEventListener('dragend',()=>{draggingId=null;clear();});
  handle.addEventListener('keydown',e=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();
    const group=visualPeople().filter(p=>(p.active===false)===(person.active===false)),i=group.findIndex(p=>p.id===person.id),to=group[i+(['ArrowUp','ArrowLeft'].includes(e.key)?-1:1)];
    if(to)run(()=>moveCard(person.id,to.id));
  });
  let touchId=null,targetId=null;
  handle.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||busy)return;e.preventDefault();touchId=e.pointerId;handle.setPointerCapture(e.pointerId);box.classList.add('dragging');});
  handle.addEventListener('pointermove',e=>{if(e.pointerId!==touchId)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.person');clear();box.classList.add('dragging');targetId=target?.dataset.personId;if(target)target.classList.add('drop-target');if(e.clientY<60)window.scrollBy(0,-15);else if(e.clientY>innerHeight-60)window.scrollBy(0,15);});
  handle.addEventListener('pointerup',e=>{if(e.pointerId!==touchId)return;touchId=null;clear();const target=targetId;targetId=null;if(target)run(()=>moveCard(person.id,target));});
  handle.addEventListener('pointercancel',()=>{touchId=null;targetId=null;clear();});
}

function renderPending(){const pending=journal&&journal.status!=='completed';$('pending').hidden=!pending;$('pendingText').textContent=pending?`A tentativa de ${journal.name} não foi finalizada. Vamos recarregar o carrinho e conferir o que ainda falta antes de continuar.`:'';}
function render(){
  renderPending();
  result=cart?LM.calculate(cart,state.participants,state.shipping):null;
  $('shipping').value=state.shipping;
  for(const k of ['cards','freight','total'])$(k).textContent=brl(cart?.totals[k]);
  $('counts').textContent=result?`${result.count} cartas no carrinho · ${result.people.reduce((s,p)=>s+p.requested,0)} nas listas · ${cart.totals.shipments??'—'} envios`:'Suas listas ficam salvas neste navegador.';
  $('status').textContent=result?(result.checked?'✓ Carrinho conferido':'⚠ Conferência com divergências'):'Abra o carrinho para começar';
  $('source').textContent=cart?`${new URL(cart.url).hostname} · lido às ${new Date(cart.readAt).toLocaleTimeString('pt-BR')}`:'';
  $('people').replaceChildren();
  if(!state.participants.length)$('people').append(el('div','Adicione quem participa da compra e cole a lista de cada pessoa.','empty'));
  let lastGroup;
  for(const person of visualPeople()){
    const group=person.active===false?'Inativos':'Ativos';if(group!==lastGroup){$('people').append(el('h3',group,'people-group'));lastGroup=group;}
    const p=result?.people.find(x=>x.id===person.id), box=el('article',undefined,'person'+(person.active===false?' inactive':''));
    const handle=el('button','⠿','drag-handle');handle.type='button';handle.title='Arrastar para reordenar. Use também as setas do teclado.';handle.setAttribute('aria-label','Mover '+person.name);
    const head=el('div',undefined,'person-head');head.append(handle,el('h3',person.name),el('span',person.active===false?'Inativa':`${p?.qty??0} / ${LM.parse(person.text).items.reduce((s,i)=>s+i.qty,0)} cartas`,'badge'));box.append(head);
    const values=el('div',undefined,'amounts');for(const [label,key] of [['Cartas','cards'],['Frete','freight'],['Total','total']]){const cell=el('div');cell.append(el('small',label),el('strong',brl(p?.[key])));values.append(cell);}box.append(values);
    if(p?.details.length){box.append(el('p','Idiomas: '+[...new Set(p.details.map(d=>d.lang||'Não identificado'))].join(' · '),'muted'));const details=el('details'),summary=el('summary','Ver cartas atribuídas');details.append(summary);p.details.forEach(d=>details.append(el('div',`${d.qty}× ${d.name} · ${d.lang||'?'} · ${d.edition||'Edição não lida'} · ${brl(d.cost)}`,'card-details')));box.append(details);}
    const actions=el('div',undefined,'toolbar');actions.append(button('Editar',()=>openEditor(person)),button(person.active===false?'Ativar':'Pausar',async()=>{person.active=person.active===false;await commit();}));
    if(person.active!==false)actions.append(button('Remover do carrinho',()=>prepare(person),'danger'));box.append(actions);wireDrag(box,handle,person);$('people').append(box);
  }
  $('issueCount').textContent=result?.problems.length??0;$('issueList').replaceChildren();for(const p of result?.problems||[])$('issueList').append(el('li',p));
  $('diagnostics').textContent=cart?JSON.stringify({url:cart.url,readAt:cart.readAt,raw:cart.raw,rows:cart.rows,errors:cart.errors,allocation:'Idioma explícito primeiro; depois ordem das listas e linhas. Revise versões compartilhadas.'},null,2):'Nenhuma leitura realizada.';
  $('historyCount').textContent=state.history.length;$('history').replaceChildren();
  for(const h of state.history){const row=el('div',undefined,'history-row');row.append(el('span',`${new Date(h.date).toLocaleString('pt-BR')} · ${brl(h.cart.totals.total)} · ${h.result.checked?'conferido':'com divergências'}`),button('XLSX',()=>LMXLSX.export(h.result,h.cart,h.date)));$('history').append(row);}
  $('journal').textContent=journal?JSON.stringify(journal,null,2):'Nenhuma.';$('ack').hidden=!journal||journal.status==='completed';
}
function openEditor(person=null){editing=person?.id??null;$('editorTitle').textContent=person?'Editar participante':'Adicionar participante';$('personName').value=person?.name||'';$('personText').value=person?.text||'';$('deletePerson').hidden=!person;$('parseFeedback').textContent='';$('editor').showModal();$('personName').focus();}
function showRemovalPreview(r){
  token=r.token;$('confirmTitle').textContent=r.plan.recovery?'Continuar remoção pendente':'Confirmar remoção';
  const done=r.plan.alreadyDone||[];
  $('confirmIntro').textContent=`${r.plan.name}: ${r.plan.ops.reduce((s,o)=>s+o.remove,0)} carta(s) ainda a retirar.`+(r.plan.recovery?` ${done.length} item(ns) já estão no estado esperado e não serão removidos novamente.`:'');
  $('preview').replaceChildren();
  for(const o of done)$('preview').append(el('div',`✓ ${o.name}: já conferido · nenhuma nova alteração`,'preview-row'));
  for(const o of r.plan.ops)$('preview').append(el('div',`${o.name} · ${o.lang} · ${o.edition||'Edição não informada'}\nID ${o.id}: ${o.before} → ${o.after} unidades`,'preview-row'));
  $('doRemove').textContent=r.plan.ops.length?'Confirmar remoção':'Finalizar pendência sem remover';$('confirm').showModal();
}
async function prepare(p){
  if(journal&&journal.status!=='completed'){message('Use “Recarregar e revisar pendência” no topo do painel.');$('pending').scrollIntoView({behavior:'smooth'});return;}
  if(!tabId)await recalc();showRemovalPreview(await call({type:'PREPARE',tabId,personId:p.id}));
}
$('resume').onclick=()=>run(async()=>{
  if(!tabId)await recalc();message('Recarregando o carrinho para conferir o que ainda falta...');
  const r=await call({type:'PREPARE_RESUME',tabId});cart=r.cart;render();message();showRemovalPreview(r);
});

function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
$('recalc').onclick=()=>run(recalc);$('add').onclick=()=>openEditor();$('closeEditor').onclick=()=>$('editor').close();
$('personText').oninput=()=>{const p=LM.parse($('personText').value);$('parseFeedback').textContent=p.errors.length?p.errors.join('\n'):`${p.items.reduce((s,x)=>s+x.qty,0)} cartas · ${p.items.length} entradas`;};
$('personForm').onsubmit=e=>{e.preventDefault();run(async()=>{const name=$('personName').value.trim(),text=$('personText').value.trim(),parsed=LM.parse(text);if(!name||!parsed.items.length||parsed.errors.length)throw Error(parsed.errors.join('\n')||'Informe o nome e uma lista válida.');const existing=state.participants.find(p=>p.id===editing),p={id:editing||crypto.randomUUID(),name,text,active:existing?.active!==false,position:existing?(existing.position??state.participants.findIndex(x=>x.id===existing.id)):Math.max(-1,...state.participants.map((p,i)=>p.position??i))+1};if(existing)state.participants=state.participants.map(x=>x.id===editing?p:x);else state.participants.push(p);await commit();$('editor').close();});};
$('deletePerson').onclick=()=>run(async()=>{if(!confirm('Excluir esta lista salva? Isso não altera o carrinho.'))return;state.participants=state.participants.filter(p=>p.id!==editing);await commit();$('editor').close();});
$('shipping').onchange=()=>run(async()=>{state.shipping=$('shipping').value;await commit();});
$('cancelRemove').onclick=()=>{$('confirm').close();token=null;};
$('doRemove').onclick=()=>run(async()=>{$('confirm').close();message('Removendo todos os itens da prévia, um por vez. Aguarde a conclusão.');try{const r=await call({type:'EXECUTE',token});state=r.state;cart=r.cart;journal=r.journal;render();message('Remoção observada no carrinho. A lista foi preservada e pausada. Recarregue a LigaMagic para conferir a persistência.');}finally{token=null;const r=await call({type:'STATE'});state=r.state;journal=r.journal;render();}});
$('snapshot').onclick=()=>run(async()=>{if(!tabId)await recalc();state=(await call({type:'HISTORY',tabId})).state;render();message('Divisão salva no histórico local.');});
$('xlsx').onclick=()=>run(async()=>{await recalc();if(!cart.rows.length)throw Error('Nenhuma carta identificada para exportar.');await LMXLSX.export(result,cart);});
$('backup').onclick=()=>download(JSON.stringify({version:1,participants:state.participants,shipping:state.shipping},null,2),'ligamagic-listas.json','application/json');
$('import').onclick=()=>$('file').click();
$('file').onchange=()=>run(async()=>{const f=$('file').files[0];$('file').value='';if(!f)return;if(f.size>2000000)throw Error('Arquivo acima do limite de 2 MB.');const text=await f.text();if(f.name.toLowerCase().endsWith('.json')){const data=JSON.parse(text);if(data.version!==1||!Array.isArray(data.participants))throw Error('Use o JSON gerado por Backup das listas.');state.participants.push(...data.participants.map(p=>({...p,id:crypto.randomUUID()})));await commit();message('Listas importadas. As listas existentes foram preservadas.');}else{openEditor();$('personName').value=f.name.replace(/\.txt$/i,'');$('personText').value=text;$('personText').oninput();}});
$('ack').onclick=()=>run(async()=>{if(!confirm('Recarregou a LigaMagic e conferiu quais itens foram alterados? Ajuste ou pause a lista antes de remover novamente para evitar uma segunda retirada.'))return;await call({type:'ACK'});journal=null;render();});
$('expand').onclick=()=>run(async()=>{if(!tabId)await recalc();await chrome.tabs.create({url:chrome.runtime.getURL('panel.html')+'?tab='+tabId});});
$('side').onclick=()=>run(async()=>{const tabs=await chrome.tabs.query({active:true,currentWindow:true});await chrome.sidePanel.open({tabId:tabs[0].id});window.close();});
(async()=>{try{if(chrome.extension.getViews({type:'popup'}).includes(window))document.body.classList.add('popup');const r=await call({type:'STATE'});state=r.state;journal=r.journal;render();await recalc();}catch(e){message(e.message);}})();
setInterval(async()=>{if(busy||!cart||!tabId)return;try{const fresh=(await call({type:'READ',tabId})).cart;if(LM.fingerprint(fresh)!==LM.fingerprint(cart))$('status').textContent='↻ Carrinho alterado · recalcule';}catch{$('status').textContent='Aba indisponível · abra o carrinho e recalcule';}},4000);


chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local'||!changes.journal)return;
  journal=changes.journal.newValue;renderPending();
  if(journal?.status==='running')message(`Removendo a lista de ${journal.name}: ${journal.completed.length} de ${journal.ops.length} itens concluídos. Aguarde.`);
  if(journal?.status==='review')message('Remoção interrompida. Confira o registro no diagnóstico: '+(journal.error||''));
});
