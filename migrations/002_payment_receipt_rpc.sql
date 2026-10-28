BEGIN;

CREATE OR REPLACE FUNCTION public.record_payment_receipt(
  p_invoice_id uuid,
  p_amount numeric,
  p_received_on date,
  p_method text,
  p_reference text,
  p_notes text,
  p_idempotency_key text
)
RETURNS public.payments
LANGUAGE plpgsql
AS $$
DECLARE
  invoice public.payments;
  existing_receipt public.payment_transactions;
  new_received numeric(14, 2);
  total_due numeric(14, 2);
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Receipt amount must be greater than zero.';
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'An idempotency key is required.';
  END IF;

  SELECT * INTO invoice
  FROM public.payments
  WHERE id = p_invoice_id AND owner_id = auth.user_id()::uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found.';
  END IF;
  IF invoice.is_demo THEN
    RAISE EXCEPTION 'Demo invoices cannot receive actual payment transactions.';
  END IF;
  IF invoice.status IN ('Draft', 'Cancelled') THEN
    RAISE EXCEPTION 'Draft or cancelled invoices cannot receive payment transactions.';
  END IF;

  SELECT * INTO existing_receipt
  FROM public.payment_transactions
  WHERE owner_id = auth.user_id()::uuid AND seed_key = p_idempotency_key;

  IF FOUND THEN
    IF existing_receipt.invoice_id <> p_invoice_id THEN
      RAISE EXCEPTION 'Idempotency key is already associated with another invoice.';
    END IF;
    RETURN invoice;
  END IF;

  new_received := COALESCE(invoice.amount_received, 0) + p_amount;
  total_due := GREATEST(
    0,
    round(
      COALESCE(invoice.amount, 0) * (1 + COALESCE(invoice.tax_rate, 0) / 100)
      - COALESCE(invoice.discount, 0)
    )
  );

  INSERT INTO public.payment_transactions (
    owner_id, company_id, invoice_id, amount, received_on, method, reference, notes, seed_key
  ) VALUES (
    auth.user_id()::uuid, invoice.company_id, invoice.id, p_amount, p_received_on, p_method,
    p_reference, p_notes, p_idempotency_key
  );

  UPDATE public.payments
  SET amount_received = new_received,
      payment_date = p_received_on,
      method = COALESCE(p_method, method),
      status = CASE WHEN new_received >= total_due THEN 'Paid' ELSE 'Partially Paid' END
  WHERE id = invoice.id
  RETURNING * INTO invoice;

  RETURN invoice;
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment_receipt(uuid, numeric, date, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_receipt(uuid, numeric, date, text, text, text, text) TO authenticated;

INSERT INTO public.app_schema_migrations (version)
VALUES ('002_payment_receipt_rpc')
ON CONFLICT (version) DO NOTHING;

COMMIT;
