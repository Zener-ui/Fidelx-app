-- Fidelx customer wallet funding via Paystack Dedicated Virtual Accounts.
-- Safe to run after the original wallet migration.

ALTER TABLE public.customer_wallets
  ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_dva_id BIGINT,
  ADD COLUMN IF NOT EXISTS paystack_dva_account_number TEXT,
  ADD COLUMN IF NOT EXISTS paystack_dva_account_name TEXT,
  ADD COLUMN IF NOT EXISTS paystack_dva_bank_name TEXT,
  ADD COLUMN IF NOT EXISTS paystack_dva_provider_slug TEXT,
  ADD COLUMN IF NOT EXISTS paystack_dva_assigned_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_wallets_paystack_customer_code
  ON public.customer_wallets(paystack_customer_code)
  WHERE paystack_customer_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_wallets_paystack_dva_account_number
  ON public.customer_wallets(paystack_dva_account_number)
  WHERE paystack_dva_account_number IS NOT NULL;

ALTER TABLE public.customer_wallet_topups DROP CONSTRAINT IF EXISTS customer_wallet_topups_method_check;
ALTER TABLE public.customer_wallet_topups ADD CONSTRAINT customer_wallet_topups_method_check
  CHECK (method IN ('pt_account','paystack_dva'));
ALTER TABLE public.customer_wallet_topups DROP CONSTRAINT IF EXISTS customer_wallet_topups_amount_check;
ALTER TABLE public.customer_wallet_topups ADD CONSTRAINT customer_wallet_topups_amount_check CHECK (amount > 0);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_wallet_topups_external_reference
  ON public.customer_wallet_topups(external_reference)
  WHERE external_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.confirm_customer_wallet_topup(
  p_topup_id UUID, p_admin_id UUID, p_external_reference TEXT DEFAULT NULL,
  p_payer_name TEXT DEFAULT NULL, p_payer_account_number TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.customer_wallet_topups; c JSONB;
BEGIN
  SELECT * INTO t FROM public.customer_wallet_topups WHERE id=p_topup_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet top-up not found.'; END IF;
  IF t.status='CONFIRMED' THEN
    SELECT jsonb_build_object('already_confirmed',true,'wallet_balance',w.balance) INTO c
    FROM public.customer_wallets w WHERE w.id=t.wallet_id;
    RETURN c;
  END IF;
  IF t.status NOT IN ('PENDING','CUSTOMER_MARKED_SENT') THEN RAISE EXCEPTION 'This wallet top-up cannot be confirmed.'; END IF;
  c := public.credit_customer_wallet(
    t.user_id,t.amount,'TOPUP','wallet-topup:'||t.id::text,
    CASE WHEN t.method='paystack_dva' THEN 'Wallet top-up via Fidelx Paystack Dedicated Virtual Account' ELSE 'Wallet top-up via Fidelx PT Account' END,
    NULL,NULL,t.id
  );
  UPDATE public.customer_wallet_topups SET status='CONFIRMED',confirmed_by=p_admin_id,confirmed_at=NOW(),
    external_reference=COALESCE(p_external_reference,external_reference),payer_name=COALESCE(p_payer_name,payer_name),payer_account_number=COALESCE(p_payer_account_number,payer_account_number)
  WHERE id=t.id;
  RETURN c || jsonb_build_object('already_confirmed',false,'topup_id',t.id);
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_customer_wallet_topup(uuid,uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_customer_wallet_topup(uuid,uuid,text,text,text) TO service_role;
