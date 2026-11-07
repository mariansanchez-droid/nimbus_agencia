/* ==========================================================

   LIMITACIÓN: gviz no permite listar las hojas automáticamente,
   así que los nombres de las pestañas se escriben a mano en
   CONFIG.HOJAS (deben coincidir EXACTO, mayúsculas/acentos
   incluidos, con el nombre de la pestaña en Google Sheets).

   Columnas esperadas en la fila 1 de cada hoja:
   ID | Producto | Categoría | Descripción | Precio desde | Imagen | Disponible
   ========================================================== */

const CONFIG = {
  SPREADSHEET_ID: "1NnelHeRIGqXtxA6vMqP4pMLNa4h9wMKaGgmVqeB0m1g",
  HOJAS: ["Impresiones y diseño","Personalización"],  // <-- agrega aquí cada pestaña real de tu Sheet
  IMG_BASE_PATH: "Imagenes/",             // carpeta local de imágenes
  REFRESH_MS: 60000,                      // auto-refresco (0 = desactivado)
  CLAVE_CARRITO: "carrito"                // clave de localStorage (la misma que usa carrito.js)
};

const grid = document.querySelector(".productos__grid");
const tabsContainer = document.getElementById("catalogo-tabs");

let hojaActiva = null;
let cache = {};

/* ---------- CARRITO (localStorage) ---------- */

function aNumero(valor) {
  if (typeof valor === "number") return isFinite(valor) ? valor : 0;
  const n = parseFloat(String(valor ?? "").replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
}

function urlImagen(imagen) {
  if (!imagen) return "";
  return /^https?:\/\//.test(imagen) ? imagen : CONFIG.IMG_BASE_PATH + imagen;
}

function leerCarrito() {
  try {
    const datos = JSON.parse(localStorage.getItem(CONFIG.CLAVE_CARRITO));
    return Array.isArray(datos) ? datos : [];
  } catch {
    return [];
  }
}

function agregarAlCarrito(p) {
  const carrito = leerCarrito();
  const existente = carrito.find(
    item => item.producto === p.producto && item.categoria === p.categoria
  );

  if (existente) {
    existente.cantidad = (parseInt(existente.cantidad, 10) || 1) + 1;
  } else {
    carrito.push({
      producto: String(p.producto),
      categoria: String(p.categoria),
      descripcion: String(p.descripcion),
      precio: aNumero(p.precio),
      imagen: urlImagen(p.imagen),
      cantidad: 1
    });
  }

  try {
    localStorage.setItem(CONFIG.CLAVE_CARRITO, JSON.stringify(carrito));
  } catch {
    return false; // almacenamiento no disponible
  }
  return true;
}

/* ---------- CATÁLOGO ---------- */

async function obtenerProductos(hoja) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(hoja)}`;
  const res = await fetch(url);
  const texto = await res.text();

  // La respuesta viene envuelta como: google.visualization.Query.setResponse({...});
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio === -1 || fin === -1) {
    throw new Error(`No se pudo leer la hoja "${hoja}" (¿el Sheet es público y el nombre es exacto?).`);
  }

  let data;
  try {
    data = JSON.parse(texto.slice(inicio, fin + 1));
  } catch {
    throw new Error(`Respuesta inválida al leer la hoja "${hoja}".`);
  }

  const cols = (data.table.cols || []).map(c => (c.label || "").trim().toLowerCase());
  const idx = (nombre) => cols.findIndex(c => c === nombre);
  const col = {
    producto: idx("producto"),
    categoria: idx("categoría"),
    descripcion: idx("descripción"),
    precio: idx("precio desde"),
    imagen: idx("imagen"),
    disponible: idx("disponible")
  };

  const filas = data.table.rows || [];
  const valor = (fila, i) => (i === -1 || !fila.c[i] ? "" : (fila.c[i].v ?? ""));

  return filas
    .filter(fila => {
      if (col.disponible === -1) return true;
      const v = String(valor(fila, col.disponible)).trim().toLowerCase();
      return v === "sí" || v === "si";
    })
    .map(fila => ({
      producto: valor(fila, col.producto),
      categoria: valor(fila, col.categoria),
      descripcion: valor(fila, col.descripcion),
      precio: valor(fila, col.precio),
      imagen: valor(fila, col.imagen)
    }));
}

function crearTarjeta(p) {
  const article = document.createElement("article");
  article.className = "card";

  article.innerHTML = `
    <div class="card__image" aria-label="Imagen de ${p.producto}"></div>
    <div class="card__body">
      <h3 class="card__title"></h3>
      <span class="card__category"></span>
      <p class="card__description"></p>
      <p class="card__price">Desde <strong></strong></p>
      <a href="#" class="card__btn">Agregar al carrito<span class="card__btn-arrow">›</span></a>
    </div>`;

  const img = article.querySelector(".card__image");
  if (p.imagen) {
    img.style.backgroundImage = `url("${urlImagen(p.imagen)}")`;
    img.style.backgroundSize = "cover";
    img.style.backgroundPosition = "center";
  }

  article.querySelector(".card__title").textContent = p.producto;
  article.querySelector(".card__category").textContent = p.categoria;
  article.querySelector(".card__description").textContent = p.descripcion;
  article.querySelector(".card__price strong").textContent = p.precio;

  // Botón: guarda el producto en el carrito (localStorage)
  const btn = article.querySelector(".card__btn");
  const contenidoOriginal = btn.innerHTML;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const ok = agregarAlCarrito(p);
    btn.textContent = ok ? "¡Agregado!" : "No se pudo agregar";
    setTimeout(() => { btn.innerHTML = contenidoOriginal; }, 1200);
  });

  return article;
}

function renderizarProductos(lista) {
  grid.innerHTML = "";
  if (!lista.length) {
    grid.innerHTML = `<p class="catalogo-vacio">No hay productos disponibles en esta categoría.</p>`;
    return;
  }
  lista.forEach(p => grid.appendChild(crearTarjeta(p)));
}

function renderizarTabs() {
  tabsContainer.innerHTML = "";
  CONFIG.HOJAS.forEach(hoja => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-btn" + (hoja === hojaActiva ? " tab-btn--active" : "");
    btn.textContent = hoja;
    btn.addEventListener("click", () => mostrarHoja(hoja));
    tabsContainer.appendChild(btn);
  });
}

async function mostrarHoja(hoja) {
  hojaActiva = hoja;
  renderizarTabs();
  grid.innerHTML = `<p class="catalogo-cargando">Cargando productos...</p>`;
  try {
    if (!cache[hoja]) cache[hoja] = await obtenerProductos(hoja);
    renderizarProductos(cache[hoja]);
  } catch (err) {
    grid.innerHTML = `<p class="catalogo-error">${err.message}</p>`;
  }
}

async function iniciarCatalogo() {
  if (!CONFIG.HOJAS.length) {
    grid.innerHTML = `<p class="catalogo-error">Configura CONFIG.HOJAS con los nombres de tus pestañas.</p>`;
    return;
  }
  await mostrarHoja(CONFIG.HOJAS[0]);
  if (CONFIG.REFRESH_MS > 0) {
    setInterval(() => { cache = {}; mostrarHoja(hojaActiva); }, CONFIG.REFRESH_MS);
  }
}

document.addEventListener("DOMContentLoaded", iniciarCatalogo);