const axios = require("axios");
const { adminClient } = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const PT_ACCOUNT_NUMBER = process.env.FIDELX_PT_ACCOUNT_NUMBER || "9706958445";
const PT_ACCOUNT_BANK = process.env.FIDELX_PT_ACCOUNT_BANK || "Paystack-Titan";
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const paystackHeaders = {
  Authorization: `Bearer ${PAYSTACK_SECRET}`,
  "Content-Type": "application/json",
};

const getWallet = async (req, res) => {
  try {
    const { data: wallet, error } = await adminClient.rpc("get_or_create_customer_wallet", { p_user_id: req.user.id });
    if (error) throw error;
    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        balance: Number(wallet.balance || 0),
        updated_at: wallet.updated_at,
        funding_account: wallet.paystack_dva_account_number ? {
          bank_name: wallet.paystack_dva_bank_name,
          bank_slug: wallet.paystack_dva_provider_slug,
          account_name: wallet.paystack_dva_account_name,
          account_number: wallet.paystack_dva_account_number,
          assigned_at: wallet.paystack_dva_assigned_at,
        } : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const ensureWalletFundingAccount = async (req, res) => {
  try {
    if (req.user.role !== "customer") return res.status(403).json({ success: false, message: "Wallet funding is available to customers only." });

    const { data: existing, error: walletError } = await adminClient
      .from("customer_wallets")
      .select("id,paystack_customer_code,paystack_dva_id,paystack_dva_account_number,paystack_dva_account_name,paystack_dva_bank_name,paystack_dva_provider_slug,paystack_dva_assigned_at")
      .eq("user_id", req.user.id)
      .single();
    if (walletError) throw walletError;

    if (existing.paystack_dva_account_number) {
      return res.json({ success: true, funding_account: {
        bank_name: existing.paystack_dva_bank_name,
        bank_slug: existing.paystack_dva_provider_slug,
        account_name: existing.paystack_dva_account_name,
        account_number: existing.paystack_dva_account_number,
        assigned_at: existing.paystack_dva_assigned_at,
      }});
    }

    const { data: user, error: userError } = await adminClient
      .from("users")
      .select("id,full_name,email,phone")
      .eq("id", req.user.id)
      .single();
    if (userError) throw userError;
    if (!user.email || !user.phone) return res.status(400).json({ success: false, message: "A verified email address and phone number are required before wallet funding can be activated." });

    let customer = null;

    // If Fidelx already has the Paystack customer code, retrieve that exact
    // customer. Do not use GET /customer with an email query: that endpoint
    // lists customers and returns an array, not a single customer object.
    if (existing.paystack_customer_code) {
      try {
        const lookup = await axios.get(`https://api.paystack.co/customer/${encodeURIComponent(existing.paystack_customer_code)}`, {
          headers: paystackHeaders,
          timeout: 15000,
        });
        customer = lookup.data?.data || null;
      } catch (err) {
        if (err.response?.status !== 404) throw err;
      }
    }

    // Paystack's customer retrieval endpoint accepts an email or customer
    // code as the path parameter and returns one customer object.
    if (!customer) {
      try {
        const lookup = await axios.get(`https://api.paystack.co/customer/${encodeURIComponent(user.email)}`, {
          headers: paystackHeaders,
          timeout: 15000,
        });
        customer = lookup.data?.data || null;
      } catch (err) {
        if (err.response?.status !== 404) throw err;
      }
    }

    if (!customer) {
      const parts = String(user.full_name || "Fidelx Customer").trim().split(/\s+/).filter(Boolean);
      const created = await axios.post("https://api.paystack.co/customer", {
        email: user.email,
        first_name: parts[0] || "Fidelx",
        last_name: parts.slice(1).join(" ") || "Customer",
        phone: user.phone,
      }, { headers: paystackHeaders, timeout: 15000 });
      customer = created.data?.data || null;
    }

    const customerCode = customer?.customer_code || existing.paystack_customer_code;
    if (!customerCode) throw new Error("Paystack did not return a customer code.");

    // A Paystack customer can pre-exist without a phone number (for example,
    // if the customer was created during an earlier checkout). DVA creation
    // can then fail even though Fidelx now has a phone on the user's profile.
    // Synchronize the current Fidelx identity details onto that existing
    // Paystack customer before requesting/reusing the DVA.
    const paystackPhone = String(customer?.phone || "").trim();
    if (paystackPhone !== String(user.phone).trim()) {
      const parts = String(user.full_name || "Fidelx Customer").trim().split(/\s+/).filter(Boolean);
      const updated = await axios.put(`https://api.paystack.co/customer/${encodeURIComponent(customerCode)}`, {
        first_name: parts[0] || "Fidelx",
        last_name: parts.slice(1).join(" ") || "Customer",
        phone: user.phone,
      }, { headers: paystackHeaders, timeout: 15000 });
      customer = updated.data?.data || customer;
    }

    // If Paystack has already assigned this customer a DVA, persist and reuse
    // it instead of requesting another account.
    const existingDva = customer?.dedicated_account;
    if (existingDva?.account_number) {
      const { data: savedExistingDva, error: existingDvaError } = await adminClient
        .from("customer_wallets")
        .update({
          paystack_customer_code: customerCode,
          paystack_dva_id: existingDva.id || null,
          paystack_dva_account_number: String(existingDva.account_number),
          paystack_dva_account_name: existingDva.account_name || null,
          paystack_dva_bank_name: existingDva.bank?.name || "Paystack-Titan",
          paystack_dva_provider_slug: existingDva.bank?.slug || "titan-paystack",
          paystack_dva_assigned_at: existingDva.assignment?.assigned_at || existingDva.updated_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("paystack_dva_account_number,paystack_dva_account_name,paystack_dva_bank_name,paystack_dva_provider_slug,paystack_dva_assigned_at")
        .single();
      if (existingDvaError) throw existingDvaError;

      return res.json({ success: true, funding_account: {
        bank_name: savedExistingDva.paystack_dva_bank_name,
        bank_slug: savedExistingDva.paystack_dva_provider_slug,
        account_name: savedExistingDva.paystack_dva_account_name,
        account_number: savedExistingDva.paystack_dva_account_number,
        assigned_at: savedExistingDva.paystack_dva_assigned_at,
      }});
    }

    const { error: customerCodeError } = await adminClient
      .from("customer_wallets")
      .update({ paystack_customer_code: customerCode, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .is("paystack_customer_code", null);
    if (customerCodeError) throw customerCodeError;

    const dvaResponse = await axios.post("https://api.paystack.co/dedicated_account", {
      customer: customerCode,
      preferred_bank: "titan-paystack",
    }, { headers: paystackHeaders, timeout: 20000 });

    const dva = dvaResponse.data?.data || {};
    if (!dva.account_number) {
      return res.status(202).json({ success: true, status: "PROCESSING", message: "Your Fidelx funding account is being assigned. Please refresh shortly." });
    }

    const { data: saved, error: saveError } = await adminClient
      .from("customer_wallets")
      .update({
        paystack_customer_code: customerCode,
        paystack_dva_id: dva.id || null,
        paystack_dva_account_number: String(dva.account_number),
        paystack_dva_account_name: dva.account_name || null,
        paystack_dva_bank_name: dva.bank?.name || "Paystack-Titan",
        paystack_dva_provider_slug: dva.bank?.slug || "titan-paystack",
        paystack_dva_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("paystack_dva_account_number,paystack_dva_account_name,paystack_dva_bank_name,paystack_dva_provider_slug,paystack_dva_assigned_at")
      .single();
    if (saveError) throw saveError;

    return res.json({ success: true, funding_account: {
      bank_name: saved.paystack_dva_bank_name,
      bank_slug: saved.paystack_dva_provider_slug,
      account_name: saved.paystack_dva_account_name,
      account_number: saved.paystack_dva_account_number,
      assigned_at: saved.paystack_dva_assigned_at,
    }});
  } catch (err) {
    console.error("[WALLET] DVA assignment failed:", err.response?.data || err.message);
    return res.status(err.response?.status === 400 ? 400 : 500).json({
      success: false,
      message: err.response?.data?.message || err.message || "Could not activate your wallet funding account.",
    });
  }
};

const getWalletTransactions = async (req, res) => {
  try {
    const { data, error } = await adminClient
      .from("customer_wallet_ledger")
      .select("id, amount, balance_before, balance_after, type, reference, order_id, refund_id, description, created_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    res.json({ success: true, transactions: data || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Kept for backwards compatibility with the original PT-account/manual-confirmation flow.
// New customer UI uses the dedicated account above, so automatic DVA webhook funding is the normal path.
const createWalletTopup = async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount < 100) return res.status(400).json({ success: false, message: "Wallet top-up must be at least ₦100." });
    const rounded = Math.round(amount * 100) / 100;
    const { data: wallet, error: walletError } = await adminClient.rpc("get_or_create_customer_wallet", { p_user_id: req.user.id });
    if (walletError) throw walletError;
    const reference = `wtop_${uuidv4().replace(/-/g, "")}`;
    const { data: topup, error } = await adminClient.from("customer_wallet_topups")
      .insert({ id: uuidv4(), user_id: req.user.id, wallet_id: wallet.id, amount: rounded, reference, method: "pt_account" })
      .select("id, amount, status, method, reference, created_at")
      .single();
    if (error) throw error;
    res.status(201).json({ success: true, topup, instructions: { bank_name: PT_ACCOUNT_BANK, account_number: PT_ACCOUNT_NUMBER, account_name: "Fidelx", amount: rounded, note: "Legacy manual PT Account flow. New wallet funding uses your dedicated Fidelx account." } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const markWalletTopupSent = async (req, res) => {
  try {
    const { data, error } = await adminClient.from("customer_wallet_topups")
      .update({ status: "CUSTOMER_MARKED_SENT", marked_sent_at: new Date().toISOString() })
      .eq("id", req.params.id).eq("user_id", req.user.id).in("status", ["PENDING"])
      .select("id, amount, status, reference, marked_sent_at").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(400).json({ success: false, message: "This top-up is no longer waiting for your transfer." });
    res.json({ success: true, topup: data, message: "Transfer noted. Fidelx will credit your wallet after the incoming payment is verified." });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getMyTopups = async (req, res) => {
  try {
    const { data, error } = await adminClient.from("customer_wallet_topups")
      .select("id, amount, status, method, reference, external_reference, created_at, marked_sent_at, confirmed_at")
      .eq("user_id", req.user.id).order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    res.json({ success: true, topups: data || [] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getAdminWalletTopups = async (req, res) => {
  try {
    const status = req.query.status || "CONFIRMED";
    const { data, error } = await adminClient.from("customer_wallet_topups")
      .select("id, user_id, amount, status, method, reference, external_reference, payer_name, payer_account_number, created_at, marked_sent_at, confirmed_at, users!customer_wallet_topups_user_id_fkey(full_name,email,phone)")
      .eq("status", status).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    res.json({ success: true, topups: data || [], pt_account: { bank_name: PT_ACCOUNT_BANK, account_number: PT_ACCOUNT_NUMBER } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const confirmAdminWalletTopup = async (req, res) => {
  try {
    const { external_reference, payer_name, payer_account_number } = req.body || {};
    const { data, error } = await adminClient.rpc("confirm_customer_wallet_topup", {
      p_topup_id: req.params.id, p_admin_id: req.user.id,
      p_external_reference: external_reference || null,
      p_payer_name: payer_name || null,
      p_payer_account_number: payer_account_number || null,
    });
    if (error) throw error;
    const { data: topup } = await adminClient.from("customer_wallet_topups").select("id,user_id,amount,status,reference,confirmed_at").eq("id", req.params.id).single();
    if (topup?.user_id) await adminClient.from("notifications").insert({ id: uuidv4(), user_id: topup.user_id, title: "Wallet funded", is_read: false, body: `₦${Number(topup.amount).toLocaleString()} has been added to your Fidelx Wallet. You can use it for your next order.` });
    res.json({ success: true, result: data, topup });
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
};

const processWalletDvaCharge = async (eventData) => {
  const authorization = eventData?.authorization || {};
  const channel = eventData?.channel || authorization.channel;
  if (channel !== "dedicated_nuban") return false;

  const reference = eventData?.reference ? String(eventData.reference) : null;
  const amountKobo = Number(eventData?.amount);
  const currency = String(eventData?.currency || "NGN").toUpperCase();
  const receiverAccount = authorization.receiver_bank_account_number || eventData?.receiver_bank_account_number || null;
  const customerCode = eventData?.customer?.customer_code || null;
  if (!reference || !Number.isFinite(amountKobo) || amountKobo <= 0 || currency !== "NGN") return false;
  if (!receiverAccount && !customerCode) return false;

  let query = adminClient.from("customer_wallets").select("id,user_id,balance,paystack_dva_account_number,paystack_customer_code").limit(1);
  query = receiverAccount ? query.eq("paystack_dva_account_number", String(receiverAccount)) : query.eq("paystack_customer_code", String(customerCode));
  const { data: wallet, error: walletError } = await query.maybeSingle();
  if (walletError) throw walletError;
  if (!wallet) return false;

  const amount = amountKobo / 100;
  const payerName = authorization.sender_name || null;
  const payerAccountNumber = authorization.sender_bank_account_number || null;
  const { data: existing, error: existingError } = await adminClient.from("customer_wallet_topups")
    .select("id,status,amount,wallet_id").eq("external_reference", reference).maybeSingle();
  if (existingError) throw existingError;

  let topup = existing;
  if (!topup) {
    const { data: created, error: createError } = await adminClient.from("customer_wallet_topups")
      .insert({ user_id: wallet.user_id, wallet_id: wallet.id, amount, status: "PENDING", method: "paystack_dva", reference: `paystack-dva-${reference}`, external_reference: reference, payer_name: payerName, payer_account_number: payerAccountNumber })
      .select("id,status,amount,wallet_id").maybeSingle();
    if (createError?.code === "23505") {
      const retry = await adminClient.from("customer_wallet_topups").select("id,status,amount,wallet_id").eq("external_reference", reference).single();
      if (retry.error) throw retry.error;
      topup = retry.data;
    } else if (createError) throw createError;
    else topup = created;
  }

  if (!topup) throw new Error("Could not create wallet top-up record.");
  if (Number(topup.amount) !== amount) throw new Error("Wallet top-up amount mismatch for Paystack reference.");
  if (topup.status === "CONFIRMED") return true;

  const { error: confirmError } = await adminClient.rpc("confirm_customer_wallet_topup", {
    p_topup_id: topup.id, p_admin_id: null, p_external_reference: reference,
    p_payer_name: payerName, p_payer_account_number: payerAccountNumber,
  });
  if (confirmError) throw confirmError;
  return true;
};

module.exports = { getWallet, ensureWalletFundingAccount, getWalletTransactions, createWalletTopup, markWalletTopupSent, getMyTopups, getAdminWalletTopups, confirmAdminWalletTopup, processWalletDvaCharge };
