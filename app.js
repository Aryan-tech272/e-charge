document.addEventListener("DOMContentLoaded", () => {
  const chargerGrid = document.querySelector("#chargerGrid, .charger-grid");
  const searchInput = document.querySelector("#searchInput, #chargerSearch");
  const typeFilter = document.querySelector("#typeFilter, #chargerType");
  const searchButton = document.querySelector("#searchButton");
  const ownerForm = document.querySelector("#ownerForm, .owner-form");
  const statusMessage = document.querySelector("#statusMessage");
  const ownerFormMessage = document.querySelector("#ownerFormMessage");

  let allChargers = [];

  function showMessage(message, isError = false) {
    if (statusMessage) {
      statusMessage.textContent = message;
      statusMessage.style.color = isError ? "#ff8585" : "#9bff85";
    } else {
      console.log(message);
    }
  }

  function showOwnerMessage(message, isError = false) {
    const target = ownerFormMessage || statusMessage;
    if (target) {
      target.textContent = message;
      target.style.color = isError ? "#ff8585" : "#9bff85";
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed (${response.status})`);
    }

    return data;
  }

  function getList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.chargers)) return data.chargers;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  function renderChargers(chargers) {
    if (!chargerGrid) return;

    if (!chargers.length) {
      chargerGrid.innerHTML = `
        <div class="loading-card">
          <h3>No chargers found</h3>
          <p>Try another location or filter.</p>
          <a href="#opportunity">Have a charger? List it here ↗</a>
        </div>`;
      return;
    }

    chargerGrid.innerHTML = chargers.map(charger => {
      const type = String(charger.type || "public");
      const price = charger.pricePerKwh ?? charger.price ?? "Contact owner";

      return `
        <article class="charger-card">
          <span class="charger-type-badge">
            ${escapeHTML(type)} Charger
          </span>

          <h3>${escapeHTML(charger.name || "EV Charging Point")}</h3>

          <p>📍 ${escapeHTML(charger.address || "Address not provided")}, 
             ${escapeHTML(charger.city || "")}</p>
          <p>⚡ ${escapeHTML(charger.power || "Power not specified")} 
             ${String(charger.power || "").toLowerCase().includes("kw") ? "" : "kW"}
             · ${escapeHTML(charger.connector || "Connector not specified")}</p>
          <p>🕒 ${escapeHTML(charger.availability || charger.hours || "Check with owner")}</p>
          <p>🔌 ${escapeHTML(charger.available ?? 0)} of 
             ${escapeHTML(charger.total ?? 0)} available</p>

          <div class="charger-card-bottom">
            <span class="charger-price">
              ${typeof price === "number" || !Number.isNaN(Number(price))
                ? `₹${escapeHTML(price)}/kWh`
                : escapeHTML(price)}
            </span>

            <button class="small-action" type="button"
              data-book-id="${escapeHTML(charger.id)}"
              ${charger.id == null ? "disabled" : ""}>
              Book Now
            </button>
          </div>

          <p>
            <button class="small-action" type="button"
              data-directions-id="${escapeHTML(charger.id)}">
              Get Directions ↗
            </button>
          </p>
        </article>`;
    }).join("");
  }

  async function loadChargers() {
    if (chargerGrid) {
      chargerGrid.innerHTML =
        '<p class="loading-card">Finding charging stations...</p>';
    }

    try {
      const params = new URLSearchParams();
      const search = searchInput?.value.trim() || "";
      const type = typeFilter?.value || "all";

      if (search) params.set("search", search);
      if (type && type.toLowerCase() !== "all") {
        params.set("type", type);
      }

      const data = await apiRequest(`/api/chargers?${params.toString()}`);
      allChargers = getList(data);
      renderChargers(allChargers);
      showMessage(`${allChargers.length} charger(s) found.`);
    } catch (error) {
      if (chargerGrid) {
        chargerGrid.innerHTML = `
          <div class="loading-card">
            <h3>Could not load chargers</h3>
            <p>Check that the E CHARGE server is running, then try again.</p>
            <button class="small-action" id="retryChargers" type="button">
              Try Again
            </button>
          </div>`;
      }
      showMessage(error.message, true);
    }
  }

function openBooking(chargerId) {
  const charger = allChargers.find(
    item => String(item.id) === String(chargerId)
  );

  if (!charger) {
    showMessage("Please refresh the charger list and try again.", true);
    return;
  }

  document.querySelector("#bookingPanel")?.remove();

  const form = document.createElement("form");
  form.id = "bookingPanel";
  form.className = "owner-form";
  form.style.marginTop = "20px";

  form.innerHTML = `
    <h3>Book ${escapeHTML(charger.name)}</h3>

    <label>Your name
      <input name="customer" required maxlength="100" placeholder="Enter your name">
    </label>

    <label>Phone number
      <input name="phone" type="tel" required maxlength="20" placeholder="Enter phone number">
    </label>

    <label>Car model
      <input name="car" required maxlength="100" placeholder="Enter your EV model">
    </label>

    <label>Date
      <input name="date" type="date" required>
    </label>

    <label>Start time
      <input name="time" type="time" required>
    </label>

    <label>Charging duration
      <select name="minutes" required>
        <option value="30">30 minutes</option>
        <option value="60">1 hour</option>
        <option value="90">1 hour 30 minutes</option>
        <option value="120">2 hours</option>
      </select>
    </label>

    <label>Estimated energy required (kWh)
      <input name="kwh" type="number" min="1" max="300" step="0.1" required placeholder="Example: 25">
    </label>

    <button class="button button-primary" type="submit">
      Confirm Booking
    </button>

    <p class="status-message" aria-live="polite"></p>
  `;

  const section = chargerGrid?.closest("section") || chargerGrid?.parentElement;
  (section || document.body).appendChild(form);
  form.scrollIntoView({ behavior: "smooth", block: "start" });

  const dateInput = form.querySelector('[name="date"]');
  const today = new Date();
  const localToday = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);

  dateInput.min = localToday;
  dateInput.value = localToday;

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const button = form.querySelector('button[type="submit"]');
    const message = form.querySelector(".status-message");

    button.disabled = true;
    button.textContent = "Booking...";

    const values = new FormData(form);

    try {
      const result = await apiRequest("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          chargerId: charger.id,
          customer: values.get("customer"),
          phone: values.get("phone"),
          car: values.get("car"),
          date: values.get("date"),
          time: values.get("time"),
          minutes: Number(values.get("minutes")),
          kwh: Number(values.get("kwh"))
        })
      });

      const savedBooking = result.booking;

      message.style.color = "#16a34a";
      message.textContent =
        `✓ Booking Confirmed! Estimated cost: ₹${savedBooking.estimatedCost}. Booking ID: ${savedBooking.id}`;

      showMessage("Your booking was successfully confirmed.");
      button.textContent = "Booking Confirmed";
    } catch (error) {
      message.style.color = "#ff8585";
      message.textContent = `Booking failed: ${error.message}`;
      showMessage(error.message, true);

      button.disabled = false;
      button.textContent = "Confirm Booking";
    }
  });
}

  function getDirections(chargerId) {
    const charger = allChargers.find(
      item => String(item.id) === String(chargerId)
    );
    if (!charger) return;

    let destination;

    if (charger.lat != null && charger.lng != null) {
      destination = `${charger.lat},${charger.lng}`;
    } else {
      destination = `${charger.address || ""}, ${charger.city || ""}, India`;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  chargerGrid?.addEventListener("click", event => {
    const retryButton = event.target.closest("#retryChargers");
    const bookButton = event.target.closest("[data-book-id]");
    const directionsButton = event.target.closest("[data-directions-id]");

    if (retryButton) loadChargers();
    if (bookButton) openBooking(bookButton.dataset.bookId);
    if (directionsButton) getDirections(directionsButton.dataset.directionsId);
  });

  searchButton?.addEventListener("click", loadChargers);

  searchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadChargers();
    }
  });

  typeFilter?.addEventListener("change", loadChargers);

  ownerForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const button = ownerForm.querySelector('button[type="submit"]');
    const originalText = button?.textContent || "Submit Charger Listing";

    if (button) {
      button.disabled = true;
      button.textContent = "Submitting Listing...";
    }

    const values = new FormData(ownerForm);

    const priceValue = values.get("pricePerKwh") ?? values.get("price");
    const price = priceValue === "" || priceValue == null
      ? null
      : Number(priceValue);

    const listing = {
      ownerName: values.get("ownerName") || "",
      name: values.get("name") || values.get("chargerName") || "",
      type: values.get("type") || "home",
      city: values.get("city") || "",
      address: values.get("address") || "",
      connector: values.get("connector") || "",
      power: values.get("power") || "",
      price,
      pricePerKwh: price,
      availability: values.get("availability") || "By appointment",
      parking: values.get("parking") || "",
      description: values.get("description") || ""
    };

    try {
      const result = await apiRequest("/api/chargers", {
        method: "POST",
        body: JSON.stringify(listing)
      });

      const addedCharger = result.charger || result;
      const name = addedCharger.name || listing.name;

      showOwnerMessage(
        `${name} was submitted successfully. Refresh the charger list to check the listing.`
      );
      showMessage(`${name} submitted successfully.`);
      ownerForm.reset();
      await loadChargers();
    } catch (error) {
      showOwnerMessage(
        `Could not submit the listing: ${error.message}`,
        true
      );
      showMessage(error.message, true);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });

  loadChargers();
});
