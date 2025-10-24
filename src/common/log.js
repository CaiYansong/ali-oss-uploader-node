const fs = require("fs");
const { nanoid } = require("nanoid");

class LogUtils {
  filePath;
  constructor(params) {
    const { filePath, autoCreateFile = true } = params || {};
    this.filePath = filePath;
    autoCreateFile && this.createLogsFile();
  }
  /**
   * 创建日志文件
   * @returns
   */
  createLogsFile() {
    const { filePath } = this;
    const hasFile = fs.existsSync(filePath);
    if (hasFile) {
      return filePath;
    }
    fs.writeFileSync(filePath, JSON.stringify([], " ", 2));
    return filePath;
  }
  /**
   * 获取日志文件列表
   * @returns
   */
  getLogs() {
    return require(this.filePath);
  }
  /**
   * 设置文件
   * @param {*} log
   */
  setLog(log) {
    const logs = this.getLogs();
    logs.push(this._getLogItem(log));
    fs.writeFileSync(this.filePath, JSON.stringify(logs, " ", 2));
  }

  getItemById(id) {
    const logs = this.getLogs(this.filePath);
    return logs?.find((it) => it.id === id);
  }

  /**
   * 返回指定格式的 log 项 数据
   * @param {*} data
   * @returns
   */
  _getLogItem(data) {
    return {
      id: nanoid(),
      data,
      createTime: Date.now(),
    };
  }
}

module.exports = {
  LogUtils,
};
