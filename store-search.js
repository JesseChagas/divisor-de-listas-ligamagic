'use strict';
(() => {
  const $ = id => document.getElementById(id);
  let lastResults = [];
  let pollTimer = null;
  let activeTabId = null;
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();

  function parseList(raw) {
    const map = new Map();
    for (const [i, line0] of raw.split(/\r?\n/).entries()) {
      const line = line0.trim(); if (!line || line.startsWith('#')) continue;
      const m = line.match(/^(\d+)\s*[xX×]?\s+(.+?)\s*$/);
      if (!m || Number(m[1]) < 1) throw new Error(`Linha ${i + 1} inválida: ${line}`);
      const name = m[2].trim(), key = norm(name);
      if (!key) throw new Error(`Nome inválido na linha ${i + 1}.`);
      const old = map.get(key) || { name, quantity: 0 };
      old.quantity += Number(m[1]); map.set(key, old);
    }
    if (!map.size) throw new Error('Cole pelo menos uma carta no formato “quantidade nome”.');
    return [...map.values()];
  }

  // Runs in the page's own origin so the store's normal session/cookies apply.
  async function pageController(action, cards, options = {}) {
    const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const text = el => el?.textContent?.replace(/\s+/g, ' ').trim() || '';
    // Busca no motor de e-commerce LigaMagic, sem depender de um domínio específico.
    // As lojas podem ter domínios próprios, mas compartilhar rotas e seletores.
    const isLigaMagicStore = Boolean(document.querySelector(
      '#fSearch, .breadcrumbs, .card-item .title a[href], .table-cards-row, .nomes_cards, .nome_pt_cards, .nome_en_cards'
    ));
    const key = '__extension_card_search_v1:' + location.origin;
    const getSaved = () => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
    const setSaved = state => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} };
    // Sidebar lives on the store page, so the query log remains visible after
    // the extension popup closes. Shadow DOM avoids styling collisions.
    const mountSidebar = () => {
      let host = document.getElementById('__lm_card_search_sidebar');
      let launcher = document.getElementById('__lm_card_search_launcher');
      if (!launcher) {
        launcher = document.createElement('button');
        launcher.id = '__lm_card_search_launcher';
        launcher.type = 'button';
        launcher.textContent = 'Abrir log da busca';
        Object.assign(launcher.style, { position: 'fixed', right: '12px', bottom: '12px', zIndex: '2147483647', padding: '11px 15px', border: '1px solid #52745f', borderRadius: '10px', background: '#173b2d', color: '#fff', font: '600 13px system-ui,sans-serif', cursor: 'pointer', boxShadow: '0 4px 18px rgba(0,0,0,.3)', display: 'none' });
        launcher.addEventListener('click', () => { mountSidebar(); launcher.style.display = 'none'; });
        (document.body || document.documentElement).appendChild(launcher);
      }
      if (host) { host.style.display = 'block'; launcher.style.display = 'none'; return; }
      host = document.createElement('aside'); host.id = '__lm_card_search_sidebar';
      Object.assign(host.style, { position: 'fixed', top: '0', right: '0', width: '360px', maxWidth: '92vw', height: '100vh', zIndex: '2147483647', background: '#101827', color: '#f3f6fb', boxShadow: '-8px 0 28px rgba(0,0,0,.32)', font: '13px/1.45 system-ui,sans-serif' });
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `<style>*{box-sizing:border-box}section{height:100%;display:flex;flex-direction:column}header{padding:14px 16px;background:#182438;border-bottom:1px solid #344258;display:flex;align-items:center;justify-content:space-between}h2{font-size:15px;margin:0}button{border:1px solid #53647c;border-radius:7px;background:#25344a;color:#fff;padding:5px 9px;cursor:pointer}#summary{padding:12px 16px;border-bottom:1px solid #344258;color:#cbd5e1}#log{padding:12px 16px;overflow:auto;flex:1;white-space:normal}.entry{padding:8px 0;border-bottom:1px solid #29374b;overflow-wrap:anywhere}.time{color:#91a4bd;font-size:11px}.ok{color:#86efac}.warn{color:#fcd34d}.error{color:#fca5a5}footer{padding:10px 16px;border-top:1px solid #344258;color:#9fb0c7;font-size:11px}#add-cart{display:none;width:100%;margin:0 0 8px;padding:10px;background:#176b45;border-color:#3b9b70;font-weight:700}#add-cart:disabled{opacity:.55;cursor:wait}.modal-backdrop{position:fixed;inset:0;background:#000b;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:18px}.modal{width:min(680px,96vw);max-height:85vh;overflow:auto;background:#111c2c;border:1px solid #52627a;border-radius:12px;padding:18px;box-shadow:0 20px 60px #0009}.modal h3{margin:0 0 8px;font-size:17px}.modal p{color:#cbd5e1}.cards{display:flex;flex-direction:column;gap:8px}.card-link{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px;border:1px solid #344258;border-radius:8px;color:#f3f6fb;text-decoration:none}.card-link:hover{background:#223149}.card-link small{display:block;color:#b8c5d8}.modal-actions{display:flex;justify-content:flex-end;margin-top:14px}</style><section><header><h2>Consulta de cartas · Log</h2><button id="hide" title="Recolher barra lateral">—</button></header><div id="summary">Aguardando consulta…</div><div id="log" aria-live="polite"></div><footer><button id="add-cart" type="button">Adicionar disponíveis ao carrinho</button><div id="cart-note">Consulta somente leitura · Esta barra pode ser recolhida e reaberta pela extensão.</div></footer></section>`;
      shadow.getElementById('hide').addEventListener('click', () => { host.style.display = 'none'; launcher.style.display = 'block'; });
      shadow.getElementById('add-cart').textContent = 'Ver links das cartas disponíveis';
      shadow.getElementById('add-cart').addEventListener('click', () => {
        const st = getSaved();
        if (!st || st.running || !(Number(st.total) > 0)) { alert('Aguarde a busca terminar para abrir os links das cartas disponíveis.'); return; }
        const candidates = [];
        for (const card of (st.cards || [])) {
          const matches = (st.results || []).filter(r => norm(r.name) === norm(card.name) && r.found && Number(r.stock) > 0 && (r.href || r.url));
          for (const match of matches) candidates.push({ ...match, requestedQuantity: Number(card.quantity) || 1 });
        }
        const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop'; Object.assign(backdrop.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.78)', zIndex: '2147483647', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '18px' });
        const modal = document.createElement('div'); modal.className = 'modal'; Object.assign(modal.style, { boxSizing: 'border-box', width: 'min(680px, 96vw)', maxHeight: '85vh', overflow: 'auto', background: '#111c2c', color: '#f3f6fb', border: '1px solid #52627a', borderRadius: '12px', padding: '18px', boxShadow: '0 20px 60px rgba(0,0,0,.6)', font: '14px/1.45 system-ui,sans-serif' }); modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
        const title = document.createElement('h3'); title.textContent = `Cartas disponíveis (${candidates.length})`; Object.assign(title.style, { margin: '0 0 8px', fontSize: '17px' });
        const intro = document.createElement('p'); intro.textContent = 'Abra cada produto e adicione a quantidade desejada usando o botão da própria loja. A extensão não altera o carrinho.'; Object.assign(intro.style, { color: '#cbd5e1' });
        const list = document.createElement('div'); list.className = 'cards'; Object.assign(list.style, { display: 'flex', flexDirection: 'column', gap: '8px' });
        if (!candidates.length) { const empty = document.createElement('p'); empty.textContent = 'Nenhuma carta com correspondência exata e estoque foi encontrada.'; list.appendChild(empty); }
        candidates.forEach(item => {
          const a = document.createElement('a'); a.className = 'card-link'; Object.assign(a.style, { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', padding: '10px', border: '1px solid #344258', borderRadius: '8px', color: '#f3f6fb', textDecoration: 'none' }); a.href = new URL(item.href || item.url, location.href).href; a.target = '_blank'; a.rel = 'noopener noreferrer';
          const info = document.createElement('span'); const name = document.createElement('strong'); name.textContent = item.name;
          const detail = document.createElement('small'); Object.assign(detail.style, { display: 'block', color: '#b8c5d8' }); detail.textContent = `Solicitada: ${item.requestedQuantity} · Estoque: ${item.stock}${item.price == null ? '' : ` · R$ ${Number(item.price).toFixed(2).replace('.', ',')}`}`;
          info.append(name, detail); const open = document.createElement('span'); open.textContent = 'Abrir ↗'; a.append(info, open); list.appendChild(a);
        });
        const actions = document.createElement('div'); actions.className = 'modal-actions'; Object.assign(actions.style, { display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }); const close = document.createElement('button'); close.textContent = 'Fechar'; Object.assign(close.style, { border: '1px solid #53647c', borderRadius: '7px', background: '#25344a', color: '#fff', padding: '7px 12px', cursor: 'pointer' }); close.addEventListener('click', () => backdrop.remove()); actions.appendChild(close);
        modal.append(title, intro, list, actions); backdrop.appendChild(modal); backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); }); (document.body || document.documentElement).appendChild(backdrop); close.focus();
      });
      (document.body || document.documentElement).appendChild(host);
      let lastMessage = '', seen = new Set(), seenLogs = new Set();
      const addLog = (message, cls = '') => { const row = document.createElement('div'); row.className = 'entry ' + cls; const tm = document.createElement('div'); tm.className = 'time'; tm.textContent = new Date().toLocaleTimeString(); const body = document.createElement('div'); body.textContent = message; row.append(tm, body); shadow.getElementById('log').appendChild(row); shadow.getElementById('log').scrollTop = shadow.getElementById('log').scrollHeight; };
      const refresh = () => {
        const st = getSaved(); if (!st) return;
        shadow.getElementById('summary').textContent = `${st.running ? 'Em andamento' : st.message || 'Consulta'} · ${st.done || 0}/${st.total || 0} cartas`;
        const cartButton = shadow.getElementById('add-cart');
        if (cartButton) cartButton.style.display = (!st.running && Number(st.total) > 0) ? 'block' : 'none';
        const cartNote = shadow.getElementById('cart-note');
        if (cartNote && st.cartAddStatus) cartNote.textContent = st.cartAddStatus;
        if (st.message && st.message !== lastMessage) { lastMessage = st.message; addLog(st.message, /interrompida|erro|verificação/i.test(st.message) ? 'error' : /pausad|não encontrada/i.test(st.message) ? 'warn' : ''); }
        for (const entry of (st.logs || [])) { const k = `${entry.at}|${entry.message}`; if (seenLogs.has(k)) continue; seenLogs.add(k); addLog(entry.message, entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : ''); }
        for (const item of (st.results || [])) { const k = `${item.name}|${item.href || item.url || ''}|${item.found}`; if (seen.has(k)) continue; seen.add(k); addLog(`${item.found ? 'Encontrada' : 'Não encontrada'}: ${item.name}${item.price == null ? '' : ` · R$ ${Number(item.price).toFixed(2).replace('.', ',')}`}${item.stockStatus ? ` · ${item.stockStatus}` : ''}${item.url || item.href ? ` · ${item.url || item.href}` : ''}`, item.found ? 'ok' : 'warn'); }
        if (!st.running) clearInterval(timer);
      };
      const timer = setInterval(refresh, 1000); refresh();
    };

    if (action === 'start' || action === 'status') mountSidebar();
    if (action === 'status') return getSaved() || { running: false, done: 0, total: 0, results: [], message: 'Nenhuma busca salva.' };
    if (action === 'pause') { const s = getSaved(); if (s) { s.pauseRequested = true; s.message = 'Pausa solicitada…'; setSaved(s); } return s || { running: false, message: 'Nenhuma busca ativa.' }; }
    if (action === 'clear') { localStorage.removeItem(key); return { running: false, done: 0, total: 0, results: [], message: 'Progresso apagado.' }; }
    if (action === 'addToCart') { const st = getSaved(); return { ...(st || {}), message: 'Use o botão de links na barra lateral para abrir os produtos disponíveis.' }; }

    async function addAvailableToCart(st) {
      const candidates = [];
      for (const card of (st.cards || [])) {
        const matches = (st.results || []).filter(r => norm(r.name) === norm(card.name) && r.found && Number(r.stock) > 0 && r.productId && r.href && new URL(r.href, location.href).origin === location.origin);
        const chosen = matches.slice(0, 5).find(r => Number(r.stock) > 0);
        if (chosen) candidates.push({ ...chosen, addQuantity: Math.min(Number(card.quantity) || 1, Number(chosen.stock)) });
      }
      if (!candidates.length) { st.cartAddStatus = 'Nenhuma versão exata com estoque e botão de compra identificado.'; st.message = st.cartAddStatus; setSaved(st); return st; }
      const log = message => { st.logs = st.logs || []; st.logs.push({ at: new Date().toISOString(), level: 'info', message }); if (st.logs.length > 250) st.logs = st.logs.slice(-250); setSaved(st); };
      let added = 0;
      for (const item of candidates) {
        if (st.cartAddedIds?.includes(String(item.productId))) { log(`Ignorada para evitar duplicidade: ${item.name} (produto ${item.productId}).`); continue; }
        log(`Preparando inclusão de ${item.addQuantity}x ${item.name} (produto ${item.productId}).`);
        try {
          const frame = document.createElement('iframe');
          frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:-10000px;border:0';
          // Register handlers BEFORE navigation: otherwise a fast load can be missed,
          // making every product appear to time out and yielding 0/N.
          const loaded = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('tempo esgotado ao abrir produto')), 25000);
            frame.onload = () => { clearTimeout(timeout); resolve(); };
            frame.onerror = () => { clearTimeout(timeout); reject(new Error('falha ao abrir produto')); };
          });
          document.body.appendChild(frame);
          frame.src = item.href;
          await loaded;
          const doc = frame.contentDocument;
          const button = doc?.querySelector(`#bt_comprar_${CSS.escape(String(item.productId))},[name="bt_comprar_${String(item.productId)}"]`);
          const fn = frame.contentWindow?.item_comprar;
          if (!doc || !button || typeof fn !== 'function') throw new Error('a página do produto não expôs o botão/função nativa de compra no quadro oculto; nenhum sucesso foi contado');
          // Use the store's native purchase function with the quantity capped at stock.
          fn.call(frame.contentWindow, String(item.addQuantity), String(item.productId));
          await new Promise(resolve => setTimeout(resolve, 1800));
          st.cartAddedIds = st.cartAddedIds || [];
          if (!st.cartAddedIds.includes(String(item.productId))) st.cartAddedIds.push(String(item.productId));
          added++;
          log(`Solicitada inclusão: ${item.addQuantity}x ${item.name}, produto ${item.productId}. Confirme no carrinho da loja.`);
          frame.remove();
        } catch (e) {
          log(`Falha ao adicionar ${item.name}: ${e.message || e}. Não foi contado como adicionado; abra o produto e tente pelo botão da loja.`);
        }
      }
      const failed = candidates.length - added;
      st.cartAddStatus = added
        ? `Inclusão solicitada para ${added}/${candidates.length} cartas${failed ? `; ${failed} falharam` : ''}. Confira o carrinho da loja antes de finalizar a compra.`
        : `Falha ao adicionar 0/${candidates.length} cartas. Veja os detalhes no log e confira o carrinho da loja; nenhuma inclusão foi confirmada pela extensão.`;
      st.message = st.cartAddStatus; setSaved(st); return st;
    }

    if (action === 'start' && isLigaMagicStore) {
      const signature = JSON.stringify(cards.map(c => ({ name: c.name, quantity: c.quantity })));
      let state = getSaved();
      if (!state || state.signature !== signature || action === 'restart') {
        state = { signature, cards, results: [], completed: [], logs: [], running: false, pauseRequested: false, done: 0, total: cards.length, startedAt: new Date().toISOString(), message: 'Preparando busca automática…' };
      }
      if (state.running && window.__extensionCardSearchTask) return { ...state, message: 'Já existe uma busca em andamento nesta aba.' };
      // If the page was reloaded during a previous run, resume from the last saved card.
      state.running = false; state.cards = cards; state.pauseRequested = false; state.running = true; state.message = 'Busca iniciada'; state.done = state.completed.length; state.total = cards.length; state.logs = state.logs || []; state.delaySeconds = Math.max(8, Math.min(60, Number(options.delaySeconds) || 12)); state.autoAddToCart = Boolean(options.autoAddToCart); state.cartAddStatus = ''; state.logs.push({ at: new Date().toISOString(), level: 'info', message: `Busca iniciada. Intervalo configurado: ${state.delaySeconds}s.` }); setSaved(state);
      // Detach the long-running work from the popup request. The page stores progress after each card.
      window.__extensionCardSearchTask = (async () => {
        let lastRequest = 0;
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const persist = () => setSaved(state);
        const log = (level, message) => { state.logs = state.logs || []; state.logs.push({ at: new Date().toISOString(), level, message }); if (state.logs.length > 250) state.logs = state.logs.slice(-250); persist(); };
        const request = async url => {
          const delay = state.delaySeconds * 1000;
          await wait(Math.max(0, delay - (Date.now() - lastRequest)));
          if (state.pauseRequested) throw new Error('Busca pausada pelo usuário.');
          lastRequest = Date.now();
          const began = Date.now();
          log('info', `Consultando ${url}`);
          let response;
          try { response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' }); }
          catch (e) { log('error', `Falha de rede em ${url}: ${e?.message || e}`); throw new Error(`Falha de rede ao consultar ${new URL(url).pathname}: ${e?.message || 'sem detalhes'}`); }
          log(response.ok ? 'info' : 'error', `HTTP ${response.status} (${Date.now() - began} ms) · ${url}`);
          if (!response.ok) throw new Error('A loja respondeu HTTP ' + response.status + ' em ' + new URL(url).pathname + '.');
          if (new URL(response.url).origin !== location.origin) throw new Error('Redirecionamento para outra origem bloqueado.');
          const html = await response.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const head = norm(text(doc.querySelector('title')) + ' ' + text(doc.querySelector('h1')));
          if (doc.querySelector('#challenge-running, #challenge-stage, form#challenge-form') || /just a moment|um momento|verificacao de seguranca|verify you are human|checking your browser/.test(head)) throw new Error('A loja solicitou verificação de segurança. Confira o site manualmente.');
          return { doc, url: response.url };
        };
        const cleanCell = el => { const clone = el.cloneNode(true); clone.querySelectorAll('.title-mobile, .tooltip, script, style').forEach(n => n.remove()); return text(clone); };
        const metadata = el => {
          const vals = [cleanCell(el), ...[...el.querySelectorAll('.tooltip')].map(text)];
          for (const node of [el, ...el.querySelectorAll('[title], [alt], [data-original-title], [aria-label]')]) for (const attr of ['title','alt','data-original-title','aria-label']) { const v = node.getAttribute(attr)?.trim(); if (v) vals.push(v); }
          return [...new Set(vals.filter(Boolean))].join(' | ');
        };
        const parseProduct = (doc, url, card) => {
          const pt = text(doc.querySelector('.nome_pt_cards')), en = text(doc.querySelector('.nome_en_cards'));
          if (!pt && !en) return [];
          if (![pt, en].some(n => norm(n) === norm(card.name))) return [];
          const rows = [...doc.querySelectorAll('.table-cards-row')];
          return rows.map(row => {
            const cells = [...row.children].filter(el => el.classList.contains('table-cards-body-cell'));
            if (cells.length < 6) return null;
            const stockMatch = cleanCell(cells[4]).match(/(\d[\d.]*)\s*unid/i);
            const priceMatch = cleanCell(cells[5]).match(/R\$\s*([\d.]+,\d{2})/);
            const stock = stockMatch ? Number(stockMatch[1].replace(/\./g, '')) : null;
            const price = priceMatch ? Number(priceMatch[1].replace(/\./g, '').replace(',', '.')) : null;
            const buy = row.querySelector('[onclick*="item_comprar("]');
            const call = (buy?.getAttribute('onclick') || '').match(/item_comprar\(\s*[\'\"](\d+)[\'\"]\s*,\s*[\'\"](\d+)[\'\"]\s*\)/);
            const purchaseType = call?.[1] || '';
            const purchaseId = call?.[2] || '';
            const productId = purchaseId || (buy?.id || buy?.name || '').match(/bt_comprar_(\d+)/)?.[1] || '';
            return { name: card.name, quantity: card.quantity, found: true, namePt: pt, nameEn: en, edition: metadata(cells[0]) || 'Não informado', language: metadata(cells[1]) || 'Não informado', condition: metadata(cells[2]) || 'Não informado', extras: metadata(cells[3]) || 'Não informado', stock, price, productId, purchaseType, purchaseId, stockStatus: stock === null ? 'Estoque não informado' : stock > 0 ? 'Disponível' : 'Sem estoque', enough: stock === null ? null : stock >= card.quantity, href: url, url };
          }).filter(Boolean);
        };
        const searchTerm = async (term, card) => {
          const start = new URL('/', location.origin);
          start.search = new URLSearchParams({ view: 'ecom/itens', busca: term }).toString();
          // Nunca percorre a paginação inteira: algumas lojas retornam milhares de
          // resultados para termos curtos (por exemplo, "Foil"). Inspeciona no
          // máximo cinco páginas e abre somente produtos cujo título é exato.
          const queue = [start.href], visitedPages = new Set(), visitedProducts = new Set(), outputs = [];
          const canonical = value => {
            const u = new URL(value, location.href);
            u.hash = '';
            return u.href;
          };
          while (queue.length && visitedPages.size < 5 && visitedProducts.size < 5) {
            if (state.pauseRequested) throw new Error('Busca pausada pelo usuário.');
            const url = canonical(queue.shift());
            if (visitedPages.has(url)) continue;
            visitedPages.add(url);
            const { doc, url: finalUrl } = await request(url);
            if (doc.querySelector('.nomes_cards')) {
              outputs.push(...parseProduct(doc, finalUrl, card));
              continue;
            }
            if (!doc.querySelector('.breadcrumbs') || !doc.querySelector('#fSearch')) throw new Error('A página de busca não foi reconhecida como e-commerce LigaMagic compatível; a busca foi interrompida com segurança.');
            const products = new Set();
            for (const a of doc.querySelectorAll('.card-item .title a[href]')) {
              const label = text(a);
              // A busca da loja é por substring. Filtramos pelo nome exato antes
              // de consultar o detalhe, mantendo variações de edição/idioma.
              if (norm(label) !== norm(card.name) && norm(label) !== norm(term)) continue;
              const href = new URL(a.getAttribute('href'), finalUrl);
              if (href.origin === location.origin && href.searchParams.get('view') === 'ecom/item') products.add(canonical(href.href));
            }
            for (const href of products) {
              if (visitedProducts.has(href) || visitedProducts.size >= 5) continue;
              visitedProducts.add(href);
              const product = await request(href);
              outputs.push(...parseProduct(product.doc, product.url, card));
            }
            // Se já achou cinco versões exatas, não precisa consultar mais páginas.
            if (visitedProducts.size >= 5) break;
            for (const a of doc.querySelectorAll('a.ecomresp-paginacao[href]')) {
              const href = new URL(a.getAttribute('href'), finalUrl);
              const view = href.searchParams.get('view');
              if (href.origin !== location.origin || view !== 'ecom/itens') continue;
              const pageNum = Number(href.searchParams.get('page') || 1);
              if (!Number.isFinite(pageNum) || pageNum < 1 || pageNum > 5) continue;
              const normalizedHref = canonical(href.href);
              if (!visitedPages.has(normalizedHref) && !queue.includes(normalizedHref)) queue.push(normalizedHref);
            }
          }
          return outputs;
        };
        try {
          for (const card of state.cards) {
            if (state.completed.includes(norm(card.name))) continue;
            if (state.pauseRequested) break;
            state.message = `Buscando ${card.name}…`; state.done = state.completed.length; persist();
            let results = await searchTerm(card.name, card);
            if (!results.length && card.name.includes('//')) results = await searchTerm(card.name.split('//')[0].trim(), card);
            // Algumas lojas indexam pelo nome impresso em português. Tentar Scryfall
            // como fallback opcional, sem impedir a consulta caso a API falhe.
            if (!results.length) {
              try {
                const front = card.name.split('//')[0].trim();
                const response = await fetch(
                  'https://api.scryfall.com/cards/search?q=' +
                  encodeURIComponent(`!"${front}" lang:pt`),
                  { signal: AbortSignal.timeout(15000) }
                );
                if (response.ok) {
                  const data = await response.json();
                  const printed = data?.data?.[0]?.printed_name;
                  if (printed && norm(printed) !== norm(card.name)) results = await searchTerm(printed, card);
                }
              } catch (_) { /* API opcional. */ }
            }
            state.results = state.results.filter(r => norm(r.name) !== norm(card.name));
            state.results.push(...(results.length ? results : [{ name: card.name, quantity: card.quantity, found: false, stockStatus: 'Não encontrada por correspondência exata', stock: null, price: null, href: '', url: '', note: 'A busca do site não retornou uma correspondência exata; isso não prova ausência de estoque.' }]));
            state.completed.push(norm(card.name)); state.done = state.completed.length; state.message = `Concluídas ${state.done}/${state.total}`; persist();
          }
          state.running = false;
          state.message = state.completed.length === state.total ? 'Busca concluída.' : state.pauseRequested ? 'Busca pausada. Use Buscar no site para continuar.' : 'Busca interrompida antes de concluir.';
          persist();
          if (state.autoAddToCart) { state.autoAddToCart = false; state.logs.push({ at: new Date().toISOString(), level: 'info', message: 'Inclusão automática desativada: use o modal de links para abrir os produtos manualmente.' }); persist(); }
        } catch (err) {
          state.running = false;
          const reason = err?.message || String(err);
          state.message = (state.pauseRequested ? 'Busca pausada. ' : 'Busca interrompida: ') + reason;
          if (/HTTP 403/i.test(reason)) { state.message += ' O progresso foi salvo. A loja recusou a requisição; confira o log, aguarde e retome somente quando o site voltar a permitir acesso.'; state.logs = state.logs || []; state.logs.push({ at: new Date().toISOString(), level: 'error', message: `Bloqueio HTTP 403. Última URL consultada: ${(state.logs.filter(x => x.message.startsWith('HTTP ') || x.message.startsWith('Consultando ')).slice(-1)[0] || {}).message || 'não registrada'}` }); } else { state.logs = state.logs || []; state.logs.push({ at: new Date().toISOString(), level: 'error', message: reason }); }
        }
        persist();
        window.__extensionCardSearchTask = null;
      })();
      return state;
    }

    // Other stores: a safe, read-only scan of the currently open page.
    const entries = [...document.querySelectorAll('a[href]')].map(a => {
      const anchorText = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim();
      const href = a.href; if (!anchorText || !href || !/^https?:/.test(href) || new URL(href).origin !== location.origin) return null;
      const parent = a.closest('[itemtype*="Product"], .product, .produto, .product-item, .product-card, .card, li') || a.parentElement;
      const block = (parent?.innerText || anchorText).replace(/\s+/g, ' ').trim().slice(0, 1500);
      const priceMatch = block.match(/R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})|R\$\s*\d+(?:,\d{2})/i);
      const stockMatch = block.match(/\b(esgotad[oa]s?|indispon[ií]vel|sem estoque|em estoque|dispon[ií]vel|pronta entrega)\b/i);
      return { text: anchorText, href, block, price: priceMatch?.[0] || '', stock: stockMatch?.[0] || '' };
    }).filter(Boolean);
    return { title: document.title, url: location.href, host: location.hostname, results: cards.map(card => {
      const k = norm(card.name); const matches = entries.filter(e => norm(e.text) === k || norm(e.text).includes(k) || norm(e.block).includes(k));
      return { ...card, found: matches.length > 0, matches: [...new Map(matches.map(e => [e.href, e])).values()].slice(0, 8) };
    }) };
  }

  function render(data) {
    const root = $('storeResults'); root.replaceChildren();
    if (data && Array.isArray(data.cards) && Array.isArray(data.results) && !data.host) {
      lastResults = data.results.map(r => ({ name: r.name, quantity: r.quantity, found: r.found, matches: r.found ? [{ href: r.href || r.url, text: [r.namePt, r.nameEn].filter(Boolean).join(' / '), price: r.price == null ? '' : `R$ ${r.price.toFixed(2).replace('.', ',')}`, stock: r.stockStatus || '', edition: r.edition, language: r.language, condition: r.condition, extras: r.extras, stockValue: r.stock }] : [] }));
      for (const r of data.results) {
        const row = document.createElement('div'); row.className = 'store-result'; const left = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = `${r.quantity}× ${r.name}`; left.append(title);
        if (r.found) {
          const a = document.createElement('a'); a.href = r.href || r.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = [r.namePt, r.nameEn].filter(Boolean).join(' / ') || r.name; left.append(a);
          const small = document.createElement('small'); small.textContent = [r.edition, r.language, r.condition, r.stockStatus, r.stock == null ? '' : `${r.stock} unid.`, r.price == null ? '' : `R$ ${r.price.toFixed(2).replace('.', ',')}`, r.enough === null ? '' : r.enough ? 'Quantidade suficiente' : 'Estoque insuficiente'].filter(Boolean).join(' · '); left.append(small);
        } else { const small = document.createElement('small'); small.textContent = r.note || 'Não encontrada por nome exato. Isso não confirma ausência no estoque.'; left.append(small); }
        const badge = document.createElement('span'); badge.className = r.found ? 'store-status-found' : 'store-status-missing'; badge.textContent = r.found ? 'Encontrada' : 'Não encontrada'; row.append(left, badge); root.append(row);
      }
      $('storeStatus').textContent = `${data.message || 'Busca'} · ${data.done || 0}/${data.total || data.cards.length} cartas processadas${data.running ? ' · em andamento' : ''}${data.cartAddStatus ? ' · ' + data.cartAddStatus : ''}`;
      if ($('storeAddCart')) $('storeAddCart').hidden = Boolean(data.running || !data.completed || data.completed.length !== data.total || data.autoAddToCart || data.cartAddStatus);
      $('storePause').disabled = !data.running; $('storeExport').disabled = !lastResults.length; return;
    }
    lastResults = data.results.map(item => ({ name: item.name, quantity: item.quantity, found: item.found, matches: item.matches || [] }));
    $('storeStatus').textContent = `Site: ${data.host} · ${data.results.filter(x => x.found).length}/${data.results.length} cartas identificadas na página atual. Se a loja usa o e-commerce LigaMagic, abra uma página da loja e tente novamente; layouts personalizados podem exigir adaptação.`;
    for (const item of data.results) {
      const row = document.createElement('div'); row.className = 'store-result'; const left = document.createElement('div'); const title = document.createElement('strong'); title.textContent = `${item.quantity}× ${item.name}`; left.append(title);
      if (item.found) item.matches.forEach(m => { const a = document.createElement('a'); a.href = m.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = m.text; left.append(a); const small = document.createElement('small'); small.textContent = [m.price, m.stock].filter(Boolean).join(' · ') || 'Produto identificado; preço/estoque não reconhecido'; left.append(small); });
      else { const small = document.createElement('small'); small.textContent = 'Não identificada na página atual (isso não confirma ausência no estoque).'; left.append(small); }
      const badge = document.createElement('span'); badge.className = item.found ? 'store-status-found' : 'store-status-missing'; badge.textContent = item.found ? 'Encontrada' : 'Não vista'; row.append(left, badge); root.append(row);
    }
    $('storePause').disabled = true; $('storeExport').disabled = !lastResults.length;
  }

  // Persist the search form independently of the popup lifetime. Closing the
  // extension popup must not clear the pasted list or the chosen options.
  const SEARCH_FORM_KEY = 'lmStoreSearchFormV1';
  async function restoreSearchForm() {
    try {
      const saved = (await chrome.storage.local.get(SEARCH_FORM_KEY))[SEARCH_FORM_KEY];
      if (!saved) return;
      if ($('storeList') && typeof saved.list === 'string') $('storeList').value = saved.list;
      if ($('storeDelay') && Number.isFinite(Number(saved.delaySeconds))) $('storeDelay').value = String(saved.delaySeconds);
      if ($('storeAutoCart')) $('storeAutoCart').checked = Boolean(saved.autoAddToCart);
    } catch (_) { /* Extension storage may be unavailable in restricted contexts. */ }
  }
  let saveFormTimer = null;
  const saveSearchForm = () => {
    clearTimeout(saveFormTimer);
    saveFormTimer = setTimeout(() => {
      chrome.storage.local.set({ [SEARCH_FORM_KEY]: {
        list: $('storeList')?.value || '',
        delaySeconds: Number($('storeDelay')?.value || 12),
        autoAddToCart: false,
        savedAt: new Date().toISOString()
      } }).catch(() => {});
    }, 200);
  };
  ['storeList', 'storeDelay', 'storeAutoCart'].forEach(id => {
    $(id)?.addEventListener('input', saveSearchForm);
    $(id)?.addEventListener('change', saveSearchForm);
  });
  restoreSearchForm();

  // Lists are managed by the main extension panel and stored in its shared state.
  // Populate the selector from the saved participants; selecting one copies its text
  // into the search box without changing or overwriting the saved list itself.
  async function refreshSavedLists() {
    const select = $('savedStoreList');
    if (!select) return;
    const previous = select.value;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'STATE' });
      const participants = response?.state?.participants || [];
      select.replaceChildren(new Option('— Escolha uma lista salva —', ''));
      for (const person of participants) {
        const option = new Option(`${person.name}${person.active === false ? ' (inativa)' : ''}`, person.id);
        select.add(option);
      }
      if (participants.some(person => person.id === previous)) select.value = previous;
      if (!participants.length) select.add(new Option('Nenhuma lista salva — use Participantes para criar uma', ''));
    } catch (_) {
      select.replaceChildren(new Option('Não foi possível carregar as listas salvas', ''));
    }
  }
  $('savedStoreList')?.addEventListener('change', async () => {
    const id = $('savedStoreList').value;
    if (!id) return;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'STATE' });
      const person = (response?.state?.participants || []).find(item => item.id === id);
      if (!person) throw new Error('A lista salva não foi encontrada. Atualize a seleção.');
      $('storeList').value = person.text || '';
      saveSearchForm();
      $('storeStatus').textContent = `Lista “${person.name}” carregada. Clique em Buscar no site para pesquisar.`;
    } catch (error) {
      $('storeStatus').textContent = error.message || 'Não foi possível carregar a lista salva.';
    }
  });
  refreshSavedLists();
  chrome.storage?.onChanged?.addListener(changes => {
    if (changes.state || changes.lmState || changes.appState) refreshSavedLists();
  });

  async function execute(action, cards, options) {
    let tab;
    if (activeTabId != null && ['status', 'pause'].includes(action)) { try { tab = await chrome.tabs.get(activeTabId); } catch { activeTabId = null; } }
    if (!tab) { const tabs = await chrome.tabs.query({ active: true, currentWindow: true }); tab = tabs[0]; }
    if (!tab?.id || !/^https?:/.test(tab.url || '')) throw new Error('Abra primeiro a página HTTPS da loja que deseja analisar.');
    activeTabId = tab.id;
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageController, args: [action, cards || [], options || {}] });
    return result;
  }
  async function poll() {
    if (activeTabId == null) return;
    try { const data = await execute('status'); render(data); if (data.running) pollTimer = setTimeout(poll, 2000); else pollTimer = null; }
    catch (e) { $('storeStatus').textContent = e.message || 'Não foi possível ler o progresso.'; pollTimer = null; }
  }
  $('storeScan').addEventListener('click', async () => {
    $('storeScan').disabled = true; $('storeStatus').textContent = 'Preparando busca…';
    try {
      const cards = parseList($('storeList').value); const delaySeconds = Number($('storeDelay')?.value || 12); if (!Number.isFinite(delaySeconds) || delaySeconds < 8 || delaySeconds > 60) throw new Error('O intervalo deve ser entre 8 e 60 segundos.'); const data = await execute('start', cards, { delaySeconds, autoAddToCart: false }); render(data);
      if (data.running) { if (pollTimer) clearTimeout(pollTimer); pollTimer = setTimeout(poll, 1000); }
      else if (data.host) render(data);
      else if (!data.message?.includes('concluída')) poll();
    } catch (e) { $('storeStatus').textContent = e.message || 'Não foi possível iniciar a busca.'; }
    finally { $('storeScan').disabled = false; }
  });
  $('storeAddCart')?.addEventListener('click', async () => { $('storeStatus').textContent = 'Abra a barra lateral da página da loja para ver o modal com os links disponíveis.'; try { await execute('status'); } catch {} });

  $('storeOpenLog')?.addEventListener('click', async () => {
    try {
      const data = await execute('status');
      render(data);
      $('storeStatus').textContent = data.running
        ? 'Busca em andamento. O log foi reaberto na página da loja.'
        : (data.message || 'Log aberto; nenhuma busca está em andamento.');
    } catch (e) {
      $('storeStatus').textContent = e.message || 'Não foi possível abrir o log.';
    }
  });
  $('storePause').addEventListener('click', async () => {
    $('storePause').disabled = true;
    try { const data = await execute('pause'); render(data); if (pollTimer) clearTimeout(pollTimer); pollTimer = setTimeout(poll, 1000); }
    catch (e) { $('storeStatus').textContent = e.message || 'Não foi possível pausar.'; }
  });
  $('storeExport').addEventListener('click', () => {
    const rows = [['Carta','Quantidade','Encontrada','Preço','Estoque/status','Edição','Idioma','Condição','Extras','URL']];
    for (const r of lastResults) {
      if (!r.matches.length) rows.push([r.name,r.quantity,'Não','','','','','','','']);
      else for (const m of r.matches) rows.push([r.name,r.quantity,'Sim',m.price || '',m.stock || '',m.edition || '',m.language || '',m.condition || '',m.extras || '',m.href || '']);
    }
    const csv = rows.map(row => row.map(v => '"' + String(v ?? '').replace(/"/g,'""') + '"').join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'consulta-cartas-loja.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
})();
