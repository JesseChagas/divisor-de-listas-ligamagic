const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../content.js'),'utf8');
function harness(send){
  let button,reloads=0,stopped=0,oldRemoved=0;
  const runtime={id:'test-extension',sendMessage:send,onMessage:{addListener(){}}};
  const document={getElementById:()=>({remove(){oldRemoved++;}}),querySelector:()=>({}),documentElement:{append(h){h.isConnected=true;}},createElement(tag){const node={setAttribute(){},addEventListener(type,handler){this.click=handler;},attachShadow(){return {append(){}}}};if(tag==='button')button=node;return node;}};
  vm.runInNewContext(source,{document,chrome:{runtime},location:{reload(){reloads++;}},MutationObserver:class{observe(){}disconnect(){stopped++;}},setTimeout,clearTimeout,LMRead:()=>({})});
  return {button,runtime,get reloads(){return reloads;},get stopped(){return stopped;},get oldRemoved(){return oldRemoved;}};
}
test('synchronous invalidated-context error is caught and next click reloads only once',async()=>{const h=harness(()=>{throw Error('Extension context invalidated.');});await h.button.click();assert.match(h.button.textContent,/Recarregar página/);assert.equal(h.reloads,0);assert(h.stopped>0);await h.button.click();assert.equal(h.reloads,1);});
test('missing runtime after extension reload never calls sendMessage',async()=>{let calls=0;const h=harness(()=>{calls++;});h.runtime.id=undefined;await h.button.click();assert.equal(calls,0);assert.match(h.button.textContent,/Recarregar página/);});
test('async rejection is caught without an unhandled rejection',async()=>{const h=harness(()=>Promise.reject(Error('Extension context invalidated.')));await h.button.click();assert.match(h.button.textContent,/Recarregar página/);});
test('service worker error response is shown and remains retryable',async()=>{let calls=0;const h=harness(async()=>{calls++;return {ok:false,error:'Painel indisponível'};});await h.button.click();assert.equal(h.button.title,'Painel indisponível');await h.button.click();assert.equal(calls,2);assert.equal(h.reloads,0);});
test('successful open retains launcher and replaces stale duplicate host',async()=>{const h=harness(async()=>({ok:true}));await h.button.click();assert.equal(h.button.textContent,'◈ Dividir carrinho');assert.equal(h.oldRemoved,1);});
