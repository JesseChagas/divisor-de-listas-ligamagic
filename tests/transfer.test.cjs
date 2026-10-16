const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const T=require('../cart-transfer.js');
(async()=>{
for(const invalid of [{format:'other',version:1},{...T.pack('ligamagic.com.br','synthetic'),domain:'evil.com'},{...T.pack('ligamagic.com.br','synthetic'),cookie:{name:'PHPSESSID',value:'x'}},{...T.pack('ligamagic.com.br','synthetic'),cookie:{name:'carrinhoMP',value:'x; Domain=evil.com'}}])assert.throws(()=>T.parse(invalid));
assert.throws(()=>T.fromURL('https://evil.ligamagic.com.br/'));assert.throws(()=>T.fromURL('http://www.ligamagic.com.br/'));
const ext=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'liga-transfer-'));
const c=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${ext}`,`--load-extension=${ext}`]});
try{
await c.route('https://www.ligamagic.com.br/**',r=>r.fulfill({contentType:'text/html',body:'<div id="main_preco">R$ 0,00</div>'}));
const w=c.serviceWorkers()[0]||await c.waitForEvent('serviceworker'),shop=await c.newPage();await shop.goto('https://www.ligamagic.com.br/?view=mp/carrinho');
const tid=await w.evaluate(async()=>(await chrome.tabs.query({url:'https://www.ligamagic.com.br/*'}))[0].id),p=await c.newPage();await p.goto(`chrome-extension://${new URL(w.url()).host}/panel.html?tab=${tid}`);
const msg=m=>p.evaluate(m=>chrome.runtime.sendMessage(m),m);
assert.equal((await msg({type:'CART_EXPORT',tabId:tid})).ok,false);
await c.addCookies([{name:'carrinhoMP',value:'synthetic-PC-reference',domain:'.ligamagic.com.br',path:'/',secure:true},{name:'PHPSESSID',value:'synthetic-login-untouched',domain:'.ligamagic.com.br',path:'/',httpOnly:true,secure:true}]);
let f=(await msg({type:'CART_EXPORT',tabId:tid})).file;assert.equal(f.cookie.value,'synthetic-PC-reference');assert(!JSON.stringify(f).includes('synthetic-login'));
const incoming=T.pack('ligamagic.com.br','synthetic-mobile-reference');
assert.equal((await msg({type:'CART_IMPORT',tabId:tid,file:incoming})).ok,false);
assert.equal((await msg({type:'CART_IMPORT',tabId:tid,file:T.pack('ligamagic.com','different'),confirmed:true})).ok,false);
await p.locator('#cartCookieFile').setInputFiles({name:'cart.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});await p.locator('#cartCookieConfirm').waitFor({state:'visible'});
assert.equal((await c.cookies()).find(x=>x.name==='carrinhoMP').value,'synthetic-PC-reference');
await p.locator('#cartCookieCancel').click();assert.equal((await c.cookies()).find(x=>x.name==='carrinhoMP').value,'synthetic-PC-reference');
await p.locator('#cartCookieFile').setInputFiles({name:'cart.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});await p.locator('#cartCookieApply').click();await p.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Cookie importado.'));
let cookies=await c.cookies();assert.equal(cookies.find(x=>x.name==='carrinhoMP').value,'synthetic-mobile-reference');assert.equal(cookies.find(x=>x.name==='PHPSESSID').value,'synthetic-login-untouched');
await c.addCookies([{name:'carrinhoMP',value:'host-copy',url:'https://www.ligamagic.com.br/'}]);assert.equal((await msg({type:'CART_EXPORT',tabId:tid})).ok,false);
assert((await msg({type:'CART_IMPORT',tabId:tid,file:incoming,confirmed:true})).ok);assert.equal((await c.cookies()).filter(x=>x.name==='carrinhoMP').length,1);
const wait=p.waitForEvent('download');await p.locator('details').filter({has:p.locator('#cartCookieExport')}).locator('summary').click();await p.locator('#cartCookieExport').click();const dl=await wait;const exported=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));assert.deepEqual(T.parse(exported),T.parse(incoming));
await w.evaluate(()=>chrome.storage.local.set({journal:{status:'review'}}));assert.equal((await msg({type:'CART_IMPORT',tabId:tid,file:incoming,confirmed:true})).ok,false);
console.log('PASS transfer: strict schema, no login cookies, no cookie, confirmation/cancel, import/export file, domain mismatch, duplicate scopes, pending removal block.');
}finally{await c.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
