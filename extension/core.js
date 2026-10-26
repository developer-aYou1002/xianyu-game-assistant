/* 查询和话术保持确定性，不让模型生成资源信息。 */
const welcomeMessage = [
  '您好，欢迎咨询！',
  '请先查询您需要的游戏，发送：',
  '查游戏 游戏名称',
  '例如：查游戏 黑神话：悟空',
  '每次查询一款，建议填写完整中文名或英文名。',
  '查询到资源后，请等待卖家确认版本及可用情况，再下单付款；付款后由卖家提供资源链接。'
].join('\n');

globalThis.GameReply = {
  welcomeMessage,
  defaults: {
    enabled: false, autoSend: false, token: '',
    rules: [],
    selectors: {
      conversation: '', conversationAttribute: 'data-conversation-id',
      sellerAttribute: 'data-seller-id', buyerAttribute: 'data-buyer-id',
      incoming: '', text: '', input: '', send: '',
      idAttribute: 'data-message-id', timeAttribute: 'data-timestamp'
    }
  },
  normalize(value = {}) {
    // 旧版本内置的简短提示升级为统一引导，其他用户自定义规则保留。
    const rules = (value.rules || []).filter(rule => !['怎么买', '怎么查'].includes(rule.keyword.trim()));
    return {...this.defaults, ...value, rules, selectors: {...this.defaults.selectors, ...value.selectors}};
  },
  parse(text, rules) {
    const message = text.trim();
    const query = /^查游戏(?:\s+|[：:])([\s\S]*)$/u.exec(message);
    if (query) {
      const name = query[1].trim();
      if (!name || [...name].length > 100 || /[\r\n]/u.test(name)) {
        return {reply: '请发送：查游戏 游戏名称；每次一款，名称不超过100个字符。'};
      }
      return {name};
    }
    if (message === '查游戏') return {reply: '请发送：查游戏 游戏名称'};
    if (['怎么买', '怎么查'].includes(message)) return {reply: welcomeMessage, guidance: true};
    const rule = rules.find(item => message === item.keyword.trim());
    return rule ? {reply: rule.reply} : null;
  },
  format(result) {
    if (result.status === 'found') return `资源库已收录《${result.names[0]}》，具体可用情况请等待卖家确认。`;
    if (result.status === 'multiple') return '查询到多个游戏或版本，请重新发送“查游戏 完整名称”：\n' + result.names.join('\n') + (result.more ? '\n还有其他结果，请补充更完整的名称。' : '');
    return '暂未查到，请尝试完整中文名或英文名。';
  }
};
