import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. PLACE YOUR FIREBASE CREDENTIALS HERE:
const firebaseConfig = {
  apiKey: "AIzaSyBqxWj0KMKsdQGaInmOi9gMWyVsPucV1Tc",
  authDomain: "toms-warehouse.firebaseapp.com",
  projectId: "toms-warehouse",
  storageBucket: "toms-warehouse.firebasestorage.app",
  messagingSenderId: "250203771527",
  appId: "1:250203771527:web:77e63dd27344130d06de22",
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const inventoryCollection = collection(db, "inventory");

// Global state matrix
let masterInventory = [];
// Track which item ID is currently being edited inline
let editingId = null;

// Sorting state variables
let currentSortKey = null;
let isAscending = true;

// Determine which elements exist on the current active page
const totalProductsEl = document.getElementById("totalProducts");
const totalQtyEl = document.getElementById("totalQty");
const masterInventoryBody = document.getElementById("masterInventoryBody");
const searchBox = document.getElementById("searchBox");
const bulkTemplateBody = document.getElementById("bulkTemplateBody");
const bulkForm = document.getElementById("bulkForm");
const btnAddRow = document.getElementById("btnAddRow");

// Price Calculator specific DOM pointers
const productSelect = document.getElementById("productSelect");
const inputBasePrice = document.getElementById("inputBasePrice");
const itemSpecsBadge = document.getElementById("itemSpecsBadge");
const chkXtra = document.getElementById("chkXtra");
const chkGratisOngkir = document.getElementById("chkGratisOngkir");
const inputPacking = document.getElementById("inputPacking");
const inputProfit = document.getElementById("inputProfit");

const lblGrossPrice = document.getElementById("lblGrossPrice");
const lblPackingCost = document.getElementById("lblPackingCost");
const lblProfitTarget = document.getElementById("lblProfitTarget");
const lblNetCost = document.getElementById("lblNetCost");
const lblAdminFee = document.getElementById("lblAdminFee");
const lblXtraFee = document.getElementById("lblXtraFee");
const lblShippingFee = document.getElementById("lblShippingFee");
const lblProcessFee = document.getElementById("lblProcessFee");
const lblNetIncome = document.getElementById("lblNetIncome");

// REAL-TIME SYNCHRONIZER: Syncs Cloud data updates instantly across all views
onSnapshot(inventoryCollection, (snapshot) => {
  masterInventory = [];
  snapshot.forEach((document) => {
    const data = document.data();
    masterInventory.push({ firestoreId: document.id, ...data });
  });

  // Execute logic based on the page currently loaded
  if (totalProductsEl && totalQtyEl) {
    renderDashboardMetrics();
  }
  if (masterInventoryBody) {
    renderMasterTable(getCurrentDataset());
  }
  if (productSelect) {
    populateProductDropdown();
  }
});

/* =========================================================================
   A. DASHBOARD VIEW CONTROLLER (index.html)
   ========================================================================= */
function renderDashboardMetrics() {
  totalProductsEl.textContent = masterInventory.length;
  const totalVolume = masterInventory.reduce(
    (acc, item) => acc + (item.qty || 0),
    0,
  );
  totalQtyEl.textContent = totalVolume;
}

/* =========================================================================
   B. INTAKE WORKSPACE CONTROLLER (add-products.html)
   ========================================================================= */
if (bulkTemplateBody) {
  // Structural dynamic generator
  window.addNewRow = function () {
    const rowId = "row_" + Date.now() + Math.floor(Math.random() * 100);
    const tr = document.createElement("tr");
    tr.id = rowId;

    tr.innerHTML = `
            <td><input type="text" class="cell-code" placeholder="e.g. ITEM-01"></td>
            <td><input type="text" class="cell-name" required placeholder="Spindle"></td>
            <td><input type="text" class="cell-color" placeholder="e.g. Red"></td>
            <td><input type="text" class="cell-location" placeholder="A-1"></td>
            <td><input type="text" class="cell-brand" placeholder="Generic"></td>
            <td><input type="number" class="cell-length" step="0.1" min="0" placeholder="0"></td>
            <td><input type="number" class="cell-width" step="0.1" min="0" placeholder="0"></td>
            <td><input type="number" class="cell-height" step="0.1" min="0" placeholder="0"></td>
            <td><input type="number" class="cell-mass" step="0.01" min="0" placeholder="0"></td>
            <td><input type="number" class="cell-price" step="1" min="0" placeholder="e.g. 50000"></td>
            <td><input type="number" class="cell-qty" required min="1" value="1"></td>
            <td class="text-center">
                <button type="button" class="btn-del-row" data-rowid="${rowId}">X</button>
            </td>
        `;
    bulkTemplateBody.appendChild(tr);

    // Dynamic event listener attachment for the row removal button
    tr.querySelector(".btn-del-row").addEventListener("click", function () {
      const id = this.getAttribute("data-rowid");
      document.getElementById(id).remove();
      if (bulkTemplateBody.children.length === 0) window.addNewRow();
    });
  };

  // Attach to "+ Add Row" action button
  if (btnAddRow) {
    btnAddRow.addEventListener("click", window.addNewRow);
  }

  // Process staging data arrays during upload actions
  if (bulkForm)
    bulkForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const rows = bulkTemplateBody.querySelectorAll("tr");
      let duplicateVariantFound = false;

      // Verification loop: Allow identical codes, but check for matching code + color duplicates
      for (let row of rows) {
        const code = row.querySelector(".cell-code").value.trim() || "-";
        const color = row.querySelector(".cell-color").value.trim() || "-";

        if (code !== "-") {
          const matchingDoc = masterInventory.find(
            (item) =>
              item.code &&
              item.code.toLowerCase() === code.toLowerCase() &&
              (item.color || "-").toLowerCase() === color.toLowerCase(),
          );
          if (matchingDoc) {
            duplicateVariantFound = `Code: ${code} (${color})`;
            break;
          }
        }
      }

      if (duplicateVariantFound) {
        alert(
          `Error: This specific product color variation already exists in the master database:\n${duplicateVariantFound}`,
        );
        return;
      }

      try {
        for (let row of rows) {
          const item = {
            code: row.querySelector(".cell-code").value.trim() || "-",
            name: row.querySelector(".cell-name").value.trim(),
            color: row.querySelector(".cell-color").value.trim() || "-",
            location: row.querySelector(".cell-location").value.trim() || "-",
            brand: row.querySelector(".cell-brand").value.trim() || "-",
            length: row.querySelector(".cell-length").value
              ? parseFloat(row.querySelector(".cell-length").value)
              : "-",
            width: row.querySelector(".cell-width").value
              ? parseFloat(row.querySelector(".cell-width").value)
              : "-",
            height: row.querySelector(".cell-height").value
              ? parseFloat(row.querySelector(".cell-height").value)
              : "-",
            mass: row.querySelector(".cell-mass").value
              ? parseFloat(row.querySelector(".cell-mass").value)
              : "-",
            price: row.querySelector(".cell-price").value
              ? parseInt(row.querySelector(".cell-price").value)
              : "-",
            qty: parseInt(row.querySelector(".cell-qty").value) || 1,
          };
          await addDoc(inventoryCollection, item);
        }

        bulkTemplateBody.innerHTML = "";
        window.addNewRow();
        alert("Bulk variants upload saved successfully to the cloud!");
      } catch (error) {
        console.error("Error writing batch to cloud: ", error);
        alert("Upload failed. View development console logs.");
      }
    });

  // Populate the first row automatically on screen load
  window.addNewRow();
}

/* =========================================================================
   C. MASTER SEARCH & VIEW CONTROLLER (view-products.html) WITH VARIANT EDIT
   ========================================================================= */
function renderMasterTable(dataset) {
  if (!masterInventoryBody) return;
  masterInventoryBody.innerHTML = "";

  if (dataset.length === 0) {
    masterInventoryBody.innerHTML = `<tr><td colspan="12" class="empty-placeholder">No matching variant records found.</td></tr>`;
    return;
  }

  // Execute sorting if a sort key is selected
  if (currentSortKey) {
    dataset.sort((a, b) => {
      let valA = a[currentSortKey];
      let valB = b[currentSortKey];

      // Standardize empty/dash inputs to effectively drop to the bottom
      if (valA === "-")
        valA =
          currentSortKey === "price" ||
          currentSortKey === "qty" ||
          currentSortKey === "length" ||
          currentSortKey === "width" ||
          currentSortKey === "height" ||
          currentSortKey === "mass"
            ? -1
            : "";
      if (valB === "-")
        valB =
          currentSortKey === "price" ||
          currentSortKey === "qty" ||
          currentSortKey === "length" ||
          currentSortKey === "width" ||
          currentSortKey === "height" ||
          currentSortKey === "mass"
            ? -1
            : "";

      // Perform String comparison or Number calculation based on field types
      if (typeof valA === "string") {
        return isAscending
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return isAscending ? valA - valB : valB - valA;
      }
    });
  }

  dataset.forEach((item) => {
    const tr = document.createElement("tr");
    const isEditing = item.firestoreId === editingId;

    if (isEditing) {
      // --- EDIT MODE LAYOUT ---
      tr.innerHTML = `
        <td><input type="text" id="edit-code-${item.firestoreId}" value="${item.code === "-" ? "" : item.code}" class="edit-cell-text"></td>
        <td><input type="text" id="edit-name-${item.firestoreId}" value="${item.name}" required class="edit-cell-text"></td>
        <td><input type="text" id="edit-color-${item.firestoreId}" value="${(item.color || "-") === "-" ? "" : item.color}" class="edit-cell-text"></td>
        <td><input type="text" id="edit-location-${item.firestoreId}" value="${item.location === "-" ? "" : item.location}" class="edit-cell-text"></td>
        <td><input type="text" id="edit-brand-${item.firestoreId}" value="${item.brand === "-" ? "" : item.brand}" class="edit-cell-text"></td>
        <td><input type="number" step="0.1" id="edit-length-${item.firestoreId}" value="${item.length !== "-" ? item.length : ""}" class="edit-cell-num-sm"></td>
        <td><input type="number" step="0.1" id="edit-width-${item.firestoreId}" value="${item.width !== "-" ? item.width : ""}" class="edit-cell-num-sm"></td>
        <td><input type="number" step="0.1" id="edit-height-${item.firestoreId}" value="${item.height !== "-" ? item.height : ""}" class="edit-cell-num-sm"></td>
        <td><input type="number" step="0.01" id="edit-mass-${item.firestoreId}" value="${item.mass !== "-" ? item.mass : ""}" class="edit-cell-num-sm"></td>
        <td><input type="number" step="1" id="edit-price-${item.firestoreId}" value="${item.price !== "-" && item.price !== undefined ? item.price : ""}" class="edit-cell-num-md"></td>
        <td><input type="number" min="1" id="edit-qty-${item.firestoreId}" value="${item.qty}" class="edit-cell-num-qty"></td>
        <td>
            <button class="btn-save-edit" data-cloudid="${item.firestoreId}">Save</button>
            <button class="btn-cancel-edit">Cancel</button>
        </td>
      `;

      // Event Listeners for Save and Cancel buttons
      tr.querySelector(".btn-save-edit").addEventListener(
        "click",
        async function () {
          const id = this.getAttribute("data-cloudid");
          await saveMasterItemUpdate(id);
        },
      );

      tr.querySelector(".btn-cancel-edit").addEventListener(
        "click",
        function () {
          editingId = null;
          renderMasterTable(getCurrentDataset());
        },
      );
    } else {
      // --- VIEW MODE LAYOUT ---
      tr.innerHTML = `
        <td><strong>${item.code}</strong></td>
        <td>${item.name}</td>
        <td><span class="variant-badge">${item.color || "-"}</span></td>
        <td>${item.location}</td>
        <td>${item.brand}</td>
        <td>${item.length !== "-" ? item.length + " cm" : "-"}</td>
        <td>${item.width !== "-" ? item.width + " cm" : "-"}</td>
        <td>${item.height !== "-" ? item.height + " cm" : "-"}</td>
        <td>${item.mass !== "-" ? item.mass + " g" : "-"}</td>
        <td>${item.price !== "-" && item.price !== undefined ? "Rp " + item.price.toLocaleString("id-ID") : "-"}</td>
        <td><span class="qty-badge">${item.qty}</span></td>
        <td>
            <button class="btn-edit-row" data-cloudid="${item.firestoreId}">Edit</button>
            <button class="btn-del-row btn-wipe" data-cloudid="${item.firestoreId}">Delete</button>
        </td>
      `;

      // Event Listeners for Edit and Delete buttons
      tr.querySelector(".btn-edit-row").addEventListener("click", function () {
        editingId = this.getAttribute("data-cloudid");
        renderMasterTable(getCurrentDataset());
      });

      tr.querySelector(".btn-wipe").addEventListener("click", function () {
        const id = this.getAttribute("data-cloudid");
        wipeMasterItem(id);
      });
    }

    masterInventoryBody.appendChild(tr);
  });
}

// Sub-helper routine to identify whether to render a filtered set or full set
function getCurrentDataset() {
  if (searchBox && searchBox.value.trim() !== "") {
    const query = searchBox.value.toLowerCase();
    return masterInventory.filter(
      (item) =>
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        (item.color || "").toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query) ||
        item.brand.toLowerCase().includes(query),
    );
  }
  return [...masterInventory]; // Return clone to prevent mutation conflicts during sorts
}

// Function handling the Database document update operation
async function saveMasterItemUpdate(firestoreId) {
  const codeVal =
    document.getElementById(`edit-code-${firestoreId}`).value.trim() || "-";
  const nameVal = document
    .getElementById(`edit-name-${firestoreId}`)
    .value.trim();
  const colorVal =
    document.getElementById(`edit-color-${firestoreId}`).value.trim() || "-";
  const locationVal =
    document.getElementById(`edit-location-${firestoreId}`).value.trim() || "-";
  const brandVal =
    document.getElementById(`edit-brand-${firestoreId}`).value.trim() || "-";
  const lengthVal = document.getElementById(`edit-length-${firestoreId}`).value;
  const widthVal = document.getElementById(`edit-width-${firestoreId}`).value;
  const heightVal = document.getElementById(`edit-height-${firestoreId}`).value;
  const massVal = document.getElementById(`edit-mass-${firestoreId}`).value;
  const priceVal = document.getElementById(`edit-price-${firestoreId}`).value;
  const qtyVal = document.getElementById(`edit-qty-${firestoreId}`).value;

  if (!nameVal) {
    alert("Product Name is required!");
    return;
  }

  // Cross-reference checking for duplicate code + color pairs on other documents
  if (codeVal !== "-") {
    const hasDuplicateVariant = masterInventory.some(
      (item) =>
        item.firestoreId !== firestoreId &&
        item.code &&
        item.code.toLowerCase() === codeVal.toLowerCase() &&
        (item.color || "-").toLowerCase() === colorVal.toLowerCase(),
    );
    if (hasDuplicateVariant) {
      alert(
        `Error: A variant with code "${codeVal}" and color "${colorVal}" already exists.`,
      );
      return;
    }
  }

  const updatedItem = {
    code: codeVal,
    name: nameVal,
    color: colorVal,
    location: locationVal || "-",
    brand: brandVal || "-",
    length: lengthVal ? parseFloat(lengthVal) : "-",
    width: widthVal ? parseFloat(widthVal) : "-",
    height: heightVal ? parseFloat(heightVal) : "-",
    mass: massVal ? parseFloat(massVal) : "-",
    price: priceVal ? parseInt(priceVal) : "-",
    qty: parseInt(qtyVal) || 1,
  };

  try {
    const docRef = doc(db, "inventory", firestoreId);
    await updateDoc(docRef, updatedItem);
    editingId = null; // reset edit state mode indicator
    alert("Variant product updated successfully!");
  } catch (error) {
    console.error("Error updating cloud record: ", error);
    alert("Failed to update variant. View console logs.");
  }
}

async function wipeMasterItem(firestoreId) {
  if (confirm("Permanently remove item variation from cloud database?")) {
    try {
      await deleteDoc(doc(db, "inventory", firestoreId));
    } catch (error) {
      console.error("Deletion task execution encountered errors: ", error);
    }
  }
}

// Live lookup filtration execution
function triggerSearchFilter(text) {
  renderMasterTable(getCurrentDataset());
}

if (searchBox) {
  searchBox.addEventListener("input", function (e) {
    triggerSearchFilter(e.target.value);
  });
}

// CLICK HEADER INTERACTION HANDLER FOR COLUMN SORTING
document.querySelectorAll(".master-table th[data-sort]").forEach((header) => {
  header.addEventListener("click", () => {
    const sortKey = header.getAttribute("data-sort");

    if (currentSortKey === sortKey) {
      // Toggle sort directions if clicking the same active header
      isAscending = !isAscending;
    } else {
      // Set sorting to ascending when clicking a new heading
      currentSortKey = sortKey;
      isAscending = true;
    }

    renderMasterTable(getCurrentDataset());
  });
});

/* =========================================================================
   D. MARKETPLACE PRICE CALCULATOR CONTROLLER (price-calculator.html)
   ========================================================================= */
function populateProductDropdown() {
  if (!productSelect) return;

  const currentSelection = productSelect.value;

  productSelect.innerHTML = '<option value="">-- Choose an Item --</option>';
  masterInventory.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.firestoreId;
    option.textContent = `${item.code === "-" ? "" : item.code + " - "}${item.name} (${item.color || "-"})`;
    productSelect.appendChild(option);
  });

  if (currentSelection) {
    productSelect.value = currentSelection;
  }
}

if (productSelect) {
  productSelect.addEventListener("change", function () {
    const selectedItem = masterInventory.find(
      (item) => item.firestoreId === this.value,
    );
    if (selectedItem) {
      inputBasePrice.value =
        selectedItem.price !== "-" ? selectedItem.price : 0;

      const l =
        selectedItem.length !== "-" ? parseFloat(selectedItem.length) : 0;
      const w = selectedItem.width !== "-" ? parseFloat(selectedItem.width) : 0;
      const h =
        selectedItem.height !== "-" ? parseFloat(selectedItem.height) : 0;
      const mass =
        selectedItem.mass !== "-" ? parseFloat(selectedItem.mass) : 0;
      const vol = l * w * h;

      const isSmall = l < 60 && w < 60 && h < 60 && mass < 5000 && vol < 20000;

      itemSpecsBadge.innerHTML = `
        <span class="badge-info">
          Specs: ${l}x${w}x${h} cm | ${vol.toLocaleString("id-ID")} cm³ | ${mass} g &rarr; <strong>Tier: ${isSmall ? "Small Item" : "Big Item"}</strong>
        </span>
      `;
      itemSpecsBadge.dataset.tier = isSmall ? "small" : "big";
    } else {
      itemSpecsBadge.innerHTML = "";
      itemSpecsBadge.dataset.tier = "";
      inputBasePrice.value = "";
    }
    calculateShopeeFees();
  });

  [inputBasePrice, chkXtra, chkGratisOngkir, inputPacking, inputProfit].forEach(
    (element) => {
      if (element) {
        element.addEventListener("input", calculateShopeeFees);
        element.addEventListener("change", calculateShopeeFees);
      }
    },
  );

  function calculateShopeeFees() {
    const basePrice = parseInt(inputBasePrice.value) || 0;
    const packingCost = parseInt(inputPacking.value) || 0;
    const profitTarget = parseInt(inputProfit.value) || 0;
    const tier = itemSpecsBadge.dataset.tier || "small";

    // Target cash value we need out of this transaction
    const netCostBeforeFees = basePrice + packingCost + profitTarget;

    if (netCostBeforeFees === 0) {
      resetOutputs();
      return;
    }

    // 1. Establish basic fee percentage structures
    const adminRate = 0.095; // 9.5%
    const xtraRate = chkXtra && chkXtra.checked ? 0.045 : 0; // 4.5%
    const shippingRate =
      chkGratisOngkir && chkGratisOngkir.checked
        ? tier === "small"
          ? 0.08
          : 0.095
        : 0;
    const flatProcessFee = 1250;

    const totalPercentageRates = adminRate + xtraRate + shippingRate;

    // 2. Initial Reverse Calculation Estimate (Assuming caps aren't hit yet)
    let listingPrice = Math.round(
      (netCostBeforeFees + flatProcessFee) / (1 - totalPercentageRates),
    );

    // 3. Exact Cap-Validation Pass
    // Because caps decrease the actual rate cut at high values, check for cap overflows
    let adminFee = Math.round(listingPrice * adminRate);
    let xtraFee =
      chkXtra && chkXtra.checked
        ? Math.min(Math.round(listingPrice * xtraRate), 60000)
        : 0;

    let shippingFee = 0;
    if (chkGratisOngkir && chkGratisOngkir.checked) {
      const maxShippingCap = tier === "small" ? 40000 : 60000;
      shippingFee = Math.min(
        Math.round(listingPrice * shippingRate),
        maxShippingCap,
      );
    }

    // If caps are hit, recalculate with the static capped cash values
    const totalVariableFees = adminFee + xtraFee + shippingFee;
    const actualCalculatedListingPrice =
      netCostBeforeFees + totalVariableFees + flatProcessFee;

    // Use optimized targeted pricing value
    listingPrice = actualCalculatedListingPrice;

    // Re-verify exact breakdown based on finalized reverse targeted price
    adminFee = Math.round(listingPrice * adminRate);
    if (chkXtra && chkXtra.checked)
      xtraFee = Math.min(Math.round(listingPrice * xtraRate), 60000);
    if (chkGratisOngkir && chkGratisOngkir.checked) {
      const maxShippingCap = tier === "small" ? 40000 : 60000;
      shippingFee = Math.min(
        Math.round(listingPrice * shippingRate),
        maxShippingCap,
      );
    }

    // Render numbers to layout metrics
    const documentSet = {
      lblGrossPrice: basePrice,
      lblPackingCost: packingCost,
      lblProfitTarget: profitTarget,
      lblNetCost: netCostBeforeFees,
      lblAdminFee: adminFee,
      lblXtraFee: xtraFee,
      lblShippingFee: shippingFee,
      lblProcessFee: flatProcessFee,
      lblNetIncome: listingPrice,
    };

    Object.keys(documentSet).forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        let prefix = "Rp ";
        if (
          id === "lblAdminFee" ||
          id === "lblXtraFee" ||
          id === "lblShippingFee" ||
          id === "lblProcessFee"
        )
          prefix = "+Rp ";
        element.textContent = prefix + documentSet[id].toLocaleString("id-ID");
      }
    });
  }

  function resetOutputs() {
    [
      "lblGrossPrice",
      "lblPackingCost",
      "lblProfitTarget",
      "lblNetCost",
      "lblAdminFee",
      "lblXtraFee",
      "lblShippingFee",
      "lblProcessFee",
      "lblNetIncome",
    ].forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = "Rp 0";
    });
  }
}

/* =========================================================================
   E. CSV IMPORT & EXPORT CONTROLLER (Integrates into view-products.html)
   ========================================================================= */
const btnExportCSV = document.getElementById("btnExportCSV");
const btnImportCSV = document.getElementById("btnImportCSV");

// 1. CSV EXPORT LOGIC
if (btnExportCSV) {
  btnExportCSV.addEventListener("click", () => {
    if (masterInventory.length === 0) {
      alert("No data records available in the database to export.");
      return;
    }

    const headers = [
      "code",
      "name",
      "color",
      "location",
      "brand",
      "length",
      "width",
      "height",
      "mass",
      "price",
      "qty",
    ];
    const csvRows = [headers.join(",")];

    for (const item of masterInventory) {
      const values = headers.map((header) => {
        const val = item[header] === undefined ? "-" : item[header];
        // Escape quotes to maintain proper CSV structure
        const escaped = ("" + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    }

    const blob = new Blob([csvRows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_matrix_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// 2. CSV IMPORT LOGIC (Parses lines and validates entries safely)
if (btnImportCSV) {
  btnImportCSV.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (progressEvent) {
      const text = progressEvent.target.result;
      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) {
        alert("The chosen CSV file has no valid rows.");
        return;
      }

      // Read standardized headers automatically
      const headers = lines[0]
        .split(",")
        .map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());

      let importCount = 0;
      let duplicateCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Secure parsing of cells handling double quote structures
        const columns = [];
        let textBuffer = "";
        let inQuotes = false;
        for (let char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            columns.push(textBuffer.trim());
            textBuffer = "";
          } else {
            textBuffer += char;
          }
        }
        columns.push(textBuffer.trim());

        // Extract key payload data mappings
        const rowData = {};
        headers.forEach((header, index) => {
          let val = columns[index] !== undefined ? columns[index] : "-";
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1).replace(/""/g, '"');
          }
          rowData[header] = val;
        });

        if (!rowData.name) continue;

        // Sanitize field data types
        const item = {
          code: rowData.code || "-",
          name: rowData.name,
          color: rowData.color || "-",
          location: rowData.location || "-",
          brand: rowData.brand || "-",
          length:
            rowData.length && rowData.length !== "-"
              ? parseFloat(rowData.length)
              : "-",
          width:
            rowData.width && rowData.width !== "-"
              ? parseFloat(rowData.width)
              : "-",
          height:
            rowData.height && rowData.height !== "-"
              ? parseFloat(rowData.height)
              : "-",
          mass:
            rowData.mass && rowData.mass !== "-"
              ? parseFloat(rowData.mass)
              : "-",
          price:
            rowData.price && rowData.price !== "-"
              ? parseInt(rowData.price)
              : "-",
          qty: parseInt(rowData.qty) || 1,
        };

        // Enforce variation duplication checks (Code + Color matching matrix)
        if (item.code !== "-") {
          const isDuplicate = masterInventory.some(
            (existing) =>
              existing.code &&
              existing.code.toLowerCase() === item.code.toLowerCase() &&
              (existing.color || "-").toLowerCase() ===
                item.color.toLowerCase(),
          );
          if (isDuplicate) {
            duplicateCount++;
            continue;
          }
        }

        try {
          // Commit records into Firestore live references
          await addDoc(inventoryCollection, item);
          importCount++;
        } catch (err) {
          console.error("Row import fault: ", err);
        }
      }

      alert(
        `CSV Processing Completed!\n\nImported: ${importCount} elements saved.\nSkipped Duplicates: ${duplicateCount} variations.`,
      );
      btnImportCSV.value = ""; // Clear chosen selector
    };

    reader.readAsText(file);
  });
}
