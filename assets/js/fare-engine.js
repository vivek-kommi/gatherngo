// Shared fare-calculation engine backing the hero quote card's fleet
// estimator (assets/js/fleet-estimate.js).
window.GNGFare = (() => {
  // Mileage/time/airport/extras are identical for every vehicle — only the
  // large-vehicle surcharge and minimum fare differ, per the brief.
  const VEHICLES = [
    { id: 'five', name: '5 Seater', tag: '', passengers: 4, largeVehicle: false, minimumFare: 32,
      luggage: [{ cases: 3, bags: 2 }], maxItems: 5 },
    { id: 'nine', name: '9 Seater', tag: 'Minibus', passengers: 8, largeVehicle: true, minimumFare: 48,
      luggage: [{ cases: 6, bags: 4 }, { cases: 6, bags: 2 }, { cases: 4, bags: 4 }], maxItems: 10 },
  ];

  // 2026 England & Wales bank holidays. A short, honest list rather than a
  // full calendar library — good enough for a live estimate, and the small
  // print already says a driver confirms the final price.
  const BANK_HOLIDAYS_2026 = ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28'];

  const money = (n) => `£${n.toFixed(0)}`;

  const findAirport = (address) => {
    const airports = window.GNG_AIRPORTS || [];
    const norm = address.trim().toLowerCase();
    return airports.find(a => norm === a.value.toLowerCase())
      || airports.find(a => norm.startsWith(a.label.toLowerCase()))
      || null;
  };

  // No end-of-string anchor — a reverse-geocoded "current location" address
  // (e.g. "...CB2 3HH, United Kingdom") has trailing text after the
  // postcode, and would otherwise never match.
  const extractPostcode = (address) => {
    const m = address.match(/[A-Za-z]{1,2}[0-9][A-Za-z0-9]?\s?[0-9][A-Za-z]{2}\b/);
    return m ? m[0] : null;
  };

  // Rough fallback for when there's no postcode to go on at all — a plain
  // place name like "Cambourne" or "Caxton". Nominatim's free-text search
  // gives back a village/town-centre point, which is imprecise but good
  // enough for a live mileage-based estimate; the driver confirms the exact
  // pickup point before travel regardless.
  const geocodeRough = async (address) => {
    const res = await fetch('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
      q: address, format: 'jsonv2', countrycodes: 'gb', limit: '1',
    }), { headers: { 'Accept-Language': 'en-GB' } });
    const list = await res.json();
    const hit = list && list[0];
    if (!hit) throw new Error(`Couldn't find "${address}" — try adding a postcode or nearby town.`);
    return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), charge: 0, label: address, isAirport: false };
  };

  // Resolves an address to {lat, lon, charge, label, isAirport}. Airports
  // resolve instantly from the shared dataset; a postcode (if present)
  // geocodes exactly via postcodes.io; anything else — a rough place name
  // with no postcode — still gets a best-effort rough pinpoint instead of
  // failing outright, so the estimate still works.
  const geocode = async (address) => {
    const airport = findAirport(address);
    if (airport) {
      return { lat: airport.lat, lon: airport.lon, charge: airport.charge, label: airport.name, isAirport: true };
    }
    const postcode = extractPostcode(address);
    if (postcode) {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
      const data = await res.json();
      if (data && data.result) {
        return { lat: data.result.latitude, lon: data.result.longitude, charge: 0, label: postcode, isAirport: false };
      }
    }
    return geocodeRough(address);
  };

  // Free public OSRM demo router — real driving distance/time, no API key.
  // overview=full gets back the actual road-by-road route geometry (as
  // [lon,lat] pairs, GeoJSON order) so the map can draw the real path
  // instead of a straight line between the two points.
  const route = async (from, to) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const res = await fetch(url);
    const data = await res.json();
    const r = data && data.routes && data.routes[0];
    if (!r) throw new Error('No driving route found between those two points.');
    const path = (r.geometry && r.geometry.coordinates) || [];
    return { miles: r.distance / 1609.344, minutes: r.duration / 60, path };
  };

  const isNight = (timeStr) => {
    if (!timeStr) return false;
    const hour = parseInt(timeStr.split(':')[0], 10);
    return hour >= 22 || hour < 6;
  };

  const isWeekendOrHoliday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(`${dateStr}T12:00:00`);
    const day = d.getDay();
    return day === 0 || day === 6 || BANK_HOLIDAYS_2026.includes(dateStr);
  };

  // The shared trip cost before any vehicle-specific surcharge or the
  // night/weekend adjustments — see the "Algorithm" section of the brief.
  const baseFare = ({ miles, minutes, airportCharge, extraLuggage, meetAndGreet }) => {
    let fare = 5.0; // base fare
    if (miles <= 10) fare += miles * 2.0;
    else fare += 10 * 2.0 + (miles - 10) * 1.12; // £1.12/mile above 10 miles
    fare += minutes * 0.3;
    fare += airportCharge;
    if (extraLuggage) fare += 5;
    if (meetAndGreet) fare += 15;
    return fare;
  };

  const finalizeFare = (base, { largeVehicle, night, weekend, minimumFare }) => {
    let fare = base;
    if (largeVehicle) fare += 40; // large vehicle surcharge
    if (weekend) fare *= 1.1; // weekend / bank holiday rate
    if (night) fare += 10; // flat late-night/early-morning surcharge (22:00–06:00)
    fare = Math.max(fare, minimumFare);
    return Math.ceil(fare);
  };

  // Not part of the pre-trip estimate (waiting is a day-of variable), but
  // exposed so the UI copy can quote the real policy consistently.
  const WAITING_FREE_MINUTES = 30;
  const WAITING_RATE_PER_HOUR = 15;

  // Runs the whole pipeline for one trip and returns everything both the
  // hero widget and the fleet grid need to render themselves.
  const estimateTrip = async ({ pickup, dropoff, date, time, extraLuggage, meetAndGreet }) => {
    const [from, to] = await Promise.all([geocode(pickup), geocode(dropoff)]);
    const { miles, minutes, path } = await route(from, to);
    const airportCharge = (from.charge || 0) + (to.charge || 0);
    const night = isNight(time);
    const weekend = isWeekendOrHoliday(date);
    const base = baseFare({ miles, minutes, airportCharge, extraLuggage, meetAndGreet });
    return { from, to, miles, minutes, path, airportCharge, night, weekend, base };
  };

  return {
    VEHICLES, money, findAirport, extractPostcode, geocode, route, isNight, isWeekendOrHoliday,
    baseFare, finalizeFare, estimateTrip, WAITING_FREE_MINUTES, WAITING_RATE_PER_HOUR,
  };
})();
