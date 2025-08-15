"use client";

import { formatTime } from "@/utils/journeyUtils";

// Formatiert Reisedauer in lesbarer Form
const formatDuration = (duration) => {
	if (!duration) return "Unknown";

	// Behandle ISO 8601 Dauerformat (PT1H30M)
	const match = duration.match(/PT(\d+H)?(\d+M)?/);
	if (match) {
		const hours = match[1] ? match[1].replace("H", "") : "0";
		const minutes = match[2] ? match[2].replace("M", "") : "0";
		return `${hours}h ${minutes}m`;
	}

	// Behandle Dauer-Objekt mit Abfahrts-/Ankunftszeiten
	if (typeof duration === "object" && duration.departure && duration.arrival) {
		try {
			const dep = new Date(duration.departure);
			const arr = new Date(duration.arrival);
			const diffMs = arr - dep;
			const diffMins = Math.floor(diffMs / 60000);
			const hours = Math.floor(diffMins / 60);
			const minutes = diffMins % 60;
			return `${hours}h ${minutes}m`;
		} catch (e) {
			console.log("Error calculating duration from times:", e);
			return "Duration unknown";
		}
	}

	// Falls es bereits ein String ist, der wie eine Dauer aussieht, gib ihn zurück
	if (typeof duration === "string" && duration.includes("h")) {
		return duration;
	}

	console.log("Unknown duration format:", duration);
	return "Duration unknown";
};

// Formatiert Datum für deutsche Anzeige
const formatDate = (dateString) => {
	if (!dateString) return "";
	return new Date(dateString).toLocaleDateString("de-DE", {
		day: "2-digit",
		month: "2-digit",
	});
};

// Component for displaying detailed leg information
const LegDetails = ({ leg, legIndex, isLast }) => {
	if (leg.walking) {
		return (
			<div className="text-xs text-gray-600 py-1">
				<span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
					🚶 Walk {formatDuration(leg.duration)}
				</span>
			</div>
		);
	}

	return (
		<div className="space-y-1">
			<div className="flex items-center gap-2">
				<span className="font-medium text-sm flex items-center gap-1">
					Leg {legIndex + 1}:
					<span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">
						{(() => {
							// Try to get the best train identifier
							if (leg.line?.name) return leg.line.name;
							if (leg.line?.product && leg.line?.productName)
								return `${leg.line.product} ${leg.line.productName}`;
							if (leg.line?.product) return leg.line.product;
							if (leg.line?.mode) return leg.line.mode;
							if (leg.mode) return leg.mode;
							return "Train";
						})()}
					</span>
					{leg.line?.mode && (
						<span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">
							{typeof leg.line.mode === "string"
								? leg.line.mode
								: JSON.stringify(leg.line.mode)}
						</span>
					)}
				</span>
			</div>
			<div className="ml-4 text-xs text-gray-600">
				<span className="font-medium">{leg.origin?.name}</span>
				<span className="mx-1">
					({formatTime(leg.departure)}
					{leg.departurePlatform && <span>, Pl. {leg.departurePlatform}</span>})
				</span>
				<span className="mx-2">→</span>
				<span className="font-medium">{leg.destination?.name}</span>
				<span className="mx-1">
					({formatTime(leg.arrival)}
					{leg.arrivalPlatform && <span>, Pl. {leg.arrivalPlatform}</span>})
				</span>
				<span className="ml-2 text-gray-500">
					{leg.duration
						? formatDuration(leg.duration)
						: (() => {
								// Calculate duration from departure/arrival if duration is missing
								try {
									const dep = new Date(leg.departure);
									const arr = new Date(leg.arrival);
									const diffMs = arr - dep;
									const diffMins = Math.floor(diffMs / 60000);
									const hours = Math.floor(diffMins / 60);
									const minutes = diffMins % 60;
									return `${hours}h ${minutes}m`;
								} catch (e) {
									return "";
								}
						  })()}
				</span>
				{leg.delay && leg.delay > 0 && (
					<span className="ml-2 bg-red-200 text-red-700 px-2 py-1 rounded text-xs">
						+{leg.delay}min
					</span>
				)}
				{leg.cancelled && (
					<span className="ml-2 bg-red-200 text-red-700 px-2 py-1 rounded text-xs">
						⚠️ Cancelled
					</span>
				)}
			</div>
		</div>
	);
};

const JourneyCard = ({
	journey,
	index,
	bahnCard,
	hasDeutschlandTicket,
	travelClass,
	isSelected = false,
}) => {
	// Extract journey information safely
	const firstLeg = journey.legs?.[0];
	const lastLeg = journey.legs?.[journey.legs.length - 1];
	const origin = firstLeg?.origin || { name: "Unknown" };
	const destination = lastLeg?.destination || { name: "Unknown" };
	const departure = firstLeg?.departure;
	const arrival = lastLeg?.arrival;

	// Calculate transfers (excluding walking legs) and get transfer stations
	const nonWalkingLegs = journey.legs?.filter((leg) => !leg.walking) || [];
	const transferCount = Math.max(0, nonWalkingLegs.length - 1);

	// Get transfer stations
	const transferStations = [];
	if (nonWalkingLegs.length > 1) {
		for (let i = 0; i < nonWalkingLegs.length - 1; i++) {
			const currentLeg = nonWalkingLegs[i];
			const nextLeg = nonWalkingLegs[i + 1];
			// Transfer happens at the destination of current leg / origin of next leg
			const transferStation =
				currentLeg.destination?.name || nextLeg.origin?.name;
			if (transferStation && !transferStations.includes(transferStation)) {
				transferStations.push(transferStation);
			}
		}
	}

	// Get price display
	const priceDisplay = journey.price?.amount
		? `€${journey.price.amount.toFixed(2)}`
		: "Price on request";

	// Get class display
	const classDisplay = travelClass === "1" ? "1st Class" : "2nd Class";

	return (
		<div
			className={`card-journey transition-smooth ${
				isSelected
					? "card-selected"
					: "hover:shadow-lg"
			}`}
		>
			{/* Journey Header */}
			<div className="flex justify-between items-start mb-4">
				<div className="flex-1">
					<div className="flex items-center space-x-2 mb-2">
						<span className="badge badge-primary">Verbindung</span>
						{transferCount > 0 && (
							<span className="badge badge-accent">
								{transferCount} Umstieg{transferCount > 1 ? 'e' : ''}
							</span>
						)}
					</div>
					<div className="journey-time mb-2">
						{formatTime(departure)} → {formatTime(arrival)}
					</div>
					{transferCount > 0 && transferStations.length > 0 && (
						<div className="text-sm text-accent-600 font-medium">
							🚆 via {transferStations.join(", ")}
						</div>
					)}
				</div>
				<div className="text-right">
					<div className="journey-duration mb-1">
						{(() => {
							if (journey.duration) {
								const formatted = formatDuration(journey.duration);
								if (formatted !== "Unknown" && formatted !== "Duration unknown") {
									return formatted;
								}
							}
							if (departure && arrival) {
								try {
									const dep = new Date(departure);
									const arr = new Date(arrival);
									const diffMs = arr - dep;
									const diffMins = Math.floor(diffMs / 60000);
									const hours = Math.floor(diffMins / 60);
									const minutes = diffMins % 60;
									return `${hours}h ${minutes}m`;
								} catch (e) {
									return "Dauer unbekannt";
								}
							}
							return "Dauer unbekannt";
						})()}
					</div>
					<div className="journey-price">{priceDisplay}</div>
				</div>
			</div>

			{/* Route Summary */}
			<div className="bg-neutral-50 rounded-lg p-3 mb-4">
				<div className="flex items-center justify-between text-sm">
					<span className="font-medium text-neutral-900">{origin.name}</span>
					<div className="flex items-center space-x-2">
						<div className="h-0.5 w-8 bg-primary-300"></div>
						<span className="text-xs text-neutral-500">🚄</span>
						<div className="h-0.5 w-8 bg-primary-300"></div>
					</div>
					<span className="font-medium text-neutral-900">{destination.name}</span>
				</div>
				<div className="text-xs text-neutral-600 mt-2">
					{formatDate(departure)} • {classDisplay}
				</div>
			</div>

			{/* Journey Legs */}
			<div className="space-y-2 mb-4">
				{journey.legs
					?.filter((leg) => !leg.walking)
					.map((leg, legIndex) => (
						<div key={legIndex} className="journey-segment">
							<div className="flex items-center space-x-3">
								<div className="badge bg-primary-600 text-white">
									{(() => {
										if (leg.line?.name) return leg.line.name;
										if (leg.line?.product && leg.line?.productName)
											return `${leg.line.product} ${leg.line.productName}`;
										if (leg.line?.product) return leg.line.product;
										return "Zug";
									})()}
								</div>
								<div className="flex-1 text-sm">
									<div className="flex items-center justify-between">
										<span className="font-medium">{leg.origin?.name}</span>
										<span className="text-neutral-500">{formatTime(leg.departure)}</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="font-medium">{leg.destination?.name}</span>
										<span className="text-neutral-500">{formatTime(leg.arrival)}</span>
									</div>
								</div>
							</div>
						</div>
					))}
			</div>

			{/* Journey Summary */}
			<div className="border-t border-neutral-200 pt-4 flex justify-between items-center">
				<div>
					<div className="text-base font-bold text-neutral-900">
						Gesamtpreis: {priceDisplay}
					</div>
					<div className="flex items-center space-x-4 text-xs text-neutral-600 mt-1">
						<span>{classDisplay}</span>
						{transferCount > 0 && (
							<span>• {transferCount} Umstieg{transferCount > 1 ? 'e' : ''}</span>
						)}
					</div>
				</div>
				<div className="text-right">
					{isSelected && (
						<div className="badge badge-success mb-2">
							✓ Ausgewählt
						</div>
					)}
					<div className="text-xs text-primary-600 font-medium">
						{formatTime(departure)} - {formatTime(arrival)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default JourneyCard;
