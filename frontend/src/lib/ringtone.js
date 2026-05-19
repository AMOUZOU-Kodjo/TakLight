let audioCtx = null;
let gainNode = null;
let isPlaying = false;
let timeoutId = null;

function getContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function playRingtone() {
  if (isPlaying) return;
  isPlaying = true;
  const ctx = getContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  gainNode = ctx.createGain();
  gainNode.gain.value = 0.3;
  gainNode.connect(ctx.destination);

  function playTone() {
    if (!isPlaying) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.setValueAtTime(480, ctx.currentTime + 0.15);
    osc.connect(gainNode);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    timeoutId = setTimeout(() => {
      if (isPlaying) {
        setTimeout(playTone, 2000);
      }
    }, 500);
  }

  playTone();
}

export function stopRingtone() {
  isPlaying = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}
