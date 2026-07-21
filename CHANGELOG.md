# 变更日志

本文件记录项目功能与实现变更，按时间倒序排列。

---

## 2026-07-21 — 文件已存在改用业务码 409

### 类型

调整（浏览器上传接口约定）

### 摘要

「文件已存在」由 `code: 500` + 文案判断改为专用业务码 `409`；前端按 `code === 409` 计入跳过。

### 变更文件

| 文件 | 变更说明 |
|------|----------|
| `src/upload-static-server.js` | 文件已存在时返回 `code: 409` |
| `statics/upload-base.html` | 跳过判断改为 `result.code === 409` |
| `statics/upload-static.html` | 同上 |
| `technical-solution/浏览器文件夹上传方案.md` | 同步接口约定 |

### 接口变更

- **文件已存在**：`code` 由 `500` 改为 `409`（`message` 仍为「文件已存在」，仅作展示）

---

## 2026-07-21 — 浏览器支持文件夹上传

### 类型

增强（浏览器上传流程）

### 摘要

Web 上传页支持选择文件夹并按相对路径保留目录结构上传至 OSS；服务端扩展相对路径与冲突策略，并清理临时文件。CLI 未改动。

### 变更文件

| 文件 | 变更说明 |
|------|----------|
| `src/upload-static-server.js` | 支持 `relativePath`、`overwritePolicy`；正斜杠拼 OSS key；路径规范化防 `..`；兼容旧 `isReplace`；上传后清理临时文件 |
| `statics/upload-base.html` | 单文件/文件夹模式、预览、并发队列、冲突策略、进度汇总 → `/upload-base` |
| `statics/upload-static.html` | 同上 → `/upload-assets` |
| `方案/浏览器文件夹上传方案.md` | 新增完整方案文档 |
| `变更日志.md` | 新增本变更日志 |

### 接口变更

- **新增字段**
  - `relativePath`：文件在文件夹内的相对路径（缺省为原始文件名）
  - `overwritePolicy`：`skip`（默认）\| `overwrite`
- **兼容**：仍支持 `isReplace === 原始文件名` 触发覆盖
- **响应 data**：增加 `relativePath` 字段
- **端点路径**：无变化（`/upload-base`、`/upload-assets`）

### 使用说明

1. 启动：`npm run ali-oss`
2. 打开 `/upload-base.html`（根目录）或 `/upload-static.html`（`/assets/`）
3. 选择「文件夹」→ 选目录 → 配置冲突策略与并发 → 上传

### 备注

- 空目录不会出现在浏览器 FileList 中，本版不上传空目录占位文件
- 默认过滤 `.DS_Store`、`Thumbs.db`
