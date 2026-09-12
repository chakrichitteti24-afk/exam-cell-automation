import { api } from "./api";

// Utility to convert Base64 URL to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered with scope:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
}

export async function subscribeToPush(registration: ServiceWorkerRegistration) {
  if (!('PushManager' in window)) return false;

  try {
    // 1. Fetch public key from backend
    const res = await fetch('http://localhost:8000/api/v1/notifications/vapid-public-key');
    if (!res.ok) throw new Error('Failed to fetch VAPID key');
    const { key } = await res.json();

    // 2. Subscribe to push manager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key)
    });

    // 3. Send subscription to backend using authenticated fetch wrapper
    const subJSON = subscription.toJSON();
    if (!subJSON.endpoint || !subJSON.keys) {
      throw new Error('Invalid subscription payload');
    }

    const token = localStorage.getItem("gkce_exam_cell_auth_token");
    if (!token) return false; // not authenticated

    await fetch('http://localhost:8000/api/v1/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        endpoint: subJSON.endpoint,
        keys: {
          p256dh: subJSON.keys.p256dh,
          auth: subJSON.keys.auth
        }
      })
    });

    return true;
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return false;
  }
}
