
-- Create a secure RPC function for starting laundry orders
-- This allows non-admin users to atomically create an order AND update machine status
CREATE OR REPLACE FUNCTION public.start_laundry_order(p_machine_id text, p_service_type text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_machine_status text;
  v_order_id uuid;
BEGIN
  -- Validate machine exists and is available (lock row to prevent race)
  SELECT status INTO v_machine_status
  FROM machines
  WHERE id = p_machine_id
  FOR UPDATE;

  IF v_machine_status IS NULL THEN
    RAISE EXCEPTION 'Machine not found';
  END IF;

  IF v_machine_status != 'Available' THEN
    RAISE EXCEPTION 'Machine is currently %', v_machine_status;
  END IF;

  -- Create laundry order
  INSERT INTO laundry_orders (user_id, machine_id, machine_type, service_type, status, estimated_completion)
  SELECT
    auth.uid(),
    p_machine_id,
    m.type::machine_type,
    p_service_type,
    'washing',
    now() + interval '45 minutes'
  FROM machines m
  WHERE m.id = p_machine_id
  RETURNING id INTO v_order_id;

  -- Update machine status
  UPDATE machines
  SET status = 'In Use', current_order_id = v_order_id
  WHERE id = p_machine_id;

  RETURN v_order_id;
END;
$$;
