const byId = id => document.getElementById(id);
chrome.storage.local.get('config').then(({config}) => {
  const value = {...GameReply.defaults, ...config};
  for (const key of ['enabled', 'autoSend']) byId(key).checked = value[key];
  byId('token').value = value.token;
  for (const key of ['rules', 'selectors']) byId(key).value = JSON.stringify(value[key], null, 2);
});

byId('save').onclick = async () => {
  try {
    const rules = JSON.parse(byId('rules').value);
    const selectors = JSON.parse(byId('selectors').value);
    if (!Array.isArray(rules) || rules.some(rule => !rule.keyword?.trim() || !rule.reply?.trim())) {
      throw new Error('每条规则必须包含非空 keyword 和 reply');
    }
    for (const key of Object.keys(GameReply.defaults.selectors)) {
      if (typeof selectors[key] !== 'string') throw new Error('页面适配字段不完整');
      if (!key.endsWith('Attribute') && selectors[key]) document.querySelector(selectors[key]);
    }
    if (byId('enabled').checked && ['conversation', 'conversationAttribute', 'incoming', 'input', 'send', 'idAttribute'].some(key => !selectors[key])) {
      throw new Error('启用前必须填写完整页面适配');
    }
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
  const result = await chrome.runtime.sendMessage({type: 'lookup', name: byId('name').value});
  byId('testResult').textContent = result.error || GameReply.format(result);
};
