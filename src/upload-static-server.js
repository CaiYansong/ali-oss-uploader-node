const fs = require("fs");
const path = require("path");
const Koa = require("koa");
const { koaBody } = require("koa-body");
const { LogUtils } = require("./common/log");

const {
  convertToOSSPath,
  checkFileExists,
  uploadFileStream,
} = require("./common/ali-oss-uploader");
const { ensureDirExists } = require("./common/file");
const { getLocalIPs } = require("./common/os");
const { ipPrefix } = require("../data/config.json");

// 文件上传目录
const uploadDir = path.join(__dirname, "../../uploads");
ensureDirExists(uploadDir);

const app = new Koa();

const logUtils = new LogUtils({
  filePath: path.join(__dirname, "../data/upload-static-server.logs.json"),
});

// 配置 CORS 选项
const cors = require("@koa/cors"); // 引入CORS中间件
app.use(
  cors({
    origin: "*", // 允许所有域名访问，生产环境应指定具体域名
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // 允许的HTTP方法
    allowHeaders: ["Content-Type", "Authorization", "Accept"], // 允许的请求头
    exposeHeaders: ["Content-Length", "Date", "X-Request-Id"], // 暴露给客户端的响应头
    credentials: true, // 是否允许发送Cookie
  }),
);

// 配置静态资源目录
const static = require("koa-static");
app.use(
  static(path.join(__dirname, "../statics"), {
    maxage: 86400000, // 缓存时间(ms)
    hidden: false, // 是否允许传输隐藏文件
    index: "index.html", // 默认文件名
  }),
);

app.use(
  koaBody({
    multipart: true,
    formidable: {
      uploadDir, // 上传目录
      keepExtensions: true, // 保留文件扩展名
      maxFileSize: 2000 * 1024 * 1024, // 最大文件大小 (2000MB)
      onFileBegin: (name, file) => {
        // 文件上传前的处理
        console.info(`开始上传 ${file.name || file.originalFilename}`);
      },
    },
  }),
);

app.use(async (ctx) => {
  if (ctx.method === "POST" && ctx.url === "/upload-assets") {
    return fileUpload(ctx, "/assets/");
  }
  if (ctx.method === "POST" && ctx.url === "/upload-base") {
    return fileUpload(ctx, "/");
  }
});

/**
 * 规范化相对路径：统一正斜杠，去掉前导 /，禁止 .. 与绝对路径
 * @param {string} relativePath
 * @returns {string|null} 合法路径；非法返回 null
 */
function normalizeRelativePath(relativePath) {
  if (!relativePath || typeof relativePath !== "string") {
    return null;
  }
  let rel = relativePath.replace(/\\/g, "/").trim();
  rel = rel.replace(/^\/+/, "");
  if (!rel) {
    return null;
  }
  const segments = rel.split("/").filter((seg) => seg && seg !== ".");
  if (segments.some((seg) => seg === "..")) {
    return null;
  }
  return segments.join("/");
}

/**
 * 清理临时上传文件
 * @param {string} filepath
 */
function cleanupTempFile(filepath) {
  if (!filepath) {
    return;
  }
  fs.unlink(filepath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.warn(`清理临时文件失败: ${filepath}`, err.message);
    }
  });
}

async function fileUpload(ctx, dir) {
  const reqBody = ctx.request.body || {};
  // 文件上传
  const file = ctx.request.files?.file;
  if (!file) {
    ctx.body = {
      code: 500,
      message: "请选择要上传的文件",
      data: {},
    };
    return;
  }

  const fileName = file.originalFilename || file.name;
  const targetPath = normalizeRelativePath(reqBody.targetPath || "") || "";
  const relativePath =
    normalizeRelativePath(reqBody.relativePath || "") ||
    normalizeRelativePath(fileName);

  if (!relativePath) {
    cleanupTempFile(file.filepath);
    ctx.body = {
      code: 500,
      message: "相对路径非法",
      data: { name: fileName },
    };
    return;
  }

  // 使用 posix 拼接，避免 Windows 反斜杠进入 OSS key
  const prefix = convertToOSSPath(dir).replace(/\/+$/, "") || "";
  const targetFullPath = [prefix, targetPath, relativePath]
    .filter(Boolean)
    .join("/");

  const overwritePolicy =
    reqBody.overwritePolicy === "overwrite" ? "overwrite" : "skip";
  // 兼容旧字段：isReplace === 文件名 视为覆盖
  const shouldOverwrite =
    overwritePolicy === "overwrite" || reqBody.isReplace === fileName;

  const hasFile = await checkFileExists(targetFullPath);

  const resData = {
    name: fileName,
    relativePath,
    size: file.size,
    type: file.type,
    url: convertToOSSPath(targetFullPath),
  };

  // 检查文件是否存在
  if (hasFile && !shouldOverwrite) {
    resData.url = hasFile.requestUrls?.[0] || resData.url;
    cleanupTempFile(file.filepath);
    ctx.body = {
      code: 409,
      message: "文件已存在",
      data: resData,
    };
    return;
  }

  // 文件夹不存在上传或进行覆盖
  try {
    const readStream = fs.createReadStream(file.filepath);
    const result = await uploadFileStream(
      file.originalFilename,
      readStream,
      targetFullPath,
      { isCover: true },
    );
    resData.url = result.url;

    if (result.exists) {
      cleanupTempFile(file.filepath);
      ctx.body = {
        code: 409,
        message: "文件已存在",
        data: resData,
      };
      return;
    }
  } catch (error) {
    cleanupTempFile(file.filepath);
    ctx.body = {
      code: 500,
      message: JSON.stringify(error),
      data: resData,
    };
    return;
  }

  cleanupTempFile(file.filepath);
  logUtils.setLog(resData);

  ctx.body = {
    code: 200,
    message: "文件上传成功",
    data: resData,
  };
}

const port = 18400;

const ip = getLocalIPs()?.filter((it) => it.startsWith(ipPrefix))?.[0];
const host = `http://${ip}:${port}`;

app.listen(port, () => {
  console.info(
    `Koa 文件上传服务运行在: ${host} \n 上传页面地址：${host}/upload-static.html`,
  );
});
