# Create Plots setup

## 1. Supabase

1. Open the Supabase project connected to the Netlify site.
2. Open **SQL Editor**.
3. Run the complete `supabase/create-plots.sql` script from this repository.
4. Confirm that `public.custom_projects` and `public.project_analysis_jobs` exist and that the private Storage bucket `plot-project-files` exists.

The script creates the custom-project metadata table, a private source-file bucket, the AI-analysis job table, and restricted SQL functions for atomic project creation and deletion. It adds prompt and reference-file metadata to background analysis jobs. It does not alter the five existing project geometries or their inventory rows. On creation, the transaction inserts the master row into `public.projects`, the custom metadata into `public.custom_projects`, plot inventory into `public.plots`, and an initial editor document into `public.map_edits`. Deletion removes those custom-project records together.

## 2. Netlify environment

The Netlify site needs these server-side variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or the existing `SUPABASE_KEY`)
- `ADMIN_PIN`
- `ANTHROPIC_API_KEY`
- `EMPLOYEE_SESSION_SECRET` (required only if Employees will use Create Plots)

Required: set `CLAUDE_PLOT_MODEL` to the Anthropic model ID enabled for your API account. The model ID is read only from the Netlify Function environment and is not hard-coded in the repository. The supplied SQL expects the default table and bucket names; do not set `CUSTOM_PROJECTS_TABLE`, `PLOTS_TABLE`, `BOOKINGS_TABLE`, `MAP_EDITS_TABLE`, `PROJECT_ANALYSIS_JOBS_TABLE`, or `PROJECT_FILES_BUCKET` overrides unless the SQL functions are adapted to match. After changing environment variables, trigger a new Netlify deploy so Functions receive the current values. Do not put the Anthropic key in a `VITE_*` variable or in browser code.

## 3. Upload limits and review

PDF, PNG, JPG and WEBP source files are limited to 4 MB. The Prompt box accepts up to 6,000 characters and up to five supplemental PDF/image reference files (4 MB each; 16 MB combined with the main source). The source and reference files are temporarily stored in a private Supabase bucket, then processed by a Netlify Background Function. Claude uses the prompt and reference files while extracting geometry. The project-list thumbnail is rendered from the saved plot geometry, so it stays consistent with the interactive map. The browser checks the saved job status until the extracted geometry is ready. Netlify Background Functions must be available for the site's plan (current credit-based plans support them; legacy plans may not). Database project creation and deletion run through SQL transactions: if the master project, custom metadata, plot inventory, initial map-edits document, or booking operation fails, the database changes roll back together. Source-file cleanup happens after the database transaction; a failed storage cleanup is reported as pending and does not roll back the database transaction.

AI extraction creates a draft from the first PDF page or the uploaded image. Check the plot count, plot labels and boundaries against the original source before creating the project. AI-generated boundaries can be inaccurate and are not a legal survey.

## 4. Project management

Signed-in Admins and active Employees can create, edit or delete custom projects. Employee sessions are validated against the `employees` table and require `EMPLOYEE_SESSION_SECRET` to be configured in Netlify. Public User sessions cannot manage projects. Editing updates the project name, description, location, route and optional source file only. It does not regenerate or overwrite the saved plot geometry. Deleting a custom project requires confirmation and removes its bookings, plot inventory, shared map edits and metadata atomically; the stored source file is removed immediately afterward. If storage cleanup fails, the database deletion remains complete and the file is flagged for cleanup. The five built-in projects are not deletable from this screen.
