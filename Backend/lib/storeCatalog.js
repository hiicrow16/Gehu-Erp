// Server-side mirror of the product catalog shown on the frontend.
// Keeping this on the server means order totals are always recalculated
// from trusted prices, not whatever the browser sends.
//
// IMPORTANT: keep this list in sync with the PRODUCTS array in
// Frontend/script.js (the storeCatalog section). If you add/change a
// product on the frontend, update it here too.

const STORE_CATALOG = [
  { id: "uni-blazer",       name: "College Blazer",              category: "Dress",      price: 1499, stock: 40 },
  { id: "uni-tie",          name: "GEHU Tie",                    category: "Dress",      price: 199,  stock: 100 },
  { id: "uni-shirt",        name: "Formal Shirt (White)",        category: "Dress",      price: 599,  stock: 80 },
  { id: "uni-id",           name: "ID Card Lanyard",             category: "Dress",      price: 99,   stock: 200 },

  { id: "st-notebook",      name: "Ruled Notebook (200pg)",      category: "Stationery", price: 60,   stock: 300 },
  { id: "st-fileset",       name: "File Folder Set (5pc)",       category: "Stationery", price: 150,  stock: 120 },
  { id: "st-calc",          name: "Scientific Calculator",       category: "Stationery", price: 899,  stock: 35 },
  { id: "st-geo",           name: "Geometry Box",                category: "Stationery", price: 220,  stock: 60 },

  { id: "pen-blue",         name: "Blue Ball Pen (Pack of 5)",   category: "Pens",       price: 75,   stock: 250 },
  { id: "pen-gel",          name: "Premium Gel Pen",             category: "Pens",       price: 40,   stock: 150 },
  { id: "pen-highlight",    name: "Highlighter Set (4 colors)",  category: "Pens",       price: 130,  stock: 90 },

  { id: "bk-firstyear",     name: "1st Year Core Book Set",      category: "Books",      price: 2499, stock: 25 },
  { id: "bk-labmanual",     name: "Lab Manual (Semester)",       category: "Books",      price: 249,  stock: 70 },
  { id: "bk-referenceguide", name: "Reference Guide",            category: "Books",      price: 399,  stock: 45 },

  { id: "cl-hoodie",        name: "GEHU Hoodie",                 category: "Clothes",    price: 999,  stock: 50 },
  { id: "cl-tshirt",        name: "GEHU T-Shirt",                category: "Clothes",    price: 449,  stock: 90 },
  { id: "cl-cap",           name: "Campus Cap",                  category: "Clothes",    price: 249,  stock: 65 },
];

function findProduct(id) {
  return STORE_CATALOG.find((p) => p.id === id);
}

module.exports = { STORE_CATALOG, findProduct };
