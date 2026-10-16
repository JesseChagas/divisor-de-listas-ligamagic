/* Portable cart reference only. Never accept arbitrary cookie names or domains. */
(function(root){
'use strict';
const NAME='carrinhoMP', FORMAT='ligamagic-cart-cookie';
function domain(value){if(!['ligamagic.com.br','ligamagic.com'].includes(value))throw Error('Domínio de carrinho inválido.');return value;}
function fromURL(url){const u=new URL(url);if(u.protocol!=='https:')throw Error('Abra a LigaMagic por HTTPS.');return domain(u.hostname.replace(/^www\./,''));}
function value(v){if(typeof v!=='string'||!v.length||v.length>3800||/[^\x21-\x7e]|[;"\\]/.test(v))throw Error('Cookie do carrinho inválido ou grande demais.');return v;}
function parse(data){if(!data||data.format!==FORMAT||data.version!==1||data.cookie?.name!==NAME)throw Error('Use o arquivo gerado por Exportar carrinho (cookies).');return {format:FORMAT,version:1,domain:domain(data.domain),cookie:{name:NAME,value:value(data.cookie.value)}};}
function pack(d,v){return {...parse({format:FORMAT,version:1,domain:d,cookie:{name:NAME,value:v}}),exportedAt:new Date().toISOString()};}
async function list(d,storeId){const found=await chrome.cookies.getAll({domain:d,name:NAME,storeId});if(found.some(c=>c.partitionKey||c.path!=='/'||![d,'.'+d,'www.'+d,'.www.'+d].includes(c.domain)))throw Error('O carrinho usa um escopo de cookie não suportado. Nenhum cookie foi alterado.');return found;}
async function read(d,storeId){domain(d);if(typeof androidRequest==='function')return (await androidRequest('CART_COOKIE_READ',{domain:d})).value;
 const rows=await list(d,storeId),values=[...new Set(rows.map(c=>c.value).filter(Boolean))];if(values.length>1)throw Error('Há referências diferentes de carrinho neste navegador. Resolva-as no site antes de transferir.');return values[0]||null;}
function details(c,storeId){const host=c.domain.replace(/^\./,'');return {url:'https://'+host+'/',name:NAME,value:c.value,path:'/',secure:c.secure,httpOnly:c.httpOnly,sameSite:c.sameSite,storeId,...(!c.hostOnly?{domain:c.domain}:{}),...(c.expirationDate?{expirationDate:c.expirationDate}:{})};}
async function clear(d,storeId){for(let i=0;i<10;i++){const rows=await list(d,storeId);if(!rows.length)return;await chrome.cookies.remove({url:'https://'+rows[0].domain.replace(/^\./,'')+'/',name:NAME,storeId});}throw Error('Não foi possível limpar os escopos antigos do carrinho.');}
async function write(d,v,storeId){domain(d);value(v);if(typeof androidRequest==='function'){await androidRequest('CART_COOKIE_WRITE',{domain:d,value:v});return;}
 const old=await list(d,storeId);try{
 await clear(d,storeId);
 const result=await chrome.cookies.set({url:'https://www.'+d+'/',domain:'.'+d,path:'/',name:NAME,value:v,secure:true,httpOnly:false,sameSite:'lax',expirationDate:Math.floor(Date.now()/1000)+30*86400,storeId});
 if(!result||await read(d,storeId)!==v)throw Error('O navegador não confirmou a gravação.');
 }catch(e){try{await clear(d,storeId);for(const c of old)await chrome.cookies.set(details(c,storeId));}catch{throw Error('Falha ao importar e restaurar. Confira o carrinho antes de continuar.');}throw Error('Importação falhou; cookie anterior restaurado.');}
}
root.LMCartTransfer={NAME,parse,pack,fromURL,read,write};
if(typeof module!=='undefined')module.exports=root.LMCartTransfer;
})(globalThis);
