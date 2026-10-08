const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { getVapidKey, subscribe, unsubscribe, dispatchInternal, registerFcmToken, unregisterFcmToken } = require("../controllers/pushController");

router.get("/vapid-key", getVapidKey);
router.post("/subscribe", protect, subscribe);
router.post("/unsubscribe", protect, unsubscribe);
router.post("/fcm/register", protect, registerFcmToken);
router.post("/fcm/unregister", protect, unregisterFcmToken);

// No `protect` here — this is called by the Supabase database trigger,
// not a logged-in user. Guarded by INTERNAL_WEBHOOK_SECRET instead
// (checked inside dispatchInternal).
router.post("/dispatch-internal", dispatchInternal);

module.exports = router;
