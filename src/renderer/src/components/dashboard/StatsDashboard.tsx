import React, { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import { BookOpen, FolderOpen, Tag, TrendingUp, Star, Archive } from 'lucide-react';

interface DashboardStats {
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  favorites: number;
  archived: number;
  totalFolders: number;
  totalTags: number;
  weeklyNew: number;
  monthlyTrend: Array<{ month: string; count: number }>;
  tagUsage: Array<{ name: string; color: string | null; count: number }>;
}

const TYPE_COLORS: Record<string, string> = {
  note: '#3B82F6',
  article: '#8B5CF6',
  bookmark: '#F59E0B',
  file: '#10B981',
  code: '#EF4444',
  image: '#EC4899',
  other: '#6B7280',
};

const SOURCE_COLORS: Record<string, string> = {
  web: '#3B82F6',
  file: '#10B981',
  clipboard: '#F59E0B',
  manual: '#8B5CF6',
  import: '#EC4899',
  api: '#EF4444',
};

const TYPE_LABELS: Record<string, string> = {
  note: '笔记',
  article: '文章',
  bookmark: '书签',
  file: '文件',
  code: '代码',
  image: '图片',
  other: '其他',
};

const SOURCE_LABELS: Record<string, string> = {
  web: '网页',
  file: '文件',
  clipboard: '剪贴板',
  manual: '手动',
  import: '导入',
  api: 'API',
};

const StatsDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.api.item.getDashboardStats()
      .then((data: DashboardStats) => setStats(data ?? null))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">无法加载统计数据</div>
    );
  }

  const typeData = Object.entries(stats.byType)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ name: TYPE_LABELS[type] || type, value: count, type }));

  const sourceData = Object.entries(stats.bySource)
    .filter(([, count]) => count > 0)
    .map(([source, count]) => ({ name: SOURCE_LABELS[source] || source, value: count, source }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={<BookOpen className="h-5 w-5" />} label="总条目" value={stats.total} color="text-blue-600" bg="bg-blue-50" />
        <StatCard icon={<FolderOpen className="h-5 w-5" />} label="文件夹" value={stats.totalFolders} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard icon={<Tag className="h-5 w-5" />} label="标签" value={stats.totalTags} color="text-purple-600" bg="bg-purple-50" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="本周新增" value={stats.weeklyNew} color="text-orange-600" bg="bg-orange-50" />
        <StatCard icon={<Star className="h-5 w-5" />} label="收藏" value={stats.favorites} color="text-yellow-600" bg="bg-yellow-50" />
        <StatCard icon={<Archive className="h-5 w-5" />} label="归档" value={stats.archived} color="text-gray-600" bg="bg-gray-50" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Content type pie chart */}
        <div className="rounded-lg border border-gray-100 bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-600">内容类型分布</h3>
          {typeData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {typeData.map((entry) => (
                      <Cell key={entry.type} fill={TYPE_COLORS[entry.type] || '#6B7280'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {typeData.map((entry) => (
                  <div key={entry.type} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[entry.type] || '#6B7280' }} />
                      {entry.name}
                    </span>
                    <span className="font-medium text-gray-700">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-300">暂无数据</p>
          )}
        </div>

        {/* Source distribution bar chart */}
        <div className="rounded-lg border border-gray-100 bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-600">来源分布</h3>
          {sourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sourceData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {sourceData.map((entry) => (
                    <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || '#6B7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-gray-300">暂无数据</p>
          )}
        </div>
      </div>

      {/* Monthly trend line chart */}
      {stats.monthlyTrend.length > 1 && (
        <div className="rounded-lg border border-gray-100 bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-600">月度新增趋势（近12个月）</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.monthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 3, fill: '#3B82F6' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tag cloud / usage */}
      {stats.tagUsage.length > 0 && (
        <div className="rounded-lg border border-gray-100 bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-600">标签使用排行</h3>
          <div className="flex flex-wrap gap-2">
            {stats.tagUsage.slice(0, 20).map((tag) => {
              const size = Math.max(0.75, Math.min(2.5, 0.75 + tag.count * 0.15));
              return (
                <span
                  key={tag.name}
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    backgroundColor: `${tag.color || '#3B82F6'}20`,
                    color: tag.color || '#3B82F6',
                    fontSize: `${size}em`,
                  }}
                  title={`${tag.name}: ${tag.count} 条目`}
                >
                  {tag.name} ({tag.count})
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/** Small stat card component */
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bg: string;
}> = ({ icon, label, value, color, bg }) => (
  <div className={`flex items-center gap-3 rounded-lg border border-gray-100 ${bg} p-4`}>
    <span className={color}>{icon}</span>
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  </div>
);

export default StatsDashboard;
