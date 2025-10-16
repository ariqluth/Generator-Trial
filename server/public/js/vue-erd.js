(() => {
  const { createApp, ref, reactive, computed, onMounted } = Vue;

  let prefetchPayload = null;
  if (typeof window !== 'undefined' && window.__ERD_PREFETCH__) {
    prefetchPayload = window.__ERD_PREFETCH__;
    try { delete window.__ERD_PREFETCH__; } catch {}
  }

  const colorPalette = [
    '#6366F1',
    '#22C55E',
    '#F97316',
    '#0EA5E9',
    '#A855F7',
    '#10B981',
    '#E11D48',
    '#F59E0B',
    '#3B82F6',
    '#14B8A6'
  ];

  const baseNodeWidth = 240;
  const headerHeight = 48;
  const rowHeight = 28;
  const canvasPadding = 80;
  const minCanvasWidth = 760;
  const minCanvasHeight = 520;

  const normalizeFields = (fields) => {
    const normalized = [];
    if (!Array.isArray(fields)) return normalized;
    for (const field of fields) {
      let fieldName;
      let fieldType = 'string';
      if (typeof field === 'string') {
        fieldName = field;
      } else if (Array.isArray(field)) {
        fieldName = field[0];
        fieldType = field[1] || 'string';
      } else if (field && typeof field === 'object') {
        fieldName = field.name || field.fieldName || Object.keys(field)[0];
        fieldType = field.type || field.dataType || field.data_type || 'string';
      }
      if (!fieldName) continue;
      const safeName = String(fieldName).trim();
      if (!safeName || safeName.startsWith('//')) continue;
      normalized.push({
        name: safeName,
        type: String(fieldType || 'string').replace(/\s+/g, '_').toUpperCase()
      });
    }
    return normalized;
  };

  const parseTables = (models) => {
    if (!models || typeof models !== 'object') return [];
    const result = [];
    const entries = Object.entries(models).filter(
      ([name]) => typeof name === 'string' && !name.startsWith('//')
    );
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    entries.forEach(([name, fields], idx) => {
      result.push({
        name,
        fields: normalizeFields(fields),
        color: colorPalette[idx % colorPalette.length]
      });
    });
    return result;
  };

  const formatTimestamp = (date) => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    } catch (e) {
      return date.toLocaleString();
    }
  };

  const clampZoom = (value) => Math.min(160, Math.max(40, value));
  const toNumber = (value) => {
    const num = typeof value === 'number' ? value : parseInt(value, 10);
    return Number.isFinite(num) ? num : 100;
  };

  const hexToRgb = (hex) => {
    const cleaned = hex.replace('#', '');
    if (cleaned.length === 3) {
      const [r, g, b] = cleaned.split('');
      return {
        r: parseInt(r + r, 16),
        g: parseInt(g + g, 16),
        b: parseInt(b + b, 16)
      };
    }
    const value = parseInt(cleaned, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  };

  const withAlpha = (hex, alpha) => {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const buildDiagram = (tables, associations, selected) => {
    const dagreLib = window.dagre;
    if (!dagreLib) {
      throw new Error('Diagram engine failed to load.');
    }
    const activeTables = tables.filter((table) => selected.has(table.name));
    if (activeTables.length === 0) {
      return {
        nodes: [],
        edges: [],
        size: { width: minCanvasWidth, height: minCanvasHeight },
        message: 'Pilih minimal satu tabel untuk menampilkan diagram.'
      };
    }

    const graph = new dagreLib.graphlib.Graph();
    graph.setGraph({
      rankdir: 'LR',
      align: 'UL',
      nodesep: 90,
      ranksep: 140,
      marginx: 40,
      marginy: 40
    });
    graph.setDefaultEdgeLabel(() => ({}));

    activeTables.forEach((table) => {
      const longestField = table.fields.reduce((len, field) => {
        return Math.max(len, (field.name || '').length + (field.type || '').length);
      }, table.name.length);
      const width = Math.max(baseNodeWidth, 16 * 2 + longestField * 7);
      const height =
        headerHeight + Math.max(1, table.fields.length) * rowHeight + 12;
      graph.setNode(table.name, {
        width,
        height,
        table
      });
    });

    const drawn = new Set();
    const assoc = associations || {};
    for (const [source, rels] of Object.entries(assoc)) {
      if (!selected.has(source)) continue;
      const relEntries = Object.entries(rels || {});
      for (const [alias, rel] of relEntries) {
        if (!rel || typeof rel !== 'object') continue;
        const target = rel.model;
        if (!target || !selected.has(target)) continue;
        const key = [source, target].sort().join('--') + ':' + alias;
        if (drawn.has(key)) continue;
        drawn.add(key);
        graph.setEdge(source, target, {
          alias: alias || rel.type || '',
          type: rel.type || ''
        });
      }
    }

    dagreLib.layout(graph);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const nodes = [];
    const nodeMap = new Map();

    activeTables.forEach((table) => {
      const layoutNode = graph.node(table.name);
      if (!layoutNode) return;
      const left = layoutNode.x - layoutNode.width / 2;
      const top = layoutNode.y - layoutNode.height / 2;
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, left + layoutNode.width);
      maxY = Math.max(maxY, top + layoutNode.height);

      const pillBackground = withAlpha(table.color, 0.12);
      const pillColor = withAlpha(table.color, 0.8);
      const headerBackground = `linear-gradient(135deg, ${withAlpha(
        table.color,
        0.2
      )}, ${withAlpha(table.color, 0.05)})`;
      const headerBorder = withAlpha(table.color, 0.25);

      const nodeData = {
        name: table.name,
        fields: table.fields,
        color: table.color,
        width: layoutNode.width,
        height: layoutNode.height,
        top,
        left,
        pillBackground,
        pillColor,
        headerBackground,
        headerBorder
      };
      nodes.push(nodeData);
      nodeMap.set(table.name, nodeData);
    });

    if (!Number.isFinite(minX)) {
      return {
        nodes: [],
        edges: [],
        size: { width: minCanvasWidth, height: minCanvasHeight },
        message: 'Tidak ada node yang dapat dirender.'
      };
    }

    const offsetX = canvasPadding - minX;
    const offsetY = canvasPadding - minY;
    const width = Math.max(
      minCanvasWidth,
      maxX - minX + canvasPadding * 2
    );
    const height = Math.max(
      minCanvasHeight,
      maxY - minY + canvasPadding * 2
    );

    const positionedNodes = nodes.map((node) => ({
      ...node,
      top: node.top + offsetY,
      left: node.left + offsetX
    }));

    positionedNodes.forEach((node) => {
      nodeMap.set(node.name, node);
    });

    const edges = graph.edges().map((edge) => {
      const metadata = graph.edge(edge) || {};
      const source = nodeMap.get(edge.v);
      const target = nodeMap.get(edge.w);
      if (!source || !target) return null;

      const startX = source.left + source.width;
      const startY = source.top + source.height / 2;
      const endX = target.left;
      const endY = target.top + target.height / 2;
      const midX = (startX + endX) / 2;
      const path = `M ${startX} ${startY} C ${midX} ${startY} ${midX} ${endY} ${endX} ${endY}`;
      const labelX = midX;
      const labelY = (startY + endY) / 2 - 6;

      const dashed =
        metadata.type === 'hasMany' || metadata.type === 'belongsToMany';

      return {
        id: `${edge.v}-${edge.w}-${metadata.alias || metadata.type || 'rel'}`,
        path,
        label: metadata.alias || metadata.type || '',
        labelX,
        labelY,
        color: withAlpha(source.color, 0.7),
        dashed
      };
    }).filter(Boolean);

    return {
      nodes: positionedNodes,
      edges,
      size: { width, height },
      message: ''
    };
  };

  createApp({
    setup() {
      const loading = ref(true);
      const tables = ref([]);
      const associations = ref({});
      const selected = reactive(new Set());
      const query = ref('');
      const zoom = ref(100);
      const diagramNodes = ref([]);
      const diagramEdges = ref([]);
      const diagramSize = ref({ width: minCanvasWidth, height: minCanvasHeight });
      const diagramError = ref('');
      const diagramMessage = ref('Pilih minimal satu tabel untuk menampilkan diagram.');
      const lastUpdated = ref('-');

      const filteredTables = computed(() => {
        const q = query.value.trim().toLowerCase();
        if (!q) return tables.value;
        return tables.value.filter((table) =>
          table.name.toLowerCase().includes(q)
        );
      });

      const allSelected = computed(() => {
        const total = tables.value.length;
        return total > 0 && selected.size === total;
      });

      const refreshDiagram = () => {
        try {
          const result = buildDiagram(
            tables.value,
            associations.value,
            selected
          );
          diagramNodes.value = result.nodes;
          diagramEdges.value = result.edges;
          diagramSize.value = result.size;
          diagramMessage.value = result.message;
          diagramError.value = '';
        } catch (error) {
          console.error('Diagram render error:', error);
          diagramError.value =
            (error && error.message) || 'Gagal memuat diagram ERD.';
          diagramNodes.value = [];
          diagramEdges.value = [];
          diagramMessage.value = '';
        }
      };

      const processPayload = (payload) => {
        if (!payload) {
          diagramError.value = 'Data ERD kosong.';
          diagramMessage.value = '';
          return;
        }
        tables.value = parseTables(payload.models);
        associations.value = payload.associations || {};
        selected.clear();
        tables.value.forEach((table) => selected.add(table.name));
        lastUpdated.value = formatTimestamp(new Date());
        refreshDiagram();
      };

      const fetchJson = async (url) => {
        const res = await fetch(url, {
          headers: { Accept: 'application/json' }
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 120)}`);
        }
        return res.json();
      };

      const fetchStructures = async () => {
        loading.value = true;
        diagramError.value = '';
        diagramMessage.value = 'Memuat struktur ERD...';
        try {
          if (prefetchPayload) {
            processPayload(prefetchPayload);
            prefetchPayload = null;
            return;
          }
          const endpoints = ['/erd/structures', '/api/erd/structures'];
          let payload = null;
          let lastError = null;
          for (const endpoint of endpoints) {
            try {
              payload = await fetchJson(endpoint);
              break;
            } catch (err) {
              lastError = err;
              console.warn('ERD fetch failed for', endpoint, err);
            }
          }
          if (!payload) {
            throw lastError || new Error('Gagal memuat data ERD.');
          }
          processPayload(payload);
        } catch (error) {
          console.error('Load ERD data error:', error);
          diagramError.value =
            (error && error.message) || 'Tidak dapat memuat data ERD.';
          diagramMessage.value = '';
        } finally {
          loading.value = false;
        }
      };

      const toggleTable = (name) => {
        if (!name) return;
        if (selected.has(name)) selected.delete(name);
        else selected.add(name);
        refreshDiagram();
      };

      const toggleSelectAll = () => {
        if (allSelected.value) selected.clear();
        else tables.value.forEach((table) => selected.add(table.name));
        refreshDiagram();
      };

      const zoomIn = () => {
        zoom.value = clampZoom(toNumber(zoom.value) + 10);
      };

      const zoomOut = () => {
        zoom.value = clampZoom(toNumber(zoom.value) - 10);
      };

      const resetZoom = () => {
        zoom.value = 100;
      };

      const reload = () => {
        fetchStructures();
      };

      onMounted(() => {
        fetchStructures();
      });

      return {
        loading,
        tables,
        associations,
        selected,
        query,
        filteredTables,
        allSelected,
        toggleTable,
        toggleSelectAll,
        zoom,
        zoomIn,
        zoomOut,
        resetZoom,
        reload,
        lastUpdated,
        diagramNodes,
        diagramEdges,
        diagramSize,
        diagramError,
        diagramMessage
      };
    }
  }).mount('#erd-app');
})();
