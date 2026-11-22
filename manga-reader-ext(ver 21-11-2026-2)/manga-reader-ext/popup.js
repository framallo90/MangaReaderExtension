const $ = (id) => document.getElementById(id);
const activeTab = async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

// Abre un diálogo en la pestaña activa. El service worker le inyecta el script si la
// pestaña se abrió antes de instalar o actualizar la extensión: no hace falta F5.
async function openInTab(command) {
  try {
    const tab = await activeTab();
    const r = await chrome.runtime.sendMessage({ action: 'tab', tabId: tab.id, command });
    if (!r?.ok) throw new Error(r?.error || '');
    window.close();
  } catch {
    $('status').textContent = '⚠️ En esta página no se puede usar (probá en la del manga)';
  }
}
$('btnSave').addEventListener('click', () => openInTab('save'));
$('btnSeries').addEventListener('click', () => openInTab('batch'));
$('btnOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

// Burbuja flotante: en todos lados, y en el sitio de la pestaña activa
(async () => {
  const st = await chrome.storage.local.get(['fabEnabled', 'fabBlockedHosts', 'autoScan']);
  $('fabEnabled').checked = st.fabEnabled !== false;
  $('autoScan').checked = st.autoScan !== false;
  $('fabEnabled').addEventListener('change', () => chrome.storage.local.set({ fabEnabled: $('fabEnabled').checked }));
  $('autoScan').addEventListener('change', () => chrome.storage.local.set({ autoScan: $('autoScan').checked }));

  let host = '';
  try { const u = new URL((await activeTab()).url); if (/^https?:$/.test(u.protocol)) host = u.hostname; } catch {}
  if (!host) return;
  $('siteRow').hidden = false;
  $('siteLabel').textContent = `Mostrarla en ${host}`;
  $('fabSite').checked = !(st.fabBlockedHosts || []).includes(host);
  $('fabSite').addEventListener('change', async () => {
    const hosts = new Set((await chrome.storage.local.get(['fabBlockedHosts'])).fabBlockedHosts || []);
    if ($('fabSite').checked) hosts.delete(host); else hosts.add(host);
    chrome.storage.local.set({ fabBlockedHosts: [...hosts] });
  });
})();
