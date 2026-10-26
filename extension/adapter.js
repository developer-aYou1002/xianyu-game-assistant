/* 页面结构由配置适配，标识和时间缺失时不猜测客户身份或消息新旧。 */
globalThis.ChatAdapter = {
  identity(selectors) {
    const element = document.querySelector(selectors.conversation);
    const identity = {
      conversation: element?.getAttribute(selectors.conversationAttribute),
      seller: element?.getAttribute(selectors.sellerAttribute),
      buyer: element?.getAttribute(selectors.buyerAttribute)
    };
    if (Object.values(identity).some(value => !value)) throw new Error('请适配稳定的会话、卖家和买家 ID');
    return identity;
  },
  timestamp(value) {
    if (!value) return NaN;
    if (/^\d{10}(?:\d{3})?$/u.test(value)) return Number(value) * (value.length === 10 ? 1000 : 1);
    // 只接受含日期及时区的完整时间，不能把“刚刚”等相对文本视为新消息。
    return /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ? Date.parse(value) : NaN;
  },
  messages(selectors) {
    return [...document.querySelectorAll(selectors.incoming)].map(element => ({
      id: element.getAttribute(selectors.idAttribute),
      time: this.timestamp(element.getAttribute(selectors.timeAttribute)),
      text: (selectors.text ? element.querySelector(selectors.text) : element)?.textContent || ''
    }));
  },
  input(selectors) {
    const input = document.querySelector(selectors.input);
    if (!(input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement)) {
      throw new Error('请适配 input/textarea；富文本编辑器尚待联调');
    }
    if (input.value.trim()) throw new Error('输入框有人工草稿，未发送，请人工处理');
    if (input.disabled || input.readOnly) throw new Error('输入框不可编辑');
    return input;
  },
  fill(input, reply) {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, reply);
    input.dispatchEvent(new Event('input', {bubbles: true}));
  }
};
