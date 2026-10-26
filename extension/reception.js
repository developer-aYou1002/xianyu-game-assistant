/* 接待写入统一经过后台队列，避免多个页面同时判断为首次咨询。 */
let receptionQueue = Promise.resolve();

function receptionRequest(message) {
  const pending = receptionQueue.then(() => updateReception(message));
  receptionQueue = pending.catch(() => {});
  return pending;
}

function receptionKey(identity) {
  if (!identity || ![identity.seller, identity.buyer].every(value => typeof value === 'string' && value.length > 0 && value.length <= 200)) {
    throw new Error('缺少稳定的买家或卖家标识');
  }
  return 'reception:' + JSON.stringify([identity.seller, identity.buyer]);
}

async function updateReception(message) {
  const key = receptionKey(message.identity);
  const data = await chrome.storage.local.get(key);
  const record = data[key] || {engaged: false, recent: [], delivery: 'none'};
  if (message.operation === 'read') return {record};
  if (message.operation === 'history') {
    if (!record.engaged) {
      await chrome.storage.local.set({[key]: {...record, engaged: true, reason: 'history', updatedAt: Date.now()}});
    }
    return {};
  }
  if (message.operation === 'claim') return claimReception({key, record, message});
  if (message.operation === 'finish') {
    if (record.messageId !== message.messageId) return {};
    const allowed = ['not_sent', 'attempted'];
    if (!allowed.includes(message.delivery)) throw new Error('未知接待状态');
    const update = {...record, delivery: message.delivery, updatedAt: Date.now()};
    if (message.guidance) update.guidanceDelivery = message.delivery;
    await chrome.storage.local.set({[key]: update});
    return {};
  }
  throw new Error('未知接待操作');
}

async function claimReception({key, record, message}) {
  if (typeof message.messageId !== 'string' || !message.messageId) throw new Error('消息缺少稳定 ID');
  if (record.recent.includes(message.messageId)) return {duplicate: true};
  const first = !record.engaged;
  // 先持久化接待占用再发送；中途退出也不自动重发结果不明的欢迎语。
  await chrome.storage.local.set({[key]: {
    ...record, engaged: true, reason: first ? 'first_message' : record.reason,
    recent: [...record.recent, message.messageId].slice(-100),
    messageId: message.messageId, delivery: 'pending', updatedAt: Date.now()
  }});
  return {first};
}
