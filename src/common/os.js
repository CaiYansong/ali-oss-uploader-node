const os = require("os");

/**
 * 获取本地 IPv4 地址列表
 * @returns {string[]} 可用的 IPv4 地址数组
 */
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  // 遍历所有网络接口
  for (const key of Object.keys(interfaces)) {
    for (const iface of interfaces[key]) {
      // 过滤 IPv4、非内网地址、非虚拟地址
      if (
        iface.family === "IPv4" && // 只考虑 IPv4
        !iface.internal && // 排除内网地址（如 127.0.0.1）
        !iface.address.startsWith("169.254.") // 排除 APIPA 地址（本地链路地址）
      ) {
        ips.push(iface.address);
      }
    }
  }

  // 如果没有找到有效地址，返回 localhost
  return ips.length > 0 ? ips : ["127.0.0.1"];
}

module.exports = {
  getLocalIPs,
};
