/**
 * Created by yulonh on 2018/6/8.
 */
const HTTP_REQUEST_BASE = 'https://api.fcoin.com/v2/';
const request = require('request-promise');
const crypto = require('crypto');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// const ERRORS = {
//     400: 'Bad Request -- 错误的请求',
//     401: 'Unauthorized -- API key 或者签名，时间戳有误',
//     403: 'Forbidden -- 禁止访问',
//     404: 'Not Found -- 未找到请求的资源',
//     405: 'Method Not Allowed -- 使用的 HTTP 方法不适用于请求的资源',
//     406: 'Not Acceptable -- 请求的内容格式不是 JSON',
//     429: 'Too Many Requests -- 请求受限，请降低请求频率',
//     500: 'Internal Server Error -- 服务内部错误，请稍后再进行尝试',
//     503: 'Service Unavailable -- 服务不可用，请稍后再进行尝试'
// };

const PRIVATE_METHOD = {
    account: {
        path: 'accounts/balance',
        method: 'GET'
    },
    trade: {
        path: 'orders',
        method: 'POST'
    },
    orders: {
        path: 'orders',
        method: 'GET'
    },
    order: {
        path: 'orders/{order_id}',
        method: 'GET'
    },
    cancel: {
        path: 'orders/{order_id}/submit-cancel',
        method: 'POST'
    }
};

class FCoin {
    constructor(key = '', secret = '') {
        this.apiKey = key;
        this.apiSecret = secret;
        this.relateTime = 0;
    }

    /**
     *
     * @returns {Promise.<void>}
     */
    async syncServertime() {
        const servertime = await request('https://api.fcoin.com/v2/public/server-time');
        this.relateTime = servertime - Date.now();
    }

    /**
     *
     * @param method
     * @param params
     * @returns {Promise.<void>}
     */
    async privateRequest(method, params = {}) {
        const action = PRIVATE_METHOD[method];
        const keys = Object.keys(params).sort();
        let path = action.path;
        const paramsStr = keys.map(key => {
            path = path.replace(`{${key}`, params[key]);
            return `${key}=${params[key]}`;
        }).join('&');
        const uri = action.method === 'GET' ? `${HTTP_REQUEST_BASE}${path}${paramsStr ? '?' : ''}${paramsStr}` : `${HTTP_REQUEST_BASE}${action.path}`;
        const timestamp = Date.now() + this.relateTime;
        // 签名字符串 HTTP_METHOD + HTTP_REQUEST_URI + TIMESTAMP + POST_BODY
        let signStr = action.method === 'GET' ? `${action.method}${uri}${timestamp}` : `${action.method}${uri}${timestamp}${paramsStr}`;
        signStr = Buffer.from(signStr).toString('base64');
        signStr = crypto.createHmac('sha1', this.apiSecret).update(signStr).digest().toString('base64');

        const headers = {
            'FC-ACCESS-KEY': this.apiKey,
            'FC-ACCESS-SIGNATURE': signStr,
            'FC-ACCESS-TIMESTAMP': timestamp
        };

        let requestConfig = {
            method: action.method,
            uri,
            headers,
            json: true
        };

        if (action.method === 'POST') {
            requestConfig.body = params;
        }
        try {
            const res = await request(requestConfig).catch(async ({error}) => {
                console.error(`${new Date().toLocaleString()} ERROR:${JSON.stringify(error)} in method '${method}' with params: ${JSON.stringify(params)}`);
                if (error.status === 429) {
                    console.log('will sleep 2000ms');
                    await sleep(2000);
                }
            });
            if (res) {
                if (res.status === 0) {
                    return res.data;
                } else {
                    console.error(`ERROR:${JSON.stringify(res)} in method '${method}' with params: ${JSON.stringify(params)}`);
                    if (res.status === 429) {
                        console.log('will sleep 2000ms');
                        await sleep(2000);
                    }
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    /**
     *
     * @param price
     * @param amount
     * @param symbol
     * @returns {Promise}
     */
    buy(price, amount, symbol = 'btcusdt') {
        return this.privateRequest('trade', {type: 'limit', side: 'buy', amount, price, symbol});
    }

    /**
     *
     * @param price
     * @param amount
     * @param symbol
     * @returns {Promise}
     */
    sell(price, amount, symbol = 'btcusdt') {
        return this.privateRequest('trade', {type: 'limit', side: 'sell', amount, price, symbol});
    }

    /**
     *
     * @returns {Promise}
     */
    account() {
        return this.privateRequest('account');
    }

    /**
     *
     * @param states
     * @param symbol
     * @returns {Promise}
     */
    orders(params) {
        return this.privateRequest('orders', Object.assign({
            states: ['submitted'],
            symbol: 'btcusdt',
            limit: 100
        }, params));
    }

    /**
     *
     * @param order_id
     * @returns {Promise}
     */
    order(order_id) {
        return this.privateRequest('order', {order_id});
    }

    /**
     *
     * @param order_id
     * @returns {Promise}
     */
    cancel(order_id) {
        return this.privateRequest('cancel', {order_id});
    }

    /**
     *
     * @param symbol
     * @returns {Promise.<TResult>}
     */
    ticker(symbol = 'btcusdt') {
        return request({
            uri: `https://api.fcoin.com/v2/market/ticker/${symbol}`,
            json: true
        }).then(({data}) => {
            if (data && data.ticker) {
                const [last, lastAmount, buy, buyAmount, sell, sellAmount, last23h, high, low, baseAmount, currencyAmount] = data.ticker;
                return {
                    last,
                    lastAmount,
                    buy,
                    buyAmount,
                    sell,
                    sellAmount,
                    last23h,
                    high,
                    low,
                    baseAmount,
                    currencyAmount
                };
            }
        }).catch(e => console.error(e.message));
    }

    /**
     *
     * @param symbol
     * @param level
     * @returns {Promise.<TResult>}
     */
    depth(symbol = 'btcusdt', level = 20) {
        return request({
            uri: `https://api.fcoin.com/v2/market/depth/L${level}/${symbol}`,
            json: true
        }).then(({data}) => {
            if (data && data.bids && data.asks) {
                return data;
            }
        }).catch(e => console.error(e.message));
    }

    /**
     *
     * @param symbol
     * @param resolution M1 1分钟 M3 3分钟 M5 5分钟 M15 15分钟 M30 30分钟 H1 1小时 H4 4小时 H6 6小时 D1 1日 W1 1周 MN 1月
     * @returns {*}
     */
    candle(symbol = 'btcusdt', resolution = 'M1') {
        return request({
            uri: `https://api.fcoin.com/v2/market/candles/${resolution}/${symbol}`,
            json: true
        }).then(res => res.data).catch(e => console.error(e.message));
    }

    /**
     *
     * @returns {Promise.<TResult>}
     */
    symbols() {
        return request({
            uri: 'https://api.fcoin.com/v2/public/symbols',
            json: true
        }).then(res => res.data).catch(e => console.error(e.message));
    }
}

module.exports = FCoin;