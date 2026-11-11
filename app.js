// app.js: loads the CSV files and fills in the page.
// The finance math lives in ccc.js (window.CCC).

(function () {
  "use strict";

  var dollars = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0, minimumFractionDigits: 0
  });

  function days(n) { return n.toFixed(2); }

  function signedDays(n) {
    var r = Number(n.toFixed(2));
    return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r).toFixed(2);
  }

  function money(n) {
    var r = Math.round(n);
    return r < 0 ? "−" + dollars.format(-r) : dollars.format(r);
  }

  function row(cells, headerFirst) {
    var tr = document.createElement("tr");
    cells.forEach(function (text, i) {
      var cell = document.createElement(i === 0 && headerFirst ? "th" : "td");
      if (i === 0 && headerFirst) cell.scope = "row";
      cell.textContent = text;
      tr.appendChild(cell);
    });
    return tr;
  }

  function loadCSV(path) {
    return fetch(path, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("Could not load " + path + " (" + res.status + ")");
      return res.text();
    }).then(CCC.parseCSV);
  }

  function render(statements, assumptions) {
    var year = assumptions.days_in_year;
    var b = CCC.cycle(statements.before, year);
    var a = CCC.cycle(statements.after, year);

    document.getElementById("year-note").textContent =
      "Uses a " + year + "-day year from assumptions.csv.";

    var daysBody = document.querySelector("#days-table tbody");
    daysBody.innerHTML = "";
    [
      ["DIO (days of inventory)", "dio"],
      ["DSO (days to collect)", "dso"],
      ["DPO (days to pay)", "dpo"],
      ["Cash conversion cycle", "ccc"]
    ].forEach(function (m) {
      var tr = row([m[0], days(b[m[1]]), days(a[m[1]]), signedDays(a[m[1]] - b[m[1]])], true);
      if (m[1] === "ccc") tr.className = "total";
      daysBody.appendChild(tr);
    });

    var freed = CCC.cashFreed(statements.before, statements.after);
    var cashBody = document.querySelector("#cash-table tbody");
    cashBody.innerHTML = "";
    [
      ["Inventory", "inventory", "inventory"],
      ["Receivables", "accounts_receivable", "receivables"],
      ["Payables", "accounts_payable", "payables"]
    ].forEach(function (l) {
      cashBody.appendChild(row([
        l[0],
        money(statements.before[l[1]]),
        money(statements.after[l[1]]),
        money(freed[l[2]])
      ], true));
    });
    var total = row(["Total", "", "", money(freed.total)], true);
    total.className = "total";
    cashBody.appendChild(total);

    setupLevers(statements, assumptions, b, a);
  }

  // ---------- Levers ----------

  var LEVERS = ["dio", "dso", "dpo"];
  var state = null; // { statements, assumptions, before, after }

  function percent(rate) { return (rate * 100).toFixed(2) + "%"; }

  function el(id) { return document.getElementById(id); }

  // A slider range that comfortably covers both periods' days.
  function sliderMax(x, y) {
    return Math.max(60, Math.ceil(Math.max(x, y) * 1.5 / 10) * 10);
  }

  function setupLevers(statements, assumptions, before, after) {
    state = { statements: statements, assumptions: assumptions, before: before, after: after };
    LEVERS.forEach(function (k) {
      el(k + "-range").max = sliderMax(before[k], after[k]);
    });
    el("net-hint").textContent = "due in " + assumptions.net_days + " days (net " + assumptions.net_days + ")";
    var d = assumptions.supplier_discount;
    el("terms-hint").textContent = "terms " + Number((d * 100).toFixed(2)) + "/" +
      assumptions.discount_days + ", net " + assumptions.net_days;
    el("lever-ccc-before").textContent = "Before: " + days(before.ccc) + " days";
    setDays(before);
  }

  // Put exact day counts into the sliders and boxes, then recalculate.
  function setDays(source) {
    LEVERS.forEach(function (k) {
      var range = el(k + "-range");
      if (source[k] > Number(range.max)) range.max = Math.ceil(source[k]);
      range.value = source[k];
      el(k + "-num").value = source[k];
    });
    update(source);
  }

  function currentDays() {
    var out = {};
    LEVERS.forEach(function (k) { out[k] = Number(el(k + "-num").value) || 0; });
    return out;
  }

  function update(chosen) {
    if (!state) return;
    var s = CCC.leverScenario(state.statements.before, chosen, state.assumptions);

    el("lever-ccc").textContent = days(s.ccc) + " days";

    var body = document.querySelector("#lever-table tbody");
    body.innerHTML = "";
    [
      ["Inventory", "inventory"],
      ["Receivables", "receivables"],
      ["Payables", "payables"]
    ].forEach(function (r) {
      body.appendChild(row([r[0], money(s.balances[r[1]]), money(s.cashFreed[r[1]])], true));
    });
    var total = row(["Total", "", money(s.cashFreed.total)], true);
    total.className = "total";
    body.appendChild(total);

    el("lever-interest").textContent = s.interestSaved < 0
      ? money(s.interestSaved) + " (extra interest)"
      : money(s.interestSaved);
    el("lever-late").textContent = days(s.daysPastDue) + " days";
    el("lever-discount").textContent = s.skipDiscountCost === null
      ? "None: takes the discount"
      : percent(s.skipDiscountCost);
  }

  LEVERS.forEach(function (k) {
    el(k + "-range").addEventListener("input", function () {
      el(k + "-num").value = Number(this.value);
      update(currentDays());
    });
    el(k + "-num").addEventListener("input", function () {
      var v = Number(this.value);
      if (!isFinite(v) || this.value === "") return;
      var range = el(k + "-range");
      if (v > Number(range.max)) range.max = Math.ceil(v);
      range.value = v;
      update(currentDays());
    });
  });
  el("set-before").addEventListener("click", function () { if (state) setDays(state.before); });
  el("set-after").addEventListener("click", function () { if (state) setDays(state.after); });

  Promise.all([loadCSV("data/electromart.csv"), loadCSV("data/assumptions.csv")])
    .then(function (results) {
      render(CCC.readStatements(results[0]), CCC.readAssumptions(results[1]));
      document.getElementById("status").hidden = true;
    })
    .catch(function (err) {
      var s = document.getElementById("status");
      s.textContent = "Couldn't load the data: " + err.message;
      s.className = "status error";
    });
})();
