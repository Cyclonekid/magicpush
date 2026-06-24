const axios = require('axios');
const FormData = require('form-data');
const BaseChannel = require('./base.channel');
const logger = require('../../utils/logger');

/**
 * 企业微信应用消息渠道适配器
 *
 * 通过企业微信自建应用向指定成员推送消息
 * API 文档: https://developer.work.weixin.qq.com/document/path/90236
 *
 * 发送消息接口: POST https://qyapi.weixin.qq.com/cgi-bin/message/send
 * 鉴权方式: access_token（通过 corpid + corpsecret 获取，7200秒有效期）
 *
 * 支持的消息类型：
 * - 通用类型: text, markdown
 * - 特有类型: news(图文), image(图片), file(文件), template_card(模板卡片), text_card(文本卡片), voice(语音), video(视频), mpnews(图文消息), miniprogram_notice(小程序通知)
 */
class WecomappChannel extends BaseChannel {
  /**
   * @param {Object} config - 渠道配置
   * @param {string} config.corpid - 企业 ID
   * @param {string} config.corpsecret - 应用凭证密钥
   * @param {number} config.agentid - 应用 AgentId
   * @param {string} config.touser - 接收成员 ID（多个用 | 分隔）或 @all
   * @param {number} channelId - 渠道记录 ID
   */
  constructor(config, channelId) {
    super(config);
    this.corpid = config.corpid;
    this.corpsecret = config.corpsecret;
    this.agentid = parseInt(config.agentid);
    this.touser = config.touser;
    this.channelId = channelId;
    this.proxyUrl = config.proxyUrl;
    this._tokenCache = { token: null, expiresAt: 0 };
  }

  async _getAccessToken() {
    const now = Date.now();
    // 提前 5 分钟刷新，避免边界情况
    if (this._tokenCache.token && now < this._tokenCache.expiresAt - 300000) {
      return this._tokenCache.token;
    }

    logger.info(`企业微信应用获取 access_token: corpid=${this.corpid}`);
    const axiosConfig = {
      params: { corpid: this.corpid, corpsecret: this.corpsecret },
      timeout: 10000,
    };
    
    const proxyAgent = this.createProxyAgent(this.proxyUrl);
    if (proxyAgent) {
      axiosConfig.httpsAgent = proxyAgent;
    }
    
    const response = await axios.get(
      'https://qyapi.weixin.qq.com/cgi-bin/gettoken',
      axiosConfig
    );

    const data = response.data;
    if (data.errcode !== 0) {
      throw new Error(`获取企业微信access_token失败: [${data.errcode}] ${data.errmsg}`);
    }

    this._tokenCache = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };

    return data.access_token;
  }

  /**
   * 构建带代理和 token 的 axios 配置
   */
  async _buildAxiosConfig(extra = {}) {
    const accessToken = await this._getAccessToken();
    const config = {
      params: { access_token: accessToken },
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      ...extra,
    };
    
    const proxyAgent = this.createProxyAgent(this.proxyUrl);
    if (proxyAgent) {
      config.httpsAgent = proxyAgent;
    }
    return config;
  }

  async send(message) {
    const { title, content, type = 'text', channelType, extraData } = message;

    // 如果是渠道特有类型，委托给专门的处理方法
    if (channelType && channelType !== 'text' && channelType !== 'markdown') {
      return await this.sendChannelSpecific(channelType, extraData);
    }

    const accessToken = await this._getAccessToken();

    const body = {
      touser: this.touser,
      agentid: this.agentid,
    };

    if (type === 'markdown') {
      body.msgtype = 'markdown';
      const mdContent = title ? `## ${title}\n${content}` : content;
      body.markdown = { content: mdContent };
    } else {
      body.msgtype = 'text';
      let text = content;
      if (type === 'html') {
        text = this._stripHtml(content);
      }
      const fullText = title ? `${title}\n\n${text}` : text;
      body.text = { content: fullText };
    }

    logger.info(`企业微信应用发送消息: touser=${this.touser}, msgtype=${body.msgtype}`);
    const axiosConfig = {
      params: { access_token: accessToken },
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    };
    
    const proxyAgent = this.createProxyAgent(this.proxyUrl);
    if (proxyAgent) {
      axiosConfig.httpsAgent = proxyAgent;
    }
    
    const response = await axios.post(
      'https://qyapi.weixin.qq.com/cgi-bin/message/send',
      body,
      axiosConfig
    );

    const data = response.data;
    if (data.errcode !== 0) {
      // token 失效时清除缓存，下次自动重新获取
      if (data.errcode === 42001 || data.errcode === 40014) {
        this._tokenCache = { token: null, expiresAt: 0 };
      }
      throw new Error(`企业微信应用消息发送失败: [${data.errcode}] ${data.errmsg}`);
    }

    return { success: true, messageId: data.msgid };
  }

  /**
   * 处理渠道特有类型的消息
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
      case 'text_card':
        return await this.sendTextCard(extraData);
      case 'voice':
        return await this.sendVoice(extraData);
      case 'video':
        return await this.sendVideo(extraData);
      case 'mpnews':
        return await this.sendMpnews(extraData);
      case 'miniprogram_notice':
        return await this.sendMiniprogramNotice(extraData);
      default:
        throw new Error(`不支持的渠道特有类型: ${channelType}`);
    }
  }

  /**
   * 上传临时素材（图片/文件），返回 media_id
   * 企业微信应用发送图片/文件必须先上传获取 media_id
   */
  async _uploadMedia(mediaType, base64Data, filename) {
    const accessToken = await this._getAccessToken();
    const buffer = Buffer.from(base64Data, 'base64');
    const formData = new FormData();
    formData.append('media', buffer, { filename: filename || `file.${mediaType === 'image' ? 'jpg' : 'file'}` });

    const axiosConfig = {
      params: { access_token: accessToken, type: mediaType },
      timeout: mediaType === 'file' ? 20000 : 15000,
      headers: {
        ...formData.getHeaders(),
      },
    };

    const proxyAgent = this.createProxyAgent(this.proxyUrl);
    if (proxyAgent) {
      axiosConfig.httpsAgent = proxyAgent;
    }

    const res = await axios.post(
      'https://qyapi.weixin.qq.com/cgi-bin/media/upload',
      formData,
      axiosConfig
    );

    if (res.data.errcode !== 0) {
      throw new Error(`上传媒体文件失败: [${res.data.errcode}] ${res.data.errmsg}`);
    }
    return res.data.media_id;
  }

  /**
   * 发送图文消息
   * 文档: https://developer.work.weixin.qq.com/document/path/90236#%E5%9B%BE%E6%96%87%E6%B6%88%E6%81%AF
   */
  async sendNews(data) {
    if (!data || !data.articles || !Array.isArray(data.articles) || data.articles.length === 0) {
      throw new Error('图文消息必须包含 articles 数组');
    }

    const body = {
      touser: this.touser,
      agentid: this.agentid,
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

    logger.info(`企业微信应用发送图文消息: touser=${this.touser}, articles=${data.articles.length}`);
    const result = await this._sendBody(body);
    return { ...result, type: 'news' };
  }

  /**
   * 发送图片消息
   * 需要先上传 base64 图片获取 media_id
   */
  async sendImage(data) {
    if (!data || !data.base64) {
      throw new Error('图片消息必须包含 base64 数据');
    }

    logger.info(`企业微信应用发送图片消息: uploading...`);
    const mediaId = await this._uploadMedia('image', data.base64, data.filename);

    const body = {
      touser: this.touser,
      agentid: this.agentid,
      msgtype: 'image',
      image: {
        media_id: mediaId,
      },
    };

    const result = await this._sendBody(body, 15000);
    return { ...result, type: 'image' };
  }

  /**
   * 发送文件消息
   * 需要先上传 base64 文件获取 media_id
   */
  async sendFile(data) {
    if (!data || !data.base64) {
      throw new Error('文件消息必须包含 base64 数据');
    }

    logger.info(`企业微信应用发送文件消息: uploading...`);
    const mediaId = await this._uploadMedia('file', data.base64, data.filename);

    const body = {
      touser: this.touser,
      agentid: this.agentid,
      msgtype: 'file',
      file: {
        media_id: mediaId,
      },
    };

    const result = await this._sendBody(body, 20000);
    return { ...result, type: 'file' };
  }

  /**
   * 发送文本卡片消息
   * 文档: https://developer.work.weixin.qq.com/document/path/90236#%E6%96%87%E6%9C%AC%E5%8D%A1%E7%89%87%E6%B6%88%E6%81%AF
   */
  async sendTextCard(data) {
    if (!data || !data.title) {
      throw new Error('文本卡片必须包含 title');
    }

    const body = {
      touser: this.touser,
      agentid: this.agentid,
      msgtype: 'textcard',
      textcard: {
        title: data.title,
        description: data.description || '',
        url: data.url || '',
        btntxt: data.btntxt || '详情',
      },
    };

    logger.info(`企业微信应用发送文本卡片: title=${data.title}`);
    const result = await this._sendBody(body);
    return { ...result, type: 'text_card' };
  }

  /**
   * 发送模板卡片消息
   * 支持三种卡片类型: text_notice(文本通知), news_notice(图文通知), button_interaction(按钮互动)
   * 文档: https://developer.work.weixin.qq.com/document/path/90236#%E6%A8%A1%E6%9D%BF%E5%8D%A1%E7%89%87%E6%B6%88%E6%81%AF
   */
  async sendTemplateCard(data) {
    if (!data || !data.card_type) {
      throw new Error('模板卡片必须指定 card_type');
    }

    const validTypes = ['text_notice', 'news_notice', 'button_interaction'];
    if (!validTypes.includes(data.card_type)) {
      throw new Error(`不支持的卡片类型: ${data.card_type}，支持的类型: ${validTypes.join(', ')}`);
    }

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

    logger.info(`企业微信应用发送模板卡片: type=${data.card_type}`);
    const result = await this._sendBody(body);
    return { ...result, type: 'template_card' };
  }

  /**
   * 发送语音消息
   * 需要先上传 base64 语音文件获取 media_id
   * 文档: https://developer.work.weixin.qq.com/document/path/90236#%E8%AF%AD%E9%9F%B3%E6%B6%88%E6%81%AF
   */
  async sendVoice(data) {
    if (!data || !data.base64) {
      throw new Error('语音消息必须包含 base64 数据');
    }

    logger.info(`企业微信应用发送语音消息: uploading...`);
    const mediaId = await this._uploadMedia('voice', data.base64, data.filename);

    const body = {
      touser: this.touser,
      agentid: this.agentid,
      msgtype: 'voice',
      voice: {
        media_id: mediaId,
      },
    };

    const result = await this._sendBody(body, 15000);
    return { ...result, type: 'voice' };
  }

  /**
   * 发送视频消息
   * 需要先上传 base64 视频文件获取 media_id
   * 文档: https://developer.work.weixin.qq.com/document/path/90236#%E8%A7%86%E9%A2%91%E6%B6%88%E6%81%AF
   */
  async sendVideo(data) {
    if (!data || !data.base64) {
      throw new Error('视频消息必须包含 base64 数据');
    }

    logger.info(`企业微信应用发送视频消息: uploading...`);
    const mediaId = await this._uploadMedia('video', data.base64, data.filename);

    const body = {
      touser: this.touser,
      agentid: this.agentid,
      msgtype: 'video',
      video: {
        media_id: mediaId,
        title: data.title || '',
        description: data.description || '',
      },
    };

    const result = await this._sendBody(body, 30000);
    return { ...result, type: 'video' };
  }

  /**
   * 发送图文消息（mpnews）
   * 与 news 不同，mpnews 支持更丰富的排版，文章内容基于素材库中的图文消息
   * 文档: https://developer.work.weixin.qq.com/document/path/90236#%E5%9B%BE%E6%96%87%E6%B6%88%E6%81%AF-(mpnews)
   */
  async sendMpnews(data) {
    if (!data || !data.articles || !Array.isArray(data.articles) || data.articles.length === 0) {
      throw new Error('mpnews 图文消息必须包含 articles 数组');
    }

    const body = {
      touser: this.touser,
      agentid: this.agentid,
      msgtype: 'mpnews',
      mpnews: {
        articles: data.articles.map(article => ({
          title: article.title || '',
          thumb_media_id: article.thumb_media_id || '',
          author: article.author || '',
          content: article.content || '',
          content_source_url: article.content_source_url || '',
          digest: article.digest || '',
        })),
      },
    };

    logger.info(`企业微信应用发送 mpnews 图文消息: touser=${this.touser}, articles=${data.articles.length}`);
    const result = await this._sendBody(body);
    return { ...result, type: 'mpnews' };
  }

  /**
   * 发送小程序通知消息
   * 文档: https://developer.work.weixin.qq.com/document/path/90236#%E5%B0%8F%E7%A8%8B%E5%BA%8F%E9%80%9A%E7%9F%A5%E6%B6%88%E6%81%AF
   */
  async sendMiniprogramNotice(data) {
    if (!data || !data.appid) {
      throw new Error('小程序通知必须包含 appid（小程序appid）');
    }
    if (!data.page) {
      throw new Error('小程序通知必须包含 page（小程序页面路径）');
    }

    const body = {
      touser: this.touser,
      agentid: this.agentid,
      msgtype: 'miniprogram_notice',
      miniprogram_notice: {
        appid: data.appid,
        page: data.page,
        title: data.title || '',
        description: data.description || '',
        emphasis_first_item: typeof data.emphasis_first_item === 'boolean' ? data.emphasis_first_item : true,
        content_items: Array.isArray(data.content_items) ? data.content_items : [],
      },
    };

    logger.info(`企业微信应用发送小程序通知: appid=${data.appid}, page=${data.page}`);
    const result = await this._sendBody(body);
    return { ...result, type: 'miniprogram_notice' };
  }

  /**
   * 统一发送请求体到企业微信 API
   */
  async _sendBody(body, timeout = 15000) {
    const accessToken = await this._getAccessToken();
    const axiosConfig = {
      params: { access_token: accessToken },
      headers: { 'Content-Type': 'application/json' },
      timeout,
    };

    const proxyAgent = this.createProxyAgent(this.proxyUrl);
    if (proxyAgent) {
      axiosConfig.httpsAgent = proxyAgent;
    }

    const response = await axios.post(
      'https://qyapi.weixin.qq.com/cgi-bin/message/send',
      body,
      axiosConfig
    );

    const data = response.data;
    if (data.errcode !== 0) {
      if (data.errcode === 42001 || data.errcode === 40014) {
        this._tokenCache = { token: null, expiresAt: 0 };
      }
      throw new Error(`企业微信应用消息发送失败: [${data.errcode}] ${data.errmsg}`);
    }

    return { success: true, messageId: data.msgid };
  }

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

  validate(config) {
    if (!config.corpid || config.corpid.trim() === '') {
      return { valid: false, message: '企业 ID 不能为空' };
    }
    if (!config.corpsecret || config.corpsecret.trim() === '') {
      return { valid: false, message: '应用 Secret 不能为空' };
    }
    if (!config.agentid || config.agentid.trim() === '') {
      return { valid: false, message: '应用 AgentId 不能为空' };
    }
    const aid = parseInt(config.agentid);
    if (isNaN(aid)) {
      return { valid: false, message: '应用 AgentId 必须是数字' };
    }
    if (!config.touser || config.touser.trim() === '') {
      return { valid: false, message: '接收成员不能为空' };
    }
    if (config.touser.includes('/') || config.touser.includes('\\')) {
      return { valid: false, message: '接收成员格式不正确，多个成员用 | 分隔' };
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
      return { success: true, message: '测试消息发送成功' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  static getName() {
    return '企业微信应用';
  }

  static getDescription() {
    return '企业微信自建应用消息推送，支持文本、Markdown、图文、图片、文件、语音、视频、文本卡片、模板卡片、mpnews图文及小程序通知';
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
        description: '支持多条图文链接文章，适用于资讯推送、公告通知等场景',
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
                title: '系统升级公告',
                description: '系统将于今晚22:00-23:00进行升级维护，届时服务将短暂不可用',
                url: 'https://example.com/notice',
                picurl: 'https://picsum.photos/600/300'
              }
            ]
          }
        }
      },
      {
        value: 'text_card',
        label: '文本卡片',
        icon: '📋',
        description: '带标题和跳转链接的卡片消息，适合简短通知',
        fields: [
          { name: 'title', label: '标题', type: 'text', required: true, maxLength: 128 },
          { name: 'description', label: '描述', type: 'textarea', required: false, maxLength: 512 },
          { name: 'url', label: '跳转链接', type: 'url', required: false },
          { name: 'btntxt', label: '按钮文字', type: 'text', required: false, defaultValue: '详情', maxLength: 16 },
        ],
        example: {
          channelType: 'text_card',
          extraData: {
            title: '审批通知',
            description: '您有一条新的审批待处理，请及时查看',
            url: 'https://example.com/approval',
            btntxt: '查看详情'
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
          { name: 'source', label: '来源信息', type: 'object', required: false, description: '{ desc_text: "来源描述" }' },
          { name: 'main_title', label: '主标题', type: 'object', required: false, description: '{ title: "主标题内容" }' },
          { name: 'sub_title_text', label: '副标题', type: 'text', required: false, maxLength: 256 },
          { name: 'horizontal_content_list', label: '横列内容列表', type: 'array', required: false, itemFields: [
            { name: 'keyname', label: '键名', type: 'text', required: true },
            { name: 'value', label: '值', type: 'text', required: true },
          ]},
          { name: 'card_action', label: '操作按钮', type: 'object', required: false, description: '{ url: "点击跳转URL", type: 1 }' },
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
      {
        value: 'image',
        label: '图片消息',
        icon: '🖼️',
        description: '发送Base64编码的图片，支持JPG/PNG格式（需先上传获取media_id）',
        fields: [
          { name: 'base64', label: '图片Base64编码', type: 'textarea', required: true, description: '图片的Base64编码字符串（不含data:image前缀）' },
          { name: 'filename', label: '文件名', type: 'text', required: false, description: '如 photo.jpg（可选）' },
        ],
        example: {
          channelType: 'image',
          extraData: {
            base64: '/9j/4AAQSkZJRgABAQAAAQABAAD...',
            filename: 'screenshot.jpg'
          }
        }
      },
      {
        value: 'file',
        label: '文件消息',
        icon: '📎',
        description: '发送Base64编码的文件，支持多种文件格式（需先上传获取media_id）',
        fields: [
          { name: 'base64', label: '文件Base64编码', type: 'textarea', required: true, description: '文件的Base64编码字符串' },
          { name: 'filename', label: '文件名', type: 'text', required: false, description: '如 report.pdf（可选）' },
        ],
        example: {
          channelType: 'file',
          extraData: {
            base64: 'JVBERi0xLjQK...',
            filename: 'report.pdf'
          }
        }
      },
      {
        value: 'voice',
        label: '语音消息',
        icon: '🎤',
        description: '发送Base64编码的语音文件，支持AMR格式（需先上传获取media_id）',
        fields: [
          { name: 'base64', label: '语音Base64编码', type: 'textarea', required: true, description: '语音的Base64编码字符串（AMR格式）' },
          { name: 'filename', label: '文件名', type: 'text', required: false, description: '如 voice.amr（可选）' },
        ],
        example: {
          channelType: 'voice',
          extraData: {
            base64: '/9j/4AAQSkZJRgABAQAAAQABAAD...',
            filename: 'voice.amr'
          }
        }
      },
      {
        value: 'video',
        label: '视频消息',
        icon: '🎬',
        description: '发送Base64编码的视频文件，支持MP4格式（需先上传获取media_id）',
        fields: [
          { name: 'base64', label: '视频Base64编码', type: 'textarea', required: true, description: '视频的Base64编码字符串（MP4格式）' },
          { name: 'filename', label: '文件名', type: 'text', required: false, description: '如 video.mp4（可选）' },
          { name: 'title', label: '视频标题', type: 'text', required: false, description: '视频消息的标题' },
          { name: 'description', label: '视频描述', type: 'textarea', required: false, description: '视频消息的描述文字' },
        ],
        example: {
          channelType: 'video',
          extraData: {
            base64: '/9j/4AAQSkZJRgABAQAAAQABAAD...',
            filename: 'demo.mp4',
            title: '产品演示视频',
            description: '最新版本的功能演示'
          }
        }
      },
      {
        value: 'mpnews',
        label: 'mpnews 图文消息',
        icon: '📑',
        description: '图文消息（mpnews），支持富文本内容，需要先上传封面图获取 thumb_media_id',
        fields: [
          {
            name: 'articles',
            label: '文章列表',
            type: 'array',
            required: true,
            itemFields: [
              { name: 'title', label: '标题', type: 'text', required: true, maxLength: 512 },
              { name: 'thumb_media_id', label: '封面素材ID', type: 'text', required: true, description: '通过上传接口获得的缩略图/封面 media_id' },
              { name: 'author', label: '作者', type: 'text', required: false },
              { name: 'content', label: '正文HTML', type: 'textarea', required: true, description: '支持 HTML 标签的文章正文' },
              { name: 'content_source_url', label: '原文链接', type: 'url', required: false },
              { name: 'digest', label: '摘要', type: 'textarea', required: false, maxLength: 120 },
            ],
          },
        ],
        example: {
          channelType: 'mpnews',
          extraData: {
            articles: [
              {
                title: '系统升级公告',
                thumb_media_id: 'MEDIA_ID_xxxx',
                author: '运维团队',
                content: '<h3>系统将于今晚升级</h3><p>预计维护时间 22:00-23:00</p>',
                content_source_url: 'https://example.com/notice',
                digest: '系统升级通知摘要'
              }
            ]
          }
        }
      },
      {
        value: 'miniprogram_notice',
        label: '小程序通知消息',
        icon: '📲',
        description: '发送小程序通知卡片，点击可跳转至指定小程序页面',
        fields: [
          { name: 'appid', label: '小程序 AppID', type: 'text', required: true, description: '小程序的 appid（必须是关联到企业的应用）' },
          { name: 'page', label: '页面路径', type: 'text', required: true, description: '小程序页面路径，如 pages/index/index' },
          { name: 'title', label: '标题', type: 'text', required: false, maxLength: 32, description: '小程序通知标题（可选，不填则使用 content_items 的第一项 key）' },
          { name: 'description', label: '描述文字', type: 'textarea', required: false, maxLength: 128 },
          { name: 'emphasis_first_item', label: '强调首项', type: 'boolean', required: false, defaultValue: true, description: '是否放大显示 content_items 第一项' },
          {
            name: 'content_items',
            label: '内容列表',
            type: 'array',
            required: false,
            itemFields: [
              { name: 'key', label: '键名', type: 'text', required: true, maxLength: 20 },
              { name: 'value', label: '值', type: 'text', required: true, maxLength: 30 },
            ],
          },
        ],
        example: {
          channelType: 'miniprogram_notice',
          extraData: {
            appid: 'wxa1234567890abcdef',
            page: 'pages/order/detail?orderId=12345',
            title: '订单状态更新',
            description: '您的订单已发货',
            emphasis_first_item: true,
            content_items: [
              { key: '订单号', value: 'ORD-20240115-001' },
              { key: '状态', value: '已发货' },
              { key: '快递公司', value: '顺丰速运' },
            ]
          }
        }
      },
    ];
  }

  static getConfigFields() {
    return [
      {
        name: 'corpid',
        label: '企业 ID',
        type: 'text',
        required: true,
        placeholder: '在企业微信管理后台「我的企业」页面获取',
        description: '企业微信企业唯一标识（corpid）',
      },
      {
        name: 'corpsecret',
        label: '应用 Secret',
        type: 'password',
        required: true,
        placeholder: '在应用详情页获取',
        description: '自建应用的凭证密钥，每个应用独立',
      },
      {
        name: 'agentid',
        label: '应用 AgentId',
        type: 'number',
        required: true,
        placeholder: '在应用详情页获取',
        description: '企业应用 ID（整型）',
      },
      {
        name: 'touser',
        label: '接收成员',
        type: 'text',
        required: true,
        placeholder: '成员ID（多个用 | 分隔）或 @all',
        description: '消息接收者成员 ID，多个用 | 分隔；填 @all 推送应用可见范围内的全部成员',
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
          { value: 'text_card', label: '文本卡片 (text_card)' },
          { value: 'template_card', label: '模板卡片 (template_card)' },
          { value: 'image', label: '图片消息 (image)' },
          { value: 'file', label: '文件消息 (file)' },
          { value: 'voice', label: '语音消息 (voice)' },
          { value: 'video', label: '视频消息 (video)' },
          { value: 'mpnews', label: 'mpnews 图文 (mpnews)' },
          { value: 'miniprogram_notice', label: '小程序通知 (miniprogram_notice)' },
        ],
        description: '选择后，推送时将始终使用此消息类型。不选则根据请求内容自动判断（默认text）',
      },
      {
        name: 'proxyUrl',
        label: '代理地址',
        type: 'text',
        required: false,
        placeholder: '如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080',
        description: '可选，当服务器IP不固定时可通过代理访问企业微信API（支持HTTP/HTTPS/SOCKS5代理）',
      },
    ];
  }
}

module.exports = WecomappChannel;
