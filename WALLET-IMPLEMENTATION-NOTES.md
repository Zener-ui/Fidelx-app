# Fidelx Wallet — DVA funding implementation

## Production flow

Customer opens Fidelx Wallet and taps **Get my funding account**.

1. Fidelx creates/reuses the Paystack customer record.
2. Fidelx requests a Paystack Dedicated Virtual Account using Paystack-Titan.
3. The account number is stored against that customer's Fidelx wallet.
4. Customer transfers money from any Nigerian bank to that personal account.
5. Paystack sends the signed `charge.success` webhook for the transfer.
6. Fidelx identifies the wallet by the dedicated receiver account/customer code.
7. Fidelx creates an idempotent top-up record and calls `confirm_customer_wallet_topup`.
8. The existing immutable wallet ledger credits the exact amount once.

No amount-based matching is used. A duplicate Paystack webhook cannot create a second wallet credit because the Paystack reference and wallet ledger reference are unique.

## Important

- The shared Fidelx PT Account is retained only for the legacy/manual funding path. It is **not** used for automatic customer identification.
- Customer-facing wallet funding now uses Paystack DVA.
- Paystack documents DVA transfers as customer-linked transactions and sends `charge.success` webhooks; delayed notifications can be re-queried.
- The Paystack secret remains server-side in `PAYSTACK_SECRET_KEY`.
- The customer wallet remains a closed-loop Fidelx liability and is not withdrawable.
- Paystack checkout remains available as the fallback order payment method.

## Deployment requirement

The backend must be deployed with the existing production `PAYSTACK_SECRET_KEY` and the existing Paystack webhook URL must continue pointing to:

`POST /api/payments/webhook`

No Paystack secret is stored in the frontend.

## Testing checklist

1. Create a test Fidelx customer.
2. Tap **Get my funding account**.
3. Confirm a Paystack-Titan DVA is returned and stored.
4. Transfer test funds to that DVA.
5. Confirm Paystack sends `charge.success`.
6. Confirm exactly one `customer_wallet_topups` row is created.
7. Confirm exactly one `customer_wallet_ledger` TOPUP row is created.
8. Replay the same webhook and confirm the wallet balance does not increase again.
9. Test a normal Paystack order payment and confirm it still follows the existing order-payment path.
10. Test a wallet refund and confirm it remains completely independent of Paystack refunds.
