# Meow 通知渠道 - 开发计划

> 状态：**已实现**
> 创建日期：2026-03-30

## 一、概述

[Meow](https://www.chuckfang.com/MeoW/) 是一款专为鸿蒙系统开发的推送通知应用。通过 REST API 推送消息到用户的鸿蒙设备，支持纯文本、Markdown 和 HTML 三种消息格式。

**核心特点**：
- 专为鸿蒙系统设计
- API 极简，仅需用户昵称即可推送，无需 Token
- 支持 GET/POST 请求方式
- 原生支持纯文本、Markdown、HTML 消息渲染
- HTML 消息可自定义显示高度
- 支持跳转链接（url）与通知图标（imgUrl）

## 二、Meow API 信息

### 接口地址

```
https://api.chuckfang.com/
http://api.chuckfang.com/
```

### 发送消息 API

```
POST /{nickname} 或 POST /{nickname}/{title}
Content-Type: application/json

无需鉴权，通过路径参数中的用户昵称标识推送目标
```

**请求体**：

```json
{
  "title": "消息标题",           // string, 可选（也可放在路径中）
  "msg": "消息内容"             // string, 必填
}
```

**查询参数**：

| 参数 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `msgType` | string | 否 | 消息显示类型：`text`（默认，纯文本）或 `html`（渲染 HTML） |
| `htmlHeight` | number | 否 | 仅 `msgType=html` 时生效，HTML 显示高度（像素），默认 200 |
| `url` | string | 否 | 点击通知后的跳转链接（需 URL 编码） |

**响应体**：

```json
{
  "status": 200,
  "message": "推送成功"
}
```

**状态码说明**：

| 状态码 | 含义 |
|--------|------|
| 200 | 操作成功 |
| 400 | 参数错误 |
| 500 | 服务器错误 |

### GET 请求方式（备选）

```
GET /{nickname}/{title}/{msg}?url={url}&msgType={msgType}&htmlHeight={htmlHeight}
```

> 当前实现使用 POST JSON 方式。

### 用户配置流程

1. 在鸿蒙设备上安装 Meow App
2. 在 App 中设置一个用户昵称
3. 将昵称填入 MagicPush 渠道配置
4. 即可接收推送通知

## 三、实现方案

### 设计决策

| 决策点 | 方案 | 原因 |
|--------|------|------|
| 请求方式 | POST JSON | 比 GET 更规范，消息体不受 URL 长度限制 |
| 消息格式 | 原生 text / markdown / html | Meow 原生支持三种格式，调用方无需转换内容，原样透传由 App 渲染 |
| 鉴权方式 | 无（通过昵称标识） | Meow API 本身无 Token 机制 |
| HTML 高度 | 默认 200px | 对齐官方规范默认值；可由渠道配置（`htmlHeight`）或每次推送 `extraData.meow.htmlHeight` 覆盖 |
| 附加参数 | url / imgUrl / htmlHeight | 统一来自 `extraData.meow` 命名空间（不依赖顶层 `url`，后者未来可能弃用） |
| channelType 解耦 | `send()` 优先按 `extraData.meow.channelType` 路由 | 多渠道推送时可为 Meow 单独指定渲染类型，不与全局 `type` 冲突（对齐企微应用） |
| 状态校验 | 校验 `response.data.status` | 杜绝昵称不存在等场景误报成功 |
| 昵称编码 | `encodeURIComponent` | 防止特殊字符导致 URL 异常 |
| 无新增依赖 | 直接用 axios | 与现有架构一致 |

### 配置字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `nickname` | text | 是 | Meow App 中设置的用户昵称（不允许包含斜杠） |
| `msgType` | select | 否 | 默认消息类型：`text`（纯文本，默认）、`markdown`（渲染 Markdown）、`html`（渲染 HTML） |
| `htmlHeight` | number | 否 | HTML 消息显示高度（像素），默认 200，仅 `msgType=html` 时生效 |

### 消息类型处理

| 输入 type | Meow 处理方式 |
|-----------|--------------|
| `text` | 原生透传为 `msgType=text` 发送 |
| `markdown` | 原生透传为 `msgType=markdown` 发送，由 Meow App 渲染（**不再转换纯文本**） |
| `html` | 原生透传为 `msgType=html` 发送，并附带 `htmlHeight` |

> **渠道特有类型与全局 `type` 解耦**：当 `extraData.meow.channelType` 存在时，`send()` 优先路由到 `sendChannelSpecific(channelType)`，其取值必须为 `text` / `markdown` / `html`；此时以 channelType 为准，忽略全局 `type`。适用于多渠道同时推送、需对 Meow 单独指定渲染方式的场景。

> 注意：如果渠道配置 `msgType=html`，且消息未携带 `channelType`，即使全局 `type=text`，也会以 HTML 格式发送（由 `send()` 回退逻辑决定）。

## 四、涉及文件清单

### 新增文件

| 文件路径 | 说明 |
|---------|------|
| `server/src/services/channels/meow.channel.js` | 渠道适配器（逻辑简单，无需单独 client 文件） |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `server/src/services/channels/index.js` | 注册 meow 渠道（import + 映射 + 导出，+3 行） |
| `server/src/middleware/validator.middleware.js` | 白名单添加 `meow`（+1 处） |
| `web/src/views/channels/List.vue` | 添加颜色、图标（Cat）、import、描述文本（+4 处） |
| `web/src/views/Login.vue` | 页脚渠道列表添加 Meow（+1 处） |
| `web/src/views/About.vue` | 图标列表添加 Meow、功能描述更新、import（+3 处） |

## 五、详细设计

### 渠道适配器 `meow.channel.js`

```javascript
class MeowChannel extends BaseChannel {
  constructor(config, channelId) {
    super(config);
    this.nickname = config.nickname;
    this.msgType = config.msgType || 'text';
    this.htmlHeight = config.htmlHeight != null ? Number(config.htmlHeight) : 200;
    this.channelId = channelId;
  }

  async send(message) {
    const { title, content, type = 'text', channelType, extraData } = message;

    // channelType 优先（来自 extraData.meow.channelType），与全局 type 解耦
    if (channelType) {
      return await this.sendChannelSpecific(channelType, { title, content, extraData });
    }

    const msgType = ['text', 'markdown', 'html'].includes(type)
      ? type
      : (this.msgType || 'text');
    return await this._deliver(msgType, { title, content, extraData });
  }

  async sendChannelSpecific(channelType, data) {
    const allowed = ['text', 'markdown', 'html'];
    if (!allowed.includes(channelType)) {
      throw new Error(`不支持的 Meow 渠道特有类型: ${channelType}`);
    }
    return await this._deliver(channelType, data);
  }

  async _deliver(msgType, { title, content, extraData }) {
    const ns = extraData || {};
    const url = ns.url || '';
    const imgUrl = ns.imgUrl || '';
    const htmlHeight = ns.htmlHeight != null ? Number(ns.htmlHeight) : this.htmlHeight;

    const params = { msgType };
    if (url) params.url = url;
    if (imgUrl) params.imgUrl = imgUrl;
    if (msgType === 'html') params.htmlHeight = htmlHeight;

    const body = { title: title || undefined, msg: content };
    const response = await axios.post(
      `https://api.chuckfang.com/${encodeURIComponent(this.nickname)}`,
      body,
      { params, headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    const data = response.data || {};
    if (data.status && data.status !== 200) {
      throw new Error(`Meow 推送失败 (${data.status}): ${data.msg || data.message || '未知错误'}`);
    }
    return data;
  }
}
```

### 前端 UI

| 属性 | 值 |
|------|-----|
| 渠道名称 | Meow |
| 渠道描述 | 鸿蒙系统推送通知应用 |
| 颜色 | `bg-orange-600`（橙色，猫主题配色） |
| 图标 | `Cat`（猫，契合 Meow 名称） |

### getConfigFields()

```javascript
static getConfigFields() {
  return [
    {
      name: 'nickname',
      label: '用户昵称',
      type: 'text',
      required: true,
      placeholder: '在 Meow App 中设置的昵称',
      description: '用于标识推送目标的用户昵称',
    },
    {
      name: 'msgType',
      label: '默认消息类型',
      type: 'select',
      required: false,
      defaultValue: 'text',
      options: [
        { label: '纯文本', value: 'text' },
        { label: 'Markdown', value: 'markdown' },
        { label: 'HTML', value: 'html' },
      ],
      description: 'text=纯文本显示，markdown=在App中渲染Markdown，html=在App中渲染HTML',
    },
    {
      name: 'htmlHeight',
      label: 'HTML 显示高度',
      type: 'number',
      required: false,
      defaultValue: 200,
      min: 1,
      description: '仅当消息类型为 HTML 时生效，单位为像素，默认 200',
    },
  ];
}
```

## 六、实现复杂度评估

Meow 是最轻量的通知渠道：
- **仅 1 个 API 接口**（`POST /{nickname}`）
- **无鉴权机制**（通过昵称标识用户，安全性依赖昵称私密性）
- **无 Token 刷新**、**无会话概念**
- **原生支持纯文本、Markdown、HTML**
- **无需单独 client 文件**
- **代码量**：~200 行（含注释、channelType 路由与统一投递方法）

## 七、测试计划

| 测试项 | 方法 | 预期结果 |
|--------|------|---------|
| 渠道注册 | `GET /api/channels/types` 包含 `meow` | 列表中出现"Meow" |
| 创建渠道 | 填写昵称并保存 | 渠道创建成功 |
| 文本推送 | 推送纯文本消息 | 鸿蒙设备收到通知 |
| HTML 推送 | 配置 msgType=html，推送 HTML 消息 | App 正确渲染 HTML |
| Markdown 推送 | 推送 Markdown 消息 | 原生渲染 Markdown（原样透传） |
| 测试按钮 | 点击测试 | 发送成功 |
| 无效昵称 | 使用不存在的昵称 | 返回错误（status 校验，不再误报成功） |
| 昵称含斜杠 | 昵称中包含 `/` | 前端验证拦截 |
| 附加参数 | 通过 extraData.meow 传入 url/imgUrl/htmlHeight | 正确作为查询参数发送 |
| HTML 高度 | 配置或 extraData.meow 设置 htmlHeight | 仅 html 类型生效 |
| 渠道特有类型 | extraData.meow.channelType=markdown，全局 type=text | Meow 以 markdown 渲染，其他渠道不受影响 |

## 八、参考资源

- Meow 官网: https://www.chuckfang.com/MeoW/
- Meow API 文档: https://www.chuckfang.com/MeoW/api_doc.html
- API 端点: https://api.chuckfang.com/
