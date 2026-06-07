# mcp-drawdb

[English](./README.md)

drawdb 的 MCP 服务器 —— 让 AI 助手（Claude Code、Cursor 等）直接读取和修改浏览器中的数据库设计图。

## 工作原理

```
Claude Code  ──stdio──►  npx mcp-drawdb  ──ws──►  Relay（内嵌）  ◄──ws──  浏览器（drawdb）
```

- **npx mcp-drawdb** 内部自动启动 WebSocket 中继服务器（端口从 3001 自动递增），同时作为客户端连接
- **drawdb** 浏览器端连接中继，将图表状态暴露给工具调用
- 中继在 Claude Code 和浏览器之间路由消息

无需单独启动中继 —— 一切都在 MCP 桥接进程内完成。

## 快速开始

### 1. 配置 Claude Code

在 `claude_desktop_config.json` 或 `.claude/settings.json` 中添加：

```json
{
  "mcpServers": {
    "drawdb": {
      "command": "npx",
      "args": ["mcp-drawdb"]
    }
  }
}
```

### 2. 打开 drawdb.icen.ai

打开 [drawdb.icen.ai](https://drawdb.icen.ai)，顶部出现绿色 **MCP** 圆点即表示已连接。

> **灰色圆点？** 中继端口可能不是 3001。点击 MCP 圆点修改 WebSocket 地址。中继会自动尝试 3001–3011 端口，启动时会打印实际端口。

### 3. 完成

Claude Code 现在可以读写你的设计图了。试试：

```
"列出当前设计图的所有表"
"添加一个 users 表，包含 id、email、name 字段"
"创建从 users.id 到 posts.user_id 的外键关系"
"导出 MySQL 的 DDL SQL"
```

## 工具列表（14 个）

| 工具 | 说明 |
|------|------|
| `ping` | 测试与浏览器的连接 |
| `list_tables` | 列出所有表及其字段 |
| `get_diagram` | 完整设计图概览：表、字段、布局坐标(x/y/w/h)、关系、数据库类型 |
| `add_table` | 添加表（含字段、颜色、注释） |
| `update_table` | 更新表：重命名、增删改字段，完整属性控制 |
| `delete_table` | 删除表（级联删除相关关系） |
| `add_relationship` | 添加外键关系，支持基数（`1:1`、`1:n`、`n:1`、`n:m`）和约束规则 |
| `delete_relationship` | 删除关系 |
| `set_layout` | 调整表在画布上的位置 |
| `set_database` | 切换数据库类型（mysql、postgresql、sqlite、mariadb、transactsql、oraclesql、generic） |
| `get_issues` | 校验设计图：重名、缺少主键、类型不匹配等 |
| `export_sql` | 生成目标数据库的 DDL SQL |
| `clear_diagram` | 清空所有表和关系 |
| `undo` | 查看撤销栈中的上一个操作 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `RELAY_URL` | *（内嵌）* | 连接外部中继而非启动内嵌的 |
| `PORT` | `3001` | 中继起始端口（被占用时自动递增） |
| `HOST` | `0.0.0.0` | 中继监听地址 |
| `CORS_ORIGIN` | `*` | 中继 HTTP 端点的 CORS 来源 |

## 字段属性

使用 `add_table`、`update_table` 时，每个字段支持：

| 属性 | 类型 | 说明 |
|------|------|------|
| `name` | string | 列名 |
| `type` | string | SQL 类型（INT、VARCHAR、TEXT、DATETIME、ENUM 等） |
| `primary` | boolean | 主键 |
| `unique` | boolean | 唯一约束 |
| `nullable` | boolean | 允许 NULL（false = NOT NULL） |
| `increment` | boolean | 自增 |
| `unsigned` | boolean | 无符号（数值类型） |
| `default_value` | string | 默认值 |
| `check` | string | CHECK 约束表达式 |
| `comment` | string | 列注释 |
| `size` | string | 类型大小/精度（如 "255" 表示 VARCHAR(255)） |
| `values` | string[] | ENUM/SET 的可选值 |

## 常见问题

**HTTPS 下能用 `ws://localhost` 吗？** 所有主流浏览器将 localhost 排除在混合内容限制之外，从 `https://drawdb.icen.ai` 连接 `ws://localhost` 不需要 `wss://`。

**端口 3001 被占用？** 中继会自动尝试 3001–3011 端口。如果用的是 3002，点击 drawdb.icen.ai 顶部的 MCP 圆点修改地址即可。

## 独立中继

高级场景（Docker、共享服务器）可以单独运行中继：

```bash
npx mcp-drawdb-relay
```

然后配置桥接使用外部中继：

```json
{
  "mcpServers": {
    "drawdb": {
      "command": "npx",
      "args": ["mcp-drawdb"],
      "env": {
        "RELAY_URL": "ws://your-server:3001"
      }
    }
  }
}
```

## 系统要求

- Node.js >= 18
- 带有 MCP 集成的 drawdb（浏览器端 WebSocket 客户端）
- 浏览器中打开 drawdb 页面

## 许可证

MIT
