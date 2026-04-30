import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network as NetworkIcon, Loader2 } from 'lucide-react';
import { Network, type Data, type Options } from 'vis-network';
import { DataSet } from 'vis-data';

interface GraphNode {
  id: number;
  title: string;
  contentType: string;
  folderId: number | null;
}

interface GraphEdge {
  source: number;
  target: number;
}

const TYPE_COLORS: Record<string, string> = {
  note: '#3B82F6',
  article: '#10B981',
  bookmark: '#F59E0B',
  file: '#6366F1',
  code: '#EC4899',
  image: '#8B5CF6',
  other: '#6B7280',
};

const GraphView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [keyword, setKeyword] = useState('');
  const [hideOrphans, setHideOrphans] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.api.item
      .getGraph()
      .then((res: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
        if (!cancelled) setData(res ?? { nodes: [], edges: [] });
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const linkedSet = new Set<number>();
    for (const e of data.edges) {
      linkedSet.add(e.source);
      linkedSet.add(e.target);
    }
    const lower = keyword.trim().toLowerCase();
    const nodes = data.nodes.filter((n) => {
      if (hideOrphans && !linkedSet.has(n.id)) return false;
      if (lower && !n.title.toLowerCase().includes(lower)) return false;
      return true;
    });
    const ids = new Set(nodes.map((n) => n.id));
    const edges = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodes, edges };
  }, [data, keyword, hideOrphans]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (loading) return;

    const inDegree = new Map<number, number>();
    for (const edge of filtered.edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }

    const visNodes = new DataSet(
      filtered.nodes.map((n) => ({
        id: n.id,
        label: n.title.length > 20 ? n.title.slice(0, 20) + '…' : n.title,
        title: n.title,
        color: TYPE_COLORS[n.contentType] ?? '#6B7280',
        size: 12 + (inDegree.get(n.id) ?? 0) * 4,
        font: { size: 12 },
      })),
    );
    const visEdges = new DataSet(
      filtered.edges.map((e, idx) => ({
        id: idx,
        from: e.source,
        to: e.target,
        arrows: 'to',
        color: { color: '#cbd5e1', highlight: '#3B82F6' },
        smooth: { enabled: true, type: 'continuous', roundness: 0.5 },
      })),
    );

    const visData: Data = { nodes: visNodes as any, edges: visEdges as any };
    const options: Options = {
      nodes: {
        shape: 'dot',
        borderWidth: 2,
        font: { color: '#374151' },
      },
      edges: { width: 1 },
      physics: {
        stabilization: { iterations: 200 },
        barnesHut: { gravitationalConstant: -2500, springLength: 120 },
      },
      interaction: { hover: true, tooltipDelay: 200 },
    };

    if (networkRef.current) {
      networkRef.current.destroy();
    }
    const network = new Network(containerRef.current, visData, options);
    networkRef.current = network;
    network.on('doubleClick', (params: { nodes: number[] }) => {
      if (params.nodes.length > 0) {
        navigate(`/item/${params.nodes[0]}`);
      }
    });
    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, [filtered, loading, navigate]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
          <NetworkIcon className="h-6 w-6 text-blue-500" />
          知识图谱
        </h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="过滤标题..."
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <label className="inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={hideOrphans}
              onChange={(e) => setHideOrphans(e.target.checked)}
              className="rounded"
            />
            隐藏孤立节点
          </label>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span>节点 {filtered.nodes.length}</span>
        <span>·</span>
        <span>边 {filtered.edges.length}</span>
        <span>·</span>
        <span>双击节点跳转至条目详情</span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <span key={type} className="inline-flex items-center gap-1 text-gray-600">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            {type}
          </span>
        ))}
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="relative h-[70vh] overflow-hidden rounded-lg border border-gray-200 bg-white">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
};

export default GraphView;
