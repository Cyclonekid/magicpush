/**
 * 小爱音箱渠道控制器
 *
 * 提供扫码登录、设备列表查询、绑定确认等接口
 */

const XiaomiAuthService = require('../services/xiaomi-auth.service');
const ChannelService = require('../services/channel.service');
const ResponseUtil = require('../utils/response');
const logger = require('../utils/logger');

// 临时存储扫码登录的会话数据（内存缓存，5 分钟过期）
// key: 随机 sessionId, value: { lpUrl, cookies, createdAt }
const loginSessions = new Map();
const SESSION_TTL = 5 * 60 * 1000; // 5 分钟

// 定期清理过期会话
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of loginSessions) {
    if (now - session.createdAt > SESSION_TTL) {
      loginSessions.delete(key);
    }
  }
}, 60 * 1000);

/**
 * 生成随机 sessionId
 */
function generateSessionId() {
  return require('crypto').randomBytes(16).toString('hex');
}

class MisoundController {
  /**
   * 初始化扫码登录
   *
   * POST /api/channels/misound/qr/init
   *
   * 返回二维码 URL 和 sessionId（用于后续轮询）
   */
  static async initQRLogin(req, res) {
    try {
      const qrData = await XiaomiAuthService.initQRLogin();

      // 创建会话，保存长轮询 URL 和 Cookie
      const sessionId = generateSessionId();
      loginSessions.set(sessionId, {
        lpUrl: qrData.lpUrl,
        cookies: qrData.cookies,
        createdAt: Date.now(),
      });

      return ResponseUtil.success(res, {
        sessionId,
        qrCodeUrl: qrData.qrCodeUrl,
        loginUrl: qrData.loginUrl,
        timeout: qrData.timeout,
      }, '获取二维码成功');
    } catch (error) {
      logger.error('[Misound] 获取扫码二维码失败:', error.message);
      return ResponseUtil.serverError(res, '获取二维码失败: ' + error.message);
    }
  }

  /**
   * 轮询扫码状态
   *
   * GET /api/channels/misound/qr/status?sessionId=xxx
   *
   * 长轮询等待用户扫码结果，成功后返回 userId 和 passToken
   */
  static async pollQRStatus(req, res) {
    try {
      const { sessionId } = req.query;
      if (!sessionId) {
        return ResponseUtil.badRequest(res, 'sessionId 参数不能为空');
      }

      const session = loginSessions.get(sessionId);
      if (!session) {
        return ResponseUtil.badRequest(res, '会话已过期，请重新获取二维码');
      }

      // 调用小米 API 长轮询
      const result = await XiaomiAuthService.completeLogin(session.lpUrl, session.cookies);

      if (result.status === 'confirmed') {
        // 登录成功，清理会话
        loginSessions.delete(sessionId);

        return ResponseUtil.success(res, {
          status: 'confirmed',
          userId: result.userId,
          passToken: result.passToken,
        });
      }

      // 未扫码或失败
      return ResponseUtil.success(res, {
        status: result.status,
        message: result.message || '',
      });
    } catch (error) {
      logger.error('[Misound] 轮询扫码状态失败:', error.message);
      return ResponseUtil.serverError(res, '查询扫码状态失败: ' + error.message);
    }
  }

  /**
   * 确认绑定并创建渠道
   *
   * POST /api/channels/misound/qr/confirm
   *
   * 使用扫码获取的凭证和用户手动输入的设备名称创建 Misound 渠道
   */
  static async confirmBind(req, res) {
    try {
      const { userId, passToken, did, name, ttsMode } = req.body;

      if (!userId || !passToken) {
        return ResponseUtil.badRequest(res, '缺少登录凭证');
      }
      if (!did) {
        return ResponseUtil.badRequest(res, '请输入设备名称');
      }

      // 创建渠道，配置中存储扫码获取的凭证
      const channel = await ChannelService.createChannel(req.user.userId, {
        channelType: 'misound',
        name: name || '小爱音箱',
        config: {
          userId,
          passToken,
          did,
          ttsMode: ttsMode || 'auto',
        },
      });

      logger.info(`[Misound] 用户 ${req.user.userId} 扫码绑定成功: did=${did}`);

      return ResponseUtil.created(res, channel, '绑定成功');
    } catch (error) {
      logger.error('[Misound] 绑定失败:', error.message);
      return ResponseUtil.badRequest(res, error.message);
    }
  }

  /**
   * 重新绑定已有渠道
   *
   * PUT /api/channels/misound/qr/:channelId/rebind
   *
   * 使用新的扫码凭证更新已有渠道的配置
   */
  static async rebindChannel(req, res) {
    try {
      const channelId = parseInt(req.params.channelId);
      const { userId, passToken, did, ttsMode } = req.body;

      if (!userId || !passToken) {
        return ResponseUtil.badRequest(res, '缺少登录凭证');
      }

      const channel = await ChannelService.updateChannel(channelId, req.user.userId, {
        config: {
          userId,
          passToken,
          did: did || '',
          ttsMode: ttsMode || 'auto',
        },
      });

      logger.info(`[Misound] 用户 ${req.user.userId} 重新绑定渠道 ${channelId}`);

      return ResponseUtil.success(res, channel, '重新绑定成功');
    } catch (error) {
      if (error.message === '渠道不存在') {
        return ResponseUtil.notFound(res, error.message);
      }
      logger.error('[Misound] 重新绑定失败:', error.message);
      return ResponseUtil.badRequest(res, error.message);
    }
  }
}

module.exports = MisoundController;
