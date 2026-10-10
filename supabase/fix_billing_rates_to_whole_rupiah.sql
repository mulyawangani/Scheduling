-- Rates in billing_rates are stored in THOUSANDS of rupiah (350 means Rp 350.000), while every other amount
-- in the app (a child's rate_per_session, extracurricular prices, payments) is whole rupiah. Every screen that
-- shows a rate from this table (the rate table, the Owner dashboard Billing box, a teacher's Commissions tab,
-- Billing > Therapy) therefore reads 1,000 times too small.
--
-- This multiplies every billing rate and commission by 1,000, once. It refuses to run, and changes nothing,
-- if any rate is already 10,000 or more (which would mean it has already been run, or the table is mixed).
-- Unpaid therapy payment rows refresh themselves the next time Billing > Therapy opens; a payment row that is
-- already marked paid keeps its old amounts and would need correcting by hand.
--
-- After it has run, rates are typed in whole rupiah (350000), not in thousands.
-- Run it once.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM billing_rates WHERE billing_rate >= 10000 OR commission_rate >= 10000) THEN
    RAISE EXCEPTION 'Some rates are already 10,000 or more: nothing was changed. Check the table before running this again.';
  END IF;

  UPDATE billing_rates
  SET billing_rate = billing_rate * 1000,
      commission_rate = commission_rate * 1000;
END
$$;
