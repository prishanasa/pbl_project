
-- Fix 1: Add admin write policies for machines table
-- RLS is already enabled, but only SELECT exists. Add INSERT/UPDATE/DELETE for admins.
CREATE POLICY "Admins can insert machines"
ON public.machines FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'::user_role));

CREATE POLICY "Admins can update machines"
ON public.machines FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'::user_role));

CREATE POLICY "Admins can delete machines"
ON public.machines FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'::user_role));

-- Fix 2: Wallet balance - add UPDATE policy and positive balance constraint
CREATE POLICY "Users can update their own wallet"
ON public.user_wallets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.user_wallets ADD CONSTRAINT positive_balance CHECK (balance >= 0);

-- Fix 3: Create atomic wallet update function to prevent race conditions
CREATE OR REPLACE FUNCTION public.add_wallet_funds(p_wallet_id uuid, p_user_id uuid, p_amount numeric, p_description text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric;
BEGIN
  -- Validate input
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  -- Verify ownership
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Atomic balance update
  UPDATE user_wallets
  SET balance = balance + p_amount, updated_at = now()
  WHERE id = p_wallet_id AND user_id = p_user_id
  RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Insert transaction record
  INSERT INTO wallet_transactions (user_id, wallet_id, type, amount, description)
  VALUES (p_user_id, p_wallet_id, 'credit', p_amount, p_description);

  RETURN new_balance;
END;
$$;
