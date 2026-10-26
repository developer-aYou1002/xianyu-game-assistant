let config = GameReply.defaults;
let busy = false;
let currentConversation = '';
const seen = new Set();

function report(text) {
  chrome.storage.local.set({status: {text, time: new Date().toLocaleString('zh-CN')}});
}

function conversationId() {
  const element = document.querySelector(config.selectors.conversation);
  return element?.getAttribute(config.selectors.conversationAttribute) || '';
}

function messages() {
  return [...document.querySelectorAll(config.selectors.incoming)].map(element => ({
    id: element.getAttribute(config.selectors.idAttribute),
    text: (config.selectors.text ? element.querySelector(config.selectors.text) : element)?.textContent || ''
  }));
}

function remember(id) {
  seen.add(id);
  if (seen.size > 5000) seen.delete(seen.values().next().value);
}

async function processMessage(message, conversation) {
  const action = GameReply.parse(message.text, config.rules);
  if (!action) return;
  let reply = action.reply;
  if (action.name) {
    const result = await chrome.runtime.sendMessage({type: 'lookup', name: action.name});
    if (result.error) {
      report(result.error + '；本条未发送，请人工处理');
      return;
    }
    reply = GameReply.format(result);
  }
  if (!config.autoSend) {
    report('预览回复：' + reply);
    return;
  }
  // 查询期间可能切换聊天或关闭开关，发送前必须重新核对会话和开关。
  if (!config.enabled || !config.autoSend || conversationId() !== conversation) return;
  sendReply(reply);
}

function sendReply(reply) {
  const input = document.querySelector(config.selectors.input);
  const button = document.querySelector(config.selectors.send);
  if (!input || !button || button.disabled) throw new Error('未找到可用输入框或发送按钮');
  if ((input.value || input.textContent || '').trim()) throw new Error('输入框有人工草稿，已跳过');
  if (!(input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement)) {
    throw new Error('当前仅适配 input/textarea，富文本输入框需要单独适配');
  }
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, reply);
  input.dispatchEvent(new Event('input', {bubbles: true}));
  button.click();
  report('已尝试发送，请在闲鱼确认送达：' + reply);
}

async function scan() {
  if (!config.enabled || busy) return;
  busy = true;
  try {
    await scanConversation();
  } catch (error) {
    report(error.message);
  } finally {
    busy = false;
  }
}

async function scanConversation() {
  const conversation = conversationId();
  if (!conversation) throw new Error('未读取到当前会话的稳定 ID，请检查页面适配');
  const items = messages();
  if (items.some(item => !item.id)) throw new Error('买家消息缺少稳定 ID，已停止本轮处理');
  // 首次进入或切换会话只建立基线，避免自动回复历史消息。
  if (conversation !== currentConversation) {
    currentConversation = conversation;
    items.forEach(item => remember(conversation + ':' + item.id));
    report('当前会话已建立基线，等待新消息');
    return;
  }
  for (const item of items) {
    const key = conversation + ':' + item.id;
    if (seen.has(key)) continue;
    remember(key);
    await processMessage(item, conversation);
  }
}

function updateConfig(value) {
  config = {...GameReply.defaults, ...value};
  currentConversation = '';
}

chrome.storage.local.get('config').then(({config: value}) => updateConfig(value));
chrome.storage.onChanged.addListener(changes => {
  if (changes.config) updateConfig(changes.config.newValue);
});
setInterval(scan, 1500);
