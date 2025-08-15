import React from "react";

export const Footer = () => {
	return (
		<footer className="mt-20 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white relative overflow-hidden">
			{/* Background Pattern */}
			<div className="absolute inset-0 opacity-5">
				<div className="absolute top-4 left-4 w-32 h-32 border border-white rounded-full"></div>
				<div className="absolute bottom-4 right-4 w-24 h-24 border border-white rounded-full"></div>
				<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 border border-white rounded-full"></div>
			</div>

			<div className="relative max-w-6xl mx-auto px-4 py-8">
				{/* Main Content - Horizontal Layout */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
					{/* Brand Section */}
					<div className="text-center md:text-left">
						<div className="inline-flex items-center space-x-3">
							<div className="w-12 h-12 bg-gradient-to-br from-db-red-500 via-db-red-600 to-db-red-700 rounded-2xl flex items-center justify-center shadow-lg shadow-db-red-600/20">
								<span className="text-white font-bold text-lg">🚄</span>
							</div>
							<span className="font-black text-2xl tracking-tight">
								<span className="text-db-red-400">Better</span>
								<span className="text-white ml-1">Bahn</span>
							</span>
						</div>
						<p className="text-neutral-300 text-sm mt-3 leading-relaxed">
							Split-Ticketing für Deutschland
						</p>
					</div>

					{/* Features Section */}
					<div className="text-center">
						<div className="flex flex-col sm:flex-row justify-center gap-3">
							<div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full backdrop-blur-sm text-sm">
								<span className="text-green-400">✓</span>
								<span className="font-medium">Kostenlos</span>
							</div>
							<div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full backdrop-blur-sm text-sm">
								<span className="text-green-400">✓</span>
								<span className="font-medium">Automatisch</span>
							</div>
							<div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full backdrop-blur-sm text-sm">
								<span className="text-green-400">✓</span>
								<span className="font-medium">Sofort</span>
							</div>
						</div>
					</div>

					{/* Author Section */}
					<div className="text-center md:text-right">
						<p className="text-neutral-300 text-sm">
							Ein Projekt von <span className="font-semibold text-white">Lukas Weihrauch</span>
						</p>
						<p className="text-neutral-400 text-xs mt-1">
							Made with ❤️ for train travelers
						</p>
					</div>
				</div>

				{/* Bottom Section - Compact */}
				<div className="mt-6 pt-6 border-t border-white/10">
					<div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-neutral-400">
						<p className="text-center md:text-left leading-relaxed">
							<strong className="text-neutral-300">Rechtlicher Hinweis:</strong> Dies ist kein offizielles Projekt der Deutsche Bahn AG. 
							Better Bahn ist ein unabhängiges Projekt. Alle Preise sind unverbindlich.
						</p>
						<p className="text-neutral-500 whitespace-nowrap">
							© 2024 Better Bahn
						</p>
					</div>
				</div>
			</div>
		</footer>
	);
};
