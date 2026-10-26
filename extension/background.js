importScripts('reception.js');

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!['lookup', 'reception'].includes(message.type)) return;
  const work = message.type === 'lookup' ? lookup(message.name) : receptionRequest(message);
  work.then(respond).catch(error => respond({error: error.message}));
  return true;
});

async function lookup(name) {
  const {config} = await chrome.storage.local.get('config');
  const response = await fetch('http://127.0.0.1:18765/lookup', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${config?.token || ''}`},
    body: JSON.stringify({name}),
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('查询服务不可用，请检查服务、数据库和访问密钥');
  return response.json();
}
