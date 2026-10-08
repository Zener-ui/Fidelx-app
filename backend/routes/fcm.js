// Mounted at /api/push/fcm (see server.js). Separate from routes/push.js,
// which is the website's Web Push router and is left untouched.
const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { roles } = require("../middleware/roles");
const { registerToken, unregisterToken, sendTest } = require("../controllers/fcmController");
const { promoDispatch, setPromoOptOut, getPromoOptOut } = require("../controllers/fcmPromoController");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." },
});

router.post("/register", limiter, protect, registerToken);
router.post("/unregister", limiter, protect, unregisterToken);
router.post("/test", protect, roles("admin"), sendTest);

// Scheduled reminders. No `protect`: called by pg_cron, guarded by INTERNAL_WEBHOOK_SECRET inside promoDispatch.
router.post("/promo-dispatch", promoDispatch);
router.get("/promo-optout", limiter, protect, getPromoOptOut);
router.post("/promo-optout", limiter, protect, setPromoOptOut);

module.exports = router;
