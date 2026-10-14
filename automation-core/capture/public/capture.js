'use strict';
const $ = id => document.getElementById(id);
const log = message => { $('log').textContent = `${new Date().toLocaleTimeString()} ${message}\n` + $('log').textContent.slice(0, 2500); };
const setStatus = message => { $('status').textContent = message; };
const DB_NAME = 'smile-capture-spool-v1';
const PARTS = 'parts';
const SESSIONS = 'sessions';
let db, recorder, stream, active = false, finishing = false, currentId, nextIndex = 0, flushPromise = null;
let pendingWrites = new Set();

const api = async (path, options = {}) => {
  const token = $('token').value.trim();
  if (!token) throw new Error('접근 토큰을 입력하세요');
  const response = await fetch(path, { ...options, headers: { authorization: `Bearer ${token}`, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`서버 ${response.status}: ${(await response.text()).slice(0, 180)}`);
  return response;
};
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PARTS)) request.result.createObjectStore(PARTS, { keyPath: 'id' });
      if (!request.result.objectStoreNames.contains(SESSIONS)) request.result.createObjectStore(SESSIONS, { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
function transaction(storeNames, mode, callback) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Local storage transaction aborted'));
    let value;
    try { value = callback(tx); } catch (error) { tx.abort(); reject(error); return; }
    tx.oncomplete = () => resolve(value);
  });
}
function all(name) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readonly');
    const request = tx.objectStore(name).getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
const listPending = () => all(PARTS);
const listSessions = () => all(SESSIONS);
async function persistSession(meta) { await transaction([SESSIONS], 'readwrite', tx => tx.objectStore(SESSIONS).put(meta)); }
async function persistPart(part, meta) {
  await transaction([PARTS, SESSIONS], 'readwrite', tx => {
    tx.objectStore(PARTS).put(part);
    tx.objectStore(SESSIONS).put(meta);
  });
}
async function removePart(id) { await transaction([PARTS], 'readwrite', tx => tx.objectStore(PARTS).delete(id)); }
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');

// One bad historical session must not block uploading today's session.
async function flush() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    const queue = (await listPending()).sort((a, b) => a.createdAt - b.createdAt || a.index - b.index);
    for (const part of queue) {
      try {
        const bytes = await part.blob.arrayBuffer();
        const sha = hex(await crypto.subtle.digest('SHA-256', bytes));
        await api(`/api/sessions/${part.sessionId}/chunks/${part.index}`, {
          method: 'PUT', headers: { 'content-type': part.mime, 'x-content-sha256': sha }, body: part.blob,
        });
        await removePart(part.id);
        setStatus(`전송됨: ${part.sessionId.slice(0, 8)} · 구간 ${part.index}`);
      } catch (error) {
        log(`${part.sessionId.slice(0, 8)} 구간 ${part.index} 전송 보류: ${error.message}`);
        // Continue processing later sessions; a prior failed source never blocks a new one.
      }
    }
  })();
  try { return await flushPromise; } finally { flushPromise = null; }
}
async function finalizeRecoverableSessions() {
  const sessions = await listSessions();
  const pending = await listPending();
  for (const session of sessions.filter(s => s.status === 'READY_TO_FINISH')) {
    if (pending.some(part => part.sessionId === session.id)) continue;
    try {
      await api(`/api/sessions/${session.id}/finish`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedChunks: session.nextIndex }),
      });
      await persistSession({ ...session, status: 'UPLOAD_FINISHED' });
      log(`서버 최종 수신 확인: ${session.id.slice(0, 8)} (${session.nextIndex}구간)`);
    } catch (error) { log(`세션 종료 보류: ${error.message}`); }
  }
}
async function sync() {
  if (!db) return;
  await flush();
  await finalizeRecoverableSessions();
}
$('retry').onclick = () => sync().catch(error => log(error.message));
window.addEventListener('online', () => sync().catch(error => log(error.message)));
// Retry periodically as well as on reconnection and every new part. Never start a second capture.
setInterval(() => { if (db) sync().catch(error => log(error.message)); }, 15000);

$('start').onclick = async () => {
  if (active || finishing) return;
  try {
    if (!db) db = await openDatabase();
    if (!window.isSecureContext) throw new Error('HTTPS 또는 localhost 환경에서만 카메라가 작동합니다');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('이 브라우저는 촬영을 지원하지 않습니다');
    await sync();
    const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: true });
    const mime = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) { camera.getTracks().forEach(track => track.stop()); throw new Error('이 브라우저의 녹화 형식을 지원하지 않습니다'); }
    const created = await api('/api/sessions', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'camera' }),
    });
    currentId = (await created.json()).id;
    nextIndex = 0; stream = camera;
    await persistSession({ id: currentId, status: 'RECORDING', nextIndex: 0, startedAt: Date.now() });
    try { await navigator.storage?.persist?.(); } catch { /* best-effort browser quota protection */ }
    $('preview').srcObject = stream;
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
    recorder.ondataavailable = event => {
      if (!event.data.size) return;
      const index = nextIndex++;
      const entry = { id: `${currentId}/${index}`, sessionId: currentId, index, mime: mime.split(';')[0], blob: event.data, createdAt: Date.now() };
      const meta = { id: currentId, status: 'RECORDING', nextIndex, startedAt: Date.now() };
      const task = persistPart(entry, meta).then(async () => {
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
      finishing = true; active = false;
      stream?.getTracks().forEach(track => track.stop()); $('preview').srcObject = null;
      $('start').disabled = true; $('stop').disabled = true;
      try {
      await Promise.allSettled([...pendingWrites]);
      // Never mark complete if a chunk failed to persist locally.
      const saved = (await listSessions()).find(s => s.id === currentId);
      if (!saved || saved.nextIndex !== nextIndex) {
        log('촬영 구간이 로컬에 누락됐습니다. 수동 검수 전 완료 처리하지 않습니다.');
        return;
      }
      await persistSession({ ...saved, status: 'READY_TO_FINISH' });
      await sync();
      } catch (error) { log(`종료 처리 오류: ${error.message}`); }
      finally { finishing = false; $('start').disabled = false; }
    };
    recorder.start(20_000);
    active = true; $('start').disabled = true; $('stop').disabled = false;
    setStatus('촬영 중 · 20초 단위 자동 전송'); log(`녹화 세션 시작: ${currentId}`);
  } catch (error) {
    log(`시작 실패: ${error.message}`);
    stream?.getTracks().forEach(track => track.stop());
    $('start').disabled = false; $('stop').disabled = true;
  }
};
$('stop').onclick = () => { if (recorder?.state === 'recording') { recorder.stop(); $('stop').disabled = true; } };
(async () => {
  try {
    db = await openDatabase();
    const sessions = await listSessions();
    const pending = await listPending();
    const interrupted = sessions.filter(s => s.status === 'RECORDING');
    if (interrupted.length) log(`중단된 촬영 ${interrupted.length}건은 자동 완료 처리하지 않습니다. 보존된 구간만 전송합니다.`);
    if (pending.length) log(`미전송 구간 ${pending.length}개 발견. 접근 토큰 입력 후 자동 재전송합니다.`);
  } catch (error) { log(`로컬 저장소 오류: ${error.message}`); }
})();
