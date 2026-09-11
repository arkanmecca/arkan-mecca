"use strict";
var Rihla = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/gas-timers.js
  function setTimeout() {
    throw new Error("Asynchronous timers are unavailable in Apps Script; use synchronous bcrypt APIs.");
  }
  var init_gas_timers = __esm({
    "src/gas-timers.js"() {
    }
  });

  // src/crypto-gas.cjs
  var require_crypto_gas = __commonJS({
    "src/crypto-gas.cjs"(exports, module) {
      "use strict";
      init_gas_timers();
      module.exports = {};
    }
  });

  // node_modules/bcryptjs/umd/index.js
  var require_umd = __commonJS({
    "node_modules/bcryptjs/umd/index.js"(exports, module) {
      init_gas_timers();
      (function(global, factory) {
        function preferDefault(exports2) {
          return exports2.default || exports2;
        }
        if (typeof define === "function" && define.amd) {
          define(["crypto"], function(_crypto) {
            var exports2 = {};
            factory(exports2, _crypto);
            return preferDefault(exports2);
          });
        } else if (typeof exports === "object") {
          factory(exports, require_crypto_gas());
          if (typeof module === "object") module.exports = preferDefault(exports);
        } else {
          (function() {
            var exports2 = {};
            factory(exports2, global.crypto);
            global.bcrypt = preferDefault(exports2);
          })();
        }
      })(
        typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : exports,
        function(_exports, _crypto) {
          "use strict";
          Object.defineProperty(_exports, "__esModule", {
            value: true
          });
          _exports.compare = compare;
          _exports.compareSync = compareSync;
          _exports.decodeBase64 = decodeBase64;
          _exports.default = void 0;
          _exports.encodeBase64 = encodeBase64;
          _exports.genSalt = genSalt;
          _exports.genSaltSync = genSaltSync;
          _exports.getRounds = getRounds;
          _exports.getSalt = getSalt;
          _exports.hash = hash;
          _exports.hashSync = hashSync;
          _exports.setRandomFallback = setRandomFallback;
          _exports.truncates = truncates;
          _crypto = _interopRequireDefault(_crypto);
          function _interopRequireDefault(e) {
            return e && e.__esModule ? e : { default: e };
          }
          var randomFallback = null;
          function randomBytes(len) {
            try {
              return crypto.getRandomValues(new Uint8Array(len));
            } catch {
            }
            try {
              return _crypto.default.randomBytes(len);
            } catch {
            }
            if (!randomFallback) {
              throw Error(
                "Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative"
              );
            }
            return randomFallback(len);
          }
          function setRandomFallback(random) {
            randomFallback = random;
          }
          function genSaltSync(rounds, seed_length) {
            rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
            if (typeof rounds !== "number")
              throw Error(
                "Illegal arguments: " + typeof rounds + ", " + typeof seed_length
              );
            if (rounds < 4) rounds = 4;
            else if (rounds > 31) rounds = 31;
            var salt = [];
            salt.push("$2b$");
            if (rounds < 10) salt.push("0");
            salt.push(rounds.toString());
            salt.push("$");
            salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
            return salt.join("");
          }
          function genSalt(rounds, seed_length, callback) {
            if (typeof seed_length === "function")
              callback = seed_length, seed_length = void 0;
            if (typeof rounds === "function")
              callback = rounds, rounds = void 0;
            if (typeof rounds === "undefined") rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
            else if (typeof rounds !== "number")
              throw Error("illegal arguments: " + typeof rounds);
            function _async(callback2) {
              nextTick(function() {
                try {
                  callback2(null, genSaltSync(rounds));
                } catch (err) {
                  callback2(err);
                }
              });
            }
            if (callback) {
              if (typeof callback !== "function")
                throw Error("Illegal callback: " + typeof callback);
              _async(callback);
            } else
              return new Promise(function(resolve, reject) {
                _async(function(err, res) {
                  if (err) {
                    reject(err);
                    return;
                  }
                  resolve(res);
                });
              });
          }
          function hashSync(password, salt) {
            if (typeof salt === "undefined") salt = GENSALT_DEFAULT_LOG2_ROUNDS;
            if (typeof salt === "number") salt = genSaltSync(salt);
            if (typeof password !== "string" || typeof salt !== "string")
              throw Error(
                "Illegal arguments: " + typeof password + ", " + typeof salt
              );
            return _hash(password, salt);
          }
          function hash(password, salt, callback, progressCallback) {
            function _async(callback2) {
              if (typeof password === "string" && typeof salt === "number")
                genSalt(salt, function(err, salt2) {
                  _hash(password, salt2, callback2, progressCallback);
                });
              else if (typeof password === "string" && typeof salt === "string")
                _hash(password, salt, callback2, progressCallback);
              else
                nextTick(
                  callback2.bind(
                    this,
                    Error(
                      "Illegal arguments: " + typeof password + ", " + typeof salt
                    )
                  )
                );
            }
            if (callback) {
              if (typeof callback !== "function")
                throw Error("Illegal callback: " + typeof callback);
              _async(callback);
            } else
              return new Promise(function(resolve, reject) {
                _async(function(err, res) {
                  if (err) {
                    reject(err);
                    return;
                  }
                  resolve(res);
                });
              });
          }
          function safeStringCompare(known, unknown) {
            var diff = known.length ^ unknown.length;
            for (var i = 0; i < known.length; ++i) {
              diff |= known.charCodeAt(i) ^ unknown.charCodeAt(i);
            }
            return diff === 0;
          }
          function compareSync(password, hash2) {
            if (typeof password !== "string" || typeof hash2 !== "string")
              throw Error(
                "Illegal arguments: " + typeof password + ", " + typeof hash2
              );
            if (hash2.length !== 60) return false;
            return safeStringCompare(
              hashSync(password, hash2.substring(0, hash2.length - 31)),
              hash2
            );
          }
          function compare(password, hashValue, callback, progressCallback) {
            function _async(callback2) {
              if (typeof password !== "string" || typeof hashValue !== "string") {
                nextTick(
                  callback2.bind(
                    this,
                    Error(
                      "Illegal arguments: " + typeof password + ", " + typeof hashValue
                    )
                  )
                );
                return;
              }
              if (hashValue.length !== 60) {
                nextTick(callback2.bind(this, null, false));
                return;
              }
              hash(
                password,
                hashValue.substring(0, 29),
                function(err, comp) {
                  if (err) callback2(err);
                  else callback2(null, safeStringCompare(comp, hashValue));
                },
                progressCallback
              );
            }
            if (callback) {
              if (typeof callback !== "function")
                throw Error("Illegal callback: " + typeof callback);
              _async(callback);
            } else
              return new Promise(function(resolve, reject) {
                _async(function(err, res) {
                  if (err) {
                    reject(err);
                    return;
                  }
                  resolve(res);
                });
              });
          }
          function getRounds(hash2) {
            if (typeof hash2 !== "string")
              throw Error("Illegal arguments: " + typeof hash2);
            return parseInt(hash2.split("$")[2], 10);
          }
          function getSalt(hash2) {
            if (typeof hash2 !== "string")
              throw Error("Illegal arguments: " + typeof hash2);
            if (hash2.length !== 60)
              throw Error("Illegal hash length: " + hash2.length + " != 60");
            return hash2.substring(0, 29);
          }
          function truncates(password) {
            if (typeof password !== "string")
              throw Error("Illegal arguments: " + typeof password);
            return utf8Length(password) > 72;
          }
          var nextTick = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
          function utf8Length(string) {
            var len = 0, c = 0;
            for (var i = 0; i < string.length; ++i) {
              c = string.charCodeAt(i);
              if (c < 128) len += 1;
              else if (c < 2048) len += 2;
              else if ((c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320) {
                ++i;
                len += 4;
              } else len += 3;
            }
            return len;
          }
          function utf8Array(string) {
            var offset = 0, c1, c2;
            var buffer = new Array(utf8Length(string));
            for (var i = 0, k = string.length; i < k; ++i) {
              c1 = string.charCodeAt(i);
              if (c1 < 128) {
                buffer[offset++] = c1;
              } else if (c1 < 2048) {
                buffer[offset++] = c1 >> 6 | 192;
                buffer[offset++] = c1 & 63 | 128;
              } else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320) {
                c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
                ++i;
                buffer[offset++] = c1 >> 18 | 240;
                buffer[offset++] = c1 >> 12 & 63 | 128;
                buffer[offset++] = c1 >> 6 & 63 | 128;
                buffer[offset++] = c1 & 63 | 128;
              } else {
                buffer[offset++] = c1 >> 12 | 224;
                buffer[offset++] = c1 >> 6 & 63 | 128;
                buffer[offset++] = c1 & 63 | 128;
              }
            }
            return buffer;
          }
          var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split(
            ""
          );
          var BASE64_INDEX = [
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            0,
            1,
            54,
            55,
            56,
            57,
            58,
            59,
            60,
            61,
            62,
            63,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            14,
            15,
            16,
            17,
            18,
            19,
            20,
            21,
            22,
            23,
            24,
            25,
            26,
            27,
            -1,
            -1,
            -1,
            -1,
            -1,
            -1,
            28,
            29,
            30,
            31,
            32,
            33,
            34,
            35,
            36,
            37,
            38,
            39,
            40,
            41,
            42,
            43,
            44,
            45,
            46,
            47,
            48,
            49,
            50,
            51,
            52,
            53,
            -1,
            -1,
            -1,
            -1,
            -1
          ];
          function base64_encode(b, len) {
            var off = 0, rs = [], c1, c2;
            if (len <= 0 || len > b.length) throw Error("Illegal len: " + len);
            while (off < len) {
              c1 = b[off++] & 255;
              rs.push(BASE64_CODE[c1 >> 2 & 63]);
              c1 = (c1 & 3) << 4;
              if (off >= len) {
                rs.push(BASE64_CODE[c1 & 63]);
                break;
              }
              c2 = b[off++] & 255;
              c1 |= c2 >> 4 & 15;
              rs.push(BASE64_CODE[c1 & 63]);
              c1 = (c2 & 15) << 2;
              if (off >= len) {
                rs.push(BASE64_CODE[c1 & 63]);
                break;
              }
              c2 = b[off++] & 255;
              c1 |= c2 >> 6 & 3;
              rs.push(BASE64_CODE[c1 & 63]);
              rs.push(BASE64_CODE[c2 & 63]);
            }
            return rs.join("");
          }
          function base64_decode(s, len) {
            var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
            if (len <= 0) throw Error("Illegal len: " + len);
            while (off < slen - 1 && olen < len) {
              code = s.charCodeAt(off++);
              c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
              code = s.charCodeAt(off++);
              c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
              if (c1 == -1 || c2 == -1) break;
              o = c1 << 2 >>> 0;
              o |= (c2 & 48) >> 4;
              rs.push(String.fromCharCode(o));
              if (++olen >= len || off >= slen) break;
              code = s.charCodeAt(off++);
              c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
              if (c3 == -1) break;
              o = (c2 & 15) << 4 >>> 0;
              o |= (c3 & 60) >> 2;
              rs.push(String.fromCharCode(o));
              if (++olen >= len || off >= slen) break;
              code = s.charCodeAt(off++);
              c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
              o = (c3 & 3) << 6 >>> 0;
              o |= c4;
              rs.push(String.fromCharCode(o));
              ++olen;
            }
            var res = [];
            for (off = 0; off < olen; off++) res.push(rs[off].charCodeAt(0));
            return res;
          }
          var BCRYPT_SALT_LEN = 16;
          var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
          var BLOWFISH_NUM_ROUNDS = 16;
          var MAX_EXECUTION_TIME = 100;
          var P_ORIG = [
            608135816,
            2242054355,
            320440878,
            57701188,
            2752067618,
            698298832,
            137296536,
            3964562569,
            1160258022,
            953160567,
            3193202383,
            887688300,
            3232508343,
            3380367581,
            1065670069,
            3041331479,
            2450970073,
            2306472731
          ];
          var S_ORIG = [
            3509652390,
            2564797868,
            805139163,
            3491422135,
            3101798381,
            1780907670,
            3128725573,
            4046225305,
            614570311,
            3012652279,
            134345442,
            2240740374,
            1667834072,
            1901547113,
            2757295779,
            4103290238,
            227898511,
            1921955416,
            1904987480,
            2182433518,
            2069144605,
            3260701109,
            2620446009,
            720527379,
            3318853667,
            677414384,
            3393288472,
            3101374703,
            2390351024,
            1614419982,
            1822297739,
            2954791486,
            3608508353,
            3174124327,
            2024746970,
            1432378464,
            3864339955,
            2857741204,
            1464375394,
            1676153920,
            1439316330,
            715854006,
            3033291828,
            289532110,
            2706671279,
            2087905683,
            3018724369,
            1668267050,
            732546397,
            1947742710,
            3462151702,
            2609353502,
            2950085171,
            1814351708,
            2050118529,
            680887927,
            999245976,
            1800124847,
            3300911131,
            1713906067,
            1641548236,
            4213287313,
            1216130144,
            1575780402,
            4018429277,
            3917837745,
            3693486850,
            3949271944,
            596196993,
            3549867205,
            258830323,
            2213823033,
            772490370,
            2760122372,
            1774776394,
            2652871518,
            566650946,
            4142492826,
            1728879713,
            2882767088,
            1783734482,
            3629395816,
            2517608232,
            2874225571,
            1861159788,
            326777828,
            3124490320,
            2130389656,
            2716951837,
            967770486,
            1724537150,
            2185432712,
            2364442137,
            1164943284,
            2105845187,
            998989502,
            3765401048,
            2244026483,
            1075463327,
            1455516326,
            1322494562,
            910128902,
            469688178,
            1117454909,
            936433444,
            3490320968,
            3675253459,
            1240580251,
            122909385,
            2157517691,
            634681816,
            4142456567,
            3825094682,
            3061402683,
            2540495037,
            79693498,
            3249098678,
            1084186820,
            1583128258,
            426386531,
            1761308591,
            1047286709,
            322548459,
            995290223,
            1845252383,
            2603652396,
            3431023940,
            2942221577,
            3202600964,
            3727903485,
            1712269319,
            422464435,
            3234572375,
            1170764815,
            3523960633,
            3117677531,
            1434042557,
            442511882,
            3600875718,
            1076654713,
            1738483198,
            4213154764,
            2393238008,
            3677496056,
            1014306527,
            4251020053,
            793779912,
            2902807211,
            842905082,
            4246964064,
            1395751752,
            1040244610,
            2656851899,
            3396308128,
            445077038,
            3742853595,
            3577915638,
            679411651,
            2892444358,
            2354009459,
            1767581616,
            3150600392,
            3791627101,
            3102740896,
            284835224,
            4246832056,
            1258075500,
            768725851,
            2589189241,
            3069724005,
            3532540348,
            1274779536,
            3789419226,
            2764799539,
            1660621633,
            3471099624,
            4011903706,
            913787905,
            3497959166,
            737222580,
            2514213453,
            2928710040,
            3937242737,
            1804850592,
            3499020752,
            2949064160,
            2386320175,
            2390070455,
            2415321851,
            4061277028,
            2290661394,
            2416832540,
            1336762016,
            1754252060,
            3520065937,
            3014181293,
            791618072,
            3188594551,
            3933548030,
            2332172193,
            3852520463,
            3043980520,
            413987798,
            3465142937,
            3030929376,
            4245938359,
            2093235073,
            3534596313,
            375366246,
            2157278981,
            2479649556,
            555357303,
            3870105701,
            2008414854,
            3344188149,
            4221384143,
            3956125452,
            2067696032,
            3594591187,
            2921233993,
            2428461,
            544322398,
            577241275,
            1471733935,
            610547355,
            4027169054,
            1432588573,
            1507829418,
            2025931657,
            3646575487,
            545086370,
            48609733,
            2200306550,
            1653985193,
            298326376,
            1316178497,
            3007786442,
            2064951626,
            458293330,
            2589141269,
            3591329599,
            3164325604,
            727753846,
            2179363840,
            146436021,
            1461446943,
            4069977195,
            705550613,
            3059967265,
            3887724982,
            4281599278,
            3313849956,
            1404054877,
            2845806497,
            146425753,
            1854211946,
            1266315497,
            3048417604,
            3681880366,
            3289982499,
            290971e4,
            1235738493,
            2632868024,
            2414719590,
            3970600049,
            1771706367,
            1449415276,
            3266420449,
            422970021,
            1963543593,
            2690192192,
            3826793022,
            1062508698,
            1531092325,
            1804592342,
            2583117782,
            2714934279,
            4024971509,
            1294809318,
            4028980673,
            1289560198,
            2221992742,
            1669523910,
            35572830,
            157838143,
            1052438473,
            1016535060,
            1802137761,
            1753167236,
            1386275462,
            3080475397,
            2857371447,
            1040679964,
            2145300060,
            2390574316,
            1461121720,
            2956646967,
            4031777805,
            4028374788,
            33600511,
            2920084762,
            1018524850,
            629373528,
            3691585981,
            3515945977,
            2091462646,
            2486323059,
            586499841,
            988145025,
            935516892,
            3367335476,
            2599673255,
            2839830854,
            265290510,
            3972581182,
            2759138881,
            3795373465,
            1005194799,
            847297441,
            406762289,
            1314163512,
            1332590856,
            1866599683,
            4127851711,
            750260880,
            613907577,
            1450815602,
            3165620655,
            3734664991,
            3650291728,
            3012275730,
            3704569646,
            1427272223,
            778793252,
            1343938022,
            2676280711,
            2052605720,
            1946737175,
            3164576444,
            3914038668,
            3967478842,
            3682934266,
            1661551462,
            3294938066,
            4011595847,
            840292616,
            3712170807,
            616741398,
            312560963,
            711312465,
            1351876610,
            322626781,
            1910503582,
            271666773,
            2175563734,
            1594956187,
            70604529,
            3617834859,
            1007753275,
            1495573769,
            4069517037,
            2549218298,
            2663038764,
            504708206,
            2263041392,
            3941167025,
            2249088522,
            1514023603,
            1998579484,
            1312622330,
            694541497,
            2582060303,
            2151582166,
            1382467621,
            776784248,
            2618340202,
            3323268794,
            2497899128,
            2784771155,
            503983604,
            4076293799,
            907881277,
            423175695,
            432175456,
            1378068232,
            4145222326,
            3954048622,
            3938656102,
            3820766613,
            2793130115,
            2977904593,
            26017576,
            3274890735,
            3194772133,
            1700274565,
            1756076034,
            4006520079,
            3677328699,
            720338349,
            1533947780,
            354530856,
            688349552,
            3973924725,
            1637815568,
            332179504,
            3949051286,
            53804574,
            2852348879,
            3044236432,
            1282449977,
            3583942155,
            3416972820,
            4006381244,
            1617046695,
            2628476075,
            3002303598,
            1686838959,
            431878346,
            2686675385,
            1700445008,
            1080580658,
            1009431731,
            832498133,
            3223435511,
            2605976345,
            2271191193,
            2516031870,
            1648197032,
            4164389018,
            2548247927,
            300782431,
            375919233,
            238389289,
            3353747414,
            2531188641,
            2019080857,
            1475708069,
            455242339,
            2609103871,
            448939670,
            3451063019,
            1395535956,
            2413381860,
            1841049896,
            1491858159,
            885456874,
            4264095073,
            4001119347,
            1565136089,
            3898914787,
            1108368660,
            540939232,
            1173283510,
            2745871338,
            3681308437,
            4207628240,
            3343053890,
            4016749493,
            1699691293,
            1103962373,
            3625875870,
            2256883143,
            3830138730,
            1031889488,
            3479347698,
            1535977030,
            4236805024,
            3251091107,
            2132092099,
            1774941330,
            1199868427,
            1452454533,
            157007616,
            2904115357,
            342012276,
            595725824,
            1480756522,
            206960106,
            497939518,
            591360097,
            863170706,
            2375253569,
            3596610801,
            1814182875,
            2094937945,
            3421402208,
            1082520231,
            3463918190,
            2785509508,
            435703966,
            3908032597,
            1641649973,
            2842273706,
            3305899714,
            1510255612,
            2148256476,
            2655287854,
            3276092548,
            4258621189,
            236887753,
            3681803219,
            274041037,
            1734335097,
            3815195456,
            3317970021,
            1899903192,
            1026095262,
            4050517792,
            356393447,
            2410691914,
            3873677099,
            3682840055,
            3913112168,
            2491498743,
            4132185628,
            2489919796,
            1091903735,
            1979897079,
            3170134830,
            3567386728,
            3557303409,
            857797738,
            1136121015,
            1342202287,
            507115054,
            2535736646,
            337727348,
            3213592640,
            1301675037,
            2528481711,
            1895095763,
            1721773893,
            3216771564,
            62756741,
            2142006736,
            835421444,
            2531993523,
            1442658625,
            3659876326,
            2882144922,
            676362277,
            1392781812,
            170690266,
            3921047035,
            1759253602,
            3611846912,
            1745797284,
            664899054,
            1329594018,
            3901205900,
            3045908486,
            2062866102,
            2865634940,
            3543621612,
            3464012697,
            1080764994,
            553557557,
            3656615353,
            3996768171,
            991055499,
            499776247,
            1265440854,
            648242737,
            3940784050,
            980351604,
            3713745714,
            1749149687,
            3396870395,
            4211799374,
            3640570775,
            1161844396,
            3125318951,
            1431517754,
            545492359,
            4268468663,
            3499529547,
            1437099964,
            2702547544,
            3433638243,
            2581715763,
            2787789398,
            1060185593,
            1593081372,
            2418618748,
            4260947970,
            69676912,
            2159744348,
            86519011,
            2512459080,
            3838209314,
            1220612927,
            3339683548,
            133810670,
            1090789135,
            1078426020,
            1569222167,
            845107691,
            3583754449,
            4072456591,
            1091646820,
            628848692,
            1613405280,
            3757631651,
            526609435,
            236106946,
            48312990,
            2942717905,
            3402727701,
            1797494240,
            859738849,
            992217954,
            4005476642,
            2243076622,
            3870952857,
            3732016268,
            765654824,
            3490871365,
            2511836413,
            1685915746,
            3888969200,
            1414112111,
            2273134842,
            3281911079,
            4080962846,
            172450625,
            2569994100,
            980381355,
            4109958455,
            2819808352,
            2716589560,
            2568741196,
            3681446669,
            3329971472,
            1835478071,
            660984891,
            3704678404,
            4045999559,
            3422617507,
            3040415634,
            1762651403,
            1719377915,
            3470491036,
            2693910283,
            3642056355,
            3138596744,
            1364962596,
            2073328063,
            1983633131,
            926494387,
            3423689081,
            2150032023,
            4096667949,
            1749200295,
            3328846651,
            309677260,
            2016342300,
            1779581495,
            3079819751,
            111262694,
            1274766160,
            443224088,
            298511866,
            1025883608,
            3806446537,
            1145181785,
            168956806,
            3641502830,
            3584813610,
            1689216846,
            3666258015,
            3200248200,
            1692713982,
            2646376535,
            4042768518,
            1618508792,
            1610833997,
            3523052358,
            4130873264,
            2001055236,
            3610705100,
            2202168115,
            4028541809,
            2961195399,
            1006657119,
            2006996926,
            3186142756,
            1430667929,
            3210227297,
            1314452623,
            4074634658,
            4101304120,
            2273951170,
            1399257539,
            3367210612,
            3027628629,
            1190975929,
            2062231137,
            2333990788,
            2221543033,
            2438960610,
            1181637006,
            548689776,
            2362791313,
            3372408396,
            3104550113,
            3145860560,
            296247880,
            1970579870,
            3078560182,
            3769228297,
            1714227617,
            3291629107,
            3898220290,
            166772364,
            1251581989,
            493813264,
            448347421,
            195405023,
            2709975567,
            677966185,
            3703036547,
            1463355134,
            2715995803,
            1338867538,
            1343315457,
            2802222074,
            2684532164,
            233230375,
            2599980071,
            2000651841,
            3277868038,
            1638401717,
            4028070440,
            3237316320,
            6314154,
            819756386,
            300326615,
            590932579,
            1405279636,
            3267499572,
            3150704214,
            2428286686,
            3959192993,
            3461946742,
            1862657033,
            1266418056,
            963775037,
            2089974820,
            2263052895,
            1917689273,
            448879540,
            3550394620,
            3981727096,
            150775221,
            3627908307,
            1303187396,
            508620638,
            2975983352,
            2726630617,
            1817252668,
            1876281319,
            1457606340,
            908771278,
            3720792119,
            3617206836,
            2455994898,
            1729034894,
            1080033504,
            976866871,
            3556439503,
            2881648439,
            1522871579,
            1555064734,
            1336096578,
            3548522304,
            2579274686,
            3574697629,
            3205460757,
            3593280638,
            3338716283,
            3079412587,
            564236357,
            2993598910,
            1781952180,
            1464380207,
            3163844217,
            3332601554,
            1699332808,
            1393555694,
            1183702653,
            3581086237,
            1288719814,
            691649499,
            2847557200,
            2895455976,
            3193889540,
            2717570544,
            1781354906,
            1676643554,
            2592534050,
            3230253752,
            1126444790,
            2770207658,
            2633158820,
            2210423226,
            2615765581,
            2414155088,
            3127139286,
            673620729,
            2805611233,
            1269405062,
            4015350505,
            3341807571,
            4149409754,
            1057255273,
            2012875353,
            2162469141,
            2276492801,
            2601117357,
            993977747,
            3918593370,
            2654263191,
            753973209,
            36408145,
            2530585658,
            25011837,
            3520020182,
            2088578344,
            530523599,
            2918365339,
            1524020338,
            1518925132,
            3760827505,
            3759777254,
            1202760957,
            3985898139,
            3906192525,
            674977740,
            4174734889,
            2031300136,
            2019492241,
            3983892565,
            4153806404,
            3822280332,
            352677332,
            2297720250,
            60907813,
            90501309,
            3286998549,
            1016092578,
            2535922412,
            2839152426,
            457141659,
            509813237,
            4120667899,
            652014361,
            1966332200,
            2975202805,
            55981186,
            2327461051,
            676427537,
            3255491064,
            2882294119,
            3433927263,
            1307055953,
            942726286,
            933058658,
            2468411793,
            3933900994,
            4215176142,
            1361170020,
            2001714738,
            2830558078,
            3274259782,
            1222529897,
            1679025792,
            2729314320,
            3714953764,
            1770335741,
            151462246,
            3013232138,
            1682292957,
            1483529935,
            471910574,
            1539241949,
            458788160,
            3436315007,
            1807016891,
            3718408830,
            978976581,
            1043663428,
            3165965781,
            1927990952,
            4200891579,
            2372276910,
            3208408903,
            3533431907,
            1412390302,
            2931980059,
            4132332400,
            1947078029,
            3881505623,
            4168226417,
            2941484381,
            1077988104,
            1320477388,
            886195818,
            18198404,
            3786409e3,
            2509781533,
            112762804,
            3463356488,
            1866414978,
            891333506,
            18488651,
            661792760,
            1628790961,
            3885187036,
            3141171499,
            876946877,
            2693282273,
            1372485963,
            791857591,
            2686433993,
            3759982718,
            3167212022,
            3472953795,
            2716379847,
            445679433,
            3561995674,
            3504004811,
            3574258232,
            54117162,
            3331405415,
            2381918588,
            3769707343,
            4154350007,
            1140177722,
            4074052095,
            668550556,
            3214352940,
            367459370,
            261225585,
            2610173221,
            4209349473,
            3468074219,
            3265815641,
            314222801,
            3066103646,
            3808782860,
            282218597,
            3406013506,
            3773591054,
            379116347,
            1285071038,
            846784868,
            2669647154,
            3771962079,
            3550491691,
            2305946142,
            453669953,
            1268987020,
            3317592352,
            3279303384,
            3744833421,
            2610507566,
            3859509063,
            266596637,
            3847019092,
            517658769,
            3462560207,
            3443424879,
            370717030,
            4247526661,
            2224018117,
            4143653529,
            4112773975,
            2788324899,
            2477274417,
            1456262402,
            2901442914,
            1517677493,
            1846949527,
            2295493580,
            3734397586,
            2176403920,
            1280348187,
            1908823572,
            3871786941,
            846861322,
            1172426758,
            3287448474,
            3383383037,
            1655181056,
            3139813346,
            901632758,
            1897031941,
            2986607138,
            3066810236,
            3447102507,
            1393639104,
            373351379,
            950779232,
            625454576,
            3124240540,
            4148612726,
            2007998917,
            544563296,
            2244738638,
            2330496472,
            2058025392,
            1291430526,
            424198748,
            50039436,
            29584100,
            3605783033,
            2429876329,
            2791104160,
            1057563949,
            3255363231,
            3075367218,
            3463963227,
            1469046755,
            985887462
          ];
          var C_ORIG = [
            1332899944,
            1700884034,
            1701343084,
            1684370003,
            1668446532,
            1869963892
          ];
          function _encipher(lr, off, P, S) {
            var n, l = lr[off], r = lr[off + 1];
            l ^= P[0];
            n = S[l >>> 24];
            n += S[256 | l >> 16 & 255];
            n ^= S[512 | l >> 8 & 255];
            n += S[768 | l & 255];
            r ^= n ^ P[1];
            n = S[r >>> 24];
            n += S[256 | r >> 16 & 255];
            n ^= S[512 | r >> 8 & 255];
            n += S[768 | r & 255];
            l ^= n ^ P[2];
            n = S[l >>> 24];
            n += S[256 | l >> 16 & 255];
            n ^= S[512 | l >> 8 & 255];
            n += S[768 | l & 255];
            r ^= n ^ P[3];
            n = S[r >>> 24];
            n += S[256 | r >> 16 & 255];
            n ^= S[512 | r >> 8 & 255];
            n += S[768 | r & 255];
            l ^= n ^ P[4];
            n = S[l >>> 24];
            n += S[256 | l >> 16 & 255];
            n ^= S[512 | l >> 8 & 255];
            n += S[768 | l & 255];
            r ^= n ^ P[5];
            n = S[r >>> 24];
            n += S[256 | r >> 16 & 255];
            n ^= S[512 | r >> 8 & 255];
            n += S[768 | r & 255];
            l ^= n ^ P[6];
            n = S[l >>> 24];
            n += S[256 | l >> 16 & 255];
            n ^= S[512 | l >> 8 & 255];
            n += S[768 | l & 255];
            r ^= n ^ P[7];
            n = S[r >>> 24];
            n += S[256 | r >> 16 & 255];
            n ^= S[512 | r >> 8 & 255];
            n += S[768 | r & 255];
            l ^= n ^ P[8];
            n = S[l >>> 24];
            n += S[256 | l >> 16 & 255];
            n ^= S[512 | l >> 8 & 255];
            n += S[768 | l & 255];
            r ^= n ^ P[9];
            n = S[r >>> 24];
            n += S[256 | r >> 16 & 255];
            n ^= S[512 | r >> 8 & 255];
            n += S[768 | r & 255];
            l ^= n ^ P[10];
            n = S[l >>> 24];
            n += S[256 | l >> 16 & 255];
            n ^= S[512 | l >> 8 & 255];
            n += S[768 | l & 255];
            r ^= n ^ P[11];
            n = S[r >>> 24];
            n += S[256 | r >> 16 & 255];
            n ^= S[512 | r >> 8 & 255];
            n += S[768 | r & 255];
            l ^= n ^ P[12];
            n = S[l >>> 24];
            n += S[256 | l >> 16 & 255];
            n ^= S[512 | l >> 8 & 255];
            n += S[768 | l & 255];
            r ^= n ^ P[13];
            n = S[r >>> 24];
            n += S[256 | r >> 16 & 255];
            n ^= S[512 | r >> 8 & 255];
            n += S[768 | r & 255];
            l ^= n ^ P[14];
            n = S[l >>> 24];
            n += S[256 | l >> 16 & 255];
            n ^= S[512 | l >> 8 & 255];
            n += S[768 | l & 255];
            r ^= n ^ P[15];
            n = S[r >>> 24];
            n += S[256 | r >> 16 & 255];
            n ^= S[512 | r >> 8 & 255];
            n += S[768 | r & 255];
            l ^= n ^ P[16];
            lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
            lr[off + 1] = l;
            return lr;
          }
          function _streamtoword(data, offp) {
            for (var i = 0, word = 0; i < 4; ++i)
              word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
            return {
              key: word,
              offp
            };
          }
          function _key(key, P, S) {
            var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
            for (var i = 0; i < plen; i++)
              sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
            for (i = 0; i < plen; i += 2)
              lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
            for (i = 0; i < slen; i += 2)
              lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
          }
          function _ekskey(data, key, P, S) {
            var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
            for (var i = 0; i < plen; i++)
              sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
            offp = 0;
            for (i = 0; i < plen; i += 2)
              sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
            for (i = 0; i < slen; i += 2)
              sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
          }
          function _crypt(b, salt, rounds, callback, progressCallback) {
            var cdata = C_ORIG.slice(), clen = cdata.length, err;
            if (rounds < 4 || rounds > 31) {
              err = Error("Illegal number of rounds (4-31): " + rounds);
              if (callback) {
                nextTick(callback.bind(this, err));
                return;
              } else throw err;
            }
            if (salt.length !== BCRYPT_SALT_LEN) {
              err = Error(
                "Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN
              );
              if (callback) {
                nextTick(callback.bind(this, err));
                return;
              } else throw err;
            }
            rounds = 1 << rounds >>> 0;
            var P, S, i = 0, j;
            if (typeof Int32Array === "function") {
              P = new Int32Array(P_ORIG);
              S = new Int32Array(S_ORIG);
            } else {
              P = P_ORIG.slice();
              S = S_ORIG.slice();
            }
            _ekskey(salt, b, P, S);
            function next() {
              if (progressCallback) progressCallback(i / rounds);
              if (i < rounds) {
                var start = Date.now();
                for (; i < rounds; ) {
                  i = i + 1;
                  _key(b, P, S);
                  _key(salt, P, S);
                  if (Date.now() - start > MAX_EXECUTION_TIME) break;
                }
              } else {
                for (i = 0; i < 64; i++)
                  for (j = 0; j < clen >> 1; j++) _encipher(cdata, j << 1, P, S);
                var ret = [];
                for (i = 0; i < clen; i++)
                  ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
                if (callback) {
                  callback(null, ret);
                  return;
                } else return ret;
              }
              if (callback) nextTick(next);
            }
            if (typeof callback !== "undefined") {
              next();
            } else {
              var res;
              while (true)
                if (typeof (res = next()) !== "undefined") return res || [];
            }
          }
          function _hash(password, salt, callback, progressCallback) {
            var err;
            if (typeof password !== "string" || typeof salt !== "string") {
              err = Error("Invalid string / salt: Not a string");
              if (callback) {
                nextTick(callback.bind(this, err));
                return;
              } else throw err;
            }
            var minor, offset;
            if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
              err = Error("Invalid salt version: " + salt.substring(0, 2));
              if (callback) {
                nextTick(callback.bind(this, err));
                return;
              } else throw err;
            }
            if (salt.charAt(2) === "$")
              minor = String.fromCharCode(0), offset = 3;
            else {
              minor = salt.charAt(2);
              if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
                err = Error("Invalid salt revision: " + salt.substring(2, 4));
                if (callback) {
                  nextTick(callback.bind(this, err));
                  return;
                } else throw err;
              }
              offset = 4;
            }
            if (salt.charAt(offset + 2) > "$") {
              err = Error("Missing salt rounds");
              if (callback) {
                nextTick(callback.bind(this, err));
                return;
              } else throw err;
            }
            var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
            password += minor >= "a" ? "\0" : "";
            var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
            function finish(bytes) {
              var res = [];
              res.push("$2");
              if (minor >= "a") res.push(minor);
              res.push("$");
              if (rounds < 10) res.push("0");
              res.push(rounds.toString());
              res.push("$");
              res.push(base64_encode(saltb, saltb.length));
              res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
              return res.join("");
            }
            if (typeof callback == "undefined")
              return finish(_crypt(passwordb, saltb, rounds));
            else {
              _crypt(
                passwordb,
                saltb,
                rounds,
                function(err2, bytes) {
                  if (err2) callback(err2, null);
                  else callback(null, finish(bytes));
                },
                progressCallback
              );
            }
          }
          function encodeBase64(bytes, length) {
            return base64_encode(bytes, length);
          }
          function decodeBase64(string, length) {
            return base64_decode(string, length);
          }
          var _default = _exports.default = {
            setRandomFallback,
            genSaltSync,
            genSalt,
            hashSync,
            hash,
            compareSync,
            compare,
            getRounds,
            getSalt,
            truncates,
            encodeBase64,
            decodeBase64
          };
        }
      );
    }
  });

  // src/pricing.cjs
  var require_pricing = __commonJS({
    "src/pricing.cjs"(exports, module) {
      "use strict";
      init_gas_timers();
      var AppError = class extends Error {
        constructor(code, message) {
          super(message);
          this.code = code;
        }
      };
      function fail(code, message) {
        throw new AppError(code, message);
      }
      function number(value, label = "\u0627\u0644\u0642\u064A\u0645\u0629", min = 0, max = 1e9) {
        const n = Number(value ?? 0);
        if (!Number.isFinite(n) || n < min || n > max) fail("VALIDATION", `${label}: \u0623\u062F\u062E\u0644 \u0631\u0642\u0645\u0627\u064B \u0628\u064A\u0646 ${min} \u0648${max}`);
        return n;
      }
      function integer(value, label, min = 0, max = 1e3) {
        const n = number(value, label, min, max);
        if (!Number.isInteger(n)) fail("VALIDATION", `${label}: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0639\u062F\u062F\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B`);
        return n;
      }
      function text(value, label = "\u0627\u0644\u0627\u0633\u0645", max = 300, required = false) {
        const s = String(value ?? "").trim();
        if (s.length > max || required && !s) fail("VALIDATION", `${label}: \u0627\u0644\u0642\u064A\u0645\u0629 \u0645\u0637\u0644\u0648\u0628\u0629 \u0648\u0628\u062D\u062F \u0623\u0642\u0635\u0649 ${max} \u062D\u0631\u0641`);
        return s;
      }
      function money(n) {
        if (!Number.isFinite(n) || Math.abs(n) > 1e12) fail("VALIDATION", "\u0627\u0644\u0645\u0628\u0644\u063A \u0627\u0644\u0645\u062D\u0633\u0648\u0628 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
        return Math.round((n + Number.EPSILON) * 1e3) / 1e3;
      }
      function roundUp(n, step) {
        return step > 0 ? Math.ceil(n / step) * step : n;
      }
      var CURRENCIES = ["LYD", "USD", "SAR"];
      function currency(value = "LYD") {
        if (!CURRENCIES.includes(value)) fail("VALIDATION", "\u0627\u0644\u0639\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629");
        return value;
      }
      function convertCurrency(n, from, to, p) {
        currency(from);
        currency(to);
        if (from === to) return n;
        const usdToLyd = number(p.usdToLyd, "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0628\u0627\u0644\u062F\u064A\u0646\u0627\u0631", 1e-4);
        const sarPerUsd = from === "SAR" || to === "SAR" ? number(p.sarPerUsd, "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0628\u0627\u0644\u0631\u064A\u0627\u0644", 1e-4) : 1;
        const rates = { LYD: 1, USD: usdToLyd, SAR: usdToLyd / sarPerUsd };
        return n * rates[from] / rates[to];
      }
      function totalsByCurrency(lines) {
        const totals = {};
        for (const l of lines) {
          const code = currency(l.currency || "LYD");
          totals[code] || (totals[code] = { currency: code, total: 0, cost: 0, profit: 0 });
          totals[code].total += l.total;
          totals[code].cost += l.cost;
        }
        return Object.values(totals).map((t) => ({ ...t, total: money(t.total), cost: money(t.cost), profit: money(t.total - t.cost) }));
      }
      function currencyToLyd(n, currency2, p) {
        if (currency2 === "LYD") return n;
        if (currency2 === "USD") return n * number(p.usdToLyd, "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0628\u0627\u0644\u062F\u064A\u0646\u0627\u0631", 1e-4);
        if (currency2 === "SAR") return n / number(p.sarPerUsd, "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0628\u0627\u0644\u0631\u064A\u0627\u0644", 1e-4) * number(p.usdToLyd, "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0628\u0627\u0644\u062F\u064A\u0646\u0627\u0631", 1e-4);
        fail("VALIDATION", "\u0639\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0639\u062A\u0645\u062F\u0629");
      }
      function calculateProgram(input, rooms, services = []) {
        const p = {};
        for (const key of ["makkahRate", "madinahRate", "extraBed", "visaUsd", "ticketLyd", "transportLyd", "otherLyd", "profitValue", "rounding"]) p[key] = number(input[key], key);
        p.makkahNights = integer(input.makkahNights, "\u0644\u064A\u0627\u0644\u064A \u0645\u0643\u0629", 0, 365);
        p.madinahNights = integer(input.madinahNights, "\u0644\u064A\u0627\u0644\u064A \u0627\u0644\u0645\u062F\u064A\u0646\u0629", 0, 365);
        p.includeMadinah = input.includeMadinah === true;
        p.sarPerUsd = number(input.sarPerUsd ?? 3.72, "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0628\u0627\u0644\u0631\u064A\u0627\u0644", 1e-4);
        p.usdToLyd = number(input.usdToLyd ?? 4.85, "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0628\u0627\u0644\u062F\u064A\u0646\u0627\u0631", 1e-4);
        p.profitType = input.profitType === "fixed" ? "fixed" : "percent";
        p.serviceIds = [...new Set(input.serviceIds || [])];
        const serviceCostLYD = p.serviceIds.reduce((sum, id) => {
          const svc = services.find((s) => s.id === id && s.active !== false);
          if (!svc) fail("VALIDATION", "\u0625\u062D\u062F\u0649 \u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062C \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629");
          return sum + currencyToLyd(number(svc.cost), svc.currency || "LYD", p);
        }, 0);
        if (!rooms.length) fail("VALIDATION", "\u0627\u062E\u062A\u0631 \u0646\u0648\u0639 \u063A\u0631\u0641\u0629 \u0648\u0627\u062D\u062F\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644");
        const totalNights = p.makkahNights + (p.includeMadinah ? p.madinahNights : 0);
        const baseRoomSAR = p.makkahRate * p.makkahNights + (p.includeMadinah ? p.madinahRate * p.madinahNights : 0);
        const overrides = input.roomOverrides || {};
        const results = rooms.map((room) => {
          const count = integer(room.occupancy, "\u0639\u062F\u062F \u0627\u0644\u0623\u0634\u062E\u0627\u0635", 1, 20);
          const override = overrides[room.id] || {};
          const makkahRate = override.makkahRate === "" || override.makkahRate == null ? p.makkahRate : number(override.makkahRate);
          const madinahRate = override.madinahRate === "" || override.madinahRate == null ? p.madinahRate : number(override.madinahRate);
          const extraBeds = room.extraBeds == null ? Math.max(0, count - 2) : integer(room.extraBeds, "\u0627\u0644\u0623\u0633\u0631\u0651\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u064A\u0629", 0, 20);
          const extraSAR = p.extraBed * extraBeds * totalNights;
          const totalRoomSAR = makkahRate * p.makkahNights + (p.includeMadinah ? madinahRate * p.madinahNights : 0) + extraSAR;
          const perPersonSAR = totalRoomSAR / count;
          const accommodationUSD = perPersonSAR / p.sarPerUsd;
          const accommodationLYD = accommodationUSD * p.usdToLyd;
          const visaLYD = p.visaUsd * p.usdToLyd;
          const baseCost = accommodationLYD + visaLYD + p.ticketLyd + p.transportLyd + p.otherLyd + serviceCostLYD;
          const plannedProfit = p.profitType === "fixed" ? p.profitValue : baseCost * p.profitValue / 100;
          const calculatedSell = roundUp(baseCost + plannedProfit, p.rounding);
          const sell = override.sell === "" || override.sell == null ? calculatedSell : number(override.sell, "\u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639");
          return {
            key: room.id,
            label: room.name,
            unit: "person",
            currency: "LYD",
            count,
            extraSAR,
            totalRoomSAR,
            perPersonSAR,
            accommodationUSD,
            accommodationLYD,
            visaLYD,
            serviceCostLYD,
            baseCost,
            plannedProfit,
            calculatedSell,
            sell,
            basePrice: money(sell),
            profit: sell - baseCost,
            margin: baseCost > 0 ? (sell - baseCost) / baseCost * 100 : 0
          };
        });
        return { totalNights, baseRoomSAR, serviceCostLYD, results };
      }
      function calculateService(input, service) {
        if (!service || service.active === false) fail("VALIDATION", "\u0627\u062E\u062A\u0631 \u062E\u062F\u0645\u0629 \u0641\u0639\u0627\u0644\u0629");
        const sourceCost = input.cost === "" || input.cost == null ? number(service.cost) : number(input.cost);
        const saleCurrency = currency(input.saleCurrency || service.saleCurrency || "LYD");
        const baseCost = convertCurrency(sourceCost, service.currency || "LYD", saleCurrency, input);
        const profitValue = number(input.profitValue);
        const plannedProfit = input.profitType === "fixed" ? profitValue : baseCost * profitValue / 100;
        const calculatedSell = roundUp(baseCost + plannedProfit, number(input.rounding));
        const sell = input.sell === "" || input.sell == null ? calculatedSell : number(input.sell);
        return { results: [{
          key: service.id,
          label: service.name,
          unit: service.unit || "item",
          currency: saleCurrency,
          baseCost,
          calculatedSell,
          plannedProfit,
          sell,
          basePrice: money(sell),
          profit: sell - baseCost,
          margin: baseCost > 0 ? (sell - baseCost) / baseCost * 100 : 0
        }] };
      }
      function quoteLine(source, input) {
        const quantity = integer(input.quantity, "\u0627\u0644\u0639\u062F\u062F", 1, 1e4);
        const nights = source.unit === "roomNight" ? integer(input.nights, "\u0627\u0644\u0644\u064A\u0627\u0644\u064A", 1, 365) : 1;
        const units = quantity * nights;
        const lineCurrency = currency(source.currency || "LYD");
        const extras = (input.extras || []).map((e) => {
          const code = currency(e.currency || lineCurrency), amount = number(e.amount, "\u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u064A\u0629");
          const rate = code === lineCurrency ? 1 : number(e.rate, "\u0633\u0639\u0631 \u062A\u062D\u0648\u064A\u0644 \u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0625\u0644\u0649 \u0639\u0645\u0644\u0629 \u0627\u0644\u0628\u0646\u062F", 1e-6, 1e6);
          return { label: text(e.label, "\u0648\u0635\u0641 \u0627\u0644\u062A\u0643\u0644\u0641\u0629", 200, true), amount, currency: code, rate, convertedAmount: money(amount * rate) };
        });
        if (extras.length > 20) fail("VALIDATION", "\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 20 \u062A\u0643\u0644\u0641\u0629 \u0625\u0636\u0627\u0641\u064A\u0629 \u0644\u0643\u0644 \u0628\u0646\u062F");
        const extraTotal = money(extras.reduce((sum, e) => sum + e.convertedAmount, 0));
        const purchase = money(source.netPrice * units);
        const cost = money(purchase + extraTotal);
        const marginValue = number(input.marginValue, "\u0647\u0627\u0645\u0634 \u0627\u0644\u0631\u0628\u062D");
        const marginType = input.marginType === "fixed" ? "fixed" : "percent";
        const plannedProfit = marginType === "fixed" ? marginValue * units : cost * marginValue / 100;
        const mode = input.mode === "manual" ? "manual" : "margin";
        const total = money(mode === "manual" ? number(input.sellUnit, "\u0633\u0639\u0631 \u0628\u064A\u0639 \u0627\u0644\u0648\u062D\u062F\u0629") * units : cost + plannedProfit);
        return {
          ...source,
          currency: lineCurrency,
          quantity,
          nights,
          units,
          extras,
          extraTotal,
          purchase,
          cost,
          mode,
          marginType,
          marginValue,
          sellUnit: total / units,
          total,
          profit: money(total - cost),
          belowCost: total < cost
        };
      }
      module.exports = { AppError, fail, number, integer, text, money, roundUp, currency, CURRENCIES, convertCurrency, totalsByCurrency, calculateProgram, calculateService, quoteLine };
    }
  });

  // src/store.cjs
  var require_store = __commonJS({
    "src/store.cjs"(exports, module) {
      "use strict";
      init_gas_timers();
      var TABLES = ["settings", "definitions", "companies", "users", "pricings", "offers", "assignments", "quotes", "companyPricings", "sessions", "attempts", "requests", "audit"];
      var clone = (value) => JSON.parse(JSON.stringify(value));
      var UnitOfWork = class {
        constructor(data, now, id) {
          this.data = data;
          this.now = now;
          this.id = id;
          this.changes = /* @__PURE__ */ new Map();
        }
        all(table) {
          if (!TABLES.includes(table)) throw Error("Unknown table");
          return Object.values(this.data[table] || {}).map(clone);
        }
        get(table, id) {
          const r = this.data[table]?.[id];
          return r ? clone(r) : null;
        }
        put(table, value) {
          var _a;
          const old = this.data[table]?.[value.id];
          const row = { ...clone(value), id: value.id || this.id(), version: (old?.version || 0) + 1, updatedAt: new Date(this.now()).toISOString() };
          if (JSON.stringify(row).length > 44e3) throw Error("RECORD_SIZE");
          (_a = this.data)[table] || (_a[table] = {});
          this.data[table][row.id] = row;
          this.changes.set(`${table}/${row.id}`, { table, row });
          return clone(row);
        }
        remove(table, id) {
          delete this.data[table][id];
          this.changes.set(`${table}/${id}`, { table, id, remove: true });
        }
      };
      var MemoryStore = class {
        constructor({ now = Date.now, id = () => globalThis.crypto.randomUUID(), data } = {}) {
          this.now = now;
          this.id = id;
          this.data = data || Object.fromEntries(TABLES.map((t) => [t, {}]));
        }
        transaction(fn) {
          const uow = new UnitOfWork(clone(this.data), this.now, this.id);
          const result = fn(uow);
          this.data = uow.data;
          return result;
        }
        read(fn) {
          const uow = new UnitOfWork(clone(this.data), this.now, this.id);
          const result = fn(uow);
          if (uow.changes.size) throw Error("read() must not write data; use transaction() instead");
          return result;
        }
      };
      module.exports = { TABLES, UnitOfWork, MemoryStore, clone };
    }
  });

  // src/app.cjs
  var require_app = __commonJS({
    "src/app.cjs"(exports, module) {
      "use strict";
      init_gas_timers();
      var { AppError, fail, number, integer, text, money, currency, totalsByCurrency, calculateProgram, calculateService, quoteLine } = require_pricing();
      var { TABLES, clone } = require_store();
      var PERMISSIONS = ["viewCost", "editDefinitions", "editPricing", "approve", "publish", "manageCompanies", "manageUsers", "export"];
      var MUTATIONS = /* @__PURE__ */ new Set(["definition.save", "definition.import", "company.save", "user.save", "pricing.save", "offer.save", "offer.approve", "offer.archive", "publish.commit", "quote.save", "quote.archive", "settings.save", "account.password", "company.pricing.save", "company.pricing.archive", "assignment.toggle"]);
      var safeUser = (u) => ({ id: u.id, name: u.name, username: u.username, role: u.role, companyId: u.companyId || "", permissions: u.permissions || [], active: u.active, mustChange: !!u.mustChange, version: u.version });
      var permission = (u, p) => u.role === "admin" || u.role === "employee" && (u.permissions || []).includes(p);
      function requirePermission(u, p) {
        if (!permission(u, p)) fail("FORBIDDEN", "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629");
      }
      function version(old, expected) {
        if (old && old.version !== Number(expected)) fail("CONFLICT", "\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644 \u0645\u0646\u0630 \u0641\u062A\u062D\u0647. \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644\u0647 \u0648\u0631\u0627\u062C\u0639 \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0642\u0628\u0644 \u0627\u0644\u062D\u0641\u0638.");
      }
      function date(value) {
        const s = text(value, "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", 10);
        if (s && (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s)) fail("VALIDATION", "\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        return s;
      }
      function idValue(value) {
        return text(value, "\u0627\u0644\u0645\u0639\u0631\u0641", 150, true);
      }
      function requireRow(tx, table, id) {
        const r = tx.get(table, idValue(id));
        if (!r) fail("NOT_FOUND", "\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D");
        return r;
      }
      function publicLines(lines) {
        return lines.map((l) => ({ key: l.key, label: l.label, unit: l.unit, currency: l.currency || "LYD", count: l.count || null, basePrice: money(l.basePrice) }));
      }
      function publicOffer(o, withCost = false) {
        const out = { id: o.id, version: o.version, name: o.name, kind: o.kind, description: o.description, validUntil: o.validUntil, status: o.status, archived: !!o.archived, lines: publicLines(o.lines), updatedAt: o.updatedAt, pricingId: o.pricingId };
        if (withCost) out.lines = clone(o.lines);
        return out;
      }
      function validatePassword(password) {
        const value = String(password || "");
        if (!value.length || unescape(encodeURIComponent(value)).length > 72) fail("VALIDATION", "\u0623\u062F\u062E\u0644 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0635\u062D\u064A\u062D\u0629\u060C \u0628\u062D\u062F \u0623\u0642\u0635\u0649 72 \u0628\u0627\u064A\u062A.");
        return value;
      }
      function createApp({ store, crypto: crypto2, now = Date.now }) {
        const today = () => new Date(now()).toISOString().slice(0, 10);
        const digest = (x) => crypto2.digest(JSON.stringify(x));
        function authenticate(tx, token) {
          if (typeof token !== "string" || token.length < 32 || token.length > 512) fail("AUTH", "\u0633\u062C\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629");
          const s = tx.get("sessions", crypto2.digest(token));
          if (!s || s.expiresAt <= now()) fail("AUTH", "\u0627\u0646\u062A\u0647\u062A \u0627\u0644\u062C\u0644\u0633\u0629. \u0633\u062C\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0646 \u062C\u062F\u064A\u062F.");
          const u = tx.get("users", s.userId);
          if (!u || !u.active || u.authVersion !== s.authVersion) fail("AUTH", "\u0627\u0644\u062D\u0633\u0627\u0628 \u0623\u0648 \u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D");
          if (u.role === "company" && !tx.get("companies", u.companyId)?.active) fail("AUTH", "\u062D\u0633\u0627\u0628 \u0627\u0644\u0634\u0631\u0643\u0629 \u0645\u0648\u0642\u0648\u0641");
          return u;
        }
        function audit(tx, u, action, entityId) {
          tx.put("audit", { id: crypto2.id(), actorId: u.id, actorName: u.name, companyId: u.companyId || "", action, entityId: entityId || "", at: new Date(now()).toISOString() });
        }
        function login(p) {
          const username = text(p.username, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645", 80).toLowerCase();
          const password = String(p.password || "");
          if (password.length > 200) fail("AUTH", "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
          const window = Math.floor(now() / (15 * 60 * 1e3));
          const attemptId = crypto2.digest("login:" + username + ":" + window);
          const candidate = store.transaction((tx) => {
            const local = tx.get("attempts", attemptId) || { id: attemptId, count: 0, expiresAt: now() + 24 * 36e5 };
            const globalId = "global:" + Math.floor(now() / (5 * 60 * 1e3));
            const global = tx.get("attempts", globalId) || { id: globalId, count: 0, expiresAt: now() + 24 * 36e5 };
            if (local.count >= 5 || global.count >= 100) fail("RATE_LIMIT", "\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u062F\u062E\u0648\u0644 \u0643\u062B\u064A\u0631\u0629. \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u0627\u064B \u0623\u0648 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0633\u0624\u0648\u0644.");
            tx.put("attempts", { ...local, count: local.count + 1 });
            tx.put("attempts", { ...global, count: global.count + 1 });
            return tx.all("users").find((u) => u.username === username) || null;
          });
          const valid = crypto2.verify(password, candidate?.passwordHash || crypto2.dummyHash);
          if (!candidate || !valid) fail("AUTH", "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
          const token = crypto2.token();
          return store.transaction((tx) => {
            const u = tx.get("users", candidate.id);
            if (!u || !u.active || u.passwordHash !== candidate.passwordHash || u.role === "company" && !tx.get("companies", u.companyId)?.active) fail("AUTH", "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
            tx.put("attempts", { id: attemptId, count: 0, expiresAt: now() + 24 * 36e5 });
            tx.put("sessions", { id: crypto2.digest(token), userId: u.id, authVersion: u.authVersion, expiresAt: now() + 8 * 36e5 });
            return { token, user: safeUser(u) };
          });
        }
        function ownedAssignment(tx, u, id, allowExpired = false) {
          const a = tx.get("assignments", id);
          if (!a || a.companyId !== u.companyId || !a.active || tx.get("offers", a.offerId)?.archived) fail("NOT_FOUND", "\u0627\u0644\u0639\u0631\u0636 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0644\u0634\u0631\u0643\u062A\u0643");
          if (!allowExpired && a.validUntil && a.validUntil < today()) fail("EXPIRED", "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0639\u0631\u0636. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0644\u062A\u062D\u062F\u064A\u062B\u0647.");
          return a;
        }
        function ownedQuote(tx, u, id) {
          if (u.role !== "company") fail("FORBIDDEN", "\u0627\u0644\u062A\u0633\u0639\u064A\u0631\u0627\u062A \u0627\u0644\u062E\u0627\u0635\u0629 \u0645\u062A\u0627\u062D\u0629 \u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0634\u0631\u0643\u0629 \u0641\u0642\u0637");
          const q = tx.get("quotes", id);
          if (!q || q.companyId !== u.companyId) fail("NOT_FOUND", "\u0627\u0644\u062A\u0633\u0639\u064A\u0631\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629");
          return q;
        }
        function definitionValue(p) {
          const type = p.type;
          if (!["room", "city", "hotel", "service"].includes(type)) fail("VALIDATION", "\u0646\u0648\u0639 \u062A\u0639\u0631\u064A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
          const r = { type, name: text(p.name, "\u0627\u0644\u0627\u0633\u0645", 200, true), active: p.active !== false };
          if (type === "room") {
            r.occupancy = integer(p.occupancy, "\u0639\u062F\u062F \u0627\u0644\u0623\u0634\u062E\u0627\u0635", 1, 20);
            r.extraBeds = p.extraBeds === "" || p.extraBeds == null ? null : integer(p.extraBeds, "\u0627\u0644\u0623\u0633\u0631\u0651\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u064A\u0629", 0, 20);
          }
          if (type === "hotel") {
            r.cityId = text(p.cityId, "\u0627\u0644\u0645\u062F\u064A\u0646\u0629", 150);
            r.rate = number(p.rate, "\u0633\u0639\u0631 \u0627\u0644\u063A\u0631\u0641\u0629 \u0628\u0627\u0644\u0631\u064A\u0627\u0644");
          }
          if (type === "service") {
            r.cost = number(p.cost, "\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u062E\u062F\u0645\u0629");
            r.currency = currency(p.currency || "LYD");
            r.saleCurrency = currency(p.saleCurrency || "LYD");
            r.unit = p.unit === "roomNight" ? "roomNight" : "item";
          }
          return r;
        }
        function calculate(tx, p, previous) {
          if (!previous && p.sourcePricingId) {
            previous = requireRow(tx, "pricings", p.sourcePricingId);
            version(previous, p.sourcePricingVersion);
          }
          const defs = tx.all("definitions");
          const input = clone(p.input || {});
          if (JSON.stringify(input).length > 14e3) fail("VALIDATION", "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062A\u0633\u0639\u064A\u0631 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
          const selected = [...new Set(p.roomIds || [])];
          const baseDefs = previous && !p.refreshDefinitions ? [...previous.definitionsSnapshot || [], ...defs] : defs;
          const rooms = selected.map((id) => baseDefs.find((d) => d.id === id && d.type === "room" && d.active));
          if (rooms.some((r) => !r)) fail("VALIDATION", "\u0646\u0648\u0639 \u063A\u0631\u0641\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D");
          const services = [...new Map(baseDefs.filter((d) => d.type === "service").reverse().map((d) => [d.id, d])).values()];
          const kind = p.kind === "service" ? "service" : "program";
          const service = services.find((s) => s.id === p.serviceId);
          const result = kind === "program" ? calculateProgram(input, rooms, services) : calculateService(input, service);
          return { kind, input, roomIds: selected, serviceId: kind === "service" ? p.serviceId : "", definitionsSnapshot: kind === "service" ? [service] : [...rooms, ...services.filter((s) => (input.serviceIds || []).includes(s.id))], result };
        }
        function ownedCompanyPricing(tx, u, id) {
          const row = requireRow(tx, "companyPricings", id);
          if (row.companyId !== u.companyId) fail("FORBIDDEN", "\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0627 \u064A\u062E\u0635 \u0634\u0631\u0643\u062A\u0643");
          return row;
        }
        function calculateCompany(p) {
          const input = clone(p.input || {});
          if (JSON.stringify(input).length > 14e3) fail("VALIDATION", "\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062A\u0633\u0639\u064A\u0631 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
          const kind = p.kind === "service" ? "service" : "program";
          if (kind === "program") {
            const rooms = (Array.isArray(p.rooms) ? p.rooms : []).slice(0, 50).map((r) => ({ id: r.id || crypto2.id(), name: text(r.name, "\u0627\u0633\u0645 \u0627\u0644\u063A\u0631\u0641\u0629", 200, true), occupancy: integer(r.occupancy, "\u0639\u062F\u062F \u0627\u0644\u0623\u0634\u062E\u0627\u0635", 1, 20), extraBeds: r.extraBeds === "" || r.extraBeds == null ? void 0 : integer(r.extraBeds, "\u0627\u0644\u0623\u0633\u0631\u0651\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u064A\u0629", 0, 20) }));
            const result2 = calculateProgram(input, rooms, []);
            return { kind, input, rooms, result: result2 };
          }
          const service = { id: "service", name: text(p.service?.name, "\u0627\u0633\u0645 \u0627\u0644\u062E\u062F\u0645\u0629", 200, true), cost: number(p.service?.cost, "\u0627\u0644\u062A\u0643\u0644\u0641\u0629"), currency: currency(p.service?.currency || "LYD"), saleCurrency: currency(p.service?.saleCurrency || "LYD"), unit: text(p.service?.unit, "\u0627\u0644\u0648\u062D\u062F\u0629", 60) || "item", active: true };
          const result = calculateService(input, service);
          return { kind, input, service, result };
        }
        function publication(tx, u, p) {
          requirePermission(u, "publish");
          const offer = requireRow(tx, "offers", p.offerId);
          version(offer, p.offerVersion);
          if (offer.status !== "approved" || offer.archived) fail("VALIDATION", "\u064A\u062C\u0628 \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0639\u0631\u0636 \u0642\u0628\u0644 \u0646\u0634\u0631\u0647");
          if (offer.validUntil && offer.validUntil < today()) fail("EXPIRED", "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0646\u0634\u0631 \u0639\u0631\u0636 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629");
          const selections = p.companies || [];
          if (!selections.length || selections.length > 100 || new Set(selections.map((s) => s.companyId)).size !== selections.length) fail("VALIDATION", "\u0627\u062E\u062A\u0631 \u0634\u0631\u0643\u0627\u062A \u062F\u0648\u0646 \u062A\u0643\u0631\u0627\u0631 \u0648\u0628\u062D\u062F \u0623\u0642\u0635\u0649 100 \u0634\u0631\u0643\u0629");
          const assignments = selections.map((sel) => {
            const company = requireRow(tx, "companies", sel.companyId);
            if (!company.active) fail("VALIDATION", "\u0625\u062D\u062F\u0649 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u0645\u0648\u0642\u0648\u0641\u0629");
            const id = offer.id + ":" + company.id, old = tx.get("assignments", id);
            version(old, sel.version || 0);
            const defaultCommission = number(sel.commission, "\u0627\u0644\u0639\u0645\u0648\u0644\u0629");
            const lines = publicLines(offer.lines).map((l) => {
              const commission = money(number(sel.lineCommissions?.[l.key] ?? defaultCommission, "\u0639\u0645\u0648\u0644\u0629 \u0627\u0644\u0628\u0646\u062F"));
              if (commission > l.basePrice) fail("VALIDATION", "\u0627\u0644\u0639\u0645\u0648\u0644\u0629 \u062A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0623\u0633\u0627\u0633\u064A: " + company.name + " \u2014 " + l.label);
              return { ...l, commission, netPrice: money(l.basePrice - commission) };
            });
            return { id, oldVersion: old?.version || 0, companyId: company.id, companyName: company.name, companyVersion: company.version, offerId: offer.id, offerVersion: offer.version, name: offer.name, kind: offer.kind, description: offer.description, validUntil: offer.validUntil, lines, commission: defaultCommission, special: !!sel.special, active: sel.active !== false };
          });
          const currencyChanges = assignments.filter((a) => {
            const old = tx.get("assignments", a.id);
            return old && a.lines.some((l) => old.lines.find((x) => x.key === l.key)?.currency !== l.currency);
          }).map((a) => a.companyName);
          return { assignments, currencyChanges, previewHash: digest(assignments) };
        }
        function quotePreview(tx, u, p) {
          if (u.role !== "company") fail("FORBIDDEN", "\u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u062E\u0627\u0635\u0629 \u0628\u062D\u0633\u0627\u0628 \u0627\u0644\u0634\u0631\u0643\u0629");
          const old = p.id ? ownedQuote(tx, u, p.id) : null;
          version(old, p.version);
          const inputs = p.lines || [];
          if (!inputs.length || inputs.length > 60) fail("VALIDATION", "\u0623\u0636\u0641 \u0645\u0646 \u0628\u0646\u062F \u0648\u0627\u062D\u062F \u0625\u0644\u0649 60 \u0628\u0646\u062F\u0627\u064B");
          const seen = /* @__PURE__ */ new Set();
          const lines = inputs.map((input, index) => {
            const prior = old?.lines.find((l) => l.id === input.id);
            let source;
            if (prior && !p.refreshSources && prior.assignmentId === input.assignmentId && prior.key === input.key) source = prior.source;
            else {
              const a = ownedAssignment(tx, u, input.assignmentId);
              const line = a.lines.find((l) => l.key === input.key);
              if (!line) fail("NOT_FOUND", "\u0628\u0646\u062F \u0627\u0644\u0639\u0631\u0636 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D");
              source = { ...line, assignmentId: a.id, assignmentVersion: a.version, offerName: a.name, validUntil: a.validUntil };
              if (prior && prior.source.currency !== source.currency) fail("CURRENCY_CHANGED", "\u062A\u063A\u064A\u0631\u062A \u0639\u0645\u0644\u0629 \u0647\u0630\u0627 \u0627\u0644\u0628\u0646\u062F. \u0623\u0636\u0641\u0647 \u0645\u0646 \u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062C\u062F\u064A\u062F \u0648\u0631\u0627\u062C\u0639 \u062A\u0643\u0627\u0644\u064A\u0641\u0647 \u0648\u0631\u0628\u062D\u0647 \u0628\u062F\u0644\u0627\u064B \u0645\u0646 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0639\u0645\u0644\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B.");
            }
            const lineId = prior?.id || "line-" + index;
            if (seen.has(lineId)) fail("VALIDATION", "\u0628\u0646\u062F \u0645\u0643\u0631\u0631");
            seen.add(lineId);
            return { ...quoteLine(source, input), id: lineId, assignmentId: source.assignmentId, key: source.key, source: clone(source) };
          });
          const quote = { id: old?.id || "", version: old?.version || 0, companyId: u.companyId, name: text(p.name, "\u0627\u0633\u0645 \u0627\u0644\u062A\u0633\u0639\u064A\u0631\u0629", 200, true), customer: text(p.customer, "\u0627\u0644\u0639\u0645\u064A\u0644", 200), notes: text(p.notes, "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A", 5e3), validUntil: date(p.validUntil), lines, archived: old?.archived || false };
          quote.totals = totalsByCurrency(lines);
          const single = quote.totals.length === 1 ? quote.totals[0] : null;
          quote.currency = single?.currency || "MULTI";
          quote.total = single?.total ?? null;
          quote.cost = single?.cost ?? null;
          quote.profit = single?.profit ?? null;
          const previousTotals = old ? old.totals || [{ currency: old.currency || "LYD", total: old.total, cost: old.cost, profit: old.profit }] : [];
          return { quote, previousTotals, previousTotal: old?.total ?? null, previewHash: digest(quote) };
        }
        function bootstrap(tx, u) {
          const settings = tx.get("settings", "main") || {};
          if (u.mustChange) return { user: safeUser(u), settings: { name: settings.name }, mustChange: true };
          if (u.role === "company") {
            const company = tx.get("companies", u.companyId);
            const assignments = tx.all("assignments").filter((a) => a.companyId === u.companyId && a.active && !tx.get("offers", a.offerId)?.archived).map((a) => ({ ...a, expired: !!a.validUntil && a.validUntil < today() }));
            const quotes = tx.all("quotes").filter((q) => q.companyId === u.companyId).map((q) => ({ ...q, hasUpdate: q.lines.some((l) => {
              const a = tx.get("assignments", l.assignmentId);
              return !a || !a.active || a.version !== l.source.assignmentVersion || tx.get("offers", a.offerId)?.archived;
            }) }));
            const companyPricings = tx.all("companyPricings").filter((x) => x.companyId === u.companyId);
            return { user: safeUser(u), company: { id: company.id, name: company.name, contact: company.contact }, settings: { name: settings.name }, assignments, quotes, companyPricings };
          }
          const viewCost = permission(u, "viewCost");
          const result = { user: safeUser(u), settings: { id: settings.id, name: settings.name, version: settings.version }, offers: tx.all("offers").map((o) => publicOffer(o, viewCost)) };
          if (viewCost) {
            result.definitions = tx.all("definitions");
            result.pricings = tx.all("pricings");
            result.settings = settings;
          }
          if (permission(u, "manageCompanies") || permission(u, "publish") || permission(u, "manageUsers")) result.companies = tx.all("companies");
          if (permission(u, "publish")) result.assignments = tx.all("assignments");
          if (permission(u, "manageUsers")) result.users = tx.all("users").filter((x) => u.role === "admin" || x.role === "company").map(safeUser);
          if (u.role === "admin") result.audit = tx.all("audit").filter((x) => !x.companyId).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 150);
          return result;
        }
        function run(tx, u, action, p, preparedHash) {
          switch (action) {
            case "bootstrap":
              return bootstrap(tx, u);
            case "backup.create":
              if (u.role !== "admin") fail("FORBIDDEN", "\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u064A\u062E\u0635 \u0627\u0644\u0645\u0633\u0624\u0648\u0644");
              return { authorized: true };
            case "logout":
              tx.remove("sessions", crypto2.digest(p.token));
              return { ok: true };
            case "account.password": {
              const updated = tx.put("users", { ...u, passwordHash: preparedHash, mustChange: false, authVersion: u.authVersion + 1 });
              audit(tx, u, action, u.id);
              return { loggedOut: true, user: safeUser(updated) };
            }
            case "definition.save": {
              requirePermission(u, "editDefinitions");
              requirePermission(u, "viewCost");
              const old = p.id ? requireRow(tx, "definitions", p.id) : null;
              version(old, p.version);
              const val = definitionValue(p);
              if (old && old.type !== val.type) fail("VALIDATION", "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631 \u0646\u0648\u0639 \u0627\u0644\u062A\u0639\u0631\u064A\u0641");
              if (tx.all("definitions").some((d) => d.type === val.type && d.name === val.name && d.id !== old?.id)) fail("VALIDATION", "\u064A\u0648\u062C\u062F \u062A\u0639\u0631\u064A\u0641 \u0628\u0647\u0630\u0627 \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0646\u0648\u0639");
              if (val.type === "hotel" && val.cityId && tx.get("definitions", val.cityId)?.type !== "city") fail("VALIDATION", "\u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
              return tx.put("definitions", { ...val, id: old?.id || crypto2.id() });
            }
            case "definition.import": {
              requirePermission(u, "editDefinitions");
              requirePermission(u, "viewCost");
              if (!Array.isArray(p.rows) || !p.rows.length || p.rows.length > 200) fail("VALIDATION", "\u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0645\u0646 1 \u0625\u0644\u0649 200 \u0635\u0641");
              const rows = p.rows.map(definitionValue), seen = new Set(tx.all("definitions").map((d) => d.type + ":" + d.name));
              for (const r of rows) {
                const key = r.type + ":" + r.name;
                if (seen.has(key)) fail("VALIDATION", "\u0627\u0633\u0645 \u0645\u0643\u0631\u0631: " + r.name);
                seen.add(key);
                if (r.type === "hotel" && r.cityId && tx.get("definitions", r.cityId)?.type !== "city") fail("VALIDATION", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u062F\u064A\u0646\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
              }
              return { count: rows.map((r) => tx.put("definitions", { ...r, id: crypto2.id() })).length };
            }
            case "company.save": {
              requirePermission(u, "manageCompanies");
              const old = p.id ? requireRow(tx, "companies", p.id) : null;
              version(old, p.version);
              return tx.put("companies", { id: old?.id || crypto2.id(), name: text(p.name, "\u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0629", 200, true), contact: text(p.contact, "\u0627\u0644\u062A\u0648\u0627\u0635\u0644", 300), active: p.active !== false });
            }
            case "user.save": {
              requirePermission(u, "manageUsers");
              const old = p.id ? requireRow(tx, "users", p.id) : null;
              version(old, p.version);
              const role = p.role;
              if (!["admin", "employee", "company"].includes(role)) fail("VALIDATION", "\u0646\u0648\u0639 \u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
              if (u.role !== "admin" && (role !== "company" || old && old.role !== "company")) fail("FORBIDDEN", "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u062A\u062E\u0635 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0631\u0626\u064A\u0633\u064A");
              if (role === "admin" && old?.id !== u.id) fail("FORBIDDEN", "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0646\u0634\u0627\u0621 \u0645\u0633\u0624\u0648\u0644 \u0625\u0636\u0627\u0641\u064A \u0645\u0646 \u0647\u0630\u0647 \u0627\u0644\u0634\u0627\u0634\u0629");
              if (old?.role === "admin" && (role !== "admin" || p.active === false)) fail("VALIDATION", "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u0637\u064A\u0644 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0623\u0648 \u062A\u063A\u064A\u064A\u0631 \u0646\u0648\u0639\u0647");
              const username = text(p.username, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645", 80, true).toLowerCase();
              if (!/^[a-z0-9._-]{3,80}$/.test(username)) fail("VALIDATION", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: \u062D\u0631\u0648\u0641 \u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0648\u0623\u0631\u0642\u0627\u0645 \u0648\u0646\u0642\u0637\u0629 \u0648\u0634\u0631\u0637\u0629\u060C \u0645\u0646 3 \u0623\u062D\u0631\u0641");
              if (tx.all("users").some((x) => x.username === username && x.id !== old?.id)) fail("VALIDATION", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u062A\u062E\u062F\u0645");
              const companyId = role === "company" ? idValue(p.companyId) : "";
              if (companyId && !tx.get("companies", companyId)) fail("VALIDATION", "\u0627\u062E\u062A\u0631 \u0627\u0644\u0634\u0631\u0643\u0629");
              const permissions = role === "employee" ? [...new Set((p.permissions || []).filter((x) => PERMISSIONS.includes(x)))] : [];
              if ((permissions.includes("editPricing") || permissions.includes("editDefinitions")) && !permissions.includes("viewCost")) fail("VALIDATION", "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062A\u0639\u0631\u064A\u0641\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629 \u0623\u0648 \u0627\u0644\u062A\u0633\u0639\u064A\u0631 \u064A\u062A\u0637\u0644\u0628 \u0635\u0644\u0627\u062D\u064A\u0629 \u0631\u0624\u064A\u0629 \u0627\u0644\u062A\u0643\u0644\u0641\u0629");
              if (!old && !preparedHash) fail("VALIDATION", "\u0623\u062F\u062E\u0644 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0623\u0648\u0644\u064A\u0629");
              const saved = tx.put("users", { id: old?.id || crypto2.id(), username, name: text(p.name, "\u0627\u0644\u0627\u0633\u0645", 200, true), role, companyId, permissions, active: p.active !== false, passwordHash: preparedHash || old.passwordHash, mustChange: preparedHash ? true : old.mustChange, authVersion: (old?.authVersion || 0) + 1 });
              return safeUser(saved);
            }
            case "pricing.calculate": {
              requirePermission(u, "editPricing");
              requirePermission(u, "viewCost");
              return calculate(tx, p, p.id ? requireRow(tx, "pricings", p.id) : null);
            }
            case "pricing.save": {
              requirePermission(u, "editPricing");
              requirePermission(u, "viewCost");
              const old = p.id ? requireRow(tx, "pricings", p.id) : null;
              version(old, p.version);
              return tx.put("pricings", { id: old?.id || crypto2.id(), name: text(p.name, "\u0627\u0633\u0645 \u0627\u0644\u062A\u0633\u0639\u064A\u0631", 200, true), notes: text(p.notes, "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A", 5e3), isTemplate: !!p.isTemplate, ...calculate(tx, p, old) });
            }
            case "offer.save": {
              requirePermission(u, "editPricing");
              requirePermission(u, "viewCost");
              const old = p.id ? requireRow(tx, "offers", p.id) : null;
              version(old, p.version);
              const pricing = requireRow(tx, "pricings", p.pricingId);
              version(pricing, p.pricingVersion);
              return tx.put("offers", { id: old?.id || crypto2.id(), name: text(p.name, "\u0627\u0633\u0645 \u0627\u0644\u0639\u0631\u0636", 200, true), description: text(p.description, "\u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644", 6e3), validUntil: date(p.validUntil), kind: pricing.kind, pricingId: pricing.id, pricingVersion: pricing.version, lines: clone(pricing.result.results), status: "draft", archived: false });
            }
            case "offer.approve": {
              requirePermission(u, "approve");
              const o = requireRow(tx, "offers", p.id);
              version(o, p.version);
              if (o.archived) fail("VALIDATION", "\u0627\u0644\u0639\u0631\u0636 \u0645\u0624\u0631\u0634\u0641");
              return publicOffer(tx.put("offers", { ...o, status: "approved", approvedBy: u.id }), permission(u, "viewCost"));
            }
            case "offer.archive": {
              requirePermission(u, "publish");
              const o = requireRow(tx, "offers", p.id);
              version(o, p.version);
              return publicOffer(tx.put("offers", { ...o, archived: p.archived !== false }), permission(u, "viewCost"));
            }
            case "assignment.toggle": {
              requirePermission(u, "publish");
              const row = requireRow(tx, "assignments", p.id);
              version(row, p.version);
              return tx.put("assignments", { ...row, active: p.active !== false });
            }
            case "publish.preview":
              return publication(tx, u, p);
            case "publish.commit": {
              const result = publication(tx, u, p);
              if (result.previewHash !== p.previewHash) fail("CONFLICT", "\u062A\u063A\u064A\u0631\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0634\u0631. \u0623\u0639\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0642\u0628\u0644 \u0627\u0644\u062D\u0641\u0638.");
              return { assignments: result.assignments.map((a) => {
                const { oldVersion, companyVersion, ...record } = a;
                const old = tx.get("assignments", record.id);
                const saved = old && Object.keys(record).every((k) => JSON.stringify(record[k]) === JSON.stringify(old[k])) ? old : tx.put("assignments", record);
                return { id: saved.id, version: saved.version, companyId: saved.companyId };
              }) };
            }
            case "quote.preview":
              return quotePreview(tx, u, p);
            case "quote.save": {
              const result = quotePreview(tx, u, p);
              if (result.previewHash !== p.previewHash) fail("CONFLICT", "\u062A\u063A\u064A\u0631\u062A \u0627\u0644\u062A\u0633\u0639\u064A\u0631\u0629. \u0623\u0639\u062F \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u0642\u0628\u0644 \u0627\u0644\u062D\u0641\u0638.");
              return tx.put("quotes", { ...result.quote, id: result.quote.id || crypto2.id() });
            }
            case "quote.archive": {
              const q = ownedQuote(tx, u, p.id);
              version(q, p.version);
              return tx.put("quotes", { ...q, archived: p.archived !== false });
            }
            case "export.offer": {
              if (u.role === "company") return { kind: "offer", company: tx.get("companies", u.companyId).name, ...ownedAssignment(tx, u, p.id, true) };
              requirePermission(u, "export");
              return { kind: "offer", ...publicOffer(requireRow(tx, "offers", p.id)) };
            }
            case "export.quote": {
              const q = ownedQuote(tx, u, p.id);
              return { id: q.id, name: q.name, customer: q.customer, notes: q.notes, validUntil: q.validUntil, company: tx.get("companies", u.companyId).name, currency: q.currency, total: q.total, totals: (q.totals || [{ currency: q.currency || "LYD", total: q.total }]).map((t) => ({ currency: t.currency, total: t.total })), kind: "quote", lines: q.lines.map((l) => ({ label: l.label, offerName: l.source.offerName, unit: l.unit, currency: l.currency || "LYD", quantity: l.quantity, nights: l.nights, units: l.units, sellUnit: l.sellUnit, total: l.total })) };
            }
            case "company.pricing.calculate": {
              if (u.role !== "company") fail("FORBIDDEN", "\u0623\u062F\u0627\u0629 \u0627\u0644\u062A\u0633\u0639\u064A\u0631 \u0627\u0644\u062E\u0627\u0635\u0629 \u062A\u062E\u0635 \u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0634\u0631\u0643\u0627\u062A");
              return calculateCompany(p);
            }
            case "company.pricing.save": {
              if (u.role !== "company") fail("FORBIDDEN", "\u0623\u062F\u0627\u0629 \u0627\u0644\u062A\u0633\u0639\u064A\u0631 \u0627\u0644\u062E\u0627\u0635\u0629 \u062A\u062E\u0635 \u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0634\u0631\u0643\u0627\u062A");
              const old = p.id ? ownedCompanyPricing(tx, u, p.id) : null;
              version(old, p.version);
              return tx.put("companyPricings", { id: old?.id || crypto2.id(), companyId: u.companyId, name: text(p.name, "\u0627\u0633\u0645 \u0627\u0644\u062A\u0633\u0639\u064A\u0631", 200, true), notes: text(p.notes, "\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A", 5e3), archived: old?.archived || false, ...calculateCompany(p) });
            }
            case "company.pricing.archive": {
              if (u.role !== "company") fail("FORBIDDEN", "\u0623\u062F\u0627\u0629 \u0627\u0644\u062A\u0633\u0639\u064A\u0631 \u0627\u0644\u062E\u0627\u0635\u0629 \u062A\u062E\u0635 \u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0634\u0631\u0643\u0627\u062A");
              const row = ownedCompanyPricing(tx, u, p.id);
              version(row, p.version);
              return tx.put("companyPricings", { ...row, archived: p.archived !== false });
            }
            case "settings.save": {
              if (u.role !== "admin") fail("FORBIDDEN", "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u062A\u062E\u0635 \u0627\u0644\u0645\u0633\u0624\u0648\u0644");
              const old = tx.get("settings", "main");
              version(old, p.version);
              return tx.put("settings", { ...old, name: text(p.name, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u0634\u0623\u0629", 200, true), sarPerUsd: number(p.sarPerUsd, "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0628\u0627\u0644\u0631\u064A\u0627\u0644", 1e-4), usdToLyd: number(p.usdToLyd, "\u0627\u0644\u062F\u0648\u0644\u0627\u0631 \u0628\u0627\u0644\u062F\u064A\u0646\u0627\u0631", 1e-4) });
            }
            default:
              fail("NOT_FOUND", "\u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629");
          }
        }
        function handle(request) {
          try {
            if (!request || JSON.stringify(request).length > 3e5) fail("VALIDATION", "\u0627\u0644\u0637\u0644\u0628 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
            const action = String(request.action || ""), p = request.payload || {};
            if (action === "login") return { ok: true, data: login(p) };
            let preparedHash;
            if (action === "account.password" || action === "user.save" && p.password) {
              const u = store.transaction((tx) => authenticate(tx, request.token));
              if (action === "user.save") {
                requirePermission(u, "manageUsers");
                if (u.mustChange) fail("AUTH", "\u063A\u064A\u0651\u0631 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631\u0643 \u0623\u0648\u0644\u0627\u064B");
              } else if (!crypto2.verify(String(p.oldPassword || ""), u.passwordHash)) fail("VALIDATION", "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
              preparedHash = crypto2.hash(validatePassword(p.password));
            }
            const needsWrite = action === "logout" || MUTATIONS.has(action);
            const data = (needsWrite ? store.transaction : store.read).call(store, (tx) => {
              const u = authenticate(tx, request.token);
              if (u.mustChange && !["bootstrap", "account.password", "logout"].includes(action)) fail("PASSWORD_CHANGE", "\u063A\u064A\u0651\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0623\u0648\u0644\u064A\u0629 \u0644\u0644\u0645\u062A\u0627\u0628\u0639\u0629");
              if (action === "logout") return run(tx, u, action, { token: request.token });
              if (!MUTATIONS.has(action)) return run(tx, u, action, p);
              const requestId = text(request.requestId, "\u0645\u0639\u0631\u0641 \u0627\u0644\u0639\u0645\u0644\u064A\u0629", 100, true);
              if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestId)) fail("VALIDATION", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
              const key = u.id + ":" + u.authVersion + ":" + requestId, hash = digest({ action, p }), prior = tx.get("requests", key);
              if (prior) {
                if (prior.hash !== hash) fail("CONFLICT", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0637\u0644\u0628 \u0645\u062E\u062A\u0644\u0641");
                return prior.result;
              }
              const result = run(tx, u, action, p, preparedHash);
              tx.put("requests", { id: key, hash, result, expiresAt: now() + 72 * 36e5 });
              if (action !== "account.password") audit(tx, u, action, result?.id || p.id || p.offerId || "");
              return result;
            });
            return { ok: true, data };
          } catch (e) {
            if (e instanceof AppError) return { ok: false, error: { code: e.code, message: e.message } };
            if (e.message === "RECORD_SIZE") return { ok: false, error: { code: "VALIDATION", message: "\u0627\u0644\u0633\u062C\u0644 \u0643\u0628\u064A\u0631 \u062C\u062F\u0627\u064B. \u0642\u0644\u0644 \u0639\u062F\u062F \u0627\u0644\u0628\u0646\u0648\u062F \u0623\u0648 \u0637\u0648\u0644 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A." } };
            return { ok: false, error: { code: "SERVER", message: "\u062A\u0639\u0630\u0631 \u0625\u062A\u0645\u0627\u0645 \u0627\u0644\u0639\u0645\u0644\u064A\u0629. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0628\u0646\u0641\u0633 \u0627\u0644\u0637\u0644\u0628\u061B \u0648\u0625\u0630\u0627 \u0627\u0633\u062A\u0645\u0631 \u0627\u0644\u062E\u0637\u0623 \u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0633\u0624\u0648\u0644." } };
          }
        }
        function initialize(username, password, name = "\u0631\u062D\u0644\u0629 | \u062A\u0633\u0639\u064A\u0631 \u0627\u0644\u0628\u0631\u0627\u0645\u062C") {
          const passwordHash = crypto2.hash(validatePassword(password));
          return store.transaction((tx) => {
            if (tx.all("users").length) fail("VALIDATION", "\u062A\u0645 \u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0645\u0646\u0638\u0648\u0645\u0629 \u0645\u0633\u0628\u0642\u0627\u064B");
            if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) fail("VALIDATION", "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
            tx.put("settings", { id: "main", name, sarPerUsd: 3.72, usdToLyd: 4.85, schemaVersion: 1 });
            for (const [key, label, count] of [["single", "\u0641\u0631\u062F\u064A\u0629", 1], ["double", "\u0632\u0648\u062C\u064A\u0629", 2], ["triple", "\u062B\u0644\u0627\u062B\u064A\u0629", 3], ["quad", "\u0631\u0628\u0627\u0639\u064A\u0629", 4], ["quint", "\u062E\u0645\u0627\u0633\u064A\u0629", 5]]) tx.put("definitions", { id: key, type: "room", name: label, occupancy: count, extraBeds: null, active: true });
            const u = tx.put("users", { id: crypto2.id(), username: username.toLowerCase(), name: "\u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0631\u0626\u064A\u0633\u064A", role: "admin", companyId: "", permissions: [], active: true, passwordHash, mustChange: false, authVersion: 1 });
            return safeUser(u);
          });
        }
        function cleanup() {
          return store.transaction((tx) => {
            let count = 0;
            for (const table of ["attempts", "sessions", "requests"]) for (const r of tx.all(table)) if (r.expiresAt < now()) {
              tx.remove(table, r.id);
              count++;
            }
            return count;
          });
        }
        return { handle, initialize, cleanup };
      }
      module.exports = { createApp, PERMISSIONS, validatePassword };
    }
  });

  // src/server-entry.cjs
  var require_server_entry = __commonJS({
    "src/server-entry.cjs"(exports, module) {
      init_gas_timers();
      var bcrypt = require_umd();
      var { createApp } = require_app();
      var { UnitOfWork, TABLES } = require_store();
      function configureCrypto(randomBytes, digest, id) {
        bcrypt.setRandomFallback(randomBytes);
        return {
          id,
          token: () => id().replace(/-/g, "") + id().replace(/-/g, ""),
          digest,
          hash: (password) => bcrypt.hashSync(password, 12),
          verify: (password, hash) => bcrypt.compareSync(password, hash),
          dummyHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxL5/C.qPa.lHFPCMj71Ri.uB2C"
        };
      }
      function validateSnapshot(data) {
        for (const t of TABLES) if (!data[t] || typeof data[t] !== "object" || Array.isArray(data[t])) throw Error("\u062C\u062F\u0648\u0644 \u0645\u0641\u0642\u0648\u062F: " + t);
        if (data.settings.main?.schemaVersion !== 1) throw Error("\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0646\u0633\u062E\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645");
        if (!Object.values(data.users).some((u) => u.role === "admin" && u.active)) throw Error("\u0627\u0644\u0646\u0633\u062E\u0629 \u0644\u0627 \u062A\u062D\u062A\u0648\u064A \u0645\u0633\u0624\u0648\u0644\u0627\u064B \u0641\u0639\u0627\u0644\u0627\u064B");
        for (const t of TABLES) for (const [id, r] of Object.entries(data[t])) if (r.id !== id || !Number.isInteger(r.version) || r.version < 1) throw Error("\u0633\u062C\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0641\u064A " + t);
        for (const u of Object.values(data.users)) if (u.role === "company" && !data.companies[u.companyId]) throw Error("\u0634\u0631\u0643\u0629 \u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
        for (const a of Object.values(data.assignments)) if (!data.companies[a.companyId] || !data.offers[a.offerId]) throw Error("\u0631\u0628\u0637 \u0627\u0644\u0639\u0631\u0636 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        for (const q of Object.values(data.quotes)) if (!data.companies[q.companyId] || !Array.isArray(q.lines) || q.lines.some((l) => !l.source || !Number.isFinite(l.total))) throw Error("\u062A\u0633\u0639\u064A\u0631\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
        return true;
      }
      module.exports = { createApp, UnitOfWork, TABLES, configureCrypto, validateSnapshot };
    }
  });
  return require_server_entry();
})();
