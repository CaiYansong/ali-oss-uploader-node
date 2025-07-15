const AliOSS = require("ali-oss");
const fs = require("fs").promises;
const path = require("path");
const posixPath = require("path").posix; // 用于处理 POSIX 风格路径（正斜杠）

const config = require("../data/config");

// 核心配置
const CONCURRENT_LIMIT = 10; // 降低并发数（从5→3，减少网络压力）
const MAX_RETRIES = 3; // 最大重试次数（网络错误时重试）
const RETRY_DELAY_BASE = 1000; // 重试基础延迟（毫秒），采用指数退避策略

/**
 * ali oss 配置信息
 */
const aliOssClient = new AliOSS({
  region: config.region, // 例如：oss-cn-hangzhou
  accessKeyId: config.accessKeyId,
  accessKeySecret: config.accessKeySecret,
  bucket: config.bucket,
});

/**
 * 路径斜杠转换
 * @param {string} windowsPath
 * @returns
 */
function convertToOSSPath(windowsPath) {
  return windowsPath.replace(/\\/g, "/");
}

/**
 * 检查文件是否存在于 OSS
 * @param {string} ossFilePath - OSS 文件路径（需使用正斜杠）
 * @returns {Promise<boolean>} - 存在返回 true，不存在返回 false
 */
async function checkFileExists(ossFilePath) {
  try {
    await aliOssClient.head(ossFilePath);
    return true; // 文件存在
  } catch (error) {
    // 明确处理 "文件不存在" 的情况（NoSuchKey 是正常预期，非错误）
    if (error.code === "NoSuchKey") {
      return false;
    }
    // 其他错误（如网络问题、权限问题等）才视为检查失败
    console.error(`检查文件存在时发生异常: ${ossFilePath}`, error.message);
    throw error; // 抛出非 "文件不存在" 的错误
  }
}

/**
 * 上传单个文件到 OSS，存在则跳过
 * @param {string} localFilePath - 本地文件路径
 * @param {string} ossFilePath - OSS文件路径
 * @returns {Promise<Object>} - 上传结果
 */
async function uploadFile(localFilePath, ossFilePath) {
  const _ossFilePath = convertToOSSPath(ossFilePath);
  const exists = await checkFileExists(_ossFilePath);

  if (exists) {
    console.log(`跳过已存在文件: ${_ossFilePath}`);
    return { name: _ossFilePath, exists: true };
  }

  try {
    // 路径转为 oss 的格式，解决 win 路径导致上传结果没有分文件夹的问题
    const result = await aliOssClient.put(_ossFilePath, localFilePath);
    console.log(`上传成功: ${localFilePath} -> ${result.name}`);
    return result;
  } catch (error) {
    console.error(`上传失败: ${localFilePath}`, error);
    throw error;
  }
}

/**
 * 递归遍历目录并上传文件
 * @param {string} localDir - 本地目录路径
 * @param {string} ossDir - OSS目录路径
 */
async function traverseDirectory(localDir, ossDir = "") {
  const entries = await fs.readdir(localDir, { withFileTypes: true });

  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const ossPath = posixPath.join(ossDir, entry.name);

    if (entry.isDirectory()) {
      // 递归处理子目录
      await traverseDirectory(localPath, ossPath);
    } else {
      // 上传文件
      await uploadFile(localPath, ossPath);
    }
  }
}

/**
 * 带重试机制的文件存在检查（处理网络超时等临时错误）
 * @param {string} ossFilePath - OSS文件路径
 * @param {number} retriesLeft - 剩余重试次数
 * @returns {Promise<boolean>} 文件是否存在
 */
async function checkFileExistsWithRetry(ossFilePath, _retriesLeft, opt) {
  try {
    const { concurrentLimit = CONCURRENT_LIMIT, maxRetries = MAX_RETRIES } =
      opt || {};
    const retriesLeft = _retriesLeft ?? maxRetries;
    await aliOssClient.head(ossFilePath);
    return true;
  } catch (error) {
    // 区分"文件不存在"和"网络错误"
    if (error.code === "NoSuchKey") {
      return false; // 确定文件不存在，无需重试
    }

    // 网络相关错误（超时、连接失败等），尝试重试
    const isNetworkError = [
      "ETIMEDOUT",
      "ECONNRESET",
      "EHOSTUNREACH",
      "RequestError",
    ].includes(error.code);
    if (isNetworkError && retriesLeft > 0) {
      const delay = RETRY_DELAY_BASE * (maxRetries - retriesLeft + 1); // 指数退避（1s→2s→3s）
      console.warn(
        `检查文件网络错误（剩余重试${
          retriesLeft - 1
        }次）: ${ossFilePath}，错误：${error.message}，将在${delay}ms后重试`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return checkFileExistsWithRetry(ossFilePath, retriesLeft - 1); // 递归重试
    }

    // 非网络错误或重试耗尽，记录并抛出
    console.error(
      `检查文件最终失败（无重试次数）: ${ossFilePath}，错误：${error.message}`
    );
    throw error;
  }
}

/**
 * 带重试机制的单个文件上传
 */
async function uploadSingleFileWithRetry(
  localFilePath,
  ossFilePath,
  _retriesLeft,
  opt
) {
  try {
    const { concurrentLimit = CONCURRENT_LIMIT, maxRetries = MAX_RETRIES } =
      opt || {};
    const retriesLeft = _retriesLeft ?? maxRetries;
    // 先检查文件是否存在
    const exists = await checkFileExistsWithRetry(ossFilePath);
    if (exists) {
      return {
        success: true,
        skipped: true,
        path: ossFilePath,
        message: "文件已存在，已跳过",
      };
    }

    // 执行上传
    const result = await aliOssClient.put(ossFilePath, localFilePath);
    return {
      success: true,
      skipped: false,
      path: result.name,
      message: "上传成功",
    };
  } catch (error) {
    // 网络错误重试
    const isNetworkError = [
      "ETIMEDOUT",
      "ECONNRESET",
      "EHOSTUNREACH",
      "RequestError",
    ].includes(error.code);
    if (isNetworkError && retriesLeft > 0) {
      const delay = RETRY_DELAY_BASE * (maxRetries - retriesLeft + 1);
      console.warn(
        `上传网络错误（剩余重试${retriesLeft - 1}次）: ${ossFilePath}，错误：${
          error.message
        }，将在${delay}ms后重试`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return uploadSingleFileWithRetry(
        localFilePath,
        ossFilePath,
        retriesLeft - 1
      );
    }

    // 最终失败
    return {
      success: false,
      path: ossFilePath,
      message: `上传最终失败：${error.message}`,
    };
  }
}

/**
 * 收集所有文件路径（同之前逻辑）
 */
async function collectAllFiles(localDir, ossBaseDir = "") {
  const files = [];
  const entries = await fs.readdir(localDir, { withFileTypes: true });

  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const ossPath = posixPath.join(ossBaseDir, entry.name);
    if (entry.isDirectory()) {
      const subDirFiles = await collectAllFiles(localPath, ossPath);
      files.push(...subDirFiles);
    } else {
      files.push({ localPath, ossPath: convertToOSSPath(ossPath) });
    }
  }
  return files;
}

/**
 * 并发上传（降低并发数，减少网络压力）
 */
async function uploadFilesConcurrently(fileList, opt) {
  const { concurrentLimit = CONCURRENT_LIMIT, maxRetries = MAX_RETRIES } =
    opt || {};
  const results = [];
  const executing = [];

  for (const file of fileList) {
    const task = uploadSingleFileWithRetry(file.localPath, file.ossPath).then(
      (result) => {
        executing.splice(executing.indexOf(task), 1);
        results.push(result);
        console.log(
          `[${results.length}/${fileList.length}] ${result.message}: ${result.path}`
        );
      }
    );

    executing.push(task);

    // 控制并发数（比之前更低，减少网络拥堵）
    if (executing.length >= concurrentLimit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * 递归遍历目录并上传文件
 * @param {string} localDir - 本地目录路径
 * @param {string} ossDir - OSS目录路径
 */
async function traverseDirectoryWithRetry(localDir, ossDir = "", opt) {
  try {
    const { concurrentLimit = CONCURRENT_LIMIT, maxRetries = MAX_RETRIES } =
      opt || {};
    const allFiles = await collectAllFiles(localDir, ossDir);
    console.log(
      `共发现 ${allFiles.length} 个文件，开始上传（并发数：${concurrentLimit}，重试次数：${maxRetries}）...`
    );

    const uploadResults = await uploadFilesConcurrently(allFiles, opt);

    // 统计结果
    const successCount = uploadResults.filter((r) => r.success).length;
    const skippedCount = uploadResults.filter((r) => r.skipped).length;
    const failedCount = uploadResults.filter((r) => !r.success).length;

    console.log("\n===== 上传完成 =====");
    console.log(`总文件数: ${allFiles.length}`);
    console.log(`成功上传: ${successCount - skippedCount}`);
    console.log(`已跳过: ${skippedCount}`);
    console.log(`最终失败: ${failedCount}`);

    if (failedCount > 0) {
      console.log("\n失败文件列表:");
      uploadResults
        .filter((r) => !r.success)
        .forEach((r) => console.log(`- ${r.path}: ${r.message}`));
    }
  } catch (error) {
    console.error("致命错误:", error);
    process.exit(1);
  }
}

module.exports = {
  aliOssClient,
  convertToOSSPath,
  checkFileExists,
  uploadFile,
  traverseDirectory,
  checkFileExistsWithRetry,
  uploadSingleFileWithRetry,
  uploadFilesConcurrently,
  collectAllFiles,
  traverseDirectoryWithRetry,
};
