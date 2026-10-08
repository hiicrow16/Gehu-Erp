// Server-side mirror of the product catalog shown on the frontend.
// Keeping this on the server means order totals are always recalculated
// from trusted prices, not whatever the browser sends.
//
// IMPORTANT: keep this list in sync with STORE_FALLBACK_PRODUCTS in
// Frontend/script.js. If you add/change a product here, update it there too.
//
// Optional fields per product:
//   description  - shown in the product popup (these are simple placeholders: replace with real details)
//   sizes        - array; if present the buyer MUST pick one
//   colors       - array; if present the buyer MUST pick one
//   image        - path relative to the Frontend folder (e.g. "products/blazer.jpg").
//                  If missing, the popup shows the product's emoji instead.

const SIZES_APPAREL = ["S", "M", "L", "XL", "XXL"];

const STORE_CATALOG = [
  { id: "uni-blazer", name: "College Blazer", category: "Dress", price: 1499, stock: 40,
    description: "College blazer for the GEHU uniform. Choose your size.",
    sizes: SIZES_APPAREL },
  { id: "uni-tie", name: "GEHU Tie", category: "Dress", price: 199, stock: 100,
    description: "GEHU tie to go with the college uniform." },
  { id: "uni-shirt", name: "Formal Shirt (White)", category: "Dress", price: 599, stock: 80,
    description: "White formal shirt to go with the college uniform. Choose your size.",
    sizes: SIZES_APPAREL },
  { id: "uni-id", name: "ID Card Lanyard", category: "Dress", price: 99, stock: 200,
    description: "Lanyard for your college ID card." },

  { id: "st-notebook", name: "Ruled Notebook (200pg)", category: "Stationery", price: 60, stock: 300,
    description: "Ruled notebook, 200 pages." },
  { id: "st-fileset", name: "File Folder Set (5pc)", category: "Stationery", price: 150, stock: 120,
    description: "Set of 5 file folders." },
  { id: "st-calc", name: "Scientific Calculator", category: "Stationery", price: 899, stock: 35,
    description: "Scientific calculator." },
  { id: "st-geo", name: "Geometry Box", category: "Stationery", price: 220, stock: 60,
    description: "Geometry box." },

  { id: "pen-blue", name: "Blue Ball Pen (Pack of 5)", category: "Pens", price: 75, stock: 250,
    description: "Pack of 5 blue ball pens." },
  { id: "pen-gel", name: "Premium Gel Pen", category: "Pens", price: 40, stock: 150,
    description: "Premium gel pen." },
  { id: "pen-highlight", name: "Highlighter Set (4 colors)", category: "Pens", price: 130, stock: 90,
    description: "Set of 4 highlighters in different colors." },

  { id: "bk-firstyear", name: "1st Year Core Book Set", category: "Books", price: 2499, stock: 25,
    description: "Core book set for 1st year students." },
  { id: "bk-labmanual", name: "Lab Manual (Semester)", category: "Books", price: 249, stock: 70,
    description: "Lab manual for the semester." },
  { id: "bk-referenceguide", name: "Reference Guide", category: "Books", price: 399, stock: 45,
    description: "Reference guide." },

  { id: "cl-hoodie", name: "GEHU Hoodie", category: "Clothes", price: 999, stock: 50,
    description: "GEHU hoodie. Choose your size and color.",
    sizes: SIZES_APPAREL, colors: ["Black", "Navy", "Grey"] },
  { id: "cl-tshirt", name: "GEHU T-Shirt", category: "Clothes", price: 449, stock: 90,
    description: "GEHU t-shirt. Choose your size and color.",
    sizes: SIZES_APPAREL, colors: ["Black", "White", "Navy"] },
  { id: "cl-cap", name: "Campus Cap", category: "Clothes", price: 249, stock: 65,
    description: "Campus cap. Choose your color.",
    colors: ["Black", "Navy"] },
];

function findProduct(id) {
  return STORE_CATALOG.find((p) => p.id === id);
}

module.exports = { STORE_CATALOG, findProduct };
