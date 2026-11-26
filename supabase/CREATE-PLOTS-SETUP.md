# Create Plots setup

## 1. Supabase

1. Open the Supabase project connected to the Netlify site.
2. Open **SQL Editor**.
3. Run the complete `supabase/create-plots.sql` script from this repository.
4. Confirm that `public.custom_projects` exists and that the private Storage bucket `plot-project-files` exists.

The script creates the custom-project metadata table, a private source-file bucket, the AI-analysis job table, and restricted SQL functions for atomic project creation and deletion. It does not alter the five existing project geometries or their inventory rows. The SQL functions use the existing `public.plots`, `public.bookings`, and `public.map_edits` tables.

## 2. Netlify environment

The Netlify site needs these server-side variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or the existing `SUPABASE_KEY`)
- `ADMIN_PIN`
- `OPENAI_API_KEY`

Optional: `OPENAI_PLOT_MODEL` changes the vision model. The default is `gpt-4.1-mini`.

Optional overrides: `OPENAI_PLOT_MODEL`, `PROJECT_FILES_BUCKET`, `PROJECT_ANALYSIS_JOBS_TABLE`, and `CUSTOM_PROJECTS_TABLE`. After changing environment variables, trigger a new Netlify deploy so Functions receive the current values. Do not put the OpenAI key in a `VITE_*` variable or in browser code.

## 3. Upload limits and review

PDF, PNG, JPG and WEBP source files are limited to 4 MB. The source file is temporarily stored in a private Supabase bucket, then processed by a Netlify Background Function. The browser checks the saved job status until the extracted geometry is ready. Netlify Background Functions must be available for the site's plan (current credit-based plans support them; legacy plans may not). Database project creation and deletion run through SQL transactions: if any inventory or booking operation fails, the database changes roll back together. Source-file cleanup happens after the database transaction; a failed storage cleanup is reported as pending and does not roll back the database transaction.

AI extraction creates a draft from the first PDF page or the uploaded image. Check the plot count, plot labels and boundaries against the original source before creating the project. AI-generated boundaries can be inaccurate and are not a legal survey.

## 4. Project management

Signed-in Admins and active Employees can create, edit or delete custom projects. Employee sessions are validated against the `employees` table and require `EMPLOYEE_SESSION_SECRET` to be configured in Netlify. Public User sessions cannot manage projects. Editing updates the project name, description, location, route and optional source file only. It does not regenerate or overwrite the saved plot geometry. Deleting a custom project requires confirmation and removes its bookings, plot inventory, shared map edits and metadata atomically; the stored source file is removed immediately afterward. If storage cleanup fails, the database deletion remains complete and the file is flagged for cleanup. The five built-in projects are not deletable from this screen.
