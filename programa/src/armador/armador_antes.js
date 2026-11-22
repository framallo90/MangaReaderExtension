// offscreen.js fue escrito para la extensión y avisa el progreso con chrome.runtime.sendMessage.
// Acá no hay extensión: ese aviso se manda al proceso principal.
window.chrome = {
  runtime: {
    sendMessage: (m) => {
      try { if (m && m.action === 'progress') window.mrArmador.progreso({ jobId: m.jobId, done: m.done, total: m.total }); } catch {}
      return Promise.resolve();
    },
  },
};
