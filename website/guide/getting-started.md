---
title: 快速开始
description: MagicPush 魔法推送快速开始指南
---

# 快速开始

欢迎使用 MagicPush（魔法推送）！本指南将帮助你快速部署和配置 MagicPush 推送服务。

## 什么是 MagicPush？

MagicPush 是一个支持 **20+ 消息渠道** 的统一推送服务管理平台，通过标准化的 REST API 将消息推送到：

- 企业微信、钉钉、飞书
- Telegram、WhatsApp
- 邮件（SMTP）
- iPhone（Bark）
- Android（ntfy、Gotify）
- 小爱音箱
- 更多渠道...

## 特性

- 🚀 **多渠道支持** - 一次接入，推送到所有渠道
- 🔧 **标准化 API** - 统一的 REST API 接口
- 🎨 **简单易用** - 简洁的管理界面，可视化配置
- 🔒 **开源免费** - 基于 MIT 许可证开源
- 📦 **轻量部署** - 支持 Docker 一键部署

## 快速部署

### 使用 Docker 部署

```bash
# 拉取镜像
docker pull magiccode1412/magicpush:latest

# 运行容器
docker run -d \
  --name magicpush \
  -p 818:3000 \
  magiccode1412/magicpush:latest
```

### 使用 docker-compose 部署

创建 `docker-compose.yml` 文件：

```yaml
services:
  magicpush:
    image: magiccode1412/magicpush:latest
    container_name: magicpush
    network_mode: bridge
    ports:
      - "818:3000"
    restart: unless-stopped
```

运行：

```bash
docker-compose up -d
```

## 访问管理后台

部署成功后，访问 `http://<服务器IP>:3000` 即可进入 MagicPush 管理后台。

## 下一步

- [配置推送渠道](/guide/channels/) - 学习如何配置各种推送渠道
- [API 文档](/guide/api) - 了解如何使用 API 推送消息

