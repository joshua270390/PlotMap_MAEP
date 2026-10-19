# Velavan Nagar plot map (React + Vite, deploys on Vercel)

- `src/` React app (map, enquiry form). `src/data.js` plot/road data, `src/config.js` company, phone, rate.
- `api/enquiry.js` saves an enquiry (looks up `plots.id` from the plot number, then inserts into `bookings`).
- `api/plots.js` returns live plot status so Booked/Sold show on the map for every visitor.

## Deploy
1. Push to GitHub, then Vercel > Add New > Project > import. Preset is detected as **Vite**.
2. Environment Variables: `SUPABASE_URL`, `SUPABASE_KEY` (anon key), `PROJECT_ID=1`, `DEBUG=false`. Redeploy after changing them.

## Local
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `SUPABASE_URL`, `SUPABASE_KEY`, `PROJECT_ID` (restart after editing).
3. `npm run dev`. A small dev shim (`dev-api.js`) serves `/api/enquiry` and `/api/plots` locally. `npx vercel dev` also works.

## If the form shows HTTP 404
The `/api` route is missing where the page is running. On Vercel, open `https://YOUR-SITE/api/plots` in the browser. It must return JSON (`{"ok":true,...}`). A 404 page means Vercel did not deploy the `api/` folder: the project **Root Directory** (Settings > General) must be the folder that contains `api/`, `src/` and `package.json`, not its parent.

## Notes
- Admin panel (button at the bottom of the map, PIN in `src/config.js`, default 1234): edit plot number, area and number position, add/edit/delete dimension labels, set the rate, export/import/reset. These edits are saved **in that browser only** (same as the old version); use Export/Import to move them. Plot status is not edited here: it comes from the Supabase `plots` table (Available / Booked / Sold) and the map updates within about a minute.
- The enquiry sends the plot number shown on the map, so a renamed plot must have the same `plot_number` in the database.
- Price rows are hidden while `RATE` in `src/config.js` is 0.
- Enquiry protection: same-site check, honeypot, validation, best-effort rate limit per instance. Errors are in Vercel > Logs.

## Source structure

The React source is organized by responsibility while preserving the existing app entry points and runtime behavior:

```text
src/
  App.jsx                    # Plot-map app composition and top-level UI state
  main.jsx                   # Existing route/entry selection
  shared/
    config.js                # Company/project display configuration
  features/
    plots/
      data.js                # Plot, road and dimension data
      plotUtils.js           # Plot status, geometry and formatting helpers
      Modals.jsx             # Plot details, booking enquiry and status dialogs
    map/
      PlotMap.jsx             # Interactive SVG map and map interactions
    admin/
      AdminPanel.jsx          # Admin editing UI
      adminData.js            # Admin state persistence and map editing operations
    dashboard/
      Dashboard.jsx           # Dashboard, booking list and plot-list UI
      Dashboard.css           # Dashboard-specific styles
  style.css                  # Shared map/global styles

Legacy module files in `src/` remain as thin re-exports during the transition, so older imports continue to resolve.
