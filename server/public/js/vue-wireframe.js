// Vue 3, no-build SPA for Wireframe Generator
// Uses existing backend endpoints:
// - GET    /api/wireframe/structures
// - POST   /api/wireframe/sync  { modelName, fields, originalFields }
// - GET    /api/wireframe/controller/:model
// - POST   /api/wireframe/controller/:model  { code }
// - GET    /api/wireframe/hook/:model
// - POST   /api/wireframe/hook/:model       { code }
// - GET    /api/wireframe/helper
// - POST   /api/wireframe/helper            { code }
// - POST   /api/migrate-model/:model
// - POST   /api/generator/generate/:tableName

(() => {
  const { createApp, ref, reactive, computed, onMounted, watch } = Vue;

  // Lightweight axios fallback using fetch, returns axios-like object
  const hasAxios = typeof window !== 'undefined' && window.axios;
  const toAxiosLike = async (res) => {
    const headers = {};
    try { res.headers.forEach((v, k) => headers[k] = v); } catch {}
    const ct = (res.headers && (res.headers.get && res.headers.get('content-type'))) ? res.headers.get('content-type') : '';
    let data;
    try {
      if (ct && ct.includes('application/json')) data = await res.json();
      else data = await res.text();
    } catch { data = null; }
    return { status: res.status, statusText: res.statusText, headers, data };
  };
  const http = hasAxios ? window.axios : {
    get: async (url, opts={}) => {
      const res = await fetch(url, { method:'GET', headers: opts.headers });
      return toAxiosLike(res);
    },
    post: async (url, data, opts={}) => {
      const isForm = data instanceof FormData;
      const headers = isForm ? (opts.headers||{}) : { 'Content-Type':'application/json', ...(opts.headers||{}) };
      const body = isForm ? data : (data !== undefined ? JSON.stringify(data): undefined);
      const res = await fetch(url, { method:'POST', headers, body });
      return toAxiosLike(res);
    },
    delete: async (url, opts={}) => {
      const res = await fetch(url, { method:'DELETE', headers: opts.headers });
      return toAxiosLike(res);
    }
  };

  const App = {
    template: `
      <div class="h-full w-full flex overflow-hidden">
        <!-- Sidebar -->
        <aside class="w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
          <div class="p-3 flex items-center justify-between">
            <div class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Wireframe</div>
            <button @click="openNewTable" class="text-xs px-2 py-1 rounded bg-indigo-500 text-white hover:bg-indigo-600">+ New</button>
          </div>
          <div class="px-3 pb-2">
            <input v-model="tableQuery" id="searchTableInput" type="text" class="w-full px-2 py-1.5 rounded border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" :placeholder="'Search ' + filteredModels.length + ' total tables'" />
          </div>
          <div id="tablesList" class="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
            <div v-for="m in filteredModels" :key="m"
                 :class="['table-list-item px-2 py-1.5 rounded cursor-pointer text-xs flex items-center gap-2', m===currentTable ? 'bg-white text-slate-900 font-medium shadow-sm border border-slate-200/75' : 'text-slate-600 hover:bg-white hover:text-slate-900']"
                 @click="switchTable(m)">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18"/></svg>
              <span class="truncate">{{ m }}</span>
              <button class="delete-table-btn ml-auto text-red-400 hover:text-red-600 px-1 rounded" title="Delete table" @click.stop="deleteTable(m)">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <div class="px-3 py-2 text-[11px] text-slate-400 text-center select-none">Developer by <a href="https://instagram.com/ariqluth" target="_blank" class="text-blue-500 font-semibold hover:underline">Ariq Luthfi Rifqi</a></div>
        </aside>

        <!-- Main -->
        <main class="flex-1 h-full overflow-hidden flex flex-col">
          <!-- Tabs -->
          <div class="bg-white border-b border-slate-200">
            <div class="px-4 h-11 flex items-end gap-5">
              <button :class="tabBtnClass('wireframe')" @click="activeTab='wireframe'">Wireframe</button>
              <button :class="tabBtnClass('controller')" @click="openController()">Custom Function</button>
              <button :class="tabBtnClass('hook')" @click="openHook()">Custom Hook</button>
              <button :class="tabBtnClass('helper')" @click="openHelper()">Helper</button>
              <div class="ml-auto flex items-center gap-2">
              <a href="/docs" target="_blank" class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">API Docs</a>
              <button class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200" @click="showProject=true">Project</button>
              <button id="btnShowLog" class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200" @click="showLogTab">Show Log</button>
              </div>
            </div>
          </div>

          <!-- Toolbar + Content -->
          <div v-show="activeTab==='wireframe'" class="flex-1 overflow-hidden flex flex-col">
            <div class="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2">
              <div class="text-sm font-semibold text-slate-700" id="currentTableName">{{ currentTable || '—' }}</div>
              <div class="ml-auto flex items-center gap-2">
                <button id="addRow" class="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100" @click="addRow">+ Add</button>
                <button id="removeRow" class="text-xs px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100" @click="removeRow">× Remove</button>
                <button id="syncModel" class="text-xs px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100" :disabled="busy" @click="syncModel">Sync (Ctrl+Enter)</button>
                <button id="syncDB" class="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100" :disabled="busy" @click="syncDB">SyncDB (Shift+Enter)</button>
                <button id="refreshStructures" class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200" :disabled="busy" @click="refreshStructures">Refresh</button>
                <button id="resetToOriginal" class="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100" @click="resetToOriginal">Reset</button>
              </div>
            </div>
            <div class="flex-1 overflow-auto p-3">
              <div ref="hotEl" id="hot-table"></div>
            </div>
          </div>

          <!-- Controller editor -->
          <div v-show="activeTab==='controller'" class="flex-1 overflow-hidden flex flex-col">
            <div class="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2">
              <div class="text-sm font-semibold">Controller — {{ currentTable }}</div>
              <div class="ml-auto flex items-center gap-2">
                <button id="copyEditorContent" class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200" @click="copyEditor">Copy</button>
                <button id="saveController" class="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100" :disabled="busy" @click="saveController">Save</button>
              </div>
            </div>
            <div id="editorContent" class="flex-1 overflow-hidden p-3">
              <div id="monaco-editor" class="w-full h-full" style="min-height: calc(100vh - 180px);"></div>
            </div>
          </div>

          <!-- Hook editor -->
          <div v-show="activeTab==='hook'" class="flex-1 overflow-hidden flex flex-col">
            <div class="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2">
              <div class="text-sm font-semibold">Hook — {{ currentTable }}</div>
              <div class="ml-auto flex items-center gap-2">
                <button id="saveHook" class="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100" :disabled="busy" @click="saveHook">Save</button>
              </div>
            </div>
            <div id="hookEditorContent" class="flex-1 overflow-hidden p-3">
              <div id="hook-monaco-editor" class="w-full h-full" style="min-height: calc(100vh - 180px);"></div>
            </div>
          </div>

          <!-- Helper editor -->
          <div v-show="activeTab==='helper'" class="flex-1 overflow-hidden flex flex-col">
            <div class="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2">
              <div class="text-sm font-semibold">Helper</div>
              <div class="ml-auto flex items-center gap-2">
                <button id="saveHelper" class="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100" :disabled="busy" @click="saveHelper">Save</button>
              </div>
            </div>
            <div id="helperEditorContent" class="flex-1 overflow-hidden p-3">
              <div id="helper-monaco-editor" class="w-full h-full" style="min-height: calc(100vh - 180px);"></div>
            </div>
          </div>

          <!-- Log viewer -->
          <div v-show="activeTab==='log'" id="logContent" class="flex-1 overflow-hidden flex flex-col">
            <div class="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2">
              <div class="text-sm font-semibold">Activity Log</div>
              <div class="ml-auto flex items-center gap-2">
                <button id="refreshLog" class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200" @click="loadLog">Refresh</button>
                <button id="resetLog" class="text-xs px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100" @click="resetLog">Reset</button>
              </div>
            </div>
            <div class="flex-1 p-3">
              <textarea id="logArea" class="w-full h-full text-xs font-mono p-3 border border-slate-200 rounded bg-white" readonly :value="logText"></textarea>
            </div>
          </div>
        </main>

        <!-- Project Settings Modal -->
        <div v-if="showProject" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50" @click.self="showProject=false">
          <div class="bg-white rounded shadow-lg w-full max-w-md p-4">
            <div class="text-sm font-semibold mb-2">Project Settings</div>
            <div class="space-y-3">
              <div>
                <label class="block text-xs text-slate-600 mb-1">Project Name</label>
                <input v-model="projectName" class="w-full border border-slate-200 rounded px-2 py-1.5 text-sm" placeholder="My Project" />
              </div>
              <div>
                <label class="block text-xs text-slate-600 mb-1">Base URL</label>
                <input v-model="baseUrl" class="w-full border border-slate-200 rounded px-2 py-1.5 text-sm" placeholder="http://localhost:3000" />
                <p class="text-[11px] text-slate-500 mt-1">Contoh: http://localhost:3000 atau https://server.qqltech.com:7093</p>
              </div>
              <div>
                <label class="block text-xs text-slate-600 mb-1">Token (Bearer)</label>
                <input v-model="token" class="w-full border border-slate-200 rounded px-2 py-1.5 text-sm" placeholder="JWT token (opsional)" />
              </div>
            </div>
            <div class="mt-4 flex items-center justify-end gap-2">
              <button class="text-xs px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200" @click="showProject=false">Cancel</button>
              <button class="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700" @click="saveProject">Save</button>
            </div>
          </div>
        </div>
      </div>
    `,
    setup() {
      const models = ref([]);
      const tables = reactive({});
      const originalTables = reactive({});
      const currentTable = ref('');
      const tableQuery = ref('');
      const activeTab = ref('wireframe');
      const hotEl = ref(null);
      let hot = null;
      const busy = ref(false);
      const showProject = ref(false);
      const projectName = ref(localStorage.getItem('project_name') || '');
      const baseUrl = ref((localStorage.getItem('project_base_url') || '').replace(/\/$/, ''));
      const token = ref(localStorage.getItem('project_token') || '');

      const buildUrl = (path) => {
        if (/^https?:\/\//i.test(path)) return path; // already absolute
        const b = baseUrl.value || '';
        if (!b) return path; // use relative (same origin)
        const p = path.startsWith('/') ? path : '/' + path;
        return b + p;
      };
      const getHeaders = () => token.value ? { Authorization: `Bearer ${token.value}` } : {};
      const saveProject = () => {
        localStorage.setItem('project_name', projectName.value || '');
        localStorage.setItem('project_base_url', baseUrl.value || '');
        localStorage.setItem('project_token', token.value || '');
        showProject.value = false;
        // Try reload structures from new baseUrl
        loadStructures();
      };

      // Monaco editors
      let controllerEditor = null;
      let hookEditor = null;
      let helperEditor = null;
      const controllerCode = ref('');
      const hookCode = ref('');
      const helperCode = ref('');

      const filteredModels = computed(() => {
        const q = tableQuery.value.trim().toLowerCase();
        if (!q) return models.value;
        return models.value.filter(m => m.toLowerCase().includes(q));
      });

      const initHot = () => {
        if (!hotEl.value) return;
        const dataTypes = ['STRING','TEXT','INTEGER','BIGINT','FLOAT','DOUBLE','DECIMAL','DATE','DATEONLY','TIME','BOOLEAN','ENUM','JSON','JSONB','UUID','UUIDV4','ARRAY','CITEXT'];
        const nullableOptions = ['YES','NO'];
        const constraintsList = ['unique','autoIncrement','PRIMARY KEY','UNIQUE','foreignKey'];
        const srcFkOptions = ['SRC','FK'];
        hot = new Handsontable(hotEl.value, {
          data: tables[currentTable.value] || [['','','','SRC','','','YES','']],
          colHeaders: [
            'Column Name *','Data Type *','Constraints','SRC/FK','Identity/Attribute','Default Value','allowNull *','Description'
          ],
          columns: [
            { type:'text' },
            { type:'dropdown', source:dataTypes, dropdownHeight:300 },
            { type:'dropdown', source:constraintsList, multiple:true, dropdownHeight:300 },
            { type:'dropdown', source:srcFkOptions, dropdownHeight:300, defaultValue:'SRC' },
            { type:'text', placeholder:'TableName.id|alias' },
            { type:'text', placeholder:'defaultValue' },
            { type:'dropdown', source:nullableOptions, dropdownHeight:300,
              renderer: function (instance, td, row, col, prop, value){
                Handsontable.renderers.DropdownRenderer.apply(this, arguments);
                td.textContent = value === 'NO' ? 'NO' : 'YES';
                return td;
              }
            },
            { type:'text', placeholder:'comment' }
          ],
          licenseKey:'non-commercial-and-evaluation',
          rowHeaders:true,
          manualRowResize:true,
          manualColumnResize:true,
          minRows:4,
          minSpareRows:1,
          stretchH:'all',
          className:'htCenter'
        });
      };

      // Ping server health endpoint until it responds OK again
      const waitForServer = async (maxTries = 15, delayMs = 1000) => {
        for (let i = 0; i < maxTries; i++) {
          try {
            const res = await fetch(`/api/health?r=${Date.now()}`, { cache: 'no-store' });
            if (res.ok) return true;
          } catch {}
          await new Promise(r => setTimeout(r, delayMs));
        }
        return false;
      };

      const loadStructures = async () => {
        busy.value = true;
        try {
          const res = await http.get(buildUrl('/api/wireframe/structures'), { headers: getHeaders() });
          const contentType = (res.headers && (res.headers['content-type'] || res.headers['Content-Type'])) || '';
          if (res.status !== 200) {
            console.error('Failed to load structures:', res.status, res.statusText, res.data);
            notify(`Failed to load structures (HTTP ${res.status})`, 'error');
            return;
          }
          if (!contentType.includes('application/json')) {
            console.error('Expected JSON but received:', contentType, res.data);
            notify('Failed to load structures (non-JSON response)', 'error');
            return;
          }
          const data = res.data || {};
          const m = data.models || []; const s = data.modelStructures || {};
          models.value = m;
          // reset containers
          for (const k of Object.keys(tables)) delete tables[k];
          for (const k of Object.keys(originalTables)) delete originalTables[k];
          Object.assign(tables, s);
          Object.assign(originalTables, JSON.parse(JSON.stringify(s)));
          if (!currentTable.value) currentTable.value = m[0] || Object.keys(tables)[0] || '';
          if (hot) hot.loadData(tables[currentTable.value] || [['','','','SRC','','','YES','']]);
        } catch (e) {
          console.error('Load structures error:', e);
          notify('Failed to load structures: ' + (e.message || 'unknown error'), 'error');
        } finally {
          busy.value = false;
        }
      };

      const switchTable = (name) => {
        if (!name) return;
        currentTable.value = name;
        if (hot) hot.loadData(tables[name] || [['','','','SRC','','','YES','']]);
        if (activeTab.value==='controller' && controllerEditor) openController(true);
        if (activeTab.value==='hook' && hookEditor) openHook(true);
      };

      const addRow = () => { if (hot) hot.alter('insert_row_below'); };
      const removeRow = () => {
        if (!hot) return;
        const sel = hot.getSelectedLast();
        if (!sel) return alert('Select a row to remove');
        const [r1,, r2] = sel; const start=Math.min(r1,r2); const end=Math.max(r1,r2);
        for (let r=end; r>=start; r--) { if (r>0) hot.alter('remove_row', r); }
      };

      const filteredNotEmpty = (rows) => rows
        .filter(r => Array.isArray(r) && r.some(c => c!==null && c!==''))
        .map(row => { const idx=6; if (row[idx]) row[idx] = String(row[idx]).replace(/^[\"']|[\"']$/g,''); return row; });

      const syncModel = async () => {
        if (!currentTable.value) return;
        const newFields = filteredNotEmpty(hot.getData()).filter(r => r[0] !== 'id');
        const original = filteredNotEmpty((originalTables[currentTable.value]||[]) ).filter(r => r[0] !== 'id');
        busy.value = true;
        try {
          const { data } = await http.post(buildUrl('/api/wireframe/sync'), {
            modelName: currentTable.value,
            fields: newFields,
            originalFields: original
          }, { headers: getHeaders() });
          if (data && data.success) {
            // give server a moment to stabilize
            await new Promise(r => setTimeout(r, 1500));
            await refreshStructures();
            // migrate after structures refreshed
            await syncDB();
            notify('Model synchronized successfully', 'success');
          } else {
            notify(data?.message || 'Sync failed', 'error');
          }
        } catch (e) {
          const msg = (e && (e.message || e.toString())) || '';
          const looksLikeRestart = /fetch|Network|Failed|ERR|reset|socket/i.test(msg);
          if (looksLikeRestart) {
            notify('Server restarting… waiting to reconnect…', 'info');
            const up = await waitForServer();
            if (up) {
              await refreshStructures();
              notify('Reconnected. Structures refreshed. If not updated, try Sync again.', 'success');
            } else {
              notify('Unable to reconnect to server after sync. Please refresh the page.', 'error');
            }
          } else {
            notify('Sync error: ' + (e.response?.data?.message || e.message), 'error');
          }
        } finally {
          busy.value = false;
        }
      };

      const syncDB = async () => {
        if (!currentTable.value) return;
        try {
          await http.post(buildUrl(`/api/migrate-model/${currentTable.value}`), undefined, { headers: getHeaders() });
          notify('SyncDB success for ' + currentTable.value, 'success');
        } catch (e) {
          notify('SyncDB error: ' + (e.response?.data?.message || e.message), 'error');
        }
      };

      const resetToOriginal = () => {
        if (!currentTable.value) return;
        tables[currentTable.value] = JSON.parse(JSON.stringify(originalTables[currentTable.value] || []));
        hot.loadData(tables[currentTable.value]);
      };

      const refreshStructures = async () => {
        await loadStructures();
      };

      const sanitizeName = (s) => {
        if (!s) return '';
        let n = s.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_');
        if (/^\d/.test(n)) n = '_' + n;
        return n.toLowerCase();
      };

      const openNewTable = async () => {
        const raw = prompt('Enter table name:');
        const name = sanitizeName(raw);
        if (!name) return;
        if (raw !== name) {
          const ok = confirm(`Nama dinormalisasi menjadi: '${name}'. Lanjutkan?`);
          if (!ok) return;
        }
        try {
          await http.post(buildUrl(`/api/generator/generate/${encodeURIComponent(name)}`), undefined, { headers: getHeaders() });
          await loadStructures();
          switchTable(name);
          notify(`Table '${name}' created`, 'success');
        } catch (e) {
          notify('Failed to create table: ' + (e.response?.data?.message || e.message), 'error');
        }
      };

      const deleteTable = async (name) => {
        if (!confirm(`Delete table & all files for '${name}'?`)) return;
        try {
          // The backend exposes DELETE /api/generator/delete/:name (see generatorRoutes)
          await http.delete(buildUrl(`/api/generator/delete/${encodeURIComponent(name)}`), { headers: getHeaders() });
          await loadStructures();
          currentTable.value = models.value[0] || Object.keys(tables)[0] || '';
        } catch (e) {
          notify('Failed to delete table: ' + (e.response?.data?.message || e.message), 'error');
        }
      };

      // Simple notification (right-upper corner), no dependency
      const notify = (msg, type='info') => {
        const n = document.createElement('div');
        n.className = 'fixed top-6 right-6 max-w-sm custom-notification translate-x-full transition-all duration-300 z-50';
        const palette = type==='success' ? ['bg-green-50','text-green-700'] : type==='error' ? ['bg-red-50','text-red-700'] : ['bg-blue-50','text-blue-700'];
        n.innerHTML = `<div class="${palette[0]} border border-slate-200 rounded shadow-sm px-3 py-2 text-xs ${palette[1]}">${msg.replace(/\n/g,'<br>')}</div>`;
        document.body.appendChild(n);
        requestAnimationFrame(() => n.classList.remove('translate-x-full'));
        setTimeout(() => { n.classList.add('translate-x-full'); setTimeout(()=>n.remove(),250); }, 2500);
      };

      // Tabs helpers
      const tabBtnClass = (key) => ['text-xs pb-2 border-b-2', activeTab.value===key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'];

      // Editors
      const ensureMonaco = () => new Promise((resolve) => {
        if (window.monaco) return resolve();
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], () => resolve());
      });

      const openController = async (force=false) => {
        activeTab.value = 'controller';
        await ensureMonaco();
        const { data } = await http.get(buildUrl(`/api/wireframe/controller/${encodeURIComponent(currentTable.value)}`), { headers: getHeaders() });
        controllerCode.value = typeof data === 'string' ? data : (data?.code || '');
        if (!controllerEditor) {
          controllerEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
            value: controllerCode.value,
            language: 'javascript', theme: 'vs', automaticLayout: true, minimap: { enabled: false }, fontSize: 12, lineHeight: 20
          });
        } else {
          controllerEditor.setValue(controllerCode.value);
        }
      };

      const saveController = async () => {
        if (!controllerEditor) return;
        busy.value = true;
        try {
          await http.post(buildUrl(`/api/wireframe/controller/${encodeURIComponent(currentTable.value)}`), { code: controllerEditor.getValue() }, { headers: getHeaders() });
          notify('Controller saved', 'success');
        } catch (e) {
          notify('Save controller error: ' + (e.response?.data?.message || e.message), 'error');
        } finally { busy.value = false; }
      };

      const openHook = async () => {
        activeTab.value = 'hook';
        await ensureMonaco();
        const { data } = await http.get(buildUrl(`/api/wireframe/hook/${encodeURIComponent(currentTable.value)}`), { headers: getHeaders() });
        hookCode.value = typeof data === 'string' ? data : (data?.code || '');
        if (!hookEditor) {
          hookEditor = monaco.editor.create(document.getElementById('hook-monaco-editor'), {
            value: hookCode.value,
            language: 'javascript', theme: 'vs', automaticLayout: true, minimap: { enabled: false }, fontSize: 12, lineHeight: 20
          });
        } else { hookEditor.setValue(hookCode.value); }
      };

      const saveHook = async () => {
        if (!hookEditor) return;
        busy.value = true;
        try {
          await http.post(buildUrl(`/api/wireframe/hook/${encodeURIComponent(currentTable.value)}`), { code: hookEditor.getValue() }, { headers: getHeaders() });
          notify('Hook saved', 'success');
        } catch (e) {
          notify('Save hook error: ' + (e.response?.data?.message || e.message), 'error');
        } finally { busy.value = false; }
      };

      const openHelper = async () => {
        activeTab.value = 'helper';
        await ensureMonaco();
        const { data } = await http.get(buildUrl('/api/wireframe/helper'), { headers: getHeaders() });
        helperCode.value = typeof data === 'string' ? data : (data?.code || '');
        if (!helperEditor) {
          helperEditor = monaco.editor.create(document.getElementById('helper-monaco-editor'), {
            value: helperCode.value,
            language: 'javascript', theme: 'vs', automaticLayout: true, minimap: { enabled: false }, fontSize: 12, lineHeight: 20
          });
        } else { helperEditor.setValue(helperCode.value); }
      };

      const saveHelper = async () => {
        if (!helperEditor) return;
        busy.value = true;
        try {
          await http.post(buildUrl('/api/wireframe/helper'), { code: helperEditor.getValue() }, { headers: getHeaders() });
          notify('Helper saved', 'success');
        } catch (e) {
          notify('Save helper error: ' + (e.response?.data?.message || e.message), 'error');
        } finally { busy.value = false; }
      };

      // Log
      const logText = ref('');
      let socket = null;
      const ensureSocket = () => {
        if (socket) return socket;
        if (window.appSocket) socket = window.appSocket; // provided by homepage.ejs
        return socket;
      };

      const appendLogLine = (line) => {
        // Keep last ~2000 lines to avoid memory growth
        const limit = 2000;
        const lines = (logText.value || '').split(/\r?\n/);
        lines.push(line);
        const trimmed = lines.slice(-limit).join('\n');
        logText.value = trimmed;
        // Auto scroll bottom
        requestAnimationFrame(() => {
          const ta = document.getElementById('logArea');
          if (ta) { ta.scrollTop = ta.scrollHeight; }
        });
      };

      const subscribeLogStream = () => {
        const s = ensureSocket();
        if (!s) return;
        // Avoid multiple bindings
        if (!s._logBound) {
          s.on('log-activity', (entry) => {
            try {
              const ts = entry.formattedTime || entry.timestamp;
              appendLogLine(`[${ts}] [${entry.level}] ${entry.message}`);
            } catch {}
          });
          s._logBound = true;
        }
        s.emit('request-log-history');
        if (!s._historyBound) {
          s.on('log-history', (entry) => {
            try {
              const ts = entry.formattedTime || entry.timestamp;
              appendLogLine(`[${ts}] [${entry.level}] ${entry.message}`);
            } catch {}
          });
          s._historyBound = true;
        }
      };

      const loadLog = async () => {
        try {
          const { data } = await http.get(buildUrl('/api/logs/activity'), { headers: getHeaders() });
          if (data?.success) logText.value = data.log || '';
          else logText.value = 'Failed to load log';
          // Then attach live stream
          subscribeLogStream();
        } catch { 
          logText.value = 'Error loading log';
          // Still try to attach live stream
          subscribeLogStream();
        }
      }
      const resetLog = async () => {
        try {
          await http.post(buildUrl('/api/logs/reset'), undefined, { headers: getHeaders() });
          await loadLog();
          notify('Log reset', 'success');
        } catch { notify('Failed to reset log', 'error'); }
      }

      const showLogTab = async () => {
        activeTab.value = 'log';
        await loadLog();
      };

      const copyEditor = async () => {
        try {
          let text = '';
          if (activeTab.value==='controller' && controllerEditor) text = controllerEditor.getValue();
          else if (activeTab.value==='hook' && hookEditor) text = hookEditor.getValue();
          else if (activeTab.value==='helper' && helperEditor) text = helperEditor.getValue();
          await navigator.clipboard.writeText(text || '');
          notify('Copied');
        } catch {}
      }

      onMounted(async () => {
        initHot();
        await loadStructures();
        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); syncModel(); }
          if (e.shiftKey && e.key === 'Enter') { e.preventDefault(); syncDB(); }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            if (activeTab.value==='controller') { e.preventDefault(); saveController(); }
            else if (activeTab.value==='hook') { e.preventDefault(); saveHook(); }
            else if (activeTab.value==='helper') { e.preventDefault(); saveHelper(); }
          }
        });
      });

      return {
        // state
        models, tables, originalTables, currentTable, tableQuery, filteredModels, activeTab, busy, hotEl,
        controllerCode, hookCode, helperCode, logText,
        // methods
        switchTable, addRow, removeRow, syncModel, syncDB, resetToOriginal, refreshStructures, openNewTable, deleteTable,
        tabBtnClass, openController, saveController, openHook, saveHook, openHelper, saveHelper, loadLog, resetLog, copyEditor,
        showLogTab,
        showProject, projectName, baseUrl, token, saveProject
      };
    }
  };

  createApp(App).mount('#app');
})();
