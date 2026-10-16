(function(root){
  'use strict';
  function readCart(doc=document,url=location.href) {
    const rows=[], errors=[], seen=new Map();
    const text=id=>doc.getElementById(id)?.textContent?.trim()??null;
    const integer=s=>{const m=String(s??'').match(/\d[\d.]*/);return m?Number(m[0].replace(/\./g,'')):null;};
    const totals={cards:LM.money(text('main_preco')),freight:LM.money(text('main_frete_preco')),total:LM.money(text('main_total')),items:integer(text('main_itens')),shipments:integer(text('main_fretes'))};
    const inputs=[...doc.querySelectorAll('input[id^="qty_"],input[id^="txt_qty_"],input[name^="qty_"],input[name^="txt_qty_"]')];
    for(const input of inputs){
      const id=(input.id||input.name).match(/^(?:txt_)?qty_(\d+)$/)?.[1];
      if(!id){errors.push(`Input de quantidade não suportado: ${input.id||input.name}`);continue;}
      let row=input.parentElement;
      while(row && row!==doc.body && !row.querySelector('[cardtitle],.cardtitle')) row=row.parentElement;
      if(!row || row===doc.body){errors.push(`ID ${id}: título da linha não localizado.`);continue;}
      if(row.hidden || row.style.display==='none' || (doc.defaultView && doc.defaultView.getComputedStyle(row).display==='none'))continue;
      const rowIds=new Set([...row.querySelectorAll('input[id^="qty_"],input[id^="txt_qty_"],input[name^="qty_"],input[name^="txt_qty_"]')].map(e=>(e.id||e.name).match(/^(?:txt_)?qty_(\d+)$/)?.[1]).filter(Boolean));
      if(rowIds.size!==1){errors.push(`ID ${id}: limites da linha ambíguos.`);continue;}
      const title=row.querySelector('[cardtitle] a,.cardtitle a,[cardtitle],.cardtitle');
      const display=title.textContent.trim();
      const link=title.matches('a')?title:title.querySelector('a');
      let canonical=null;
      try {canonical=link?new URL(link.getAttribute('href'),url).searchParams.get('card'):null;}catch{}
      if(canonical && /^(?:ed=|\?)/i.test(canonical)) canonical=null;
      const aliases=new Set([LM.norm(display)]);
      if(canonical) aliases.add(LM.norm(canonical));
      // Single slash separates bilingual titles. Double slash remains part of a split card name.
      const bilingual=display.split(/\s+(?<!\/)\/(?!\/)\s+/);
      if(bilingual.length===2) bilingual.forEach(x=>aliases.add(LM.norm(x)));
      const name=canonical||bilingual.at(-1), qty=/^\d+$/.test(input.value.trim())?Number(input.value):NaN;
      if(!Number.isSafeInteger(qty)||qty<1){errors.push(`ID ${id}: quantidade inválida.`);continue;}
      const langEl=row.querySelector('[languagecard] img')||row.querySelector('[languagecard]');
      const languageCell=row.querySelector('[languagecard]');
      const flag=attr=>LM.language(langEl?.getAttribute(attr)?.match(/\/([^/?#]+)\.svg(?:[?#]|$)/i)?.[1]);
      const lang=LM.language(langEl?.getAttribute('title'))||LM.language(langEl?.getAttribute('alt'))||flag('src')||flag('data-src')||LM.language(languageCell?.textContent)||LM.language(languageCell?.nextElementSibling?.matches('.label')?languageCell.nextElementSibling.textContent:null);
      const price=row.querySelector(`[id="preco_${id}"]`)||row.querySelector('.preco-total.item-total');
      const total=LM.money(price?.textContent);
      const edition=row.querySelector('[editioncard] img')?.getAttribute('title')||row.querySelector('[editioncard]')?.textContent.trim()||'';
      const quality=row.querySelector('[qualitycard]')?.textContent.trim()||'';
      const mutable=[...row.querySelectorAll('[onclick]')].some(el=>new RegExp('^\\s*mpDel\\(\\s*'+id+'\\s*\\)\\s*;?\\s*$').test(el.getAttribute('onclick')));
      const item={id,name,display,aliases:[...aliases],qty,lang,total,edition,quality,mutable};
      if(seen.has(id)){if(JSON.stringify(seen.get(id))!==JSON.stringify(item))errors.push(`ID ${id}: cópias do DOM divergem.`);continue;}
      seen.set(id,item);rows.push(item);
    }
    if(!inputs.length) errors.push('Nenhum input real de quantidade localizado. Abra o carrinho e aguarde carregar.');
    return {url,rows,totals,errors,readAt:new Date().toISOString(),raw:{main_preco:text('main_preco'),main_frete_preco:text('main_frete_preco'),main_total:text('main_total'),main_itens:text('main_itens'),main_fretes:text('main_fretes')}};
  }
  root.LMRead=readCart;
})(globalThis);
