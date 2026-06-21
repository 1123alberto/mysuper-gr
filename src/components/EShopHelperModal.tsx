/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from 'react';
import { X, ExternalLink, Check, ShoppingBag, Info, ArrowRight } from 'lucide-react';

interface RetailerPrice {
    retailer: string;
    price: number;
    discount?: number;
    discount_percentage?: number;
    is_discount?: boolean;
}

interface PriceStat {
    min_price: number;
    max_price: number;
    avg_price: number;
    retailer_count: number;
}

interface Product {
    id: string;
    name: string;
    brand: string;
    image_url: string;
    category: string;
    unit: string;
    unit_quantity: number;
    price_stats: PriceStat;
    retailer_prices: RetailerPrice[];
    barcode?: string;
}

interface EShopHelperModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: Product[];
    retailer: string;
}

const RETAILER_INFO: { [key: string]: { name: string; url: string; color: string; bgClass: string; textClass: string; borderClass: string } } = {
    'sklavenitis': { 
        name: 'Σκλαβενίτης', 
        url: 'https://www.sklavenitis.gr', 
        color: '#ff6600',
        bgClass: 'bg-orange-500/10 dark:bg-orange-500/20',
        textClass: 'text-orange-600 dark:text-orange-400',
        borderClass: 'border-orange-500/20 focus:border-orange-500'
    },
    'ab_vasilopoulos': { 
        name: 'ΑΒ Βασιλόπουλος', 
        url: 'https://www.ab.gr', 
        color: '#005ca9',
        bgClass: 'bg-blue-500/10 dark:bg-blue-500/20',
        textClass: 'text-blue-600 dark:text-blue-400',
        borderClass: 'border-blue-500/20 focus:border-blue-500'
    },
    'mymarket': { 
        name: 'My Market', 
        url: 'https://eshop.mymarket.gr', 
        color: '#0f4c81',
        bgClass: 'bg-sky-500/10 dark:bg-sky-500/20',
        textClass: 'text-sky-600 dark:text-sky-400',
        borderClass: 'border-sky-500/20 focus:border-sky-500'
    },
    'kritikos': { 
        name: 'Κρητικός', 
        url: 'https://eshop.kritikos-sm.gr', 
        color: '#f59e0b',
        bgClass: 'bg-amber-500/10 dark:bg-amber-500/20',
        textClass: 'text-amber-600 dark:text-amber-400',
        borderClass: 'border-amber-500/20 focus:border-amber-500'
    },
    'masoutis': { 
        name: 'Μασούτης', 
        url: 'https://eshop.masoutis.gr', 
        color: '#00843d',
        bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/20',
        textClass: 'text-emerald-600 dark:text-emerald-400',
        borderClass: 'border-emerald-500/20 focus:border-emerald-500'
    },
    'lidl': { 
        name: 'Lidl', 
        url: 'https://www.lidl.gr', 
        color: '#e30613',
        bgClass: 'bg-red-500/10 dark:bg-red-500/20',
        textClass: 'text-red-600 dark:text-red-400',
        borderClass: 'border-red-500/20 focus:border-red-500'
    }
};

export default function EShopHelperModal({ isOpen, onClose, products, retailer }: EShopHelperModalProps) {
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

    if (!isOpen || !retailer) return null;

    const info = RETAILER_INFO[retailer] || {
        name: retailer,
        url: '#',
        color: '#6366f1',
        bgClass: 'bg-indigo-500/10',
        textClass: 'text-indigo-600 dark:text-indigo-400',
        borderClass: 'border-indigo-500/20'
    };

    // Filter products that have a price for this retailer
    const relevantProducts = products.filter(p => 
        p.retailer_prices.some(rp => rp.retailer === retailer)
    );

    const getSearchUrl = (product: Product) => {
        const barcodeVal = product.barcode || (/^\d{8,14}$/.test(product.id) ? product.id : '');
        const query = barcodeVal ? barcodeVal : `${product.brand || ''} ${product.name || ''}`.trim();

        if (query.length < 3) {
            return info.url; // Fallback to homepage if query is too short (< 3 characters) to avoid retailer search error
        }

        switch (retailer) {
            case 'sklavenitis':
                return `https://www.sklavenitis.gr/apotelesmata-anazitisis/?Query=${encodeURIComponent(query)}`;
            case 'ab_vasilopoulos':
                return `https://www.ab.gr/search?q=${encodeURIComponent(query)}`;
            case 'mymarket':
                return `https://www.mymarket.gr/search?query=${encodeURIComponent(query)}`;
            case 'kritikos':
                return `https://eshop.kritikos-sm.gr/anazitisi?q=${encodeURIComponent(query)}`;
            case 'masoutis':
                return `https://www.masoutis.gr/categories/index/search?text=${encodeURIComponent(query)}`;
            case 'lidl':
                return `https://www.lidl-hellas.gr/q/search?q=${encodeURIComponent(query)}`;
            default:
                return info.url; // Fallback to main home page
        }
    };

    const handleProductClick = (productId: string) => {
        setCompletedIds(prev => {
            const next = new Set(prev);
            if (next.has(productId)) {
                next.delete(productId);
            } else {
                next.add(productId);
            }
            return next;
        });
    };

    const progressPercentage = relevantProducts.length > 0 
        ? Math.round((completedIds.size / relevantProducts.length) * 100) 
        : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark Backdrop Overlay */}
            <div 
                className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
                onClick={onClose} 
            />

            {/* Modal Body Container */}
            <div className="relative w-full max-w-md bg-panel-bg rounded-3xl border border-border-custom shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-5 border-b border-border-custom flex items-center justify-between bg-panel-bg">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${info.bgClass} ${info.textClass}`}>
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base leading-none">Βοηθός e-Shop</h3>
                            <span className="text-[10px] text-slate-400 font-semibold mt-1 block">{info.name}</span>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-input-custom text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Bar */}
                {relevantProducts.length > 0 && (
                    <div className="w-full bg-slate-100 dark:bg-slate-800/40 h-1.5 relative overflow-hidden">
                        <div 
                            className="h-full transition-all duration-300 ease-out" 
                            style={{ 
                                width: `${progressPercentage}%`, 
                                backgroundColor: info.color 
                            }} 
                        />
                    </div>
                )}

                {/* Content Area */}
                <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
                    
                    {/* Step 1: Login Instructions */}
                    <div className="p-4 bg-input-custom rounded-2xl border border-border-custom flex flex-col gap-3">
                        <div className="flex items-start gap-2.5">
                            <div className={`p-1.5 rounded-lg mt-0.5 ${info.bgClass} ${info.textClass}`}>
                                <Info className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">Βήμα 1: Σύνδεση στο e-Shop</h4>
                                <p className="text-[11px] text-slate-400 font-medium mt-1 leading-relaxed">
                                    Ανοίξτε την επίσημη ιστοσελίδα και συνδεθείτε στον λογαριασμό σας ώστε να αποθηκευτούν τα προϊόντα στο καλάθι σας.
                                </p>
                            </div>
                        </div>
                        <a 
                            href={info.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 py-2 px-4 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition shadow-sm hover:shadow active:scale-[0.98]"
                            style={{ backgroundColor: info.color }}
                        >
                            <span>Μετάβαση στο {info.name}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>

                    {/* Step 2: Product List */}
                    <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider px-1">
                            Βήμα 2: Προσθήκη Προϊόντων ({completedIds.size}/{relevantProducts.length})
                        </h4>

                        {relevantProducts.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs font-medium">
                                Δεν υπάρχουν προϊόντα στο καλάθι με διαθέσιμες τιμές για αυτό το supermarket.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto pr-1">
                                {relevantProducts.map(p => {
                                    const isDone = completedIds.has(p.id);
                                    const retailerPrice = p.retailer_prices.find(rp => rp.retailer === retailer);
                                    const searchUrl = getSearchUrl(p);

                                    return (
                                        <div 
                                            key={p.id}
                                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 bg-panel-bg ${
                                                isDone 
                                                    ? 'border-emerald-500/20 dark:border-emerald-500/10 bg-emerald-500/[0.02] opacity-75' 
                                                    : 'border-border-custom hover:border-slate-300 dark:hover:border-slate-700'
                                            }`}
                                        >
                                            {/* Left side: Product Image + Info */}
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                {p.image_url ? (
                                                    <img 
                                                        src={p.image_url} 
                                                        alt={p.name} 
                                                        className="w-10 h-10 object-contain bg-white rounded-lg p-0.5 border border-slate-100 flex-shrink-0"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23cbd5e1" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0 text-slate-400">
                                                        <ShoppingBag className="w-5 h-5" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate leading-tight">
                                                        {p.name}
                                                    </h5>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                                                        {p.brand}
                                                    </span>
                                                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-extrabold block mt-0.5">
                                                        €{retailerPrice?.price.toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Right side: Action Button */}
                                            <a
                                                href={searchUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => handleProductClick(p.id)}
                                                className={`px-3 py-2 text-[10px] font-extrabold rounded-xl transition flex items-center gap-1 flex-shrink-0 cursor-pointer ${
                                                    isDone
                                                        ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                                                        : 'bg-input-custom hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                                                }`}
                                            >
                                                {isDone ? (
                                                    <>
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Προστέθηκε</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>Αναζήτηση</span>
                                                        <ArrowRight className="w-3.5 h-3.5" />
                                                    </>
                                                )}
                                            </a>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Footer Info */}
                <div className="p-4 bg-input-custom border-t border-border-custom flex items-center justify-center">
                    <p className="text-[9px] text-slate-400 font-semibold text-center leading-normal max-w-xs">
                        Σημείωση: Ανοίγοντας κάθε προϊόν, απλώς πατήστε το κουμπί «Προσθήκη στο καλάθι» στην ιστοσελίδα του καταστήματος.
                    </p>
                </div>
            </div>
        </div>
    );
}
