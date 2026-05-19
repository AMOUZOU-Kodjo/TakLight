export function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function showMessageNotification({ username, content, mediaType, conversationId }) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus?.()) return;

  const body = mediaType === 'image' ? '📷 Photo' : mediaType === 'audio' ? '🎤 Message vocal' : content || 'Message';
  const notification = new Notification(username, {
    body,
    icon: '/icon-192.png',
    tag: conversationId,
    silent: false,
  });

  notification.onclick = () => {
    window.focus();
    window.location.href = `/chat/${conversationId}`;
    notification.close();
  };
}
