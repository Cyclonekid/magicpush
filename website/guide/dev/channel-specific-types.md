# 渠道特有消息类型开发指南

本文档详细说明如何为渠道适配器实现特有消息类型支持，包括 `channelType` / `extraData` 机制的原理、接口规范、完整示例以及各渠道已实现的类型速查。

---

## 目录

- [1. 概念与动机](#1-概念与动机)
  - [1.1 通用消息类型的局限](#11-通用消息类型的局限)
  - [1.2 channelType + extraData 机制](#12-channeltype--extradata-机制)
  - [1.3 数据流全景](#13-数据流全景)
- [2. 基类接口规范](#2-基类接口规范)
  - [2.1 getSupportedTypes()](#21-getsupportedtypes)
  - [2.2 getChannelSpecificTypes()](#22-getchannelspecifictypes)
  - [2.3 类型定义 Schema](#23-类型定义-schema)
- [3. 适配器改造步骤](#3-适配器改造步骤)
  - [3.1 改造 send() 方法](#31-改造-send-方法)
  - [3.2 实现 sendChannelSpecific() 路由](#32-实现-sendchannelspecific-路由)
  - [3.3 实现各类型的发送方法](#33-实现各类型的发送方法)
  - [3.4 覆写配置字段](#34-覆写配置字段)
- [4. 完整示例：为企业微信应用添加模板卡片](#4-完整示例为企业微信应用添加模板卡片)
- [5. 已实现渠道速查表](#5-已实现渠道速查表)
- [6. 测试与验证](#6-测试与验证)
- [7. 常见问题](#7-常见问题)

---

## 1. 概念与动机

### 1.1 通用消息类型的局限

系统默认的推送 API 使用 `type` 字段指定消息格式，所有渠道共用的三种通用类型：

```javascript
{
  title: '消息标题',
  content: '消息正文',
  type: 'text'       // 仅三种: 'text' | 'markdown' | 'html'
}
```

然而，各平台原生能力远超此范围：

| 平台 | 原生支持但无法通过通用 type 表达的能力 |
|------|---------------------------------------|
| 企业微信应用 | 图文链接、文本卡片、模板卡片、图片、文件 |
| 飞书群机器人 | 富文本（多段落）、交互卡片、图片、群名片 |
| Telegram Bot | 图片、文件、地理位置 |
| 企业微信群机器人 | 图文、图片、文件、模板卡片 |

如果只用 `text` / `markdown` / `html`，这些平台特色能力完全无法触达。

### 1.2 channelType + extraData 机制

为了解决上述局限，系统引入了**双层参数**设计：

| 参数 | 类型 | 说明 | 示例值 |
|------|------|------|--------|
| `type` | `string` | 通用消息类型（原有字段） | `'text'` / `'markdown'` / `'html'` |
| `channelType` | `string` | 渠道特有类型标识 | `'news'` / `'template_card'` / `'photo'` |
| `extraData` | `Object` | 特有类型的结构化参数 | `{ articles: [...] }` |

**核心规则**：
- 当请求中**不含** `channelType` 或 `channelType` 为通用类型（`text`/`markdown`）时，走原有的 `type` 分支逻辑 —— 行为不变，完全向后兼容
- 当请求中**包含**非通用的 `channelType` 时，适配器将调用 `sendChannelSpecific(channelType, extraData)` 进入特有类型处理分支

### 1.3 数据流全景

```
客户端发起推送请求 (POST /api/push)
    │
    ├── title: "标题"
    ├── content: "正文"
    ├── type: "text"                    ← 通用类型（始终传递）
    ├── channelType: "template_card"     ← 特有类型标识（可选）
    └── extraData: { card_type: ... }    ← 特有类型参数（可选）
    │
    ▼
push.service.js (推送调度引擎)
    │
    ├── 提取 channelType / extraData
    └── adapter.send({ title, content, type, channelType, extraData })
            │
            ▼
        适配器 send(message) 内部:
            │
            ├── channelType 为空或属于通用类型?
            │   └── YES → 原有 text/markdown/html 处理逻辑
            │
            └── NO (是特有类型)?
                └── this.sendChannelSpecific(channelType, extraData)
                        │
                        ├── case 'news':      → sendNews(extraData)
                        ├── case 'image':     → sendImage(extraData)
                        ├── case 'template_card': → sendTemplateCard(extraData)
                        └── ...               → 对应的专属发送方法
```

---

## 2. 基类接口规范

`BaseChannel`（`base.channel.js`）提供了两个与特有类型相关的静态方法，子类可以覆写。

### 2.1 getSupportedTypes()

声明该渠道支持的**通用消息类型**列表。

```javascript
// BaseChannel 默认实现（可继承）
static getSupportedTypes() {
  return ['text'];   // 所有渠道至少支持纯文本
}

// 子类覆写示例：同时支持 Markdown
static getSupportedTypes() {
  return ['text', 'markdown'];
}
```

**返回值含义**：

| 返回值 | 含义 |
|--------|------|
| `['text']` | 仅支持纯文本，收到 `markdown`/`html` 时需自行降级处理 |
| `['text', 'markdown']` | 支持 text 和 markdown，收到 `html` 需降级 |
| `['text', 'markdown', 'html']` | 三种全部支持 |

> 此方法的返回值用于前端展示该渠道支持哪些通用格式。不影响特有类型——特有类型走独立的 `getChannelSpecificTypes()` 注册。

### 2.2 getChannelSpecificTypes()

声明该渠道**特有的、超出通用类型之外的消息类型**。每个类型定义是一个结构化对象，包含字段 schema 和示例数据。

```javascript
// BaseChannel 默认实现（无特有类型）
static getChannelSpecificTypes() {
  return [];
}

// 子类覆写示例
static getChannelSpecificTypes() {
  return [
    {
      value: 'news',              // channelType 标识（唯一键）
      label: '图文消息',          // 显示名称
      icon: '📰',                 // 可选图标 emoji
      description: '多条图文链接文章', // 功能描述
      fields: [...],             // extraData 字段定义（见 2.3 节）
      example: { ... }           // 完整调用示例
    },
    // ... 更多类型
  ];
}
```

**返回数组中每个元素的结构**：

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `value` | `string` | 是 | `channelType` 的枚举值，如 `'news'`、`'photo'` |
| `label` | `string` | 是 | 前端显示名称 |
| `icon` | `string` | 否 | 图标 emoji，前端 UI 使用 |
| `description` | `string` | 否 | 一句话描述该类型的用途 |
| `fields` | `Array<FieldDef>` | 是 | `extraData` 所需的字段定义（见下方 Schema） |
| `example` | `Object` | 否 | 完整的 `{ channelType, extraData }` 示例 |

### 2.3 类型定义 Schema

`fields` 数组中的每个元素描述 `extraData` 对象的一个字段：

```javascript
fields: [
  // 简单文本字段
  { name: 'title', label: '标题', type: 'text', required: true, maxLength: 128 },

  // 多行文本
  { name: 'description', label: '描述', type: 'textarea', required: false },

  // URL 类型
  { name: 'url', label: '跳转链接', type: 'url', required: false },

  // 下拉选择
  {
    name: 'card_type',
    label: '卡片样式',
    type: 'select',
    required: true,
    options: [
      { value: 'text_notice', label: '文本通知' },
      { value: 'news_notice', label: '图文通知' },
    ],
  },

  // 嵌套对象
  {
    name: 'main_title',
    label: '主标题',
    type: 'object',
    required: false,
    description: '{ title: "主标题内容" }',
  },

  // 数组（每项含多个子字段）
  {
    name: 'articles',
    label: '文章列表',
    type: 'array',
    required: true,
    itemFields: [
      { name: 'title', label: '标题', type: 'text', required: true },
      { name: 'url', label: '链接', type: 'url', required: false },
      { name: 'picurl', label: '封面图', type: 'url', required: false },
    ],
  },
]
```

**字段属性完整说明**：

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 对应 `extraData` 对象的 key |
| `label` | `string` | 是 | 显示标签 |
| `type` | `string` | 是 | 字段类型：`text` / `textarea` / `url` / `number` / `select` / `object` / `array` / `json` |
| `required` | `boolean` | 否 | 是否必填，默认 `false` |
| `maxLength` | `number` | 否 | 最大长度限制 |
| `defaultValue` | `any` | 否 | 默认值 |
| `placeholder` | `string` | 否 | 占位提示文字 |
| `description` | `string` | 否 | 字段说明 |
| `options` | `Array<{value,label}>` | 否 | `select` 类型必须提供选项列表 |
| `itemFields` | `Array<FieldDef>` | 否 | `array` 类型必须提供子字段定义 |

---

## 3. 适配器改造步骤

以下是将一个**仅支持通用类型**的适配器升级为**同时支持特有类型**的标准流程。

### 3.1 改造 send() 方法

**改造前**（仅处理通用类型）：

```javascript
async send(message) {
  const { title, content, type = 'text' } = message;

  if (type === 'markdown') {
    // 处理 markdown...
  } else {
    // 处理 text/html...
  }
}
```

**改造后**（增加 channelType 分支）：

```javascript
async send(message) {
  const { title, content, type = 'text', channelType, extraData } = message;

  // ★ 新增：如果是渠道特有类型，委托给专门的处理方法
  if (channelType && !['text', 'markdown', 'html'].includes(channelType)) {
    return await this.sendChannelSpecific(channelType, extraData);
  }

  // 以下保持原有的通用类型处理逻辑不变
  if (type === 'markdown') {
    // ...
  } else {
    // ...
  }
}
```

**关键要点**：
- 从 message 中**解构出 `channelType` 和 `extraData`**
- 判断条件：`channelType` 存在且**不在**通用类型白名单中时进入特有分支
- 白名单通常为 `['text', 'markdown', 'html']`，具体取决于 `getSupportedTypes()` 的返回值
- 通用类型分支的逻辑**不做任何修改**，保证向后兼容

### 3.2 实现 sendChannelSpecific() 路由

这是一个统一的分发器方法，根据 `channelType` 将请求路由到对应的专属发送方法：

```javascript
/**
 * 处理渠道特有类型的消息
 * @param {string} channelType - 特有类型标识
 * @param {Object} extraData - 特有类型参数
 */
async sendChannelSpecific(channelType, extraData) {
  switch (channelType) {
    case 'news':
      return await this.sendNews(extraData);
    case 'image':
      return await this.sendImage(extraData);
    case 'file':
      return await this.sendFile(extraData);
    case 'template_card':
      return await this.sendTemplateCard(extraData);
    default:
      throw new Error(`不支持的渠道特有类型: ${channelType}`);
  }
}
```

**命名约定**：
- 方法名统一为 `send` + 首字母大写的类型名，如 `sendNews()`、`sendPhoto()`、`sendTemplateCard()`
- switch-case 的 value 与 `getChannelSpecificTypes()` 中的 `value` 一一对应
- default 分支必须抛出明确错误信息，方便排查

### 3.3 实现各类型的发送方法

每个特有类型对应一个独立的方法，从 `extraData` 中提取所需参数并构造目标平台的 API 请求体。

**基本模式**：

```javascript
/**
 * 发送图文消息
 * @param {Object} data - 来自 extraData 的参数对象
 */
async sendNews(data) {
  // 1. 参数校验（防御性编程）
  if (!data || !data.articles || !Array.isArray(data.articles)) {
    throw new Error('图文消息必须包含 articles 数组');
  }

  // 2. 构造目标平台所需的请求体
  const body = {
    msgtype: 'news',
    news: {
      articles: data.articles.map(article => ({
        title: article.title || '',
        description: article.description || '',
        url: article.url || '',
        picurl: article.picurl || '',
      })),
    },
  };

  // 3. 调用 API 发送
  logger.info(`发送图文消息: articles=${data.articles.length}`);
  const result = await this._sendBody(body);

  return { ...result, type: 'news' };   // 返回结果建议带上 type 标识
}
```

**常见变体模式**：

| 场景 | 模式 | 典型渠道 |
|------|------|---------|
| 直接传 JSON 到 API | 构造 body → POST | wecom news/text_card/template_card |
| 需要 Base64 上传再发 | base64 → upload → media_id → POST | wecomapp image/file |
| multipart 表单上传 | FormData → POST (multipart) | telegram photo/document |
| 需要签名/时间戳 | 构造 body → 加签 → POST | feishu post/image/share_chat |

### 3.4 覆写配置字段

在 `getConfigFields()` 返回的数组末尾追加一个 `defaultChannelType` 选择器，允许用户在渠道配置层面设定默认使用的消息类型：

```javascript
static getConfigFields() {
  return [
    // ... 原有的配置字段 ...

    // ★ 新增：默认消息类型选择器
    {
      name: 'defaultChannelType',
      label: '默认消息类型',
      type: 'select',
      required: false,
      options: [
        // 通用类型
        { value: 'text', label: '文本消息 (text)' },
        { value: 'markdown', label: 'Markdown (markdown)' },
        // --- 分割线 ---
        // 特有类型（从 getChannelSpecificTypes 动态获取）
        { value: 'news', label: '图文消息 (news)' },
        { value: 'template_card', label: '模板卡片 (template_card)' },
        { value: 'image', label: '图片消息 (image)' },
      ],
      description: '选择后，推送时将始终使用此消息类型。不选则根据请求自动判断（默认text）',
    },
  ];
}
```

> **注意**：`options` 中的 value 必须与 `getSupportedTypes()` 和 `getChannelSpecificTypes()` 中的 value 保持一致。

---

## 4. 完整示例：为企业微信应用添加模板卡片

以下以 `wecomapp.channel.js`（企业微信应用）中的**模板卡片**类型为例，展示从零到有的完整实现过程。

### 4.1 需求分析

企业微信应用支持**模板卡片消息**（`msgtype: template_card`），这是一种高度可定制的富文本卡片，支持三种子样式：

| 子类型 | 适用场景 |
|--------|---------|
| `text_notice` | 文本通知公告（纯文字 + 按钮） |
| `news_notice` | 图文通知（带图片横幅 + 文字） |
| `button_interaction` | 按钮互动审批（多按钮 + 任务列表） |

### 4.2 在 getChannelSpecificTypes() 中注册

```javascript
static getChannelSpecificTypes() {
  return [
    // ... 其他类型省略 ...

    {
      value: 'template_card',
      label: '模板卡片',
      icon: '🃏',
      description: '交互式卡片消息，支持文本通知、图文通知和按钮互动三种样式',
      fields: [
        {
          name: 'card_type',
          label: '卡片类型',
          type: 'select',
          required: true,
          options: [
            { value: 'text_notice', label: '文本通知' },
            { value: 'news_notice', label: '图文通知' },
            { value: 'button_interaction', label: '按钮互动' },
          ],
        },
        { name: 'source', label: '来源信息', type: 'object', required: false,
          description: '{ desc_text: "来源描述" }' },
        { name: 'main_title', label: '主标题', type: 'object', required: false,
          description: '{ title: "主标题内容" }' },
        { name: 'sub_title_text', label: '副标题', type: 'text', required: false, maxLength: 256 },
        {
          name: 'horizontal_content_list',
          label: '横列内容列表',
          type: 'array',
          required: false,
          itemFields: [
            { name: 'keyname', label: '键名', type: 'text', required: true },
            { name: 'value', label: '值', type: 'text', required: true },
          ],
        },
        { name: 'card_action', label: '操作按钮', type: 'object', required: false,
          description: '{ url: "点击跳转URL", type: 1 }' },
      ],
      example: {
        channelType: 'template_card',
        extraData: {
          card_type: 'text_notice',
          source: { desc_text: '来自魔法推送' },
          main_title: { title: '系统升级通知' },
          sub_title_text: '系统将于今晚22:00-23:00进行升级维护',
          horizontal_content_list: [
            { keyname: '时间', value: '2024-01-15 22:00-23:00' },
            { keyname: '影响范围', value: '所有用户' },
          ],
          card_action: { url: 'https://example.com/notice', type: 1 }
        }
      }
    },
    // ... 其他类型省略 ...
  ];
}
```

### 4.3 在 sendChannelSpecific() 中添加路由

```javascript
async sendChannelSpecific(channelType, extraData) {
  switch (channelType) {
    case 'news':
      return await this.sendNews(extraData);
    case 'image':
      return await this.sendImage(extraData);
    case 'file':
      return await this.sendFile(extraData);
    case 'template_card':         // ★ 新增
      return await this.sendTemplateCard(extraData);
    case 'text_card':
      return await this.sendTextCard(extraData);
    default:
      throw new Error(`不支持的渠道特有类型: ${channelType}`);
  }
}
```

### 4.4 实现 sendTemplateCard() 方法

```javascript
/**
 * 发送模板卡片消息
 * 支持三种卡片类型: text_notice(文本通知), news_notice(图文通知), button_interaction(按钮互动)
 * API 文档: https://developer.work.weixin.qq.com/document/path/90236
 */
async sendTemplateCard(data) {
  // 1. 参数校验
  if (!data || !data.card_type) {
    throw new Error('模板卡片必须指定 card_type');
  }

  const validTypes = ['text_notice', 'news_notice', 'button_interaction'];
  if (!validTypes.includes(data.card_type)) {
    throw new Error(
      `不支持的卡片类型: ${data.card_type}，支持的类型: ${validTypes.join(', ')}`
    );
  }

  // 2. 构造企业微信 API 请求体
  const body = {
    touser: this.touser,
    agentid: this.agentid,
    msgtype: 'template_card',
    template_card: {
      card_type: data.card_type,
      source: data.source || {},
      main_title: data.main_title || {},
      sub_title_text: data.sub_title_text || '',
      horizontal_content_list: data.horizontal_content_list || [],
      card_action: data.card_action || {},
      task_list: data.task_list || [],
      card_selection: data.card_selection || {},
    },
  };

  // 3. 日志 + 发送
  logger.info(`企业微信应用发送模板卡片: type=${data.card_type}`);
  const result = await this._sendBody(body);
  return { ...result, type: 'template_card' };
}
```

### 4.5 更新 getConfigFields()

在配置字段数组中追加 `defaultChannelType` 选项：

```javascript
static getConfigFields() {
  return [
    // ... 原有字段 (corpid, corpsecret, agentid, touser, proxyUrl) ...

    {
      name: 'defaultChannelType',
      label: '默认消息类型',
      type: 'select',
      required: false,
      options: [
        { value: 'text', label: '文本消息 (text)' },
        { value: 'markdown', label: 'Markdown (markdown)' },
        { value: 'news', label: '图文消息 (news)' },
        { value: 'text_card', label: '文本卡片 (text_card)' },
        { value: 'template_card', label: '模板卡片 (template_card)' },  // ★ 新增
        { value: 'image', label: '图片消息 (image)' },
        { value: 'file', label: '文件消息 (file)' },
      ],
      description: '选择后，推送时将始终使用此消息类型',
    },
  ];
}
```

---

## 5. 已实现渠道速查表

以下是当前已完成特有类型实现的渠道及其支持的全部类型一览。

### 5.1 企业微信群机器人 (`wecom.channel.js`)

| channelType | 名称 | extraData 关键字段 | 说明 |
|-------------|------|-------------------|------|
| `news` | 图文消息 | `articles[{title,url,picurl}]` | 多条图文链接 |
| `image` | 图片 | `base64`, `md5` | Base64 编码直接发送 |
| `file` | 文件 | `base64`, `md5` | 同上 |
| `template_card` | 模板卡片 | `card_type`, `source`, `main_title`, ... | 三种卡片样式 |

通用类型：`text` / `markdown`

### 5.2 企业微信应用 (`wecomapp.channel.js`)

| channelType | 名称 | extraData 关键字段 | 说明 |
|-------------|------|-------------------|------|
| `news` | 图文消息 | `articles[{title,description,url,picurl}]` | 多条图文链接 |
| `text_card` | 文本卡片 | `title`, `description`, `url`, `btntxt` | 带跳转的卡片 |
| `template_card` | 模板卡片 | `card_type`, `source`, `main_title`, ... | 三种卡片样式 |
| `image` | 图片 | `base64`, `filename` | 需先上传获取 media_id |
| `file` | 文件 | `base64`, `filename` | 同上 |

通用类型：`text` / `markdown`

> **与群机器人的区别**：企业微信应用的 image/file 需要先调用临时素材上传 API（`_uploadMedia()`）获取 `media_id` 再发送；群机器人可以直接将 base64 写入请求体。

### 5.3 飞书群机器人 (`feishu.channel.js`)

| channelType | 名称 | extraData 关键字段 | 说明 |
|-------------|------|-------------------|------|
| `post` | 富文本 | `title`, `content[[{tag,text,...}]]` | 多段落/超链接/@人 |
| `interactive_card` | 交互卡片 | `card` (完整卡片 JSON) | 完整的飞书卡片对象 |
| `image` | 图片 | `image_key` 或 `base64` | 支持 image_key 或 base64 |
| `share_chat` | 群名片 | `share_chat_id` | 分享群聊名片 |

通用类型：`text` / `markdown`

> 飞书所有请求需要携带 `timestamp` + `sign` 签名。

### 5.4 Telegram Bot (`telegram.channel.js`)

| channelType | 名称 | extraData 关键字段 | 说明 |
|-------------|------|-------------------|------|
| `photo` | 图片 | `url` 或 `base64`, `caption` | 支持 URL 或 multipart 上传 |
| `document` | 文件 | `url` 或 `base64`, `caption` | 同上 |
| `location` | 地理位置 | `latitude`, `longitude`, `title`, `address` | 发送地图位置 |

通用类型：`text` / `markdown` / `html`

> Telegram 的 photo/document 支持两种传入方式：直接传 URL（Telegram 服务器下载）或传 base64（multipart 表单上传）。

---

## 6. 测试与验证

### 6.1 通过 Debug 页面测试

项目内置了调试工具页面（`Debug.vue`），可以在其中直接填写 `channelType` 和 `extraData` JSON 进行测试：

1. 启动开发环境，打开前端页面
2. 进入「调试」页面
3. 选择目标渠道
4. 选择或手动输入 `channelType`
5. 在 `extraData` 编辑框中粘贴 JSON 数据
6. 点击发送

### 6.2 通过 API 测试

```bash
# 发送企业微信应用模板卡片
curl -X POST http://localhost:3000/api/push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "channelId": <channel-id>,
    "title": "系统通知",
    "content": "",
    "type": "text",
    "channelType": "template_card",
    "extraData": {
      "card_type": "text_notice",
      "source": { "desc_text": "来自 MagicPush" },
      "main_title": { "title": "服务器告警" },
      "sub_title_text": "CPU 使用率超过 80%",
      "horizontal_content_list": [
        { "keyname": "主机", "value": "web-server-01" },
        { "keyname": "当前值", "value": "87%" }
      ],
      "card_action": { "url": "https://example.com/dashboard", "type": 1 }
    }
  }'

# 发送 Telegram 图片
curl -X POST http://localhost:3000/api/push \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": <channel-id>,
    "title": "",
    "content": "",
    "type": "text",
    "channelType": "photo",
    "extraData": {
      "url": "https://picsum.photos/800/600",
      "caption": "今日截图"
    }
  }'

# 发送飞书富文本
curl -X POST http://localhost:3000/api/push \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": <channel-id>,
    "title": "",
    "content": "",
    "type": "text",
    "channelType": "post",
    "extraData": {
      "title": "项目周报",
      "content": [[
        [{ "tag": "text", "text": "本周完成以下工作：" }],
        [{ "tag": "at", "user_id": "ou_xxxxx" }]
      ]]
    }
  }'
```

### 6.3 单元测试建议

```javascript
// tests/channels/wecomapp-specific.test.js

describe('WecomappChannel 特有消息类型', () => {
  let channel;

  beforeEach(() => {
    channel = new WecomappChannel({
      corpid: 'test_corpid',
      corpsecret: 'test_secret',
      agentid: '1000001',
      touser: 'zhangsan',
    });
  });

  test('getChannelSpecificTypes 应返回 5 种类型', () => {
    const types = WecomappChannel.getChannelSpecificTypes();
    expect(types).toHaveLength(5);
    expect(types.map(t => t.value)).toEqual(
      expect.arrayContaining(['news', 'text_card', 'template_card', 'image', 'file'])
    );
  });

  test('sendChannelSpecific 不支持的类型应报错', async () => {
    await expect(
      channel.sendChannelSpecific('nonexistent', {})
    ).rejects.toThrow('不支持的渠道特有类型: nonexistent');
  });

  test('sendTemplateCard 缺少 card_type 应报错', async () => {
    await expect(channel.sendTemplateCard({}))
      .rejects.toThrow('模板卡片必须指定 card_type');
  });
});
```

---

## 7. 常见问题

### Q: 是否所有渠道都需要实现特有类型？

不需要。特有类型是**可选增强功能**。对于只支持纯文本的渠道（如 Server酱、PushPlus），只需实现基础的 `send(message)` 即可，`getChannelSpecificTypes()` 返回空数组即可。

### Q: channelType 和 type 会冲突吗？

不会。两者的职责清晰分离：
- `type` 控制通用格式的渲染方式（text/markdown/html）
- `channelType` 触发完全独立的特有类型分支

当 `channelType` 有值时，`type` 字段仍会传递给 `send()` 但不会被特有分支使用（保留用于日志记录等场景）。当 `channelType` 为空时，行为与改造前完全一致。

### Q: extraData 的大小有限制吗？

没有硬性限制，但需要注意：
- 各平台 API 本身可能有请求体大小限制（如企业微信限制约 50KB）
- Base64 编码的图片/文件会使体积增大约 33%
- 建议 large file 使用 URL 引用而非内联 base64

### Q: 如何为一个已有渠道新增特有类型？

只需三步：

1. **在 `getChannelSpecificTypes()` 的返回数组中追加新的类型定义**
2. **在 `sendChannelSpecific()` 的 switch 中添加新 case**
3. **实现对应的 `sendXxx(data)` 方法**
4. **（可选）在 `getConfigFields()` 的 `defaultChannelType.options` 中追加新选项**

无需修改基类、无需修改 push.service.js、无需修改数据库结构。

### Q: 前端如何获取特有类型定义供用户选择？

前端可通过以下 API 获取任意渠道的类型定义：

```bash
GET /api/channels/types
```

响应中每种渠道类型都会携带 `supported_types` 和 `channel_specific_types` 字段，前端据此动态渲染类型选择器和 extraData 表单。
