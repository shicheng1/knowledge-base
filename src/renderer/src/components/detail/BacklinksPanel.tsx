import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, ArrowRight, ArrowLeft, FileText } from 'lucide-react';

interface LinkData {
  id: number;
  sourceItemId: number;
  targetItemId: number;
  linkText: string | null;
  createdAt: string;
  sourceItem?: {
    id: number;
    title: string;
    contentType: string;
    deletedAt: string | null;
  };
  targetItem?: {
    id: number;
    title: string;
    contentType: string;
    deletedAt: string | null;
  };
}

interface BacklinksPanelProps {
  itemId: number;
}

const BacklinksPanel: React.FC<BacklinksPanelProps> = ({ itemId }) => {
  const navigate = useNavigate();
  const [backlinks, setBacklinks] = useState<LinkData[]>([]);
  const [outlinks, setOutlinks] = useState<LinkData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    Promise.all([
      window.api.item.getBacklinks(itemId).catch(() => []),
      window.api.item.getOutlinks(itemId).catch(() => []),
    ]).then(([bl, ol]) => {
      setBacklinks(bl ?? []);
      setOutlinks(ol ?? []);
    }).finally(() => setLoading(false));
  }, [itemId]);

  if (loading) {
    return (
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  if (backlinks.length === 0 && outlinks.length === 0) {
    return null;
  }

  const handleItemClick = (id: number, deleted: boolean) => {
    if (!deleted) {
      navigate(`/item/${id}`);
    }
  };

  return (
    <div className="mt-8 space-y-6 pt-6 border-t border-gray-200">
      {/* Outlinks section */}
      {outlinks.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500">
            <ArrowRight className="h-4 w-4" />
            本文引用的条目
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
              {outlinks.length}
            </span>
          </h3>
          <div className="space-y-1">
            {outlinks.map((link) => {
              const target = link.targetItem;
              if (!target) return null;
              const isDeleted = !!target.deletedAt;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleItemClick(target.id, isDeleted)}
                  disabled={isDeleted}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    isDeleted
                      ? 'cursor-default text-gray-300 line-through'
                      : 'cursor-pointer text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate text-sm">
                    {target.title}
                    {isDeleted && ' (已删除)'}
                  </span>
                  <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Backlinks section */}
      {backlinks.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500">
            <ArrowLeft className="h-4 w-4" />
            引用本文的条目
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">
              {backlinks.length}
            </span>
          </h3>
          <div className="space-y-1">
            {backlinks.map((link) => {
              const source = link.sourceItem;
              if (!source) return null;
              const isDeleted = !!source.deletedAt;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleItemClick(source.id, isDeleted)}
                  disabled={isDeleted}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    isDeleted
                      ? 'cursor-default text-gray-300 line-through'
                      : 'cursor-pointer text-gray-600 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate text-sm">
                    {source.title}
                    {isDeleted && ' (已删除)'}
                  </span>
                  <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-gray-300 rotate-180" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BacklinksPanel;
