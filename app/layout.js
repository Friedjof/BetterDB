// Importiere Google Fonts und Komponenten
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

// Konfiguriere die Schriftarten
const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

// Metadaten für die Seite definieren
export const metadata = {
	title: "Better Bahn - Split-Ticketing",
	description: "Eine App von Lukas Weihrauch",
};

// Haupt-Layout-Komponente für alle Seiten
export default function RootLayout({ children }) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
			>
				{/* Navigation einbinden */}
				<Navbar />
				{/* Seiteninhalt - nimmt verfügbaren Platz ein */}
				<main className="flex-1 container mx-auto px-2 py-6">
					{children}
				</main>
				{/* Fußzeile einbinden - haftet immer am unteren Rand */}
				<Footer />
			</body>
		</html>
	);
}
