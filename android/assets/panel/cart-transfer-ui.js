(()=>{
let imported;
const input=$('cartCookieFile'),dialog=$('cartCookieConfirm');
$('cartCookieExport').onclick=()=>run(async()=>{
 if(!tabId)await recalc();const r=await call({type:'CART_EXPORT',tabId});
 const text=JSON.stringify(r.file,null,2),name='ligamagic-carrinho-'+new Date().toISOString().slice(0,10)+'.json';
 if(typeof androidRequest==='function'){const bytes=new TextEncoder().encode(text);await androidRequest('SAVE_FILE',{name,data:btoa(String.fromCharCode(...bytes))});}
 else download(text,name,'application/json');
 message('Arquivo do carrinho exportado. Transfira-o para seu outro aparelho e use Importar carrinho (cookies).');
});
$('cartCookieImport').onclick=()=>input.click();
input.onchange=()=>run(async()=>{const file=input.files[0];input.value='';if(!file)return;if(file.size>16384)throw Error('Arquivo de carrinho acima do limite de 16 KB.');imported=LMCartTransfer.parse(JSON.parse(await file.text()));$('cartCookieDomain').textContent='Destino: '+imported.domain;dialog.showModal();});
$('cartCookieCancel').onclick=()=>{imported=null;dialog.close();};
dialog.addEventListener('cancel',()=>{imported=null;});
$('cartCookieApply').onclick=()=>run(async()=>{
 const file=imported;if(!file)return;if(!tabId)await recalc();
 const r=await call({type:'CART_IMPORT',tabId,file,confirmed:true});imported=null;dialog.close();cart=null;result=null;render();
 message('Cookie importado. '+(r.reloaded?'O site está recarregando.':'Recarregue a aba da LigaMagic.')+' Confira os itens e toque em Recalcular. Estoque, preços, frete e eventual vínculo com a conta são definidos pela LigaMagic.');
});
})();
