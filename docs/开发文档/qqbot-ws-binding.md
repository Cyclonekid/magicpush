# QQ Bot WebSocket 绑定功能 — 实现文档

## 📋 概述

**问题**: QQ Bot API 的 `group_openid` / `user_openid` 无法通过 REST API 主动查询，必须通过监听 WebSocket 事件被动获取。

**解决方案**: 参照元宝Bot的成熟架构，为QQBot实现了完整的 **WebSocket 绑定握手机制**。

## ✨ 用户流程

```
┌───────────────────────────────────────────────────────────────┐
│                     MagicPush 前端                             │
│                                                               │
│  1. 选择渠道类型 → "QQ机器人"                                   │
│  2. 填写 AppID + AppSecret                                    │
│  3. 点击"绑定并连接"                                           │
│       ↓                                                        │
│  ┌─────────────────────────────────┐                          │
│  │   QqbotBindDialog 弹窗          │                          │
│  │                                 │                          │
│  │   [连接中...]                    │ ← 自动连接 QQ WS 网关    │
│  │        ↓                        │                          │
│  │   [✅ 已连接]                    │                          │
│  │   请在QQ中 @机器人 发消息         │ ← 引导用户操作           │
│  │        ↓                        │                          │
│  │   [绑定成功!]                    │ ← 自动提取 OpenID        │
│  └─────────────────────────────────┘                          │
│                                                               │
│  渠道卡片显示: targetId=xxx (已自动填充)                         │
└───────────────────────────────────────────────────────────────┘
```

## 🏗️ 架构

### 新增文件（后端）

| 文件 | 说明 | 行数 | 参考 |
|------|------|------|------|
| `server/src/services/qqbot/ws-client.js` | QQ Bot WebSocket 客户端 | ~550 | 元宝bot ws-client.js |
| `server/src/services/qqbot/qqbot-monitor.js` | WS 连接监控服务（单例） | ~220 | 元宝bot monitor.js |
| `server/src/controllers/qqbot.controller.js` | 绑定状态查询 + 重试控制器 | ~120 | 元宝bot controller.js |
| `server/src/routes/qqbot.routes.js` | API 路由定义 | ~16 | 元宝bot routes.js |

### 新增文件（前端）

| 文件 | 说明 | 行数 | 参考 |
|------|------|------|------|
| `web/src/api/qqbot.js` | API 调用模块 | ~16 | api/yuanbaobot.js |
| `web/src/components/QqbotBindDialog.vue` | 绑定对话框组件 | ~300 | YuanbaobotBindDialog.vue |

### 修改的文件

| 文件 | 修改内容 |
|------|---------|
| `server/src/app.js` | 导入 qqbotMonitor，启动时调用 `qqbotMonitor.start()` |
| `server/src/routes/index.js` | 注册 qqbot 路由到 `/api/qqbot` |
| `web/src/views/channels/List.vue` | 集成 QqbotBindDialog，添加重新绑定按钮、绑定引导、自动打开弹窗逻辑 |

## 🔌 API 端点

### GET /api/qqbot/bind/:channelId/status
查询渠道绑定状态。

**响应示例:**
```json
{
  "success": true,
  "data": {
    "bound": true,
    "targetId": "C9F778FE6ADF9D1D1DBE395BF744A33A",
    "targetIdDisplay": "C9F778FE6ADF9D1...",
    "msgType": "group",
    "senderNickname": "张三",
    "connectionState": "connected",
    "botInfo": { "id": "1234567890" }
  }
}
```

### POST /api/qqbot/bind/:channelId/retry
重试绑定（清除已有 OpenID，重新监听入站消息）。

## 📡 支持的事件类型与OpenID提取

| 事件类型 | 场景 | 提取的字段 | 用途 |
|----------|------|-----------|------|
| `C2C_MESSAGE_CREATE` | 单聊 | `author.user_openid` | C2C 推送 |
| `GROUP_AT_MESSAGE_CREATE` | 群聊@机器人 | `group_openid` + `author.member_openid` | 群聊推送 |
| `GROUP_MESSAGE_CREATE` | 群聊全量 | 同上 | 群聊推送 |
| `AT_MESSAGE_CREATE` | 频道@ | `channel_id` + `guild_id` | 子频道推送 |
| `MESSAGE_CREATE` | 频道全量 | 同上 | 子频道推送 |
| `DIRECT_MESSAGE_CREATE` | 频道私信 | `author.id` + `guild_id` | 私信推送 |

## 🔧 技术细节

### WS 协议流程

```
客户端                              QQ 服务器
  │                                   │
  ├── 1. GET /gateway/bot ──────────► │  获取WS地址
  │◄── { url, resume_url } ────────── │
  │                                   │
  ├── 2. WebSocket Connect ─────────► │  建立连接
  │◄── Hello (op=10) ─────────────── │  含 heartbeat_interval
  │                                   │
  ├── 3. Identify (op=2) ──────────► │  Access Token 鉴权
  │     { token: "QQBot xxx", intents } │
  │                                   │
  │◄── READY (op=0, t="READY") ───── │  鉴权成功！
  │                                   │
  ├── 4. 心跳循环 ...                 │
  │    Heartbeat (op=1) ──────────►  │
  │    ◄── Heartbeat ACK (op=11) ──  │
  │                                   │
  │◄── C2C_MESSAGE_CREATE (op=0) ──  │  用户发消息了！
  │◄── GROUP_AT_MESSAGE_CREATE ────  │  @机器人了！
  │                                   │
  │  → onDispatch 回调                │
  │  → 提取 OpenID                    │
  │  → 保存到数据库 config             │
  │  → 更新 boundSet                  │
```

### 关键设计决策

1. **按 appId 复用连接**: 同一个机器人的多个渠道共享一个 WS 连接
2. **自适应心跳**: 以 Hello 返回的 `heartbeat_interval` 为准（默认45s）
3. **Resume 支持**: 断线后优先尝试 Resume（最多3次），之后降级为完整重连
4. **Intents 订阅**: 默认订阅群聊(1<<25) + 公域频道(1<<30)，覆盖最常用场景
5. **自动调整 msgType**: 根据收到的事件类型自动设置正确的 msgType（group/c2c/channel/dms）

### 与元宝Bot的差异

| 特性 | 元宝Bot | QQBot |
|------|--------|-------|
| 协议 | Protobuf (二进制) | JSON (文本) |
| 鉴权 | AuthBind (签名Token) | Identify (Access Token) |
| 消息格式 | 自定义 Protobuf schema | 官方标准 JSON Payload |
| Token 管理 | auth.js (签名token) | qqbot-client.js (Access Token) |
| 重连策略 | 指数退避(50次) | 相同 |
| 心跳 | Ping/Pong (自定义) | op=1/op=11 (标准) |

## 🧪 测试步骤

1. 在 QQ 开放平台 (q.qq.com) 创建机器人，获取 AppID 和 AppSecret
2. MagicPush → 渠道管理 → 绑定渠道 → 选择"QQ机器人"
3. 填写 AppID 和 AppSecret，点击"绑定并连接"
4. 在弹出的绑定对话框中等待连接成功
5. 打开 QQ，在目标群中 @机器人 发送一条消息（或给机器人发私信）
6. 点击"我已发送消息"，几秒后应显示"绑定成功"
7. 测试发送：渠道列表 → 操作菜单 → 测试

## 📝 后续优化方向

- [ ] 支持自定义 Intents 配置（让用户选择订阅哪些事件）
- [ ] 添加 Webhook 方式作为备选（对于无法建立WS连接的环境）
- [ ] 绑定时支持选择场景优先级（如优先匹配群聊还是私聊）
- [ ] 显示已接收到的消息预览（帮助用户确认是否在正确的群/对话）
