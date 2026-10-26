let config = GameReply.normalize();
let busy = false;
let revision = 0;
let listeningSince = Date.now();
const seen = new Set();
const previewed = new Set();

function report(text) {
  chrome.storage.local.set({status: {text, time: new Date().toLocaleString('zh-CN')}});
}

async function reception(identity, operation, details = {}) {
  const result = await chrome.runtime.sendMessage({type: 'reception', identity, operation, ...details});
  if (result.error) throw new Error(result.error);
  return result;
}

function identityKey(identity) {
  return JSON.stringify([identity.seller, identity.buyer]);
}

function stillCurrent(context) {
  if (!config.enabled || context.revision !== revision) return false;
  const now = ChatAdapter.identity(config.selectors);
  return JSON.stringify(now) === JSON.stringify(context.identity);
}

async function actionFor(message, context) {
  let first;
  if (config.autoSend) {
    const claim = await reception(context.identity, 'claim', {messageId: message.id});
    if (claim.duplicate) return null;
    context.claimed = true;
    first = claim.first;
  } else {
    const {record} = await reception(context.identity, 'read');
    first = !record.engaged && !previewed.has(identityKey(context.identity));
  }
  const action = GameReply.parse(message.text, config.rules);
  return action || (first ? {reply: GameReply.welcomeMessage, guidance: true} : null);
}

async function getReply(action) {
  if (!action.name) return action.reply;
  const result = await chrome.runtime.sendMessage({type: 'lookup', name: action.name});
  if (result.error) throw new Error('查询服务不可用，本条请人工处理：' + result.error);
  return GameReply.format(result);
}

async function processMessage(message, context) {
  const automatic = config.autoSend;
  let delivery = 'not_sent';
  try {
    const action = await actionFor(message, context);
    if (!action) return;
    context.guidance = Boolean(action.guidance);
    const reply = await getReply(action);
    if (!stillCurrent(context)) return;
    if (!automatic) {
      previewed.add(identityKey(context.identity));
      report('预览回复（未发送）：' + reply);
      return;
    }
    delivery = await sendReply(reply, context);
  } catch (error) {
    report(error.message);
  } finally {
    // 无法确定送达时保留 attempted/pending，不以“成功”标记，也不自动重发。
    if (automatic && context.claimed) await reception(context.identity, 'finish', {
      messageId: message.id, delivery, guidance: context.guidance
    });
  }
}

async function sendReply(reply, context) {
  if (!config.autoSend || !stillCurrent(context)) return 'not_sent';
  const input = ChatAdapter.input(config.selectors);
  ChatAdapter.fill(input, reply);
  // 输入事件后等待页面更新按钮；再次核对会话和草稿，防止异步期间误发。
  await new Promise(resolve => setTimeout(resolve, 100));
  if (!config.autoSend || !stillCurrent(context) || input.value !== reply) return 'not_sent';
  if (document.querySelector(config.selectors.input) !== input) return 'not_sent';
  const button = document.querySelector(config.selectors.send);
  if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') {
    throw new Error('发送按钮不可用，回复留在输入框，请人工处理');
  }
  // 点击前先写入结果不明状态，页面退出或后台中断也不能导致自动重复欢迎。
  await reception(context.identity, 'finish', {
    messageId: context.messageId, delivery: 'attempted', guidance: context.guidance
  });
  if (!config.autoSend || !stillCurrent(context) || input.value !== reply) return 'not_sent';
  if (document.querySelector(config.selectors.input) !== input) return 'not_sent';
  if (document.querySelector(config.selectors.send) !== button || button.disabled || button.getAttribute('aria-disabled') === 'true') return 'not_sent';
  try {
    button.click();
  } catch {
    report('发送动作结果不明，请人工检查，未自动重试');
    return 'attempted';
  }
  report('已尝试发送，送达状态待人工确认：' + reply);
  return 'attempted';
}

function remember(key) {
  seen.add(key);
  if (seen.size > 5000) seen.delete(seen.values().next().value);
}

async function scanConversation() {
  const identity = ChatAdapter.identity(config.selectors);
  const context = {identity, revision};
  const items = ChatAdapter.messages(config.selectors);
  if (items.some(item => !item.id || !Number.isFinite(item.time))) {
    throw new Error('消息缺少稳定 ID 或绝对时间，暂停处理，请检查适配');
  }
  // 以本次启用时间为界，迟到渲染的旧记录也不当作新咨询。
  if (items.some(item => item.time <= listeningSince) && !previewed.has(identityKey(identity))) {
    await reception(identity, 'history');
  }
  for (const item of items.sort((left, right) => left.time - right.time)) {
    if (!stillCurrent(context)) return;
    if (item.time <= listeningSince) continue;
    if (item.time > Date.now()) throw new Error('消息时间晚于本机时间，请检查时间格式或系统时钟');
    const key = JSON.stringify([identity.seller, identity.buyer, item.id]);
    if (seen.has(key)) continue;
    remember(key);
    await processMessage(item, {...context, messageId: item.id});
  }
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

function updateConfig(value) {
  config = GameReply.normalize(value);
  revision += 1;
  listeningSince = Date.now();
}

chrome.storage.local.get('config').then(({config: value}) => updateConfig(value));
chrome.storage.onChanged.addListener(changes => {
  if (changes.config) updateConfig(changes.config.newValue);
});
setInterval(scan, 1500);
