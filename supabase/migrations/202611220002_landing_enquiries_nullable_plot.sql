-- Landing-page enquiries are not linked to a specific plot unit.
-- Keep plot_id nullable so these enquiries can live in the existing bookings table
-- without incorrectly assigning an available plot.
ALTER TABLE public.bookings
  ALTER COLUMN plot_id DROP NOT NULL;
