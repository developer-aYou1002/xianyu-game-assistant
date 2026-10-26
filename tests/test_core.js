// 验证查询格式、精确话术与结果分支，不需要浏览器或真实买家消息。
const assert = require('node:assert/strict');
require('../extension/core.js');
const rules = GameReply.defaults.rules;
assert.deepEqual(GameReply.parse('查游戏 Portal', rules), {name: 'Portal'});
assert.deepEqual(GameReply.parse('查游戏：游戏甲', rules), {name: '游戏甲'});
assert.equal(GameReply.parse('随便聊天', rules), null);
assert.equal(GameReply.parse('怎么买呀', rules), null);
assert.ok(GameReply.parse('怎么买', rules).reply);
assert.match(GameReply.format({status: 'multiple', names: ['甲', '乙']}), /完整名称/);
assert.match(GameReply.format({status: 'missing', names: []}), /暂未查到/);
console.log('话术与查询格式验证通过');
