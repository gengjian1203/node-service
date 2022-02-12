/**
 * @description node程序，企业微信授权/应用授权
 */
let express = require("express");
let app = express();
var axios = require("axios");

let base = {
  corpid: "ww12eda987cc5346cd", // 必填，企业微信的corpid，必须与当前登录的企业一致
  agentid: "1000009", // 必填，企业微信的应用id （e.g. 1000247）
  secret: "B-ieE-K8UNEf8Nc0vgx6Qmuu7MiWDKmvz7qqjzrAfuY", // 测试应用1000247的密码
  timestamp: "1414587457", // 必填，生成签名的时间戳
  nonceStr: "Wm3WZYTPz0wzccnW", // 必填，生成签名的随机串
};

/**
 * @description 通过企业id和应用密码获取企业应用最新的token和ticket
 * 函数内部有token和ticket的缓存，自动根据情况获取缓存还是重新请求
 * @param {String} corpid 企业id
 * @param {String} corpsecret 应用密码
 * @param {Boolean} isApp  是否是应用， 默认false
 * @return {Object} tokenAndTicket 返回最新有效token和ticket
 * tokenAndTicket.access_token  token
 * tokenAndTicket.ticket   wxTicket:企业ticket   appTicket:应用ticket
 */
const getAccessTokenAndTicket = function (corpid, corpsecret, isApp) {
  getAccessTokenAndTicket[corpid] = getAccessTokenAndTicket[corpid] || {};
  return new Promise((resolve, reject) => {
    // 引用的token已经过期 则需要重新获取
    // 每一个应用的corpsecret不同，此处把corpsecret作为一个应用的唯一标志
    // 初始化时默认应用的token是过期的，以便获取新token
    if (!getAccessTokenAndTicket[corpid][corpsecret]) {
      getAccessTokenAndTicket[corpid][corpsecret] = {
        tokenExpired: true,
        wxTicketExpired: true, // 企业ticket
        appTicketExpired: true, // 应用ticket
      };
    }
    let appInfo = getAccessTokenAndTicket[corpid][corpsecret];
    // 获取企业ticket的函数
    const getWxTicket = function (ACCESS_TOKEN) {
      return new Promise((resl, reje) => {
        if (!appInfo.wxTicketExpired) {
          // ticket未过期直接用
          resl(appInfo.wxTicket);
        } else {
          // 已过期重新获取
          axios
            .get(
              `https://qyapi.weixin.qq.com/cgi-bin/get_jsapi_ticket?access_token=${ACCESS_TOKEN}`
            )
            .then((res) => {
              let data = res.data;
              appInfo.wxTicket = data.ticket;
              appInfo.wxTicketExpired = false;
              // 有效期倒计时，刷新ticket过期状态
              setTimeout(() => {
                appInfo.wxTicketExpired = true;
              }, data.expires_in * 1000);

              resl(appInfo.wxTicket);
            })
            .catch((err) => {
              reje(err);
            });
        }
      });
    };

    // 获取应用的ticket的函数
    const getAppTicket = function (ACCESS_TOKEN) {
      return new Promise((resl, reje) => {
        if (!appInfo.appTicketExpired) {
          // ticket未过期直接用
          resl(appInfo.appTicket);
        } else {
          // 已过期重新获取
          axios
            .get(
              `https://qyapi.weixin.qq.com/cgi-bin/ticket/get?access_token=${ACCESS_TOKEN}&type=agent_config`
            )
            .then((res) => {
              let data = res.data;
              appInfo.appTicket = data.ticket;
              appInfo.appTicketExpired = false;
              // 有效期倒计时，刷新ticket过期状态
              setTimeout(() => {
                appInfo.appTicketExpired = true;
              }, data.expires_in * 1000);

              resl(appInfo.appTicket);
            })
            .catch((err) => {
              reje(err);
            });
        }
      });
    };

    // 获取token的函数，内部试用是统一的
    const getToken = function (CORPID, CORPSECRET) {
      return new Promise((resl, reje) => {
        if (!appInfo.tokenExpired) {
          // token未过期直接用
          resl(appInfo.access_token);
        } else {
          // 已过期重新获取
          axios
            .get(
              `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CORPID}&corpsecret=${CORPSECRET}`
            )
            .then((res) => {
              let data = res.data;

              appInfo.access_token = data.access_token;
              appInfo.tokenExpired = false;
              // 有效期倒计时，刷新token过期状态
              setTimeout(() => {
                appInfo.tokenExpired = true;
              }, data.expires_in * 1000);

              resl(appInfo.access_token);
            })
            .catch((err) => {
              reje(err);
            });
        }
      });
    };

    getToken(corpid, corpsecret)
      .then((_token) => {
        let getTicket = isApp ? getAppTicket : getWxTicket;
        getTicket(_token)
          .then((_ticket) => {
            resolve({
              access_token: _token,
              ticket: _ticket,
            });
          })
          .catch((err) => {
            reject(err);
          });
      })
      .catch((err) => {
        reject(err);
      });
  });
};

function encodeUTF8(s) {
  var i;
  var r = [];
  var c;
  var x;
  for (i = 0; i < s.length; i++) {
    if ((c = s.charCodeAt(i)) < 0x80) r.push(c);
    else if (c < 0x800) r.push(0xc0 + ((c >> 6) & 0x1f), 0x80 + (c & 0x3f));
    else {
      if ((x = c ^ 0xd800) >> 10 == 0) {
        // 对四字节UTF-16转换为Unicode
        (c = (x << 10) + (s.charCodeAt(++i) ^ 0xdc00) + 0x10000),
          r.push(0xf0 + ((c >> 18) & 0x7), 0x80 + ((c >> 12) & 0x3f));
      } else r.push(0xe0 + ((c >> 12) & 0xf));
      r.push(0x80 + ((c >> 6) & 0x3f), 0x80 + (c & 0x3f));
    }
  }
  return r;
}

// 字符串加密成 hex 字符串
function sha1(s) {
  var data = new Uint8Array(encodeUTF8(s));
  var i, j, t;
  var l = (((data.length + 8) >>> 6) << 4) + 16;
  var s = new Uint8Array(l << 2);
  s.set(new Uint8Array(data.buffer)), (s = new Uint32Array(s.buffer));
  for (t = new DataView(s.buffer), i = 0; i < l; i++)
    s[i] = t.getUint32(i << 2);
  s[data.length >> 2] |= 0x80 << (24 - (data.length & 3) * 8);
  s[l - 1] = data.length << 3;
  var w = [];
  var f = [
    function () {
      return (m[1] & m[2]) | (~m[1] & m[3]);
    },
    function () {
      return m[1] ^ m[2] ^ m[3];
    },
    function () {
      return (m[1] & m[2]) | (m[1] & m[3]) | (m[2] & m[3]);
    },
    function () {
      return m[1] ^ m[2] ^ m[3];
    },
  ];
  var rol = function (n, c) {
    return (n << c) | (n >>> (32 - c));
  };
  var k = [1518500249, 1859775393, -1894007588, -899497514];
  var m = [1732584193, -271733879, null, null, -1009589776];
  (m[2] = ~m[0]), (m[3] = ~m[1]);
  for (i = 0; i < s.length; i += 16) {
    var o = m.slice(0);
    for (j = 0; j < 80; j++) {
      (w[j] =
        j < 16
          ? s[i + j]
          : rol(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1)),
        (t =
          (rol(m[0], 5) + f[(j / 20) | 0]() + m[4] + w[j] + k[(j / 20) | 0]) |
          0),
        (m[1] = rol(m[1], 30)),
        m.pop(),
        m.unshift(t);
    }
    for (j = 0; j < 5; j++) m[j] = (m[j] + o[j]) | 0;
  }
  t = new DataView(new Uint32Array(m).buffer);
  for (var i = 0; i < 5; i++) m[i] = t.getUint32(i << 2);

  var hex = Array.prototype.map
    .call(new Uint8Array(new Uint32Array(m).buffer), function (e) {
      return (e < 16 ? "0" : "") + e.toString(16);
    })
    .join("");
  return hex;
}

/** 企业微信授权签名
 *@param {String}  url 签名用的url
 *@return {Object} res 返回最新有效签名t
 * res.data.signature  签名
 */
app.get("/wxapi/wxQyAuth", function (req, res) {
  getAccessTokenAndTicket(base.corpid, base.secret).then((data) => {
    let str = `jsapi_ticket=${data.ticket}&noncestr=${base.nonceStr}&timestamp=${base.timestamp}&url=${req.query.url}`;
    res.json({
      code: "0",
      data: {
        signature: sha1(str),
      },
      message: "success",
    });
  });
});

/** 企业应用微信授权签名
 *@param {String}  url 签名用的url
 *@return {Object} res 返回最新有效签名t
 * res.data.signature  签名
 */
app.get("/wxapi/wxAppAuth", function (req, res) {
  getAccessTokenAndTicket(base.corpid, base.secret, true).then((data) => {
    let str = `jsapi_ticket=${data.ticket}&noncestr=${base.nonceStr}&timestamp=${base.timestamp}&url=${req.query.url}`;
    res.json({
      code: "0",
      data: {
        signature: sha1(str),
      },
      message: "success",
    });
  });
});

var server = app.listen(8880, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("应用实例，访问地址为 ", host);
  console.log("应用实例，访问地址为 http://%s:%s", host, port);
});
