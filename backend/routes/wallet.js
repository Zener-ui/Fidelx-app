const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { roles } = require("../middleware/roles");
const {
  getWallet, ensureWalletFundingAccount, getWalletTransactions, createWalletTopup, markWalletTopupSent, getMyTopups,
} = require("../controllers/walletController");

router.use(protect, roles("customer"));
router.get("/", getWallet);
router.post("/funding-account", ensureWalletFundingAccount);
router.get("/transactions", getWalletTransactions);
router.get("/topups", getMyTopups);
router.post("/topups", createWalletTopup);
router.post("/topups/:id/mark-sent", markWalletTopupSent);

module.exports = router;
