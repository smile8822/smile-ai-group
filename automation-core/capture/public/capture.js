'use strict';
const $ = id => document.getElementById(id);
const log = message => { $('log').textContent = `${new Date().toLocaleTimeString()} ${message}\n` + $('log').textContent.slice(0, 2500); };
const setStatus = message => { $('status').textContent = message; };
const DB_NAME = 'smile-capture-spool-v1';
const STORE = 'parts';
let db; let recorder; let stream; let sessionId; let nextIndex = 0; let draining = false; let active = false;
const pendingWrites = new Set();
sessionId = localStorage.getItem('smile-capture-last-session') || null;
const api = async (path, options = {}) => {
  const token = $('token').value.trim();
  if (!token) throw new Error('접근 토큰을 입력하세요');
  const response = await fetch(path, { ...options, headers: { authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`서버 ${response.status}: ${(await response.text()).slice(0, 180)}`);
  return response;
};
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
function transaction(mode, callback) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode); const store = tx.objectStore(STORE);
    const req = callback(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function listPending() { return transaction('readonly', store => store.getAll()); }
async function persist(entry) { await transaction('readwrite', store => store.put(entry)); }
async function remove(id) { await transaction('readwrite', store => store.delete(id)); }
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
async function flush() {
  if (draining) return;
  draining = true;
  try {
    const queue = (await listPending()).sort((a,b) => a.createdAt - b.createdAt || a.index - b.index);
    for (const part of queue) {
      try {
        const bytes = await part.blob.arrayBuffer();
        const sha = hex(await crypto.subtle.digest('SHA-256', bytes));
        await api(`/api/sessions/${part.sessionId}/chunks/${part.index}`, { method: 'PUT', headers: { 'content-type': part.mime, 'x-content-sha256': sha }, body: part.blob });
        await remove(part.id);
        setStatus(`전송됨: ${part.sessionId.slice(0, 8)} · 구간 ${part.index}`);
      } catch (error) { log(`전송 보류: ${error.message}`); break; }
    }
  } finally { draining = false; }
}
$('retry').onclick = async () => { try { await flush(); if (!active && localStorage.getItem('smile-capture-finalize') === sessionId) await finishIfClear(); } catch(error) { log(error.message); } };
window.addEventListener('online', () => flush().catch(error => log(error.message)));
$('start').onclick = async () => {
  if (active) return;
  try {
    if (!db) db = await openDatabase();
    if (!window.isSecureContext) throw new Error('HTTPS 또는 localhost 환경에서만 카메라가 작동합니다');
    await flush();
    const created = await api('/api/sessions', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ kind:'camera' }) });
    sessionId = (await created.json()).id; nextIndex = 0;
    localStorage.setItem('smile-capture-last-session', sessionId);
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
    $('preview').srcObject = stream;
    const mime = ['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error('이 브라우저의 녹화 형식을 지원하지 않습니다');
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
    recorder.ondataavailable = event => {
      if (!event.data.size) return;
      const index = nextIndex++;
      const record = { id: `${sessionId}/${index}`, sessionId, index, mime: mime.split(';')[0], blob:event.data, createdAt:Date.now() };
      const task = persist(record).then(async () => {
        setStatus(`촬영 중 · 구간 ${index} 저장 · 업로드 중`);
        await flush();
      }).catch(error => {
        log(`로컬 보존 실패: ${error.message} — 녹화를 종료합니다`);
        if (recorder.state === 'recording') recorder.stop();
      }).finally(() => pendingWrites.delete(task));
      pendingWrites.add(task);
    };
    recorder.onerror = event => { log(`녹화 오류: ${event.error?.message || '알 수 없음'}`); };
    recorder.onstop = async () => {
      active = false;
      stream?.getTracks().forEach(track => track.stop()); $('preview').srcObject = null;
      $('start').disabled = false; $('stop').disabled = true;
      // Finalize only if all segments are acknowledged; otherwise retry button completes uploads later.
      localStorage.setItem('smile-capture-finalize', sessionId);
      await Promise.allSettled([...pendingWrites]);
      await flush();
      await finishIfClear();
    };
    recorder.start(20_000);
    active = true; $('start').disabled = true; $('stop').disabled = false;
    setStatus('촬영 중 · 20초 단위 자동 전송'); log(`녹화 세션 시작: ${sessionId}`);
  } catch(error) { log(`시작 실패: ${error.message}`); stream?.getTracks().forEach(track => track.stop()); }
};
async function finishIfClear() {
  if (!sessionId || localStorage.getItem('smile-capture-finalize') !== sessionId) return;
  const pending = (await listPending()).filter(p => p.sessionId === sessionId);
  if (pending.length) { log(`${pending.length}개 구간이 로컬에 남아 있습니다. 재전송 버튼으로 마무리하세요.`); return; }
  try { await api(`/api/sessions/${sessionId}/finish`, { method:'POST' }); localStorage.removeItem('smile-capture-last-session'); localStorage.removeItem('smile-capture-finalize'); log('세션 전송 마무리 확인'); }
  catch(error) { log(`세션 종료 확인 보류: ${error.message}`); }
}
$('stop').onclick = () => { if (recorder?.state === 'recording') { recorder.stop(); $('stop').disabled = true; } };
(async () => { try { db = await openDatabase(); const pending = await listPending(); if (pending.length) log(`미전송 구간 ${pending.length}개 발견. 토큰 입력 후 재전송을 누르세요.`); } catch(error) { log(`로컬 저장소 오류: ${error.message}`); } })();
