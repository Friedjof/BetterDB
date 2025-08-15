"use client";

// Importiere notwendige React-Funktionen und Komponenten
import { useState } from "react";
import SearchForm from "@/components/SearchForm";

// Haupt-Startseiten-Komponente
export default function Home() {
	// State für Fehlermeldungen
	const [error, setError] = useState("");

	return (
		<>
			{/* Fehlermeldung anzeigen, falls vorhanden */}
			{error && (
				<div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
					{error}
				</div>
			)}

			{/* Suchformular für Bahnverbindungen */}
			<SearchForm />
		</>
	);
}
