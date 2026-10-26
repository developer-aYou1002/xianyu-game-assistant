const byId = id => document.getElementById(id);

function readRules() {
  const rules = JSON.parse(byId('rules').value);
  if (!Array.isArray(rules) || rules.some(rule => !validRule(rule))) {
    throw new Error('每条规则必须包含非空 keyword 和 reply');
  }
  if (rules.some(rule => ['怎么买', '怎么查'].includes(rule.keyword.trim()))) {
    throw new Error('怎么买、怎么查使用内置完整引导，请勿重复配置');
  }
  return rules;
}

function validRule(rule) {
  return rule && typeof rule.keyword === 'string' && typeof rule.reply === 'string'
    && rule.keyword.trim() && rule.reply.trim();
}

function readSelectors() {
  const selectors = JSON.parse(byId('selectors').value);
  if (!selectors || Array.isArray(selectors)) throw new Error('页面适配必须是 JSON 对象');
  for (const key of Object.keys(GameReply.defaults.selectors)) {
    if (typeof selectors[key] !== 'string') throw new Error('页面适配字段不完整');
    if (!key.endsWith('Attribute') && selectors[key]) document.querySelector(selectors[key]);
  }
  const required = Object.keys(GameReply.defaults.selectors).filter(key => key !== 'text');
  if (byId('enabled').checked && required.some(key => !selectors[key].trim())) {
    throw new Error('启用前必须填写完整页面适配');
  }
  return selectors;
}

chrome.storage.local.get('config').then(({config}) => {
  const value = GameReply.normalize(config);
  for (const key of ['enabled', 'autoSend']) byId(key).checked = value[key];
  byId('token').value = value.token;
  for (const key of ['rules', 'selectors']) byId(key).value = JSON.stringify(value[key], null, 2);
});

byId('save').onclick = async () => {
  try {
    const rules = readRules();
    const selectors = readSelectors();
    await chrome.storage.local.set({config: {
      token: byId('token').value.trim(), enabled: byId('enabled').checked,
      autoSend: byId('autoSend').checked, rules, selectors
    }});
    byId('result').textContent = '已保存';
  } catch (error) {
    byId('result').textContent = error.message;
  }
};

byId('test').onclick = async () => {
  try {
    const result = await chrome.runtime.sendMessage({type: 'lookup', name: byId('name').value});
    byId('testResult').textContent = result.error || GameReply.format(result);
  } catch {
    byId('testResult').textContent = '无法连接扩展后台，请重新加载插件';
  }
};

byId('welcome').textContent = GameReply.welcomeMessage;
byId('records').onclick = async () => {
  const values = await chrome.storage.local.get(null);
  const records = Object.entries(values).filter(([key]) => key.startsWith('reception:'));
  byId('recordResult').textContent = records.length ? records.map(([key, record]) => {
    const states = {none: '无发送记录', pending: '处理中或已中断，需人工确认', not_sent: '未发送', attempted: '已尝试发送，需人工确认'};
    return `${key}\n接待来源：${record.reason === 'history' ? '历史会话' : '新消息'}\n最近回复：${states[record.delivery] || record.delivery}\n引导：${states[record.guidanceDelivery || 'none']}\n更新时间：${new Date(record.updatedAt).toLocaleString('zh-CN')}`;
  }).join('\n\n') : '暂无接待记录';
};
