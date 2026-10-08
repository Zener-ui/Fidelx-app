-- Fidelx customer wallet: closed-loop customer value for fast refunds, reorders and wallet checkout.
-- PT-account top-ups are intentionally recorded as pending until Fidelx verifies the incoming transfer.

CREATE TABLE IF NOT EXISTS public.customer_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE RESTRICT,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.customer_wallets(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount <> 0),
  balance_before NUMERIC(14,2) NOT NULL,
  balance_after NUMERIC(14,2) NOT NULL CHECK (balance_after >= 0),
  type TEXT NOT NULL CHECK (type IN ('REFUND','ORDER_PAYMENT','TOPUP','TOPUP_REVERSAL','ADMIN_ADJUSTMENT')),
  reference TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES public.orders(id) ON DELETE RESTRICT,
  refund_id UUID REFERENCES public.refunds(id) ON DELETE RESTRICT,
  topup_id UUID,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_ledger_user_created
  ON public.customer_wallet_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_ledger_order
  ON public.customer_wallet_ledger(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_wallet_ledger_refund
  ON public.customer_wallet_ledger(refund_id) WHERE refund_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.customer_wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  wallet_id UUID NOT NULL REFERENCES public.customer_wallets(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 100),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CUSTOMER_MARKED_SENT','CONFIRMED','CANCELLED','EXPIRED')),
  method TEXT NOT NULL DEFAULT 'pt_account' CHECK (method = 'pt_account'),
  reference TEXT NOT NULL UNIQUE,
  external_reference TEXT,
  payer_name TEXT,
  payer_account_number TEXT,
  confirmed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  marked_sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_topups_status_created
  ON public.customer_wallet_topups(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_wallet_topups_user_created
  ON public.customer_wallet_topups(user_id, created_at DESC);

ALTER TABLE public.customer_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_wallet_topups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_wallets, public.customer_wallet_ledger, public.customer_wallet_topups FROM anon, authenticated;
GRANT ALL ON TABLE public.customer_wallets, public.customer_wallet_ledger, public.customer_wallet_topups TO service_role;

CREATE OR REPLACE FUNCTION public.get_or_create_customer_wallet(p_user_id UUID)
RETURNS public.customer_wallets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet public.customer_wallets;
BEGIN
  SELECT * INTO v_wallet FROM public.customer_wallets WHERE user_id=p_user_id FOR UPDATE;
  IF FOUND THEN RETURN v_wallet; END IF;
  INSERT INTO public.customer_wallets(user_id) VALUES(p_user_id)
  ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_wallet FROM public.customer_wallets WHERE user_id=p_user_id FOR UPDATE;
  RETURN v_wallet;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_customer_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_reference TEXT,
  p_description TEXT,
  p_order_id UUID DEFAULT NULL,
  p_refund_id UUID DEFAULT NULL,
  p_topup_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.customer_wallets;
  existing public.customer_wallet_ledger;
  before_balance NUMERIC;
  after_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Wallet credit amount must be greater than zero.'; END IF;
  IF p_reference IS NULL OR btrim(p_reference) = '' THEN RAISE EXCEPTION 'Wallet reference is required.'; END IF;
  IF p_type NOT IN ('REFUND','TOPUP','ADMIN_ADJUSTMENT') THEN RAISE EXCEPTION 'Invalid wallet credit type.'; END IF;

  SELECT * INTO existing FROM public.customer_wallet_ledger WHERE reference=p_reference;
  IF FOUND THEN
    RETURN jsonb_build_object('already_applied',true,'ledger_id',existing.id,'balance_after',existing.balance_after,'amount',existing.amount);
  END IF;

  w := public.get_or_create_customer_wallet(p_user_id);
  before_balance := w.balance;
  after_balance := before_balance + p_amount;

  UPDATE public.customer_wallets
  SET balance=after_balance, updated_at=NOW()
  WHERE id=w.id;

  INSERT INTO public.customer_wallet_ledger(wallet_id,user_id,amount,balance_before,balance_after,type,reference,order_id,refund_id,topup_id,description)
  VALUES(w.id,p_user_id,p_amount,before_balance,after_balance,p_type,p_reference,p_order_id,p_refund_id,p_topup_id,p_description);

  RETURN jsonb_build_object('already_applied',false,'balance_after',after_balance,'amount',p_amount);
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO existing FROM public.customer_wallet_ledger WHERE reference=p_reference;
  IF FOUND THEN RETURN jsonb_build_object('already_applied',true,'ledger_id',existing.id,'balance_after',existing.balance_after,'amount',existing.amount); END IF;
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.debit_customer_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reference TEXT,
  p_description TEXT,
  p_order_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w public.customer_wallets;
  existing public.customer_wallet_ledger;
  before_balance NUMERIC;
  after_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Wallet debit amount must be greater than zero.'; END IF;
  IF p_reference IS NULL OR btrim(p_reference) = '' THEN RAISE EXCEPTION 'Wallet reference is required.'; END IF;

  SELECT * INTO existing FROM public.customer_wallet_ledger WHERE reference=p_reference;
  IF FOUND THEN
    RETURN jsonb_build_object('already_applied',true,'ledger_id',existing.id,'balance_after',existing.balance_after,'amount',existing.amount);
  END IF;

  w := public.get_or_create_customer_wallet(p_user_id);
  before_balance := w.balance;
  IF before_balance < p_amount THEN RAISE EXCEPTION 'Insufficient Fidelx Wallet balance.'; END IF;
  after_balance := before_balance - p_amount;

  UPDATE public.customer_wallets SET balance=after_balance, updated_at=NOW() WHERE id=w.id;
  INSERT INTO public.customer_wallet_ledger(wallet_id,user_id,amount,balance_before,balance_after,type,reference,order_id,description)
  VALUES(w.id,p_user_id,-p_amount,before_balance,after_balance,'ORDER_PAYMENT',p_reference,p_order_id,p_description);

  RETURN jsonb_build_object('already_applied',false,'balance_after',after_balance,'amount',p_amount);
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO existing FROM public.customer_wallet_ledger WHERE reference=p_reference;
  IF FOUND THEN RETURN jsonb_build_object('already_applied',true,'ledger_id',existing.id,'balance_after',existing.balance_after,'amount',existing.amount); END IF;
  RAISE;
END;
$$;

-- Wrapper keeps wallet debit + order creation + payment row in ONE PostgreSQL transaction.
CREATE OR REPLACE FUNCTION public.create_wallet_order_with_sub_orders(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payload JSONB;
  v_groups JSONB := '[]'::jsonb;
  g JSONB;
  v_order_id UUID := (p_payload->>'order_id')::UUID;
  v_customer_id UUID := (p_payload->>'customer_id')::UUID;
  v_total NUMERIC := (p_payload->>'total')::NUMERIC;
  v_result JSONB;
  v_wallet_result JSONB;
  v_payment_id UUID := gen_random_uuid();
BEGIN
  IF v_order_id IS NULL OR v_customer_id IS NULL OR v_total IS NULL OR v_total <= 0 THEN
    RAISE EXCEPTION 'Invalid wallet order payload.';
  END IF;

  FOR g IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'vendor_groups','[]'::jsonb)) LOOP
    v_groups := v_groups || jsonb_build_array(g || jsonb_build_object('status','PAYMENT_CONFIRMED'));
  END LOOP;

  v_payload := p_payload || jsonb_build_object(
    'status','PAYMENT_CONFIRMED',
    'payment_status','successful',
    'vendor_groups',v_groups
  );

  v_result := public.create_order_with_sub_orders(v_payload);

  v_wallet_result := public.debit_customer_wallet(
    v_customer_id,
    v_total,
    'wallet-order:' || v_order_id::text,
    'Payment for Fidelx order ' || left(v_order_id::text,8),
    v_order_id
  );

  INSERT INTO public.payments(
    id, order_id, amount, status, paystack_reference, idempotency_key,
    gateway_response, payment_method, payment_channel, processing_completed_at
  ) VALUES (
    v_payment_id, v_order_id, v_total, 'successful', NULL,
    'wallet-order:' || v_order_id::text,
    jsonb_build_object('method','fidelx_wallet'), 'fidelx_wallet', 'wallet', NULL
  );

  RETURN v_result || jsonb_build_object('payment_method','fidelx_wallet','payment_id',v_payment_id,'wallet_balance_after',v_wallet_result->'balance_after');
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_customer_wallet(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_customer_wallet(uuid,numeric,text,text,text,uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.debit_customer_wallet(uuid,numeric,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_wallet_order_with_sub_orders(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_customer_wallet(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_customer_wallet(uuid,numeric,text,text,text,uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.debit_customer_wallet(uuid,numeric,text,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_wallet_order_with_sub_orders(jsonb) TO service_role;

-- Extend refund reservation so destination is explicit. Existing callers remain Paystack by default.
CREATE OR REPLACE FUNCTION public.create_refund_reservation(
  p_payment_id UUID,
  p_order_id UUID,
  p_sub_order_id UUID,
  p_customer_id UUID,
  p_requested_amount NUMERIC,
  p_reason TEXT,
  p_evidence_urls TEXT[] DEFAULT '{}',
  p_fault_party TEXT DEFAULT NULL,
  p_refund_type TEXT DEFAULT 'full',
  p_admin_reviewer_id UUID DEFAULT NULL,
  p_refund_stage TEXT DEFAULT 'post_delivery',
  p_idempotency_key TEXT DEFAULT NULL,
  p_refund_destination TEXT DEFAULT 'wallet'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing refunds%ROWTYPE;
  v_payment_amount NUMERIC;
  v_before NUMERIC;
  v_room NUMERIC;
  v_claim NUMERIC;
  v_refund_id UUID;
BEGIN
  IF p_requested_amount IS NULL OR p_requested_amount <= 0 THEN RAISE EXCEPTION 'Refund amount must be greater than zero.'; END IF;
  IF p_refund_destination NOT IN ('wallet','paystack') THEN RAISE EXCEPTION 'Invalid refund destination.'; END IF;

  SELECT amount, total_refunded INTO v_payment_amount, v_before FROM payments WHERE id=p_payment_id FOR UPDATE;
  IF v_payment_amount IS NULL THEN RAISE EXCEPTION 'Payment not found.'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM refunds WHERE idempotency_key=p_idempotency_key LIMIT 1;
    IF v_existing.id IS NOT NULL THEN
      RETURN jsonb_build_object('refund_id',v_existing.id,'amount',v_existing.amount,'already_existed',true);
    END IF;
  END IF;

  v_room := v_payment_amount - COALESCE(v_before,0);
  IF v_room <= 0 THEN RAISE EXCEPTION 'This refund would exceed the amount originally paid — nothing left to refund on this transaction.'; END IF;
  v_claim := LEAST(p_requested_amount,v_room);
  v_refund_id := gen_random_uuid();

  UPDATE payments SET total_refunded=COALESCE(total_refunded,0)+v_claim WHERE id=p_payment_id;

  INSERT INTO refunds(
    id,order_id,sub_order_id,payment_id,customer_id,amount,reason,evidence_urls,fault_party,refund_type,partial_amount,deducted_from,admin_reviewer_id,status,refund_stage,idempotency_key,funding_source
  ) VALUES(
    v_refund_id,p_order_id,p_sub_order_id,p_payment_id,p_customer_id,v_claim,p_reason,COALESCE(p_evidence_urls,'{}'),p_fault_party,p_refund_type,CASE WHEN p_refund_type='partial' THEN v_claim ELSE NULL END,
    CASE p_fault_party WHEN 'vendor' THEN 'vendor_balance' WHEN 'rider' THEN 'rider_balance' WHEN 'platform' THEN 'platform_revenue' ELSE NULL END,
    p_admin_reviewer_id,CASE WHEN p_refund_destination='wallet' THEN 'processed' ELSE 'pending' END,p_refund_stage,p_idempotency_key,
    CASE WHEN p_refund_destination='wallet' THEN 'customer_wallet' ELSE 'customer_funds_held' END
  );

  RETURN jsonb_build_object('refund_id',v_refund_id,'amount',v_claim,'already_existed',false,'destination',p_refund_destination);
END;
$$;

-- Wallet refund finalization. No Paystack call is made; the customer's value moves into the closed-loop wallet.
CREATE OR REPLACE FUNCTION public.apply_wallet_refund_financials(p_refund_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r refunds%ROWTYPE;
  v_wallet JSONB;
  v_responsible_type TEXT;
  v_user_id UUID;
  v_recovered NUMERIC := 0;
BEGIN
  SELECT * INTO r FROM refunds WHERE id=p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund record not found'; END IF;
  IF r.funding_source <> 'customer_wallet' THEN RAISE EXCEPTION 'Refund is not a wallet refund.'; END IF;
  IF r.balance_debited IS TRUE THEN RETURN jsonb_build_object('already_finalized',true,'refund_id',p_refund_id); END IF;

  IF r.fault_party='vendor' THEN
    v_responsible_type := 'vendor';
    SELECT v.user_id INTO v_user_id FROM sub_orders s JOIN vendors v ON v.id=s.vendor_id WHERE s.id=r.sub_order_id;
  ELSIF r.fault_party='rider' THEN
    v_responsible_type := 'rider';
    SELECT rd.user_id INTO v_user_id FROM sub_orders s JOIN riders rd ON rd.id=s.rider_id WHERE s.id=r.sub_order_id;
  END IF;

  v_wallet := public.credit_customer_wallet(r.customer_id,r.amount,'REFUND','refund-wallet:'||r.id::text,'Refund for order '||left(r.order_id::text,8),r.order_id,r.id,NULL);

  IF v_responsible_type IS NOT NULL AND v_user_id IS NOT NULL THEN
    INSERT INTO refund_liabilities(refund_id,responsible_type,responsible_user_id,original_amount)
    VALUES(r.id,v_responsible_type,v_user_id,r.amount)
    ON CONFLICT(refund_id) DO NOTHING;
    v_recovered := recover_refund_liabilities(v_user_id,r.amount);
  END IF;

  INSERT INTO ledger_entries(id,reference,type,amount,fee,net,source,destination,actor_id,description)
  VALUES(gen_random_uuid(),r.id,'REFUND_TO_WALLET',r.amount,0,-r.amount,
    CASE WHEN v_responsible_type IS NULL THEN 'customer_funds_held' ELSE 'refund_fronted' END,
    'customer_wallet',r.admin_reviewer_id,'Customer refund credited to Fidelx Wallet; cost classification: '||COALESCE(v_responsible_type,'platform'))
  ON CONFLICT(reference,type) WHERE reference IS NOT NULL DO NOTHING;

  UPDATE refunds SET balance_debited=TRUE,financial_finalized_at=NOW(),status='processed',processed_at=COALESCE(processed_at,NOW()),paystack_status='not_applicable'
  WHERE id=r.id;

  RETURN jsonb_build_object('already_finalized',false,'refund_id',r.id,'amount',r.amount,'wallet_balance_after',v_wallet->'balance_after','recovered_now',v_recovered);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_wallet_refund_financials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_wallet_refund_financials(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.confirm_customer_wallet_topup(
  p_topup_id UUID,
  p_admin_id UUID,
  p_external_reference TEXT DEFAULT NULL,
  p_payer_name TEXT DEFAULT NULL,
  p_payer_account_number TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.customer_wallet_topups; c JSONB;
BEGIN
  SELECT * INTO t FROM public.customer_wallet_topups WHERE id=p_topup_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet top-up not found.'; END IF;
  IF t.status='CONFIRMED' THEN
    SELECT jsonb_build_object('already_confirmed',true,'wallet_balance',w.balance)
    INTO c FROM public.customer_wallets w WHERE w.id=t.wallet_id;
    RETURN c;
  END IF;
  IF t.status NOT IN ('PENDING','CUSTOMER_MARKED_SENT') THEN RAISE EXCEPTION 'This wallet top-up cannot be confirmed.'; END IF;

  c := public.credit_customer_wallet(
    t.user_id,t.amount,'TOPUP','wallet-topup:'||t.id::text,
    'Wallet top-up via Fidelx PT Account',NULL,NULL,t.id
  );

  UPDATE public.customer_wallet_topups
  SET status='CONFIRMED',confirmed_by=p_admin_id,confirmed_at=NOW(),
      external_reference=COALESCE(p_external_reference,external_reference),
      payer_name=COALESCE(p_payer_name,payer_name),
      payer_account_number=COALESCE(p_payer_account_number,payer_account_number)
  WHERE id=t.id;

  RETURN c || jsonb_build_object('already_confirmed',false,'topup_id',t.id);
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_customer_wallet_topup(uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_customer_wallet_topup(uuid,uuid,text,text,text) TO service_role;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check
CHECK (payment_method IS NULL OR payment_method IN ('paystack_checkout','paystack_transfer','fidelx_wallet'));
