/* 查询和话术保持确定性，不让模型生成资源信息。 */
globalThis.GameReply = {
  defaults: {
    enabled: false, autoSend: false, token: '',
    rules: [{keyword: '怎么买', reply: '查询游戏请发送：查游戏 游戏名称'}],
    selectors: {conversation: '', conversationAttribute: 'data-conversation-id', incoming: '', text: '', input: '', send: '', idAttribute: 'data-message-id'}
  },
  parse(text, rules) {
    const message = text.trim();
    const query = /^查游戏(?:\s+|[：:])(.+)$/u.exec(message);
    if (query) return {name: query[1].trim()};
    if (message === '查游戏') return {reply: '请发送：查游戏 游戏名称'};
    const rule = rules.find(item => message === item.keyword.trim());
    return rule ? {reply: rule.reply} : null;
  },
  format(result) {
    if (result.status === 'found') return `资源库已收录《${result.names[0]}》，具体可用情况请等待卖家确认。`;
    if (result.status === 'multiple') return '查询到多个游戏或版本，请补充完整名称：\n' + result.names.join('\n');
    return '暂未查到，请尝试完整中文名或英文名。';
  }
};
