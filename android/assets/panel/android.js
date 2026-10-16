'use strict';
// This bridge exists only in the app's packaged panel, never on remote sites.
const nativePending=new Map();let nativeSeq=0;
window.__nativeDone=(id,result)=>{const p=nativePending.get(id);if(!p)return;nativePending.delete(id);result.ok?p.resolve(result.value):p.reject(Error(result.error));};
function androidRequest(type,data={}){return new Promise((resolve,reject)=>{const id=String(++nativeSeq);nativePending.set(id,{resolve,reject});try{Native.request(id,JSON.stringify({type,...data}));}catch(e){nativePending.delete(id);reject(e);}});}
const listeners=[],storageListeners=[];
const area=name=>({
  get:async key=>androidRequest('STORAGE_GET',{area:name,key}),
  set:async values=>{const old=await androidRequest('STORAGE_SET',{area:name,values});const changes={};for(const k of Object.keys(values))changes[k]={oldValue:old[k],newValue:values[k]};storageListeners.forEach(fn=>fn(changes,name));},
  remove:async key=>{const old=await androidRequest('STORAGE_REMOVE',{area:name,key});storageListeners.forEach(fn=>fn({[key]:{oldValue:old}},name));},
  setAccessLevel:async()=>{}
});
const base='https://appassets.androidplatform.net/panel/';
window.chrome={
  runtime:{id:'android-liga-divisor',getURL:path=>base+path,onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:message=>new Promise((resolve,reject)=>{try{if(!listeners.length)throw Error('Divisor iniciando. Tente novamente.');if(['EXECUTE','CART_IMPORT'].includes(message.type))window.__operationRunning=true;listeners[0](message,{id:'android-liga-divisor',url:base+'panel.html'},result=>{if(['EXECUTE','CART_IMPORT'].includes(message.type))window.__operationRunning=false;resolve(result);});}catch(e){reject(e);}})},
  storage:{local:area('local'),session:area('session'),onChanged:{addListener:fn=>storageListeners.push(fn)}},
  tabs:{query:async()=>[await androidRequest('TAB_CURRENT')],get:id=>androidRequest('TAB_GET',{id}),sendMessage:(id,message)=>androidRequest('READ',{id}),reload:id=>androidRequest('RELOAD',{id}),create:opts=>androidRequest('PANEL_TAB',{url:opts.url})},
  sidePanel:{open:opts=>androidRequest('PANEL_OVERLAY',{id:opts.tabId})},
  extension:{getViews:()=>[]},
  scripting:{executeScript:async opts=>[{result:await androidRequest('EVAL',{id:opts.target.tabId,expression:'('+opts.func.toString().replace(/^async\s+/,'')+')('+opts.args.map(x=>JSON.stringify(x)).join(',')+')'})}]}
};
window.importScripts=()=>{};
window.close=()=>{};
const anchorClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){
  if(this.download&&this.href.startsWith('blob:')){const name=this.download;fetch(this.href).then(r=>r.blob()).then(blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);})).then(data=>androidRequest('SAVE_FILE',{name,data})).catch(e=>alert('Não foi possível salvar: '+e.message));return;}
  anchorClick.call(this);
};
window.mobileRetarget=()=>{if(typeof recalc==='function')run(recalc);};
