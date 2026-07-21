// Shared fare-calculation engine used by both the hero quote card's quick
// estimate and the full fleet grid in #fleet, so the two never drift apart.
window.GNGFare = (() => {
  // Mileage/time/airport/extras are identical for every vehicle — only the
  // large-vehicle surcharge and minimum fare differ, per the brief.
  const VEHICLES = [
    { id: 'five', name: '5 Seater', tag: 'MPV', passengers: 5, largeVehicle: false, minimumFare: 32,
      luggage: [{ cases: 2, bags: 2 }], maxItems: 4 },
    { id: 'nine', name: '9 Seater', tag: 'Minibus', passengers: 9, largeVehicle: true, minimumFare: 48,
      luggage: [{ cases: 9, bags: 0 }, { cases: 7, bags: 2 }, { cases: 6, bags: 3 }], maxItems: 9 },
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

  const extractPostcode = (address) => {
    const m = address.match(/[A-Za-z]{1,2}[0-9][A-Za-z0-9]?\s?[0-9][A-Za-z]{2}$/);
    return m ? m[0] : null;
  };

  // Resolves an address to {lat, lon, charge, label, isAirport}. Airports
  // resolve instantly from the shared dataset; everything else is geocoded
  // from its postcode via postcodes.io, which is exact (no ambiguous
  // free-text matching).
  const geocode = async (address) => {
    const airport = findAirport(address);
    if (airport) {
      return { lat: airport.lat, lon: airport.lon, charge: airport.charge, label: airport.name, isAirport: true };
    }
    const postcode = extractPostcode(address);
    if (!postcode) throw new Error(`Couldn't find a postcode in "${address}".`);
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    const data = await res.json();
    if (!data || !data.result) throw new Error(`"${postcode}" doesn't look like a real postcode.`);
    return { lat: data.result.latitude, lon: data.result.longitude, charge: 0, label: postcode, isAirport: false };
  };

  // Free public OSRM demo router — real driving distance/time, no API key.
  const route = async (from, to) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false&alternatives=false&steps=false`;
    const res = await fetch(url);
    const data = await res.json();
    const r = data && data.routes && data.routes[0];
    if (!r) throw new Error('No driving route found between those two points.');
    return { miles: r.distance / 1609.344, minutes: r.duration / 60 };
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
  // night/weekend multipliers — see the "Algorithm" section of the brief.
  const baseFare = ({ miles, minutes, airportCharge, extraLuggage, meetAndGreet }) => {
    let fare = 5.0; // base fare
    if (miles <= 10) fare += miles * 2.2;
    else fare += 10 * 2.2 + (miles - 10) * 1.8;
    fare += minutes * 0.3;
    fare += airportCharge;
    if (extraLuggage) fare += 5;
    if (meetAndGreet) fare += 15;
    return fare;
  };

  const finalizeFare = (base, { largeVehicle, night, weekend, minimumFare }) => {
    let fare = base;
    if (largeVehicle) fare += 20;
    if (night) fare *= 1.15;
    if (weekend) fare *= 1.1;
    fare = Math.max(fare, minimumFare);
    return Math.ceil(fare);
  };

  // Runs the whole pipeline for one trip and returns everything both the
  // hero widget and the fleet grid need to render themselves.
  const estimateTrip = async ({ pickup, dropoff, date, time, extraLuggage, meetAndGreet }) => {
    const [from, to] = await Promise.all([geocode(pickup), geocode(dropoff)]);
    const { miles, minutes } = await route(from, to);
    const airportCharge = (from.charge || 0) + (to.charge || 0);
    const night = isNight(time);
    const weekend = isWeekendOrHoliday(date);
    const base = baseFare({ miles, minutes, airportCharge, extraLuggage, meetAndGreet });
    return { from, to, miles, minutes, airportCharge, night, weekend, base };
  };

  return { VEHICLES, money, findAirport, extractPostcode, geocode, route, isNight, isWeekendOrHoliday, baseFare, finalizeFare, estimateTrip };
})();
