let simulationResult;
function updateSimulation(){
 $('simulationRows').replaceChildren();
 try{
  const raw=$('simulationCount').value;if(!/^\d+$/.test(raw))throw Error('Informe uma quantidade inteira de pessoas.');
  const preview=LM.simulateFreight(simulationResult,Number(raw));
  $('simulationSummary').textContent=`Frete total: ${brl(preview.total)} · ${preview.currentCount} pessoa(s) atual(is) + ${preview.added} adicional(is) = ${preview.totalPeople} no total.`+(preview.problems.length?'\n'+preview.problems.join('\n'):'');
  const table=el('table'),caption=el('caption','Valores simulados — os centavos e os descontos já estão distribuídos.');table.append(caption);
  const head=el('thead'),tr=el('tr');for(const h of ['Pessoa','Frete atual','Frete simulado','Total com cartas atuais'])tr.append(el('th',h));head.append(tr);table.append(head);const body=el('tbody');
  for(const p of preview.people){const row=el('tr'),old=simulationResult.people.find(x=>x.id===p.id&&!p.simulated);for(const v of [p.name,old?brl(old.freight):'—',brl(p.freight),p.simulated?'Cartas não informadas':brl(p.total)])row.append(el('td',v));body.append(row);}table.append(body);$('simulationRows').append(table);
 }catch(e){$('simulationSummary').textContent=e.message;}
}
$('simulateFreight').onclick=()=>run(async()=>{
 await recalc();if(state.shipping!=='equal')throw Error('Selecione o rateio igual para simular.');simulationResult=structuredClone(result);const count=result.people.filter(p=>p.qty>0).length;
 LM.simulateFreight(simulationResult,count+1);$('simulationCount').min=String(count);$('simulationCount').value=String(count+1);updateSimulation();$('freightSimulator').showModal();
});
$('simulationCount').oninput=updateSimulation;
$('simulationClose').onclick=()=>$('freightSimulator').close();
$('freightSimulator').addEventListener('close',()=>{simulationResult=null;$('simulationRows').replaceChildren();});
