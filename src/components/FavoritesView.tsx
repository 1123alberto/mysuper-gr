import React from 'react';
import { Heart, Bell, ShoppingBag, ShoppingBasket, Trash2, Share2, Store, Info, Trophy, PiggyBank, MapPin } from 'lucide-react';

interface PriceStat {
    min_price: number;
    max_price: number;
    avg_price: number;
    retailer_count: number;
}

interface RetailerPrice {
    retailer: string;
    price: number;
    discount?: number;
    discount_percentage?: number;
    is_discount?: boolean;
    last_updated?: string;
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
    history?: { timestamp: string; retailer_prices: RetailerPrice[] }[];
    barcode?: string;
    updated_at?: string;
}

interface SingleStoreResult {
    retailerId: string;
    totalCost: number;
    itemsCount: number;
    totalItems: number;
}

interface SplitTripGroup {
    retailerId: string;
    items: { name: string; price: number }[];
    total: number;
}

interface SplitTripData {
    groups: SplitTripGroup[];
    totalCost: number;
    savings: number;
}

interface BasketOptimizerGroup {
    retailerId: string;
    items: { id: string; name: string; price: number }[];
    total: number;
}

interface BasketOptimizerOption {
    stores: string[];
    stops: number;
    totalCost: number;
    coveredItems: number;
    totalItems: number;
    missingItems: Product[];
    groups: BasketOptimizerGroup[];
    complete: boolean;
}

interface BasketOptimizerResult {
    options: BasketOptimizerOption[];
    convenient?: BasketOptimizerOption;
    recommended?: BasketOptimizerOption;
    maximumSavings?: BasketOptimizerOption;
    baselineCost: number;
    bestPossibleSaving: number;
    hasEnoughData: boolean;
    missingPriceCount: number;
}

interface FavoritesViewProps {
    language: 'el' | 'en';
    favorites: Product[];
    activeBasketIds: string[];
    favoritesSubTab: 'pantry' | 'basket';
    setFavoritesSubTab: (tab: 'pantry' | 'basket') => void;
    pushSupported: boolean;
    isSubscribed: boolean;
    subscribeToPush: () => void;
    unsubscribeFromPush: () => void;
    toggleBasketItem: (id: string) => void;
    toggleFavorite: (e: React.MouseEvent, product: Product) => void;
    clearAllFavorites: () => void;
    selectAllBasketItems: () => void;
    deselectAllBasketItems: () => void;
    activeBasketProducts: Product[];
    singleStoreResults: SingleStoreResult[];
    splitTripData: SplitTripData;
    activeFavRetailers: string[];
    RETAILER_META: Record<string, { name: string }>;
    setActiveMapRetailer: (retailerId: string) => void;
    setIsShareOpen: (open: boolean) => void;
    setIsHelperOpen: (open: boolean) => void;
    setHelperRetailer: (retailerId: string) => void;
    discountedBasketProducts: Product[];
    pushStatus: string;
    showOptimizerResults: boolean;
    setShowOptimizerResults: (show: boolean) => void;
    basketOptimizer: BasketOptimizerResult;
}

const retailerLogoUrl = (retailerId: string) => `/api/images/retailer/${retailerId}`;

const BASKET_COPY = {
    el: {
        emptyFavoritesTitle: 'Η λίστα σας είναι άδεια',
        emptyFavoritesText: 'Προσθέστε προϊόντα στα αγαπημένα σας για να τα συγκρίνετε και να τα βελτιστοποιήσετε εδώ.',
        saleAlertsTitle: 'Ειδοποιήσεις για Προσφορές',
        saleAlertsText: 'Λάβετε ειδοποίηση όταν προϊόντα του καλαθιού σας έχουν ένδειξη προσφοράς.',
        saleAlertsNow: 'Τώρα',
        onOffer: 'σε προσφορά',
        disable: 'Απενεργοποίηση',
        enable: 'Ενεργοποίηση',
        favoritesTitle: 'Τα Αγαπημένα μου',
        favoritesIntro: 'Διαχειριστείτε τη λίστα Pantry και το ενεργό καλάθι αγορών σας.',
        pantryTab: 'Λίστα Pantry',
        activeBasketTab: 'Ενεργό Καλάθι',
        pantryTitle: 'Λίστα Pantry',
        pantryText: 'Επιλέξτε ποια προϊόντα θα προστεθούν στο ενεργό καλάθι για βελτιστοποίηση.',
        selectAll: 'Επιλογή Όλων',
        deselectAll: 'Απεπιλογή Όλων',
        generic: 'Γενικό',
        from: 'Από',
        removeFromPantry: 'Αφαίρεση από Pantry',
        emptyBasketTitle: 'Το Καλάθι σας είναι άδειο',
        emptyBasketText: 'Επιλέξτε προϊόντα από τη λίστα Pantry για να ενεργοποιήσετε τους αλγόριθμους σύγκρισης και βελτιστοποίησης τιμών.',
        goToPantry: 'Μετάβαση στη λίστα Pantry',
        inBasket: 'προϊόντα στο καλάθι',
        optimizerTitle: 'Βελτιστοποίηση Καλαθιού',
        optimizerText: 'Βρείτε αν σας συμφέρει μία στάση ή διαμοιρασμός σε 2-3 σούπερ μάρκετ, με καθαρή εικόνα εξοικονόμησης.',
        estimate: 'Εκτίμηση',
        maxBenefit: 'Μέγιστο όφελος',
        optimizeBasket: 'Βελτιστοποίηση Καλαθιού',
        missingPrices: (count: number) => `Δεν υπάρχουν αρκετά δεδομένα τιμών για ${count} προϊόντα. Η σύγκριση γίνεται με όσα προϊόντα έχουν διαθέσιμες τιμές.`,
        result: 'Αποτέλεσμα',
        saveUpTo: (amount: string) => `Μπορείτε να εξοικονομήσετε έως €${amount}`,
        oneStoreResult: 'Για λίγα ευρώ παραπάνω, μπορείτε να τα πάρετε όλα από ένα κατάστημα.',
        balancedResult: 'Η προτεινόμενη λύση κρατά καλή ισορροπία ανάμεσα στην οικονομία και την ευκολία.',
        mostConvenient: 'Πιο βολικό',
        allInOneStop: 'Όλα σε μία στάση',
        recommended: 'Προτεινόμενο',
        bestBalance: 'Καλύτερη σχέση οικονομίας και ευκολίας',
        maximumSavings: 'Μέγιστη εξοικονόμηση',
        lowestCost: 'Χαμηλότερο συνολικό κόστος',
        availableProducts: 'Διαθέσιμα προϊόντα',
        savings: 'Εξοικονόμηση',
        byStoreTitle: 'Τι να αγοράσετε από κάθε σούπερ μάρκετ',
        byStoreText: 'Ανάλυση για την προτεινόμενη επιλογή.',
        missingRecommended: (count: number) => `Δεν υπάρχουν τιμές για ${count} προϊόντα στην προτεινόμενη επιλογή.`,
        activeProductsTitle: 'Προϊόντα στο Ενεργό Καλάθι',
        activeProductsText: 'Ενεργά προϊόντα που συμμετέχουν στη βελτιστοποίηση. Ξεκλικάρετε για να τα εξαιρέσετε προσωρινά.',
        basketPriceComparison: 'Σύγκριση Τιμών Καλαθιού ανά Σούπερ Μάρκετ',
        shareList: 'Κοινοποίηση Λίστας',
        clearList: 'Καθαρισμός Λίστας',
        product: 'Προϊόν',
        cheapest: 'Φθηνότερο',
        oneStoreTitle: 'Αγορά από 1 Σούπερ Μάρκετ',
        oneStoreText: 'Σύγκριση του συνολικού κόστους για όλα τα αγαπημένα σας προϊόντα αν τα αγοράσετε από ένα μόνο κατάστημα.',
        noSingleStoreTitle: 'Κανένα κατάστημα δεν έχει όλα τα προϊόντα',
        noSingleStoreText: 'Κανένα μεμονωμένο σούπερ μάρκετ δεν διαθέτει το 100% των επιλογών σας. Δείτε την πρόταση Split-Trip παρακάτω για αγορά από τα φθηνότερα.',
        availability: 'διαθεσιμότητα',
        viewOnMap: 'Κάντε κλικ για προβολή στο χάρτη',
        onlineOrder: 'Online Παραγγελία',
        order: 'Παραγγελία',
        splitTripTitle: 'Βέλτιστος Διαμοιρασμός (Split-Trip)',
        splitTripText: 'Συνδυασμός καταστημάτων αγοράζοντας κάθε προϊόν από εκεί που είναι φθηνότερο για τη μέγιστη εξοικονόμηση.',
        totalCost: 'Συνολικό Κόστος',
        viewMap: 'Προβολή στο χάρτη',
        eShopHelper: 'Βοηθός e-Shop'
    },
    en: {
        emptyFavoritesTitle: 'Your Pantry List is empty',
        emptyFavoritesText: 'Save products here so you can compare prices and build a smarter basket later.',
        saleAlertsTitle: 'Offer Alerts',
        saleAlertsText: 'Get notified when products in your basket go on offer.',
        saleAlertsNow: 'Now',
        onOffer: 'on offer',
        disable: 'Turn Off',
        enable: 'Turn On',
        favoritesTitle: 'My Grocery List',
        favoritesIntro: 'Manage your Pantry List and choose what goes into your Active Basket.',
        pantryTab: 'Pantry List',
        activeBasketTab: 'Active Basket',
        pantryTitle: 'Pantry List',
        pantryText: 'Choose which saved products to include in your Active Basket.',
        selectAll: 'Select All',
        deselectAll: 'Clear Selection',
        generic: 'Generic',
        from: 'From',
        removeFromPantry: 'Remove from Pantry',
        emptyBasketTitle: 'Your Active Basket is empty',
        emptyBasketText: 'Select products from your Pantry List to compare prices and find the best way to shop.',
        goToPantry: 'Go to Pantry List',
        inBasket: 'products in basket',
        optimizerTitle: 'Optimize Basket',
        optimizerText: 'See whether one store is enough, or whether splitting your basket across 2-3 supermarkets saves more.',
        estimate: 'Estimate',
        maxBenefit: 'Maximum Savings',
        optimizeBasket: 'Optimize Basket',
        missingPrices: (count: number) => `We do not have enough price data for ${count} ${count === 1 ? 'product' : 'products'}. The comparison uses the products with available prices.`,
        result: 'Result',
        saveUpTo: (amount: string) => `You could save up to €${amount}`,
        oneStoreResult: 'For a little more, you can get everything from one store.',
        balancedResult: 'Recommended gives you a good balance of savings and convenience.',
        mostConvenient: 'Most Convenient',
        allInOneStop: 'Everything in one stop',
        recommended: 'Recommended',
        bestBalance: 'Best balance of savings and convenience',
        maximumSavings: 'Maximum Savings',
        lowestCost: 'Lowest total cost',
        availableProducts: 'Available products',
        savings: 'Savings',
        byStoreTitle: 'What to buy from each supermarket',
        byStoreText: 'Breakdown for the recommended option.',
        missingRecommended: (count: number) => `Prices are missing for ${count} ${count === 1 ? 'product' : 'products'} in the recommended option.`,
        activeProductsTitle: 'Products in Active Basket',
        activeProductsText: 'These products are included in basket optimization. Untick any item to leave it out for now.',
        basketPriceComparison: 'Basket Price Comparison by Supermarket',
        shareList: 'Share List',
        clearList: 'Clear List',
        product: 'Product',
        cheapest: 'Best Price',
        oneStoreTitle: 'Shop at One Supermarket',
        oneStoreText: 'Compare the total cost if you buy every item in your Active Basket from one store.',
        noSingleStoreTitle: 'No single store has every product',
        noSingleStoreText: 'No supermarket currently has 100% of your basket. See the split-trip option below to buy each item where it costs less.',
        availability: 'availability',
        viewOnMap: 'Click to view on map',
        onlineOrder: 'Order Online',
        order: 'Order',
        splitTripTitle: 'Split Basket for Maximum Savings',
        splitTripText: 'Combine supermarkets by buying each product wherever it is cheapest.',
        totalCost: 'Total Cost',
        viewMap: 'View on map',
        eShopHelper: 'e-Shop Helper'
    }
} as const;

// Calculate cheapest retailer for a product (local helper)
const getCheapestRetailer = (product: Product) => {
    if (!product.retailer_prices || !product.retailer_prices.length) return null;
    let cheapest = product.retailer_prices[0];
    for (const p of product.retailer_prices) {
        if (p.price < cheapest.price) {
            cheapest = p;
        }
    }
    return cheapest;
};

export default function FavoritesView({
    language,
    favorites,
    activeBasketIds,
    favoritesSubTab,
    setFavoritesSubTab,
    pushSupported,
    isSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
    toggleBasketItem,
    toggleFavorite,
    clearAllFavorites,
    selectAllBasketItems,
    deselectAllBasketItems,
    activeBasketProducts,
    singleStoreResults,
    splitTripData,
    activeFavRetailers,
    RETAILER_META,
    setActiveMapRetailer,
    setIsShareOpen,
    setIsHelperOpen,
    setHelperRetailer,
    discountedBasketProducts,
    pushStatus,
    showOptimizerResults,
    setShowOptimizerResults,
    basketOptimizer,
}: FavoritesViewProps) {
    const copy = BASKET_COPY[language];
    const productCountLabel = (count: number) => language === 'en'
        ? `${count} ${count === 1 ? 'product' : 'products'}`
        : `${count} ${count === 1 ? 'προϊόν' : 'προϊόντα'}`;
    const stopCountLabel = (count: number) => language === 'en'
        ? `${count} ${count === 1 ? 'stop' : 'stops'}`
        : `${count} ${count === 1 ? 'στάση' : 'στάσεις'}`;

    return (
        <div className="space-y-8">
            {favorites.length === 0 ? (
                <div className="h-[60vh] flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                    <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-4">
                        <Heart className="w-8 h-8 fill-current" />
                    </div>
                    <h3 className="text-lg font-bold mb-1">{copy.emptyFavoritesTitle}</h3>
                    <p className="text-sm text-slate-500">{copy.emptyFavoritesText}</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {pushSupported && (
                        <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        {copy.saleAlertsTitle}
                                    </h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        {copy.saleAlertsText}
                                        {discountedBasketProducts.length > 0 && (
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400"> {copy.saleAlertsNow}: {discountedBasketProducts.length} {copy.onOffer}.</span>
                                        )}
                                    </p>
                                    {pushStatus && (
                                        <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-1">
                                            {pushStatus}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={isSubscribed ? unsubscribeFromPush : subscribeToPush}
                                className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
                                    isSubscribed
                                        ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                                        : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                                }`}
                            >
                                {isSubscribed ? copy.disable : copy.enable}
                            </button>
                        </div>
                    )}
                    
                    {/* Sub-tab Navigation */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-border-custom gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                                <span>{copy.favoritesTitle}</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">{copy.favoritesIntro}</p>
                        </div>

                        <div className="flex bg-input-custom p-1 rounded-xl w-full sm:w-auto border border-border-custom/50">
                            <button 
                                className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${favoritesSubTab === 'pantry' ? 'bg-background shadow text-indigo-500 dark:text-indigo-400' : 'text-slate-500 hover:text-foreground'}`}
                                onClick={() => setFavoritesSubTab('pantry')}
                            >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>{copy.pantryTab} ({favorites.length})</span>
                            </button>
                            <button 
                                className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${favoritesSubTab === 'basket' ? 'bg-background shadow text-emerald-500 dark:text-emerald-400' : 'text-slate-500 hover:text-foreground'}`}
                                onClick={() => setFavoritesSubTab('basket')}
                            >
                                <ShoppingBasket className="w-3.5 h-3.5" />
                                <span>{copy.activeBasketTab} ({activeBasketIds.length})</span>
                            </button>
                        </div>
                    </div>

                    {favoritesSubTab === 'pantry' ? (
                        /* Pantry List Sub-Tab */
                        <div className="bg-card-bg border border-border-custom rounded-2xl p-6 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                        <ShoppingBag className="w-5 h-5 text-indigo-500" />
                                        <span>{copy.pantryTitle}</span>
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">{copy.pantryText}</p>
                                </div>
                                <div className="flex gap-2.5">
                                    <button 
                                        onClick={selectAllBasketItems}
                                        className="px-3 py-1.5 text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-xl transition"
                                    >
                                        {copy.selectAll}
                                    </button>
                                    <button 
                                        onClick={deselectAllBasketItems}
                                        className="px-3 py-1.5 text-xs font-semibold bg-input-custom text-slate-650 dark:text-slate-400 border border-slate-500/20 hover:bg-input-custom rounded-xl transition"
                                    >
                                        {copy.deselectAll}
                                    </button>
                                </div>
                            </div>

                            {/* Pantry Selection Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                                {favorites.map(prod => {
                                    const isSelected = activeBasketIds.includes(prod.id);
                                    const cheapest = getCheapestRetailer(prod);
                                    return (
                                        <div 
                                            key={prod.id}
                                            onClick={() => toggleBasketItem(prod.id)}
                                            className={`
                                                relative p-4 rounded-xl border transition cursor-pointer flex items-center gap-3 select-none
                                                ${isSelected 
                                                    ? 'bg-indigo-500/5 border-indigo-500/45 dark:border-indigo-500/30 shadow-sm' 
                                                    : 'bg-input-custom border-transparent opacity-60 hover:opacity-100'}
                                            `}
                                        >
                                            <div className="flex items-center shrink-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected}
                                                    readOnly
                                                    className="w-4 h-4 rounded text-indigo-500 border-slate-300 focus:ring-indigo-500 pointer-events-none"
                                                />
                                            </div>
                                            <div className="flex items-center justify-center bg-white rounded p-1 w-10 h-10 border border-border-custom shrink-0">
                                                <img 
                                                    src={prod.image_url} 
                                                    alt="" 
                                                    className="max-h-full max-w-full object-contain"
                                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=40&q=80' }}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[9px] font-bold text-indigo-500 block uppercase tracking-wider truncate">{prod.brand || copy.generic}</span>
                                                <strong className="text-xs font-semibold text-slate-800 dark:text-slate-100 block line-clamp-2 leading-snug">{prod.name}</strong>
                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                                                    {cheapest ? `${copy.from} €${cheapest.price.toFixed(2)}` : '-'}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFavorite(e, prod);
                                                }}
                                                className="p-1 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded transition shrink-0"
                                                title={copy.removeFromPantry}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        /* Active Shopping Basket Sub-Tab */
                        activeBasketProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center bg-input-custom rounded-2xl border border-dashed border-border-custom p-6 max-w-md mx-auto my-12">
                                <ShoppingBag className="w-12 h-12 text-indigo-500 mb-3 animate-pulse" />
                                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{copy.emptyBasketTitle}</div>
                                <p className="text-xs text-slate-400 mt-1 max-w-[280px] mb-4">{copy.emptyBasketText}</p>
                                <button 
                                    onClick={() => setFavoritesSubTab('pantry')}
                                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition"
                                >
                                    {copy.goToPantry}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <section className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl overflow-hidden">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                        <div>
                                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold mb-4">
                                                <ShoppingBasket className="w-3.5 h-3.5" />
                                                <span>{language === 'en' ? `${productCountLabel(activeBasketProducts.length)} in basket` : `${productCountLabel(activeBasketProducts.length)} στο καλάθι`}</span>
                                            </div>
                                            <h3 className="text-2xl sm:text-3xl font-black tracking-tight">{copy.optimizerTitle}</h3>
                                            <p className="text-sm text-white/80 mt-2 max-w-xl">
                                                {copy.optimizerText}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:min-w-[420px]">
                                            <div className="bg-white/10 border border-white/15 rounded-2xl p-4">
                                                <span className="text-[10px] font-bold text-white/70 uppercase">{copy.estimate}</span>
                                                <strong className="block text-xl font-black mt-1">€{(basketOptimizer.recommended?.totalCost || 0).toFixed(2)}</strong>
                                            </div>
                                            <div className="bg-white/10 border border-white/15 rounded-2xl p-4">
                                                <span className="text-[10px] font-bold text-white/70 uppercase">{copy.maxBenefit}</span>
                                                <strong className="block text-xl font-black text-emerald-200 mt-1">€{basketOptimizer.bestPossibleSaving.toFixed(2)}</strong>
                                            </div>
                                            <button
                                                onClick={() => setShowOptimizerResults(true)}
                                                className="col-span-2 sm:col-span-1 min-h-16 px-5 py-3 bg-white text-indigo-800 hover:bg-indigo-50 rounded-2xl font-black text-sm shadow-lg transition active:scale-[0.98]"
                                            >
                                                {copy.optimizeBasket}
                                            </button>
                                        </div>
                                    </div>
                                    {basketOptimizer.missingPriceCount > 0 && (
                                        <div className="mt-5 flex items-start gap-2 text-xs text-amber-100 bg-amber-500/15 border border-amber-200/20 rounded-2xl p-3">
                                            <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                            <span>{copy.missingPrices(basketOptimizer.missingPriceCount)}</span>
                                        </div>
                                    )}
                                </section>

                                {showOptimizerResults && basketOptimizer.hasEnoughData && (
                                    <section className="space-y-5">
                                        <div className="bg-card-bg border border-emerald-500/20 rounded-3xl p-6 shadow-sm">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{copy.result}</span>
                                            <h3 className="text-2xl font-black text-slate-850 dark:text-slate-100 mt-1">
                                                {copy.saveUpTo(basketOptimizer.bestPossibleSaving.toFixed(2))}
                                            </h3>
                                            <p className="text-sm text-slate-500 mt-2">
                                                {basketOptimizer.recommended?.stops === 1
                                                    ? copy.oneStoreResult
                                                    : copy.balancedResult}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                            {[
                                                {
                                                    key: 'convenient',
                                                    title: copy.mostConvenient,
                                                    option: basketOptimizer.convenient,
                                                    accent: 'border-slate-200 dark:border-slate-700',
                                                    badge: copy.allInOneStop,
                                                    icon: <Store className="w-5 h-5" />
                                                },
                                                {
                                                    key: 'recommended',
                                                    title: copy.recommended,
                                                    option: basketOptimizer.recommended,
                                                    accent: 'border-emerald-500/50 ring-2 ring-emerald-500/10 shadow-lg',
                                                    badge: copy.bestBalance,
                                                    icon: <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
                                                },
                                                {
                                                    key: 'maximum',
                                                    title: copy.maximumSavings,
                                                    option: basketOptimizer.maximumSavings,
                                                    accent: 'border-indigo-500/30',
                                                    badge: copy.lowestCost,
                                                    icon: <PiggyBank className="w-5 h-5" />
                                                }
                                            ].map((card) => {
                                                const option = card.option;
                                                if (!option) return null;
                                                const saving = Math.max(0, basketOptimizer.baselineCost - option.totalCost);
                                                return (
                                                    <div key={card.key} className={`bg-card-bg border ${card.accent} rounded-3xl p-5 flex flex-col gap-5`}>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                                                                    {card.icon}
                                                                    <h4 className="text-base font-black text-slate-850 dark:text-slate-100">{card.title}</h4>
                                                                </div>
                                                                <p className="text-xs text-slate-500 mt-1">{card.badge}</p>
                                                            </div>
                                                            <span className="px-2.5 py-1 rounded-full bg-input-custom text-[10px] font-black text-slate-650 dark:text-slate-300">
                                                                {stopCountLabel(option.stops)}
                                                            </span>
                                                        </div>

                                                        <div>
                                                            <strong className="text-3xl font-black text-emerald-600 dark:text-emerald-400">€{option.totalCost.toFixed(2)}</strong>
                                                            <div className="text-sm font-bold text-slate-500 mt-1">{copy.savings} €{saving.toFixed(2)}</div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-xs font-semibold text-slate-500">
                                                                <span>{copy.availableProducts}</span>
                                                                <span>{option.coveredItems}/{option.totalItems}</span>
                                                            </div>
                                                            <div className="h-2 rounded-full bg-input-custom overflow-hidden">
                                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.round((option.coveredItems / Math.max(option.totalItems, 1)) * 100)}%` }} />
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap gap-2">
                                                            {option.stores.map((storeId) => (
                                                                <span key={storeId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-input-custom text-[10px] font-bold text-slate-650 dark:text-slate-300">
                                                                    <img src={retailerLogoUrl(storeId)} alt="" className="w-4 h-4 rounded-full object-cover" />
                                                                    {RETAILER_META[storeId]?.name || storeId}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {basketOptimizer.recommended && (
                                            <div className="bg-card-bg border border-border-custom rounded-3xl p-6 shadow-sm">
                                                <div className="flex items-center justify-between gap-4 mb-5">
                                                    <div>
                                                        <h4 className="text-base font-black text-slate-850 dark:text-slate-100">{copy.byStoreTitle}</h4>
                                                        <p className="text-xs text-slate-500 mt-1">{copy.byStoreText}</p>
                                                    </div>
                                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">€{basketOptimizer.recommended.totalCost.toFixed(2)}</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                    {basketOptimizer.recommended.groups.map((group) => (
                                                        <details key={group.retailerId} className="group bg-input-custom rounded-2xl border border-border-custom overflow-hidden" open>
                                                            <summary className="list-none cursor-pointer p-4 flex items-center justify-between gap-3">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <img src={retailerLogoUrl(group.retailerId)} alt="" className="w-8 h-8 rounded-full object-cover" />
                                                                    <div className="min-w-0">
                                                                        <div className="text-sm font-black truncate">{RETAILER_META[group.retailerId]?.name || group.retailerId}</div>
                                                                        <div className="text-[10px] text-slate-500 font-bold">{productCountLabel(group.items.length)}</div>
                                                                    </div>
                                                                </div>
                                                                <strong className="text-sm text-emerald-600 dark:text-emerald-400">€{group.total.toFixed(2)}</strong>
                                                            </summary>
                                                            <div className="px-4 pb-4 space-y-2">
                                                                {group.items.map((item) => (
                                                                    <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                                                                        <span className="truncate text-slate-650 dark:text-slate-300">{item.name}</span>
                                                                        <span className="font-bold text-slate-850 dark:text-slate-100">€{item.price.toFixed(2)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </details>
                                                    ))}
                                                </div>
                                                {basketOptimizer.recommended.missingItems.length > 0 && (
                                                    <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">
                                                        {copy.missingRecommended(basketOptimizer.recommended.missingItems.length)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </section>
                                )}

                                {/* Active Basket Items Quick Toggle/Summary Grid */}
                                <div className="bg-card-bg border border-border-custom rounded-2xl p-6 shadow-sm">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                <ShoppingBasket className="w-5 h-5 text-indigo-500" />
                                                <span>{copy.activeProductsTitle} ({activeBasketProducts.length})</span>
                                            </h3>
                                            <p className="text-xs text-slate-400 mt-1">{copy.activeProductsText}</p>
                                        </div>
                                        <div className="flex gap-2.5">
                                            <button 
                                                onClick={deselectAllBasketItems}
                                                className="px-3 py-1.5 text-xs font-semibold bg-input-custom text-slate-650 dark:text-slate-400 border border-slate-500/20 hover:bg-input-custom rounded-xl transition"
                                            >
                                                {copy.deselectAll}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Active Basket Selection Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                                        {activeBasketProducts.map(prod => {
                                            const cheapest = getCheapestRetailer(prod);
                                            return (
                                                <div 
                                                    key={prod.id}
                                                    onClick={() => toggleBasketItem(prod.id)}
                                                    className="relative p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 transition cursor-pointer flex items-center gap-3 select-none hover:bg-indigo-500/10"
                                                >
                                                    <div className="flex items-center justify-center bg-white rounded p-1 w-10 h-10 border border-border-custom">
                                                        <img 
                                                            src={prod.image_url} 
                                                            alt="" 
                                                            className="max-h-full max-w-full object-contain"
                                                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=40&q=80' }}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[9px] font-bold text-indigo-500 block uppercase tracking-wider truncate">{prod.brand || copy.generic}</span>
                                                        <strong className="text-xs font-semibold text-slate-800 dark:text-slate-100 block truncate">{prod.name}</strong>
                                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                                                            {cheapest ? `${copy.from} €${cheapest.price.toFixed(2)}` : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={true}
                                                            readOnly
                                                            className="w-4 h-4 rounded text-indigo-500 border-indigo-500 focus:ring-indigo-500 pointer-events-none"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Favorites Table Card */}
                                <div className="bg-card-bg border border-border-custom rounded-2xl p-6 shadow-sm">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{copy.basketPriceComparison}</h3>
                                        <div className="flex gap-2.5">
                                            <button 
                                                onClick={() => setIsShareOpen(true)}
                                                className="px-4 py-2 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl flex items-center gap-1.5 transition"
                                            >
                                                <Share2 className="w-3.5 h-3.5" />
                                                <span>{copy.shareList}</span>
                                            </button>
                                            <button 
                                                onClick={clearAllFavorites}
                                                className="px-4 py-2 text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl flex items-center gap-1.5 transition"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>{copy.clearList}</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm border-collapse">
                                            <thead>
                                                <tr className="border-b border-border-custom">
                                                    <th className="py-3 px-4 font-bold text-slate-400 text-xs uppercase">{copy.product}</th>
                                                    <th className="py-3 px-4 font-bold text-slate-400 text-xs uppercase text-center bg-indigo-500/5">{copy.cheapest}</th>
                                                    {activeFavRetailers.map(retId => (
                                                        <th key={retId} className="py-3 px-4 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <img className="w-6 h-6 rounded-full object-cover" src={retailerLogoUrl(retId)} alt="" />
                                                                <span className="text-[10px] font-semibold text-slate-500">{RETAILER_META[retId]?.name || retId}</span>
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeBasketProducts.map(prod => {
                                                    const cheapest = getCheapestRetailer(prod);
                                                    return (
                                                        <tr key={prod.id} className="border-b border-border-custom/50 hover:bg-input-custom transition">
                                                            <td className="py-3 px-4 flex items-center gap-3 min-w-[280px]">
                                                                <img src={prod.image_url} alt="" className="w-10 h-10 object-contain rounded bg-white" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=40&q=80' }} />
                                                                <div>
                                                                    <span className="text-[10px] font-semibold text-indigo-500 block">{prod.brand}</span>
                                                                    <strong className="text-xs font-semibold text-slate-800 dark:text-slate-100">{prod.name}</strong>
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400 bg-indigo-500/5">
                                                                €{cheapest?.price.toFixed(2)}
                                                            </td>
                                                            {activeFavRetailers.map(retId => {
                                                                const priceObj = prod.retailer_prices.find(rp => rp.retailer === retId);
                                                                const isCheapest = priceObj && cheapest && priceObj.price === cheapest.price;
                                                                return (
                                                                    <td key={retId} className={`py-3 px-4 text-center font-semibold text-xs ${isCheapest ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                        {priceObj ? `€${priceObj.price.toFixed(2)}` : '-'}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Optimizer Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    
                                    {/* Optimizer 1: Single Store */}
                                    <div className="bg-card-bg border border-border-custom rounded-2xl p-6 shadow-sm flex flex-col">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Store className="w-5 h-5 text-indigo-500" />
                                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{copy.oneStoreTitle}</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-6">{copy.oneStoreText}</p>
                                        
                                        <div className="space-y-4 flex-1">
                                            {singleStoreResults.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-center bg-input-custom rounded-xl p-4 border border-border-custom">
                                                    <Info className="w-8 h-8 text-amber-500 mb-2" />
                                                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300">{copy.noSingleStoreTitle}</div>
                                                    <p className="text-[10px] text-slate-400 mt-1 max-w-[240px]">{copy.noSingleStoreText}</p>
                                                </div>
                                            ) : (
                                                singleStoreResults.map((res, index) => {
                                                    const meta = RETAILER_META[res.retailerId] || { name: res.retailerId };
                                                    const isWinner = index === 0;
                                                    
                                                    return (
                                                        <div 
                                                            key={res.retailerId}
                                                            onClick={() => setActiveMapRetailer(res.retailerId)}
                                                            className={`
                                                                flex items-center justify-between p-4 rounded-xl border transition cursor-pointer
                                                                ${isWinner 
                                                                    ? 'bg-emerald-500/5 border-emerald-500/30 dark:border-emerald-500/20 shadow-emerald-500/5 shadow-md hover:border-emerald-500/50' 
                                                                    : 'bg-input-custom border-transparent hover:border-border-custom'}
                                                            `}
                                                            title={copy.viewOnMap}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <img className="w-9 h-9 rounded-full object-cover border border-border-custom" src={retailerLogoUrl(res.retailerId)} alt="" />
                                                                <div>
                                                                    <div className="text-xs font-bold flex items-center gap-1">
                                                                        <span>{meta.name}</span>
                                                                        {isWinner && <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-semibold">{res.itemsCount}/{res.totalItems} {language === 'en' ? 'products' : 'προϊόντα'} • 100% {copy.availability}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <div className="text-right">
                                                                    <div className={`text-base font-extrabold ${isWinner ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-350'}`}>€{res.totalCost.toFixed(2)}</div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setHelperRetailer(res.retailerId);
                                                                        setIsHelperOpen(true);
                                                                    }}
                                                                    className="p-2 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white rounded-xl transition duration-200 cursor-pointer flex items-center gap-1.5 text-[10px] font-bold"
                                                                    title={copy.onlineOrder}
                                                                >
                                                                    <ShoppingBag className="w-3.5 h-3.5" />
                                                                    <span className="hidden sm:inline">{copy.order}</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Optimizer 2: Split Trip */}
                                    <div className="bg-card-bg border border-border-custom rounded-2xl p-6 shadow-sm flex flex-col">
                                        <div className="flex items-center gap-2 mb-2">
                                            <PiggyBank className="w-5 h-5 text-emerald-500" />
                                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{copy.splitTripTitle}</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-6">{copy.splitTripText}</p>

                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between mb-6">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{copy.totalCost}</span>
                                                <strong className="text-2xl font-black text-emerald-500">€{splitTripData.totalCost.toFixed(2)}</strong>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{copy.savings}</span>
                                                <strong className="text-base font-bold text-white bg-emerald-500 px-3 py-1 rounded-lg inline-block mt-0.5">€{splitTripData.savings.toFixed(2)}</strong>
                                            </div>
                                        </div>

                                        <div className="space-y-4 overflow-y-auto max-h-[300px] flex-1 pr-1">
                                            {splitTripData.groups.map(group => {
                                                const meta = RETAILER_META[group.retailerId] || { name: group.retailerId };
                                                return (
                                                    <div key={group.retailerId} className="border border-border-custom rounded-xl overflow-hidden">
                                                        <div className="p-3 bg-input-custom flex items-center justify-between border-b border-border-custom">
                                                            <div className="flex items-center gap-2">
                                                                <img className="w-5 h-5 rounded-full object-cover" src={retailerLogoUrl(group.retailerId)} alt="" />
                                                                <span className="text-xs font-bold">{meta.name}</span>
                                                                <button 
                                                                    onClick={() => setActiveMapRetailer(group.retailerId)}
                                                                    className="p-1 hover:bg-input-custom rounded-lg text-indigo-500 hover:text-indigo-600 transition ml-1"
                                                                    title={copy.viewMap}
                                                                >
                                                                    <MapPin className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <strong className="text-xs text-emerald-500 font-extrabold">€{group.total.toFixed(2)}</strong>
                                                                <button 
                                                                    onClick={() => {
                                                                        setHelperRetailer(group.retailerId);
                                                                        setIsHelperOpen(true);
                                                                    }}
                                                                    className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-500 hover:text-white rounded-lg transition ml-1 cursor-pointer"
                                                                    title={copy.eShopHelper}
                                                                >
                                                                    <ShoppingBag className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="p-2 space-y-1 bg-white/20 dark:bg-slate-950/20">
                                                            {group.items.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between items-center text-[10px] text-slate-500 px-2 py-1">
                                                                    <span className="truncate max-w-[240px]">{item.name}</span>
                                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">€{item.price.toFixed(2)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}
