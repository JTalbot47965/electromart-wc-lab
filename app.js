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
  }

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
