-- ============================================================
-- 知识库数据库初始化脚本
-- Migration: 001_init
-- Description: 创建知识库应用所需的所有基础表结构
-- ============================================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS `knowledge_base`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `knowledge_base`;

-- ============================================================
-- 文件夹表
-- 用于组织知识条目的树形目录结构
-- ============================================================
CREATE TABLE IF NOT EXISTS `folders` (
  `id` BIGINT AUTO_INCREMENT COMMENT '文件夹ID',
  `parent_id` BIGINT NULL COMMENT '父文件夹ID，NULL表示根文件夹',
  `name` VARCHAR(255) NOT NULL COMMENT '文件夹名称',
  `description` TEXT NULL COMMENT '文件夹描述',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序顺序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_folders_parent_id` (`parent_id`),
  CONSTRAINT `fk_folders_parent`
    FOREIGN KEY (`parent_id`) REFERENCES `folders` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='文件夹表';

-- ============================================================
-- 标签表
-- 用于对知识条目进行分类标记
-- ============================================================
CREATE TABLE IF NOT EXISTS `tags` (
  `id` BIGINT AUTO_INCREMENT COMMENT '标签ID',
  `name` VARCHAR(100) NOT NULL COMMENT '标签名称',
  `color` VARCHAR(7) NOT NULL DEFAULT '#3B82F6' COMMENT '标签颜色（十六进制）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_tags_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='标签表';

-- ============================================================
-- 知识条目表
-- 存储所有知识内容的核心表
-- ============================================================
CREATE TABLE IF NOT EXISTS `items` (
  `id` BIGINT AUTO_INCREMENT COMMENT '条目ID',
  `title` VARCHAR(500) NOT NULL COMMENT '标题',
  `content` LONGTEXT NULL COMMENT '原始内容（Markdown格式）',
  `content_html` LONGTEXT NULL COMMENT '渲染后的HTML内容',
  `summary` VARCHAR(1000) NULL COMMENT '内容摘要',
  `content_type` ENUM('note', 'article', 'bookmark', 'file', 'code', 'image', 'other') NOT NULL DEFAULT 'note' COMMENT '内容类型',
  `source_url` VARCHAR(2048) NULL COMMENT '来源URL',
  `source_type` ENUM('web', 'file', 'clipboard', 'api', 'import', 'manual') NULL COMMENT '来源类型',
  `source_name` VARCHAR(500) NULL COMMENT '来源名称（如网站标题）',
  `file_path` VARCHAR(2048) NULL COMMENT '关联文件路径',
  `file_size` BIGINT NULL COMMENT '文件大小（字节）',
  `mime_type` VARCHAR(255) NULL COMMENT '文件MIME类型',
  `folder_id` BIGINT NULL COMMENT '所属文件夹ID',
  `is_favorite` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否收藏',
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否归档',
  `metadata` JSON NULL COMMENT '扩展元数据（JSON格式）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  INDEX `idx_items_folder_id` (`folder_id`),
  INDEX `idx_items_content_type` (`content_type`),
  INDEX `idx_items_is_favorite` (`is_favorite`),
  INDEX `idx_items_is_archived` (`is_archived`),
  INDEX `idx_items_created_at` (`created_at`),
  INDEX `idx_items_updated_at` (`updated_at`),
  INDEX `idx_items_source_type` (`source_type`),
  FULLTEXT INDEX `ft_items_search` (`title`, `content`, `summary`) WITH PARSER ngram,
  CONSTRAINT `fk_items_folder`
    FOREIGN KEY (`folder_id`) REFERENCES `folders` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识条目表';

-- ============================================================
-- 条目标签关联表
-- 多对多关系：一个条目可以有多个标签，一个标签可以标记多个条目
-- ============================================================
CREATE TABLE IF NOT EXISTS `item_tags` (
  `item_id` BIGINT NOT NULL COMMENT '条目ID',
  `tag_id` BIGINT NOT NULL COMMENT '标签ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '关联创建时间',
  PRIMARY KEY (`item_id`, `tag_id`),
  INDEX `idx_item_tags_tag_id` (`tag_id`),
  CONSTRAINT `fk_item_tags_item`
    FOREIGN KEY (`item_id`) REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_item_tags_tag`
    FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='条目标签关联表';

-- ============================================================
-- 附件表
-- 存储与知识条目关联的附件文件信息
-- ============================================================
CREATE TABLE IF NOT EXISTS `attachments` (
  `id` BIGINT AUTO_INCREMENT COMMENT '附件ID',
  `item_id` BIGINT NOT NULL COMMENT '所属条目ID',
  `file_name` VARCHAR(500) NOT NULL COMMENT '文件名',
  `file_path` VARCHAR(2048) NOT NULL COMMENT '文件存储路径',
  `file_size` BIGINT NOT NULL COMMENT '文件大小（字节）',
  `mime_type` VARCHAR(255) NULL COMMENT '文件MIME类型',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序顺序',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  INDEX `idx_attachments_item_id` (`item_id`),
  CONSTRAINT `fk_attachments_item`
    FOREIGN KEY (`item_id`) REFERENCES `items` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='附件表';

-- ============================================================
-- 系统设置表
-- 存储应用的键值对配置
-- ============================================================
CREATE TABLE IF NOT EXISTS `settings` (
  `key_name` VARCHAR(100) NOT NULL COMMENT '设置键名',
  `value` TEXT NULL COMMENT '设置值',
  `type` ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string' COMMENT '值类型',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`key_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统设置表';
