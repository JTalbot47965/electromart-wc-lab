// ccc.js: the finance math for the ElectroMart CCC app.
// These are plain functions. They never touch the page, so they can be
// checked with Node, for example:
//   node -e "const c=require('./ccc.js'); console.log(c.dio(1200000, 6000000, 365))"

(function (root) {
  "use strict";

  // ---------- Reading the CSV files ----------

  // Turn CSV text into an array of row objects keyed by the header row.
  // The lab's files are simple (no quoted commas), so a split is enough.
  function parseCSV(text) {
    var lines = String(text).replace(/\r/g, "").split("\n").filter(function (l) {
      return l.trim() !== "";
    });
    if (lines.length === 0) return [];
    var headers = lines[0].split(",").map(function (h) { return h.trim(); });
    return lines.slice(1).map(function (line) {
      var cells = line.split(",");
      var row = {};
      headers.forEach(function (h, i) { row[h] = (cells[i] || "").trim(); });
      return row;
    });
  }

  // Statements file -> { before: {...}, after: {...}, sections: {...} }
  // Each period holds every item as a number, e.g. before.inventory.
  function readStatements(rows) {
    var out = { before: {}, after: {}, sections: {} };
    rows.forEach(function (r) {
      out.before[r.item] = Number(r.before);
      out.after[r.item] = Number(r.after);
      out.sections[r.item] = r.section;
    });
    return out;
  }

  // Assumptions file -> { days_in_year: 365, bank_rate: 0.08, ... }
  function readAssumptions(rows) {
    var out = {};
    rows.forEach(function (r) { out[r.assumption] = Number(r.value); });
    return out;
  }

  // ---------- Day counts ----------

  // Days of inventory outstanding: how long goods sit before they are sold.
  function dio(inventory, cogs, daysInYear) {
    return inventory / cogs * daysInYear;
  }

  // Days sales outstanding: how long customers take to pay (all sales on credit).
  function dso(receivables, revenue, daysInYear) {
    return receivables / revenue * daysInYear;
  }

  // Days payables outstanding: how long ElectroMart takes to pay suppliers
  // (purchases are assumed to equal COGS).
  function dpo(payables, cogs, daysInYear) {
    return payables / cogs * daysInYear;
  }

  // Cash conversion cycle: days a dollar is tied up in operations.
  function ccc(dioDays, dsoDays, dpoDays) {
    return dioDays + dsoDays - dpoDays;
  }

  // All four day counts for one period's statements.
  function cycle(period, daysInYear) {
    var i = dio(period.inventory, period.cogs, daysInYear);
    var s = dso(period.accounts_receivable, period.revenue, daysInYear);
    var p = dpo(period.accounts_payable, period.cogs, daysInYear);
    return { dio: i, dso: s, dpo: p, ccc: ccc(i, s, p) };
  }

  // ---------- Cash freed ----------

  // Cash freed comes from the balance sheet change between Before and After.
  // A drop in an asset frees cash; a rise in accounts payable frees cash.
  function cashFreed(before, after) {
    var inventory = before.inventory - after.inventory;
    var receivables = before.accounts_receivable - after.accounts_receivable;
    var payables = after.accounts_payable - before.accounts_payable;
    return {
      inventory: inventory,
      receivables: receivables,
      payables: payables,
      total: inventory + receivables + payables
    };
  }

  // The same thing worked out from the days: days changed x annual flow / days in year.
  // Used as a cross-check against the balance sheet version above.
  function cashFreedFromDays(daysBefore, daysAfter, annualFlow, daysInYear) {
    return (daysBefore - daysAfter) * annualFlow / daysInYear;
  }

  var api = {
    parseCSV: parseCSV,
    readStatements: readStatements,
    readAssumptions: readAssumptions,
    dio: dio,
    dso: dso,
    dpo: dpo,
    ccc: ccc,
    cycle: cycle,
    cashFreed: cashFreed,
    cashFreedFromDays: cashFreedFromDays
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;   // Node
  } else {
    root.CCC = api;         // Browser
  }
})(this);
