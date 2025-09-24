const fs = require("fs");
const fsPromise = require("fs").promises;
const path = require("path");

const { getConfig } = require("./common/input");

const logFile = path.join(__dirname, "../data/log.json");

const {
  uploadLocalFile,
  traverseDirectory,
  uploadSingleFileWithRetry,
  traverseDirectoryWithRetry,
} = require("./common/ali-oss-uploader");

/**
 * 遍历目录并调用递归上传文件
 * @param {string} localDir - 本地目录路径
 * @param {string} ossDir - OSS目录路径
 */
async function traverseCurDirectory(localDir, ossDir = "", opt) {
  const entries = await fsPromise.readdir(localDir, { withFileTypes: true });
  const log = require(logFile);

  const { startChild } = opt;

  for (const entry of entries) {
    if (+entry.name < startChild) {
      continue;
    }

    const localPath = path.join(localDir, entry.name);
    const ossPath = path.join(ossDir, entry.name);

    // 已上传的文件夹直接跳过
    const logVal = localPath + "-" + ossPath;
    if (log.includes(logVal)) {
      continue;
    }

    if (entry.isDirectory()) {
      // 递归处理子目录
      await traverseDirectory(localPath, ossPath);
    } else {
      // 上传文件
      await uploadLocalFile(localPath, ossPath);
    }
    // 存储已上传的文件夹，后续直接跳过
    log.push(logVal);
    fs.writeFileSync(logFile, JSON.stringify(log, " ", 2), (res) => {
      console.info("res", res);
    });
  }
}

/**
 * 遍历目录并调用递归上传文件
 * @param {string} localDir - 本地目录路径
 * @param {string} ossDir - OSS目录路径
 */
async function traverseCurDirectoryWithRetry(localDir, ossDir = "", opt) {
  const entries = await fsPromise.readdir(localDir, { withFileTypes: true });
  const log = require(logFile);

  const {
    /**
     * log 记录的深度
     */
    logLevel = 1,
  } = opt || {};

  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const ossPath = path.join(ossDir, entry.name);

    // 已上传的文件夹直接跳过
    const logVal = localPath + "---" + ossPath;
    if (log.includes(logVal)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (logLevel >= 2) {
        // logLevel 大于2 继续记录子集
        await traverseCurDirectoryWithRetry(localPath, ossPath, {
          ...opt,
          logLevel: logLevel - 1,
        });
      } else {
        // 递归处理子目录
        await traverseDirectoryWithRetry(localPath, ossPath, opt);
      }
    } else {
      // 上传文件
      await uploadSingleFileWithRetry(localPath, ossPath, opt);
    }
    // 存储已上传的文件夹，后续直接跳过
    log.push(logVal);
    fs.writeFileSync(logFile, JSON.stringify(log, " ", 2), (res) => {
      console.info("res", res);
    });
  }
}

// 使用示例
async function main() {
  const data = await getConfig();
  const {
    /**
     * 本地待上传目录
     */
    sourceDir,
    /**
     * OSS 目标目录（可选）
     */
    targetDir,
  } = data;
  if (!sourceDir || !targetDir) {
    throw new Error("请设置正确的路径");
  }

  try {
    await traverseCurDirectoryWithRetry(sourceDir.trim(), targetDir.trim(), {
      ...data,
    });
    console.info("全部文件上传完成");
  } catch (error) {
    console.error("上传过程中发生错误:", error);
    process.exit(1);
  }
}

main();
