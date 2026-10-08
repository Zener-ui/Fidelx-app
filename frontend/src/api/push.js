import client from "./client";

export const getVapidKey = () => client.get("/push/vapid-key", { suppressToast: true });
export const savePushSubscription = (subscription) => client.post("/push/subscribe", subscription, { suppressToast: true });
export const removePushSubscription = (endpoint) => client.post("/push/unsubscribe", { endpoint }, { suppressToast: true });

export const registerFcmToken = (token) => client.post("/push/fcm/register", { token, platform: "android", app_type: import.meta.env.VITE_APP_ROLE || "customer" }, { suppressToast: true });
export const unregisterFcmToken = (token) => client.post("/push/fcm/unregister", { token }, { suppressToast: true });
