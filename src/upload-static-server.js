const fs = require("fs");
const path = require("path");
const Koa = require("koa");
const { koaBody } = require("koa-body");

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

const OSS_DIR = "/assets/";

const app = new Koa();

// 配置 CORS 选项
const cors = require("@koa/cors"); // 引入CORS中间件
app.use(
  cors({
    origin: "*", // 允许所有域名访问，生产环境应指定具体域名
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // 允许的HTTP方法
    allowHeaders: ["Content-Type", "Authorization", "Accept"], // 允许的请求头
    exposeHeaders: ["Content-Length", "Date", "X-Request-Id"], // 暴露给客户端的响应头
    credentials: true, // 是否允许发送Cookie
  })
);

// 配置静态资源目录
const static = require("koa-static");
app.use(
  static(path.join(__dirname, "../statics"), {
    maxage: 86400000, // 缓存时间(ms)
    hidden: false, // 是否允许传输隐藏文件
    index: "index.html", // 默认文件名
  })
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
  })
);

app.use(async (ctx) => {
  const reqBody = ctx.request.body;
  if (ctx.method === "POST" && ctx.url === "/upload-static") {
    // 文件上传
    const file = ctx.request.files.file;
    const targetPath = reqBody.targetPath;
    const fileName = file.originalFilename || file.name;
    // reqBody.targetPath
    const targetDir = path.join(OSS_DIR, targetPath);
    const targetFullPath = path.join(targetDir, fileName);

    const hasFile = await checkFileExists(targetFullPath);

    const resData = {
      name: fileName,
      size: file.size,
      type: file.type,
      url: convertToOSSPath(targetFullPath),
    };

    // 检查文件是否存在
    if (hasFile && reqBody.isReplace !== fileName) {
      resData.url = hasFile.requestUrls?.[0];
      ctx.body = {
        code: 500,
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
        { isCover: true }
      );
      resData.url = result.url;

      if (result.exists) {
        ctx.body = {
          code: 500,
          message: "文件已存在",
          data: resData,
        };
        return;
      }
    } catch (error) {
      ctx.body = {
        code: 500,
        message: JSON.stringify(error),
        data: resData,
      };
      return;
    }

    ctx.body = {
      code: 200,
      message: "文件上传成功",
      data: resData,
    };
  }
});

const port = 18400;

const ip = getLocalIPs()?.filter((it) => it.startsWith(ipPrefix))?.[0];
const host = `http://${ip}:${port}`;

app.listen(port, () => {
  console.info(`Koa 文件上传服务运行在: ${host}`);
});
