# 阿里 oss 文件上传

- nodejs@16

#### data 下的配置文件

- endpoint 必须加上 https，避免默认配置改动导致变化

```config.json
{
  "sourceDir": "",
  "targetDir": "",
  "concurrentLimit": "10",
  "maxRetries": 3,
  "logLevel": 1,
  "endpoint": "https://oss-cn-hangzhou.aliyuncs.com",
  "accessKeyId": "",
  "accessKeySecret": "",
  "bucket": "",
  "region": "oss-cn-hangzhou",
  "authorizationV4": true,
  "concurrency": null,
  "timeout": 30000,
  "protocol": "https"
  "ipPrefix": ""
}
```

```log.json
[]
```
