"use client";

// Importiere notwendige React-Hooks und Next.js-Router
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// Konstanten für Formular-Initialwerte
const INITIAL_FORM_STATE = {
	fromStation: "",
	toStation: "",
	fromStationId: "",
	toStationId: "",
	date: "",
	time: "",
	bahnCard: "none",
	hasDeutschlandTicket: true,
	passengerAge: "",
	travelClass: "2",
};

// Fehlermeldungen für URL-Parsing
const ERROR_MESSAGES = {
	EMPTY_URL:
		"Please enter text containing a DB booking URL or paste a direct DB booking link",
	INVALID_URL:
		"No valid DB booking URL found. Please paste text containing a Deutsche Bahn booking link (from bahn.de with /buchung/start path) or check that your URL is correct.",
	PARSE_FAILED: "Failed to parse URL",
};

// Haupt-Suchformular-Komponente
const SearchForm = () => {
	const router = useRouter();

	// UI-Zustand verwalten
	const [url, setUrl] = useState("");
	const [isParsingUrl, setIsParsingUrl] = useState(false);
	const [urlParseError, setUrlParseError] = useState(null);
	const [showHelp, setShowHelp] = useState(false);

	// Formulardaten-Zustand
	const [formData, setFormData] = useState(INITIAL_FORM_STATE);

	// URL-Validierungs-Hilfsfunktionen
	const isValidDBBookingUrl = useCallback((url) => {
		try {
			const urlObj = new URL(url);

			// Überprüfe ob es eine gültige Bahn.de Buchungs-URL ist
			if (!urlObj.hostname.includes("bahn.de")) return false;
			if (!urlObj.pathname.includes("/buchung/start")) return false;

			const requiredParams = ["vbid"];
			const commonParams = ["ot", "rt", "dt", "so", "zo"];

			const hasRequiredParams = requiredParams.some((param) =>
				urlObj.searchParams.has(param)
			);

			if (!hasRequiredParams) {
				return commonParams.some((param) => urlObj.searchParams.has(param));
			}

			return true;
		} catch (error) {
			return false;
		}
	}, []);

	const extractUrlFromText = useCallback(
		(text) => {
			const urlRegex = /https?:\/\/[^\s\n\r]+/gi;
			const matches = text.match(urlRegex);

			if (matches?.length > 0) {
				for (let foundUrl of matches) {
					foundUrl = foundUrl.replace(/[.,;!?\s]*$/, "");
					if (isValidDBBookingUrl(foundUrl)) {
						console.log("🔍 Found valid DB booking URL:", foundUrl);
						return foundUrl;
					}
				}
			}

			const trimmedText = text.trim();
			if (trimmedText.startsWith("http") && isValidDBBookingUrl(trimmedText)) {
				return trimmedText;
			}

			return null;
		},
		[isValidDBBookingUrl]
	);

	// Utility functions
	const updateFormData = (updates) => {
		setFormData((prev) => ({ ...prev, ...updates }));
	};

	// Handle URL parsing and navigation
	const handleUrlSubmit = async (e) => {
		e.preventDefault();

		if (!url.trim()) {
			setUrlParseError(ERROR_MESSAGES.EMPTY_URL);
			return;
		}

		const extractedUrl = extractUrlFromText(url);
		if (!extractedUrl) {
			setUrlParseError(ERROR_MESSAGES.INVALID_URL);
			return;
		}

		const searchParams = new URLSearchParams({
			url: extractedUrl,
			bahnCard: formData.bahnCard,
			hasDeutschlandTicket: formData.hasDeutschlandTicket.toString(),
			passengerAge: formData.passengerAge,
			travelClass: formData.travelClass,
			// autoSearch: "true", // Flag to indicate auto-search should happen
		});

		// Navigate to discount page with search parameters
		router.push(`/discount?${searchParams.toString()}`);
	};

	return (
		<section className="max-w-4xl mx-auto">
			{/* Header Section */}
			<div className="text-center mb-8">
				<div className="inline-flex items-center gap-3 mb-3">
					<div className="w-12 h-12 bg-gradient-db rounded-2xl flex items-center justify-center shadow-lg">
						<span className="text-2xl">💰</span>
					</div>
					<h2 className="text-3xl md:text-4xl font-bold text-neutral-900">
						Split-Ticketing starten
					</h2>
				</div>
				<p className="text-lg text-neutral-600 max-w-2xl mx-auto leading-relaxed">
					Kopiere einfach deinen <span className="font-semibold text-db-red-600">"Verbindung Teilen"</span> Text von bahn.de 
					und wir finden automatisch bessere Preise durch intelligentes Split-Ticketing
				</p>
			</div>

			<div className="bg-white rounded-3xl shadow-xl border border-neutral-100 overflow-hidden">
				{/* Step Indicator */}
				<div className="bg-gradient-to-r from-db-red-50 to-accent-50 px-8 py-4 border-b border-neutral-100">
					<div className="flex items-center justify-center gap-2">
						<div className="w-8 h-8 bg-db-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
						<span className="text-sm font-medium text-neutral-700">Reisedaten eingeben</span>
						<div className="w-8 h-0.5 bg-neutral-300 mx-2"></div>
						<div className="w-8 h-8 bg-neutral-300 text-neutral-500 rounded-full flex items-center justify-center text-sm font-bold">2</div>
						<span className="text-sm font-medium text-neutral-500">Preise vergleichen</span>
						<div className="w-8 h-0.5 bg-neutral-300 mx-2"></div>
						<div className="w-8 h-8 bg-neutral-300 text-neutral-500 rounded-full flex items-center justify-center text-sm font-bold">3</div>
						<span className="text-sm font-medium text-neutral-500">Sparen!</span>
					</div>
				</div>

				<form onSubmit={handleUrlSubmit} className="p-8">
					{/* Main Input Section */}
					<div className="mb-6">
						<div className="flex items-center gap-4 mb-4">
							<div className="flex items-center gap-2">
								<div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
									<span className="text-lg">📋</span>
								</div>
								<div>
									<h3 className="font-bold text-lg text-neutral-900">Reisedaten eingeben</h3>
									<p className="text-sm text-neutral-600">Füge deinen "Teilen"-Text von bahn.de ein</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setShowHelp(!showHelp)}
								className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors duration-200 text-sm font-medium"
								aria-label="Hilfe anzeigen"
							>
								<span>💡</span>
								Wie geht das?
							</button>
						</div>
						
						<div className="relative bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-2xl p-6 border-2 border-dashed border-neutral-300 hover:border-db-red-300 transition-colors duration-200">
							<div className="relative">
								<textarea
									id="url"
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									placeholder="Hier deinen kompletten 'Verbindung Teilen' Text einfügen...

Beispiel:
Verbindung am Mo., 15.08.2024
Hamburg Hbf ab 08:30
Berlin Hbf an 10:45
2. Klasse, 1 Erwachsener
Preis: 49,90 EUR"
									className="w-full min-h-[140px] bg-white border-0 rounded-xl px-4 py-4 text-base resize-none focus:outline-none focus:ring-2 focus:ring-db-red-500 transition-all duration-200 shadow-sm placeholder:text-neutral-400 placeholder:text-sm"
									disabled={isParsingUrl}
								/>
								{!url && (
									<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
										<div className="text-center">
											<div className="text-4xl mb-2 opacity-50">📱</div>
											<p className="text-neutral-500 text-sm font-medium">Text hier einfügen</p>
										</div>
									</div>
								)}
								{isParsingUrl && (
									<div className="absolute inset-0 bg-gradient-to-br from-white/95 via-blue-50/90 to-db-red-50/90 flex items-center justify-center rounded-xl backdrop-blur-sm">
										<div className="text-center relative">
											{/* Animated Train */}
											<div className="relative mb-6">
												<div className="w-20 h-20 bg-gradient-to-br from-db-red-500 via-db-red-600 to-db-red-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-db-red-600/30 mx-auto animate-pulse">
													<span className="text-3xl animate-bounce">🚄</span>
												</div>
												{/* Moving dots around the train */}
												<div className="absolute -inset-4">
													<div className="w-2 h-2 bg-blue-500 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2 animate-ping"></div>
													<div className="w-2 h-2 bg-green-500 rounded-full absolute top-1/2 right-0 transform -translate-y-1/2 animate-ping" style={{animationDelay: '0.3s'}}></div>
													<div className="w-2 h-2 bg-yellow-500 rounded-full absolute bottom-0 left-1/2 transform -translate-x-1/2 animate-ping" style={{animationDelay: '0.6s'}}></div>
													<div className="w-2 h-2 bg-purple-500 rounded-full absolute top-1/2 left-0 transform -translate-y-1/2 animate-ping" style={{animationDelay: '0.9s'}}></div>
												</div>
											</div>
											
											{/* Progress Bar */}
											<div className="w-64 mx-auto mb-4">
												<div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
													<div className="h-full bg-gradient-to-r from-db-red-500 via-blue-500 to-green-500 rounded-full animate-pulse" style={{
														background: 'linear-gradient(90deg, #dc2626 0%, #3b82f6 50%, #10b981 100%)',
														backgroundSize: '200% 100%',
														animation: 'progress-wave 2s ease-in-out infinite'
													}}></div>
												</div>
											</div>
											
											{/* Text with typing animation */}
											<p className="text-neutral-800 font-bold text-lg mb-2">
												<span className="inline-block animate-bounce" style={{animationDelay: '0s'}}>A</span>
												<span className="inline-block animate-bounce" style={{animationDelay: '0.1s'}}>n</span>
												<span className="inline-block animate-bounce" style={{animationDelay: '0.2s'}}>a</span>
												<span className="inline-block animate-bounce" style={{animationDelay: '0.3s'}}>l</span>
												<span className="inline-block animate-bounce" style={{animationDelay: '0.4s'}}>y</span>
												<span className="inline-block animate-bounce" style={{animationDelay: '0.5s'}}>s</span>
												<span className="inline-block animate-bounce" style={{animationDelay: '0.6s'}}>i</span>
												<span className="inline-block animate-bounce" style={{animationDelay: '0.7s'}}>e</span>
												<span className="inline-block animate-bounce" style={{animationDelay: '0.8s'}}>r</span>
												<span className="inline-block animate-bounce" style={{animationDelay: '0.9s'}}>e</span>
												<span className="ml-2 inline-block animate-bounce" style={{animationDelay: '1s'}}>🔍</span>
											</p>
											<div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
												<span>Suche optimale Route</span>
												<div className="flex gap-1">
													<div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
													<div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
													<div className="w-1 h-1 bg-neutral-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
												</div>
											</div>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Help Section */}
						{showHelp && (
							<div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200 animate-fade-in">
								<div className="flex items-start gap-4">
									<div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
										<span className="text-xl">🎯</span>
									</div>
									<div className="flex-1">
										<h4 className="font-bold text-lg text-neutral-900 mb-4">
											So findest du den "Teilen"-Text:
										</h4>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div className="space-y-3">
												<div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
													<div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">1</div>
													<span className="text-sm font-medium">Gehe auf <strong>bahn.de</strong></span>
												</div>
												<div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
													<div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">2</div>
													<span className="text-sm font-medium">plane deine Verbindung</span>
												</div>
												<div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
													<div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">3</div>
													<span className="text-sm font-medium">Wähle deine Verbindung</span>
												</div>
											</div>
											<div className="space-y-3">
												<div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
													<div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">4</div>
													<span className="text-sm font-medium">Klicke auf die <strong>drei Punkte</strong></span>
												</div>
												<div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
													<div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">5</div>
													<span className="text-sm font-medium">"<strong>Verbindung Teilen</strong>"</span>
												</div>
												<div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
													<div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">6</div>
													<span className="text-sm font-medium">"<strong>Infos Kopieren</strong>" & hier einfügen</span>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Advanced Options */}
					<div className="mt-6 p-6 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-2xl border border-neutral-200">
						<div className="flex items-center gap-3 mb-4">
							<div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
								<span className="text-lg">⚙️</span>
							</div>
							<div>
								<h3 className="font-bold text-lg text-neutral-900">Persönliche Angaben</h3>
								<p className="text-sm text-neutral-600">Für genauere Preisberechnung (optional)</p>
							</div>
						</div>
						
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							{/* BahnCard Selection */}
							<div className="space-y-3">
								<label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
									<span className="text-lg">🎫</span>
									BahnCard
								</label>
								<div className="relative">
									<select
										value={formData.bahnCard}
										onChange={(e) => updateFormData({ bahnCard: e.target.value })}
										className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20 transition-all duration-200 appearance-none cursor-pointer font-medium"
										disabled={isParsingUrl}
									>
										<option value="none">Keine BahnCard</option>
										<option value="25">BahnCard 25 (-25%)</option>
										<option value="50">BahnCard 50 (-50%)</option>
									</select>
									<div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
										<svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
										</svg>
									</div>
								</div>
							</div>
							
							{/* Age Input */}
							<div className="space-y-3">
								<label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
									<span className="text-lg">👤</span>
									Alter
								</label>
								<div className="relative">
									<input
										type="number"
										value={formData.passengerAge}
										onChange={(e) => updateFormData({ passengerAge: e.target.value })}
										placeholder="25"
										min="6"
										max="120"
										className="w-full px-4 py-3 bg-white border border-neutral-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20 transition-all duration-200 font-medium"
										disabled={isParsingUrl}
									/>
									<div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 text-sm font-medium">
										Jahre
									</div>
								</div>
							</div>
							
							{/* Deutschland Ticket Toggle */}
							<div className="space-y-3">
								<label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
									<span className="text-lg">🇩🇪</span>
									Deutschlandticket
								</label>
								<div className="flex items-center gap-4">
									<label className="flex items-center gap-3 cursor-pointer">
										<input
											type="radio"
											name="deutschlandTicket"
											value="true"
											checked={formData.hasDeutschlandTicket === true}
											onChange={(e) => updateFormData({ hasDeutschlandTicket: true })}
											className="w-4 h-4 text-green-600 focus:ring-green-500"
											disabled={isParsingUrl}
										/>
										<span className="text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-lg">✓ Ja</span>
									</label>
									<label className="flex items-center gap-3 cursor-pointer">
										<input
											type="radio"
											name="deutschlandTicket"
											value="false"
											checked={formData.hasDeutschlandTicket === false}
											onChange={(e) => updateFormData({ hasDeutschlandTicket: false })}
											className="w-4 h-4 text-neutral-600 focus:ring-neutral-500"
											disabled={isParsingUrl}
										/>
										<span className="text-sm font-medium text-neutral-700 bg-neutral-100 px-3 py-1 rounded-lg">✗ Nein</span>
									</label>
								</div>
							</div>
						</div>
					</div>

					{/* Action Button */}
					<div className="mt-6 text-center">
						<button
							type="submit"
							disabled={isParsingUrl || !url.trim()}
							className={`relative w-full max-w-md mx-auto px-8 py-4 text-lg font-bold rounded-2xl shadow-lg transition-all duration-300 ${
								isParsingUrl || !url.trim() 
									? 'bg-neutral-300 text-neutral-500 cursor-not-allowed' 
									: 'bg-gradient-to-r from-db-red-600 to-db-red-700 hover:from-db-red-700 hover:to-db-red-800 text-white shadow-db-red-600/25 hover:shadow-xl hover:shadow-db-red-600/40 transform hover:scale-105'
							}`}
						>
							{isParsingUrl ? (
								<div className="flex items-center justify-center gap-3">
									{/* Modern Train Loading Animation */}
									<div className="relative">
										<div className="w-8 h-8 bg-gradient-to-br from-white via-blue-200 to-white rounded-full flex items-center justify-center animate-pulse">
											<span className="text-lg animate-bounce">🚄</span>
										</div>
										{/* Speed lines */}
										<div className="absolute top-1/2 left-8 transform -translate-y-1/2 flex gap-1">
											<div className="w-3 h-0.5 bg-white/70 rounded animate-pulse"></div>
											<div className="w-2 h-0.5 bg-white/50 rounded animate-pulse" style={{animationDelay: '0.2s'}}></div>
											<div className="w-1 h-0.5 bg-white/30 rounded animate-pulse" style={{animationDelay: '0.4s'}}></div>
										</div>
									</div>
									<span className="font-bold">Analysiere Verbindung...</span>
								</div>
							) : (
								<div className="flex items-center justify-center gap-3">
									<span className="text-xl">🚀</span>
									<span>Split-Ticketing starten</span>
									<span className="text-xl">💰</span>
								</div>
							)}
							
							{/* Shine Effect */}
							{!isParsingUrl && url.trim() && (
								<div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
							)}
						</button>
						
						{!url.trim() && (
							<p className="mt-4 text-sm text-neutral-500 flex items-center justify-center gap-2">
								<span>💡</span>
								Füge zuerst deinen DB-Text ein, um zu starten
							</p>
						)}
					</div>
				</form>
			</div>

			{/* Error Display */}
			{urlParseError && (
				<div className="mt-6 p-4 bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-2xl animate-fade-in">
					<div className="flex items-start gap-4">
						<div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
							<span className="text-xl">⚠️</span>
						</div>
						<div>
							<h4 className="font-bold text-red-900 mb-2">Ups, da ist etwas schiefgelaufen!</h4>
							<p className="text-red-800 text-sm leading-relaxed">{urlParseError}</p>
							<p className="text-red-700 text-xs mt-2">💡 Tipp: Stelle sicher, dass du den kompletten Text von bahn.de kopiert hast.</p>
						</div>
					</div>
				</div>
			)}
		</section>
	);
};

export default SearchForm;