/* Pure accounting and safety rules. All currency values are integer centavos. */
(function (root) {
  'use strict';
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s*\/\/\s*/g, ' // ').replace(/\s+/g, ' ').trim();
  const langs = {pt:'PT', portugues:'PT', portuguese:'PT', en:'EN', ingles:'EN', english:'EN', es:'ES', espanhol:'ES', spanish:'ES', jp:'JA', ja:'JA', japones:'JA', japanese:'JA', de:'DE', alemao:'DE', german:'DE', fr:'FR', frances:'FR', french:'FR', it:'IT', italiano:'IT', italian:'IT', ru:'RU', russo:'RU', russian:'RU', ko:'KO', coreano:'KO', korean:'KO', cs:'ZHS', zhs:'ZHS', ct:'ZHT', zht:'ZHT', chines:'ZH', chinese:'ZH'};
  function language(s) {
    const value=norm(s);
    if(langs[value]) return langs[value];
    if(value==='pten'||value==='enpt') return 'PT/EN';
    const parts=value.split(/\s*[/+]\s*/);
    if(parts.length<2 || parts.some(p=>!langs[p])) return null;
    const codes=[...new Set(parts.map(p=>langs[p]))].sort((a,b)=>a==='PT'?-1:b==='PT'?1:a.localeCompare(b));
    return codes.join('/');
  }
  function money(s) {
    const matches = String(s ?? '').match(/(?:R\$\s*)?\d[\d.]*,\d{2}|R\$\s*\d+(?![\d.,])/g);
    if (!matches) return null;
    return Math.round(Number(matches.at(-1).replace(/R\$|\s|\./g,'').replace(',','.')) * 100);
  }
  function parse(text) {
    const items = [], errors = [];
    String(text).split(/\r?\n/).forEach((line, i) => {
      line = line.trim(); if (!line || line.startsWith('#')) return;
      let lang = null;
      const lm = line.match(/\s+\[([^\]]+)\]\s*$/);
      if (lm) { lang = language(lm[1]); if (!lang) { errors.push(`Linha ${i+1}: idioma desconhecido [${lm[1]}].`); return; } line = line.slice(0, lm.index).trim(); }
      const m = line.match(/^(\d+)\s*x?\s+(.+)$/i);
      if (!m || !Number.isSafeInteger(+m[1]) || +m[1] < 1 || +m[1] > 100000) { errors.push(`Linha ${i+1}: use quantidade e nome, por exemplo 2 Evolving Wilds [PT].`); return; }
      const name = m[2].trim(), key = norm(name);
      const existing = items.find(x => x.key === key && x.lang === lang);
      if (existing) existing.qty += +m[1]; else items.push({name, key, lang, qty:+m[1]});
    });
    return {items, errors};
  }
  function splitCents(total, weights) {
    const sum = weights.reduce((a,b)=>a+b,0);
    if (!sum) return weights.map(()=>0);
    const raw = weights.map(w=>total*w/sum), out = raw.map(Math.floor);
    let left = total - out.reduce((a,b)=>a+b,0);
    const order = raw.map((v,i)=>({i, r:v-out[i]})).sort((a,b)=>b.r-a.r || a.i-b.i);
    for (let i=0;i<left;i++) out[order[i%order.length].i]++;
    return out;
  }
  const fingerprint = cart => JSON.stringify({url:cart.url, rows:cart.rows.map(r=>[r.id,r.qty,r.total,r.name,r.lang,r.edition,r.quality]).sort((a,b)=>a[0].localeCompare(b[0])), totals:cart.totals, errors:cart.errors});
  function applyFreight(total,people,weights,problems){
    const freight=splitCents(total,weights);
    const recipients=people.map(p=>p.qty>0 && !(p.freightDiscount>0)?1:0);
    let discounts=people.map((p,i)=>p.qty>0 && Number.isSafeInteger(p.freightDiscount) && p.freightDiscount>0?Math.min(p.freightDiscount,freight[i]):0);
    if(discounts.some(Boolean)&&!recipients.some(Boolean)){problems.push('Descontos de frete não aplicados: mantenha pelo menos um participante com cartas sem desconto para assumir a diferença.');discounts=discounts.map(()=>0);}
    const extra=splitCents(discounts.reduce((s,v)=>s+v,0),recipients);
    people.forEach((p,i)=>{p.freightBase=freight[i];p.freightDiscountApplied=discounts[i];p.freightExtra=extra[i];p.freight=freight[i]-discounts[i]+extra[i];p.total=p.cards+p.freight;});
  }
  function simulateFreight(result,totalPeople){
    if(result.shipping!=='equal')throw Error('A simulação está disponível apenas no rateio igual.');
    const people=result.people.filter(p=>p.qty>0).map(p=>({...p})),currentCount=people.length;
    if(!currentCount)throw Error('Distribua cartas a pelo menos uma pessoa antes de simular.');
    if(!Number.isSafeInteger(totalPeople)||totalPeople<currentCount||totalPeople>1000)throw Error(`Escolha entre ${currentCount} e 1000 pessoas no total.`);
    const total=result.totals.freight;
    if(!Number.isSafeInteger(total)||total<0)throw Error('O frete do carrinho não foi identificado. Recalcule antes de simular.');
    while(people.length<totalPeople)people.push({name:`Pessoa adicional ${people.length-currentCount+1}`,qty:1,cards:0,freightDiscount:0,simulated:true});
    const problems=[];
    applyFreight(total,people,people.map(()=>1),problems);
    return {people,currentCount,totalPeople,added:totalPeople-currentCount,total,problems};
  }
  function calculate(cart, participants, shipping='equal') {
    const people = participants.filter(p=>p.active !== false).map(p=>({...p, cards:0, freight:0, qty:0, requested:0, details:[], errors:parse(p.text).errors}));
    const problems = [...cart.errors], versionNotices = new Set();
    if (!people.length) problems.push('Adicione pelo menos um participante ativo.');
    const remaining = cart.rows.map(r=>r.qty), allocations = cart.rows.map(()=>[]);
    const requests = [];
    people.forEach((p,pi)=>{p.errors.forEach(e=>problems.push(`${p.name}: ${e}`)); parse(p.text).items.forEach(item=>{p.requested+=item.qty;requests.push({...item,pi});});});
    // Explicit language requests take precedence; within each category saved order is stable.
    requests.sort((a,b)=>Number(!!b.lang)-Number(!!a.lang));
    for (const req of requests) {
      const matches = cart.rows.map((r,i)=>({r,i})).filter(({r})=>r.aliases.includes(req.key));
      const canonical = new Set(matches.map(({r})=>norm(r.name)));
      let need = req.qty;
      if(matches.filter(({r})=>!req.lang||r.lang===req.lang).length>1){const notice=`${req.name}: há múltiplas versões/lojas; a atribuição segue a ordem das listas e das linhas. Revise a divisão.`;problems.push(notice);versionNotices.add(notice);}
      if (canonical.size>1) problems.push(`${req.name}: nome ambíguo; nenhuma atribuição automática.`);
      else for (const {r,i} of matches) {
        if (req.lang && req.lang !== r.lang) continue;
        const take = Math.min(need,remaining[i]); if (!take) continue;
        allocations[i].push({pi:req.pi, qty:take}); remaining[i]-=take; need-=take;
        if (!need) break;
      }
      if (need) {
        const mixed=req.lang && matches.find(({r})=>r.lang?.includes('/')&&r.lang.split('/').includes(req.lang));
        problems.push(`${people[req.pi].name} · ${req.name}${req.lang?' ['+req.lang+']':''}: faltam ${need} de ${req.qty}.${mixed?' A LigaMagic informa '+mixed.r.lang+' sem discriminar a quantidade de cada idioma.':''}`);
      }
    }
    const unassigned=[];
    cart.rows.forEach((r,i)=>{
      const shares = splitCents(r.total ?? 0,[...allocations[i].map(a=>a.qty),remaining[i]]);
      allocations[i].forEach((a,j)=>{const p=people[a.pi];p.cards+=shares[j];p.qty+=a.qty;p.details.push({...r,qty:a.qty,cost:shares[j]});});
      if (remaining[i]) { unassigned.push({...r,qty:remaining[i],cost:shares.at(-1)}); problems.push(`${r.name}: ${remaining[i]} unidade(s) sem participante.`); }
      if (!r.lang) problems.push(`${r.name}: idioma não identificado.`);
      if (r.total === null) problems.push(`${r.name}: preço não identificado.`);
    });
    const rowTotal=cart.rows.reduce((s,r)=>s+(r.total??0),0), count=cart.rows.reduce((s,r)=>s+r.qty,0);
    for (const key of ['cards','freight','total','items','shipments']) if (cart.totals[key]===null) problems.push(`Resumo da LigaMagic: campo ${key} não localizado.`);
    if (cart.totals.cards!==null && rowTotal!==cart.totals.cards) problems.push(`Soma das linhas difere do subtotal da LigaMagic em ${((rowTotal-cart.totals.cards)/100).toFixed(2)} reais.`);
    if (cart.totals.items!==null && count!==cart.totals.items) problems.push(`Quantidade das linhas (${count}) difere de #main_itens (${cart.totals.items}).`);
    if (cart.totals.total!==null && cart.totals.cards!==null && cart.totals.freight!==null && cart.totals.total!==cart.totals.cards+cart.totals.freight) problems.push('Total da LigaMagic contém ajuste/desconto não distribuído.');
    const weights=people.map(p=>shipping==='value'?p.cards:shipping==='quantity'?p.qty:p.qty>0?1:0);
    applyFreight(cart.totals.freight??0,people,weights,problems);
    if ((cart.totals.freight??0)>0 && !weights.some(Boolean)) problems.push('Frete ainda não atribuído: não há cartas distribuídas.');
    return {people,problems:[...new Set(problems)],imageProblems:[...new Set(problems)].filter(p=>!versionNotices.has(p)||cart.errors.includes(p)),unassigned,rowTotal,count,totals:cart.totals,shipping,checked:problems.length===0,allocations};
  }
  function removalPlan(cart, participants, personId) {
    if (cart.errors.length) throw Error('Leitura incompleta do carrinho. Resolva o diagnóstico antes de remover.');
    const p=participants.find(p=>p.id===personId && p.active!==false);
    if (!p) throw Error('Participante não está ativo.');
    if (participants.filter(p=>p.active!==false).some(p=>parse(p.text).errors.length)) throw Error('Corrija as listas inválidas antes de remover.');
    const requests=parse(p.text).items, ops=[], blocked=[];
    if (!requests.length) throw Error('A lista está vazia.');
    const used=new Set();
    for (const req of requests) {
      const matches=cart.rows.filter(r=>r.aliases.includes(req.key) && (!req.lang||r.lang===req.lang));
      if (matches.length!==1) {blocked.push(`${req.name}: ${matches.length?'múltiplas versões/lojas; ajuste manualmente':'não localizada'}.`);continue;}
      const row=matches[0]; if(used.has(row.id)) continue; used.add(row.id);
      if(row.lang?.includes('/') && participants.filter(q=>q.active!==false).flatMap(q=>parse(q.text).items).some(x=>row.aliases.includes(x.key)&&x.lang&&x.lang!==row.lang&&x.lang.split('/').some(code=>row.lang.split('/').includes(code)))) {
        blocked.push(`${row.name}: ${row.lang} sem quantidade por idioma; não é possível preservar com segurança um pedido de idioma específico.`);continue;
      }
      const own=requests.filter(x=>row.aliases.includes(x.key)&&(!x.lang||x.lang===row.lang)).reduce((s,x)=>s+x.qty,0);
      // Reserve all demand from every other list for this identity, including requests without language.
      const other=participants.filter(q=>q.id!==personId&&q.active!==false).flatMap(q=>parse(q.text).items).filter(x=>row.aliases.includes(x.key)&&(!x.lang||!row.lang||x.lang===row.lang)).reduce((s,x)=>s+x.qty,0);
      if (row.qty<own+other) {blocked.push(`${row.name}: quantidade insuficiente para atribuir a retirada com segurança.`);continue;}
      if (!row.mutable || !row.lang || row.total===null) {blocked.push(`${row.name}: ID, idioma ou preço sem validação para alteração.`);continue;}
      const after=row.qty-own;
      ops.push({id:row.id,name:row.name,lang:row.lang,edition:row.edition,before:row.qty,after,remove:own,total:row.total});
    }
    if(blocked.length) throw Error('Remoção bloqueada:\n'+blocked.join('\n'));
    if(!ops.length) throw Error('Nenhuma alteração segura encontrada.');
    return {personId,name:p.name,ops,fingerprint:fingerprint(cart)};
  }
  function resumePlan(cart,participants,journal){
    if(!journal||journal.status==='completed'||!Array.isArray(journal.ops)||!journal.ops.length)throw Error('Não há uma remoção pendente válida.');
    const person=participants.find(p=>p.id===journal.personId);
    if(!person)throw Error('A lista original foi excluída. Confira o registro no diagnóstico.');
    if(journal.participantText!==undefined && journal.participantText!==person.text)throw Error('A lista foi editada após a tentativa. Confira o registro antes de liberar manualmente.');
    const empty=cart.rows.length===0&&cart.totals.cards===0&&cart.totals.items===0;
    if(cart.errors.some(e=>!(empty&&e.startsWith('Nenhum input real'))))throw Error('Leitura incompleta. Não foi possível conferir a pendência.');
    const pending=[],done=[],ids=new Set();
    for(const op of journal.ops){
      if(ids.has(op.id)||!Number.isSafeInteger(op.before)||!Number.isSafeInteger(op.after)||op.after<0||op.before<=op.after||op.remove!==op.before-op.after)throw Error('Registro de remoção inválido. Confira o diagnóstico.');
      ids.add(op.id);
      const row=cart.rows.find(r=>r.id===op.id);
      if(!row&&op.after===0){done.push(op);continue;}
      if(!row||row.name!==op.name||row.lang!==op.lang||row.edition!==op.edition)throw Error(`${op.name}: o item mudou. A continuação automática foi bloqueada.`);
      if(row.qty===op.after){done.push(op);continue;}
      if(row.qty!==op.before||row.total!==op.total)throw Error(`${op.name}: quantidade ou preço diferente do registro. Confira manualmente.`);
      pending.push(op);
    }
    if(pending.length){
      const residual=pending.map(o=>`${o.remove} ${o.name}${o.lang?' ['+o.lang+']':''}`).join('\n');
      const verified=removalPlan(cart,participants.map(p=>p.id===person.id?{...p,active:true,text:residual}:p),person.id);
      if(verified.ops.length!==pending.length||pending.some(o=>!verified.ops.some(v=>v.id===o.id&&v.before===o.before&&v.after===o.after)))throw Error('As quantidades necessárias aos outros participantes mudaram. Confira a divisão.');
    }
    return {personId:person.id,name:person.name,ops:pending,alreadyDone:done,fingerprint:fingerprint(cart),recovery:true};
  }
  root.LM={norm,language,money,parse,splitCents,fingerprint,calculate,simulateFreight,removalPlan,resumePlan};
  if(typeof module!=='undefined') module.exports=root.LM;
})(globalThis);
