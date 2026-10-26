chrome.storage.local.get('status').then(({status}) => {
  document.getElementById('status').textContent = status ? `${status.time}：${status.text}` : '尚未启用，请先设置本地服务和页面适配';
});
document.getElementById('settings').onclick = () => chrome.runtime.openOptionsPage();
