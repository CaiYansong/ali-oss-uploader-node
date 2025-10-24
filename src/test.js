const path = require("path");
const { LogUtils } = require("./common/log");

const logUtils = new LogUtils({
  filePath: path.join(__dirname, "../data/test.logs.json"),
});

logUtils.createLogsFile();
console.log(logUtils.getLogs());
logUtils.setLog(parseInt("" + Math.random() * 1000));
console.log(logUtils.getLogs());
console.log(logUtils.getItemById("r4FcQ6kfbk"));
