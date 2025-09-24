const fs = require("fs");
const path = require("path");

/**
 * 清除文件夹内部的文件
 * @param {string} folderPath
 */

function clearFolderSync(folderPath) {
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
      return;
    }
    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        fs.unlinkSync(filePath);
        console.info(`已删除文件: ${filePath}`);
      }
    }
  } catch (err) {
    console.error("清除文件夹时出错:", err);
  }
}

/**
 * 检测文件夹是否存在，不存在自动创建
 * @param {*} dirPath
 */
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.info(`已创建文件夹: ${dirPath}`);
  } else {
    console.info(`文件夹已存在: ${dirPath}`);
  }
}

module.exports = {
  clearFolderSync,
  ensureDirExists,
};
