const BaseChannel = require('./base.channel');
const QqbotClient = require('../qqbot/qqbot-client');

/**
 * QQ 官方机器人渠道适配器
 *
 * 支持两种推送模式：
 * - 群聊消息 (group)：发送到指定 QQ 群（需 @机器人）
 * - C2C 单聊消息 (c2c)：发送到指定用户的消息列表
 *
 * 鉴权方式：Authorization: QQBot ${accessToken}（Access Token 自动管理）
 */
class QqbotChannel extends BaseChannel {
  // QQ 消息长度限制
  static MAX_MESSAGE_LENGTH = 5000;

  /**
   * @param {Object} config - 渠道配置
   * @param {string} config.appId - 机器人 AppID
   * @param {string} config.token - 应用密钥 AppSecret（用于自动获取 Access Token）
   * @param {string} config.msgType - 消息类型: 'group'(群聊) | 'c2c'(单聊)
   * @param {string} config.targetId - 目标 ID（根据 msgType 不同含义不同）
   * @param {string} [config.sourceGuildId] - 来源频道ID（私信模式可选）
   * @param {string} [config.proxyUrl] - 代理地址
   * @param {number} channelId - 渠道记录 ID
   */
  constructor(config, channelId) {
    super(config);
    this.appId = config.appId;
    this.clientSecret = config.token; // 字段名保持为 token 以兼容已有数据，但语义是 clientSecret
    this.msgType = config.msgType || 'group';
    this.targetId = config.targetId;
    this.proxyUrl = config.proxyUrl;
    this.channelId = channelId;

    // 群/C2C 消息序号计数器，用于去重
    this._msgSeq = 0;
  }

  async send(message) {
    const { title, content, type = 'text' } = message;
    let text = title ? `${title}\n\n${content}` : content;

    // QQ 消息类型处理
    // 群聊和单聊都支持 markdown
    if (type === 'html') {
      text = this._stripHtml(text);
    }

    // 清理文本：移除前后空白、合并多余空行
    text = text.trim();
    text = text.replace(/\n{3,}/g, '\n\n');

    // 消息长度限制：QQ限制单条消息最大 5000 字符
    if (text.length > QqbotChannel.MAX_MESSAGE_LENGTH) {
      const originalLength = text.length;
      text = text.substring(0, QqbotChannel.MAX_MESSAGE_LENGTH);
      console.warn(`[QQBot] 消息已截断: ${originalLength} → ${text.length} 字符`);
    }

    // 空内容检查
    if (!text || text.length === 0) {
      throw new Error('消息内容不能为空');
    }

    console.log(`[QQBot] 准备发送消息: type=${type}, msgType=${this.msgType}, contentLength=${text.length}`);
    if (type === 'markdown') {
      // 打印前200个字符用于调试
      console.log(`[QQBot] Markdown内容预览: ${text.substring(0, 200)}...`);
    }

    // 计算当前场景支持的 msg_type
    // 群聊和单聊都支持文本(0)和 markdown(2)
    const qqMsgType = (this.msgType === 'group' || this.msgType === 'c2c')
      ? (type === 'markdown' ? 2 : 0)
      : undefined;

    const client = new QqbotClient({
      appId: this.appId,
      clientSecret: this.clientSecret,
      proxyUrl: this.proxyUrl,
    });

    try {
      switch (this.msgType) {
        case 'group':
          return await client.sendGroupMessage(this.targetId, {
            content: text,
            msgType: qqMsgType,
            msgSeq: ++this._msgSeq,
          });
        case 'c2c':
          return await client.sendC2CMessage(this.targetId, {
            content: text,
            msgType: qqMsgType,
            msgSeq: ++this._msgSeq,
          });
        default:
          throw new Error(`不支持的消息类型: ${this.msgType}，仅支持 group(群聊) 或 c2c(单聊)`);
      }
    } catch (error) {
      throw this._translateError(error);
    }
  }

  /**
   * 剥离 Markdown 格式标记，转为纯文本
   */
  _stripMarkdown(md) {
    return md
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`{1,3}(.+?)`{1,3}/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/^[-*+]\s/gm, '')
      .replace(/^\d+\.\s/gm, '')
      .replace(/^>\s/gm, '')
      .replace(/---+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * 剥离 HTML 标签，转为纯文本
   */
  _stripHtml(html) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p>/gi, '\n')
      .replace(/<\/p>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * 翻译 QQ API 错误码为用户友好的错误信息
   * 错误码参考: https://bot.q.qq.com/wiki/develop/api-v2/error.html
   */
  _translateError(error) {
    // 尝试从响应中提取错误码
    const errorCode = error.response?.data?.code;
    const errorMsg = error.response?.data?.message || error.message;

    const errorMap = {
      // 通用错误
      '10001': { message: '参数错误：请检查 AppID、AppSecret 或目标 ID 是否正确' },
      '10002': { message: '签名验证失败：请检查 AppSecret 是否正确' },
      '10003': { message: 'Access Token 无效或已过期' },

      // 频道相关
      '304001': { message: '频道不存在或机器人未加入该频道' },
      '304002': { message: '群不存在或机器人未加入该群' },
      '304003': { message: '用户不存在或未与机器人建立会话' },
      '304004': { message: '子频道不存在' },
      '304005': { message: '频道成员不存在' },

      // 消息相关
      '304061': { message: '无效的消息内容，请检查Markdown格式是否符合QQ规范（可能包含不支持的语法或特殊字符）' },
      '40034011': { message: '无效的Markdown格式，请确保使用正确的markdown对象结构' },
      '43001': { message: '消息内容为空' },
      '43002': { message: '消息内容过长（超过5000字符限制）' },
      '43003': { message: '消息格式错误' },
      '43004': { message: '发送消息频率过高，请稍后重试' },

      // 权限相关
      '50001': { message: '机器人缺少发送消息的权限' },
      '50005': { message: '机器人未在该频道/群中启用' },
      '50006': { message: '机器人被禁用或封禁' },
      '50007': { message: '用户已屏蔽机器人消息' },
      '50013': { message: 'API 调用次数超限' },
      '50014': { message: 'API 权限不足' },

      // 私信相关
      '53400': { message: '无法创建私信会话：请确保用户已与机器人有交互' },
      '53401': { message: '私信功能未开通' },

      // 网络/系统错误
      'ECONNREFUSED': { message: '无法连接到 QQ API 服务器，请检查网络或代理设置' },
      'ETIMEDOUT': { message: '连接 QQ API 服务器超时，请稍后重试' },
    };

    const translated = errorMap[String(errorCode)];
    if (translated) {
      return new Error(`QQBot API 错误 [${errorCode}]: ${translated.message}`);
    }

    // 如果没有匹配的错误码，返回原始错误但增加更友好的提示
    if (errorCode) {
      return new Error(`QQBot API 错误 [${errorCode}]: ${errorMsg}`);
    }

    // 其他未知错误
    return new Error(`QQBot 推送失败: ${errorMsg}`);
  }

  validate(config) {
    if (!config.appId || config.appId.trim() === '') {
      return { valid: false, message: 'AppID 不能为空' };
    }
    if (!config.token || config.token.trim() === '') {
      return { valid: false, message: 'AppSecret 不能为空' };
    }
    if (!config.msgType || !['group', 'c2c'].includes(config.msgType)) {
      return { valid: false, message: '消息类型必须是"群聊"或"单聊"' };
    }
    // targetId 不再强制要求，通过 WebSocket 绑定自动获取
    return { valid: true, message: '' };
  }

  async test() {
    try {
      await this.send({
        title: '测试消息',
        content: '这是一条来自魔法推送的测试消息',
        type: 'text',
      });
      return { success: true, message: '测试消息发送成功' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  static getName() {
    return 'QQ机器人';
  }

  static getDescription() {
    return '通过 QQ 官方机器人推送消息，支持群聊和单聊';
  }

  static getConfigFields() {
    return [
      {
        name: 'appId',
        label: 'AppID',
        type: 'text',
        required: true,
        placeholder: 'QQ开放平台机器人的 AppID',
        description: '在 QQ 开放平台 (q.qq.com) 创建机器人后获取',
      },
      {
        name: 'token',
        label: 'AppSecret（应用密钥）',
        type: 'password',
        required: true,
        placeholder: '机器人的 AppSecret',
        description: '用于自动获取 Access Token，系统会自动管理 Token 的获取和刷新',
      },
      {
        name: 'msgType',
        label: '推送场景',
        type: 'select',
        required: true,
        options: [
          { value: 'group', label: '群聊消息（推荐）' },
          { value: 'c2c', label: '单聊消息/消息列表' },
        ],
        description: '群聊和单聊均为官方标准 API，可根据使用场景选择',
      },
      {
        name: 'proxyUrl',
        label: '代理地址',
        type: 'text',
        required: false,
        placeholder: '如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080',
        description: '可选，用于访问 QQ API 的代理地址（国内服务器通常不需要）',
      },
    ];
  }
}

module.exports = QqbotChannel;
