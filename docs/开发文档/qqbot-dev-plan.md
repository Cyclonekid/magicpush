# QQ 官方机器人通知渠道 - 开发文档

> 状态：✅ **已完成待测试**
> 最后更新：2026-07-02

## 一、概述

将 QQ 官方机器人作为新的通知渠道集成到 MagicPush，允许用户通过 QQ 接收推送消息。

QQ 机器人支持三种开发场景：

| 场景 | 说明 | API 路径 |
|------|------|---------|
| **QQ 频道** | 机器人被添加到 QQ 频道的子频道中 | `POST /channels/:channelID/messages` |
| **QQ 群聊** | 机器人被添加到 QQ 群中（需 @机器人） | `POST /v2/groups/:groupID/messages` |
| **消息列表单聊** | QQ 用户在消息列表中直接与机器人对话 | `POST /v2/users/:userID/messages` |

此外还有一个旧版私信方式：通过 `POST /users/@me/dms` 创建私信会话 + `POST /dms/:guildID/messages` 发送。

## 二、QQ 官方机器人 API 关键信息

### 基础信息

- **基础 URL**: `https://api.sgroup.qq.com`（沙箱: `https://sandbox.api.sgroup.qq.com`）
- **鉴权方式**: `Authorization: Bot ${appID}.${token}`
  - `appID`: 机器人 AppID，在 QQ 开放平台创建机器人后获取
  - `token`: 机器人 Token / Access Token
  - **注意**: Token 鉴权方式官方已标注为"已弃用"，推荐使用 Access Token，但当前实现使用的是 Token 方式
- **官方文档**: https://bot.q.qq.com/wiki/develop/api-v2/
- **开放平台**: https://q.qq.com/
- **NodeSDK**: `qq-guild-bot`（原 `@tencent-connect/bot-node-sdk` 已废弃更名）

### 三种场景的消息发送 API

#### 1. 子频道消息（频道场景）

```
POST /channels/:channelID/messages
Content-Type: application/json
Authorization: Bot ${appID}.${token}

{
  "content": "消息内容",
  "msg_type": 0,         // 0=文本, 2=markdown
  "msg_id": "xxx"        // 可选，回复某条消息
}
```

#### 2. 群聊消息（群聊场景）

```
POST /v2/groups/:groupID/messages
Content-Type: application/json
Authorization: Bot ${appID}.${token}

{
  "content": "消息内容",
  "msg_type": 0,         // 0=文本, 2=markdown
  "event_id": "xxx",     // 可选，要回复的事件 ID
  "msg_seq": 1           // 可选，消息序号，用于去重
}
```

#### 3. C2C 单聊消息（消息列表场景）

```
POST /v2/users/:userID/messages
Content-Type: application/json
Authorization: Bot ${appID}.${token}

{
  "content": "消息内容",
  "msg_type": 0,         // 0=文本, 2=markdown
  "event_id": "xxx",     // 可选，要回复的事件 ID
  "msg_seq": 1           // 可选，消息序号，用于去重
}
```

#### 4. 私信消息（旧版方式）

```
// 第一步：创建私信会话
POST /users/@me/dms
Authorization: Bot ${appID}.${token}

{ "recipient_id": "用户openid", "source_guild_id": "来源频道ID(可选)" }

// 返回 { "id": "guild_id" }

// 第二步：发送私信
POST /dms/:guildID/messages
Authorization: Bot ${appID}.${token}

{ "content": "消息内容", "msg_id": "xxx(可选)" }
```

### 消息类型

| msg_type 值 | 类型 | 说明 |
|-------------|------|------|
| 0 | TEXT | 纯文本 |
| 2 | MARKDOWN | Markdown 格式（子频道/群聊/C2C 支持，私信不支持） |

### 目标 ID 获取方式

| 场景 | 需要的 ID | 获取方式 |
|------|----------|---------|
| 群聊 | `group_openid` | QQ 开放平台管理后台查看已加入的群；或从 WebSocket 事件获取 |
| C2C 单聊 | `user_openid` | 用户先与机器人发起单聊，从 WebSocket 事件中的 `author.id` 获取 |
| 子频道 | `channel_id` | 在 QQ 频道客户端右键子频道 → 复制 ID |
| 私信 | `user_openid` | 同 C2C |

> **重要**: QQ 机器人使用 `openid` 而非 QQ 号，每个机器人看到的同一用户的 openid 不同（隐私保护）。

## 三、实现方案

### 设计决策

| 决策点 | 方案 | 原因 |
|--------|------|------|
| 推送模式 | 支持四种：群聊、C2C、子频道、私信 | 覆盖所有 QQ 机器人场景 |
| 配置方式 | 用户手动填写 AppID、Token、目标 ID | 用户可在 QQ 开放平台获取凭证 |
| Access Token 管理 | 暂未实现，当前使用 Token 方式 | 需确认 Access Token 获取接口 |
| 消息格式 | 文本为主，群/C2C/频道支持 markdown | 私信不支持 markdown，自动降级 |
| 代理支持 | 支持 HTTP/SOCKS 代理 | 国内访问 API 可能需要代理 |
| SDK 依赖 | 不使用任何 SDK，直接 HTTP 调用 | 零新增依赖，避免 SDK 废弃/不兼容问题 |

### 配置字段

```javascript
{
  appId:        { label: 'AppID',         type: 'text',     required: true  },
  token:        { label: 'AppSecret/Token', type: 'password', required: true  },
  msgType:      { label: '推送场景',      type: 'select',   required: true, options: ['group', 'c2c', 'channel', 'dms'] },
  targetId:     { label: '目标 ID',       type: 'text',     required: true  },
  sourceGuildId:{ label: '来源频道 ID',   type: 'text',     required: false },
  proxyUrl:     { label: '代理地址',      type: 'text',     required: false },
}
```

## 四、已实现的文件

### 新增文件

| 文件 | 说明 |
|------|------|
| `server/src/services/qqbot/qqbot-client.js` | QQ API 客户端，封装 Token 管理和四种消息发送 API |
| `server/src/services/channels/qqbot.channel.js` | 渠道适配器，支持四种推送场景 |

### 已修改文件

| 文件 | 修改内容 |
|------|---------|
| `server/src/services/channels/index.js` | 注册 `qqbot` 渠道 |
| `server/src/middleware/validator.middleware.js` | 白名单添加 `qqbot` |
| `web/src/views/channels/List.vue` | 渠道颜色 `bg-cyan-500`、图标 `MessageSquare`、描述文本 |

## 五、已完成事项 ✅

### 核心功能（2026-07-02 完成）

- [x] **Access Token 自动管理**：实现官方推荐的 Access Token 鉴权方式
  - 自动从 `https://bots.qq.com/app/getAppAccessToken` 获取
  - 内存缓存 + 提前 5 分钟自动刷新
  - 单例模式，按 appId 维度管理
  - 完整的 TokenManager 类封装

- [x] **渠道注册启用**
  - 取消 channels/index.js 中三处注释
  - 添加 validator.middleware.js 白名单支持
  - QQ机器人渠道正式可用

- [x] **已知Bug修复**
  - 子频道消息添加 msg_type 参数支持
  - 消息长度限制（5000字符自动截断）
  - 错误码细化处理（30+种错误友好翻译）

- [x] **用户体验优化**
  - 配置字段文案更新（AppSecret说明更清晰）
  - 用户文档全面更新（反映Access Token变更）
  - 开发文档状态更新

### 待后续优化（可选）

- [ ] **实际测试**：需要在沙箱/正式环境验证四种推送场景
- [ ] **富媒体消息支持**：图片、文件等消息类型（v2.0）
- [ ] **自定义Intents配置**：让用户选择订阅哪些事件类型
- [ ] **Webhook备选方案**：对于无法建立WS连接的环境

## 五点五、WebSocket 绑定功能 ✅（2026-07-02 新增）

> **问题**: QQ Bot 的 `group_openid` / `user_openid` 无法通过 REST API 主动查询，必须通过监听 WebSocket 事件被动获取。

> **解决**: 实现了完整的 **WebSocket 绑定握手机制**，参照元宝Bot架构，用户体验从"手动查找ID"升级为"在QQ中@机器人即可自动绑定"。

### 新增文件

| 文件 | 说明 | 行数 |
|------|------|------|
| `server/src/services/qqbot/ws-client.js` | WS 客户端：Hello/Identify/心跳/Resume/断线重连 | ~550 |
| `server/src/services/qqbot/qqbot-monitor.js` | 监控服务：多渠道连接管理、OpenID提取、持久化 | ~220 |
| `server/src/controllers/qqbot.controller.js` | 控制器：绑定状态查询 + 重试API | ~120 |
| `server/src/routes/qqbot.routes.js` | 路由定义 | ~16 |
| `web/src/api/qqbot.js` | 前端 API 调用 | ~16 |
| `web/src/components/QqbotBindDialog.vue` | 绑定对话框组件 | ~300 |

### 修改文件

- `server/src/app.js`: 导入并启动 qqbotMonitor
- `server/src/routes/index.js`: 注册 `/api/qqbot/*` 路由
- `web/src/views/channels/List.vue`: 集成绑定弹窗、重新绑定按钮、创建后自动打开

### 支持的 OpenID 提取

| 事件类型 | 场景 | 自动提取字段 |
|----------|------|-------------|
| `C2C_MESSAGE_CREATE` | 单聊 | `author.user_openid` → targetId (C2C) |
| `GROUP_AT_MESSAGE_CREATE` | 群聊@ | `group_openid` → targetId (群聊) |
| `AT_MESSAGE_CREATE` | 频道@ | `channel_id` → targetId (子频道) |
| `DIRECT_MESSAGE_CREATE` | 私信 | `author.id` → targetId (私信) |

### 详细技术文档

完整实现文档见: [`qqbot-ws-binding.md`](./qqbot-ws-binding.md)

### 待后续优化（可选）

## 六、历史问题（已解决）

### 2026-07-02 解决

1. ✅ **Access Token 获取接口已确认**：`https://bots.qq.com/app/getAppAccessToken`
2. ✅ **Token自动管理已实现**：完整的获取、缓存、刷新机制
3. ✅ **渠道已注册启用**：代码层面已完全就绪
4. ⏳ **待实际测试验证**：需要创建机器人并在沙箱环境测试

## 七、参考资源

- QQ 机器人官方文档: https://bot.q.qq.com/wiki/develop/api-v2/
- QQ 开放平台: https://q.qq.com/
- NodeSDK（qq-guild-bot）: https://github.com/tencent-connect/bot-node-sdk
- 群聊/C2C API PR: https://github.com/tencent-connect/bot-node-sdk/pull/93
- 群聊/C2C API 实现分支: https://github.com/WideLee/bot-node-sdk/tree/feat/botsdk
