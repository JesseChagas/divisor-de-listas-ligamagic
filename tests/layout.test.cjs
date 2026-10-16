const {chromium}=require('playwright');const assert=require('assert/strict');const fs=require('fs'),path=require('path'),os=require('os');
(async()=>{const ext=path.resolve(__dirname,'..'),c=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'lm-layout-')),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});try{
const worker=c.serviceWorkers()[0]||await c.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
const people=[{id:'a',name:'Jessé',active:true,text:'1 Thopter'},{id:'b',name:'Lucas',active:false,text:'1 Forest'},{id:'c',name:'Denis',active:false,text:'1 Forest'},{id:'d',name:'Iago',active:true,text:'1 Thopter'}];
await worker.evaluate(participants=>chrome.storage.local.set({state:{version:1,revision:0,participants,shipping:'equal',history:[]},theme:'dark'}),people);
const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(`chrome-extension://${id}/panel.html`);await p.locator('.person').last().waitFor();
const order=()=>p.locator('.person').evaluateAll(es=>es.map(e=>e.dataset.personId));assert.deepEqual(await order(),['a','d','b','c']);
await p.setViewportSize({width:900,height:1000});const boxes=await p.locator('.person').evaluateAll(es=>es.map(e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y}}));assert.equal(boxes[0].y,boxes[1].y);assert(boxes[1].x>boxes[0].x);
await p.locator('[data-person-id="d"] .person-head').dragTo(p.locator('[data-person-id="a"] .person-head'));await p.waitForFunction(()=>document.querySelector('.person').dataset.personId==='d');assert.deepEqual(await order(),['d','a','b','c']);
let stored=await worker.evaluate(async()=>(await chrome.storage.local.get('state')).state);assert.deepEqual(stored.participants.map(x=>x.id),['a','b','c','d']);
await p.reload();await p.waitForFunction(()=>document.querySelector('.person')?.dataset.personId==='d');
await p.locator('[data-person-id="d"] .drag-handle').press('ArrowRight');await p.waitForFunction(()=>document.querySelector('.person').dataset.personId==='a');
await p.locator('[data-person-id="b"]').getByRole('button',{name:'Ativar',exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll('.person.inactive').length===1);assert.deepEqual(await order(),['a','d','b','c']);
await p.screenshot({path:path.join(os.tmpdir(),'ligamagic-cards-v106.png'),fullPage:true});
await p.setViewportSize({width:360,height:950});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: active grouping, two columns, actual drag, keyboard reorder, persistence, unchanged accounting order, activation regrouping and 360px layout.');
}finally{await c.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
