/**
 * 数据库迁移运行器
 *
 * 负责执行 SQL 迁移脚本，跟踪已执行的迁移
 * SQL 内容内联，避免打包后文件路径问题
 */

import { Pool, RowDataPacket } from 'mysql2/promise';
import { logger } from '../../utils/logger';
import { getPool } from '../connection';

/** 迁移记录接口 */
interface MigrationRecord {
  id: number;
  name: string;
  executed_at: Date;
}

/** 迁移定义：名称 + SQL 内容 */
interface Migration {
  name: string;
  sql: string | string[];
}

/** 所有迁移（SQL 内联） */
const MIGRATIONS: Migration[] = [
  {
    name: '001_init',
    sql: `
CREATE DATABASE IF NOT EXISTS \`knowledge_base\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE \`knowledge_base\`;

CREATE TABLE IF NOT EXISTS \`folders\` (
  \`id\` BIGINT AUTO_INCREMENT COMMENT '文件夹ID',
  \`parent_id\` BIGINT NULL COMMENT '父文件夹ID，NULL表示根文件夹',
  \`name\` VARCHAR(255) NOT NULL COMMENT '文件夹名称',
  \`description\` TEXT NULL COMMENT '文件夹描述',
  \`sort_order\` INT NOT NULL DEFAULT 0 COMMENT '排序顺序',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (\`id\`),
  INDEX \`idx_folders_parent_id\` (\`parent_id\`),
  CONSTRAINT \`fk_folders_parent\`
    FOREIGN KEY (\`parent_id\`) REFERENCES \`folders\` (\`id\`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件夹表';

CREATE TABLE IF NOT EXISTS \`tags\` (
  \`id\` BIGINT AUTO_INCREMENT COMMENT '标签ID',
  \`name\` VARCHAR(100) NOT NULL COMMENT '标签名称',
  \`color\` VARCHAR(7) NOT NULL DEFAULT '#3B82F6' COMMENT '标签颜色',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`idx_tags_name_unique\` (\`name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签表';

CREATE TABLE IF NOT EXISTS \`items\` (
  \`id\` BIGINT AUTO_INCREMENT COMMENT '条目ID',
  \`title\` VARCHAR(500) NOT NULL COMMENT '标题',
  \`content\` LONGTEXT NULL COMMENT 'Markdown正文',
  \`content_html\` LONGTEXT NULL COMMENT 'HTML内容',
  \`summary\` VARCHAR(1000) NULL COMMENT '摘要',
  \`content_type\` ENUM('note', 'article', 'bookmark', 'file', 'code', 'image', 'other') NOT NULL DEFAULT 'note' COMMENT '内容类型',
  \`source_url\` VARCHAR(2048) NULL COMMENT '来源URL',
  \`source_type\` ENUM('web', 'file', 'clipboard', 'api', 'import', 'manual') NULL COMMENT '来源类型',
  \`source_name\` VARCHAR(500) NULL COMMENT '来源名称',
  \`file_path\` VARCHAR(2048) NULL COMMENT '关联文件路径',
  \`file_size\` BIGINT NULL COMMENT '文件大小',
  \`mime_type\` VARCHAR(255) NULL COMMENT 'MIME类型',
  \`folder_id\` BIGINT NULL COMMENT '所属文件夹ID',
  \`is_favorite\` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否收藏',
  \`is_archived\` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否归档',
  \`metadata\` JSON NULL COMMENT '扩展元数据',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (\`id\`),
  INDEX \`idx_items_folder_id\` (\`folder_id\`),
  INDEX \`idx_items_content_type\` (\`content_type\`),
  INDEX \`idx_items_is_favorite\` (\`is_favorite\`),
  INDEX \`idx_items_is_archived\` (\`is_archived\`),
  INDEX \`idx_items_created_at\` (\`created_at\`),
  INDEX \`idx_items_updated_at\` (\`updated_at\`),
  INDEX \`idx_items_source_type\` (\`source_type\`),
  FULLTEXT INDEX \`ft_items_search\` (\`title\`, \`content\`, \`summary\`) WITH PARSER ngram,
  CONSTRAINT \`fk_items_folder\`
    FOREIGN KEY (\`folder_id\`) REFERENCES \`folders\` (\`id\`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识条目表';

CREATE TABLE IF NOT EXISTS \`item_tags\` (
  \`item_id\` BIGINT NOT NULL COMMENT '条目ID',
  \`tag_id\` BIGINT NOT NULL COMMENT '标签ID',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '关联时间',
  PRIMARY KEY (\`item_id\`, \`tag_id\`),
  INDEX \`idx_item_tags_tag_id\` (\`tag_id\`),
  CONSTRAINT \`fk_item_tags_item\`
    FOREIGN KEY (\`item_id\`) REFERENCES \`items\` (\`id\`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT \`fk_item_tags_tag\`
    FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\` (\`id\`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='条目标签关联表';

CREATE TABLE IF NOT EXISTS \`attachments\` (
  \`id\` BIGINT AUTO_INCREMENT COMMENT '附件ID',
  \`item_id\` BIGINT NOT NULL COMMENT '所属条目ID',
  \`file_name\` VARCHAR(500) NOT NULL COMMENT '文件名',
  \`file_path\` VARCHAR(2048) NOT NULL COMMENT '文件路径',
  \`file_size\` BIGINT NOT NULL COMMENT '文件大小',
  \`mime_type\` VARCHAR(255) NULL COMMENT 'MIME类型',
  \`sort_order\` INT NOT NULL DEFAULT 0 COMMENT '排序',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (\`id\`),
  INDEX \`idx_attachments_item_id\` (\`item_id\`),
  CONSTRAINT \`fk_attachments_item\`
    FOREIGN KEY (\`item_id\`) REFERENCES \`items\` (\`id\`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='附件表';

CREATE TABLE IF NOT EXISTS \`settings\` (
  \`key_name\` VARCHAR(100) NOT NULL COMMENT '设置键名',
  \`value\` TEXT NULL COMMENT '设置值',
  \`type\` ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string' COMMENT '值类型',
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (\`key_name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统设置表';
`.trim()
  },
  {
    name: '002_fix_content_types',
    sql: `
UPDATE items SET content_type = 'note' WHERE content_type = 'file' AND source_name LIKE '%.txt';
UPDATE items SET content_type = 'note' WHERE content_type = 'file' AND source_name LIKE '%.md';
UPDATE items SET content_type = 'article' WHERE content_type = 'file' AND (source_name LIKE '%.html' OR source_name LIKE '%.htm');
UPDATE items SET content_type = 'code' WHERE content_type = 'file' AND (source_name LIKE '%.js' OR source_name LIKE '%.ts' OR source_name LIKE '%.py' OR source_name LIKE '%.java' OR source_name LIKE '%.c' OR source_name LIKE '%.cpp' OR source_name LIKE '%.go' OR source_name LIKE '%.rs' OR source_name LIKE '%.css' OR source_name LIKE '%.json' OR source_name LIKE '%.xml' OR source_name LIKE '%.sql' OR source_name LIKE '%.yaml' OR source_name LIKE '%.yml' OR source_name LIKE '%.sh' OR source_name LIKE '%.bat');
UPDATE items SET content_type = 'image' WHERE content_type = 'file' AND (source_name LIKE '%.jpg' OR source_name LIKE '%.jpeg' OR source_name LIKE '%.png' OR source_name LIKE '%.gif' OR source_name LIKE '%.bmp' OR source_name LIKE '%.svg' OR source_name LIKE '%.webp');
    `.trim()
  },
  {
    name: '003_soft_delete',
    sql: `
ALTER TABLE items ADD COLUMN deleted_at DATETIME NULL COMMENT '软删除时间';
ALTER TABLE items ADD INDEX idx_items_deleted_at (deleted_at);
    `.trim()
  },
  {
    name: '004_pinned',
    sql: `
ALTER TABLE items ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否置顶';
ALTER TABLE items ADD INDEX idx_items_is_pinned (is_pinned);
    `.trim()
  },
  {
    name: '005_item_links',
    sql: `
CREATE TABLE IF NOT EXISTS \`item_links\` (
  \`id\` BIGINT AUTO_INCREMENT COMMENT '关联ID',
  \`source_item_id\` BIGINT NOT NULL COMMENT '源条目ID（引用者）',
  \`target_item_id\` BIGINT NOT NULL COMMENT '目标条目ID（被引用者）',
  \`link_text\` VARCHAR(500) NULL COMMENT '链接显示文本',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`uk_item_links\` (\`source_item_id\`, \`target_item_id\`),
  INDEX \`idx_item_links_source\` (\`source_item_id\`),
  INDEX \`idx_item_links_target\` (\`target_item_id\`),
  CONSTRAINT \`fk_item_links_source\`
    FOREIGN KEY (\`source_item_id\`) REFERENCES \`items\` (\`id\`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT \`fk_item_links_target\`
    FOREIGN KEY (\`target_item_id\`) REFERENCES \`items\` (\`id\`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='条目关联表（双向链接）';
    `.trim()
  },
  {
    name: '006_item_revisions',
    sql: `
CREATE TABLE IF NOT EXISTS \`item_revisions\` (
  \`id\` BIGINT AUTO_INCREMENT COMMENT '修订ID',
  \`item_id\` BIGINT NOT NULL COMMENT '条目ID',
  \`title\` VARCHAR(500) NULL COMMENT '当时的标题',
  \`content\` LONGTEXT NULL COMMENT '当时的内容',
  \`content_hash\` VARCHAR(64) NULL COMMENT '内容SHA256哈希',
  \`revision_number\` INT NOT NULL DEFAULT 1 COMMENT '修订编号',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (\`id\`),
  INDEX \`idx_item_revisions_item\` (\`item_id\`, \`revision_number\`),
  CONSTRAINT \`fk_item_revisions_item\`
    FOREIGN KEY (\`item_id\`) REFERENCES \`items\` (\`id\`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='条目修订历史表';
    `.trim()
  },
  {
    name: '007_templates',
    sql: `
ALTER TABLE items ADD COLUMN is_template TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否为模板';
ALTER TABLE items ADD COLUMN template_category VARCHAR(100) NULL COMMENT '模板分类';
ALTER TABLE items ADD INDEX idx_items_is_template (is_template);
    `.trim()
  },
  {
    name: '008_daily_note',
    sql: `
ALTER TABLE items ADD COLUMN daily_date DATE NULL COMMENT '每日笔记日期';
ALTER TABLE items ADD INDEX idx_items_daily_date (daily_date);
    `.trim()
  },
  {
    name: '009_reading_progress',
    sql: `
ALTER TABLE items ADD COLUMN reading_progress DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT '阅读进度百分比';
ALTER TABLE items ADD INDEX idx_items_reading_progress (reading_progress);
    `.trim()
  },
  {
    name: '010_feed_sources_and_items',
    sql: `
CREATE TABLE IF NOT EXISTS \`feed_sources\` (
  \`id\` BIGINT AUTO_INCREMENT COMMENT '订阅源ID',
  \`name\` VARCHAR(255) NOT NULL COMMENT '订阅源名称',
  \`url\` VARCHAR(2048) NOT NULL COMMENT 'Feed URL 或 GitHub API URL',
  \`type\` ENUM('rss', 'github') NOT NULL DEFAULT 'rss' COMMENT '来源类型',
  \`description\` TEXT NULL COMMENT '订阅源描述',
  \`icon_url\` VARCHAR(2048) NULL COMMENT '图标URL',
  \`site_url\` VARCHAR(2048) NULL COMMENT '网站URL',
  \`enabled\` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  \`fetch_interval_minutes\` INT NOT NULL DEFAULT 60 COMMENT '拉取间隔（分钟）',
  \`last_fetched_at\` DATETIME NULL COMMENT '上次拉取时间',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (\`id\`),
  INDEX \`idx_feed_sources_type\` (\`type\`),
  INDEX \`idx_feed_sources_enabled\` (\`enabled\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订阅源表';

CREATE TABLE IF NOT EXISTS \`feed_items\` (
  \`id\` BIGINT AUTO_INCREMENT COMMENT '条目ID',
  \`source_id\` BIGINT NOT NULL COMMENT '所属订阅源ID',
  \`title\` VARCHAR(500) NOT NULL COMMENT '标题',
  \`url\` VARCHAR(2048) NOT NULL COMMENT '原文URL',
  \`summary\` TEXT NULL COMMENT '摘要',
  \`author\` VARCHAR(255) NULL COMMENT '作者',
  \`published_at\` DATETIME NULL COMMENT '发布时间',
  \`content_hash\` VARCHAR(64) NULL COMMENT '内容哈希（去重用）',
  \`imported_item_id\` BIGINT NULL COMMENT '入库后的知识条目ID',
  \`metadata\` JSON NULL COMMENT '扩展元数据',
  \`is_read\` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已读',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (\`id\`),
  INDEX \`idx_feed_items_source_id\` (\`source_id\`),
  INDEX \`idx_feed_items_published_at\` (\`published_at\`),
  INDEX \`idx_feed_items_imported\` (\`imported_item_id\`),
  INDEX \`idx_feed_items_url\` (\`url\`(500)),
  CONSTRAINT \`fk_feed_items_source\`
    FOREIGN KEY (\`source_id\`) REFERENCES \`feed_sources\` (\`id\`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订阅条目表';

ALTER TABLE items MODIFY COLUMN \`source_type\` ENUM('web', 'file', 'clipboard', 'api', 'import', 'manual', 'rss', 'github') NULL COMMENT '来源类型';
    `.trim()
  },
  {
    name: '011_update_github_sources_to_trending',
    sql: [
      `UPDATE feed_sources SET url = 'https://github.com/trending?since=weekly', name = 'GitHub Trending (Weekly)' WHERE type = 'github'`,
    ],
  },
  {
    name: '012_cleanup_orphaned_imported_item_ids',
    sql: [
      `UPDATE feed_items SET imported_item_id = NULL WHERE imported_item_id IS NOT NULL AND imported_item_id NOT IN (SELECT id FROM items)`,
    ],
  },
  {
    name: '013_add_feed_source_category',
    sql: `ALTER TABLE feed_sources ADD COLUMN category VARCHAR(100) NULL COMMENT '知识源分类'`,
  },
  {
    name: '014_alter_items_summary_to_text',
    sql: `ALTER TABLE items MODIFY COLUMN summary TEXT NULL COMMENT '摘要'`,
  },
  {
    name: '015_alter_feed_items_summary_to_text',
    sql: `ALTER TABLE feed_items MODIFY COLUMN summary TEXT NULL COMMENT '摘要'`,
  },
  {
    name: '016_add_feed_source_error_tracking',
    sql: [
      `ALTER TABLE feed_sources ADD COLUMN fail_count INT NOT NULL DEFAULT 0 COMMENT '连续失败次数'`,
      `ALTER TABLE feed_sources ADD COLUMN last_error VARCHAR(500) NULL COMMENT '最近错误信息'`,
    ],
  },
  {
    name: '017_alter_feed_items_author_to_text',
    sql: [
      `ALTER TABLE feed_items MODIFY COLUMN author VARCHAR(500) NULL COMMENT '作者'`,
      `ALTER TABLE items MODIFY COLUMN author VARCHAR(500) NULL COMMENT '作者'`,
    ],
  }
];

/**
 * 确保迁移跟踪表存在
 */
async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`_migrations\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`name\` VARCHAR(255) NOT NULL UNIQUE COMMENT '迁移名称',
      \`executed_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * 获取已执行的迁移列表
 */
async function getExecutedMigrations(pool: Pool): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT `name` FROM `_migrations` ORDER BY `id` ASC'
  );
  return (rows as MigrationRecord[]).map((row) => row.name);
}

/**
 * 记录已执行的迁移
 */
async function recordMigration(pool: Pool, name: string): Promise<void> {
  await pool.query('INSERT INTO `_migrations` (`name`) VALUES (?)', [name]);
}

/**
 * 执行单个迁移
 */
async function executeMigration(pool: Pool, migration: Migration): Promise<void> {
  logger.info(`正在执行迁移: ${migration.name}`);

  if (!migration.sql) {
    logger.warn(`迁移内容为空: ${migration.name}`);
    return;
  }

  const sqlList = Array.isArray(migration.sql) ? migration.sql : [migration.sql]
  const statements = sqlList
    .flatMap(s => s.split(';'))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await pool.query(stmt);
  }

  await recordMigration(pool, migration.name);
  logger.info(`迁移执行完成: ${migration.name}`);
}

/**
 * 运行所有待执行的数据库迁移
 */
export async function runMigrations(externalPool?: Pool): Promise<number> {
  const pool = externalPool || getPool();

  if (!pool) {
    throw new Error('数据库连接池未初始化，无法运行迁移');
  }

  let executedCount = 0;

  try {
    await ensureMigrationsTable(pool);

    const executed = await getExecutedMigrations(pool);
    const executedSet = new Set(executed);

    logger.info(`已执行 ${executed.length} 个迁移，共 ${MIGRATIONS.length} 个`);

    for (const migration of MIGRATIONS) {
      if (executedSet.has(migration.name)) {
        logger.info(`跳过已执行的迁移: ${migration.name}`);
        continue;
      }

      try {
        await executeMigration(pool, migration);
        executedCount++;
      } catch (error) {
        logger.error(`迁移执行失败: ${migration.name}`, error);
        throw new Error(`迁移 "${migration.name}" 执行失败: ${(error as Error).message}`);
      }
    }

    if (executedCount > 0) {
      logger.info(`成功执行 ${executedCount} 个迁移`);
    } else {
      logger.info('数据库已是最新版本，无需迁移');
    }
  } catch (error) {
    logger.error('迁移过程中发生错误:', error);
    throw error;
  }

  return executedCount;
}

/**
 * 获取当前数据库迁移版本
 */
export async function getCurrentMigration(externalPool?: Pool): Promise<string | null> {
  const pool = externalPool || getPool();

  if (!pool) {
    throw new Error('数据库连接池未初始化');
  }

  try {
    await ensureMigrationsTable(pool);
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT `name` FROM `_migrations` ORDER BY `id` DESC LIMIT 1'
    );
    return rows.length > 0 ? (rows as MigrationRecord[])[0].name : null;
  } catch (error) {
    logger.error('获取迁移版本失败:', error);
    return null;
  }
}
