import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  FolderOpen,
  Info,
  CheckCircle,
  AlertCircle,
  Loader2,
  MousePointerClick,
  Trash2,
  Globe,
  Upload,
  ScanLine,
  Cloud,
  GitBranch,
  Archive,
  Rss,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  类型定义                                                           */
/* ------------------------------------------------------------------ */
interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/* ------------------------------------------------------------------ */
/*  组件                                                               */
/* ------------------------------------------------------------------ */
const SettingsView: React.FC = () => {
  /* 数据库配置 */
  const [dbConfig, setDbConfig] = useState<DbConfig>({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'knowledge_base',
  });

  /* 存储目录 */
  const [storagePath, setStoragePath] = useState('');

  /* 状态 */
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [initStatus, setInitStatus] = useState<'idle' | 'initing' | 'success' | 'error'>('idle');
  const [initMessage, setInitMessage] = useState('');
  const [saving, setSaving] = useState(false);

  /* 右键菜单 */
  const [shellRegistered, setShellRegistered] = useState<boolean | null>(null);
  const [shellLoading, setShellLoading] = useState(false);
  const [shellMessage, setShellMessage] = useState('');

  /* 浏览器扩展集成 */
  const [nmRegistered, setNmRegistered] = useState<boolean | null>(null);
  const [nmLoading, setNmLoading] = useState(false);
  const [nmMessage, setNmMessage] = useState('');
  const [extensionId, setExtensionId] = useState('');

  /* 数据导入 */
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  /* 新右键菜单（integration） */
  const [ctxRegistered, setCtxRegistered] = useState<boolean | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [ctxMessage, setCtxMessage] = useState('');

  /* OCR 开关 */
  const [ocrEnabled, setOcrEnabled] = useState(false);

  /* WebDAV 配置 */
  const [webdavCfg, setWebdavCfg] = useState({ url: '', username: '', password: '', remotePath: '/knowledge-base' });
  const [webdavStatus, setWebdavStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [webdavBusy, setWebdavBusy] = useState(false);
  const [webdavLastSyncAt, setWebdavLastSyncAt] = useState<string | null>(null);

  /* Git 配置 */
  const [gitCfg, setGitCfg] = useState({
    remoteUrl: '',
    branch: 'main',
    username: '',
    token: '',
    authorEmail: '',
    authorName: 'KnowledgeBase',
  });
  const [gitStatus, setGitStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [gitBusy, setGitBusy] = useState(false);
  const [gitLastSyncAt, setGitLastSyncAt] = useState<string | null>(null);

  /* 完整网页存档 */
  const [archiveUrl, setArchiveUrl] = useState('');
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveResult, setArchiveResult] = useState<string | null>(null);

  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingMessage, setTrendingMessage] = useState<{ ok: boolean; msg: string } | null>(null);

  /* 加载已有设置 */
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const all = await window.api.settings.getAll();
        if (all) {
          if (all.db_host) setDbConfig((prev) => ({ ...prev, host: all.db_host }));
          if (all.db_port) setDbConfig((prev) => ({ ...prev, port: Number(all.db_port) }));
          if (all.db_user) setDbConfig((prev) => ({ ...prev, user: all.db_user }));
          if (all.db_password) setDbConfig((prev) => ({ ...prev, password: all.db_password }));
          if (all.db_name) setDbConfig((prev) => ({ ...prev, database: all.db_name }));
          if (all.storage_root_path) setStoragePath(all.storage_root_path);
          if (all.ocr_enabled !== undefined) setOcrEnabled(all.ocr_enabled === 'true');
        }
      } catch (err) {
        console.error('加载设置失败:', err);
      }

      // 检查右键菜单注册状态
      try {
        const registered = await window.api.shell.isRegistered();
        setShellRegistered(registered);
      } catch {
        setShellRegistered(false);
      }

      // 检查 Native Messaging 注册状态
      try {
        const nmReg = await window.api.integration.isNativeMessagingRegistered();
        setNmRegistered(nmReg);
      } catch {
        setNmRegistered(false);
      }

      // 检查新右键菜单注册状态
      try {
        const ctxReg = await window.api.integration.isContextMenuRegistered();
        setCtxRegistered(ctxReg);
      } catch {
        setCtxRegistered(false);
      }

      // 加载同步配置
      try {
        const status: any = await (window.api as any).sync?.getStatus?.();
        if (status?.webdav?.config) setWebdavCfg(status.webdav.config);
        if (status?.webdav?.lastSyncAt) setWebdavLastSyncAt(status.webdav.lastSyncAt);
        if (status?.git?.config) setGitCfg(status.git.config);
        if (status?.git?.lastSyncAt) setGitLastSyncAt(status.git.lastSyncAt);
      } catch {}

    };
    loadSettings();
  }, []);

  /* 保存数据库配置 */
  const saveDbConfig = useCallback(async () => {
    setSaving(true);
    try {
      await Promise.all([
        window.api.settings.set('db_host', dbConfig.host),
        window.api.settings.set('db_port', String(dbConfig.port)),
        window.api.settings.set('db_user', dbConfig.user),
        window.api.settings.set('db_password', dbConfig.password),
        window.api.settings.set('db_name', dbConfig.database),
      ]);
    } catch (err) {
      console.error('保存配置失败:', err);
    } finally {
      setSaving(false);
    }
  }, [dbConfig]);

  /* 测试数据库连接 */
  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionMessage('');
    try {
      await saveDbConfig();
      const result = await window.api.settings.testConnection(dbConfig);
      // preload 已解包，result 直接是 boolean
      if (result === true || result === 'true') {
        setConnectionStatus('success');
        setConnectionMessage('连接成功');
      } else {
        setConnectionStatus('error');
        setConnectionMessage('连接失败');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setConnectionMessage(err?.message ?? '连接失败');
    }
  };

  /* 初始化数据库 */
  const handleInitDatabase = async () => {
    setInitStatus('initing');
    setInitMessage('');
    try {
      await saveDbConfig();
      await window.api.settings.initDatabase(dbConfig);
      // preload 已解包，成功时无返回值，失败时抛异常
      setInitStatus('success');
      setInitMessage('数据库初始化成功');
    } catch (err: any) {
      setInitStatus('error');
      setInitMessage(err?.message ?? '初始化失败');
    }
  };

  /* 选择存储目录 */
  const handleSelectDirectory = async () => {
    try {
      const result = await window.api.file.selectDirectory();
      // preload 已解包，result 直接是路径字符串
      const selectedPath = typeof result === 'string' ? result : result?.path;
      if (selectedPath) {
        setStoragePath(selectedPath);
        await window.api.settings.set('storage_root_path', selectedPath);
      }
    } catch (err) {
      console.error('选择目录失败:', err);
    }
  };

  /* 注册右键菜单 */
  const handleRegisterShell = async () => {
    setShellLoading(true);
    setShellMessage('');
    try {
      await window.api.shell.registerMenu();
      setShellRegistered(true);
      setShellMessage('右键菜单注册成功');
    } catch (err: any) {
      setShellMessage(err?.message ?? '注册失败，可能需要管理员权限');
    } finally {
      setShellLoading(false);
    }
  };

  /* 注销右键菜单 */
  const handleUnregisterShell = async () => {
    setShellLoading(true);
    setShellMessage('');
    try {
      await window.api.shell.unregisterMenu();
      setShellRegistered(false);
      setShellMessage('右键菜单已注销');
    } catch (err: any) {
      setShellMessage(err?.message ?? '注销失败');
    } finally {
      setShellLoading(false);
    }
  };

  /* 输入框通用样式 */
  const inputClass =
      'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
      <div className="max-w-2xl">
        {/* 页面标题 */}
        <h1 className="mb-6 text-2xl font-bold text-gray-800">设置</h1>

        {/* ── 数据库连接 ───────────────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-800">数据库连接</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">主机地址</label>
              <input
                  type="text"
                  value={dbConfig.host}
                  onChange={(e) => setDbConfig((prev) => ({ ...prev, host: e.target.value }))}
                  className={inputClass}
                  placeholder="localhost"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">端口</label>
              <input
                  type="number"
                  value={dbConfig.port}
                  onChange={(e) =>
                      setDbConfig((prev) => ({ ...prev, port: Number(e.target.value) }))
                  }
                  className={inputClass}
                  placeholder="3306"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">用户名</label>
              <input
                  type="text"
                  value={dbConfig.user}
                  onChange={(e) => setDbConfig((prev) => ({ ...prev, user: e.target.value }))}
                  className={inputClass}
                  placeholder="postgres"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">密码</label>
              <input
                  type="password"
                  value={dbConfig.password}
                  onChange={(e) => setDbConfig((prev) => ({ ...prev, password: e.target.value }))}
                  className={inputClass}
                  placeholder="输入密码"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-600">数据库名</label>
              <input
                  type="text"
                  value={dbConfig.database}
                  onChange={(e) => setDbConfig((prev) => ({ ...prev, database: e.target.value }))}
                  className={inputClass}
                  placeholder="knowledge_base"
              />
            </div>
          </div>

          {/* 连接状态 */}
          {connectionStatus !== 'idle' && (
              <div
                  className={`mt-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      connectionStatus === 'testing'
                          ? 'bg-blue-50 text-blue-600'
                          : connectionStatus === 'success'
                              ? 'bg-green-50 text-green-600'
                              : 'bg-red-50 text-red-600'
                  }`}
              >
                {connectionStatus === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
                {connectionStatus === 'success' && <CheckCircle className="h-4 w-4" />}
                {connectionStatus === 'error' && <AlertCircle className="h-4 w-4" />}
                {connectionMessage}
              </div>
          )}

          {/* 初始化状态 */}
          {initStatus !== 'idle' && (
              <div
                  className={`mt-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      initStatus === 'initing'
                          ? 'bg-blue-50 text-blue-600'
                          : initStatus === 'success'
                              ? 'bg-green-50 text-green-600'
                              : 'bg-red-50 text-red-600'
                  }`}
              >
                {initStatus === 'initing' && <Loader2 className="h-4 w-4 animate-spin" />}
                {initStatus === 'success' && <CheckCircle className="h-4 w-4" />}
                {initStatus === 'error' && <AlertCircle className="h-4 w-4" />}
                {initMessage}
              </div>
          )}

          {/* 操作按钮 */}
          <div className="mt-4 flex items-center gap-3">
            <button
                type="button"
                onClick={handleTestConnection}
                disabled={connectionStatus === 'testing'}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
            >
              {connectionStatus === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                  <CheckCircle className="h-4 w-4" />
              )}
              测试连接
            </button>
            <button
                type="button"
                onClick={handleInitDatabase}
                disabled={initStatus === 'initing'}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {initStatus === 'initing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                  <Database className="h-4 w-4" />
              )}
              初始化数据库
            </button>
          </div>
        </section>

        {/* ── 存储目录 ─────────────────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold text-gray-800">存储目录</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
              {storagePath || '未设置'}
            </div>
            <button
                type="button"
                onClick={handleSelectDirectory}
                className="flex-shrink-0 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              选择目录
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            导入的文件和附件将存储在此目录中
          </p>
        </section>

        {/* ── 右键菜单 ─────────────────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <MousePointerClick className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-800">Windows 右键菜单</h2>
          </div>

          <p className="mb-4 text-sm text-gray-500">
            在 Windows 资源管理器中右键点击文件或文件夹，即可快速保存到知识库。
            注册后支持：文件右键、文件夹右键、文件夹空白处右键。
          </p>

          {/* 注册状态 */}
          <div className="mb-3 flex items-center gap-2">
            {shellRegistered === null ? (
                <span className="text-sm text-gray-400">检测中...</span>
            ) : shellRegistered ? (
                <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              已注册
            </span>
            ) : (
                <span className="inline-flex items-center gap-1 text-sm text-gray-400">
              <AlertCircle className="h-4 w-4" />
              未注册
            </span>
            )}
          </div>

          {/* 操作消息 */}
          {shellMessage && (
              <div
                  className={`mb-3 rounded-md px-3 py-2 text-sm ${
                      shellMessage.includes('成功')
                          ? 'bg-green-50 text-green-600'
                          : 'bg-red-50 text-red-600'
                  }`}
              >
                {shellMessage}
              </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={handleRegisterShell}
                disabled={shellLoading || shellRegistered === true}
                className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              {shellLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                  <MousePointerClick className="h-4 w-4" />
              )}
              注册右键菜单
            </button>
            <button
                type="button"
                onClick={handleUnregisterShell}
                disabled={shellLoading || shellRegistered === false}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {shellLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                  <Trash2 className="h-4 w-4" />
              )}
              注销右键菜单
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            注册/注销可能需要管理员权限
          </p>
        </section>

        {/* ── 浏览器扩展集成 ─────────────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-800">浏览器扩展集成</h2>
          </div>

          <p className="mb-4 text-sm text-gray-500">
            注册 Native Messaging Host 后，Chrome 浏览器扩展可以通过右键菜单将网页保存到知识库。
          </p>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-600">Chrome 扩展 ID</label>
            <input
              type="text"
              value={extensionId}
              onChange={(e) => setExtensionId(e.target.value)}
              className={inputClass}
              placeholder="输入 Chrome 扩展 ID（如 abcdefghijklmnopqrstuvwxyzabcdef）"
            />
            <p className="mt-1 text-xs text-gray-400">
              在 chrome://extensions 页面中查看扩展 ID
            </p>
          </div>

          <div className="mb-3 flex items-center gap-2">
            {nmRegistered === null ? (
              <span className="text-sm text-gray-400">检测中...</span>
            ) : nmRegistered ? (
              <span className="inline-flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                已注册
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                <AlertCircle className="h-4 w-4" />
                未注册
              </span>
            )}
          </div>

          {nmMessage && (
            <div
              className={`mb-3 rounded-md px-3 py-2 text-sm ${
                nmMessage.includes('成功')
                  ? 'bg-green-50 text-green-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {nmMessage}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                setNmLoading(true);
                setNmMessage('');
                try {
                  await window.api.integration.registerNativeMessaging(extensionId);
                  setNmRegistered(true);
                  setNmMessage('注册成功');
                } catch (err: any) {
                  setNmMessage(err?.message ?? '注册失败');
                } finally {
                  setNmLoading(false);
                }
              }}
              disabled={nmLoading || !extensionId.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {nmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              注册 Native Messaging
            </button>
            <button
              type="button"
              onClick={async () => {
                setNmLoading(true);
                setNmMessage('');
                try {
                  await window.api.integration.unregisterNativeMessaging();
                  setNmRegistered(false);
                  setNmMessage('已注销');
                } catch (err: any) {
                  setNmMessage(err?.message ?? '注销失败');
                } finally {
                  setNmLoading(false);
                }
              }}
              disabled={nmLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              注销
            </button>
          </div>
        </section>

        {/* ── 文件右键菜单（新版） ──────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <MousePointerClick className="h-5 w-5 text-teal-500" />
            <h2 className="text-lg font-semibold text-gray-800">文件右键菜单</h2>
          </div>

          <p className="mb-4 text-sm text-gray-500">
            在 Windows 资源管理器中右键点击任意文件，选择"保存到知识库"即可快速导入。
          </p>

          <div className="mb-3 flex items-center gap-2">
            {ctxRegistered === null ? (
              <span className="text-sm text-gray-400">检测中...</span>
            ) : ctxRegistered ? (
              <span className="inline-flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                已注册
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                <AlertCircle className="h-4 w-4" />
                未注册
              </span>
            )}
          </div>

          {ctxMessage && (
            <div
              className={`mb-3 rounded-md px-3 py-2 text-sm ${
                ctxMessage.includes('成功')
                  ? 'bg-green-50 text-green-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {ctxMessage}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                setCtxLoading(true);
                setCtxMessage('');
                try {
                  await window.api.integration.registerContextMenu();
                  setCtxRegistered(true);
                  setCtxMessage('注册成功');
                } catch (err: any) {
                  setCtxMessage(err?.message ?? '注册失败');
                } finally {
                  setCtxLoading(false);
                }
              }}
              disabled={ctxLoading || ctxRegistered === true}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
            >
              {ctxLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MousePointerClick className="h-4 w-4" />}
              注册文件右键菜单
            </button>
            <button
              type="button"
              onClick={async () => {
                setCtxLoading(true);
                setCtxMessage('');
                try {
                  await window.api.integration.unregisterContextMenu();
                  setCtxRegistered(false);
                  setCtxMessage('已注销');
                } catch (err: any) {
                  setCtxMessage(err?.message ?? '注销失败');
                } finally {
                  setCtxLoading(false);
                }
              }}
              disabled={ctxLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              注销
            </button>
          </div>
        </section>

        {/* ── OCR 文字识别 ────────────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-cyan-500" />
            <h2 className="text-lg font-semibold text-gray-800">图片 OCR 文字识别</h2>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            导入图片时自动识别图片中的文字，支持中文、英文。识别结果将存入元数据，可用于全文搜索。
          </p>
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <div className={`relative inline-flex items-center w-10 h-6 rounded-full transition-colors ${ocrEnabled ? 'bg-cyan-600' : 'bg-gray-300'}`}>
              <input
                type="checkbox"
                checked={ocrEnabled}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  setOcrEnabled(checked);
                  try {
                    await window.api.settings.set('ocr_enabled', String(checked));
                  } catch {}
                }}
                className="sr-only"
              />
              <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ml-0.5 ${ocrEnabled ? 'translate-x-4' : ''}`}></span>
            </div>
            <span className="text-sm text-gray-600">
              {ocrEnabled ? '已启用' : '未启用'}
            </span>
          </label>
          <p className="mt-2 text-xs text-gray-400">
            首次使用需下载 Tesseract 语言包（约 30MB），识别速度取决于图片大小与内容复杂度。
          </p>
        </section>

        {/* ── 数据导入 ─────────────────────────────────────────── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">数据导入</h2>
          </div>
          <p className="mb-4 text-sm text-gray-500">从其他工具导入知识库数据。</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={importing}
              onClick={async () => {
                try {
                  const dirPath = await window.api.file.selectDirectory();
                  if (!dirPath) return;
                  setImporting(true);
                  setImportResult(null);
                  const result = await window.api.import.obsidianVault(dirPath);
                  setImportResult(`Obsidian: 共 ${result.total} 个文件，成功导入 ${result.imported} 个${result.errors.length > 0 ? `，${result.errors.length} 个失败` : ''}`);
                } catch (err: any) {
                  setImportResult('导入失败: ' + (err?.message ?? '未知错误'));
                } finally { setImporting(false); }
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              {importing ? '导入中...' : '导入 Obsidian Vault'}
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={async () => {
                try {
                  const dirPath = await window.api.file.selectDirectory();
                  if (!dirPath) return;
                  setImporting(true);
                  setImportResult(null);
                  const result = await window.api.import.bookmarks(dirPath);
                  setImportResult(`书签: 共 ${result.total} 条，成功导入 ${result.imported} 条${result.errors.length > 0 ? `，${result.errors.length} 条失败` : ''}`);
                } catch (err: any) {
                  setImportResult('导入失败: ' + (err?.message ?? '未知错误'));
                } finally { setImporting(false); }
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Globe className="h-4 w-4" />
              {importing ? '导入中...' : '导入浏览器书签（选择 HTML 文件）'}
            </button>
          </div>
          {importResult && (
            <div className={`mt-3 rounded-md px-3 py-2 text-sm ${importResult.includes('失败') ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
              {importResult}
            </div>
          )}
        </section>

        {/* ── WebDAV 同步 ─────────────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Cloud className="h-5 w-5 text-sky-500" />
            <h2 className="text-lg font-semibold text-gray-800">WebDAV 备份/同步</h2>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            备份整库为 ZIP 推送到坚果云、Nextcloud 等 WebDAV 存储。
            {webdavLastSyncAt && (
              <span className="ml-2 text-xs text-gray-400">
                上次备份：{new Date(webdavLastSyncAt).toLocaleString()}
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-gray-500">WebDAV URL</label>
              <input
                type="text"
                value={webdavCfg.url}
                onChange={(e) => setWebdavCfg({ ...webdavCfg, url: e.target.value })}
                className={inputClass}
                placeholder="https://dav.jianguoyun.com/dav/"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">用户名</label>
              <input
                type="text"
                value={webdavCfg.username}
                onChange={(e) => setWebdavCfg({ ...webdavCfg, username: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">密码 / 应用密码</label>
              <input
                type="password"
                value={webdavCfg.password}
                onChange={(e) => setWebdavCfg({ ...webdavCfg, password: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-gray-500">远端目录</label>
              <input
                type="text"
                value={webdavCfg.remotePath}
                onChange={(e) => setWebdavCfg({ ...webdavCfg, remotePath: e.target.value })}
                className={inputClass}
                placeholder="/knowledge-base"
              />
            </div>
          </div>

          {webdavStatus && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-sm ${
                webdavStatus.ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}
            >
              {webdavStatus.msg}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={webdavBusy}
              onClick={async () => {
                setWebdavBusy(true);
                setWebdavStatus(null);
                try {
                  await (window.api as any).sync.saveWebdavConfig(webdavCfg);
                  await (window.api as any).sync.webdavTest(webdavCfg);
                  setWebdavStatus({ ok: true, msg: '连接成功' });
                } catch (err: any) {
                  setWebdavStatus({ ok: false, msg: err?.message ?? '连接失败' });
                } finally {
                  setWebdavBusy(false);
                }
              }}
              className="rounded-md border border-sky-500 px-3 py-1.5 text-sm text-sky-600 hover:bg-sky-50 disabled:opacity-50"
            >
              {webdavBusy ? '处理中...' : '保存并测试连接'}
            </button>
            <button
              type="button"
              disabled={webdavBusy}
              onClick={async () => {
                setWebdavBusy(true);
                setWebdavStatus(null);
                try {
                  const result = await (window.api as any).sync.webdavBackup(webdavCfg);
                  setWebdavStatus({ ok: true, msg: `备份完成: ${result.remoteFile}` });
                  setWebdavLastSyncAt(new Date().toISOString());
                } catch (err: any) {
                  setWebdavStatus({ ok: false, msg: err?.message ?? '备份失败' });
                } finally {
                  setWebdavBusy(false);
                }
              }}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              立即备份整库
            </button>
            <button
              type="button"
              disabled={webdavBusy}
              onClick={async () => {
                setWebdavBusy(true);
                setWebdavStatus(null);
                try {
                  const list = await (window.api as any).sync.webdavList(webdavCfg);
                  if (!list || list.length === 0) {
                    setWebdavStatus({ ok: false, msg: '远端无备份文件' });
                    return;
                  }
                  const choice = window.prompt(
                    '选择要下载的备份（输入完整文件名）:\n' +
                      list.map((f: any) => `${f.name}（${(f.size / 1024).toFixed(1)} KB）`).join('\n'),
                    list[0].name,
                  );
                  if (!choice) return;
                  const r = await (window.api as any).sync.webdavDownload(choice, webdavCfg);
                  setWebdavStatus({ ok: true, msg: `已下载到: ${r.localPath}` });
                } catch (err: any) {
                  setWebdavStatus({ ok: false, msg: err?.message ?? '下载失败' });
                } finally {
                  setWebdavBusy(false);
                }
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              下载远端备份
            </button>
          </div>
        </section>

        {/* ── Git 同步 ────────────────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-violet-500" />
            <h2 className="text-lg font-semibold text-gray-800">Git 同步</h2>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            导出条目为 Markdown 后通过 isomorphic-git 推送到 GitHub/Gitee/GitLab。
            {gitLastSyncAt && (
              <span className="ml-2 text-xs text-gray-400">
                上次推送：{new Date(gitLastSyncAt).toLocaleString()}
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-gray-500">仓库 URL（HTTPS）</label>
              <input
                type="text"
                value={gitCfg.remoteUrl}
                onChange={(e) => setGitCfg({ ...gitCfg, remoteUrl: e.target.value })}
                className={inputClass}
                placeholder="https://github.com/yourname/knowledge-base.git"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">分支</label>
              <input
                type="text"
                value={gitCfg.branch}
                onChange={(e) => setGitCfg({ ...gitCfg, branch: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">用户名（可选）</label>
              <input
                type="text"
                value={gitCfg.username}
                onChange={(e) => setGitCfg({ ...gitCfg, username: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs text-gray-500">Personal Access Token</label>
              <input
                type="password"
                value={gitCfg.token}
                onChange={(e) => setGitCfg({ ...gitCfg, token: e.target.value })}
                className={inputClass}
                placeholder="ghp_xxxxxxxxxxxx"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Author Name</label>
              <input
                type="text"
                value={gitCfg.authorName}
                onChange={(e) => setGitCfg({ ...gitCfg, authorName: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-500">Author Email</label>
              <input
                type="email"
                value={gitCfg.authorEmail}
                onChange={(e) => setGitCfg({ ...gitCfg, authorEmail: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          {gitStatus && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-sm ${
                gitStatus.ok ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}
            >
              {gitStatus.msg}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={gitBusy}
              onClick={async () => {
                setGitBusy(true);
                setGitStatus(null);
                try {
                  await (window.api as any).sync.saveGitConfig(gitCfg);
                  setGitStatus({ ok: true, msg: '配置已保存' });
                } catch (err: any) {
                  setGitStatus({ ok: false, msg: err?.message ?? '保存失败' });
                } finally {
                  setGitBusy(false);
                }
              }}
              className="rounded-md border border-violet-500 px-3 py-1.5 text-sm text-violet-600 hover:bg-violet-50 disabled:opacity-50"
            >
              保存配置
            </button>
            <button
              type="button"
              disabled={gitBusy}
              onClick={async () => {
                setGitBusy(true);
                setGitStatus(null);
                try {
                  await (window.api as any).sync.saveGitConfig(gitCfg);
                  const r = await (window.api as any).sync.gitPush(gitCfg);
                  if (r.pushed) {
                    setGitStatus({
                      ok: true,
                      msg: `推送成功（commit: ${String(r.commitOid).slice(0, 7)}）`,
                    });
                  } else {
                    const errDetail = r.pushError ? `\n错误详情：${r.pushError}` : '';
                    setGitStatus({
                      ok: false,
                      msg: `已提交但 push 失败（commit: ${String(r.commitOid).slice(0, 7)}）\n请检查 Token 是否有效、是否过期、是否有仓库权限。${errDetail}`,
                    });
                  }
                  setGitLastSyncAt(new Date().toISOString());
                } catch (err: any) {
                  setGitStatus({ ok: false, msg: err?.message ?? '推送失败' });
                } finally {
                  setGitBusy(false);
                }
              }}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              提交 + 推送
            </button>
          </div>
        </section>

        {/* ── 完整网页存档 ─────────────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Archive className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-800">完整网页存档</h2>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            后台启动隐藏 Chromium 加载页面，内联 CSS 与图片为 Data URL，移除 JS，离线可读。
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={archiveUrl}
              onChange={(e) => setArchiveUrl(e.target.value)}
              className={inputClass}
              placeholder="https://example.com/article"
            />
            <button
              type="button"
              disabled={archiveBusy || !archiveUrl.trim()}
              onClick={async () => {
                setArchiveBusy(true);
                setArchiveResult(null);
                try {
                  const r: any = await (window.api as any).import.archiveUrl(archiveUrl.trim());
                  setArchiveResult(`存档成功（条目 #${r.id}）：${r.title}`);
                  setArchiveUrl('');
                } catch (err: any) {
                  setArchiveResult('存档失败：' + (err?.message ?? '未知错误'));
                } finally {
                  setArchiveBusy(false);
                }
              }}
              className="flex-shrink-0 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {archiveBusy ? '存档中...' : '完整存档'}
            </button>
          </div>
          {archiveResult && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-sm ${
                archiveResult.includes('失败') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
              }`}
            >
              {archiveResult}
            </div>
          )}
        </section>

        {/* ── 知识来源 ─────────────────────────────────────────── */}
        <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Rss className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-semibold text-gray-800">知识来源</h2>
          </div>

          <p className="mb-4 text-sm text-gray-500">
            管理 RSS 订阅源和 GitHub Trending，获取 AI 技术领域的最新内容。
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={trendingLoading}
              onClick={async () => {
                setTrendingLoading(true);
                setTrendingMessage(null);
                try {
                  const res = await window.api.feed.syncGitHubTrending();
                  if (res?.success === false) {
                    setTrendingMessage({ ok: false, msg: res.error || '同步失败' });
                  } else {
                    setTrendingMessage({ ok: true, msg: '同步成功' });
                  }
                } catch (err) {
                  setTrendingMessage({ ok: false, msg: '同步失败' });
                } finally {
                  setTrendingLoading(false);
                }
              }}
              className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              {trendingLoading ? '同步中...' : '启用 GitHub Trending'}
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/feed';
              }}
              className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              前往知识流管理知识源
            </button>
          </div>

          {trendingMessage && (
            <p className={`mt-3 text-sm ${trendingMessage.ok ? 'text-green-600' : 'text-red-600'}`}>
              {trendingMessage.msg}
            </p>
          )}
        </section>

        {/* ── 关于 ─────────────────────────────────────────────── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-800">关于</h2>
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>应用名称</span>
              <span className="font-medium text-gray-800">知识库</span>
            </div>
            <div className="flex items-center justify-between">
              <span>版本</span>
              <span className="font-medium text-gray-800">1.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span>技术栈</span>
              <span className="font-medium text-gray-800">Electron + React + TypeScript</span>
            </div>
          </div>
        </section>
      </div>
  );
};

export default SettingsView;
