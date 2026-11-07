/* =========================================================
   Nimbus Agencia Creativa - Lógica del carrito
   Lee los productos guardados en localStorage, los pinta en
   la página, permite cambiar cantidades / eliminar / vaciar
   y calcula el total del "Resumen de compra".

   Formato esperado en localStorage (clave "carrito"):
   [
     {
       "producto": "Papel picado",
       "categoria": "Decoración",
       "descripcion": "Diseños personalizados para eventos...",
       "precio": 150,
       "imagen": "img/papel-picado.png",
       "cantidad": 1
     }
   ]
   Se aceptan también los nombres: nombre/titulo, categoría,
   descripción, precioDesde, img, qty. Si no hay "cantidad", se asume 1.
   ========================================================= */

(function () {
  'use strict';

  // ---------- Configuración ----------
  var CLAVE_CARRITO = 'carrito';   // Cambia aquí si usas otra clave en tu menú
  var PAGINA_MENU = 'menu.html';

  // ---------- Referencias al DOM ----------
  var contenido = document.getElementById('carrito-contenido');
  var vacio = document.getElementById('carrito-vacio');
  var lista = document.getElementById('cart-items');
  var totalEl = document.getElementById('summary-total');
  var conteoEl = document.getElementById('summary-count');
  var btnVaciar = document.getElementById('btn-vaciar');
  var btnCheckout = document.getElementById('btn-checkout');

  // ---------- Utilidades ----------
  var formatoMoneda = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  });

  function aNumero(valor) {
    if (typeof valor === 'number') return isFinite(valor) ? valor : 0;
    var n = parseFloat(String(valor == null ? '' : valor).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : 0;
  }

  function normalizar(item) {
    if (!item || typeof item !== 'object') return null;
    var nombre = item.producto || item.nombre || item.titulo || '';
    if (!nombre) return null;

    var cantidad = Math.floor(aNumero(item.cantidad != null ? item.cantidad : item.qty));
    return {
      producto: String(nombre),
      categoria: String(item.categoria || item['categoría'] || ''),
      descripcion: String(item.descripcion || item['descripción'] || ''),
      precio: aNumero(item.precio != null ? item.precio : item.precioDesde),
      imagen: String(item.imagen || item.img || ''),
      cantidad: cantidad > 0 ? cantidad : 1
    };
  }

  function leerCarrito() {
    try {
      var crudo = localStorage.getItem(CLAVE_CARRITO);
      if (!crudo) return [];
      var datos = JSON.parse(crudo);
      if (datos && !Array.isArray(datos) && Array.isArray(datos.productos)) {
        datos = datos.productos;
      }
      if (!Array.isArray(datos)) return [];
      return datos.map(normalizar).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function guardarCarrito(carrito) {
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
    } catch (e) { /* almacenamiento no disponible */ }
  }

  // Crea un elemento con clase y texto (textContent evita inyección de HTML)
  function el(etiqueta, clase, texto) {
    var nodo = document.createElement(etiqueta);
    if (clase) nodo.className = clase;
    if (texto != null) nodo.textContent = texto;
    return nodo;
  }

  var ICONO_BASURA =
    '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M5 7h14M10 7V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2m-9 0 1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- Construcción de una fila ----------
  function crearFila(item, indice, esUltima) {
    var fila = el('div', 'cart-row' + (esUltima ? ' cart-row--last' : ''));
    fila.setAttribute('data-index', indice);

    // Producto (imagen + info)
    var producto = el('div', 'cart-row__product');
    if (item.imagen) {
      var contImg = el('div', 'cart-row__image');
      var img = document.createElement('img');
      img.src = item.imagen;
      img.alt = item.producto;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;';
      contImg.appendChild(img);
      producto.appendChild(contImg);
    } else {
      var ph = el('div', 'cart-row__image');
      ph.setAttribute('aria-label', 'Sin imagen para ' + item.producto);
      producto.appendChild(ph);
    }

    var info = el('div', 'cart-row__info');
    info.appendChild(el('h3', 'cart-row__title', item.producto));
    if (item.categoria) info.appendChild(el('span', 'cart-row__category', item.categoria));
    if (item.descripcion) info.appendChild(el('p', 'cart-row__description', item.descripcion));
    producto.appendChild(info);
    fila.appendChild(producto);

    // Cantidad + eliminar
    var cant = el('div', 'cart-row__qty');
    var control = el('div', 'qty-control');

    var menos = el('button', 'qty-control__btn', '−');
    menos.type = 'button';
    menos.setAttribute('data-accion', 'menos');
    menos.setAttribute('aria-label', 'Disminuir cantidad');

    var valor = el('span', 'qty-control__value', String(item.cantidad));

    var mas = el('button', 'qty-control__btn', '+');
    mas.type = 'button';
    mas.setAttribute('data-accion', 'mas');
    mas.setAttribute('aria-label', 'Aumentar cantidad');

    control.appendChild(menos);
    control.appendChild(valor);
    control.appendChild(mas);
    cant.appendChild(control);

    var borrar = el('button', 'cart-row__delete');
    borrar.type = 'button';
    borrar.setAttribute('data-accion', 'eliminar');
    borrar.setAttribute('aria-label', 'Eliminar ' + item.producto);
    borrar.innerHTML = ICONO_BASURA; // contenido fijo, sin datos del usuario
    cant.appendChild(borrar);
    fila.appendChild(cant);

    // Precio y total
    var precio = el('span', 'cart-row__price', formatoMoneda.format(item.precio));
    precio.setAttribute('data-label', 'Precio');
    var total = el('span', 'cart-row__total', formatoMoneda.format(item.precio * item.cantidad));
    total.setAttribute('data-label', 'Total');
    fila.appendChild(precio);
    fila.appendChild(total);

    return fila;
  }

  // ---------- Render general ----------
  function render() {
    var carrito = leerCarrito();

    if (carrito.length === 0) {
      contenido.hidden = true;
      vacio.hidden = false;
      return;
    }

    vacio.hidden = true;
    contenido.hidden = false;

    lista.innerHTML = '';
    var suma = 0;
    var unidades = 0;

    carrito.forEach(function (item, i) {
      lista.appendChild(crearFila(item, i, i === carrito.length - 1));
      suma += item.precio * item.cantidad;
      unidades += item.cantidad;
    });

    totalEl.textContent = formatoMoneda.format(suma);
    conteoEl.textContent = '(' + unidades + (unidades === 1 ? ' producto)' : ' productos)');
  }

  // ---------- Eventos ----------
  lista.addEventListener('click', function (e) {
    var boton = e.target.closest('[data-accion]');
    if (!boton) return;
    var fila = boton.closest('.cart-row');
    var indice = parseInt(fila.getAttribute('data-index'), 10);
    var carrito = leerCarrito();
    if (!carrito[indice]) return;

    var accion = boton.getAttribute('data-accion');
    if (accion === 'mas') {
      carrito[indice].cantidad += 1;
    } else if (accion === 'menos') {
      carrito[indice].cantidad = Math.max(1, carrito[indice].cantidad - 1);
    } else if (accion === 'eliminar') {
      carrito.splice(indice, 1);
    }

    guardarCarrito(carrito);
    render();
  });

  btnVaciar.addEventListener('click', function () {
    if (window.confirm('¿Seguro que quieres vaciar tu carrito?')) {
      guardarCarrito([]);
      render();
    }
  });

  // Si el carrito cambia en otra pestaña, se actualiza aquí
  window.addEventListener('storage', function (e) {
    if (e.key === CLAVE_CARRITO) render();
  });

  // Enlaces de regreso al menú
  Array.prototype.forEach.call(document.querySelectorAll('[data-ir-menu]'), function (a) {
    a.setAttribute('href', PAGINA_PRODUCTOS);
  });

  render();
})();
