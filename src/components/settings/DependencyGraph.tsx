'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import styles from './DependencyGraph.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DepGraphStats {
  totalFiles: number;
  totalEdges: number;
  externalImports: number;
  unresolvedImports: number;
  mostDependedOn: { file: string; count: number } | null;
  mostDependencies: { file: string; count: number } | null;
}

interface DepGraphData {
  dependencies: Record<string, string[]>;
  dependents: Record<string, string[]>;
  stats: DepGraphStats;
  fileTree: string[];
  fullName: string;
  branch: string;
  cachedAt: string;
}

type FilterMode = 'all' | 'has-deps' | 'has-dependents' | 'isolated';
type ViewMode   = 'table' | 'graph';

interface Props {
  repoId: string;
}

// ── SVG Graph: node/edge types ─────────────────────────────────────────────────

interface GraphNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  role: 'focus' | 'import' | 'dependent' | 'other';
  depCount: number;
  importCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'import' | 'dependent';
}

// ── Loading step labels ────────────────────────────────────────────────────────

const LOAD_STEPS = [
  { id: 'tree',     label: 'Fetching file tree via git/trees…' },
  { id: 'contents', label: 'Fetching source file contents…' },
  { id: 'parse',    label: 'Extracting imports (Babel AST)…' },
  { id: 'resolve',  label: 'Resolving import paths…' },
  { id: 'done',     label: 'Building adjacency maps…' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function blastClass(count: number): string {
  if (count >= 10) return styles.blastHigh;
  if (count >= 4)  return styles.blastMed;
  if (count >= 1)  return styles.blastLow;
  return '';
}

function shortPath(p: string): string {
  const parts = p.split('/');
  if (parts.length <= 3) return p;
  return `…/${parts.slice(-3).join('/')}`;
}

function basename(p: string): string {
  return p.split('/').pop() ?? p;
}

function nodeColor(role: GraphNode['role'], count: number): string {
  if (role === 'focus') return '#7c3aed';
  if (role === 'import') {
    if (count >= 10) return '#dc2626';
    if (count >= 4)  return '#ea580c';
    return '#7c3aed';
  }
  if (role === 'dependent') {
    if (count >= 10) return '#dc2626';
    if (count >= 4)  return '#ea580c';
    return '#4f46e5';
  }
  return '#94a3b8';
}

// ── SVG Force Graph Component ──────────────────────────────────────────────────

const MAX_NEIGHBORS = 24; // cap visible neighbors to keep graph readable

function NeighborhoodGraph({
  focusFile,
  graphData,
  onFocusChange,
}: {
  focusFile: string;
  graphData: DepGraphData;
  onFocusChange: (f: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const [renderTick, setRenderTick] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const W = 780, H = 480;
  const CX = W / 2, CY = H / 2;

  // Build nodes + edges for 1-hop neighbourhood of focusFile
  const { nodes, edges } = useMemo(() => {
    const imports    = (graphData.dependencies[focusFile] ?? []).slice(0, MAX_NEIGHBORS);
    const dependents = (graphData.dependents[focusFile]  ?? []).slice(0, MAX_NEIGHBORS);

    const nodeMap = new Map<string, GraphNode>();

    const addNode = (id: string, role: GraphNode['role'], x: number, y: number): GraphNode => {
      const existing = nodeMap.get(id);
      if (existing) return existing;
      const n: GraphNode = {
        id, x, y, vx: 0, vy: 0, role,
        depCount:    (graphData.dependents[id]?.length  ?? 0),
        importCount: (graphData.dependencies[id]?.length ?? 0),
      };
      nodeMap.set(id, n);
      return n;
    };

    // Center/focus node
    addNode(focusFile, 'focus', CX, CY);

    // Imports — fan left
    imports.forEach((imp, i) => {
      const angle = (Math.PI / 2) + (i - (imports.length - 1) / 2) * (Math.PI / Math.max(imports.length, 1)) * 0.9;
      addNode(imp, 'import', CX - 240 + Math.cos(angle) * 30, CY + Math.sin(angle) * (180 / Math.max(imports.length, 1)) * (i - (imports.length - 1) / 2));
    });

    // Dependents — fan right
    dependents.forEach((dep, i) => {
      const ySpread = Math.min(160, dependents.length * 28);
      const step    = dependents.length > 1 ? ySpread / (dependents.length - 1) : 0;
      addNode(dep, 'dependent', CX + 240, CY - ySpread / 2 + i * step);
    });

    const edgeList: GraphEdge[] = [
      ...imports.map(imp => ({ source: focusFile, target: imp, type: 'import' as const })),
      ...dependents.map(dep => ({ source: dep, target: focusFile, type: 'dependent' as const })),
    ];

    return { nodes: Array.from(nodeMap.values()), edges: edgeList };
  }, [focusFile, graphData]);

  // Sync ref and run force simulation
  useEffect(() => {
    nodesRef.current = nodes.map(n => ({ ...n }));
    let iter = 0;
    const MAX_ITER = 120;
    const ALPHA = 0.3;

    function tick() {
      const ns = nodesRef.current;
      if (iter++ > MAX_ITER) {
        setRenderTick(t => t + 1);
        return;
      }
      const alpha = ALPHA * (1 - iter / MAX_ITER);

      // Repulsion between all non-focus nodes
      for (let a = 0; a < ns.length; a++) {
        for (let b = a + 1; b < ns.length; b++) {
          const na = ns[a], nb = ns[b];
          if (na.role === 'focus' || nb.role === 'focus') continue;
          const dx = nb.x - na.x;
          const dy = nb.y - na.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const repulse = (1200 / (dist * dist)) * alpha;
          const fx = (dx / dist) * repulse;
          const fy = (dy / dist) * repulse;
          na.vx -= fx; na.vy -= fy;
          nb.vx += fx; nb.vy += fy;
        }
      }

      // Spring attraction toward ideal positions
      ns.forEach(n => {
        if (n.role === 'focus') {
          n.x += (CX - n.x) * 0.1;
          n.y += (CY - n.y) * 0.1;
          return;
        }
        const idealX = n.role === 'import' ? CX - 260 : CX + 260;
        n.vx += (idealX - n.x) * 0.06 * alpha;
        n.vy += (CY    - n.y) * 0.04 * alpha;
        n.vx *= 0.7;
        n.vy *= 0.7;
        n.x += n.vx;
        n.y += n.vy;
        // Clamp to SVG bounds
        n.x = Math.max(80, Math.min(W - 80, n.x));
        n.y = Math.max(30, Math.min(H - 30, n.y));
      });

      setRenderTick(t => t + 1);
      animRef.current = requestAnimationFrame(tick);
    }

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [nodes]);

  const ns = nodesRef.current.length ? nodesRef.current : nodes;
  const nodeById = new Map(ns.map(n => [n.id, n]));

  return (
    <div className={styles.graphWrapper}>
      {/* Legend */}
      <div className={styles.graphLegend}>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{background:'#7c3aed'}}/>Focus</span>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{background:'#4f46e5'}}/>Depends on</span>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{background:'#06b6d4'}}/>Depended on by</span>
        <span className={styles.legendItem}><span className={styles.legendDot} style={{background:'#dc2626'}}/>High blast</span>
        <span className={styles.legendSep}/>
        <span className={styles.legendHint}>Click any node to focus it</span>
      </div>

      <div className={styles.svgContainer}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={styles.graphSvg}
          onClick={() => setTooltip(null)}
        >
          <defs>
            <marker id="arrow-import" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#7c3aed" opacity="0.6"/>
            </marker>
            <marker id="arrow-dependent" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#06b6d4" opacity="0.6"/>
            </marker>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Background lanes */}
          <rect x="20" y="20" width="270" height={H - 40} rx="12" fill="rgba(79,70,229,0.03)" stroke="rgba(79,70,229,0.08)" strokeWidth="1"/>
          <text x="155" y="44" textAnchor="middle" fontSize="10" fill="rgba(79,70,229,0.5)" fontWeight="600" letterSpacing="1">IMPORTS FROM</text>
          <rect x={W - 290} y="20" width="270" height={H - 40} rx="12" fill="rgba(6,182,212,0.03)" stroke="rgba(6,182,212,0.08)" strokeWidth="1"/>
          <text x={W - 155} y="44" textAnchor="middle" fontSize="10" fill="rgba(6,182,212,0.5)" fontWeight="600" letterSpacing="1">DEPENDED ON BY</text>

          {/* Edges */}
          {edges.map((e, i) => {
            const s = nodeById.get(e.source);
            const t = nodeById.get(e.target);
            if (!s || !t) return null;
            const color = e.type === 'import' ? 'rgba(124,58,237,0.35)' : 'rgba(6,182,212,0.35)';
            const markerId = e.type === 'import' ? 'url(#arrow-import)' : 'url(#arrow-dependent)';
            // Offset endpoint so arrow doesn't overlap node circle
            const dx = t.x - s.x, dy = t.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const r = t.role === 'focus' ? 24 : 14;
            const ex = t.x - (dx / dist) * r;
            const ey = t.y - (dy / dist) * r;
            return (
              <line
                key={i}
                x1={s.x} y1={s.y} x2={ex} y2={ey}
                stroke={color} strokeWidth="1.5"
                markerEnd={markerId}
              />
            );
          })}

          {/* Nodes */}
          {ns.map(n => {
            const r     = n.role === 'focus' ? 26 : 15;
            const color = n.role === 'focus' ? '#7c3aed' : n.role === 'dependent' ? '#06b6d4' : nodeColor(n.role, n.depCount);
            const label = basename(n.id);
            const isFocus = n.role === 'focus';

            return (
              <g
                key={n.id}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onFocusChange(n.id); }}
                onMouseEnter={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 12, text: n.id });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {isFocus && (
                  <circle cx={n.x} cy={n.y} r={r + 6} fill="rgba(124,58,237,0.12)" />
                )}
                <circle
                  cx={n.x} cy={n.y} r={r}
                  fill={color}
                  opacity={0.92}
                  filter={isFocus ? 'url(#glow)' : undefined}
                  stroke="#fff" strokeWidth={isFocus ? 2.5 : 1.5}
                />
                <text
                  x={n.x} y={n.y + r + 11}
                  textAnchor="middle"
                  fontSize={isFocus ? 10 : 9}
                  fill={isFocus ? '#7c3aed' : '#64748b'}
                  fontWeight={isFocus ? '700' : '500'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {label.length > 18 ? label.slice(0, 17) + '…' : label}
                </text>
                {isFocus && (
                  <text
                    x={n.x} y={n.y + 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#fff"
                    fontWeight="600"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    FOCUS
                  </text>
                )}
                {!isFocus && (
                  <text
                    x={n.x} y={n.y + 3.5}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#fff"
                    fontWeight="600"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {n.depCount}
                  </text>
                )}
              </g>
            );
          })}

          {/* Tooltip */}
          {tooltip && (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={tooltip.x - 4} y={tooltip.y - 18}
                width={Math.min(tooltip.text.length * 6.2 + 12, 500)}
                height="22" rx="4"
                fill="rgba(15,23,42,0.88)"
              />
              <text x={tooltip.x + 2} y={tooltip.y - 2} fontSize="10" fill="#f8fafc" fontWeight="500">
                {tooltip.text.length > 70 ? '…' + tooltip.text.slice(-69) : tooltip.text}
              </text>
            </g>
          )}
        </svg>
      </div>

      <p className={styles.graphCaption}>
        {`${basename(focusFile)} → ${(graphData.dependencies[focusFile] ?? []).length} imports, ${(graphData.dependents[focusFile] ?? []).length} dependents`}
        {(graphData.dependencies[focusFile]?.length ?? 0) > MAX_NEIGHBORS || (graphData.dependents[focusFile]?.length ?? 0) > MAX_NEIGHBORS
          ? ` (first ${MAX_NEIGHBORS} shown)`
          : ''}
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function DependencyGraph({ repoId }: Props) {
  const [graphData, setGraphData]     = useState<DepGraphData | null>(null);
  const [loading, setLoading]         = useState(false);
  const [loadStep, setLoadStep]       = useState(0);
  const [error, setError]             = useState<string | null>(null);
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode]   = useState<FilterMode>('all');
  const [sortBy, setSortBy]           = useState<'path' | 'deps' | 'dependents'>('dependents');
  const [viewMode, setViewMode]       = useState<ViewMode>('table');
  const [focusFile, setFocusFile]     = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const handleBuild = async () => {
    setLoading(true);
    setError(null);
    setGraphData(null);
    setExpanded(new Set());
    setFocusFile(null);
    setLoadStep(0);

    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    LOAD_STEPS.forEach((_, i) => {
      stepTimers.push(setTimeout(() => setLoadStep(i + 1), i * 1400));
    });

    try {
      const res = await fetch(`/api/repositories/${repoId}/dep-graph`);
      stepTimers.forEach(clearTimeout);
      setLoadStep(LOAD_STEPS.length);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data: DepGraphData = await res.json();
      setGraphData(data);

      // Auto-focus the most-depended-on file in graph view
      if (data.stats.mostDependedOn) setFocusFile(data.stats.mostDependedOn.file);
    } catch (err) {
      stepTimers.forEach(clearTimeout);
      setError((err as Error).message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived rows (table view) ─────────────────────────────────────────────

  const rows = useMemo(() => {
    if (!graphData) return [];
    return graphData.fileTree
      .map(file => ({
        file,
        deps:       graphData.dependencies[file] ?? [],
        dependents: graphData.dependents[file]   ?? [],
      }))
      .filter(row => {
        if (filterMode === 'has-deps')       return row.deps.length > 0;
        if (filterMode === 'has-dependents') return row.dependents.length > 0;
        if (filterMode === 'isolated')       return row.deps.length === 0 && row.dependents.length === 0;
        return true;
      })
      .filter(row => !searchQuery || row.file.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'deps')       return b.deps.length - a.deps.length;
        if (sortBy === 'dependents') return b.dependents.length - a.dependents.length;
        return a.file.localeCompare(b.file);
      });
  }, [graphData, searchQuery, filterMode, sortBy]);

  const toggleExpanded = useCallback((file: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(file) ? next.delete(file) : next.add(file);
      return next;
    });
  }, []);

  // ── Render: trigger card ──────────────────────────────────────────────────

  if (!graphData && !loading && !error) {
    return (
      <section className={styles.section} aria-labelledby="dep-graph-heading">
        <div className={styles.triggerCard}>
          <div className={styles.triggerInfo}>
            <div className={styles.triggerIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                <path d="M6 9v6"/><path d="M9 6h6"/><path d="M15 18H9"/>
              </svg>
            </div>
            <div>
              <p className={styles.triggerTitle} id="dep-graph-heading">Dependency Graph</p>
              <p className={styles.triggerDesc}>
                Analyse all import/require edges via GitHub's REST API — no clone required. Visualise blast radius and import chains.
              </p>
            </div>
          </div>
          <button id="build-dep-graph-btn" className={styles.buildBtn} onClick={handleBuild}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Build Dependency Graph
          </button>
        </div>
      </section>
    );
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <section className={styles.section}>
        <div className={styles.graphCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardHeaderLeft}>
              <div className={styles.cardIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                  <path d="M6 9v6"/><path d="M9 6h6"/><path d="M15 18H9"/>
                </svg>
              </div>
              <div>
                <p className={styles.cardTitle}>Building Dependency Graph…</p>
                <p className={styles.cardMeta}>Fetching from GitHub API — this takes a few seconds</p>
              </div>
            </div>
          </div>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}/>
            <p className={styles.loadingTitle}>Analysing repository structure</p>
            <div className={styles.loadingSteps}>
              {LOAD_STEPS.map((step, i) => {
                const isDone   = loadStep > i + 1;
                const isActive = loadStep === i + 1;
                return (
                  <div key={step.id} className={`${styles.loadingStep} ${isDone ? styles.done : ''} ${isActive ? styles.active : ''}`}>
                    <span className={styles.stepDot}/>
                    {isDone ? '✓ ' : ''}{step.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Render: error ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <section className={styles.section}>
        <div className={styles.triggerCard}>
          <div className={styles.triggerInfo}>
            <div className={styles.triggerIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                <path d="M6 9v6"/><path d="M9 6h6"/><path d="M15 18H9"/>
              </svg>
            </div>
            <div>
              <p className={styles.triggerTitle}>Dependency Graph</p>
              <div className={styles.errorBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0,marginTop:1}}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            </div>
          </div>
          <button className={styles.buildBtn} onClick={handleBuild}>Retry</button>
        </div>
      </section>
    );
  }

  if (!graphData) return null;

  const { stats } = graphData;

  // ── Render: main graph card ───────────────────────────────────────────────

  return (
    <section className={styles.section} aria-labelledby="dep-graph-heading">
      <div className={styles.graphCard}>

        {/* Header */}
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderLeft}>
            <div className={styles.cardIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                <path d="M6 9v6"/><path d="M9 6h6"/><path d="M15 18H9"/>
              </svg>
            </div>
            <div>
              <p className={styles.cardTitle} id="dep-graph-heading">Dependency Graph — {graphData.fullName}</p>
              <p className={styles.cardMeta}>
                Branch: <code>{graphData.branch}</code> · Built {new Date(graphData.cachedAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
          <div style={{display:'flex',gap:'var(--space-2)',alignItems:'center'}}>
            {/* View toggle */}
            <div className={styles.viewToggle}>
              <button
                className={`${styles.viewToggleBtn} ${viewMode === 'graph' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('graph')}
                title="Graph view"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
                  <path d="M6 9v6"/><path d="M9 6h6"/><path d="M15 18H9"/>
                </svg>
                Graph
              </button>
              <button
                className={`${styles.viewToggleBtn} ${viewMode === 'table' ? styles.viewToggleActive : ''}`}
                onClick={() => setViewMode('table')}
                title="Table view"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
                </svg>
                Table
              </button>
            </div>
            <button id="rebuild-dep-graph-btn" className={styles.rebuildBtn} onClick={handleBuild} title="Rebuild">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
              Rebuild
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className={styles.statsRow}>
          <div className={styles.statCell}>
            <span className={`${styles.statValue} ${styles.highlight}`}>{stats.totalFiles}</span>
            <span className={styles.statLabel}>JS/TS Files</span>
          </div>
          <div className={styles.statCell}>
            <span className={`${styles.statValue} ${styles.highlight}`}>{stats.totalEdges}</span>
            <span className={styles.statLabel}>Internal Edges</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statValue}>{stats.externalImports}</span>
            <span className={styles.statLabel}>External (npm)</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statValue}>{stats.unresolvedImports}</span>
            <span className={styles.statLabel}>Unresolved</span>
          </div>
          {stats.mostDependedOn && (
            <div className={styles.statCell}>
              <span className={`${styles.statValue} ${styles.highlight}`}>{stats.mostDependedOn.count}</span>
              <span className={styles.statLabel}>Max Dependents</span>
              <span className={styles.statSub} title={stats.mostDependedOn.file}>{shortPath(stats.mostDependedOn.file)}</span>
            </div>
          )}
          {stats.mostDependencies && (
            <div className={styles.statCell}>
              <span className={`${styles.statValue} ${styles.highlight}`}>{stats.mostDependencies.count}</span>
              <span className={styles.statLabel}>Max Imports</span>
              <span className={styles.statSub} title={stats.mostDependencies.file}>{shortPath(stats.mostDependencies.file)}</span>
            </div>
          )}
        </div>

        {/* ── GRAPH VIEW ─────────────────────────────────────────────────── */}
        {viewMode === 'graph' && (
          <div className={styles.graphViewPanel}>
            {/* File selector for graph focus */}
            <div className={styles.graphFocusBar}>
              <label htmlFor="graph-focus-select" className={styles.graphFocusLabel}>Focus file</label>
              <select
                id="graph-focus-select"
                className={styles.graphFocusSelect}
                value={focusFile ?? ''}
                onChange={e => setFocusFile(e.target.value)}
              >
                {graphData.fileTree.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <span className={styles.graphFocusHint}>
                or click any node in the graph
              </span>
            </div>

            {focusFile && (
              <NeighborhoodGraph
                focusFile={focusFile}
                graphData={graphData}
                onFocusChange={setFocusFile}
              />
            )}
          </div>
        )}

        {/* ── TABLE VIEW ─────────────────────────────────────────────────── */}
        {viewMode === 'table' && (
          <>
            {/* Toolbar */}
            <div className={styles.toolbar}>
              <input
                id="dep-graph-search"
                type="search"
                className={styles.searchInput}
                placeholder="Filter files by path…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <div className={styles.filterChips} role="group" aria-label="Filter">
                {(['all', 'has-deps', 'has-dependents', 'isolated'] as FilterMode[]).map(mode => (
                  <button
                    key={mode}
                    className={`${styles.filterChip} ${filterMode === mode ? styles.active : ''}`}
                    onClick={() => setFilterMode(mode)}
                  >
                    {mode === 'all'            && 'All'}
                    {mode === 'has-deps'       && 'Has imports'}
                    {mode === 'has-dependents' && 'Has dependents'}
                    {mode === 'isolated'       && 'Isolated'}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className={styles.tableWrapper}>
              {rows.length === 0 ? (
                <div className={styles.emptyTable}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  No files match the current filter.
                </div>
              ) : (
                <table className={styles.table}>
                  <thead className={styles.tableHead}>
                    <tr>
                      <th className={styles.th} style={{width:'55%'}}>
                        <button className={styles.thBtn} onClick={() => setSortBy('path')}>
                          File {sortBy === 'path' && '↑'}
                        </button>
                      </th>
                      <th className={`${styles.th} ${styles.right}`} style={{width:'22%'}}>
                        <button className={styles.thBtn} onClick={() => setSortBy('deps')}>
                          Imports {sortBy === 'deps' && '↓'}
                        </button>
                      </th>
                      <th className={`${styles.th} ${styles.right}`} style={{width:'23%'}}>
                        <button className={styles.thBtn} onClick={() => setSortBy('dependents')}>
                          Dependents {sortBy === 'dependents' && '↓'}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const isExpanded = expanded.has(row.file);
                      return (
                        <React.Fragment key={row.file}>
                          <tr
                            className={`${styles.tr} ${isExpanded ? styles.expanded : ''}`}
                            onClick={() => toggleExpanded(row.file)}
                            style={{cursor:'pointer'}}
                          >
                            <td className={styles.td}>
                              <div className={styles.filePath}>
                                <svg
                                  className={`${styles.expandChevron} ${isExpanded ? styles.open : ''}`}
                                  width="10" height="10" viewBox="0 0 24 24" fill="none"
                                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                >
                                  <polyline points="9 18 15 12 9 6"/>
                                </svg>
                                <span className={styles.filePathText} title={row.file}>{row.file}</span>
                              </div>
                            </td>
                            <td className={`${styles.td} ${styles.right}`}>
                              <span className={styles.countBadge}>{row.deps.length}</span>
                            </td>
                            <td className={`${styles.td} ${styles.right}`}>
                              <span className={`${styles.countBadge} ${blastClass(row.dependents.length)}`}>
                                {row.dependents.length}
                              </span>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className={styles.expandedRow}>
                              <td colSpan={3}>
                                <div className={styles.expandedContent}>
                                  <div className={styles.expandedGroup}>
                                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                                      <span className={styles.expandedGroupTitle}>Imports ({row.deps.length})</span>
                                      {row.deps.length > 0 && (
                                        <button
                                          className={styles.viewInGraphBtn}
                                          onClick={e => { e.stopPropagation(); setFocusFile(row.file); setViewMode('graph'); }}
                                        >
                                          View in graph →
                                        </button>
                                      )}
                                    </div>
                                    <div className={styles.expandedList}>
                                      {row.deps.length === 0
                                        ? <span className={styles.emptyExpanded}>No internal imports</span>
                                        : row.deps.map(d => (
                                          <span
                                            key={d}
                                            className={`${styles.expandedFile} ${styles.clickableFile}`}
                                            title={d}
                                            onClick={e => { e.stopPropagation(); setFocusFile(d); setViewMode('graph'); }}
                                          >{d}</span>
                                        ))
                                      }
                                    </div>
                                  </div>

                                  <div className={styles.expandedGroup}>
                                    <span className={styles.expandedGroupTitle}>Imported by ({row.dependents.length})</span>
                                    <div className={styles.expandedList}>
                                      {row.dependents.length === 0
                                        ? <span className={styles.emptyExpanded}>Nothing imports this file</span>
                                        : row.dependents.map(d => (
                                          <span
                                            key={d}
                                            className={`${styles.expandedFile} ${styles.clickableFile}`}
                                            title={d}
                                            onClick={e => { e.stopPropagation(); setFocusFile(d); setViewMode('graph'); }}
                                          >{d}</span>
                                        ))
                                      }
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className={styles.footerNote}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          {viewMode === 'table'
            ? `Showing ${rows.length} of ${stats.totalFiles} files · ${stats.externalImports} external (npm) excluded`
            : `1-hop neighbourhood view · up to ${MAX_NEIGHBORS} neighbours shown`
          }
          &nbsp;·&nbsp;Blast:&nbsp;
          <span className={`${styles.countBadge} ${styles.blastHigh}`} style={{fontSize:'10px',height:'18px'}}>≥10</span>&nbsp;high&nbsp;
          <span className={`${styles.countBadge} ${styles.blastMed}`} style={{fontSize:'10px',height:'18px'}}>4–9</span>&nbsp;med&nbsp;
          <span className={`${styles.countBadge} ${styles.blastLow}`} style={{fontSize:'10px',height:'18px'}}>1–3</span>&nbsp;low
        </div>
      </div>
    </section>
  );
}

// React import needed for React.Fragment
import React from 'react';
