import { verifyAdmin } from "../lib/admin-session.mjs";
import { verifyEmployeeToken } from "./employee-auth.mjs";
const allowedStatuses = new Set(["Available", "Reserved", "Booked", "Sold"]);
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

function config() {
  return {
    pin: process.env.ADMIN_PIN || "",
    url: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
    key: (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "").trim(),
    projectId: String(parseInt(process.env.PROJECT_ID || "1", 10)),
    bookingsTable: process.env.BOOKINGS_TABLE || "bookings",
    employeesTable: process.env.EMPLOYEES_TABLE || "employees",
    plotsTable: process.env.PLOTS_TABLE || "plots",
  };
}

async function db(cfg, method, table, query = "", body) {
  const headers = { apikey: cfg.key, Authorization: "Bearer " + cfg.key, Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers.Prefer = "return=representation";
  }
  try {
    const response = await fetch(cfg.url + "/rest/v1/" + encodeURIComponent(table) + (query ? "?" + query : ""), {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    const raw = await response.text();
    let data = null; try { data = raw ? JSON.parse(raw) : null; } catch {}
    return response.ok ? { ok: true, status: response.status, data } : { ok: false, status: response.status, error: data?.message || data?.details || "Database request failed" };
  } catch (error) {
    return { ok: false, status: 0, error: error?.message || "Network error" };
  }
}

export default async function handler(request) {
  const cfg = config();
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const adminAuthorized = Boolean(cfg.pin) && request.headers.get("x-admin-pin") === cfg.pin && await verifyAdmin(request);
  const employeeClaims = verifyEmployeeToken(request.headers.get("x-employee-token"), process.env.EMPLOYEE_SESSION_SECRET || "");
  if (!adminAuthorized && !employeeClaims) return json({ ok: false, error: "Sign in with an authorized Admin or Employee account." }, 401);
  if (employeeClaims) {
    const employeeQuery = new URLSearchParams({ select: "id,active", id: "eq." + employeeClaims.sub, limit: "1" });
    const employeeCheck = await db(cfg, "GET", cfg.employeesTable, employeeQuery.toString());
    if (!employeeCheck.ok || !employeeCheck.data?.length || employeeCheck.data[0].active === false)
      return json({ ok: false, error: "Employee account is no longer active. Please contact the Admin." }, 401);
  }
  if (!cfg.url || !cfg.key) return json({ ok: false, error: "Plot status updates are not configured on the server." }, 500);

  let body; try { body = await request.json(); } catch { body = null; }
  const requestedProjectId = String(body?.project_id ?? cfg.projectId).trim();
  if (!/^\d+$/.test(requestedProjectId)) return json({ ok: false, error: "A valid project ID is required." }, 422);
  cfg.projectId = requestedProjectId;

  // Safely reopen selected inventory only when the Bookings table has no customer name or phone.
  if (body?.action === "reset-empty-customer-plots") {
    const requestedNumbers = Array.isArray(body.plot_numbers)
      ? [...new Set(body.plot_numbers.map(value => String(value ?? "").trim()).filter(value => /^[A-Za-z0-9-]{1,20}$/.test(value)))]
      : [];
    if (!requestedNumbers.length || requestedNumbers.length > 100)
      return json({ ok: false, error: "Select between 1 and 100 valid plots to reset." }, 422);

    const normalizePlotKey = value => {
      let key = String(value ?? "").trim().toLowerCase().replace(/^plot[\s-]*/, "");
      if (/^\d+$/.test(key)) key = String(Number(key));
      return key;
    };
    const hasCustomerDetails = row => [
      row.customer_name, row.customername, row.customer_full_name, row.name, row.customer,
      row.phone, row.phone_number, row.mobile, row.mobile_number, row.mobile_no, row.mobilenumber,
    ].some(value => String(value ?? "").trim() !== "");

    // Load the project's plot and booking rows once, then match both plot IDs
    // and unit labels. This handles legacy rows that store plot numbers in plot_id.
    const projectFilter = new URLSearchParams({ project_id: "eq." + cfg.projectId, limit: "10000" });
    const [plotLookup, bookingLookup] = await Promise.all([
      db(cfg, "GET", cfg.plotsTable, new URLSearchParams({ select: "*", ...Object.fromEntries(projectFilter) }).toString()),
      db(cfg, "GET", cfg.bookingsTable, new URLSearchParams({ select: "*", ...Object.fromEntries(projectFilter) }).toString()),
    ]);
    if (!plotLookup.ok) return json({ ok: false, error: "Could not load project plots for reset (" + plotLookup.status + ")." }, 502);
    if (!bookingLookup.ok) return json({ ok: false, error: "Could not verify booking customer details (" + bookingLookup.status + ")." }, 502);

    const reset = [];
    const skipped = [];
    for (const number of requestedNumbers) {
      const normalizedNumber = normalizePlotKey(number);
      const matches = (plotLookup.data || []).filter(item =>
        [item.plot_number, item.unit_number, item.plot_no, item.unit_no].some(value => normalizePlotKey(value) === normalizedNumber)
      );
      if (matches.length > 1) {
        skipped.push({ plot_number: number, reason: "More than one inventory record matches this original plot number." });
        continue;
      }
      const plot = matches[0];
      if (!plot) { skipped.push({ plot_number: number, reason: "Plot not found in this project's inventory." }); continue; }

      const current = String(plot.status || "Available").trim();
      if (!["Reserved", "Booked", "Sold"].includes(current)) {
        skipped.push({ plot_number: number, reason: "Current plot status is " + current + "; only Reserved, Booked or Sold plots can be reset." });
        continue;
      }

      const plotIdentifiers = [String(plot.id), String(plot.plot_number ?? ""), String(plot.unit_number ?? ""), String(plot.plot_no ?? "")]
        .filter(value => value !== "");
      const bookingsForPlot = (bookingLookup.data || []).filter(row =>
        [row.plot_id, row.plot_number, row.unit_number, row.plot_no].some(value =>
          plotIdentifiers.includes(String(value ?? "")) ||
          normalizePlotKey(value) === normalizedNumber
        )
      );
      if (bookingsForPlot.some(hasCustomerDetails)) {
        skipped.push({ plot_number: number, reason: "Customer name or phone number exists in the Bookings table." });
        continue;
      }

      const safeFilter = new URLSearchParams({
        project_id: "eq." + cfg.projectId,
        id: "eq." + plot.id,
        status: "eq." + current,
      });
      const updated = await db(cfg, "PATCH", cfg.plotsTable, safeFilter.toString(), { status: "Available" });
      if (!updated.ok) return json({ ok: false, error: "Could not reset plot " + number + " to Available (" + updated.status + ")." }, 502);
      if (!Array.isArray(updated.data) || !updated.data.length) {
        skipped.push({ plot_number: number, reason: "Plot status changed before reset completed. Refresh and try again." });
        continue;
      }
      reset.push(number);
    }
    return json({ ok: true, reset, skipped });
  }

  const plotNumber = String(body?.plot_number ?? "").trim();
  const status = String(body?.status ?? "");
  const bookingId = String(body?.booking_id ?? "").trim();
  if (!/^[A-Za-z0-9-]{1,20}$/.test(plotNumber) || !allowedStatuses.has(status))
    return json({ ok: false, error: "Valid unit number and status are required." }, 422);

  if (["Booked", "Sold"].includes(status) && !/^\d+$/.test(bookingId))
    return json({ ok: false, error: "Select a customer from this unit's Reserved customer list before marking it Booked or Sold." }, 422);

  // The frontend sends the plot's original geometry/inventory number here.
  // Admin Studio display-label edits (for example 145 -> 474) must never
  // change which Supabase inventory row is updated.
  const plotQuery = new URLSearchParams({ select: "*", project_id: "eq." + cfg.projectId, limit: "10000" });
  const plotLookup = await db(cfg, "GET", cfg.plotsTable, plotQuery.toString());
  if (!plotLookup.ok) return json({ ok: false, error: "Could not look up the unit in Supabase." }, 502);
  const normalizePlotKey = value => {
    let key = String(value ?? "").trim().toLowerCase().replace(/^plot[\s-]*/, "");
    if (/^\d+$/.test(key)) key = String(Number(key));
    return key;
  };
  const matchingPlots = (plotLookup.data || []).filter(item =>
    [item.plot_number, item.unit_number, item.plot_no, item.unit_no]
      .some(value => normalizePlotKey(value) === normalizePlotKey(plotNumber))
  );
  if (!matchingPlots.length) return json({ ok: false, error: "No original plot number matched this project inventory." }, 404);
  if (matchingPlots.length > 1) return json({ ok: false, error: "More than one inventory record matches this original plot number. No changes were made." }, 409);
  const plotId = matchingPlots[0].id;
  const currentInventoryStatus = String(matchingPlots[0].status || "Available");
  // Releasing a Booked/Sold plot also updates its active booking row to Available.
  if (["Available", "Reserved"].includes(status) && ["Booked", "Sold"].includes(currentInventoryStatus)) {
    const bookingUpdate = await db(cfg, "PATCH", cfg.bookingsTable,
      new URLSearchParams({
        project_id: "eq." + cfg.projectId,
        plot_id: "eq." + plotId,
        status: "in.(Booked,Sold)",
      }).toString(), { status });
    if (!bookingUpdate.ok)
      return json({ ok: false, error: "Could not update the booking availability to " + status + "." }, 502);
  }

  if (["Booked", "Sold"].includes(status)) {
    // A plot can have multiple Reserved customers, but only one can become
    // Booked/Sold. Reject any further promotion once inventory is closed.
    if (["Booked", "Sold"].includes(currentInventoryStatus)) {
      return json({ ok: false, error: "This plot is already " + currentInventoryStatus + " for another customer. Only one customer can be Booked or Sold for a plot. Other reservations will remain Reserved." }, 409);
    }

    const bookingQuery = new URLSearchParams({
      select: "id,plot_id,status", id: "eq." + bookingId,
      project_id: "eq." + cfg.projectId, plot_id: "eq." + plotId, status: "eq.Reserved",
    });
    const selected = await db(cfg, "GET", cfg.bookingsTable, bookingQuery.toString());
    if (!selected.ok) return json({ ok: false, error: "Could not verify the selected Reserved customer." }, 502);
    if (!Array.isArray(selected.data) || !selected.data.length)
      return json({ ok: false, error: "The selected customer is not Reserved for this unit. Refresh the customer list and try again." }, 422);

    const bookingUpdate = await db(cfg, "PATCH", cfg.bookingsTable,
      new URLSearchParams({ project_id: "eq." + cfg.projectId, plot_id: "eq." + plotId, id: "eq." + bookingId, status: "eq.Reserved" }).toString(), { status });
    if (!bookingUpdate.ok || !Array.isArray(bookingUpdate.data) || !bookingUpdate.data.length)
      return json({ ok: false, error: "Could not update the selected customer's booking status." }, 502);

    // Compare-and-set on the plot row prevents two concurrent requests from
    // promoting two Reserved customers for the same plot.
    const plotUpdate = await db(cfg, "PATCH", cfg.plotsTable,
      new URLSearchParams({
        project_id: "eq." + cfg.projectId,
        id: "eq." + plotId,
        status: "eq." + currentInventoryStatus,
      }).toString(), { status });
    if (!plotUpdate.ok || !Array.isArray(plotUpdate.data) || !plotUpdate.data.length) {
      // The plot was claimed by another request; restore this customer's
      // booking to Reserved so only the successful customer remains Booked/Sold.
      await db(cfg, "PATCH", cfg.bookingsTable,
        new URLSearchParams({ project_id: "eq." + cfg.projectId, plot_id: "eq." + plotId, id: "eq." + bookingId, status: "eq." + status }).toString(),
        { status: "Reserved" });
      if (!plotUpdate.ok) return json({ ok: false, error: "Could not safely claim this plot. Please refresh and try again." }, 502);
      return json({ ok: false, error: "Another customer was just Booked or Sold for this plot. Only one customer can hold this plot; the other reservation remains Reserved." }, 409);
    }
  } else {
    const plotUpdate = await db(cfg, "PATCH", cfg.plotsTable,
      new URLSearchParams({ project_id: "eq." + cfg.projectId, id: "eq." + plotId }).toString(), { status });
    if (!plotUpdate.ok) return json({ ok: false, error: "Could not save unit status to the plot table." }, 502);
  }

  return json({ ok: true, plot_number: plotNumber, plot_id: plotId, booking_id: bookingId || null, status });
}
