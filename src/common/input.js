const path = require("path");
const fs = require("fs");
const inquirer = require("inquirer"); // 交互式命令行输入库
const { existsSync } = require("fs"); // 用于同步检查文件是否存在

// 配置文件路径（保存到当前目录的 config.json）
const CONFIG_FILE = path.join(__dirname, "../../data/config.json");

/**
 * 读取上次保存的配置（若存在）
 */
async function loadLastConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = require(CONFIG_FILE);

      return data; // 返回上次的配置
    }
    return {}; // 无历史配置则返回空对象
  } catch (error) {
    console.warn("读取历史配置失败，将使用默认值：", error.message);
    return {}; // 读取失败时返回空对象
  }
}

/**
 * 保存当前配置到本地文件（不含敏感信息）
 */
async function saveConfig(config) {
  try {
    await fs.writeFile(
      CONFIG_FILE,
      JSON.stringify(config, null, 2), // 格式化JSON，便于阅读
      () => {}
    );
    console.info(`配置已保存到 ${CONFIG_FILE}`);
  } catch (error) {
    console.warn("保存配置失败：", error.message);
  }
}

/**
 * 交互式获取用户配置
 */
async function getConfig() {
  // 读取上次的配置作为默认值
  const lastConfig = await loadLastConfig();

  const questions = [
    // 本地文件夹路径
    {
      type: "input",
      name: "sourceDir",
      message: "请输入本地文件夹路径",
      default: lastConfig.sourceDir || "",
      filter: (input) => input.trim(), // 去除前后空格
      validate: async (value) => {
        // 验证路径是否存在且为文件夹
        try {
          await fs.access(value, fs.constants.R_OK, () => {}); // 检查是否可读
          return true;
        } catch (err) {
          return "路径不存在，请重新输入";
        }
      },
    },
    // OSS目标目录
    {
      type: "input",
      name: "targetDir",
      message: "请输入OSS目标目录",
      filter: (input) => input.trim(), // 去除前后空格
      default: lastConfig.targetDir || "",
    },
    // 并发数
    {
      type: "input",
      name: "concurrentLimit",
      message: "请输入并发上传数量（建议3-10）",
      default: lastConfig.concurrentLimit || 10,
      validate: (value) => {
        const num = parseInt(value, 10);
        return num > 0 && num <= 20 ? true : "请输入1-20之间的数字";
      },
    },
    // 重试次数
    {
      type: "input",
      name: "maxRetries",
      message: "请输入网络错误时的重试次数",
      default: lastConfig.maxRetries || 3,
      validate: (value) => {
        const num = parseInt(value, 10);
        return num >= 0 && num <= 10 ? true : "请输入0-10之间的数字";
      },
    },
    // 重试次数
    {
      type: "input",
      name: "logLevel",
      message: "请输入 log 记录深度",
      default: lastConfig.logLevel || 1,
      validate: (value) => {
        const num = parseInt(value, 10);
        return num >= 1 && num <= 10 ? true : "请输入1-10之间的数字";
      },
    },
    // 阿里云 endpoint
    {
      type: "input",
      name: "endpoint",
      message: "请输入阿里云 endpoint",
      default: lastConfig.endpoint || "",
      filter: (input) => input.trim(), // 去除前后空格
      validate: (value) => (value.trim() ? true : "endpoint 不能为空"),
    },
    // 阿里云 AccessKeyId
    {
      type: "input",
      name: "accessKeyId",
      message: "请输入阿里云 AccessKeyId",
      default: lastConfig.accessKeyId || "",
      filter: (input) => input.trim(), // 去除前后空格
      validate: (value) => (value.trim() ? true : "AccessKeyId 不能为空"),
    },
    // 阿里云 AccessKeySecret
    {
      type: "input",
      name: "accessKeySecret",
      message: "请输入阿里云 AccessKeySecret",
      default: lastConfig.accessKeySecret || "",
      filter: (input) => input.trim(), // 去除前后空格
      validate: (value) => (value.trim() ? true : "AccessKeySecret 不能为空"),
    },
    // OSS 存储桶名称
    {
      type: "input",
      name: "bucket",
      message: "请输入 OSS bucket 名称",
      default: lastConfig.bucket || "",
      filter: (input) => input.trim(), // 去除前后空格
      validate: (value) => (value.trim() ? true : "bucket 不能为空"),
    },
    // OSS 区域
    {
      type: "input",
      name: "region",
      message: "请输入 OSS 区域（如oss-cn-hangzhou）",
      default: lastConfig.region || "",
      filter: (input) => input.trim(), // 去除前后空格
      validate: (value) => {
        return value.startsWith("oss-")
          ? true
          : "区域格式应为oss-xxx（如oss-cn-beijing）";
      },
    },
  ];

  // 等待用户输入并返回配置
  const answers = await inquirer.prompt(questions);

  // 转换数值类型
  const config = {
    ...answers,
    concurrency: parseInt(answers.concurrency, 10),
    maxRetries: parseInt(answers.maxRetries, 10),
    logLevel: parseInt(answers.logLevel, 10),
    timeout: 30000,
    protocol: "https",
  };

  // 保存配置（不含敏感信息）
  await saveConfig(config);

  return config;
}

module.exports = {
  getConfig,
};
