const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

let chargers = [
  {
    id: 1, name: "GreenCharge Ultra Hub", ownerName: "GreenCharge",
    city: "Mohali", address: "Airport Road, Mohali",
    type: "Public", connector: "CCS2", power: 60, price: 18,
    available: 4, total: 6, hours: "24 hours",
    amenities: ["Food", "Restroom", "Parking"],
    status: "Available", description: "Fast charging near the airport.",
    lat: 30.7046, lng: 76.7179, rating: 4.6, reviews: []
  },
  {
    id: 2, name: "Eco Home Charger", ownerName: "Demo Owner",
    city: "Chandigarh", address: "Sector 35, Chandigarh",
    type: "Home", connector: "Type 2", power: 7.4, price: 12,
    available: 1, total: 1, hours: "8 AM - 10 PM",
    amenities: ["Parking"], status: "Available",
    description: "Convenient home charging by appointment.",
    lat: 30.7191, lng: 76.7513, rating: 4.8, reviews: []
  },
  {
    id: 3, name: "Highway Fast Charge", ownerName: "Highway EV",
    city: "Zirakpur", address: "Ambala-Chandigarh Highway",
    type: "Public", connector: "CCS2", power: 120, price: 22,
    available: 2, total: 4, hours: "24 hours",
    amenities: ["Food", "Parking"], status: "Available",
    description: "High-power charging for road trips.",
    lat: 30.6425, lng: 76.8173, rating: 4.4, reviews: []
  },
  {
    id: 4, name: "City Charge Point", ownerName: "City EV",
    city: "Ludhiana", address: "Ferozepur Road, Ludhiana",
    type: "Public", connector: "CHAdeMO", power: 50, price: 16,
    available: 0, total: 3, hours: "7 AM - 11 PM",
    amenities: ["Restroom", "Parking"], status: "Busy",
    description: "Urban charging station.", lat: null, lng: null,
    rating: 4.2, reviews: []
  }
];

let bookings = [];
let feedback = [];
let sessions = [];
let nextChargerId = 5;
let nextBookingId = 1;
let nextSessionId = 1;

const clean = (value, max = 200) =>
  String(value ?? "").trim().slice(0, max);

const normalizeType = value =>
  String(value).toLowerCase() === "home" ? "Home" : "Public";

app.get("/api/status", (req, res) => {
  res.json({ ok: true, app: "E CHARGE", version: "demo" });
});

app.get("/api/chargers", (req, res) => {
  let result = [...chargers];
  const q = clean(req.query.q, 100).toLowerCase();
  const type = clean(req.query.type, 20).toLowerCase();
  const connector = clean(req.query.connector, 30).toLowerCase();
  const amenity = clean(req.query.amenity, 30).toLowerCase();
  const maxPrice = Number(req.query.maxPrice);
  const minPower = Number(req.query.minPower);

  if (q) {
    result = result.filter(c =>
      [c.name, c.city, c.address, c.connector, c.description]
        .some(v => String(v).toLowerCase().includes(q))
    );
  }

  if (type && type !== "all") {
    result = result.filter(c => c.type.toLowerCase() === type);
  }
  if (connector && connector !== "all") {
    result = result.filter(c => c.connector.toLowerCase() === connector);
  }
  if (amenity && amenity !== "all") {
    result = result.filter(c =>
      c.amenities.some(a => a.toLowerCase() === amenity)
    );
  }
  if (req.query.maxPrice !== undefined && Number.isFinite(maxPrice)) {
    result = result.filter(c => c.price <= maxPrice);
  }
  if (req.query.minPower !== undefined && Number.isFinite(minPower)) {
    result = result.filter(c => c.power >= minPower);
  }

  res.json(result);
});

app.get("/api/chargers/:id", (req, res) => {
  const charger = chargers.find(c => c.id === Number(req.params.id));
  if (!charger) return res.status(404).json({ error: "Charger not found." });
  res.json(charger);
});

app.post("/api/chargers", (req, res) => {
  const body = req.body || {};
  const name = clean(body.name, 100);
  const ownerName = clean(body.ownerName, 100);
  const city = clean(body.city, 80);
  const address = clean(body.address, 200);
  const connector = clean(body.connector, 30);
  const type = normalizeType(body.type);
  const power = parseFloat(body.power);
  const price = Number(body.pricePerKwh ?? body.price);
  const hours = clean(body.availability || body.hours || "Contact owner", 100);

  if (!name || !city || !address || !connector) {
    return res.status(400).json({
      error: "Enter charger name, city, address and connector."
    });
  }
  if (!Number.isFinite(power) || power <= 0 ||
      !Number.isFinite(price) || price < 0) {
    return res.status(400).json({
      error: "Enter a valid charging power and price."
    });
  }

  const amenities = Array.isArray(body.amenities)
    ? body.amenities.map(a => clean(a, 30)).filter(Boolean).slice(0, 10)
    : [];

  const charger = {
    id: nextChargerId++,
    name, ownerName, city, address, connector, type, power, price,
    available: 1, total: 1, hours, amenities,
    status: "Available",
    description: clean(body.description, 500),
    parking: clean(body.parking, 100),
    lat: null, lng: null, rating: 0, reviews: []
  };

  chargers.push(charger);
  res.status(201).json({
    message: "Charger listing created.",
    charger
  });
});

app.post("/api/bookings", (req, res) => {
  const body = req.body || {};
  const charger = chargers.find(c => c.id === Number(body.chargerId));
  const customer = clean(body.customer, 100);
  const phone = clean(body.phone, 20);
  const car = clean(body.car, 100);
  const date = clean(body.date, 20);
  const time = clean(body.time, 10);
  const minutes = Number(body.minutes);
  const kwh = Number(body.kwh);

  if (!charger) return res.status(404).json({ error: "Charger not found." });
  if (!customer || !phone || !car || !date || !time) {
    return res.status(400).json({ error: "Complete all booking details." });
  }
  if (![30, 60, 90, 120].includes(minutes)) {
    return res.status(400).json({ error: "Choose a valid duration." });
  }
  if (!Number.isFinite(kwh) || kwh <= 0 || kwh > 300) {
    return res.status(400).json({ error: "Enter a valid estimated energy amount." });
  }
  if (charger.status === "Out of order" || charger.available < 1) {
    return res.status(409).json({ error: "This charger is currently unavailable." });
  }

  const start = new Date(`${date}T${time}:00`);
  if (Number.isNaN(start.getTime()) || start <= new Date()) {
    return res.status(400).json({ error: "Choose a future date and time." });
  }

  const end = new Date(start.getTime() + minutes * 60000);
  const conflict = bookings.some(b =>
    b.chargerId === charger.id &&
    b.date === date &&
    b.status === "Confirmed" &&
    start < new Date(`${b.date}T${b.time}:00`).getTime() + b.minutes * 60000 &&
    end.getTime() > new Date(`${b.date}T${b.time}:00`).getTime()
  );

  if (conflict) {
    return res.status(409).json({
      error: "That time overlaps another booking. Please choose another slot."
    });
  }

  const booking = {
    id: nextBookingId++,
    chargerId: charger.id,
    chargerName: charger.name,
    customer, phone, car, date, time, minutes, kwh,
    estimatedCost: Math.round(kwh * charger.price * 100) / 100,
    gracePeriodMinutes: 10,
    noShowPolicy: "Arrive within 10 minutes or the reservation may be cancelled.",
    paymentStatus: "Demo only - not charged",
    status: "Confirmed",
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);
  res.status(201).json({
    message: "Demo booking confirmed.",
    booking
  });
});

app.get("/api/bookings", (req, res) => {
  const phone = clean(req.query.phone, 20);
  res.json(phone
    ? bookings.filter(b => b.phone === phone)
    : bookings);
});

app.patch("/api/chargers/:id/status", (req, res) => {
  const charger = chargers.find(c => c.id === Number(req.params.id));
  if (!charger) return res.status(404).json({ error: "Charger not found." });

  const allowed = ["Available", "Busy", "Out of order"];
  const status = clean(req.body?.status, 30);
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid charger status." });
  }

  charger.status = status;
  if (status === "Out of order" || status === "Busy") {
    charger.available = 0;
  } else {
    charger.available = Math.max(1, charger.available);
  }

  res.json({ message: "Demo status updated.", charger });
});

app.post("/api/feedback", (req, res) => {
  const body = req.body || {};
  const rating = Number(body.rating);
  const comment = clean(body.comment, 1000);
  const chargerId = body.chargerId ? Number(body.chargerId) : null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Choose a rating from 1 to 5." });
  }

  if (chargerId && !chargers.some(c => c.id === chargerId)) {
    return res.status(404).json({ error: "Charger not found." });
  }

  const item = {
    id: feedback.length + 1,
    chargerId,
    kind: chargerId ? "Station review" : "App feedback",
    name: clean(body.name || "Guest", 100),
    rating,
    comment,
    photoName: clean(body.photoName, 150),
    createdAt: new Date().toISOString()
  };

  feedback.push(item);
  if (chargerId) {
    const charger = chargers.find(c => c.id === chargerId);
    charger.reviews.push(item);
    const total = charger.reviews.reduce((sum, r) => sum + r.rating, 0);
    charger.rating = Math.round(total / charger.reviews.length * 10) / 10;
  }

  res.status(201).json({ message: "Feedback saved in this demo.", feedback: item });
});

app.get("/api/feedback", (req, res) => res.json(feedback));

app.post("/api/sessions", (req, res) => {
  const charger = chargers.find(c => c.id === Number(req.body?.chargerId));
  if (!charger) return res.status(404).json({ error: "Charger not found." });

  const session = {
    id: nextSessionId++,
    chargerId: charger.id,
    chargerName: charger.name,
    car: clean(req.body?.car || "My EV", 100),
    batteryStart: Math.min(100, Math.max(0, Number(req.body?.batteryStart) || 20)),
    batteryCurrent: Math.min(100, Math.max(0, Number(req.body?.batteryStart) || 20)),
    batteryTarget: Math.min(100, Math.max(1, Number(req.body?.batteryTarget) || 80)),
    kwh: 0,
    cost: 0,
    status: "Charging (demo)",
    createdAt: new Date().toISOString()
  };

  sessions.push(session);
  res.status(201).json({ session });
});

app.get("/api/sessions", (req, res) => res.json(sessions));

app.patch("/api/sessions/:id", (req, res) => {
  const session = sessions.find(s => s.id === Number(req.params.id));
  if (!session) return res.status(404).json({ error: "Session not found." });

  const battery = Number(req.body?.batteryCurrent);
  if (!Number.isFinite(battery) || battery < 0 || battery > 100) {
    return res.status(400).json({ error: "Battery must be between 0 and 100." });
  }

  session.batteryCurrent = battery;
  session.kwh = Math.max(0, (battery - session.batteryStart) * 0.5);
  const charger = chargers.find(c => c.id === session.chargerId);
  session.cost = Math.round(session.kwh * (charger?.price || 0) * 100) / 100;

  if (battery >= session.batteryTarget) session.status = "Target reached";
  res.json({ session });
});

app.post("/api/notify", (req, res) => {
  const charger = chargers.find(c => c.id === Number(req.body?.chargerId));
  if (!charger) return res.status(404).json({ error: "Charger not found." });
  res.json({
    message: "Demo alert preference saved. Real push/SMS notifications need a provider.",
    chargerId: charger.id
  });
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`E CHARGE running at http://localhost:${PORT}`);
});
