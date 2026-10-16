/* Offline PDF export of the reviewed PNG pages, embedded as high quality JPEG. */
(()=>{
async function build(pages){
 if(!pages.length)throw Error('Nenhuma página para exportar.');
 const encode=s=>new TextEncoder().encode(s),objects=[null,null],pageIds=[];
 const add=value=>{objects.push(value);return objects.length;};
 for(const png of pages){
  const bitmap=await createImageBitmap(png),canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0);bitmap.close();
  const jpeg=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Falha ao converter página para PDF.')),'image/jpeg',0.96));
  const data=new Uint8Array(await jpeg.arrayBuffer());
  const imgId=add([encode(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`),data,encode('\nendstream')]);
  const w=595.276,h=841.89,margin=24,scale=Math.min((w-2*margin)/canvas.width,(h-2*margin)/canvas.height),iw=canvas.width*scale,ih=canvas.height*scale;
  const stream=encode(`q\n${iw.toFixed(3)} 0 0 ${ih.toFixed(3)} ${((w-iw)/2).toFixed(3)} ${(h-margin-ih).toFixed(3)} cm\n/Im0 Do\nQ\n`);
  const contentId=add([encode(`<< /Length ${stream.length} >>\nstream\n`),stream,encode('endstream')]);
  pageIds.push(add([encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`)]));
  canvas.width=canvas.height=1;
 }
 objects[0]=[encode('<< /Type /Catalog /Pages 2 0 R >>')];objects[1]=[encode(`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] >>`)];
 const chunks=[encode('%PDF-1.4\n%LigaDivisor\n')],offsets=[0];let length=chunks[0].length;
 const push=b=>{chunks.push(b);length+=b.length;};
 objects.forEach((parts,i)=>{offsets.push(length);push(encode(`${i+1} 0 obj\n`));parts.forEach(push);push(encode('\nendobj\n'));});
 const xref=length;push(encode(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
 return new Blob(chunks,{type:'application/pdf'});
}
window.LMSharePDF={build};
})();
