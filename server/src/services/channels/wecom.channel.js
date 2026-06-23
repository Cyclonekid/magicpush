const axios = require('axios');
const BaseChannel = require('./base.channel');

/**
 * 企业微信机器人适配器
 */
class WecomChannel extends BaseChannel {
  constructor(config) {
    super(config);
    const key = config.key.trim();
    if (key.startsWith('https://') || key.startsWith('http://')) {
      this.webhookUrl = key;
    } else {
      this.webhookUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`;
    }
  }

  async send(message) {
    const { title, content, type = 'text', channelType, extraData } = message;

    // 如果是渠道特有类型，委托给专门的处理方法
    if (channelType) {
      return await this.sendChannelSpecific(channelType, extraData);
    }

    // 通用类型处理（保持原有逻辑不变）
    let payload;

    if (type === 'markdown') {
      payload = {
        msgtype: 'markdown',
        markdown: {
          content: title ? `# ${title}\n${content}` : content,
        },
      };
    } else {
      // text类型
      const text = title ? `${title}\n\n${content}` : content;
      payload = {
        msgtype: 'text',
        text: {
          content: text,
        },
      };
    }

    const response = await axios.post(this.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    if (response.data.errcode !== 0) {
      throw new Error(`企业微信发送失败: ${response.data.errmsg}`);
    }

    return {
      success: true,
      messageId: response.data.msgid,
    };
  }

  /**
   * 处理渠道特有类型的消息
   * @param {string} channelType - 渠道特有类型标识
   * @param {Object} extraData - 特有类型的额外数据
   * @returns {Promise<Object>} - 发送结果
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

  /**
   * 发送图文消息
   * @param {Object} data - 图文消息数据，包含 articles 数组
   */
  async sendNews(data) {
    if (!data || !data.articles || !Array.isArray(data.articles) || data.articles.length === 0) {
      throw new Error('图文消息必须包含 articles 数组');
    }

    const payload = {
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

    const response = await axios.post(this.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    if (response.data.errcode !== 0) {
      throw new Error(`企业微信图文消息发送失败: ${response.data.errmsg}`);
    }

    return {
      success: true,
      messageId: response.data.msgid,
      type: 'news',
    };
  }

  /**
   * 发送图片消息
   * @param {Object} data - 图片消息数据，包含 base64 和可选的 md5
   */
  async sendImage(data) {
    if (!data || !data.base64) {
      throw new Error('图片消息必须包含 base64 数据');
    }

    const payload = {
      msgtype: 'image',
      image: {
        base64: data.base64,
        md5: data.md5 || '',
      },
    };

    const response = await axios.post(this.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000, // 图片上传可能需要更长时间
    });

    if (response.data.errcode !== 0) {
      throw new Error(`企业微信图片消息发送失败: ${response.data.errmsg}`);
    }

    return {
      success: true,
      messageId: response.data.msgid,
      type: 'image',
    };
  }

  /**
   * 发送文件消息
   * @param {Object} data - 文件消息数据，包含 base64 和可选的 md5
   */
  async sendFile(data) {
    if (!data || !data.base64) {
      throw new Error('文件消息必须包含 base64 数据');
    }

    const payload = {
      msgtype: 'file',
      file: {
        base64: data.base64,
        md5: data.md5 || '',
      },
    };

    const response = await axios.post(this.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000, // 文件上传可能需要更长时间
    });

    if (response.data.errcode !== 0) {
      throw new Error(`企业微信文件消息发送失败: ${response.data.errmsg}`);
    }

    return {
      success: true,
      messageId: response.data.msgid,
      type: 'file',
    };
  }

  /**
   * 发送模板卡片消息
   * @param {Object} data - 模板卡片数据
   */
  async sendTemplateCard(data) {
    if (!data || !data.card_type) {
      throw new Error('模板卡片必须指定 card_type');
    }

    const validTypes = ['text_notice', 'news_notice', 'button_interaction'];
    if (!validTypes.includes(data.card_type)) {
      throw new Error(`不支持的卡片类型: ${data.card_type}，支持的类型: ${validTypes.join(', ')}`);
    }

    const payload = {
      msgtype: 'template_card',
      template_card: {
        card_type: data.card_type,
        source: data.source || {},
        main_title: data.main_title || {},
        sub_title_text: data.sub_title_text || '',
        horizontal_content_list: data.horizontal_content_list || [],
        card_action: data.card_action || {},
      },
    };

    const response = await axios.post(this.webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    if (response.data.errcode !== 0) {
      throw new Error(`企业微信模板卡片发送失败: ${response.data.errmsg}`);
    }

    return {
      success: true,
      messageId: response.data.msgid,
      type: 'template_card',
    };
  }

  validate(config) {
    if (!config.key || config.key.trim() === '') {
      return { valid: false, message: '机器人Key不能为空' };
    }
    const key = config.key.trim();
    if (key.startsWith('https://') || key.startsWith('http://')) {
      try {
        const url = new URL(key);
        if (!url.searchParams.get('key')) {
          return { valid: false, message: 'URL中未找到key参数' };
        }
      } catch {
        return { valid: false, message: '无效的URL格式' };
      }
    }
    return { valid: true, message: '' };
  }

  async test() {
    try {
      await this.send({
        title: '测试消息',
        content: '这是一条来自魔法推送的测试消息',
        type: 'text',
      });
      return { success: true, message: '连接测试成功' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  static getName() {
    return '企业微信群机器人';
  }

  static getDescription() {
    return '企业微信群机器人，支持文本、Markdown及图文等丰富消息格式';
  }

  static getSupportedTypes() {
    return ['text', 'markdown'];
  }

  static getChannelSpecificTypes() {
    return [
      {
        value: 'news',
        label: '图文消息',
        icon: '📰',
        description: '支持多条图文链接，适用于资讯推送、公告通知等场景',
        fields: [
          {
            name: 'articles',
            label: '文章列表',
            type: 'array',
            required: true,
            itemFields: [
              { name: 'title', label: '标题', type: 'text', required: true, maxLength: 128 },
              { name: 'description', label: '描述', type: 'textarea', required: false, maxLength: 512 },
              { name: 'url', label: '链接地址', type: 'url', required: false },
              { name: 'picurl', label: '封面图URL', type: 'url', required: false },
            ],
          },
        ],
        example: {
          channelType: 'news',
          extraData: {
            articles: [
              {
                title: '中秋节礼品到',
                description: '今年中秋公司为大家准备了精美礼品',
                url: 'https://example.com/gift',
                picurl: 'https://example.com/mid-autumn.jpg'
              }
            ]
          }
        }
      },
      {
        value: 'image',
        label: '图片消息',
        icon: '🖼️',
        description: '发送Base64编码的图片，支持JPG/PNG格式',
        fields: [
          { name: 'base64', label: '图片Base64编码', type: 'textarea', required: true, description: '图片的Base64编码字符串（不含data:image前缀）' },
          { name: 'md5', label: 'MD5签名', type: 'text', required: false, description: '图片内容的MD5值（可选，用于校验）' },
        ],
        example: {
          channelType: 'image',
          extraData: {
            base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            md5: 'a1b2c3d4e5f6...'
          }
        }
      },
      {
        value: 'file',
        label: '文件消息',
        icon: '📎',
        description: '发送Base64编码的文件，支持多种文件格式',
        fields: [
          { name: 'base64', label: '文件Base64编码', type: 'textarea', required: true, description: '文件的Base64编码字符串' },
          { name: 'md5', label: 'MD5签名', type: 'text', required: false, description: '文件内容的MD5值（可选，用于校验）' },
        ],
        example: {
          channelType: 'file',
          extraData: {
            base64: 'JVBERi0xLjQK...',
            md5: 'd4c3b2a1e9f8...'
          }
        }
      },
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
          { name: 'source', label: '来源信息', type: 'object', required: false, description: '卡片的来源信息对象' },
          { name: 'main_title', label: '主标题', type: 'object', required: false, description: '{ title: "标题内容" }' },
          { name: 'sub_title_text', label: '副标题', type: 'text', required: false, maxLength: 256 },
          { name: 'horizontal_content_list', label: '横列内容列表', type: 'array', required: false },
          { name: 'card_action', label: '操作按钮', type: 'object', required: false, description: '{ url: "点击跳转URL", type: 1 }' },
        ],
        example: {
          channelType: 'template_card',
          extraData: {
            card_type: 'text_notice',
            source: {
              desc_text: '来自魔法推送'
            },
            main_title: {
              title: '系统升级通知'
            },
            sub_title_text: '系统将于今晚22:00-23:00进行升级维护',
            horizontal_content_list: [
              { keyname: '时间', value: '2024-01-15 22:00-23:00' },
              { keyname: '影响范围', value: '所有用户' },
            ],
            card_action: {
              url: 'https://example.com/notice',
              type: 1
            }
          }
        }
      },
    ];
  }

  static getConfigFields() {
    return [
      {
        name: 'key',
        label: '机器人Key',
        type: 'text',
        required: true,
        placeholder: '请输入企业微信机器人Key或完整Webhook地址',
        description: '在企业微信群中添加机器人后获取的Key，支持直接粘贴完整Webhook地址',
      },
      {
        name: 'defaultChannelType',
        label: '默认消息类型',
        type: 'select',
        required: false,
        options: [
          { value: 'text', label: '文本消息 (text)' },
          { value: 'markdown', label: 'Markdown (markdown)' },
          { value: 'news', label: '图文消息 (news)' },
          { value: 'image', label: '图片消息 (image)' },
          { value: 'file', label: '文件消息 (file)' },
          { value: 'template_card', label: '模板卡片 (template_card)' },
        ],
        description: '选择后，推送时将始终使用此消息类型。不选则根据请求内容自动判断（默认text）',
      },
      {
        name: '_docLinks',
        label: '官方文档',
        type: 'links',
        required: false,
        links: [
          {
            label: '查看企业微信群机器人创建指南',
            url: 'https://developer.work.weixin.qq.com/document/path/99110',
          },
        ],
      },
    ];
  }
}

module.exports = WecomChannel;
