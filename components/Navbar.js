"use client";
import Link from "next/link";
import { useState } from "react";

export const Navbar = () => {
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

	const toggleMobileMenu = () => {
		setIsMobileMenuOpen(!isMobileMenuOpen);
	};

	return (
		<header className="bg-white border-b border-neutral-200 sticky top-0 z-50 backdrop-blur-sm bg-white/95 mb-6">
			<div className="max-w-6xl mx-auto px-4">
				<nav
					className="flex justify-between items-center h-16"
					role="navigation"
					aria-label="Main navigation"
				>
					{/* Modern Brand */}
					<Link href="/" className="group flex items-center gap-3 transition-all duration-300 hover:scale-105">
						<span className="sr-only">Better Bahn - Startseite</span>
						<div className="relative">
							<div className="w-10 h-10 bg-gradient-to-br from-db-red-600 via-db-red-700 to-db-red-800 rounded-2xl flex items-center justify-center shadow-lg shadow-db-red-600/20 group-hover:shadow-xl group-hover:shadow-db-red-600/30 transition-all duration-300">
								<span className="text-white text-lg font-bold">🚄</span>
							</div>
							<div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-accent-400 to-accent-500 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 animate-pulse"></div>
						</div>
						<div className="font-black text-xl tracking-tight">
							<span className="text-db-red-600">Better</span>
							<span className="text-neutral-900 ml-1">Bahn</span>
						</div>
					</Link>

					{/* Status Badge */}
					<div className="hidden md:flex items-center gap-4">
						<div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-sm font-medium">
							<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
							Online
						</div>
					</div>

					{/* Mobile Menu Button */}
					<button
						onClick={toggleMobileMenu}
						className="md:hidden p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 transition-colors duration-200"
						aria-expanded={isMobileMenuOpen}
						aria-controls="mobile-menu"
						aria-label="Navigation menu"
					>
						<span className="sr-only">
							{isMobileMenuOpen ? "Menü schließen" : "Menü öffnen"}
						</span>
						{/* Modern Hamburger Icon */}
						<div className="w-5 h-5 flex flex-col justify-center items-center gap-1">
							<div className={`w-4 h-0.5 bg-neutral-700 transform transition-all duration-300 ${
								isMobileMenuOpen ? 'rotate-45 translate-y-1' : ''
							}`}></div>
							<div className={`w-4 h-0.5 bg-neutral-700 transform transition-all duration-300 ${
								isMobileMenuOpen ? 'opacity-0' : ''
							}`}></div>
							<div className={`w-4 h-0.5 bg-neutral-700 transform transition-all duration-300 ${
								isMobileMenuOpen ? '-rotate-45 -translate-y-1' : ''
							}`}></div>
						</div>
					</button>

					{/* Mobile Navigation Overlay */}
					{isMobileMenuOpen && (
						<div
							className="mobile-menu-overlay md:hidden"
							onClick={() => setIsMobileMenuOpen(false)}
							aria-hidden="true"
						/>
					)}

					{/* Mobile Navigation Menu */}
					<div
						id="mobile-menu"
						className={`fixed inset-y-0 right-0 z-50 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden ${
							isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
						}`}
					>
						<div className="flex flex-col h-full">
							{/* Mobile Menu Header */}
							<div className="flex justify-between items-center p-6 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-neutral-100">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-gradient-to-br from-db-red-600 to-db-red-800 rounded-2xl flex items-center justify-center shadow-lg">
										<span className="text-white font-bold">🚄</span>
									</div>
									<div className="font-black text-lg">
										<span className="text-db-red-600">Better</span>
										<span className="text-neutral-900 ml-1">Bahn</span>
									</div>
								</div>
								<button
									onClick={toggleMobileMenu}
									className="p-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 transition-colors duration-200"
									aria-label="Menü schließen"
								>
									<svg className="h-5 w-5 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>

							{/* Mobile Menu Content */}
							<div className="flex-1 py-8 px-6">
								<div className="text-center">
									<div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium mb-6">
										<div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
										System Online
									</div>
								</div>
								<Link 
									href="/" 
									className="flex items-center gap-3 px-4 py-3 text-neutral-800 hover:text-db-red-600 hover:bg-db-red-50 rounded-xl transition-colors duration-200"
									onClick={() => setIsMobileMenuOpen(false)}
								>
									<span className="text-lg">🏠</span>
									<span className="font-medium">Startseite</span>
								</Link>
							</div>

							{/* Mobile Menu Footer */}
							<div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50">
								<p className="text-xs text-neutral-600 text-center">
									© 2024 Better Bahn - Split-Ticketing für Deutschland
								</p>
							</div>
						</div>
					</div>
				</nav>
			</div>
		</header>
	);
};
