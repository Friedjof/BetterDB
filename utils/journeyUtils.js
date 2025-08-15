// Hilfsfunktionen für Reiseberechnungen und Formatierung

// Formatiere Zeit von ISO-String zu HH:MM
export const formatTime = (dateString) => {
	if (!dateString) return "--:--"; // Konsistent mit JourneyCard
	const date = new Date(dateString);
	if (isNaN(date)) {
		console.error("Invalid date string:", dateString);
		return "--:--";
	}
	try {
		return date.toLocaleTimeString("de-DE", {
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch (e) {
		return "--:--"; // Fallback bei unwahrscheinlichem Locale-Fehler
	}
};

// Berechne und formatiere Reisedauer
export const formatDuration = (journey) => {
	const legs = journey?.legs;
	if (!legs?.length) return "Unknown duration";
	const firstLeg = legs[0];
	const lastLeg = legs[legs.length - 1];
	if (!firstLeg.departure || !lastLeg.arrival) return "Unknown duration";

	const departure = new Date(firstLeg.departure);
	const arrival = new Date(lastLeg.arrival);
	if (isNaN(departure) || isNaN(arrival)) return "Invalid duration";

	const diff = arrival - departure;
	if (diff < 0) return "Invalid duration";
	if (diff > 24 * 60 * 60 * 1000) return "Long journey";

	const minutes = Math.floor(diff / 60000);
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

// Hole Zuglinie-Informationen aus einem Leg
export const getLineInfo = (leg) => {
	if (leg.walking) return null;
	return leg.line?.name || leg.line?.product || "Unknown";
};

// Hole Stationsnamen aus Stop-Objekt
export const getStationName = (stop) =>
	stop?.station?.name || stop?.name || "Unknown";

// Calculate transfer time in minutes
export const calculateTransferTime = (leg) => {
	if (!leg.walking || !leg.departure || !leg.arrival) return 0;
	return Math.round((new Date(leg.arrival) - new Date(leg.departure)) / 60000);
};

// Filter out walking legs and get non-walking legs with transfer times
export const getJourneyLegsWithTransfers = (journey) => {
	const legs = journey?.legs || [];
	return legs
		.map((leg, i) => {
			if (leg.walking) return null;
			const next = legs[i + 1];
			return {
				...leg,
				transferTimeAfter: next?.walking ? calculateTransferTime(next) : 0,
			};
		})
		.filter(Boolean);
};

// =================
// API Functions
// =================

/**
 * Searches for journeys using the extracted data
 * @param {Object} extractedData - The journey data extracted from URL
 * @returns {Promise<Array>} Array of journey objects
 * @throws {Error} When API call fails or returns error
 */
export const searchForJourneys = async (extractedData) => {
	const {
		fromStationId,
		toStationId,
		date,
		time,
		bahnCard,
		hasDeutschlandTicket,
		passengerAge,
		travelClass,
	} = extractedData;

	// Validate required fields
	if (!fromStationId || !toStationId) {
		throw new Error(
			"Unvollständige Reisedaten: Start- und Zielbahnhof erforderlich"
		);
	}

	let departureTime = "";
	if (date && time) {
		departureTime = `${date}T${time}:00`;
	}

	const urlParams = new URLSearchParams({
		from: fromStationId,
		to: toStationId,
		...(departureTime && { departure: departureTime }),
	});

	// Add optional parameters
	if (bahnCard && bahnCard !== "none") {
		urlParams.append("bahnCard", bahnCard);
	}

	if (hasDeutschlandTicket) {
		urlParams.append("hasDeutschlandTicket", "true");
	}

	if (passengerAge && passengerAge.trim() !== "") {
		urlParams.append("passengerAge", passengerAge.trim());
	}

	if (travelClass) {
		urlParams.append("travelClass", travelClass);
	}

	try {
		const response = await fetch(`/api/journeys?${urlParams}`);
		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || "Fehler beim Laden der Verbindungen");
		}

		return data.journeys || [];
	} catch (error) {
		// Re-throw with more user-friendly message if it's a network error
		if (error.message.includes("fetch")) {
			throw new Error(
				"Netzwerkfehler: Bitte überprüfe deine Internetverbindung"
			);
		}
		throw error;
	}
};

/**
 * Validates if the extracted data has the minimum required fields
 * @param {Object} extractedData - The journey data to validate
 * @returns {boolean} True if data is valid
 */
export const validateJourneyData = (extractedData) =>
	Boolean(extractedData.fromStationId && extractedData.toStationId);
