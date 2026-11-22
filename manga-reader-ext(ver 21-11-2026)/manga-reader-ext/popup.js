// Abre el diálogo "Guardar capítulo" en la pestaña activa
document.getElementById('btnSave').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'save' });
    window.close();
  } catch {
    // La página se abrió antes de instalar/actualizar la extensión
    document.getElementById('status').textContent = '⚠️ Recargá la página (F5) y probá de nuevo';
  }
});

// Burbuja flotante: activar / desactivar
const fabChk = document.getElementById('fabEnabled');
chrome.storage.local.get(['fabEnabled']).then(s => { fabChk.checked = s.fabEnabled !== false; });
fabChk.addEventListener('change', () => chrome.storage.local.set({ fabEnabled: fabChk.checked }));
