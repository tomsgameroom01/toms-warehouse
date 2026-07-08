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
            <td style="text-align: center;">
                <button type="button" class="btn-del-row" data-rowid="${rowId}">✕</button>
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
    masterInventoryBody.innerHTML = `<tr><td colspan="12" style="text-align:center; color:#7f8c8d; font-style:italic; padding: 20px;">No matching variant records found.</td></tr>`;
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
        <td><input type="text" id="edit-code-${item.firestoreId}" value="${item.code === "-" ? "" : item.code}" style="width:100%; padding:5px; border:1px solid #cbd5e1; border-radius:4px;"></td>
        <td><input type="text" id="edit-name-${item.firestoreId}" value="${item.name}" required style="width:100%; padding:5px; border:1px solid #cbd5e1; border-radius:4px;"></td>
        <td><input type="text" id="edit-color-${item.firestoreId}" value="${(item.color || "-") === "-" ? "" : item.color}" style="width:100%; padding:5px; border:1px solid #cbd5e1; border-radius:4px;"></td>
        <td><input type="text" id="edit-location-${item.firestoreId}" value="${item.location === "-" ? "" : item.location}" style="width:100%; padding:5px; border:1px solid #cbd5e1; border-radius:4px;"></td>
        <td><input type="text" id="edit-brand-${item.firestoreId}" value="${item.brand === "-" ? "" : item.brand}" style="width:100%; padding:5px; border:1px solid #cbd5e1; border-radius:4px;"></td>
        <td><input type="number" step="0.1" id="edit-length-${item.firestoreId}" value="${item.length !== "-" ? item.length : ""}" style="width:65px; padding:5px; border:1px solid #cbd5e1; border-radius:4px;"></td>
        <td><input type="number" step="0.1" id="edit-width-${item.firestoreId}" value="${item.width !== "-" ? item.width : ""}" style="width:65px; padding:5px; border:1px solid #cbd5e1; border-radius:4px;"></td>
        <td><input type="number" step="0.1" id="edit-height-${item.firestoreId}" value="${item.height !== "-" ? item.height : ""}" style="width:65px; padding:5px; border:1px solid #cbd5e1; border-radius:4px;"></td>
        <td><input type="number" step="0.01" id="edit-mass-${item.firestoreId}" value="${item.mass !== "-" ? item.mass : ""}" style="width:65px; padding:5px; border:1px solid #cbd5e1; border-radius:4px;"></td>
        <td><input type="number" step="1" id="edit-price-${item.firestoreId}" value="${item.price !== "-" && item.price !== undefined ? item.price : ""}" style="width:85px; padding:5px; border:1px solid #cbd5e1; border-radius:4px;"></td>
        <td><input type="number" min="1" id="edit-qty-${item.firestoreId}" value="${item.qty}" style="width:60px; padding:5px; border:1px solid #cbd5e1; border-radius:4px;"></td>
        <td>
            <button class="btn-save-edit" data-cloudid="${item.firestoreId}" style="background:var(--secondary-color); color:white; padding:4px 8px; margin-right:4px;">Save</button>
            <button class="btn-cancel-edit" style="background:#7f8c8d; color:white; padding:4px 8px;">Cancel</button>
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
        <td><span style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:0.9rem;">${item.color || "-"}</span></td>
        <td>${item.location}</td>
        <td>${item.brand}</td>
        <td>${item.length !== "-" ? item.length + " cm" : "-"}</td>
        <td>${item.width !== "-" ? item.width + " cm" : "-"}</td>
        <td>${item.height !== "-" ? item.height + " cm" : "-"}</td>
        <td>${item.mass !== "-" ? item.mass + " g" : "-"}</td>
        <td>${item.price !== "-" && item.price !== undefined ? "Rp " + item.price.toLocaleString("id-ID") : "-"}</td>
        <td><span class="qty-badge">${item.qty}</span></td>
        <td>
            <button class="btn-edit-row" data-cloudid="${item.firestoreId}" style="background:var(--accent-color); color:white; padding:4px 8px; margin-right:4px;">Edit</button>
            <button class="btn-del-row btn-wipe" data-cloudid="${item.firestoreId}" style="padding:4px 8px;">Delete</button>
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
