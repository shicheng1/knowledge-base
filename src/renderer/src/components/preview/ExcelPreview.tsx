import React, { useEffect, useState, useRef } from 'react';
import { ExternalLink, Loader2, Filter, ChevronDown, Search, Check, X } from 'lucide-react';

interface ExcelPreviewProps {
  filePath: string;
  onOpenExternal?: () => void;
}

interface SheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

const ExcelPreview: React.FC<ExcelPreviewProps> = ({ filePath, onOpenExternal }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);

  const [columnFilters, setColumnFilters] = useState<Record<number, Set<string>>>({});
  const [filterDropdownCol, setFilterDropdownCol] = useState<number | null>(null);
  const [filterSearch, setFilterSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFilterDropdownCol(null);
        setFilterSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadXlsx = async () => {
      if (!filePath) return;

      setLoading(true);
      setError(null);

      try {
        const result = await window.api.file.readExcelData(filePath);
        if (cancelled) return;

        if (result?.sheets && result.sheets.length > 0) {
          setSheets(result.sheets);
        } else {
          setSheets([]);
        }

        setLoading(false);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? '表格加载失败');
          setLoading(false);
        }
      }
    };

    loadXlsx();

    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const currentSheet = sheets[activeSheet];

  const getUniqueValues = (colIndex: number): string[] => {
    if (!currentSheet) return [];
    const values = new Set<string>();
    currentSheet.rows.forEach((row) => {
      if (row[colIndex] !== undefined) {
        values.add(row[colIndex]);
      }
    });
    return Array.from(values).sort();
  };

  const getFilteredRows = (): string[][] => {
    if (!currentSheet) return [];
    const activeFilters = Object.entries(columnFilters).filter(
      ([, values]) => values.size > 0,
    );
    if (activeFilters.length === 0) return currentSheet.rows;

    return currentSheet.rows.filter((row) =>
      activeFilters.every(([colStr, allowedValues]) => {
        const colIndex = Number(colStr);
        const cellValue = row[colIndex] ?? '';
        return allowedValues.has(cellValue);
      }),
    );
  };

  const toggleFilterValue = (colIndex: number, value: string) => {
    setColumnFilters((prev) => {
      const newFilters = { ...prev };
      const current = new Set(prev[colIndex] ?? []);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      if (current.size === 0) {
        delete newFilters[colIndex];
      } else {
        newFilters[colIndex] = current;
      }
      return newFilters;
    });
  };

  const selectAllValues = (colIndex: number) => {
    setColumnFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[colIndex];
      return newFilters;
    });
  };

  const clearColumnFilter = (colIndex: number) => {
    setColumnFilters((prev) => {
      const newFilters = { ...prev };
      const allValues = getUniqueValues(colIndex);
      newFilters[colIndex] = new Set(allValues);
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setFilterDropdownCol(null);
  };

  const hasActiveFilters = Object.keys(columnFilters).length > 0;
  const filteredRows = getFilteredRows();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <p className="mb-4 text-sm text-red-500">表格预览失败: {error}</p>
        {onOpenExternal && (
          <button
            type="button"
            onClick={onOpenExternal}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <ExternalLink className="h-4 w-4" />
            用 Office 打开
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">正在加载表格...</span>
          </div>
        </div>
      )}

      {sheets.length > 1 && (
        <div className="mb-2 flex items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1">
          {sheets.map((sheet, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setActiveSheet(i);
                setColumnFilters({});
                setFilterDropdownCol(null);
              }}
              className={`rounded-t px-3 py-1 text-xs font-medium transition-colors ${
                i === activeSheet
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {hasActiveFilters && (
        <div className="flex items-center justify-between border-b border-gray-100 bg-blue-50 px-3 py-1.5">
          <span className="text-xs text-blue-600">
            已筛选：{filteredRows.length} / {currentSheet?.rows.length ?? 0} 行
          </span>
          <button
            type="button"
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
          >
            <X className="h-3 w-3" />
            清除筛选
          </button>
        </div>
      )}

      <div className="excel-preview-container max-h-[700px] overflow-auto rounded-lg bg-white">
        {currentSheet && currentSheet.headers.length > 0 && (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr>
                {currentSheet.headers.map((header, colIndex) => (
                  <th
                    key={colIndex}
                    className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-600"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{header}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFilterDropdownCol(
                            filterDropdownCol === colIndex ? null : colIndex,
                          );
                          setFilterSearch('');
                        }}
                        className={`flex-shrink-0 rounded p-0.5 transition-colors ${
                          columnFilters[colIndex]
                            ? 'text-blue-600 bg-blue-100'
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                        title="筛选此列"
                      >
                        <Filter className="h-3 w-3" />
                      </button>
                    </div>

                    {filterDropdownCol === colIndex && (
                      <div
                        ref={dropdownRef}
                        className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="border-b border-gray-100 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={filterSearch}
                              onChange={(e) => setFilterSearch(e.target.value)}
                              placeholder="搜索值..."
                              className="w-full rounded border border-gray-200 py-1 pl-7 pr-2 text-xs focus:border-blue-400 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => selectAllValues(colIndex)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            全选
                          </button>
                          <button
                            type="button"
                            onClick={() => clearColumnFilter(colIndex)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            清除
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto py-1">
                          {getUniqueValues(colIndex)
                            .filter((v) =>
                              filterSearch
                                ? v.toLowerCase().includes(filterSearch.toLowerCase())
                                : true,
                            )
                            .map((value) => {
                              const isSelected = !columnFilters[colIndex] || columnFilters[colIndex].has(value);
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => toggleFilterValue(colIndex, value)}
                                  className="flex w-full items-center gap-2 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                >
                                  <span
                                    className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border ${
                                      isSelected
                                        ? 'border-blue-600 bg-blue-600'
                                        : 'border-gray-300'
                                    }`}
                                  >
                                    {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                                  </span>
                                  <span className="truncate">
                                    {value || '(空)'}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="transition-colors hover:bg-gray-50"
                >
                  {currentSheet.headers.map((_, colIndex) => (
                    <td
                      key={colIndex}
                      className="border border-gray-200 px-3 py-1.5 text-gray-700"
                    >
                      {row[colIndex] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={currentSheet.headers.length}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    无匹配数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {(!currentSheet || currentSheet.headers.length === 0) && !loading && (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <p className="text-sm">空表格</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelPreview;
