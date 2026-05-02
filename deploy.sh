#!/bin/bash
# 1. 遇到任何错误立即停止执行，防止把坏掉的代码同步到服务器
set -e 
echo "---------------------------------------" 
echo "启动自动化部署程序..." 
echo "---------------------------------------"
# 2. 检查依赖是否安装（可选，但推荐） 
#pnpm install 
#3. 开始构建项目 我们在这里解除了 Node.js 的内存封印，防止之前的 Killed 或 OOM 报错
echo " 正在编译静态文件 (Astro Build)..." 
NODE_OPTIONS="--max-old-space-size=3072" npm run build
# 4. 同步文件到 Nginx 目录 使用 sudo 是因为 /var/www 通常需要管理员权限
echo "在将文件同步至 /var/www/twilight..."
sudo cp -r dist/* /var/www/twilight/
# 5. 修正文件权限 确保 Nginx 用户 (www-data) 能够读取这些新文件
echo "正在优化文件权限..." 
sudo chown -R www-data:www-data /var/www/twilight 
sudo chmod -R 755 /var/www/twilight 
echo "---------------------------------------" 
echo "✅ 部署成功！你的网站已更新。" 
echo " 请访问你的域名或 IP 查看效果。"
echo "---------------------------------------"
