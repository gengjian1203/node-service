const express = require("express");
const app = express();
const axios = require("axios");

let token_global = null;

app.use((req, res, next) => {
  //设置请求头
  res.set({
    "Access-Control-Allow-Credentials": true,
    "Access-Control-Max-Age": 1728000,
    "Access-Control-Allow-Origin": req.headers.origin || "*",
    "Access-Control-Allow-Headers": "X-Requested-With,Content-Type",
    "Access-Control-Allow-Methods": "PUT,POST,GET,DELETE,OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  });
  req.method === "OPTIONS" ? res.status(204).end() : next();
});

// 获取token的函数，内部试用是统一的
const getToken = function (corpid, corpsecret) {
  console.log("getToken", corpid, corpsecret);
  return new Promise((resolve, reject) => {
    if (token_global) {
      console.log("getToken1");
      resolve(token_global);
    } else {
      console.log("getToken2");
      // 已过期重新获取
      axios
        .get(
          `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${corpid}&corpsecret=${corpsecret}`
        )
        .then((res) => {
          console.log("getToken3", res.data);
          const { access_token, expires_in } = res.data || {};

          token_global = access_token;
          // 有效期倒计时，刷新token过期状态
          setTimeout(() => {
            token_global = null;
          }, expires_in * 1000);
          resolve(token_global);
        })
        .catch((err) => {
          reje(err);
        });
    }
  });
};

/** 获取企业的jsapi_ticket
 * @param {String}  url 签名用的url
 */
app.get("/qwapi/QwAuth", async (req, res) => {
  const { corpid, corpsecret } = req.query || {};
  const access_token = await getToken(corpid, corpsecret);
  console.log("/qwapi/QwAuth", access_token);
  axios
    .get(
      `https://qyapi.weixin.qq.com/cgi-bin/get_jsapi_ticket?access_token=${access_token}`
    )
    .then((resAxios) => {
      const { data } = resAxios;
      console.log("/qwapi/QwAuth", data);
      res.json(data);
    })
    .catch((err) => {});
});

/** 获取应用的jsapi_ticket
 * https://developer.work.weixin.qq.com/document/path/90539#%E8%8E%B7%E5%8F%96%E5%BA%94%E7%94%A8%E7%9A%84jsapi_ticket
 * @param {String}  url 签名用的url
 */
app.get("/qwapi/QwAppAuth", async (req, res) => {
  const { corpid, corpsecret } = req.query || {};
  const access_token = await getToken(corpid, corpsecret);
  console.log("/qwapi/QwAppAuth", access_token);
  await getToken();
  axios
    .get(
      `https://qyapi.weixin.qq.com/cgi-bin/ticket/get?access_token=${access_token}&type=agent_config`
    )
    .then((resAxios) => {
      const { data } = resAxios;
      console.log("/qwapi/QwAuth", data);
      res.json(data);
    })
    .catch((err) => {});
});

var server = app.listen(8880, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("应用实例，访问地址为 ", host);
  console.log("应用实例，访问地址为 http://localhost:%s", port);
});
