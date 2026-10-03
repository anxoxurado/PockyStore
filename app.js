/* =====================================================
   PockyStore - Lógica de la aplicación
   ===================================================== */

const API_URL = 'https://jsonplaceholder.typicode.com/users';

const catalogEl = document.getElementById('catalog');
const messageEl = document.getElementById('message');
const searchEl = document.getElementById('search');
const sourceInfoEl = document.getElementById('source-info');
const statusEl = document.getElementById('connection-status');

let items = [];

/* ---------- 1. Registro del Service Worker ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      console.log('[App] Service Worker registrado. Scope:', registration.scope);
    } catch (error) {
      console.error('[App] Error al registrar el Service Worker:', error);
    }
  });
}

/* ---------- 2. Indicador de conexión ---------- */
function updateConnectionStatus() {
  const online = navigator.onLine;
  statusEl.textContent = online ? 'En línea' : 'Sin conexión';
  statusEl.classList.toggle('status--online', online);
  statusEl.classList.toggle('status--offline', !online);
}
window.addEventListener('online', () => { updateConnectionStatus(); loadCatalog(); });
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();

/* ---------- 3. Consumo de la API con fetch() ---------- */
async function loadCatalog() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const fromCache = response.headers.get('X-Served-By') === 'service-worker-cache';
    items = await response.json();

    sourceInfoEl.textContent = fromCache
      ? `${items.length} registros cargados desde la caché (modo offline)`
      : `${items.length} registros cargados desde la red`;

    messageEl.hidden = true;
    render(items);
  } catch (error) {
    console.error('[App] No se pudo cargar el catálogo:', error);
    catalogEl.setAttribute('aria-busy', 'false');
    catalogEl.innerHTML = '';
    messageEl.hidden = false;
    messageEl.textContent =
      'No hay conexión y aún no existen datos guardados. Abre la app una vez con internet para poder usarla sin conexión.';
  }
}

/* ---------- 4. Renderizado ---------- */
function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function render(list) {
  catalogEl.setAttribute('aria-busy', 'false');

  if (list.length === 0) {
    catalogEl.innerHTML = '';
    messageEl.hidden = false;
    messageEl.textContent = 'No se encontraron resultados.';
    return;
  }
  messageEl.hidden = true;

  catalogEl.innerHTML = list.map((item) => `
    <article class="card">
      <div class="card__avatar" aria-hidden="true">${escapeHTML(initials(item.name))}</div>
      <div class="card__body">
        <span class="card__category">${escapeHTML(item.company.name)}</span>
        <h2 class="card__title">${escapeHTML(item.name)}</h2>
        <p class="card__detail card__detail--first">${escapeHTML(item.email)}</p>
        <p class="card__detail">${escapeHTML(item.address.city)}</p>
        <p class="card__detail">${escapeHTML(item.phone)}</p>
      </div>
    </article>
  `).join('');
}

/* ---------- 5. Búsqueda ---------- */
searchEl.addEventListener('input', () => {
  const term = searchEl.value.trim().toLowerCase();
  const filtered = items.filter((item) =>
    [item.name, item.username, item.company.name, item.address.city]
      .some((field) => field.toLowerCase().includes(term))
  );
  render(filtered);
});

loadCatalog();
