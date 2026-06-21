/**
 * 小爱音箱渠道路由
 *
 * 提供扫码登录、绑定确认等接口
 * 所有接口均需 JWT 认证
 */

const express = require('express');
const router = express.Router();
const misoundController = require('../controllers/misound.controller');

// 初始化扫码登录（获取二维码）
router.post('/qr/init', misoundController.initQRLogin);

// 轮询扫码状态（长轮询等待用户扫码）
router.get('/qr/status', misoundController.pollQRStatus);

// 确认绑定（创建渠道）
router.post('/qr/confirm', misoundController.confirmBind);

// 重新绑定已有渠道
router.put('/qr/:channelId/rebind', misoundController.rebindChannel);

module.exports = router;
