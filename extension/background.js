chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'lookup') return;
  lookup(message.name).then(respond).catch(() => respond({error: '查询服务不可用，请检查服务和访问密钥'}));
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
  if (!response.ok) throw new Error('查询失败');
  return response.json();
}
