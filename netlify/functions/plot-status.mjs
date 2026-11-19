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

    const reset = [];
    const skipped = [];
    for (const number of requestedNumbers) {
      const plotQuery = new URLSearchParams({
        select: "id,plot_number,status",
        project_id: "eq." + cfg.projectId,
        plot_number: "eq." + number,
        limit: "1",
      });
      const plotLookup = await db(cfg, "GET", cfg.plotsTable, plotQuery.toString());
      if (!plotLookup.ok) return json({ ok: false, error: "Could not verify plot " + number + " in Supabase." }, 502);
      const plot = Array.isArray(plotLookup.data) ? plotLookup.data[0] : null;
      if (!plot) { skipped.push({ plot_number: number, reason: "Plot not found." }); continue; }
      const current = String(plot.status || "Available").trim();
      if (!["Reserved", "Booked", "Sold"].includes(current)) {
        skipped.push({ plot_number: number, reason: "Plot is no longer Reserved, Booked or Sold." });
        continue;
      }

      const bookingQuery = new URLSearchParams({
        select: "id,customer_name,phone",
        project_id: "eq." + cfg.projectId,
        plot_id: "eq." + plot.id,
        limit: "2000",
      });
      const bookingLookup = await db(cfg, "GET", cfg.bookingsTable, bookingQuery.toString());
      if (!bookingLookup.ok) return json({ ok: false, error: "Could not verify customer details for plot " + number + "." }, 502);
      const hasCustomerDetails = (bookingLookup.data || []).some(row =>
        String(row.customer_name ?? "").trim() !== "" || String(row.phone ?? "").trim() !== ""
      );
      if (hasCustomerDetails) {
        skipped.push({ plot_number: number, reason: "Customer name or phone number exists in the Bookings table." });
        continue;
      }

      const safeFilter = new URLSearchParams({
        project_id: "eq." + cfg.projectId,
        id: "eq." + plot.id,
        status: "in.(Reserved,Booked,Sold)",
      });
      const updated = await db(cfg, "PATCH", cfg.plotsTable, safeFilter.toString(), { status: "Available" });
      if (!updated.ok) return json({ ok: false, error: "Could not reset plot " + number + " to Available." }, 502);
      if (!Array.isArray(updated.data) || !updated.data.length) {
        skipped.push({ plot_number: number, reason: "Plot status changed before reset completed." });
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

  const plotQuery = new URLSearchParams({ select: "id,plot_number,status", project_id: "eq." + cfg.projectId, plot_number: "eq." + plotNumber });
  const plotLookup = await db(cfg, "GET", cfg.plotsTable, plotQuery.toString());
  if (!plotLookup.ok) return json({ ok: false, error: "Could not look up the unit in Supabase." }, 502);
  if (!Array.isArray(plotLookup.data) || !plotLookup.data.length) return json({ ok: false, error: "No unit matched this number and project." }, 404);
  const plotId = plotLookup.data[0].id;
  const currentInventoryStatus = String(plotLookup.data[0].status || "Available");
  if (["Booked", "Sold"].includes(currentInventoryStatus) && ["Available", "Reserved"].includes(status))
    return json({ ok: false, error: "This unit is already Booked or Sold. Reopen it from the selected customer's booking in the Bookings page." }, 409);

  if (["Booked", "Sold"].includes(status)) {
    const bookingQuery = new URLSearchParams({
      select: "id,plot_id,status", id: "eq." + bookingId,
      project_id: "eq." + cfg.projectId, plot_id: "eq." + plotId, status: "eq.Reserved",
    });
    const selected = await db(cfg, "GET", cfg.bookingsTable, bookingQuery.toString());
    if (!selected.ok) return json({ ok: false, error: "Could not verify the selected Reserved customer." }, 502);
    if (!Array.isArray(selected.data) || !selected.data.length)
      return json({ ok: false, error: "The selected customer is not Reserved for this unit. Refresh the customer list and try again." }, 422);
    const bookingUpdate = await db(cfg, "PATCH", cfg.bookingsTable,
      new URLSearchParams({ project_id: "eq." + cfg.projectId, plot_id: "eq." + plotId, id: "eq." + bookingId }).toString(), { status });
    if (!bookingUpdate.ok || !Array.isArray(bookingUpdate.data) || !bookingUpdate.data.length)
      return json({ ok: false, error: "Could not update the selected customer's booking status." }, 502);
  }

  const plotUpdate = await db(cfg, "PATCH", cfg.plotsTable,
    new URLSearchParams({ project_id: "eq." + cfg.projectId, id: "eq." + plotId }).toString(), { status });
  if (!plotUpdate.ok) return json({ ok: false, error: "Could not save unit status to the plot table." }, 502);

  return json({ ok: true, plot_number: plotNumber, plot_id: plotId, booking_id: bookingId || null, status });
}
