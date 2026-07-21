// Draws the pickup -> drop-off journey on a map once the fleet estimator
// has a live route. Exposed as window.GNGFareMap so fleet-estimate.js (and
// anything else that computes a trip) can just call .show()/.hide().
window.GNGFareMap = (() => {
  const container = document.getElementById('fareMap');
  const canvas = document.getElementById('fareMapCanvas');
  if (!container || !canvas || !window.L) return { show() {}, hide() {} };

  const PLUM = '#3b2a63';
  const GOLD = '#d69a3e';

  let map = null;
  let fromMarker = null;
  let toMarker = null;
  let routeCasing = null; // a wider white line under the coloured one, for a "cased road" look
  let routeLine = null;

  const pinIcon = (letter, color) => L.divIcon({
    className: 'fare-map-pin-wrap',
    html: `<span class="fare-map-pin" style="background:${color}">${letter}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

  const ensureMap = () => {
    if (map) return map;
    map = L.map(canvas, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false, // don't hijack page scroll when the cursor passes over the map
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
    return map;
  };

  const show = (from, to, path) => {
    container.hidden = false;
    const m = ensureMap();

    const fromLatLng = [from.lat, from.lon];
    const toLatLng = [to.lat, to.lon];
    // OSRM's GeoJSON geometry is [lon, lat] pairs — Leaflet wants [lat, lon].
    const routeLatLngs = path && path.length
      ? path.map(([lon, lat]) => [lat, lon])
      : [fromLatLng, toLatLng];

    if (fromMarker) fromMarker.setLatLng(fromLatLng);
    else fromMarker = L.marker(fromLatLng, { icon: pinIcon('A', PLUM), zIndexOffset: 10 }).addTo(m);

    if (toMarker) toMarker.setLatLng(toLatLng);
    else toMarker = L.marker(toLatLng, { icon: pinIcon('B', GOLD), zIndexOffset: 10 }).addTo(m);

    if (routeCasing) routeCasing.setLatLngs(routeLatLngs);
    else routeCasing = L.polyline(routeLatLngs, { color: '#ffffff', weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(m);

    if (routeLine) routeLine.setLatLngs(routeLatLngs);
    else routeLine = L.polyline(routeLatLngs, { color: PLUM, weight: 4.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(m);

    // The container was display:none until the line above, so Leaflet
    // measured a zero-size box on first init — it needs a beat to
    // re-measure before fitBounds will produce a sane view.
    requestAnimationFrame(() => {
      m.invalidateSize();
      m.fitBounds(L.latLngBounds(routeLatLngs), { padding: [40, 40], maxZoom: 15 });
    });
  };

  const hide = () => {
    container.hidden = true;
  };

  return { show, hide };
})();
