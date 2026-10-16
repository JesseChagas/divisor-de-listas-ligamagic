/* Canvas rendering: local data only, no remote images or HTML rendering. */
(()=>{
const money=n=>n===null||n===undefined?'Não lido':(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function build(result,cart,personId){
 // Only the known allocation-version notice is informational in shared images.
 const imageProblems=result.imageProblems??result.problems, imageChecked=imageProblems.length===0;
 const person=personId?result.people.find(p=>p.id===personId):null;if(personId&&!person)throw Error('Participante não está ativo.');
 const title=person?person.name:'Resumo geral da compra',rows=person?person.details:result.people;
 const metric=person?`${person.qty} cartas atribuídas de ${person.requested} pedidas`:`${result.count} cartas no carrinho · ${result.people.length} participantes ativos`;
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=2200;const ctx=canvas.getContext('2d');
 const font=(size,bold=false)=>{ctx.font=`${bold?'600':'400'} ${size}px system-ui, sans-serif`;};
 const wrap=(text,width,size=25)=>{font(size);const lines=[];let line='';for(const char of String(text)){if(char==='\n'||ctx.measureText(line+char).width>width){lines.push(line);line=char==='\n'?'':char;}else line+=char;}if(line)lines.push(line);return lines.length?lines:[''];};
 const titleLines=wrap(title,1080,40),pages=[];let commands=[],y;
 const text=(s,x,yy,size=25,color='#183d32',bold=false,align='left')=>commands.push({s:String(s),x,y:yy,size,color,bold,align});
 function start(){commands=[];y=65;text('LIGA DIVISOR  /  COMPRA COMPARTILHADA',60,y,22,'#b9e4ce',true);y+=65;for(const l of titleLines){text(l,60,y,40,'#ffffff',true);y+=51;}text(metric,60,y,25,'#d7eee2');y+=43;text(new Date(cart.readAt||Date.now()).toLocaleString('pt-BR'),60,y,21,'#d7eee2');y+=45;
 const headerBottom=y;commands.push({headerBottom});y+=45;
 text(imageChecked?'CONFERIDO':'COM DIVERGÊNCIAS — valores sujeitos à conferência',60,y,24,imageChecked?'#246341':'#9c451b',true);y+=48;
 if(person){text('QTD / CARTA',60,y,20);text('UNIT. MÉDIO',925,y,20,'#183d32',false,'right');text('SUBTOTAL',1140,y,20,'#183d32',false,'right');}else{text('PARTICIPANTE / CARTAS',60,y,20);text('CARTAS',740,y,20,'#183d32',false,'right');text('FRETE',940,y,20,'#183d32',false,'right');text('TOTAL',1140,y,20,'#183d32',false,'right');}y+=32;
 }
 function finish(){pages.push({commands,height:y+65});}
 start();
 for(const row of rows){const lines=wrap(person?`${row.qty}× ${row.name}`:`${row.name} · ${row.qty} cartas`,person?690:470,26);
 const note=person?`${row.lang||'Idioma não lido'} · ${row.edition||'Edição não lida'} · ${row.quality||'Condição não lida'}`:`Base ${money(row.freightBase??row.freight)}  − desconto ${money(row.freightDiscountApplied||0)}  + rateio ${money(row.freightExtra||0)}`;
 const notes=wrap(note,1080,20),height=lines.length*35+notes.length*28+32;
 if(y+height>1800&&y>650){finish();start();}
 for(const l of lines){text(l,60,y+30,26,'#183d32',true);y+=35;}
 const yy=y-lines.length*35+30;
 if(person){const unit=row.cost/row.qty/100;text(unit.toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:row.cost%row.qty?4:2}),925,yy,24,'#183d32',false,'right');text(money(row.cost),1140,yy,26,'#183d32',true,'right');}
 else{for(const [key,x] of [['cards',740],['freight',940],['total',1140]])text(money(row[key]),x,yy,26,'#183d32',key==='total','right');}
 for(const n of notes){text(n,60,y+25,20,'#597065');y+=28;}y+=32;commands.push({line:y-10});
 }
 if(y+390>2100){finish();start();}
 y+=35;
 const sums=person?[['Cartas',person.cards],['Frete base',person.freightBase],['Desconto no frete',person.freightDiscountApplied?-person.freightDiscountApplied:0],['Acréscimo do rateio',person.freightExtra||0],['Frete final',person.freight],['TOTAL DA PESSOA',person.total]]:[['Cartas atribuídas',result.people.reduce((s,p)=>s+p.cards,0)],['Cartas sem participante',result.unassigned.reduce((s,r)=>s+r.cost,0)],['Frete total do carrinho',cart.totals.freight],['TOTAL DO CARRINHO',cart.totals.total]];
 for(const [label,value] of sums){text(label,60,y,26,'#183d32',label.startsWith('TOTAL'));text(money(value),1140,y,28,'#183d32',true,'right');y+=43;}
 y+=20;
 if(!person){for(const l of wrap(`Frete dividido entre ${result.people.filter(p=>p.qty>0).length} pessoa(s) com cartas. Rateio: ${({equal:'igual',value:'por valor das cartas',quantity:'por quantidade'})[result.shipping]||result.shipping}.`,1080,20)){text(l,60,y,20,'#597065');y+=28;}}
 const foot=person?'Somente cartas atribuídas nesta leitura. Valor unitário médio; o subtotal preserva os centavos.':imageChecked?'Valores da leitura atual do carrinho. Descontos de frete já incluídos no rateio.':'O total do carrinho pode incluir cartas ainda sem participante. Confira as divergências no painel.';
 for(const l of wrap(foot,1080,20)){text(l,60,y,20,'#597065');y+=28;}
 if(!imageChecked){text(`${imageProblems.length} divergência(s). Revise no painel antes de acertar os valores.`,60,y,20,'#9c451b');y+=30;}
 finish();
 return pages.map((page,i)=>{const out=document.createElement('canvas');out.width=1200;out.height=page.height;const c=out.getContext('2d');c.fillStyle='#f7faf6';c.fillRect(0,0,1200,out.height);const header=page.commands.find(x=>x.headerBottom).headerBottom;c.fillStyle='#153e31';c.fillRect(0,0,1200,header);
 for(const cmd of page.commands){if(cmd.s!==undefined){c.font=`${cmd.bold?'600':'400'} ${cmd.size}px system-ui, sans-serif`;c.fillStyle=cmd.color;c.textAlign=cmd.align;c.fillText(cmd.s,cmd.x,cmd.y);}if(cmd.line){c.strokeStyle='#d7e2d8';c.beginPath();c.moveTo(60,cmd.line);c.lineTo(1140,cmd.line);c.stroke();}}
 c.font='18px system-ui';c.fillStyle='#597065';c.textAlign='right';c.fillText(`Liga Divisor · ${i+1}/${pages.length}`,1140,out.height-22);return out;
 });
}
window.LMShare={build};
})();
