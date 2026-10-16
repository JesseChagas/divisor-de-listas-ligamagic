/* Run with Playwright installed: node tests/browser.test.cjs [artifact-directory] */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const extension=path.resolve(__dirname,'..'),artifacts=path.resolve(process.argv[2]||path.join(os.tmpdir(),'lm-test-artifacts'));
fs.mkdirSync(artifacts,{recursive:true});
const row=(id,name,qty,price,lang='Português')=>`<div class="row" id="linha_${id}"><table id="carrinho-item"><tr><td><p class="cardtitle" cardtitle><a href="./?view=cards/card&card=${encodeURIComponent(name)}">${name==='Evolving Wilds'?'Terras em Desenvolvimento / ':''}${name}</a></p><table><tr><td editioncard><img title="Amonkhet"></td><td languagecard><img alt="${lang}"></td><td qualitycard>NM</td></tr></table></td></tr></table><div id="qCarrinho_${id}"><input id="qty_${id}" name="qty_${id}" value="${qty}" onblur="mpValidaQty(this,${id})"><input type="button" value="+" onclick="mpAddQty(${id})"></div><div id="preco_${id}" class="preco-total item-total">R$ ${price}</div><div class="item-delete" onclick="mpDel(${id})"></div></div>`;
const fixture=`<!doctype html><meta charset="utf-8"><title>LigaMagic fixture</title><h1>Carrinho de teste</h1><div id="main_preco">R$ 2,18</div><div id="main_frete_preco">R$ 10,01</div><div id="main_total">R$ 12,19</div><div id="main_itens">5 itens</div><div id="main_fretes">1 envio</div>${row(60230908,'Evolving Wilds',3,'0,18')}${row(2,'Thopter',1,'1,00')}${row(3,'Ornithopter',1,'1,00')}<button onclick="mpDelBloco(0)">Remover loja</button><script>window.calls=[];window.prices={60230908:6,2:100,3:100};function money(n){return 'R$ '+(n/100).toFixed(2).replace('.',',')}function update(){let count=0,total=0;for(const el of document.querySelectorAll('input[id^="qty_"]')){count+=+el.value;total+=+el.value*prices[el.id.slice(4)]}document.querySelector('#main_preco').textContent=money(total);document.querySelector('#main_total').textContent=money(total+1001);document.querySelector('#main_itens').textContent=count+' itens'}function mpDel(id){calls.push(['delete',id]);document.querySelector('#linha_'+id).remove();update()}function mpValidaQty(input,id){calls.push(['quantity',id,+input.value]);document.querySelector('#preco_'+id).textContent=money(+input.value*prices[id]);update()}function mpDelBloco(){throw Error('FORBIDDEN bulk deletion')}<\/script>`;
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'lm-extension-test-'));
 const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
  await context.route('https://www.ligamagic.com.br/**',r=>r.fulfill({contentType:'text/html',body:fixture}));
  const shop=await context.newPage();await shop.goto('https://www.ligamagic.com.br/?view=mp/carrinho');await shop.waitForSelector('#lm-divisor-launcher',{state:'attached'});
  const tabId=await worker.evaluate(async()=>{const t=await chrome.tabs.query({url:'https://www.ligamagic.com.br/*'});return t[0].id;});
  const panel=await context.newPage(),errors=[];panel.on('pageerror',e=>errors.push(e.message));await panel.goto(`chrome-extension://${id}/panel.html?tab=${tabId}`);await panel.waitForFunction(()=>document.querySelector('#cards').textContent.includes('2,18'));
  async function msg(m){return panel.evaluate(m=>chrome.runtime.sendMessage(m),m);}
  // Regression: LigaMagic's bilingual PTEN flag, including lazy flags and adjacent label.
  await shop.evaluate(html=>{
    document.querySelectorAll('.row').forEach(e=>e.remove());document.body.insertAdjacentHTML('beforeend',html);
    const cell=document.querySelector('[languagecard]'),img=cell.querySelector('img');
    img.title='Português / Inglês';img.src='https://www.lmcorp.com.br/images/bandeiras/pten.svg';cell.insertAdjacentHTML('afterend','<td class="label">PTEN</td>');
    document.querySelector('#main_preco').textContent='R$ 11,76';document.querySelector('#main_total').textContent='R$ 21,77';document.querySelector('#main_itens').textContent='12';
  },row(61896631,'Swamp',12,'11,76','Português / Inglês'));
  for(const source of ['attributes','src','data-src','label']){
    if(source==='src')await shop.evaluate(()=>{const i=document.querySelector('[languagecard] img');i.removeAttribute('title');i.removeAttribute('alt');});
    if(source==='data-src')await shop.evaluate(()=>{const i=document.querySelector('[languagecard] img');i.setAttribute('data-src',i.getAttribute('src'));i.removeAttribute('src');});
    if(source==='label')await shop.evaluate(()=>document.querySelector('[languagecard] img').remove());
    const mixed=(await msg({type:'READ',tabId})).cart;assert.equal(mixed.rows[0].lang,'PT/EN',source);assert.equal(mixed.rows[0].qty,12);assert.equal(mixed.rows[0].total,1176);
    assert((await panel.evaluate(c=>LM.calculate(c,[{id:'mixed',name:'Teste',text:'12 Swamp'}]),mixed)).checked);
  }
  await shop.reload();await shop.waitForSelector('#lm-divisor-launcher',{state:'attached'});
  let s=(await msg({type:'STATE'})).state;s.participants=[{id:'a',name:'Denis',text:'1 Evolving Wilds [PT]\n1 Thopter',active:true},{id:'b',name:'Jesse',text:'2 Evolving Wilds [PT]\n1 Ornithopter',active:true}];assert((await msg({type:'SAVE',state:s,revision:s.revision})).ok);
  await panel.reload();await panel.waitForFunction(()=>document.querySelector('#cards').textContent.includes('2,18'));console.log('Initial status:',await panel.locator('#status').textContent(),await panel.locator('#issueList').textContent());await panel.waitForFunction(()=>document.querySelector('#status').textContent.includes('conferido'));
  assert.equal(await panel.locator('.person').count(),2);assert.equal(await panel.locator('#issueCount').textContent(),'0');
  // Responsive duplicate is deduplicated. Divergent duplicates are blocked.
  await shop.evaluate(()=>{const e=document.querySelector('#linha_2').cloneNode(true);e.id='clone';document.body.append(e);});
  let c=(await msg({type:'READ',tabId})).cart;assert.equal(c.rows.length,3);assert.equal(c.errors.length,0);
  await shop.evaluate(()=>document.querySelector('#clone input').value='2');c=(await msg({type:'READ',tabId})).cart;assert(c.errors.some(x=>x.includes('divergem')));
  await shop.evaluate(()=>document.querySelector('#clone').remove());
  // Capture polished panel before mutations; desktop and narrow side-panel layout.
  await panel.setViewportSize({width:460,height:1000});await panel.screenshot({path:path.join(artifacts,'painel.png'),fullPage:true});
  await panel.locator('#theme').click();await panel.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await panel.reload();await panel.waitForFunction(()=>document.documentElement.dataset.theme==='dark'&&document.querySelectorAll('.person').length===2);
  assert.equal(await panel.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(18, 27, 24)');
  await panel.screenshot({path:path.join(artifacts,'painel-escuro.png'),fullPage:true});
  await panel.locator('#theme').click();await panel.waitForFunction(()=>document.documentElement.dataset.theme==='light');
  await panel.locator('#theme').click();await panel.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
  await panel.setViewportSize({width:360,height:900});assert(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await panel.getByRole('button',{name:'+ Adicionar'}).click();await panel.locator('#personName').fill('Teste');await panel.locator('#personText').fill('invalid');await panel.getByRole('button',{name:'Salvar lista',exact:true}).click();await panel.waitForFunction(()=>document.querySelector('#parseFeedback').textContent.includes('Linha'));await panel.locator('#closeEditor').click();
  // Stale preview must not modify cart.
  let prep=await msg({type:'PREPARE',tabId,personId:'a'});assert(prep.ok);
  await shop.evaluate(()=>document.querySelector('#qty_2').value='2');let executed=await msg({type:'EXECUTE',token:prep.token});assert(!executed.ok);assert.equal((await shop.evaluate(()=>calls)).length,0);await shop.evaluate(()=>document.querySelector('#qty_2').value='1');
  // UI confirmation cancel is inert.
  await panel.locator('.person').first().getByRole('button',{name:'Remover do carrinho'}).click();await panel.locator('#cancelRemove').click();assert.equal((await shop.evaluate(()=>calls)).length,0);
  // Authorized confirmation executes one reduction plus one individual deletion.
  await panel.locator('.person').first().getByRole('button',{name:'Remover do carrinho'}).click();await panel.locator('#doRemove').click();await panel.waitForFunction(()=>document.querySelector('#message').textContent.includes('Remoção observada'));
  assert.deepEqual(await shop.evaluate(()=>calls),[['quantity',60230908,2],['delete',2]]);assert.equal(await shop.locator('#qty_60230908').inputValue(),'2');assert.equal(await shop.locator('#qty_3').inputValue(),'1');
  s=(await msg({type:'STATE'})).state;assert.equal(s.participants[0].active,false);assert(s.participants[0].text.includes('Thopter'));
  // One-shot token, page cannot invoke extension mutation endpoint, and history survives reload.
  executed=await msg({type:'EXECUTE',token:prep.token});assert(!executed.ok);
  assert((await msg({type:'HISTORY',tabId})).ok);await panel.reload();await panel.waitForFunction(()=>document.querySelector('#historyCount').textContent==='1');
  const download=panel.waitForEvent('download');await panel.locator('#xlsx').click();const dl=await download;await dl.saveAs(path.join(artifacts,'division.xlsx'));
  // Partial/uncertain failures must stop subsequent deletes and block a second plan.
  s=(await msg({type:'STATE'})).state;
  const obsolete=s.revision;s.participants[0].active=true;s.participants[0].text='1 Evolving Wilds [PT]\n1 Ornithopter';s.participants[1].text='1 Evolving Wilds [PT]';
  assert((await msg({type:'SAVE',state:s,revision:s.revision})).ok);
  assert.equal((await msg({type:'SAVE',state:s,revision:obsolete})).ok,false);
  prep=await msg({type:'PREPARE',tabId,personId:'a'});assert(prep.ok);
  await shop.evaluate(()=>{window.mpValidaQty=()=>{throw Error('Simulated site failure')};});
  executed=await msg({type:'EXECUTE',token:prep.token});assert.equal(executed.ok,false);assert.equal(await shop.locator('#qty_3').count(),1);
  const failure=(await msg({type:'STATE'})).journal;assert.equal(failure.status,'review');assert.equal(failure.inFlight,'60230908');assert.equal(failure.completed.length,0);
  assert.equal((await msg({type:'PREPARE',tabId,personId:'a'})).ok,false);
  // Batch removal with native per-item confirms, asynchronous hide and an empty final cart.
  await msg({type:'ACK'});await shop.reload();await shop.waitForSelector('#lm-divisor-launcher',{state:'attached'});
  s=(await msg({type:'STATE'})).state;s.participants=[{id:'batch',name:'Lista completa',text:'3 Evolving Wilds\n1 Thopter\n1 Ornithopter',active:true}];
  assert((await msg({type:'SAVE',state:s,revision:s.revision})).ok);
  let dialogs=0;shop.on('dialog',async d=>{dialogs++;await d.dismiss();});
  await shop.evaluate(()=>{
    window.originalConfirm=window.confirm;
    window.mpDel=id=>{
      if(!confirm('Você tem certeza que deseja remover este item de seu carrinho?'))return;
      calls.push(['delete',id]);
      setTimeout(()=>{
        document.querySelector('#linha_'+id).style.display='none';
        let n=0,t=0;for(const r of document.querySelectorAll('.row'))if(r.style.display!=='none'){const q=+r.querySelector('input').value;n+=q;t+=q*prices[r.querySelector('input').id.slice(4)];}
        document.querySelector('#main_itens').textContent=n;document.querySelector('#main_preco').textContent=money(t);document.querySelector('#main_total').textContent=money(t+1001);
      },300);
    };
  });
  prep=await msg({type:'PREPARE',tabId,personId:'batch'});assert(prep.ok);
  executed=await msg({type:'EXECUTE',token:prep.token});assert(executed.ok,executed.error);
  assert.equal(executed.journal.completed.length,3);assert.equal(executed.cart.rows.length,0);assert.equal(dialogs,0);
  assert(await shop.evaluate(()=>window.confirm===window.originalConfirm));
  assert.deepEqual(await shop.evaluate(()=>calls),[['delete',60230908],['delete',2],['delete',3]]);
  // Repeat with a full navigation after each individual server-side deletion.
  const removed=new Set(),deleteRequests=[];
  await context.route('https://www.ligamagic.com.br/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/test-delete'){deleteRequests.push(Number(url.searchParams.get('id')));removed.add(Number(url.searchParams.get('id')));await route.fulfill({body:'ok'});return;}
    let html=fixture;
    for(const [id,name,q,price] of [[60230908,'Evolving Wilds',3,'0,18'],[2,'Thopter',1,'1,00'],[3,'Ornithopter',1,'1,00']])if(removed.has(id))html=html.replace(row(id,name,q,price),'');
    const n=(removed.has(60230908)?0:3)+(removed.has(2)?0:1)+(removed.has(3)?0:1),t=(removed.has(60230908)?0:18)+(removed.has(2)?0:100)+(removed.has(3)?0:100);
    html=html.replace('R$ 2,18','R$ '+(t/100).toFixed(2).replace('.',',')).replace('R$ 12,19','R$ '+((t+1001)/100).toFixed(2).replace('.',',')).replace('5 itens',n+' itens');
    html=html.replace("function mpDel(id){calls.push(['delete',id]);document.querySelector('#linha_'+id).remove();update()}","function mpDel(id){if(!confirm('Você tem certeza que deseja remover este item de seu carrinho?'))return;fetch('/test-delete?id='+id).then(()=>location.reload())}");
    await route.fulfill({contentType:'text/html',body:html});
  });
  await shop.reload();await shop.waitForSelector('#lm-divisor-launcher',{state:'attached'});
  s=(await msg({type:'STATE'})).state;s.participants[0].active=true;assert((await msg({type:'SAVE',state:s,revision:s.revision})).ok);
  prep=await msg({type:'PREPARE',tabId,personId:'batch'});assert(prep.ok);
  executed=await msg({type:'EXECUTE',token:prep.token});assert(executed.ok,executed.error);assert.equal(executed.journal.completed.length,3);assert.equal(removed.size,3);assert.equal(dialogs,0);
  console.log('PASS: 3 individual deletions with native confirms and hidden rows; 3 individual deletions across full page reloads; empty cart; no native dialogs; confirm restored.');
  // Recover a legacy interrupted journal; page reload reveals one deletion already persisted.
  removed.clear();await shop.reload();await shop.waitForSelector('#lm-divisor-launcher',{state:'attached'});
  s=(await msg({type:'STATE'})).state;s.participants[0].active=true;assert((await msg({type:'SAVE',state:s,revision:s.revision})).ok);
  prep=await msg({type:'PREPARE',tabId,personId:'batch'});assert(prep.ok);
  const legacy={name:'Lista completa',personId:'batch',status:'review',ops:prep.plan.ops,completed:['2'],inFlight:'60230908'};
  await worker.evaluate(journal=>chrome.storage.local.set({journal}),legacy);
  removed.add(2);const requestCount=deleteRequests.length;
  await panel.reload();await panel.locator('#resume').waitFor({state:'visible'});await panel.locator('#resume').click();await panel.locator('#confirm').waitFor({state:'visible'});
  assert.equal(await panel.locator('#preview .preview-row').count(),3);assert((await panel.locator('#confirmIntro').textContent()).includes('1 item(ns)'));
  assert.equal(deleteRequests.length,requestCount); // Review is read-only until confirmation.
  await panel.locator('#doRemove').click();await panel.waitForFunction(()=>document.querySelector('#message').textContent.includes('Remoção observada'));
  assert.equal(deleteRequests.length,requestCount+2);assert.deepEqual(deleteRequests.slice(requestCount),[60230908,3]);
  assert.equal((await msg({type:'STATE'})).journal.status,'completed');assert(await panel.locator('#pending').isHidden());
  // Everything already removed: closing a legacy pending record must issue zero delete calls.
  await worker.evaluate(journal=>chrome.storage.local.set({journal}),legacy);
  await panel.reload();await panel.locator('#resume').click();await panel.locator('#confirm').waitFor({state:'visible'});
  assert.equal(await panel.locator('#doRemove').textContent(),'Finalizar pendência sem remover');
  const beforeFinalize=deleteRequests.length;await panel.locator('#doRemove').click();await panel.waitForFunction(()=>document.querySelector('#message').textContent.includes('Remoção observada'));
  assert.equal(deleteRequests.length,beforeFinalize);assert.equal((await msg({type:'STATE'})).journal.status,'completed');
  console.log('PASS: legacy pending journal recovery via UI, reload from server, partial resume without repeated deletion, preview without mutations, completed recovery with zero deletions.');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: extension loaded, real content scripts, reader deduplication, stale preview, cancel, safe shared reduction, individual deletion, persistence, history, XLSX, editor validation, 360px layout, revision conflict, interrupted removal journal and blocked retry.');
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

