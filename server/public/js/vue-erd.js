(() => {
  const { createApp, ref, reactive, computed, onMounted, onBeforeUnmount, watch } = Vue;

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
  const fieldTypeOptions = [
    'INT',
    'INTEGER',
    'BIGINT',
    'SMALLINT',
    'VARCHAR(255)',
    'TEXT',
    'BOOLEAN',
    'DATE',
    'DATETIME',
    'TIMESTAMP',
    'DECIMAL',
    'FLOAT',
    'DOUBLE'
  ];
  const relationshipCardinalityOptions = [
    { value: 'one-to-one', label: 'One to one' },
    { value: 'one-to-many', label: 'One to many' },
    { value: 'many-to-one', label: 'Many to one' },
    { value: 'many-to-many', label: 'Many to many' }
  ];
  const referentialActionOptions = [
    { value: 'no_action', label: 'No action' },
    { value: 'cascade', label: 'Cascade' },
    { value: 'restrict', label: 'Restrict' },
    { value: 'set_null', label: 'Set null' },
    { value: 'set_default', label: 'Set default' }
  ];
  const normalizeUniqueValue = (value) => {
    if (!value) return null;
    if (value === true) return true;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.length ? value.map(String) : true;
    if (typeof value === 'object') return value.name || true;
    return Boolean(value);
  };

  const isExplicitFalse = (value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return !value;
    const normalized = String(value).trim().toLowerCase();
    return normalized === 'false' || normalized === 'no' || normalized === '0';
  };

  const isExplicitTrue = (value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  };

  const formatFieldType = (value) => {
    if (!value) return 'STRING';
    const text = typeof value === 'string' ? value : String(value);
    return text.replace(/\s+/g, '_').toUpperCase();
  };

  const parseReferenceValue = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      const [modelAndKey, alias] = value.split('|');
      if (!modelAndKey) return null;
      const [model, key] = modelAndKey.split('.');
      return {
        model: model || null,
        key: key || null,
        alias: alias || null
      };
    }
    if (typeof value === 'object') {
      return {
        model: value.model || value.table || value.name || null,
        key: value.key || value.field || value.column || null,
        alias: value.alias || null
      };
    }
    return null;
  };

  const normalizeDefaultValue = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'function') return value.name || value.toString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      if (typeof value.toString === 'function' && value.toString !== Object.prototype.toString) {
        return value.toString();
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  const buildFieldRecord = (candidate = {}, hints = {}) => {
    const fallbackName = hints.name || candidate.field || candidate.fieldName || candidate.columnName;
    const rawName = candidate.name || fallbackName;
    const name = rawName ? String(rawName).trim() : '';
    if (!name || name.startsWith('//')) return null;

    const rawType = candidate.type || candidate.dataType || candidate.data_type || hints.type || 'string';
    const allowNull =
      hints.allowNull !== undefined
        ? !isExplicitFalse(hints.allowNull)
        : !isExplicitFalse(candidate.allowNull) &&
          !isExplicitTrue(candidate.notNull) &&
          String(candidate.nullable || hints.nullable || '').toUpperCase() !== 'NO';

    const primaryKey =
      hints.primaryKey !== undefined
        ? Boolean(hints.primaryKey)
        : Boolean(
            candidate.primaryKey ||
              candidate.primary_key ||
              candidate.pk ||
              candidate.isPrimary ||
              candidate.primary
          );

    const autoIncrement =
      hints.autoIncrement !== undefined
        ? Boolean(hints.autoIncrement)
        : Boolean(candidate.autoIncrement || candidate.auto_increment || candidate.identity === 'AUTO');

    const unique = normalizeUniqueValue(candidate.unique ?? hints.unique);
    const references = parseReferenceValue(candidate.references || hints.references);
    const defaultValue = normalizeDefaultValue(
      candidate.defaultValue ?? candidate.default_value ?? hints.defaultValue,
      null
    );
    const comment = candidate.comment || candidate.description || hints.comment || '';

    return {
      name,
      fieldName: candidate.fieldName || candidate.columnName || name,
      type: formatFieldType(rawType),
      allowNull,
      primaryKey,
      autoIncrement,
      unique,
      defaultValue,
      comment,
      references
    };
  };

  const getFieldBadges = (field) => {
    const badges = [];
    if (!field) return badges;
    if (field.primaryKey) {
      badges.push({
        label: 'Primary',
        tone: 'bg-indigo-100 text-indigo-600 border-indigo-200'
      });
    }
    if (field.unique) {
      badges.push({
        label: 'Unique',
        tone: 'bg-amber-100 text-amber-600 border-amber-200'
      });
    }
    if (field.allowNull === false) {
      badges.push({
        label: 'Not null',
        tone: 'bg-rose-100 text-rose-600 border-rose-200'
      });
    }
    if (field.autoIncrement) {
      badges.push({
        label: 'Autoincrement',
        tone: 'bg-emerald-100 text-emerald-600 border-emerald-200'
      });
    }
    if (field.references) {
      badges.push({
        label: 'Foreign key',
        tone: 'bg-sky-100 text-sky-600 border-sky-200'
      });
    }
    return badges;
  };

  const formatDefaultValueForDisplay = (value) => {
    if (value === undefined || value === null || value === '') return 'Not set';
    return String(value);
  };

  const formatReferenceForDisplay = (field) => {
    if (!field?.references) return 'Not set';
    const { model, key, alias } = field.references;
    const composed = [model, key].filter(Boolean).join('.');
    if (alias) return `${composed || '—'} (${alias})`;
    return composed || '—';
  };

  const baseNodeWidth = 240;
  const headerHeight = 48;
  const rowHeight = 28;
  const canvasPadding = 80;
  const minCanvasWidth = 760;
  const minCanvasHeight = 520;
  const minNodeLeft = 32;
  const minNodeTop = 32;

  const clampPosition = (value, min) => {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, value);
  };

  const computeCanvasSize = (nodes) => {
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return { width: minCanvasWidth, height: minCanvasHeight };
    }
    let maxX = 0;
    let maxY = 0;
    nodes.forEach((node) => {
      const right = node.left + node.width;
      const bottom = node.top + node.height;
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    });
    return {
      width: Math.max(minCanvasWidth, maxX + canvasPadding),
      height: Math.max(minCanvasHeight, maxY + canvasPadding)
    };
  };

  const applyPositionOverrides = (nodes, overrides) => {
    if (!overrides) return nodes;
    return nodes.map((node) => {
      const override = overrides[node.name];
      if (!override) return node;
      const nextLeft = clampPosition(override.left, minNodeLeft);
      const nextTop = clampPosition(override.top, minNodeTop);
      return {
        ...node,
        left: nextLeft,
        top: nextTop
      };
    });
  };

  const edgeGeometryBetween = (source, target) => {
    if (!source || !target) {
      return { path: '', labelX: 0, labelY: 0 };
    }
    const sourceCenterX = source.left + source.width / 2;
    const sourceCenterY = source.top + source.height / 2;
    const targetCenterX = target.left + target.width / 2;
    const targetCenterY = target.top + target.height / 2;

    let startX;
    let startY;
    let endX;
    let endY;

    const horizontalGap = target.left - (source.left + source.width);
    const horizontalGapReverse = source.left - (target.left + target.width);
    const verticalGap = target.top - (source.top + source.height);
    const verticalGapReverse = source.top - (target.top + target.height);

    if (horizontalGap > 20) {
      startX = source.left + source.width;
      startY = sourceCenterY;
      endX = target.left;
      endY = targetCenterY;
    } else if (horizontalGapReverse > 20) {
      startX = source.left;
      startY = sourceCenterY;
      endX = target.left + target.width;
      endY = targetCenterY;
    } else if (verticalGap > 20) {
      startX = sourceCenterX;
      startY = source.top + source.height;
      endX = targetCenterX;
      endY = target.top;
    } else if (verticalGapReverse > 20) {
      startX = sourceCenterX;
      startY = source.top;
      endX = targetCenterX;
      endY = target.top + target.height;
    } else {
      startX = sourceCenterX;
      startY = sourceCenterY;
      endX = targetCenterX;
      endY = targetCenterY;
    }

    const isVertical = Math.abs(startX - endX) < 24;
    const isHorizontal = Math.abs(startY - endY) < 24;

    let c1x;
    let c1y;
    let c2x;
    let c2y;

    if (isVertical) {
      const midY = (startY + endY) / 2;
      c1x = startX;
      c1y = midY;
      c2x = endX;
      c2y = midY;
    } else if (isHorizontal) {
      const midX = (startX + endX) / 2;
      c1x = midX;
      c1y = startY;
      c2x = midX;
      c2y = endY;
    } else {
      const midX = (startX + endX) / 2;
      c1x = midX;
      c1y = startY;
      c2x = midX;
      c2y = endY;
    }

    const path = `M ${startX} ${startY} C ${c1x} ${c1y} ${c2x} ${c2y} ${endX} ${endY}`;
    const labelX = (startX + endX) / 2;
    const labelY = (startY + endY) / 2 - 6;

    return { path, labelX, labelY };
  };

  const normalizeFields = (fields) => {
    const normalized = [];
    if (!Array.isArray(fields)) return normalized;
    fields.forEach((field) => {
      let record = null;
      if (typeof field === 'string') {
        record = buildFieldRecord({ name: field, type: 'string' });
      } else if (Array.isArray(field)) {
        const [
          name,
          type,
          constraints = '',
          relationType = null,
          relationTarget = null,
          defaultValue = null,
          nullable = null,
          comment = null
        ] = field;
        const constraintTokens = String(constraints || '')
          .split('|')
          .map((token) => token.trim().toUpperCase())
          .filter(Boolean);
        record = buildFieldRecord(
          {
            name,
            type,
            defaultValue,
            nullable,
            comment,
            primaryKey:
              constraintTokens.includes('PRIMARY') ||
              constraintTokens.includes('PK') ||
              constraintTokens.includes('PRIMARY KEY'),
            autoIncrement:
              constraintTokens.includes('AUTO') ||
              constraintTokens.includes('AI') ||
              constraintTokens.includes('AUTOINCREMENT')
          },
          {
            references: relationTarget,
            unique: constraintTokens.includes('UNIQUE') || constraintTokens.includes('UQ')
          }
        );
      } else if (field && typeof field === 'object') {
        record = buildFieldRecord(field);
      }
      if (record) normalized.push(record);
    });
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

  const deepClone = (value) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return {};
    }
  };

  const inferCardinalityFromType = (type) => {
    const normalized = String(type || '').toLowerCase();
    if (normalized.includes('many') && normalized.includes('many')) {
      return 'many-to-many';
    }
    switch (normalized) {
      case 'hasone':
      case 'has_one':
      case 'has-one':
      case 'one-to-one':
        return 'one-to-one';
      case 'belongsto':
      case 'belongs_to':
      case 'belongs-to':
        return 'many-to-one';
      case 'belongstomany':
      case 'belongs_to_many':
      case 'belongs-to-many':
      case 'many-to-many':
        return 'many-to-many';
      default:
        return 'one-to-many';
    }
  };

  const normalizeReferentialAction = (value, fallback = 'no_action') => {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
    const allowed = referentialActionOptions.map((option) => option.value);
    return allowed.includes(normalized) ? normalized : fallback;
  };

  const createIdGenerator = () => {
    let counter = 0;
    return (prefix = 'id') => {
      counter += 1;
      return `${prefix}-${Date.now()}-${counter}`;
    };
  };

  const makeId = createIdGenerator();

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

      const dashed =
        metadata.type === 'hasMany' || metadata.type === 'belongsToMany';

      return {
        id: `${edge.v}-${edge.w}-${metadata.alias || metadata.type || 'rel'}`,
        source: edge.v,
        target: edge.w,
        label: metadata.alias || metadata.type || '',
        color: withAlpha((source && source.color) || '#94a3b8', 0.7),
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
      const tableQuery = ref('');
      const relationshipQuery = ref('');
      const noteQuery = ref('');
      const notes = ref([]);
      const leftPanelTab = ref('tables');
      const zoom = ref(100);
      const diagramNodes = ref([]);
      const diagramEdges = ref([]);
      const diagramSize = ref({ width: minCanvasWidth, height: minCanvasHeight });
      const diagramError = ref('');
      const diagramMessage = ref('Pilih minimal satu tabel untuk menampilkan diagram.');
      const lastUpdated = ref('-');
      const diagramConnections = ref([]);
      const customPositions = reactive({});
      const wrapperRef = ref(null);
      const scrollContainer = ref(null);
      const draggingState = reactive({
        active: false,
        name: '',
        offsetX: 0,
        offsetY: 0,
        pointerId: null
      });
      const panState = reactive({
        active: false,
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0,
        pointerId: null
      });
      const activeTableName = ref(null);
      const activeRelationshipId = ref(null);
      const activeNoteId = ref(null);
      const activeTable = computed(() =>
        tables.value.find((table) => table.name === activeTableName.value) || null
      );

      const filteredTables = computed(() => {
        const q = tableQuery.value.trim().toLowerCase();
        if (!q) return tables.value;
        return tables.value.filter((table) => {
          if (table.name.toLowerCase().includes(q)) return true;
          return table.fields.some((field) => {
            return (
              (field.name || '').toLowerCase().includes(q) ||
              (field.type || '').toLowerCase().includes(q)
            );
          });
        });
      });

      const tableColorMap = computed(() => {
        const map = new Map();
        tables.value.forEach((table) => {
          map.set(table.name, table.color);
        });
        return map;
      });

      const allSelected = computed(() => {
        const total = tables.value.length;
        return total > 0 && selected.size === total;
      });

      const relationshipItems = computed(() => {
        const assoc = associations.value || {};
        const items = [];
        const colors = tableColorMap.value;
        Object.entries(assoc).forEach(([source, rels]) => {
          Object.entries(rels || {}).forEach(([alias, rel]) => {
            if (!rel || typeof rel !== 'object') return;
            const target = rel.model || rel.target || rel.table || '';
            const id = `${source}::${alias}`;
            const cardinality = rel.cardinality || inferCardinalityFromType(rel.type);
            items.push({
              id,
              alias,
              source,
              target,
              type: rel.type || '',
              color: colors.get(source) || '#6366F1',
              name: rel.name || alias,
              cardinality,
              manyLabel: rel.manyLabel || rel.manyLabelText || rel.label || '',
              onUpdate: normalizeReferentialAction(rel.onUpdate || rel.on_update),
              onDelete: normalizeReferentialAction(rel.onDelete || rel.on_delete)
            });
          });
        });
        items.sort((a, b) => a.alias.localeCompare(b.alias));
        return items;
      });

      const filteredRelationships = computed(() => {
        const q = relationshipQuery.value.trim().toLowerCase();
        if (!q) return relationshipItems.value;
        return relationshipItems.value.filter((item) => {
          return (
            item.alias.toLowerCase().includes(q) ||
            item.source.toLowerCase().includes(q) ||
            item.target.toLowerCase().includes(q)
          );
        });
      });

      const activeRelationship = computed(() =>
        relationshipItems.value.find((item) => item.id === activeRelationshipId.value) || null
      );

      const filteredNotes = computed(() => {
        const q = noteQuery.value.trim().toLowerCase();
        if (!q) return notes.value;
        return notes.value.filter((note) => {
          return (
            (note.title || '').toLowerCase().includes(q) ||
            (note.content || '').toLowerCase().includes(q)
          );
        });
      });

      const activeNote = computed(() =>
        notes.value.find((note) => note.id === activeNoteId.value) || null
      );

      const splitRelationshipId = (id) => {
        if (!id) return { source: '', alias: '' };
        const delimiter = id.indexOf('::');
        if (delimiter === -1) {
          return { source: id, alias: '' };
        }
        return {
          source: id.slice(0, delimiter),
          alias: id.slice(delimiter + 2)
        };
      };

      const updateRelationshipPartial = (relationshipId, updater) => {
        const { source, alias } = splitRelationshipId(relationshipId);
        if (!source || !alias) return;
        const current = associations.value || {};
        const group = current[source];
        if (!group || !group[alias] || typeof group[alias] !== 'object') return;
        const existing = group[alias];
        const nextRecord =
          typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
        const nextGroup = { ...group, [alias]: nextRecord };
        associations.value = { ...current, [source]: nextGroup };
        refreshDiagram();
      };

      watch(
        tables,
        (nextTables) => {
          if (!Array.isArray(nextTables) || nextTables.length === 0) {
            activeTableName.value = null;
            return;
          }
          if (!activeTableName.value || !nextTables.some((table) => table.name === activeTableName.value)) {
            activeTableName.value = nextTables[0].name;
          }
        },
        { immediate: true, deep: true }
      );

      watch(
        relationshipItems,
        (items) => {
          if (!items.length) {
            activeRelationshipId.value = null;
            return;
          }
          if (!items.some((item) => item.id === activeRelationshipId.value)) {
            activeRelationshipId.value = items[0].id;
          }
        },
        { immediate: true }
      );

      watch(
        notes,
        (list) => {
          if (!Array.isArray(list) || list.length === 0) {
            activeNoteId.value = null;
            return;
          }
          if (!list.some((note) => note.id === activeNoteId.value)) {
            activeNoteId.value = list[0].id;
          }
        },
        { immediate: true, deep: true }
      );

      watch(
        leftPanelTab,
        (tab) => {
          if (tab === 'tables' && !activeTableName.value && tables.value.length) {
            activeTableName.value = tables.value[0].name;
          }
          if (tab === 'relationships' && !activeRelationshipId.value && relationshipItems.value.length) {
            activeRelationshipId.value = relationshipItems.value[0].id;
          }
          if (tab === 'notes' && !activeNoteId.value && notes.value.length) {
            activeNoteId.value = notes.value[0].id;
          }
        },
        { immediate: true }
      );

      const updateEdges = () => {
        const nodesMap = new Map(diagramNodes.value.map((node) => [node.name, node]));
        const mapped = (diagramConnections.value || []).map((edge) => {
          const source = nodesMap.get(edge.source);
          const target = nodesMap.get(edge.target);
          if (!source || !target) return null;
          const geometry = edgeGeometryBetween(source, target);
          return {
            ...edge,
            path: geometry.path,
            labelX: geometry.labelX,
            labelY: geometry.labelY
          };
        }).filter(Boolean);
        diagramEdges.value = mapped;
      };

      const refreshDiagram = () => {
        try {
          const result = buildDiagram(
            tables.value,
            associations.value,
            selected
          );
          const rawNodes = Array.isArray(result.nodes) ? result.nodes : [];
          const validNames = new Set(rawNodes.map((node) => node.name));
          Object.keys(customPositions).forEach((key) => {
            if (!validNames.has(key)) {
              delete customPositions[key];
            }
          });
          const nodesWithOverrides = applyPositionOverrides(rawNodes, customPositions);
          diagramNodes.value = nodesWithOverrides;
          diagramConnections.value = Array.isArray(result.edges) ? result.edges : [];
          diagramSize.value = computeCanvasSize(nodesWithOverrides);
          diagramMessage.value = result.message;
          diagramError.value = '';
          updateEdges();
        } catch (error) {
          console.error('Diagram render error:', error);
          diagramError.value =
            (error && error.message) || 'Gagal memuat diagram ERD.';
          diagramNodes.value = [];
          diagramConnections.value = [];
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
        const parsedTables = parseTables(payload.models);
        tables.value = parsedTables;
        associations.value = deepClone(payload.associations || {});
        selected.clear();
        parsedTables.forEach((table) => selected.add(table.name));
        const payloadNotes = Array.isArray(payload.notes)
          ? payload.notes
              .filter((note) => note && typeof note === 'object')
              .map((note) => ({
                id: note.id || makeId('note'),
                title: note.title || note.name || 'Catatan tanpa judul',
                content: note.content || note.body || '',
                color: note.color || '#FEF3C7'
              }))
          : [];
        if (payloadNotes.length) {
          notes.value = payloadNotes;
        } else if (!notes.value.length) {
          notes.value = [
            {
              id: makeId('note'),
              title: 'Catatan diagram',
              content: 'Tambahkan insight atau hal penting seputar diagram di sini.',
              color: '#FEF3C7'
            }
          ];
        }
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

      const fetchGraphPayload = async () => {
        const graphEndpoints = ['/api/erd/graph'];
        let lastError = null;

        for (const endpoint of graphEndpoints) {
          try {
            const result = await fetchJson(endpoint);
            if (result && result.models) {
              return result;
            }
          } catch (err) {
            lastError = err;
            console.warn('ERD graph fetch failed for', endpoint, err);
          }
        }

        const legacyEndpoints = ['/erd/structures', '/api/erd/structures'];
        for (const endpoint of legacyEndpoints) {
          try {
            const legacy = await fetchJson(endpoint);
            if (legacy) {
              return {
                success: legacy.success !== false,
                models: legacy.models || {},
                associations: legacy.associations || {}
              };
            }
          } catch (err) {
            lastError = err;
            console.warn('Legacy ERD fetch failed for', endpoint, err);
          }
        }

        if (lastError) throw lastError;
        throw new Error('Gagal memuat data ERD.');
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
          const payload = await fetchGraphPayload();
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
        if (selected.has(name)) {
          selected.delete(name);
          if (activeTableName.value === name) {
            const fallback = tables.value.find((table) => selected.has(table.name));
            activeTableName.value = fallback ? fallback.name : null;
          }
        } else {
          selected.add(name);
          activeTableName.value = name;
        }
        refreshDiagram();
      };

      const toggleSelectAll = () => {
        if (allSelected.value) {
          selected.clear();
          activeTableName.value = null;
        } else {
          tables.value.forEach((table) => selected.add(table.name));
          activeTableName.value = tables.value.length ? tables.value[0].name : null;
        }
        refreshDiagram();
      };

      const setActiveTable = (name) => {
        if (!name) return;
        activeTableName.value = name;
        leftPanelTab.value = 'tables';
        if (!selected.has(name)) {
          selected.add(name);
          refreshDiagram();
        }
      };

      const setLeftPanelTab = (tab) => {
        if (!tab) return;
        leftPanelTab.value = tab;
      };

      const setActiveRelationship = (relationshipId) => {
        if (!relationshipId) return;
        activeRelationshipId.value = relationshipId;
        leftPanelTab.value = 'relationships';
      };

      const setActiveNote = (noteId) => {
        if (!noteId) return;
        activeNoteId.value = noteId;
        leftPanelTab.value = 'notes';
      };

      const ensureTable = (tableName) =>
        tables.value.find((table) => table.name === tableName);

      const createTable = () => {
        const existing = new Set(tables.value.map((table) => table.name));
        let counter = tables.value.length + 1;
        let candidate = 'new_table';
        while (existing.has(candidate)) {
          candidate = `new_table_${counter}`;
          counter += 1;
        }
        const color = colorPalette[tables.value.length % colorPalette.length];
        const nextTable = {
          name: candidate,
          fields: [],
          color
        };
        tables.value = [...tables.value, nextTable];
        selected.add(candidate);
        activeTableName.value = candidate;
        leftPanelTab.value = 'tables';
        refreshDiagram();
      };

      const removeTable = (tableName) => {
        if (!tableName) return;
        const filtered = tables.value.filter((table) => table.name !== tableName);
        if (filtered.length === tables.value.length) return;
        tables.value = filtered;
        if (selected.has(tableName)) {
          selected.delete(tableName);
        }
        if (customPositions[tableName]) {
          delete customPositions[tableName];
        }
        const assoc = associations.value || {};
        const nextAssoc = {};
        Object.entries(assoc).forEach(([source, rels]) => {
          if (source === tableName) {
            return;
          }
          const nextRels = {};
          Object.entries(rels || {}).forEach(([alias, rel]) => {
            if (rel && typeof rel === 'object') {
              if (rel.model === tableName) return;
              nextRels[alias] = { ...rel };
            } else if (rel !== undefined) {
              nextRels[alias] = rel;
            }
          });
          if (Object.keys(nextRels).length) {
            nextAssoc[source] = nextRels;
          }
        });
        associations.value = nextAssoc;
        if (activeTableName.value === tableName) {
          activeTableName.value = filtered.length ? filtered[0].name : null;
        }
        refreshDiagram();
      };

      const removeActiveTable = () => {
        if (!activeTableName.value) return;
        removeTable(activeTableName.value);
      };

      const renameTable = (currentName, nextName) => {
        if (!currentName) return;
        const sanitized = String(nextName || '').trim();
        if (!sanitized || sanitized === currentName) return;
        if (tables.value.some((table) => table.name === sanitized)) return;
        tables.value = tables.value.map((table) => {
          if (table.name !== currentName) return table;
          return { ...table, name: sanitized };
        });
        if (selected.has(currentName)) {
          selected.delete(currentName);
          selected.add(sanitized);
        }
        if (customPositions[currentName]) {
          customPositions[sanitized] = { ...customPositions[currentName] };
          delete customPositions[currentName];
        }
        const assoc = associations.value || {};
        const renamedAssoc = {};
        Object.entries(assoc).forEach(([source, rels]) => {
          const nextSource = source === currentName ? sanitized : source;
          const nextRels = {};
          Object.entries(rels || {}).forEach(([alias, rel]) => {
            if (rel && typeof rel === 'object') {
              nextRels[alias] = {
                ...rel,
                model: rel.model === currentName ? sanitized : rel.model
              };
            } else {
              nextRels[alias] = rel;
            }
          });
          if (renamedAssoc[nextSource]) {
            Object.assign(renamedAssoc[nextSource], nextRels);
          } else {
            renamedAssoc[nextSource] = nextRels;
          }
        });
        associations.value = renamedAssoc;
        if (activeTableName.value === currentName) {
          activeTableName.value = sanitized;
        }
        refreshDiagram();
      };

      const createRelationship = () => {
        if (tables.value.length < 2) return;
        const primary =
          tables.value.find((table) => table.name === activeTableName.value) ||
          tables.value[0];
        let foreign =
          tables.value.find((table) => table.name !== primary.name) || primary;
        let baseAlias = `${foreign.name}_fk`;
        let alias = baseAlias;
        const current = associations.value || {};
        const group = current[primary.name] ? { ...current[primary.name] } : {};
        let counter = 1;
        while (group[alias]) {
          alias = `${baseAlias}_${counter}`;
          counter += 1;
        }
        const newRecord = {
          model: foreign.name,
          type: 'hasMany',
          cardinality: 'one-to-many',
          manyLabel: '',
          onUpdate: 'no_action',
          onDelete: 'no_action'
        };
        const nextAssociations = {
          ...current,
          [primary.name]: {
            ...group,
            [alias]: newRecord
          }
        };
        associations.value = nextAssociations;
        const newId = `${primary.name}::${alias}`;
        activeRelationshipId.value = newId;
        selected.add(primary.name);
        selected.add(foreign.name);
        leftPanelTab.value = 'relationships';
        refreshDiagram();
      };

      const renameRelationship = (relationshipId, nextAlias) => {
        const { source, alias } = splitRelationshipId(relationshipId);
        const sanitized = String(nextAlias || '').trim();
        if (!source || !alias || !sanitized) return;
        const current = associations.value || {};
        const group = current[source];
        if (!group || !group[alias]) return;
        if (sanitized === alias) return;
        if (group[sanitized]) return;
        const record = { ...group[alias] };
        if (record.alias) record.alias = sanitized;
        if (record.name) record.name = sanitized;
        const { [alias]: removed, ...rest } = group;
        const nextGroup = { ...rest, [sanitized]: record };
        associations.value = { ...current, [source]: nextGroup };
        const nextId = `${source}::${sanitized}`;
        activeRelationshipId.value = nextId;
        refreshDiagram();
      };

      const updateRelationshipCardinality = (relationshipId, value) => {
        const normalized = relationshipCardinalityOptions.some((option) => option.value === value)
          ? value
          : relationshipCardinalityOptions[0].value;
        updateRelationshipPartial(relationshipId, (current) => ({
          ...current,
          cardinality: normalized
        }));
      };

      const updateRelationshipTarget = (relationshipId, targetName) => {
        if (!targetName) return;
        if (!tables.value.some((table) => table.name === targetName)) return;
        updateRelationshipPartial(relationshipId, (current) => ({
          ...current,
          model: targetName
        }));
      };

      const updateRelationshipManyLabel = (relationshipId, value) => {
        updateRelationshipPartial(relationshipId, (current) => ({
          ...current,
          manyLabel: value,
          label: value
        }));
      };

      const updateRelationshipAction = (relationshipId, field, value) => {
        if (field !== 'onUpdate' && field !== 'onDelete') return;
        const normalized = normalizeReferentialAction(value);
        updateRelationshipPartial(relationshipId, (current) => ({
          ...current,
          [field]: normalized
        }));
      };

      const removeRelationship = (relationshipId) => {
        const { source, alias } = splitRelationshipId(relationshipId);
        if (!source || !alias) return;
        const current = associations.value || {};
        const group = current[source];
        if (!group || !group[alias]) return;
        const { [alias]: removed, ...rest } = group;
        const nextAssociations = { ...current };
        if (Object.keys(rest).length === 0) {
          delete nextAssociations[source];
        } else {
          nextAssociations[source] = rest;
        }
        associations.value = nextAssociations;
        activeRelationshipId.value = null;
        refreshDiagram();
      };

      const createNote = () => {
        const nextNote = {
          id: makeId('note'),
          title: 'Catatan baru',
          content: '',
          color: '#FEF3C7'
        };
        notes.value = [nextNote, ...notes.value];
        activeNoteId.value = nextNote.id;
        leftPanelTab.value = 'notes';
      };

      const updateNoteTitle = (noteId, value) => {
        notes.value = notes.value.map((note) =>
          note.id === noteId ? { ...note, title: value } : note
        );
      };

      const updateNoteContent = (noteId, value) => {
        notes.value = notes.value.map((note) =>
          note.id === noteId ? { ...note, content: value } : note
        );
      };

      const updateNoteColor = (noteId, value) => {
        if (!value) return;
        notes.value = notes.value.map((note) =>
          note.id === noteId ? { ...note, color: value } : note
        );
      };

      const removeNote = (noteId) => {
        notes.value = notes.value.filter((note) => note.id !== noteId);
        if (activeNoteId.value === noteId) {
          activeNoteId.value = notes.value.length ? notes.value[0].id : null;
        }
      };

      const updateFieldName = (tableName, index, value) => {
        const table = ensureTable(tableName);
        if (!table || !table.fields[index]) return;
        const sanitized = String(value || '').trim();
        if (!sanitized) return;
        table.fields[index].name = sanitized;
        table.fields[index].fieldName = sanitized;
        refreshDiagram();
      };

      const updateFieldType = (tableName, index, value) => {
        const table = ensureTable(tableName);
        if (!table || !table.fields[index]) return;
        const sanitized = formatFieldType(value);
        if (!sanitized) return;
        table.fields[index].type = sanitized;
        refreshDiagram();
      };

      const addFieldToTable = (tableName) => {
        const table = ensureTable(tableName);
        if (!table) return;
        const baseName = `field_${table.fields.length + 1}`;
        table.fields.push({
          name: baseName,
          fieldName: baseName,
          type: 'VARCHAR(255)',
          allowNull: true,
          primaryKey: false,
          autoIncrement: false,
          unique: null,
          defaultValue: null,
          comment: '',
          references: null
        });
        refreshDiagram();
      };

      const removeFieldFromTable = (tableName, index) => {
        const table = ensureTable(tableName);
        if (!table || !table.fields[index]) return;
        table.fields.splice(index, 1);
        refreshDiagram();
      };

      const resetManualLayout = () => {
        Object.keys(customPositions).forEach((key) => {
          delete customPositions[key];
        });
        refreshDiagram();
      };

      const startNodeDrag = (event, node) => {
        if (!node) return;
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        setActiveTable(node.name);
        const wrapper = wrapperRef.value;
        if (!wrapper) return;
        const scale = clampZoom(toNumber(zoom.value)) / 100;
        const rect = wrapper.getBoundingClientRect();
        const baseX = (event.clientX - rect.left) / scale;
        const baseY = (event.clientY - rect.top) / scale;
        draggingState.active = true;
        draggingState.name = node.name;
        draggingState.offsetX = baseX - node.left;
        draggingState.offsetY = baseY - node.top;
        draggingState.pointerId = event.pointerId ?? null;
        if (typeof wrapper.setPointerCapture === 'function' && event.pointerId !== undefined) {
          try {
            wrapper.setPointerCapture(event.pointerId);
          } catch {}
        }
      };

      const startCanvasPan = (event) => {
        const button = event.button;
        if (
          (button !== undefined && button !== 0 && button !== 1) ||
          event.target.closest('.diagram-node')
        ) {
          return;
        }
        const container = scrollContainer.value;
        if (!container) return;
        event.preventDefault();
        panState.active = true;
        panState.startX = event.clientX;
        panState.startY = event.clientY;
        panState.scrollLeft = container.scrollLeft;
        panState.scrollTop = container.scrollTop;
        panState.pointerId = event.pointerId ?? null;
        container.classList.add('cursor-grabbing');
      };

      const handlePointerMove = (event) => {
        if (draggingState.active) {
          event.preventDefault();
          const wrapper = wrapperRef.value;
          if (!wrapper) return;
          const scale = clampZoom(toNumber(zoom.value)) / 100;
          const rect = wrapper.getBoundingClientRect();
          const baseX = (event.clientX - rect.left) / scale;
          const baseY = (event.clientY - rect.top) / scale;
          let nextLeft = baseX - draggingState.offsetX;
          let nextTop = baseY - draggingState.offsetY;
          nextLeft = clampPosition(nextLeft, minNodeLeft);
          nextTop = clampPosition(nextTop, minNodeTop);
          customPositions[draggingState.name] = {
            left: nextLeft,
            top: nextTop
          };
          const updated = diagramNodes.value.map((item) =>
            item.name === draggingState.name
              ? { ...item, left: nextLeft, top: nextTop }
              : item
          );
          diagramNodes.value = updated;
          diagramSize.value = computeCanvasSize(updated);
          updateEdges();
        } else if (panState.active) {
          event.preventDefault();
          const container = scrollContainer.value;
          if (!container) return;
          container.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
          container.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
        }
      };

      const stopPointerInteractions = () => {
        if (draggingState.active) {
          const wrapper = wrapperRef.value;
          if (
            wrapper &&
            typeof wrapper.releasePointerCapture === 'function' &&
            draggingState.pointerId !== null &&
            draggingState.pointerId !== undefined
          ) {
            try {
              wrapper.releasePointerCapture(draggingState.pointerId);
            } catch {}
          }
          draggingState.active = false;
          draggingState.name = '';
          draggingState.offsetX = 0;
          draggingState.offsetY = 0;
          draggingState.pointerId = null;
        }
        if (panState.active) {
          const container = scrollContainer.value;
          if (container) {
            container.classList.remove('cursor-grabbing');
          }
          panState.active = false;
          panState.pointerId = null;
        }
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
        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', stopPointerInteractions);
        window.addEventListener('pointercancel', stopPointerInteractions);
        window.addEventListener('blur', stopPointerInteractions);
      });

      onBeforeUnmount(() => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', stopPointerInteractions);
        window.removeEventListener('pointercancel', stopPointerInteractions);
        window.removeEventListener('blur', stopPointerInteractions);
      });

      return {
        loading,
        tables,
        associations,
        selected,
        tableQuery,
        relationshipQuery,
        noteQuery,
        notes,
        leftPanelTab,
        filteredTables,
        filteredRelationships,
        filteredNotes,
        relationshipItems,
        allSelected,
        toggleTable,
        toggleSelectAll,
        setLeftPanelTab,
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
        diagramMessage,
        wrapperRef,
        scrollContainer,
        startNodeDrag,
        startCanvasPan,
        draggingState,
        panState,
        activeTableName,
        activeTable,
        setActiveTable,
        createTable,
        removeActiveTable,
        renameTable,
        updateFieldName,
        updateFieldType,
        addFieldToTable,
        removeFieldFromTable,
        relationshipCardinalityOptions,
        referentialActionOptions,
        activeRelationshipId,
        activeRelationship,
        setActiveRelationship,
        createRelationship,
        renameRelationship,
        updateRelationshipCardinality,
        updateRelationshipTarget,
        updateRelationshipManyLabel,
        updateRelationshipAction,
        removeRelationship,
        activeNoteId,
        activeNote,
        setActiveNote,
        createNote,
        updateNoteTitle,
        updateNoteContent,
        updateNoteColor,
        removeNote,
        fieldTypeOptions,
        resetManualLayout,
        getFieldBadges,
        formatDefaultValueForDisplay,
        formatReferenceForDisplay
      };
    }
  }).mount('#erd-app');
})();
