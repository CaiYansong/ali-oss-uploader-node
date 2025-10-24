const { customAlphabet } = require("nanoid");

/**
 * 指定 nanoid 字符集合
 * 数字和大小写字母
 */
const numALetters =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** nanoid 数字和大小写字母 */
const nanoidNumALetters = customAlphabet(numALetters, 10);

module.exports = {
  numALetters,
  nanoidNumALetters,
};
