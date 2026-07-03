const seatCost = 48;
const totalSeats = 500;
const accounts = [
  { id: "u-101", name: "Ariana Miles", email: "ariana.miles@acme.test", team: "Marketing", role: "Designer", lastLoginDays: 92, cost: 48, manager: "N. Patel" },
  { id: "u-102", name: "Bennett Cole", email: "bennett.cole@acme.test", team: "Sales", role: "AE", lastLoginDays: 7, cost: 48, manager: "D. Park" },
  { id: "u-103", name: "Carmen Diaz", email: "carmen.diaz@acme.test", team: "Product", role: "PM", lastLoginDays: 66, cost: 48, manager: "M. Brooks" },
  { id: "u-104", name: "Devon Shah", email: "devon.shah@acme.test", team: "Engineering", role: "Engineer", lastLoginDays: 123, cost: 96, manager: "S. Lin" },
  { id: "u-105", name: "Elliot Warren", email: "elliot.warren@acme.test", team: "Finance", role: "Analyst", lastLoginDays: 44, cost: 48, manager: "L. Chen" },
  { id: "u-106", name: "Fatima Noor", email: "fatima.noor@acme.test", team: "Design", role: "Lead", lastLoginDays: 18, cost: 96, manager: "A. Miles" },
  { id: "u-107", name: "Gavin Price", email: "gavin.price@acme.test", team: "Support", role: "Specialist", lastLoginDays: 71, cost: 48, manager: "R. Kim" },
  { id: "u-108", name: "Hana Rossi", email: "hana.rossi@acme.test", team: "People", role: "Recruiter", lastLoginDays: 154, cost: 48, manager: "J. Stone" },
  { id: "u-109", name: "Isaac Stone", email: "isaac.stone@acme.test", team: "Legal", role: "Counsel", lastLoginDays: 31, cost: 48, manager: "T. Reed" },
  { id: "u-110", name: "Jules Kim", email: "jules.kim@acme.test", team: "IT", role: "Admin", lastLoginDays: 2, cost: 96, manager: "C. Diaz" }
];

let selected = new Set();
let currentFilter = "all";
let audit = [
  ["Today", "Okta login data synced for DesignPro."],
  ["Yesterday", "3 inactive users moved to manager review."],
  ["Jun 23", "Policy threshold changed from 75 to 60 days."]
];

const table = document.getElementById("account-table");
const search = document.getElementById("account-search");
const threshold = document.getElementById("threshold-range");
const tabs = document.getElementById("status-tabs");

if (!table || !search || !threshold || !tabs) {
  throw new Error("LicenseGuard required UI elements are missing.");
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function isZombie(account) {
  return account.cost >= seatCost && account.lastLoginDays >= Number(threshold.value);
}

function riskFor(account) {
  if (account.cost === 0) return ["Reclaimed", "bg-slate-100 text-slate-600"];
  if (account.plan === "Downgraded") return ["Downgraded", "bg-blue-50 text-blue-700"];
  if (account.lastLoginDays >= 120) return ["Critical", "bg-rose-50 text-rose-700"];
  if (isZombie(account)) return ["Zombie", "bg-amber-50 text-amber-700"];
  return ["Active", "bg-emerald-50 text-emerald-700"];
}

function visibleAccounts() {
  const query = search.value.trim().toLowerCase();
  return accounts.filter(account => {
    const matchesQuery = `${account.name} ${account.email} ${account.team} ${account.role}`.toLowerCase().includes(query);
    const zombie = isZombie(account);
    const matchesFilter = currentFilter === "all"
      || (currentFilter === "zombie" && zombie)
      || (currentFilter === "active" && !zombie)
      || (currentFilter === "high-cost" && account.cost > seatCost);
    return matchesQuery && matchesFilter;
  });
}

function updateMetrics() {
  const zombies = accounts.filter(isZombie);
  const monthlyWaste = zombies.reduce((sum, account) => sum + account.cost, 0);
  const coverage = Math.round((zombies.length / accounts.length) * 100);
  const confidence = Number(threshold.value) <= 45 ? 68 : Number(threshold.value) >= 90 ? 91 : 82;

  document.getElementById("metric-zombies").textContent = zombies.length;
  document.getElementById("metric-threshold-copy").textContent = `No login in ${threshold.value} days`;
  document.getElementById("metric-waste").textContent = formatMoney(monthlyWaste);
  document.getElementById("metric-annual").textContent = formatMoney(monthlyWaste * 12);
  document.getElementById("threshold-label").textContent = `${threshold.value} days`;
  document.getElementById("coverage-label").textContent = `${coverage}%`;
  document.getElementById("coverage-bar").style.width = `${Math.max(5, coverage)}%`;
  document.getElementById("confidence-label").textContent = confidence >= 85 ? "Very high" : confidence >= 75 ? "High" : "Review";
  document.getElementById("confidence-bar").style.width = `${confidence}%`;
}

function updateSelectionControls() {
  const selectedCount = selected.size;
  document.getElementById("selected-copy").textContent = `${selectedCount} account${selectedCount === 1 ? "" : "s"} selected`;
  document.getElementById("bulk-reclaim").disabled = selectedCount === 0;
  document.getElementById("downgrade-selected").disabled = selectedCount === 0;
  const visible = visibleAccounts();
  document.getElementById("select-all").checked = visible.length > 0 && visible.every(account => selected.has(account.id));
}

function renderTable() {
  const rows = visibleAccounts();
  updateMetrics();

  if (!rows.length) {
    table.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-10 text-center">
          <i class="fas fa-circle-check text-3xl text-emerald-500"></i>
          <p class="mt-3 text-sm font-black text-slate-600">No matching accounts.</p>
        </td>
      </tr>
    `;
    updateSelectionControls();
    return;
  }

  table.innerHTML = rows.map(account => {
    const [risk, riskClass] = riskFor(account);
    const zombie = isZombie(account);
    return `
      <tr class="account-row text-sm">
        <td class="px-4 py-3">
          <input type="checkbox" class="row-check h-4 w-4 rounded border-slate-300 accent-teal-700" data-id="${account.id}" ${selected.has(account.id) ? "checked" : ""}>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-black text-slate-700">${account.name.split(" ").map(part => part[0]).join("")}</span>
            <span class="min-w-0">
              <span class="block truncate font-black text-slate-950">${account.name}</span>
              <span class="block truncate text-xs font-semibold text-slate-500">${account.email}</span>
            </span>
          </div>
        </td>
        <td class="px-4 py-3">
          <span class="font-black text-slate-700">${account.team}</span>
          <span class="block text-xs font-semibold text-slate-500">${account.plan || account.role}</span>
        </td>
        <td class="px-4 py-3 font-semibold text-slate-600">${account.lastLoginDays} days ago</td>
        <td class="px-4 py-3 font-black text-slate-950">${formatMoney(account.cost)}/mo</td>
        <td class="px-4 py-3">
          <span class="inline-flex rounded-lg px-2.5 py-1 text-xs font-black ${riskClass}">${risk}</span>
        </td>
        <td class="px-4 py-3 text-right">
          <button type="button" data-action="${zombie ? "reclaim" : "notify"}" data-id="${account.id}" title="${zombie ? "Reclaim license" : "Notify manager"}" class="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-teal-300 hover:text-teal-700 ${account.cost === 0 ? "opacity-60" : ""}" ${account.cost === 0 ? "disabled" : ""}>
            <i class="fas ${zombie ? "fa-user-minus" : "fa-envelope"}"></i>
            ${zombie ? "Reclaim" : "Notify"}
          </button>
        </td>
      </tr>
    `;
  }).join("");

  updateSelectionControls();
}

function renderAudit() {
  document.getElementById("audit-list").innerHTML = audit.slice(0, 5).map(([time, text]) => `
    <div class="border-l-2 border-slate-200 pl-3">
      <p class="text-xs font-black uppercase text-slate-400">${time}</p>
      <p class="mt-1 text-sm font-semibold leading-6 text-slate-600">${text}</p>
    </div>
  `).join("");
}

function showToast(message) {
  const root = document.getElementById("toast-root");
  const toast = document.createElement("div");
  toast.className = "rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-2xl";
  toast.textContent = message;
  root.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function applyAction(ids, action) {
  if (!ids.length) return;
  ids.forEach(id => {
    const account = accounts.find(item => item.id === id);
    if (!account) return;
    if (action === "reclaim") {
      account.cost = 0;
      account.plan = "Reclaimed";
    }
    if (action === "downgrade") {
      account.cost = Math.min(account.cost, 12);
      account.plan = "Downgraded";
    }
  });
  const label = action === "downgrade" ? "Downgraded" : action === "notify" ? "Notified managers for" : "Reclaimed";
  audit.unshift(["Just now", `${label} ${ids.length} account${ids.length === 1 ? "" : "s"} using ${document.getElementById("default-action").value} policy.`]);
  selected = new Set([...selected].filter(id => !ids.includes(id)));
  renderAudit();
  renderTable();
  showToast(`${label} ${ids.length} account${ids.length === 1 ? "" : "s"}`);
}

table.addEventListener("change", event => {
  const checkbox = event.target.closest(".row-check");
  if (!checkbox) return;
  checkbox.checked ? selected.add(checkbox.dataset.id) : selected.delete(checkbox.dataset.id);
  updateSelectionControls();
});

table.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  applyAction([button.dataset.id], button.dataset.action);
});

document.getElementById("select-all").addEventListener("change", event => {
  const rows = visibleAccounts();
  rows.forEach(account => {
    event.target.checked ? selected.add(account.id) : selected.delete(account.id);
  });
  renderTable();
});

document.getElementById("bulk-reclaim").addEventListener("click", () => {
  applyAction([...selected], "reclaim");
});

document.getElementById("downgrade-selected").addEventListener("click", () => {
  applyAction([...selected], "downgrade");
});

document.getElementById("sync-button").addEventListener("click", () => {
  document.getElementById("last-sync").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  audit.unshift(["Just now", "SSO login activity refreshed from Okta."]);
  renderAudit();
  showToast("SSO sync complete");
});

document.getElementById("automation-toggle").addEventListener("click", event => {
  const next = event.currentTarget.dataset.on !== "true";
  event.currentTarget.dataset.on = String(next);
  event.currentTarget.setAttribute("aria-pressed", String(next));
  document.getElementById("automation-copy").textContent = next
    ? "Eligible zombie accounts are reclaimed after manager notice."
    : "Zombie accounts are queued for manual approval.";
});

tabs.addEventListener("click", event => {
  const tab = event.target.closest("[data-filter]");
  if (!tab) return;
  currentFilter = tab.dataset.filter;
  tabs.querySelectorAll("[data-filter]").forEach(button => {
    button.setAttribute("aria-pressed", String(button === tab));
  });
  renderTable();
});

search.addEventListener("input", renderTable);
threshold.addEventListener("input", () => {
  selected.clear();
  renderTable();
});

renderAudit();
renderTable();
