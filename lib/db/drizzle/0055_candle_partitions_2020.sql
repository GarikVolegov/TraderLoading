-- Ensure candle monthly partitions from 2020-01-01 through future months
DO $$
DECLARE
	m date := '2020-01-01'::date;
	end_month date := date_trunc('month', now() + interval '24 months')::date;
	part_name text;
BEGIN
	WHILE m < end_month LOOP
		part_name := format('candle_p%s', to_char(m, 'YYYY_MM'));
		EXECUTE format(
			'CREATE TABLE IF NOT EXISTS %I PARTITION OF "candle" FOR VALUES FROM (%s) TO (%s)',
			part_name,
			extract(epoch from m)::bigint,
			extract(epoch from (m + interval '1 month'))::bigint
		);
		m := m + interval '1 month';
	END LOOP;
END $$;
