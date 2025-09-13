// Minimal Postman-like API docs that uses /api/docs/json
(function(){
  const el = (id) => document.getElementById(id);
  const nav = el('navList');
  const paramsList = el('paramsList');
  const pathInput = el('pathInput');
  const bodyInput = el('bodyInput');
  const respOutput = el('respOutput');
  const methodBadge = el('methodBadge');
  const tokenInput = el('tokenInput');
  const baseUrlInput = el('baseUrlInput');

  // Persisted project config
  tokenInput.value = localStorage.getItem('project_token') || localStorage.getItem('bearerToken') || '';
  baseUrlInput.value = (localStorage.getItem('project_base_url') || '').replace(/\/$/, '');
  el('saveToken').onclick = () => { localStorage.setItem('project_token', tokenInput.value); toast('Token saved'); };
  el('saveBaseUrl').onclick = () => { localStorage.setItem('project_base_url', baseUrlInput.value); toast('Base URL saved'); };

  const buildUrl = (p) => {
    const b = baseUrlInput.value || '';
    if (!b) return p;
    const path = p.startsWith('/') ? p : '/' + p;
    return b + path;
  };
  const authHeaders = () => tokenInput.value ? { 'Authorization': 'Bearer ' + tokenInput.value } : {};

  let docs = { auth:null, models:[] };
  let current = { model:null, method:'GET', endpoint:'', fields:[] };

  const methodOrder = ['GET','GET_ID','POST','PUT','DELETE'];
  const methodLabel = {
    GET: 'GET', GET_ID: 'GET', POST: 'POST', PUT: 'PUT', DELETE: 'DELETE'
  };
  const methodColorClass = (m) => m==='GET'?'GET':m==='GET_ID'?'GET':m;

  function makeNav(models){
    nav.innerHTML = '';
    const search = el('searchInput');
    function render(){
      const q = (search.value||'').toLowerCase();
      nav.innerHTML = '';
      // Authentication section (option-like)
      const authRow = document.createElement('div');
      authRow.className = 'flex items-center justify-between px-3 py-2 hover:bg-slate-800/60 cursor-pointer text-xs border-b border-slate-800';
      authRow.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="method-badge POST">POST</span>
          <span class="font-medium text-slate-200">Authentication</span>
        </div>
        <div class="text-slate-400">/api/auth/login</div>
      `;
      authRow.onclick = () => selectEndpoint({ model:'Authentication', method:'POST', endpoint: docs.auth.endpoint, fields: docs.auth.fields });
      nav.appendChild(authRow);

      // Models (option-like with destroy button and collapsible methods)
      models.forEach(md => {
        if (q && !md.name.toLowerCase().includes(q)) return;
        const container = document.createElement('div');
        container.className = 'border-b border-slate-800';

        // Header row
        const row = document.createElement('div');
        row.className = 'group flex items-center justify-between px-3 py-2 hover:bg-slate-800/60 cursor-pointer text-xs';
        row.innerHTML = `
          <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clip-rule="evenodd"/></svg>
            <span class="font-medium text-slate-200">${md.name}</span>
          </div>
          <div class="flex items-center gap-2">
            <button class="px-2 py-0.5 rounded text-[11px] bg-rose-900/30 border border-rose-800 text-rose-300 hover:bg-rose-800/40">Destroy</button>
          </div>
        `;
        container.appendChild(row);

        // Methods list (collapsed by default)
        const methodsBox = document.createElement('div');
        methodsBox.className = 'hidden';
        const entries = [
          { method:'GET',    label:'GET',     path: md.endpoints.get },
          { method:'GET_ID', label:'GET ID',  path: md.endpoints.getById },
          { method:'POST',   label:'POST',    path: md.endpoints.post },
          { method:'PUT',    label:'PUT',     path: md.endpoints.put },
          { method:'DELETE', label:'DELETE',  path: md.endpoints.delete },
        ];
        entries.forEach(en => {
          const b = document.createElement('button');
          b.className = 'w-full text-left px-6 py-2 hover:bg-slate-800/60 text-xs flex items-center gap-2';
          b.innerHTML = `<span class="method-badge ${methodColorClass(en.method)}">${methodLabel[en.method]}</span><span>${en.path}</span>`;
          b.onclick = () => selectEndpoint({ model: md.name, method: en.method, endpoint: en.path, fields: md.fields });
          methodsBox.appendChild(b);
        });
        container.appendChild(methodsBox);

        // Toggle behavior: clicking header selects default GET and toggles methods
        row.addEventListener('click', (ev) => {
          // Avoid toggle when clicking destroy
          if (ev.target && ev.target.tagName === 'BUTTON') return;
          selectEndpoint({ model: md.name, method:'GET', endpoint: md.endpoints.get, fields: md.fields });
          methodsBox.classList.toggle('hidden');
        });

        // Destroy button behavior: call /api/docs/reset/:model
        const destroyBtn = row.querySelector('button');
        destroyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = confirm(`Destroy all data for '${md.name}' and its direct children?`);
          if (!ok) return;
          try {
            const res = await fetch(`/api/docs/reset/${encodeURIComponent(md.name)}`);
            const j = await res.json().catch(()=>({}));
            if (res.ok) toast(j.message || 'Destroyed'); else toast(j.message || 'Failed', true);
          } catch (err) { toast('Error: ' + (err.message||err), true); }
        });

        nav.appendChild(container);
      });
    }
    render();
    search.oninput = render;
  }

  function selectEndpoint({ model, method, endpoint, fields }){
    current = { model, method, endpoint, fields };
    methodBadge.className = 'method-badge ' + methodColorClass(method);
    methodBadge.textContent = methodLabel[method];
    pathInput.value = endpoint;
    paramsList.innerHTML = '';
    bodyInput.value = '';
    respOutput.textContent = '';

    // For GET by ID / PUT / DELETE default param row :id
    if (/\/:id(\b|$)/.test(endpoint)) addParamRow('id','');
    else addParamRow('','');
  }

  function addParamRow(key='', val=''){
    const row = document.createElement('div');
    row.className = 'grid grid-cols-12 gap-2';
    row.innerHTML = `
      <div class="col-span-5"><input class="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs code" placeholder="KEY" value="${key}"></div>
      <div class="col-span-6"><input class="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs code" placeholder="Value" value="${val}"></div>
      <div class="col-span-1 flex items-center justify-center"><button class="text-xs text-rose-400 hover:text-rose-300">✕</button></div>
    `;
    row.querySelector('button').onclick = () => row.remove();
    paramsList.appendChild(row);
  }
  el('addParam').onclick = () => addParamRow('','');
  el('resetBtn').onclick = () => selectEndpoint(current);
  el('copyBtn').onclick = async () => { try { await navigator.clipboard.writeText(buildUrl(pathInput.value)); toast('Copied'); } catch {} };
  el('formatJson').onclick = () => { try { bodyInput.value = JSON.stringify(JSON.parse(bodyInput.value||'{}'), null, 2); } catch { toast('Invalid JSON', true); } };
  el('clearBody').onclick = () => bodyInput.value='';

  el('genExample').onclick = () => {
    if (!current.fields || !current.fields.length) { bodyInput.value = '{ }'; return; }
    const obj = {};
    current.fields.forEach(f => {
      const name = f.column_name;
      const dt = (f.data_type||'').toLowerCase();
      if (name === 'id') return;
      if (/(char|text|uuid|citext)/.test(dt)) obj[name] = '';
      else if (/(int|numeric|decimal|double|real)/.test(dt)) obj[name] = 0;
      else if (/(bool)/.test(dt)) obj[name] = false;
      else if (/(date|time)/.test(dt)) obj[name] = new Date().toISOString();
      else obj[name] = null;
    });
    bodyInput.value = JSON.stringify(obj, null, 2);
  };

  el('sendBtn').onclick = async () => {
    try {
      // Build URL with params
      let url = pathInput.value;
      const rows = paramsList.querySelectorAll('.grid');
      const params = {};
      rows.forEach(r => {
        const key = r.querySelectorAll('input')[0].value.trim();
        const val = r.querySelectorAll('input')[1].value;
        if (!key) return;
        params[key] = val;
      });
      if (/:id\b/.test(url) && params.id !== undefined) url = url.replace(/:id\b/, encodeURIComponent(params.id));
      const qsPairs = Object.entries(params).filter(([k]) => k !== 'id').map(([k,v])=> `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
      if (qsPairs.length) url += (url.includes('?')?'&':'?') + qsPairs.join('&');

      // Choose method
      const method = (current.method==='GET_ID'?'GET':current.method);
      const headers = { 'Content-Type':'application/json', ...authHeaders() };
      const init = { method, headers };
      if (method==='POST' || method==='PUT') {
        try { init.body = bodyInput.value && bodyInput.value.trim() ? JSON.stringify(JSON.parse(bodyInput.value)) : '{}'; }
        catch { init.body = bodyInput.value || '{}'; }
      }
      respOutput.textContent = 'Sending…';
      const res = await fetch(buildUrl(url), init);
      const text = await res.text();
      // Try pretty json
      let out = text;
      try { out = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      respOutput.textContent = `HTTP ${res.status} ${res.statusText}\n\n` + out;
    } catch (e) {
      respOutput.textContent = 'Error: ' + (e.message || e);
    }
  };

  function toast(msg, error){
    const n = document.createElement('div');
    n.className = 'fixed top-6 right-6 px-3 py-2 text-xs rounded ' + (error? 'bg-rose-600':'bg-slate-700');
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(()=>n.remove(), 1400);
  }

  async function init(){
    try {
      const res = await fetch('/api/docs/json');
      const j = await res.json();
      if (j && j.status === 'success') {
        docs.auth = j.data.auth;
        docs.models = j.data.models || [];
        makeNav(docs.models);
        // Select the first resource as default
        if (docs.models[0]) selectEndpoint({ model: docs.models[0].name, method:'GET', endpoint: docs.models[0].endpoints.get, fields: docs.models[0].fields });
      } else {
        respOutput.textContent = 'Failed to load docs JSON';
      }
    } catch (e) {
      respOutput.textContent = 'Error loading docs: ' + (e.message||e);
    }
  }

  init();
})();
