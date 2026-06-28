"use client";

import React, { startTransition, useDeferredValue, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
    Search, Moon, Sun, Heart, Share2, Copy, Link as LinkIcon,
    X, Sparkles, ShoppingBag, ChevronRight, ChevronLeft, LayoutGrid,
    Store, Percent, Trophy, Info, RefreshCw, Menu, ShoppingBasket,
    MapPin, Camera, ShieldCheck, Clock3, UserCircle, AlertTriangle, ArrowLeft,
    Check, Trash2
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { proxyGovAssetUrl, retailerLogoUrl } from '../lib/gov-assets';

const BarcodeScannerModal = dynamic(() => import('../components/BarcodeScannerModal'), { ssr: false });
const EShopHelperModal = dynamic(() => import('../components/EShopHelperModal'), { ssr: false });
const FavoritesView = dynamic(() => import('../components/FavoritesView'), { ssr: false });

const formatGreekDate = (date?: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const formatProductUpdatedAt = (product: Product) => {
    const dates = [
        product.updated_at,
        ...(product.retailer_prices || []).map((price) => price.last_updated)
    ].filter(Boolean) as string[];

    if (dates.length === 0) return '';
    const latest = dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    return formatGreekDate(latest);
};
const statsCatalogUpdatedAt = (stats?: Stats | null) => stats?.catalog_updated_at || stats?.timestamp || '';

const athensDateKey = (date?: string | Date) => {
    if (!date) return '';
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Athens',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(typeof date === 'string' ? new Date(date) : date);
};

const dayDiffFromAthensKeys = (olderKey: string, newerKey: string) => {
    if (!olderKey || !newerKey) return 0;
    const [olderYear, olderMonth, olderDay] = olderKey.split('-').map(Number);
    const [newerYear, newerMonth, newerDay] = newerKey.split('-').map(Number);
    const olderUtc = Date.UTC(olderYear, olderMonth - 1, olderDay);
    const newerUtc = Date.UTC(newerYear, newerMonth - 1, newerDay);
    return Math.max(0, Math.round((newerUtc - olderUtc) / 86400000));
};

const startOfWeek = (date: Date) => {
    const copy = new Date(date);
    const day = copy.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() + diff);
    return copy;
};

// Allowed 6 supermarkets
const ALLOWED_RETAILERS = ['lidl', 'masoutis', 'ab_vasilopoulos', 'mymarket', 'sklavenitis', 'kritikos'];

// Retailer metadata mapping (Colors and cleaner display names)
const RETAILER_META: { [key: string]: { name: string; color: string } } = {
    'lidl': { name: 'Lidl', color: '#e30613' },
    'sklavenitis': { name: 'Σκλαβενίτης', color: '#ff6600' },
    'ab_vasilopoulos': { name: 'ΑΒ', color: '#005ca9' },
    'masoutis': { name: 'Μασούτης', color: '#00843d' },
    'mymarket': { name: 'My Market', color: '#0f4c81' },
    'kritikos': { name: 'Κρητικός', color: '#f59e0b' }
};

const RETAILER_SEARCH_NAMES: { [key: string]: string } = {
    'lidl': 'Lidl',
    'sklavenitis': 'Σκλαβενίτης',
    'ab_vasilopoulos': 'ΑΒ Βασιλόπουλος',
    'masoutis': 'Μασούτης',
    'mymarket': 'My Market',
    'kritikos': 'Κρητικός'
};

interface RetailerPrice {
    retailer: string;
    price: number;
    discount?: number;
    discount_percentage?: number;
    is_discount?: boolean;
    last_updated?: string;
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
    history?: { timestamp: string; retailer_prices: RetailerPrice[] }[];
    barcode?: string;
    updated_at?: string;
}

interface CategoryNode {
    category_id: string;
    name: string;
    name_en?: string;
    image_url?: string;
    total_product_count?: number;
    children?: CategoryNode[];
}

interface RawProduct {
    id: string;
    name: string;
    brand: string;
    image_url: string;
    category: string;
    unit: string;
    unit_quantity: number;
    price_stats?: Partial<PriceStat> | null;
    retailer_prices?: RetailerPrice[] | null;
    history?: { timestamp: string; retailer_prices: RetailerPrice[] }[];
    barcode?: string;
    updated_at?: string;
}

interface Stats {
    timestamp: string;
    catalog_updated_at?: string;
    catalog_product_updated_at?: string;
    total_products: number;
    products_on_discount: number;
}

interface SavedBasket {
    id: string;
    name: string;
    createdAt: string;
    products: Product[];
}

interface HistoryEntry {
    id: string;
    date: string;
    totalCost: number;
    savings: number;
    stores: string[];
    itemCount: number;
    items: { id: string; name: string; price: number; retailer: string }[];
}

interface OptimizerItem {
    id: string;
    name: string;
    price: number;
}

interface OptimizerGroup {
    retailerId: string;
    items: OptimizerItem[];
    total: number;
}

interface OptimizerOption {
    stores: string[];
    stops: number;
    totalCost: number;
    coveredItems: number;
    totalItems: number;
    missingItems: Product[];
    groups: OptimizerGroup[];
    complete: boolean;
}


type DataSource = 'upstream' | 'cache' | 'stale-cache' | 'static-fallback' | 'error' | '';

type AppLanguage = 'el' | 'en';

const UI_TEXT = {
    el: {
        categories: 'Κατηγορίες',
        openCategories: 'Άνοιγμα κατηγοριών',
        home: 'Αρχική',
        productSearch: 'Αναζήτηση προϊόντων',
        productSearchPlaceholder: 'Αναζήτηση προϊόντων (π.χ. γάλα, φέτα, ρύζι)...',
        freshnessAlertTitle: 'Οι τιμές δεν έχουν ανανεωθεί σήμερα',
        freshnessAlertBody: 'Η πιο πρόσφατη ενημέρωση του καταλόγου είναι',
        freshnessAlertBodySuffix: 'Μέχρι να ανέβει νέο snapshot, οι τιμές μπορεί να είναι παλιές.',
        freshnessAlertDismiss: 'Συνέχεια',
        clearSearch: 'Καθαρισμός αναζήτησης',
        products: 'Προϊόντα',
        basket: 'Καλάθι',
        guide: 'Οδηγός χρήσης',
        scanBarcode: 'Σάρωση Barcode',
        officialData: 'Τιμές από επίσημα δεδομένα',
        compareTitle: 'Συγκρίνετε Τιμές Σούπερ Μάρκετ & Εξοικονομήστε Χρήματα',
        compareText: 'Αναζητήστε προϊόντα, συγκρίνετε τιμές στις μεγαλύτερες αλυσίδες και φτιάξτε ένα καλάθι που κρατάει τα έξοδα υπό έλεγχο.',
        startCompare: 'Ξεκινήστε Σύγκριση Τιμών',
        homeSearchTitle: 'Βρείτε γρήγορα την καλύτερη τιμή',
        homeSearchText: 'Ξεκινήστε με ένα προϊόν ή επιλέξτε κατηγορία παρακάτω.',
        whyCompare: 'Γιατί αξίζει να συγκρίνετε',
        whyCompareText: 'Καθαρή εικόνα τιμών πριν πάτε στο ταμείο.',
        discoverByCategory: 'Ανακαλύψτε ανά κατηγορία',
        discoverByCategoryText: 'Μεγάλες κατηγορίες, καθαρή πλοήγηση, γρήγορη σύγκριση.',
        productCount: 'προϊόντα',
        viewAll: 'Δείτε όλα',
        pricesNotLoadedTitle: 'Δεν φορτώθηκαν οι τιμές',
        noProductsTitle: 'Δεν βρέθηκαν προϊόντα',
        pricesNotLoadedText: 'Δεν μπορέσαμε να φορτώσουμε τις τιμές αυτή τη στιγμή.',
        noProductsText: 'Δοκιμάστε άλλη λέξη αναζήτησης ή επιλέξτε διαφορετική κατηγορία.',
        backHome: 'Επιστροφή στην αρχική',
        foundProducts: 'Βρέθηκαν',
        page: 'Σελίδα',
        from: 'από',
        previous: 'Προηγούμενη',
        next: 'Επόμενη',
        categorySearchPlaceholder: 'Αναζήτηση κατηγορίας',
        categoryBrowserText: 'Βρείτε γρήγορα μια βασική κατηγορία ή συγκεκριμένη υποκατηγορία.',
        closeCategories: 'Κλείσιμο κατηγοριών',
        loadingCategories: 'Φόρτωση κατηγοριών',
        noCategories: 'Δεν βρέθηκαν κατηγορίες',
        tryGeneralTerm: 'Δοκιμάστε πιο γενικό όρο.',
        viewProducts: 'Προβολή προϊόντων',
        searchNav: 'Αναζήτηση',
        basketNav: 'Καλάθι',
        optimizeNav: 'Βελτίωση',
        offersNav: 'Προσφορές',
        profileNav: 'Προφίλ',
        offersBadge: 'Προσφορές που αξίζουν',
        offersTitle: 'Κερδίστε περισσότερα από κάθε καλάθι',
        offersText: 'Ανακαλύψτε προϊόντα με ένδειξη προσφοράς και προσθέστε τα στο καλάθι σας για άμεση βελτιστοποίηση.',
        offersEmptyTitle: 'Δεν έχουν φορτωθεί προσφορές ακόμη',
        offersEmptyText: 'Ξεκινήστε με μια αναζήτηση ή επιλέξτε κατηγορία για να εμφανίσουμε σχετικές ευκαιρίες.',
        searchProducts: 'Αναζήτηση προϊόντων',
        biggestDiscounts: 'Μεγαλύτερες εκπτώσεις',
        biggestDiscountsText: 'Προϊόντα με εμφανή προσφορά σήμερα',
        suggestedOffers: 'Προτεινόμενες προσφορές',
        suggestedOffersText: 'Ευκαιρίες από τις πρόσφατες αναζητήσεις σας',
        offerLabel: 'Προσφορά',
        profileTitle: 'Το Kallathaki σας',
        profileText: 'Αποθηκευμένα καλάθια, αγαπημένα προϊόντα και ιστορικό αγορών.',
        favoriteProducts: 'Αγαπημένα προϊόντα',
        favoriteProductsText: 'Προϊόντα που έχετε κρατήσει για επόμενες αγορές.',
        activeBasketTitle: 'Ενεργό καλάθι',
        activeBasketText: 'Προϊόντα έτοιμα για βελτιστοποίηση.',
        estimatedSavings: 'Εκτιμώμενη εξοικονόμηση',
        estimatedSavingsText: 'Με βάση το τρέχον καλάθι.',
        savedBaskets: 'Αποθηκευμένα καλάθια',
        shoppingHistory: 'Ιστορικό αγορών',
        favoriteSupermarkets: 'Αγαπημένα σούπερ μάρκετ',
        settings: 'Ρυθμίσεις',
        backToProfile: 'Επιστροφή στο προφίλ',
        saveCurrentBasket: 'Αποθήκευση τρέχοντος καλαθιού',
        noSavedBaskets: 'Δεν έχετε αποθηκευμένα καλάθια ακόμη.',
        saveBasketPrompt: 'Δώστε ένα όνομα για να αποθηκεύσετε το τρέχον καλάθι σας:',
        basketNamePlaceholder: 'π.χ. Εβδομαδιαία ψώνια',
        load: 'Φόρτωση',
        delete: 'Διαγραφή',
        activeBasketIsEmpty: 'Το καλάθι σας είναι άδειο. Προσθέστε προϊόντα πρώτα!',
        noHistory: 'Δεν υπάρχει ιστορικό αγορών ακόμη.',
        completedTrip: 'Ολοκληρωμένη αγορά',
        clearHistory: 'Καθαρισμός ιστορικού',
        totalSpent: 'Σύνολο',
        totalSavings: 'Εξοικονόμηση',
        date: 'Ημερομηνία',
        storesVisited: 'Καταστήματα',
        details: 'Λεπτομέρειες',
        supermarketsDescription: 'Επιλέξτε τα σούπερ μάρκετ που προτιμάτε. Θα εμφανίζονται κατά προτεραιότητα στις συγκρίσεις.',
        resetAppDataPrompt: 'Προσοχή: Αυτή η ενέργεια θα διαγράψει όλα τα δεδομένα σας (αγαπημένα, καλάθια, ιστορικό) μόνιμα.',
        resetAppDataConfirm: 'Είστε σίγουροι ότι θέλετε να προχωρήσετε;',
        resetAppDataButton: 'Επαναφορά Δεδομένων',
        languageSettings: 'Γλώσσα',
        themeSettings: 'Εμφάνιση',
        themeLight: 'Φωτεινό',
        themeDark: 'Σκοτεινό',
        basketSavedSuccess: 'Το καλάθι αποθηκεύτηκε επιτυχώς!',
        basketLoadedSuccess: 'Το καλάθι φορτώθηκε επιτυχώς!',
        tripRecordedSuccess: 'Η αγορά καταγράφηκε στο ιστορικό!',
        confirmDeleteBasket: 'Θέλετε σίγουρα να διαγράψετε αυτό το καλάθι;',
        confirmDeleteTrip: 'Θέλετε σίγουρα να διαγράψετε αυτή την αγορά;',
        confirmClearHistory: 'Θέλετε σίγουρα να καθαρίσετε όλο το ιστορικό αγορών;',
        recordTrip: 'Καταγραφή Αγοράς'
    },
    en: {
        categories: 'Categories',
        openCategories: 'Open categories',
        home: 'Home',
        productSearch: 'Search products',
        productSearchPlaceholder: 'Search products (e.g. milk, feta, rice)...',
        freshnessAlertTitle: 'Prices have not been refreshed today',
        freshnessAlertBody: 'The latest catalog refresh is from',
        freshnessAlertBodySuffix: 'Until a new snapshot is published, prices may be out of date.',
        freshnessAlertDismiss: 'Continue',
        clearSearch: 'Clear search',
        products: 'Products',
        basket: 'Basket',
        guide: 'How it works',
        scanBarcode: 'Scan Barcode',
        officialData: 'Official price data',
        compareTitle: 'Find the cheapest way to shop this week',
        compareText: 'Compare supermarket prices, build your basket, and see where your groceries cost less.',
        startCompare: 'Compare Prices',
        homeSearchTitle: 'Search any product',
        homeSearchText: 'Start with a product or browse the categories below.',
        whyCompare: 'Shop with confidence',
        whyCompareText: 'See where your basket costs less before you check out.',
        discoverByCategory: 'Browse categories',
        discoverByCategoryText: 'Find products faster with simple grocery categories.',
        productCount: 'products',
        viewAll: 'View all',
        pricesNotLoadedTitle: 'We couldn’t load prices',
        noProductsTitle: 'We couldn’t find that product',
        pricesNotLoadedText: 'Please try again in a moment.',
        noProductsText: 'Try searching for milk, coffee, feta, or pasta.',
        backHome: 'Back to Home',
        foundProducts: 'Found',
        page: 'Page',
        from: 'of',
        previous: 'Previous',
        next: 'Next',
        categorySearchPlaceholder: 'Search categories',
        categoryBrowserText: 'Find a main category or a specific aisle faster.',
        closeCategories: 'Close categories',
        loadingCategories: 'Loading categories',
        noCategories: 'No matching categories',
        tryGeneralTerm: 'Try a broader search term.',
        viewProducts: 'View products',
        searchNav: 'Search',
        basketNav: 'Basket',
        optimizeNav: 'Optimize',
        offersNav: 'Offers',
        profileNav: 'Profile',
        offersBadge: 'Worthwhile offers',
        offersTitle: 'Get more out of every basket',
        offersText: 'Discover discounted products and add them to your basket for instant optimization.',
        offersEmptyTitle: 'No offers loaded yet',
        offersEmptyText: 'Start with a search or pick a category and we will show relevant deals.',
        searchProducts: 'Search products',
        biggestDiscounts: 'Biggest discounts',
        biggestDiscountsText: 'Products with clear discounts today',
        suggestedOffers: 'Suggested offers',
        suggestedOffersText: 'Deals based on your recent searches',
        offerLabel: 'Offer',
        profileTitle: 'Your Kallathaki',
        profileText: 'Saved baskets, favorite products, and shopping history.',
        favoriteProducts: 'Favorite products',
        favoriteProductsText: 'Products you have saved for future shopping.',
        activeBasketTitle: 'Active basket',
        activeBasketText: 'Products ready for optimization.',
        estimatedSavings: 'Estimated savings',
        estimatedSavingsText: 'Based on your current basket.',
        savedBaskets: 'Saved baskets',
        shoppingHistory: 'Shopping history',
        favoriteSupermarkets: 'Favorite supermarkets',
        settings: 'Settings',
        backToProfile: 'Back to Profile',
        saveCurrentBasket: 'Save Current Basket',
        noSavedBaskets: 'No saved baskets yet.',
        saveBasketPrompt: 'Give a name to save your current basket:',
        basketNamePlaceholder: 'e.g. Weekly shopping',
        load: 'Load',
        delete: 'Delete',
        activeBasketIsEmpty: 'Your active basket is empty. Add products first!',
        noHistory: 'No shopping history yet.',
        completedTrip: 'Completed shopping trip',
        clearHistory: 'Clear History',
        totalSpent: 'Total Spent',
        totalSavings: 'Total Savings',
        date: 'Date',
        storesVisited: 'Stores',
        details: 'Details',
        supermarketsDescription: 'Choose your preferred supermarkets. They will be prioritized in comparisons.',
        resetAppDataPrompt: 'Warning: This action will permanently delete all your data (favorites, baskets, history).',
        resetAppDataConfirm: 'Are you sure you want to proceed?',
        resetAppDataButton: 'Reset All Data',
        languageSettings: 'Language',
        themeSettings: 'Theme',
        themeLight: 'Light',
        themeDark: 'Dark',
        basketSavedSuccess: 'Basket saved successfully!',
        basketLoadedSuccess: 'Basket loaded successfully!',
        tripRecordedSuccess: 'Shopping trip saved to history!',
        confirmDeleteBasket: 'Are you sure you want to delete this basket?',
        confirmDeleteTrip: 'Are you sure you want to delete this trip?',
        confirmClearHistory: 'Are you sure you want to clear all shopping history?',
        recordTrip: 'Record Trip'
    }
} satisfies Record<AppLanguage, Record<string, string>>;

// Sanitize products to only keep allowed retailers
const sanitizeProduct = (prod: RawProduct): Product => {
    if (!prod) return prod as unknown as Product;
    const filteredPrices = (prod.retailer_prices || []).filter((rp) => ALLOWED_RETAILERS.includes(rp.retailer));
    
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let sum = 0;
    
    filteredPrices.forEach((rp) => {
        if (rp.price < minPrice) minPrice = rp.price;
        if (rp.price > maxPrice) maxPrice = rp.price;
        sum += rp.price;
    });
    
    const count = filteredPrices.length;
    
    return {
        ...prod,
        image_url: proxyGovAssetUrl(prod.image_url),
        retailer_prices: filteredPrices,
        price_stats: count > 0 ? {
            min_price: minPrice,
            max_price: maxPrice,
            avg_price: sum / count,
            retailer_count: count
        } : {
            min_price: prod.price_stats?.min_price || 0,
            max_price: prod.price_stats?.max_price || 0,
            avg_price: prod.price_stats?.avg_price || 0,
            retailer_count: 0
        }
    } as Product;
};

const sanitizeCategoryTree = (nodes: CategoryNode[]): CategoryNode[] => nodes.map((node) => ({
    ...node,
    image_url: proxyGovAssetUrl(node.image_url),
    children: node.children ? sanitizeCategoryTree(node.children) : undefined
}));

export default function KallathakiApp() {
    // Theme state
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [language, setLanguage] = useState<AppLanguage>('el');
    const [mounted, setMounted] = useState(false);
    const text = UI_TEXT[language];
    const t = (key: keyof typeof text) => text[key];
    const categoryName = (category?: CategoryNode | null) => {
        if (!category) return '';
        return language === 'en' ? (category.name_en || category.name) : category.name;
    };

    // App state
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [statsDataSource, setStatsDataSource] = useState<DataSource>('');
    const [products, setProducts] = useState<Product[]>([]);
    const [productsDataSource, setProductsDataSource] = useState<DataSource>('');
    const [favorites, setFavorites] = useState<Product[]>([]);
    const [isRefreshingSavedProducts, setIsRefreshingSavedProducts] = useState(false);
    const [activeBasketIds, setActiveBasketIds] = useState<string[]>([]);
    const [favoritesSubTab, setFavoritesSubTab] = useState<'pantry' | 'basket'>('pantry');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [showFreshnessNotice, setShowFreshnessNotice] = useState(false);
    const [freshnessNoticeDate, setFreshnessNoticeDate] = useState('');
    const [freshnessNoticeAgeDays, setFreshnessNoticeAgeDays] = useState(0);
    const [barcodeCache, setBarcodeCache] = useState<Record<string, Product>>({});
    const [isHelperOpen, setIsHelperOpen] = useState(false);
    const [helperRetailer, setHelperRetailer] = useState<string>('');
    const [showOptimizerResults, setShowOptimizerResults] = useState(false);
    const didRefreshSavedProducts = useRef(false);

    const [savedBaskets, setSavedBaskets] = useState<SavedBasket[]>([]);
    const [shoppingHistory, setShoppingHistory] = useState<HistoryEntry[]>([]);
    const [favoriteRetailers, setFavoriteRetailers] = useState<string[]>(ALLOWED_RETAILERS);
    const [profileSubView, setProfileSubView] = useState<'savedBaskets' | 'history' | 'supermarkets' | 'settings' | null>(null);
    const [newBasketName, setNewBasketName] = useState('');
    const [profileName, setProfileName] = useState('');
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [priceAlertsEnabled, setPriceAlertsEnabled] = useState(true);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        if (toastMessage) {
            const timer = setTimeout(() => setToastMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toastMessage]);

    const activeBasketProducts = useMemo(() => {
        return favorites.filter(p => activeBasketIds.includes(p.id));
    }, [favorites, activeBasketIds]);

    useEffect(() => {
        setShowOptimizerResults(false);
    }, [activeBasketIds]);

    const toggleBasketItem = (productId: string) => {
        setActiveBasketIds(prev => {
            const next = prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId];
            localStorage.setItem('posokanei_active_basket', JSON.stringify(next));
            return next;
        });
    };

    const selectAllBasketItems = () => {
        const allIds = favorites.map(p => p.id);
        setActiveBasketIds(allIds);
        localStorage.setItem('posokanei_active_basket', JSON.stringify(allIds));
    };

    const deselectAllBasketItems = () => {
        setActiveBasketIds([]);
        localStorage.setItem('posokanei_active_basket', JSON.stringify([]));
    };

    const saveBasket = (name: string) => {
        if (activeBasketProducts.length === 0) return;
        const newBasket: SavedBasket = {
            id: Math.random().toString(36).substring(2, 9),
            name: name || `Basket ${savedBaskets.length + 1}`,
            createdAt: new Date().toISOString(),
            products: activeBasketProducts
        };
        setSavedBaskets(prev => {
            const next = [newBasket, ...prev];
            localStorage.setItem('kallathaki_saved_baskets', JSON.stringify(next));
            return next;
        });
    };

    const loadBasket = (basket: SavedBasket) => {
        const newIds = basket.products.map(p => p.id);
        setActiveBasketIds(newIds);
        localStorage.setItem('posokanei_active_basket', JSON.stringify(newIds));

        setFavorites(prev => {
            const updated = [...prev];
            basket.products.forEach(savedProd => {
                if (!updated.some(p => p.id === savedProd.id)) {
                    updated.push(savedProd);
                }
            });
            localStorage.setItem('posokanei_favorites', JSON.stringify(updated));
            return updated;
        });
    };

    const deleteSavedBasket = (basketId: string) => {
        setSavedBaskets(prev => {
            const next = prev.filter(b => b.id !== basketId);
            localStorage.setItem('kallathaki_saved_baskets', JSON.stringify(next));
            return next;
        });
    };

    const deleteHistoryEntry = (entryId: string) => {
        setShoppingHistory(prev => {
            const next = prev.filter(h => h.id !== entryId);
            localStorage.setItem('kallathaki_shopping_history', JSON.stringify(next));
            return next;
        });
    };

    const clearShoppingHistory = () => {
        setShoppingHistory([]);
        localStorage.setItem('kallathaki_shopping_history', JSON.stringify([]));
    };

    const toggleFavoriteRetailer = (retailerId: string) => {
        setFavoriteRetailers(prev => {
            const next = prev.includes(retailerId)
                ? prev.filter(id => id !== retailerId)
                : [...prev, retailerId];
            localStorage.setItem('kallathaki_favorite_retailers', JSON.stringify(next));
            return next;
        });
    };

    const recordTrip = (recommendedOption: OptimizerOption) => {
        if (!recommendedOption) return;
        const entry: HistoryEntry = {
            id: Math.random().toString(36).substring(2, 9),
            date: new Date().toISOString(),
            totalCost: recommendedOption.totalCost,
            savings: Math.max(0, basketOptimizer.baselineCost - recommendedOption.totalCost),
            stores: recommendedOption.stores,
            itemCount: recommendedOption.coveredItems,
            items: recommendedOption.groups.flatMap((g: OptimizerGroup) => 
                g.items.map((item: OptimizerItem) => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    retailer: g.retailerId
                }))
            )
        };

        setShoppingHistory(prev => {
            const next = [entry, ...prev];
            localStorage.setItem('kallathaki_shopping_history', JSON.stringify(next));
            return next;
        });
    };

    const resetAllAppData = () => {
        localStorage.removeItem('posokanei_favorites');
        localStorage.removeItem('posokanei_active_basket');
        localStorage.removeItem('kallathaki_saved_baskets');
        localStorage.removeItem('kallathaki_shopping_history');
        localStorage.removeItem('kallathaki_favorite_retailers');
        
        setFavorites([]);
        setActiveBasketIds([]);
        setSavedBaskets([]);
        setShoppingHistory([]);
        setFavoriteRetailers(ALLOWED_RETAILERS);
        setProfileSubView(null);
        setActiveTab('products');
    };

    const refreshSavedProducts = useCallback(async (productsToRefresh = favorites) => {
        if (productsToRefresh.length === 0 || isRefreshingSavedProducts) return;

        setIsRefreshingSavedProducts(true);
        try {
            const refreshedProducts = new Map<string, Product>();
            const chunkSize = 6;

            for (let i = 0; i < productsToRefresh.length; i += chunkSize) {
                const chunk = productsToRefresh.slice(i, i + chunkSize);
                const results = await Promise.allSettled(chunk.map(async (product) => {
                    const response = await fetch(`/api/products/${product.id}?countries=GR%2CEU&include_tax=true&_refresh=1`, {
                        cache: 'no-store',
                        headers: {
                            'Cache-Control': 'no-cache',
                            'x-kallathaki-refresh': '1'
                        }
                    });

                    if (!response.ok) throw new Error(`Failed to refresh product ${product.id}: ${response.status}`);
                    const data = await response.json();
                    if (!data) return null;

                    return sanitizeProduct(data);
                }));

                results.forEach((result) => {
                    if (result.status === 'fulfilled' && result.value) {
                        refreshedProducts.set(result.value.id, result.value);
                    }
                });
            }

            if (refreshedProducts.size === 0) return;

            setFavorites((prev) => {
                const updated = prev.map((product) => refreshedProducts.get(product.id) || product);
                localStorage.setItem('posokanei_favorites', JSON.stringify(updated));
                return updated;
            });

            setProducts((prev) => prev.map((product) => refreshedProducts.get(product.id) || product));
            setSelectedProduct((prev) => prev ? (refreshedProducts.get(prev.id) || prev) : prev);
        } catch (error) {
            console.error('Failed to refresh saved products', error);
        } finally {
            setIsRefreshingSavedProducts(false);
        }
    }, [favorites, isRefreshingSavedProducts]);

    useEffect(() => {
        if (!mounted || didRefreshSavedProducts.current || favorites.length === 0) return;
        didRefreshSavedProducts.current = true;
        refreshSavedProducts(favorites);
    }, [favorites, mounted, refreshSavedProducts]);

    const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [productError, setProductError] = useState('');

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryPath, setCategoryPath] = useState<string[]>([]);
    const [showAllProductsInCategory, setShowAllProductsInCategory] = useState(false);

    const selectedCategoryId = categoryPath[0] || '';
    const selectedSubcategoryId = categoryPath.length > 1 ? categoryPath[categoryPath.length - 1] : '';

    const getCurrentCategoryNode = (path: string[], tree: CategoryNode[]): CategoryNode | null => {
        if (path.length === 0) return null;
        let currentNode: CategoryNode | null = null;
        let currentList = tree;
        for (const id of path) {
            const found = currentList.find(node => node.category_id === id);
            if (!found) return null;
            currentNode = found;
            currentList = found.children || [];
        }
        return currentNode;
    };

    const currentCategoryNode = useMemo(() => {
        return getCurrentCategoryNode(categoryPath, categories);
    }, [categoryPath, categories]);

    const hasSubcategories = useMemo(() => {
        return currentCategoryNode && currentCategoryNode.children && currentCategoryNode.children.length > 0;
    }, [currentCategoryNode]);

    const isHomeScreen = !searchTerm && categoryPath.length === 0;

    const shouldShowSubcategoryGrid = !searchTerm && hasSubcategories && !showAllProductsInCategory;

    const [isCategoryBrowserOpen, setIsCategoryBrowserOpen] = useState(false);
    const [categoryBrowserQuery, setCategoryBrowserQuery] = useState('');

    const visibleCategoryGroups = useMemo(() => {
        const query = categoryBrowserQuery.trim().toLocaleLowerCase('el-GR');
        if (!query) return categories;

        return categories
            .map((cat) => {
                const childMatches = (cat.children || []).filter((child) =>
                    [child.name, child.name_en].filter(Boolean).join(' ').toLocaleLowerCase('el-GR').includes(query)
                );
                const parentMatches = [cat.name, cat.name_en].filter(Boolean).join(' ').toLocaleLowerCase('el-GR').includes(query);

                if (!parentMatches && childMatches.length === 0) return null;

                return {
                    ...cat,
                    children: parentMatches ? cat.children : childMatches
                };
            })
            .filter(Boolean) as CategoryNode[];
    }, [categories, categoryBrowserQuery]);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const sortBy = 'priceAsc';
    const [activeTab, setActiveTab] = useState<'products' | 'favorites' | 'offers' | 'profile'>('products');

    // UI state
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const [activeMapRetailer, setActiveMapRetailer] = useState<string | null>(null);
    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

    // Geolocation Fetch for Map
    useEffect(() => {
        if (activeMapRetailer && typeof window !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                },
                (err) => {
                    console.log("Geolocation error:", err);
                    setUserCoords(null);
                },
                { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
            );
        }
    }, [activeMapRetailer]);

    // Chart ref
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<{ destroy: () => void } | null>(null);
    const categorySectionRef = useRef<HTMLDivElement>(null);

    // Initialize Theme and LocalStorage state
    useEffect(() => {
        const storedTheme = localStorage.getItem('posokanei_theme') || 'light';
        const storedLanguage = localStorage.getItem('kallathaki_language') === 'en' ? 'en' : 'el';
        if (storedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }


        // Initialize Favorites
        let loadedFavs: Product[] = [];
        const storedFavs = localStorage.getItem('posokanei_favorites');
        if (storedFavs) {
            try {
                loadedFavs = JSON.parse(storedFavs).map(sanitizeProduct);
            } catch (e) {
                console.error(e);
            }
        }

        // Initialize Active Basket
        let loadedBasketIds: string[] = [];
        const storedBasket = localStorage.getItem('posokanei_active_basket');
        if (storedBasket) {
            try {
                loadedBasketIds = JSON.parse(storedBasket);
            } catch (e) {
                console.error(e);
            }
        } else {
            loadedBasketIds = loadedFavs.map(p => p.id);
            localStorage.setItem('posokanei_active_basket', JSON.stringify(loadedBasketIds));
        }

        let loadedProfileName = '';
        const storedProfileName = localStorage.getItem('kallathaki_profile_name');
        if (storedProfileName) {
            loadedProfileName = storedProfileName;
        }

        let loadedRecentSearches: string[] = [];
        const storedRecentSearches = localStorage.getItem('kallathaki_recent_searches');
        if (storedRecentSearches) {
            try {
                loadedRecentSearches = JSON.parse(storedRecentSearches);
            } catch (e) {
                console.error(e);
            }
        }

        const storedNotifications = localStorage.getItem('kallathaki_notifications_enabled');
        const loadedNotificationsEnabled = storedNotifications === '1';

        const storedPriceAlerts = localStorage.getItem('kallathaki_price_alerts_enabled');
        const loadedPriceAlertsEnabled = storedPriceAlerts ? storedPriceAlerts === '1' : true;

        // Initialize Saved Baskets
        let loadedSavedBaskets: SavedBasket[] = [];
        const storedSavedBaskets = localStorage.getItem('kallathaki_saved_baskets');
        if (storedSavedBaskets) {
            try {
                loadedSavedBaskets = JSON.parse(storedSavedBaskets);
            } catch (e) {
                console.error(e);
            }
        }

        // Initialize History
        let loadedHistory: HistoryEntry[] = [];
        const storedHistory = localStorage.getItem('kallathaki_shopping_history');
        if (storedHistory) {
            try {
                loadedHistory = JSON.parse(storedHistory);
            } catch (e) {
                console.error(e);
            }
        }

        // Initialize Favorite Supermarkets
        let loadedFavoriteRetailers: string[] = ALLOWED_RETAILERS;
        const storedFavoriteRetailers = localStorage.getItem('kallathaki_favorite_retailers');
        if (storedFavoriteRetailers) {
            try {
                loadedFavoriteRetailers = JSON.parse(storedFavoriteRetailers);
            } catch (e) {
                console.error(e);
            }
        }

        // Defer state updates to avoid synchronous setState warnings in effect
        setTimeout(() => {
            setTheme(storedTheme as 'light' | 'dark');
            setLanguage(storedLanguage);
            setFavorites(loadedFavs);
            setActiveBasketIds(loadedBasketIds);
            setSavedBaskets(loadedSavedBaskets);
            setShoppingHistory(loadedHistory);
            setFavoriteRetailers(loadedFavoriteRetailers);
            setProfileName(loadedProfileName);
            setRecentSearches(loadedRecentSearches);
            setNotificationsEnabled(loadedNotificationsEnabled);
            setPriceAlertsEnabled(loadedPriceAlertsEnabled);
            
            // Check for shortcut action
            if (window.location.search.includes('action=scan')) {
                setIsScannerOpen(true);
            }
            if (window.location.hash === '#basket') {
                setActiveTab('favorites');
                setFavoritesSubTab('basket');
            }
            
            setMounted(true);
        }, 0);
    }, []);

    // Toggle Theme
    const toggleTheme = () => {
        const nextTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(nextTheme);
        localStorage.setItem('posokanei_theme', nextTheme);
        if (nextTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const toggleLanguage = () => {
        const nextLanguage: AppLanguage = language === 'el' ? 'en' : 'el';
        setLanguage(nextLanguage);
        localStorage.setItem('kallathaki_language', nextLanguage);
    };

    const saveProfileName = (value: string) => {
        setProfileName(value);
        localStorage.setItem('kallathaki_profile_name', value);
    };

    const toggleNotifications = () => {
        setNotificationsEnabled((prev) => {
            const next = !prev;
            localStorage.setItem('kallathaki_notifications_enabled', next ? '1' : '0');
            return next;
        });
    };

    const togglePriceAlerts = () => {
        setPriceAlertsEnabled((prev) => {
            const next = !prev;
            localStorage.setItem('kallathaki_price_alerts_enabled', next ? '1' : '0');
            return next;
        });
    };

    const dismissFreshnessNotice = () => {
        const snapshotKey = athensDateKey(freshnessNoticeDate);
        if (snapshotKey) {
            localStorage.setItem('kallathaki_freshness_notice_dismissed_for', snapshotKey);
        }
        setShowFreshnessNotice(false);
    };

    // Load initial metadata
    useEffect(() => {
        const fetchMetadata = async () => {
            setLoadingCategories(true);
            try {
                // Fetch stats
                const statsRes = await fetch('/api/meta/stats');
                if (statsRes.ok) {
                    setStatsDataSource((statsRes.headers.get('x-kallathaki-data-source') || '') as DataSource);
                    setStats(await statsRes.json());
                }

                // Fetch categories
                const catRes = await fetch('/api/meta/categories/tree?include_counts=true&include_hidden=false');
                if (catRes.ok) {
                    const catData = await catRes.json();
                    setCategories(sanitizeCategoryTree(catData.tree || []));
                }
            } catch (error) {
                console.error("Failed to load metadata", error);
            } finally {
                setLoadingCategories(false);
            }
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        if (!mounted) return;
        const snapshotDate = statsCatalogUpdatedAt(stats);
        if (!snapshotDate) return;

        const shouldWarn =
            statsDataSource === 'static-fallback' ||
            statsDataSource === 'stale-cache' ||
            productsDataSource === 'static-fallback' ||
            productsDataSource === 'stale-cache';

        if (!shouldWarn) {
            setShowFreshnessNotice(false);
            return;
        }

        const snapshotKey = athensDateKey(snapshotDate);
        const todayKey = athensDateKey(new Date());
        const ageDays = dayDiffFromAthensKeys(snapshotKey, todayKey);

        setFreshnessNoticeDate(snapshotDate);
        setFreshnessNoticeAgeDays(ageDays);

        if (ageDays < 1) {
            setShowFreshnessNotice(false);
            return;
        }

        const dismissedFor = localStorage.getItem('kallathaki_freshness_notice_dismissed_for');
        setShowFreshnessNotice(dismissedFor !== snapshotKey);
    }, [mounted, stats, statsDataSource, productsDataSource]);

    useEffect(() => {
        if (!mounted) return;
        const normalizedSearch = searchTerm.trim();
        if (normalizedSearch.length < 2) return;

        const timer = setTimeout(() => {
            setRecentSearches((prev) => {
                const next = [
                    normalizedSearch,
                    ...prev.filter((item) => item.toLocaleLowerCase('el-GR') !== normalizedSearch.toLocaleLowerCase('el-GR'))
                ].slice(0, 6);
                localStorage.setItem('kallathaki_recent_searches', JSON.stringify(next));
                return next;
            });
        }, 900);

        return () => clearTimeout(timer);
    }, [mounted, searchTerm]);

    // Fetch Products when filters change
    useEffect(() => {
        // If we are on home screen or showing the subcategory grid, don't fetch products
        if (isHomeScreen || (hasSubcategories && !showAllProductsInCategory && !searchTerm)) {
            setTimeout(() => {
                setProducts([]);
            }, 0);
            return;
        }

        const fetchProductsData = async () => {
            setLoadingProducts(true);
            setProductError('');
            const payload: Record<string, unknown> = {
                page: currentPage,
                page_size: 24
            };

            if (searchTerm.trim() !== '') {
                payload.title = searchTerm;
            }

            const activeCatId = selectedSubcategoryId || selectedCategoryId;
            if (activeCatId) {
                payload.category_id = activeCatId;
            }

            if (sortBy === 'priceAsc') {
                payload.sort_by = 'unit_price';
                payload.sort_order = 'asc';
            } else if (sortBy === 'priceDesc') {
                payload.sort_by = 'unit_price';
                payload.sort_order = 'desc';
            }

            try {
                const res = await fetch('/api/products/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    setProductsDataSource((res.headers.get('x-kallathaki-data-source') || '') as DataSource);
                    const data = await res.json();
                    setProducts((data.products || []).map(sanitizeProduct));
                    setTotalPages(data.total_pages || 1);
                    setTotalProductsCount(data.total || 0);
                } else {
                    setProductsDataSource('error');
                    setProducts([]);
                    setTotalProductsCount(0);
                    setProductError('Δεν μπορέσαμε να φορτώσουμε τις τιμές αυτή τη στιγμή.');
                }
            } catch (error) {
                console.error("Failed to load products", error);
                setProductsDataSource('error');
                setProducts([]);
                setTotalProductsCount(0);
                setProductError('Υπήρξε προσωρινό πρόβλημα σύνδεσης. Δοκιμάστε ξανά σε λίγο.');
            } finally {
                setLoadingProducts(false);
            }
        };

        // Debounce search
        const delayTimer = setTimeout(() => {
            fetchProductsData();
        }, searchTerm ? 400 : 0);

        return () => clearTimeout(delayTimer);
    }, [searchTerm, selectedCategoryId, selectedSubcategoryId, currentPage, sortBy, hasSubcategories, isHomeScreen, showAllProductsInCategory]);

    // Handle incoming hash shares
    useEffect(() => {
        const importSharedList = async () => {
            const hash = window.location.hash;
            if (hash.startsWith('#share=')) {
                const ids = hash.replace('#share=', '').split(',').filter(id => id.trim() !== '');
                if (ids.length === 0) return;

                setActiveTab('favorites');
                // Switch tabs
                try {
                    const importedProducts: Product[] = [];
                    await Promise.all(ids.map(async (id) => {
                        const r = await fetch(`/api/products/${id}?countries=GR%2CEU&include_tax=true`);
                        if (r.ok) {
                            const prod = await r.json();
                            importedProducts.push(sanitizeProduct(prod));
                        }
                    }));

                    if (importedProducts.length > 0) {
                        const newIds = importedProducts.map(p => p.id);
                        setFavorites((prev) => {
                            const existingIds = new Set(prev.map(p => p.id));
                            const merged = [...prev];
                            let addedCount = 0;
                            importedProducts.forEach(prod => {
                                if (!existingIds.has(prod.id)) {
                                    merged.push(prod);
                                    addedCount++;
                                }
                            });
                            localStorage.setItem('posokanei_favorites', JSON.stringify(merged));
                            alert(`Εισήχθησαν επιτυχώς ${importedProducts.length} προϊόντα στη λίστα σας! (${addedCount} νέα)`);
                            return merged;
                        });
                        setActiveBasketIds((prev) => {
                            const mergedIds = Array.from(new Set([...prev, ...newIds]));
                            localStorage.setItem('posokanei_active_basket', JSON.stringify(mergedIds));
                            return mergedIds;
                        });
                        window.history.replaceState(null, '', ' ');
                    }
                } catch (e) {
                    console.error("Error importing list", e);
                }
            }
        };
        importSharedList();
    }, []);

    // Favorites Management
    const toggleFavorite = (e: React.MouseEvent, product: Product) => {
        e.stopPropagation();
        const isFav = favorites.some(p => p.id === product.id);
        let updated: Product[];
        if (isFav) {
            updated = favorites.filter(p => p.id !== product.id);
            setActiveBasketIds(prev => {
                const next = prev.filter(id => id !== product.id);
                localStorage.setItem('posokanei_active_basket', JSON.stringify(next));
                return next;
            });
        } else {
            updated = [...favorites, product];
            setActiveBasketIds(prev => {
                const next = [...prev, product.id];
                localStorage.setItem('posokanei_active_basket', JSON.stringify(next));
                return next;
            });
        }
        setFavorites(updated);
        localStorage.setItem('posokanei_favorites', JSON.stringify(updated));
    };

    const clearAllFavorites = () => {
        if (confirm(language === 'en' ? 'Are you sure you want to remove all saved products?' : "Είστε σίγουροι ότι θέλετε να διαγράψετε όλα τα αγαπημένα σας προϊόντα;")) {
            setFavorites([]);
            setActiveBasketIds([]);
            localStorage.removeItem('posokanei_favorites');
            localStorage.removeItem('posokanei_active_basket');
        }
    };

    const resetFilters = () => {
        setSearchTerm('');
        setCategoryPath([]);
        setShowAllProductsInCategory(false);
        setCurrentPage(1);
        setProductError('');
        setActiveTab('products');
        setIsCategoryBrowserOpen(false);
        setCategoryBrowserQuery('');
    };

    const handleBarcodeScanSuccess = async (barcode: string) => {
        // Check client-side memory cache first to prevent rate limiting
        if (barcodeCache[barcode]) {
            setSelectedProduct(barcodeCache[barcode]);
            setIsDetailOpen(true);
            return;
        }

        setLoadingProducts(true);
        try {
            const res = await fetch(`/api/products/barcode/${barcode}?countries=GR&include_tax=true`);
            if (res.ok) {
                const data = await res.json();
                if (data) {
                    const sanitized = {
                        ...sanitizeProduct(data),
                        barcode: barcode
                    };
                    // Update cache
                    setBarcodeCache(prev => ({
                        ...prev,
                        [barcode]: sanitized
                    }));
                    setSelectedProduct(sanitized);
                    setIsDetailOpen(true);
                    return;
                }
            }
            
            // Fallback: search textually if barcode direct lookup is not found
            setSearchTerm(barcode);
            setCurrentPage(1);
            setActiveTab('products');
            alert(`Το barcode "${barcode}" δεν αντιστοιχεί σε κάποιο προϊόν απευθείας. Έγινε αναζήτηση με τον κωδικό.`);
        } catch (error) {
            console.error("Barcode search error:", error);
            setSearchTerm(barcode);
            setCurrentPage(1);
            setActiveTab('products');
        } finally {
            setLoadingProducts(false);
        }
    };



    const handleCategoryClick = (catId: string) => {
        setCategoryPath([catId]);
        setShowAllProductsInCategory(false);
        setCurrentPage(1);
        setActiveTab('products');
        setIsCategoryBrowserOpen(false);
        setCategoryBrowserQuery('');
    };

    const getBreadcrumbs = () => {
        const steps = [{ name: t('home'), onClick: resetFilters }];
        
        let currentList = categories;
        const pathAcc: string[] = [];
        for (const id of categoryPath) {
            const cat = currentList.find(c => c.category_id === id);
            if (cat) {
                pathAcc.push(id);
                const snapshotPath = [...pathAcc];
                steps.push({
                    name: categoryName(cat),
                    onClick: () => {
                        setCategoryPath(snapshotPath);
                        setShowAllProductsInCategory(false);
                        setCurrentPage(1);
                    }
                });
                currentList = cat.children || [];
            }
        }
        
        if (searchTerm) {
            steps.push({
                name: `${language === 'en' ? 'Search' : 'Αναζήτηση'}: "${searchTerm}"`,
                onClick: () => {}
            });
        }
        
        return steps;
    };
    const breadcrumbs = getBreadcrumbs();

    // Calculate cheapest retailer for a product
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

    const selectSubcategory = (e: React.MouseEvent, parentId: string, subId: string) => {
        e.stopPropagation();
        setCategoryPath([parentId, subId]);
        setShowAllProductsInCategory(false);
        setCurrentPage(1);
        setActiveTab('products');
        setIsCategoryBrowserOpen(false);
        setCategoryBrowserQuery('');
    };

    // Render price details chart
    useEffect(() => {
        if (!selectedProduct || !chartRef.current || !isDetailOpen) return;

        let activeChart: { destroy: () => void } | null = null;

        // Generate mockup chart data because the API historical endpoints require specific authorization or range parameters
        const labels = ['1 Μαΐ', '10 Μαΐ', '20 Μαΐ', '1 Ιουν', '10 Ιουν', '17 Ιουν'];
        const datasets = ALLOWED_RETAILERS.map(storeId => {
            const meta = RETAILER_META[storeId] || { name: storeId, color: '#94a3b8' };
            const priceObj = selectedProduct.retailer_prices.find(rp => rp.retailer === storeId);
            
            let dataPoints: (number | null)[] = [];
            if (priceObj) {
                const basePrice = priceObj.price;
                // Generate a slight historic wave for presentation
                dataPoints = [
                    basePrice * 1.05,
                    basePrice * 1.03,
                    basePrice * (priceObj.discount ? 0.95 : 1.0),
                    basePrice * 1.02,
                    basePrice * 0.99,
                    basePrice
                ];
            } else {
                dataPoints = [null, null, null, null, null, null];
            }

            return {
                label: meta.name,
                data: dataPoints,
                borderColor: meta.color,
                backgroundColor: meta.color + '1a',
                borderWidth: 2,
                tension: 0.3,
                spanGaps: true,
                pointRadius: 4,
                pointHoverRadius: 6
            };
        }).filter(ds => ds.data.some(p => p !== null));

        // Dynamically import Chart to reduce initial JS load
        import('chart.js/auto').then(({ default: Chart }) => {
            if (!chartRef.current) return;
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }

            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                activeChart = new Chart(ctx, {
                    type: 'line',
                    data: { labels, datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {
                                    color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                                    font: { family: 'inherit', size: 11 }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { color: theme === 'dark' ? '#33415533' : '#e2e8f088' },
                                ticks: { color: theme === 'dark' ? '#94a3b8' : '#64748b' }
                            },
                            y: {
                                grid: { color: theme === 'dark' ? '#33415533' : '#e2e8f088' },
                                ticks: { 
                                    color: theme === 'dark' ? '#94a3b8' : '#64748b',
                                    callback: (val) => `€${Number(val).toFixed(2)}`
                                }
                            }
                        }
                    }
                });
                chartInstance.current = activeChart;
            }
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
            if (activeChart) {
                activeChart.destroy();
            }
        };
    }, [selectedProduct, isDetailOpen, theme]);

    // Open product details drawer
    const showProductDetails = (product: Product) => {
        setSelectedProduct(product);
        setIsDetailOpen(true);
    };

    // Generate Share Message Text
    const shareMessageText = useMemo(() => {
        if (activeBasketProducts.length === 0) return '';
        let text = language === 'en' ? `🛒 Kallathaki.gr - Shopping List\n` : `🛒 Kallathaki.gr - Λίστα Αγορών\n`;
        text += `================================\n\n`;

        text += language === 'en' ? `📋 Products to buy:\n` : `📋 Προϊόντα προς αγορά:\n`;
        activeBasketProducts.forEach(p => {
            text += `- ${p.name}\n`;
        });
        text += `\n`;

        // 1. Single Store Run
        const results = ALLOWED_RETAILERS.map(retId => {
            let totalCost = 0;
            let itemsCount = 0;
            activeBasketProducts.forEach(prod => {
                const priceObj = prod.retailer_prices.find(rp => rp.retailer === retId);
                if (priceObj) {
                    totalCost += priceObj.price;
                    itemsCount++;
                }
            });
            return {
                retailerId: retId,
                totalCost,
                itemsCount,
                totalItems: activeBasketProducts.length
            };
        });

        results.sort((a, b) => {
            if (b.itemsCount !== a.itemsCount) return b.itemsCount - a.itemsCount;
            return a.totalCost - b.totalCost;
        });

        if (results.length > 0) {
            const bestSingle = results[0];
            const meta = RETAILER_META[bestSingle.retailerId] || { name: bestSingle.retailerId };
            text += language === 'en' ? `1️⃣ Option A: Everything from one store\n` : `1️⃣ Επιλογή Α: Όλα από 1 κατάστημα\n`;
            text += `📍 ${meta.name}\n`;
            text += language === 'en'
                ? `💰 Total: €${bestSingle.totalCost.toFixed(2)} (${bestSingle.itemsCount}/${bestSingle.totalItems} products)\n\n`
                : `💰 Σύνολο: €${bestSingle.totalCost.toFixed(2)} (${bestSingle.itemsCount}/${bestSingle.totalItems} προϊόντα)\n\n`;
        }

        // 2. Split Trip
        const storeGrouping: { [key: string]: string[] } = {};
        activeBasketProducts.forEach(prod => {
            const cheapest = getCheapestRetailer(prod);
            if (cheapest) {
                if (!storeGrouping[cheapest.retailer]) {
                    storeGrouping[cheapest.retailer] = [];
                }
                storeGrouping[cheapest.retailer].push(prod.name);
            }
        });

        const groups = Object.entries(storeGrouping);
        if (groups.length > 0) {
            text += language === 'en' ? `2️⃣ Option B: Split basket for best prices\n` : `2️⃣ Επιλογή Β: Διαμοιρασμός (Καλύτερες Τιμές)\n`;
            groups.forEach(([retId, items]) => {
                const meta = RETAILER_META[retId] || { name: retId };
                text += `📍 ${meta.name}:\n`;
                items.forEach(item => {
                    text += `  - ${item}\n`;
                });
            });
        }

        return text;
    }, [activeBasketProducts, language]);

    const webShareLink = useMemo(() => {
        if (!mounted || activeBasketProducts.length === 0) return '';
        const ids = activeBasketProducts.map(p => p.id).join(',');
        return `${window.location.origin}${window.location.pathname}#share=${ids}`;
    }, [activeBasketProducts, mounted]);

    // Copy handlers
    const copyText = () => {
        navigator.clipboard.writeText(shareMessageText).then(() => {
            alert(language === 'en' ? 'Shopping list copied. You can send it through WhatsApp or Viber.' : 'Η λίστα αγορών αντιγράφηκε! Μπορείτε να τη στείλετε μέσω WhatsApp/Viber.');
        });
    };

    const copyLink = () => {
        navigator.clipboard.writeText(webShareLink).then(() => {
            alert(language === 'en' ? 'Kallathaki.gr link copied to clipboard.' : 'Ο σύνδεσμος Kallathaki.gr αντιγράφηκε στο πρόχειρο!');
        });
    };

    // Calculate Favorites Matrix Table columns
    const activeFavRetailers = useMemo(() => {
        const set = new Set<string>();
        activeBasketProducts.forEach(p => {
            p.retailer_prices.forEach(rp => set.add(rp.retailer));
        });
        return Array.from(set);
    }, [activeBasketProducts]);

    const basketOptimizer = useMemo(() => {
        try {
            const totalItems = activeBasketProducts.length;
            const activeRetailersList = favoriteRetailers.length > 0 ? favoriteRetailers : ALLOWED_RETAILERS;
            const retailerIds = activeRetailersList.filter((retailerId) =>
                activeBasketProducts.some((product) => product.retailer_prices.some((price) => price.retailer === retailerId))
            );

            const combinations = <T,>(items: T[], size: number): T[][] => {
                if (size === 1) return items.map((item) => [item]);
                const result: T[][] = [];
                items.forEach((item, index) => {
                    combinations(items.slice(index + 1), size - 1).forEach((tail) => result.push([item, ...tail]));
                });
                return result;
            };

            const buildOption = (stores: string[]) => {
                const groups: { [key: string]: { retailerId: string; items: { id: string; name: string; price: number }[]; total: number } } = {};
                const missingItems: Product[] = [];
                let totalCost = 0;

                activeBasketProducts.forEach((product) => {
                    const bestPrice = product.retailer_prices
                        .filter((price) => stores.includes(price.retailer))
                        .sort((a, b) => a.price - b.price)[0];

                    if (!bestPrice) {
                        missingItems.push(product);
                        return;
                    }

                    if (!groups[bestPrice.retailer]) {
                        groups[bestPrice.retailer] = { retailerId: bestPrice.retailer, items: [], total: 0 };
                    }

                    groups[bestPrice.retailer].items.push({ id: product.id, name: product.name, price: bestPrice.price });
                    groups[bestPrice.retailer].total += bestPrice.price;
                    totalCost += bestPrice.price;
                });

                return {
                    stores,
                    stops: stores.length,
                    totalCost,
                    coveredItems: totalItems - missingItems.length,
                    totalItems,
                    missingItems,
                    groups: Object.values(groups).sort((a, b) => b.total - a.total),
                    complete: missingItems.length === 0
                };
            };

            const options = [1, 2, 3]
                .flatMap((size) => combinations(retailerIds, size))
                .map(buildOption)
                .filter((option) => option.coveredItems > 0)
                .sort((a, b) => {
                    if (a.complete !== b.complete) return a.complete ? -1 : 1;
                    if (b.coveredItems !== a.coveredItems) return b.coveredItems - a.coveredItems;
                    if (a.totalCost !== b.totalCost) return a.totalCost - b.totalCost;
                    return a.stops - b.stops;
                });

            const completeOptions = options.filter((option) => option.complete);
            const bestByStops = (stops: number) => completeOptions.filter((option) => option.stops === stops).sort((a, b) => a.totalCost - b.totalCost)[0];
            const convenient = bestByStops(1) || options.filter((option) => option.stops === 1)[0] || options[0];
            const bestTwo = bestByStops(2);
            const bestThree = bestByStops(3);
            const maximumSavings = completeOptions.sort((a, b) => a.totalCost - b.totalCost || a.stops - b.stops)[0] || options[0];

            const hasMeaningfulSaving = (from?: { totalCost: number }, to?: { totalCost: number }) => {
                if (!from || !to) return false;
                const saving = from.totalCost - to.totalCost;
                return saving >= 3 || saving / Math.max(from.totalCost, 1) >= 0.05;
            };

            let recommended = convenient;
            if (bestTwo && hasMeaningfulSaving(convenient, bestTwo)) {
                recommended = bestTwo;
            }
            if (bestThree && recommended === bestTwo && hasMeaningfulSaving(bestTwo, bestThree)) {
                recommended = bestThree;
            }

            const baseline = [...completeOptions].sort((a, b) => b.totalCost - a.totalCost)[0] || options.sort((a, b) => b.totalCost - a.totalCost)[0];
            const baselineCost = baseline?.totalCost || 0;
            const bestPossibleSaving = Math.max(0, baselineCost - (maximumSavings?.totalCost || 0));

            return {
                options,
                convenient,
                recommended,
                maximumSavings,
                baselineCost,
                bestPossibleSaving,
                hasEnoughData: options.length > 0,
                missingPriceCount: activeBasketProducts.filter((product) => product.retailer_prices.length === 0).length
            };
        } catch (error) {
            console.error('Basket optimizer calculation failed', error);
            return {
                options: [],
                convenient: undefined,
                recommended: undefined,
                maximumSavings: undefined,
                baselineCost: 0,
                bestPossibleSaving: 0,
                hasEnoughData: false,
                missingPriceCount: activeBasketProducts.length
            };
        }
    }, [activeBasketProducts, favoriteRetailers]);

    // Single Store Run comparison
    const singleStoreResults = useMemo(() => {
        if (activeBasketProducts.length === 0) return [];
        return ALLOWED_RETAILERS.map(retId => {
            let totalCost = 0;
            let itemsCount = 0;
            activeBasketProducts.forEach(prod => {
                const priceObj = prod.retailer_prices.find(rp => rp.retailer === retId);
                if (priceObj) {
                    totalCost += priceObj.price;
                    itemsCount++;
                }
            });
            return {
                retailerId: retId,
                totalCost,
                itemsCount,
                totalItems: activeBasketProducts.length,
                percentage: activeBasketProducts.length > 0 ? (itemsCount / activeBasketProducts.length) * 100 : 0
            };
        })
        .filter(res => res.itemsCount === res.totalItems)
        .sort((a, b) => a.totalCost - b.totalCost);
    }, [activeBasketProducts]);

    // Split trip calculation
    const splitTripData = useMemo(() => {
        const storeGrouping: { [key: string]: { retailerId: string; items: { name: string; price: number }[]; total: number } } = {};
        let totalOptimizedCost = 0;
        let totalWorstCost = 0;

        activeBasketProducts.forEach(prod => {
            const cheapest = getCheapestRetailer(prod);
            if (cheapest) {
                const maxPrice = prod.price_stats?.max_price || cheapest.price;
                totalWorstCost += maxPrice;

                if (!storeGrouping[cheapest.retailer]) {
                    storeGrouping[cheapest.retailer] = {
                        retailerId: cheapest.retailer,
                        items: [],
                        total: 0
                    };
                }
                storeGrouping[cheapest.retailer].items.push({
                    name: prod.name,
                    price: cheapest.price
                });
                storeGrouping[cheapest.retailer].total += cheapest.price;
                totalOptimizedCost += cheapest.price;
            }
        });

        const groups = Object.values(storeGrouping).sort((a, b) => b.total - a.total);
        const savings = totalWorstCost - totalOptimizedCost;

        return { groups, totalCost: totalOptimizedCost, savings };
    }, [activeBasketProducts]);

    const deferredFavorites = useDeferredValue(favorites);
    const deferredActiveBasketProducts = useDeferredValue(activeBasketProducts);
    const deferredSavedBaskets = useDeferredValue(savedBaskets);
    const deferredShoppingHistory = useDeferredValue(shoppingHistory);
    const deferredRecentSearches = useDeferredValue(recentSearches);

    const currencyFormatter = useMemo(() => new Intl.NumberFormat(language === 'el' ? 'el-GR' : 'en-US', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }), [language]);

    const profileDisplayName = profileName.trim() || 'Angelo';
    const greetingHour = new Date().getHours();
    const profileGreeting = language === 'el'
        ? greetingHour < 12 ? 'Καλημέρα' : greetingHour < 18 ? 'Καλησπέρα' : 'Καλώς ήρθες πίσω'
        : greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Welcome back' : 'Good evening';
    const profileGreetingSubline = language === 'el'
        ? 'Έτοιμος για τα ψώνια αυτής της εβδομάδας;'
        : 'Ready for this week\'s shopping?';

    const savingsSnapshot = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const weekStart = startOfWeek(now);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);

        const sumSince = (start: Date) => deferredShoppingHistory.reduce((sum, entry) => {
            return new Date(entry.date) >= start ? sum + entry.savings : sum;
        }, 0);

        const allSavings = deferredShoppingHistory.reduce((sum, entry) => sum + entry.savings, 0);
        return {
            today: sumSince(todayStart),
            week: sumSince(weekStart),
            month: sumSince(monthStart),
            year: sumSince(yearStart),
            lifetime: allSavings
        };
    }, [deferredShoppingHistory]);

    const favoriteStoreSummary = useMemo(() => {
        const counts = new Map<string, number>();
        deferredShoppingHistory.forEach((entry) => {
            entry.stores.forEach((storeId) => counts.set(storeId, (counts.get(storeId) || 0) + 1));
        });

        if (counts.size === 0) {
            const fallbackStore = favoriteRetailers[0];
            return fallbackStore ? RETAILER_META[fallbackStore]?.name || fallbackStore : (language === 'el' ? 'Δεν ορίστηκε' : 'Not set');
        }

        const [favoriteStore] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        return RETAILER_META[favoriteStore]?.name || favoriteStore;
    }, [deferredShoppingHistory, favoriteRetailers, language]);

    const recentHistoryEntry = deferredShoppingHistory[0] || null;
    const latestSavedBasket = deferredSavedBaskets[0] || null;

    const motivationLine = useMemo(() => {
        const coffees = Math.floor(savingsSnapshot.lifetime / 2.8);
        const lunches = Math.floor(savingsSnapshot.lifetime / 24);

        if (language === 'el') {
            if (coffees >= 1 && lunches >= 1) return `Έχεις ήδη γλιτώσει αρκετά για ${coffees} καφέδες ή ${lunches} οικογενειακά γεύματα.`;
            if (coffees >= 1) return `Έχεις ήδη γλιτώσει αρκετά για ${coffees} καφέδες.`;
            return 'Κάθε μικρή εξοικονόμηση κάνει το επόμενο καλάθι πιο άνετο.';
        }

        if (coffees >= 1 && lunches >= 1) return `You have already saved enough for ${coffees} coffees or ${lunches} family lunches.`;
        if (coffees >= 1) return `You have already saved enough for ${coffees} coffees.`;
        return 'Every small saving makes the next basket lighter.';
    }, [language, savingsSnapshot.lifetime]);

    const openProfileView = (view: 'savedBaskets' | 'history' | 'supermarkets' | 'settings') => {
        startTransition(() => {
            setProfileSubView(view);
        });
    };

    const handleContinueShopping = () => {
        startTransition(() => {
            setActiveTab('products');
        });
    };

    const handleOptimizeBasketShortcut = () => {
        startTransition(() => {
            setActiveTab('favorites');
            setFavoritesSubTab('basket');
            setShowOptimizerResults(true);
        });
    };

    const handleRepeatWeeklyBasket = () => {
        if (!latestSavedBasket) {
            setToastMessage(language === 'el'
                ? 'Αποθηκεύστε πρώτα ένα καλάθι για να το επαναλαμβάνετε γρήγορα.'
                : 'Save a basket first so you can repeat it quickly.');
            return;
        }

        loadBasket(latestSavedBasket);
        setToastMessage(language === 'el'
            ? `Το καλάθι "${latestSavedBasket.name}" είναι έτοιμο ξανά.`
            : `"${latestSavedBasket.name}" is ready again.`);

        startTransition(() => {
            setActiveTab('favorites');
            setFavoritesSubTab('basket');
        });
    };

    const handleRecentSearchClick = (query: string) => {
        setSearchTerm(query);
        setCurrentPage(1);
        startTransition(() => {
            setActiveTab('products');
        });
    };

    const handleHelpPlaceholder = (label: string) => {
        setToastMessage(language === 'el'
            ? `${label}: έρχεται σύντομα.`
            : `${label}: coming soon.`);
    };

    return (
        <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
            <div className="flex h-screen overflow-hidden">
                
                {/*
                Collapsible/Drawer Sidebar removed in favor of the category browser overlay.
                <aside className={`
                    fixed inset-y-0 left-0 z-40 w-80 bg-sidebar-bg border-r border-border-custom 
                    transition-transform duration-300 md:relative md:translate-x-0 flex flex-col
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}>
                    <div className="p-6 border-b border-border-custom flex items-center justify-between">
                        <button 
                            onClick={resetFilters}
                            className="flex items-center gap-2 text-left hover:opacity-85 transition cursor-pointer focus:outline-none"
                            title="Επιστροφή στην Αρχική"
                        >
                            <ShoppingBasket className="w-6 h-6 text-indigo-500" />
                            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-emerald-500 bg-clip-text text-transparent">Kallathaki</h1>
                        </button>
                        <button className="md:hidden p-1 text-slate-500 hover:bg-input-custom rounded-lg" onClick={() => setIsSidebarOpen(false)} aria-label="Κλείσιμο μενού">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <button 
                            onClick={resetFilters}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition ${
                                searchTerm === '' && selectedCategoryId === '' && activeTab === 'products'
                                    ? 'bg-indigo-500/10 text-indigo-500' 
                                    : 'text-slate-600 hover:bg-input-custom dark:text-slate-350'
                            }`}
                        >
                            <Home className="w-4 h-4" />
                            <span>Αρχική</span>
                        </button>

                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-2">
                            <span>ΚΑΤΗΓΟΡΙΕΣ</span>
                            {loadingCategories && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                        </div>

                        <div className="space-y-1">
                            {categories.map((cat) => {
                                const hasChildren = cat.children && cat.children.length > 0;
                                const isOpen = !!openCategories[cat.category_id];
                                const isActive = selectedCategoryId === cat.category_id;

                                return (
                                    <div key={cat.category_id} className="rounded-xl overflow-hidden border border-transparent">
                                        <button 
                                            className={`
                                                w-full flex items-center justify-between p-3 text-left transition rounded-xl text-sm font-medium
                                                ${isActive 
                                                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                                                    : 'hover:bg-input-custom'}
                                            `}
                                            onClick={() => toggleCategoryAccordion(cat.category_id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                {cat.image_url ? (
                                                    <img src={cat.image_url} alt="" className="w-6 h-6 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=40&q=80' }} />
                                                ) : (
                                                    <ShoppingBag className="w-5 h-5 text-slate-400" />
                                                )}
                                                <span className="truncate max-w-[160px]">{cat.name}</span>
                                            </div>
                                            {hasChildren && (
                                                isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />
                                            )}
                                        </button>
                                        
                                        {hasChildren && isOpen && (
                                            <div className="pl-11 pr-2 py-1 space-y-1 bg-input-custom rounded-b-xl border-t border-border-custom">
                                                {cat.children?.map(sub => {
                                                    const isSubActive = selectedSubcategoryId === sub.category_id;
                                                    return (
                                                        <button 
                                                            key={sub.category_id}
                                                            className={`
                                                                w-full text-left py-2 px-3 rounded-lg text-xs transition
                                                                ${isSubActive 
                                                                    ? 'text-indigo-500 font-bold bg-indigo-500/10' 
                                                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}
                                                            `}
                                                            onClick={(e) => selectSubcategory(e, cat.category_id, sub.category_id)}
                                                        >
                                                            {sub.name} ({sub.total_product_count || 0})
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-4 border-t border-border-custom text-xs text-slate-500 space-y-2 bg-input-custom">
                        <div className="flex items-start gap-2 font-semibold text-slate-650 dark:text-slate-300">
                            <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span>Τιμές από επίσημα δεδομένα{statsCatalogUpdatedAt(stats) ? ` — ενημέρωση ${formatGreekDate(statsCatalogUpdatedAt(stats))}` : ''}</span>
                        </div>
                        <p className="leading-relaxed">
                            Τα δεδομένα προέρχονται από δημόσια διαθέσιμες πηγές τιμών.
                        </p>
                    </div>
                </aside>
                */}

                {/* Main Content Pane */}
                <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                    
                    {/* Header bar */}
                    <header className="px-4 py-3 sm:px-6 border-b border-border-custom bg-panel-bg flex flex-wrap gap-3 items-center justify-between">
                        
                        <div className="flex items-center gap-3 flex-1 min-w-[180px]">
                            <button className={`h-10 px-3 rounded-xl border text-xs font-bold transition flex items-center gap-2 shrink-0 ${selectedCategoryId ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'bg-background border-border-custom hover:bg-input-custom text-slate-700 dark:text-slate-300'}`} onClick={() => setIsCategoryBrowserOpen(true)} aria-label={t('openCategories')}>
                                <Menu className="w-5 h-5" />
                                <span className="hidden sm:inline">{categoryName(currentCategoryNode) || t('categories')}</span>
                            </button>
                            <button 
                                onClick={resetFilters}
                                className="flex items-center gap-2 text-left hover:opacity-85 transition cursor-pointer focus:outline-none select-none shrink-0"
                                title={t('home')}
                            >
                                <ShoppingBasket className="w-6 h-6 text-indigo-500" />
                                <span className="hidden sm:inline text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-emerald-500 bg-clip-text text-transparent">Kallathaki</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={toggleLanguage}
                                className="px-3 py-2.5 hover:bg-input-custom border border-border-custom rounded-xl transition text-xs font-black text-foreground"
                                title="Language"
                                aria-label="Language"
                            >
                                {language === 'el' ? 'EN' : 'EL'}
                            </button>

                            <button 
                                id="themeToggleBtn"
                                onClick={toggleTheme} 
                                className="p-2.5 hover:bg-input-custom border border-border-custom rounded-xl transition text-foreground"
                                title="Αλλαγή Θέματος"
                                aria-label="Αλλαγή Θέματος"
                            >
                                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                            </button>

                            <div className="flex bg-input-custom p-1 rounded-xl">
                                <button 
                                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${activeTab === 'products' ? 'bg-background shadow text-indigo-800 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-400 hover:text-foreground'}`}
                                    onClick={() => setActiveTab('products')}
                                >
                                    {t('products')}
                                </button>
                                <button 
                                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'favorites' ? 'bg-background shadow text-indigo-800 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-400 hover:text-foreground'}`}
                                    onClick={() => setActiveTab('favorites')}
                                >
                                    <ShoppingBasket className="w-3.5 h-3.5" />
                                    <span>{t('basket')} ({activeBasketIds.length}/{favorites.length})</span>
                                </button>
                            </div>

                        </div>
                    </header>

                    {/* Content Area */}
                    <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6 transition-colors duration-300 scroll-smooth">
                        {showFreshnessNotice && freshnessNoticeDate && (
                            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 rounded-xl bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                                        <AlertTriangle className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                                            {t('freshnessAlertTitle')}
                                        </div>
                                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                                            {t('freshnessAlertBody')} <span className="font-bold">{formatGreekDate(freshnessNoticeDate)}</span>.
                                            {' '}
                                            {freshnessNoticeAgeDays > 1
                                                ? `${freshnessNoticeAgeDays} ${language === 'en' ? 'days' : 'ημέρες'} `
                                                : `${language === 'en' ? '1 day ' : '1 ημέρα '}`}
                                            {language === 'en' ? 'old.' : 'παλιά.'}
                                            {' '}
                                            {t('freshnessAlertBodySuffix')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={dismissFreshnessNotice}
                                        className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
                                    >
                                        {t('freshnessAlertDismiss')}
                                    </button>
                                </div>
                            </div>
                        )}
                        {activeTab === 'products' ? (
                            <div className={isHomeScreen ? "space-y-14 pb-12" : "space-y-6"}>
                                {isHomeScreen && (
                                    <div className="relative bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-xl overflow-hidden animate-fadeIn">
                                        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,transparent_45%,rgba(16,185,129,0.16)_100%)] pointer-events-none" />

                                        <div className="relative z-10 max-w-2xl">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-[11px] font-semibold mb-4">
                                                <ShieldCheck className="w-3.5 h-3.5 text-white/80" />
                                                <span>{t('officialData')}{statsCatalogUpdatedAt(stats) ? ` — ${language === 'en' ? 'updated' : 'ενημέρωση'} ${formatGreekDate(statsCatalogUpdatedAt(stats))}` : ''}</span>
                                            </div>
                                            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-white via-emerald-100 to-amber-200 bg-clip-text text-transparent">
                                                {t('compareTitle')}
                                            </h2>
                                            <p className="text-sm md:text-base text-white/90 max-w-lg mt-3 font-medium">
                                                {t('compareText')}
                                            </p>
                                            
                                            <div className="mt-6 flex flex-wrap gap-4">
                                                <button
                                                    onClick={() => {
                                                        categorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                        window.setTimeout(() => categorySectionRef.current?.focus(), 250);
                                                    }}
                                                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-indigo-800 hover:bg-indigo-50 font-bold rounded-2xl shadow-md transition duration-250 cursor-pointer text-sm"
                                                >
                                                    <LayoutGrid className="w-4 h-4 text-indigo-800" />
                                                    <span>{t('startCompare')}</span>
                                                </button>
                                                <button 
                                                    onClick={() => setIsScannerOpen(true)}
                                                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-indigo-600/20 border border-white/20 hover:bg-indigo-600/35 text-white font-bold rounded-2xl shadow-md transition duration-250 cursor-pointer text-sm"
                                                >
                                                    <Camera className="w-4.5 h-4.5 text-indigo-250" />
                                                    <span>{t('scanBarcode')}</span>
                                                </button>
                                                <Link
                                                    href="/guide"
                                                    className="inline-flex items-center gap-2 px-5 py-3.5 text-white/90 hover:text-white font-bold rounded-2xl transition duration-250 cursor-pointer text-sm"
                                                >
                                                    <Sparkles className="w-4 h-4" />
                                                    <span>{t('guide')}</span>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <section key="persistent-search-bar" className={`bg-card-bg border border-border-custom rounded-3xl shadow-sm transition-all duration-300 ${isHomeScreen ? 'p-5 sm:p-7' : 'p-4'}`}>
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                                        {isHomeScreen && (
                                            <div className="lg:w-80 animate-fadeIn">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{t('productSearch')}</span>
                                                <h3 className="text-xl font-black text-slate-850 dark:text-slate-100 mt-1">{t('homeSearchTitle')}</h3>
                                                <p className="text-sm text-slate-500 mt-2">{t('homeSearchText')}</p>
                                            </div>
                                        )}
                                        <div className="relative flex-1">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="text"
                                                value={searchTerm}
                                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                                placeholder={language === 'en' ? 'e.g. milk, feta, coffee, detergent' : 'π.χ. γάλα, φέτα, καφές, απορρυπαντικό'}
                                                aria-label={language === 'en' ? 'Product search from home' : 'Αναζήτηση προϊόντων από την αρχική'}
                                                className="w-full pl-12 pr-10 py-4 text-base bg-input-custom border border-transparent focus:border-indigo-500 focus:bg-background rounded-2xl outline-none transition text-foreground shadow-inner"
                                            />
                                            {searchTerm && (
                                                <button
                                                    onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition cursor-pointer"
                                                    aria-label={t('clearSearch') || 'Καθαρισμός αναζήτησης'}
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {isHomeScreen ? (
                                    <React.Fragment key="home-contents">
                                        {/* Global Statistics Grid */}
                                        <div className="space-y-5 animate-fadeIn">
                                            <div className="px-1">
                                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                                                    {t('whyCompare')}
                                                </h3>
                                                <p className="text-sm text-slate-500 mt-1">{t('whyCompareText')}</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                                {[
                                                    {
                                                        label: language === 'en' ? 'More choices' : 'Περισσότερες επιλογές',
                                                        value: stats ? Number(stats.total_products).toLocaleString('el-GR') : '8.773',
                                                        desc: language === 'en' ? 'Products ready to compare' : 'Προϊόντα για σύγκριση τιμών',
                                                        icon: <ShoppingBag className="w-5 h-5 text-indigo-500" />,
                                                        bgColor: 'bg-indigo-500/10'
                                                    },
                                                    {
                                                        label: language === 'en' ? 'Offers today' : 'Ευκαιρίες σήμερα',
                                                        value: stats ? Number(stats.products_on_discount).toLocaleString('el-GR') : '2.263',
                                                        desc: language === 'en' ? 'Products currently on offer' : 'Προϊόντα με ένδειξη προσφοράς',
                                                        icon: <Percent className="w-5 h-5 text-emerald-500" />,
                                                        bgColor: 'bg-emerald-500/10'
                                                    },
                                                    {
                                                        label: language === 'en' ? 'Supermarket coverage' : 'Σύγκριση αλυσίδων',
                                                        value: language === 'en' ? `${ALLOWED_RETAILERS.length} supermarkets` : `${ALLOWED_RETAILERS.length} αλυσίδες`,
                                                        desc: language === 'en' ? 'Major chains for everyday shopping' : 'Οι βασικές επιλογές για καθημερινά ψώνια',
                                                        icon: <Store className="w-5 h-5 text-amber-500" />,
                                                        bgColor: 'bg-amber-500/10'
                                                    },
                                                    {
                                                        label: language === 'en' ? 'Fresh prices' : 'Πρόσφατες τιμές',
                                                        value: statsCatalogUpdatedAt(stats) ? formatGreekDate(statsCatalogUpdatedAt(stats)) : (language === 'en' ? 'Today' : 'Σήμερα'),
                                                        desc: language === 'en' ? 'Latest price update' : 'Τελευταία ενημέρωση δεδομένων',
                                                        icon: <Clock3 className="w-5 h-5 text-violet-500" />,
                                                        bgColor: 'bg-violet-500/10'
                                                    }
                                                ].map((stat, idx) => (
                                                    <div key={idx} className="bg-card-bg border border-border-custom p-5 rounded-2xl shadow-sm hover:shadow-md transition duration-300 flex items-start gap-4">
                                                        <div className={`p-3 rounded-xl ${stat.bgColor} flex items-center justify-center shrink-0`}>
                                                            {stat.icon}
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-slate-650 dark:text-slate-400 block font-medium">{stat.label}</span>
                                                            <strong className="text-xl font-extrabold text-slate-800 dark:text-slate-100 block mt-1">{stat.value}</strong>
                                                            <span className="text-[10px] text-slate-650 dark:text-slate-400 mt-0.5 block">{stat.desc}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Quick Category Navigation */}
                                        <div
                                            ref={categorySectionRef}
                                            tabIndex={-1}
                                            className="space-y-5 scroll-mt-6 focus:outline-none animate-fadeIn"
                                        >
                                            <div className="px-1">
                                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                                                    {t('discoverByCategory')}
                                                </h3>
                                                <p className="text-sm text-slate-500 mt-1">{t('discoverByCategoryText')}</p>
                                            </div>
                                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                                {categories.map((cat) => {
                                                    return (
                                                        <button
                                                            key={cat.category_id}
                                                            onClick={() => handleCategoryClick(cat.category_id)}
                                                            className="min-h-20 sm:min-h-24 flex items-center gap-2 sm:gap-4 text-left p-2.5 sm:p-4 rounded-2xl border border-border-custom bg-card-bg shadow-sm hover:shadow-md hover:border-indigo-500/40 active:scale-[0.99] transition duration-200 cursor-pointer group"
                                                        >
                                                            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-input-custom border border-border-custom overflow-hidden flex items-center justify-center shrink-0">
                                                                {cat.image_url ? (
                                                                    <img src={cat.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                                                ) : (
                                                                    <ShoppingBag className="w-5 h-5 text-slate-400" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <span className="text-sm font-black text-slate-850 dark:text-slate-100 block leading-tight truncate">{categoryName(cat)}</span>
                                                                <span className="text-[11px] text-slate-500 font-bold mt-1 block">
                                                                    {cat.total_product_count ? `${cat.total_product_count.toLocaleString('el-GR')} ${t('productCount')}` : t('viewAll')}
                                                                </span>
                                                            </div>
                                                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition shrink-0" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </React.Fragment>
                                ) : (
                                // SEARCH & BROWSE RESULTS VIEW
                                <div className="space-y-6">
                                    {/* Interactive Breadcrumbs */}
                                    {breadcrumbs.length > 1 && (
                                        <nav className="flex items-center gap-1.5 text-xs text-slate-450 font-medium flex-wrap mb-2">
                                            {breadcrumbs.map((step, idx) => (
                                                <React.Fragment key={idx}>
                                                    {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                                    <button
                                                        onClick={step.onClick}
                                                        className={`hover:text-indigo-500 transition ${
                                                            idx === breadcrumbs.length - 1 
                                                                ? 'text-slate-805 dark:text-slate-200 font-semibold cursor-default' 
                                                                : 'cursor-pointer'
                                                        }`}
                                                        disabled={idx === breadcrumbs.length - 1}
                                                    >
                                                        {step.name}
                                                    </button>
                                                </React.Fragment>
                                            ))}
                                        </nav>
                                    )}

                                    {/* Subcategory Filter Pills */}
                                    {!searchTerm && categoryPath.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none items-center">
                                            <button
                                                onClick={() => {
                                                    if (categoryPath.length === 1) {
                                                        resetFilters();
                                                    } else {
                                                        setCategoryPath(prev => prev.slice(0, -1));
                                                        setShowAllProductsInCategory(false);
                                                    }
                                                    setCurrentPage(1);
                                                }}
                                                className="px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 bg-input-custom hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-300 flex items-center gap-1"
                                            >
                                                <ChevronLeft className="w-3.5 h-3.5" />
                                                <span>Πίσω</span>
                                            </button>
                                            
                                            {(() => {
                                                const parentPath = categoryPath.length <= 1 ? [] : categoryPath.slice(0, -1);
                                                const parentNode = categoryPath.length <= 1 ? null : getCurrentCategoryNode(parentPath, categories);
                                                const siblings = parentNode ? (parentNode.children || []) : categories;
                                                const activeId = categoryPath[categoryPath.length - 1];
                                                
                                                return siblings.map(sub => (
                                                    <button
                                                        key={sub.category_id}
                                                        onClick={() => {
                                                            const newPath = [...parentPath, sub.category_id];
                                                            setCategoryPath(newPath);
                                                            setShowAllProductsInCategory(false);
                                                            setCurrentPage(1);
                                                        }}
                                                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                                                            activeId === sub.category_id
                                                                ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                                                                : 'bg-input-custom hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        {categoryName(sub)} ({sub.total_product_count || 0})
                                                    </button>
                                                ));
                                            })()}
                                        </div>
                                    )}

                                    {shouldShowSubcategoryGrid ? (
                                        /* Nested Subcategories Grid */
                                        <div className="space-y-6">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-custom pb-4">
                                                <div>
                                                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                        {categoryName(currentCategoryNode)}
                                                    </h2>
                                                    <p className="text-xs text-slate-455 mt-1 font-medium">
                                                        Επιλέξτε μια υποκατηγορία για να δείτε τα προϊόντα
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setShowAllProductsInCategory(true)}
                                                    className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow transition cursor-pointer flex items-center gap-2 self-start sm:self-auto"
                                                >
                                                    <LayoutGrid className="w-4 h-4" />
                                                    <span>{language === 'en' ? 'View all products' : 'Προβολή Όλων των Προϊόντων'} ({currentCategoryNode?.total_product_count || 0})</span>
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {currentCategoryNode?.children?.map(sub => (
                                                    <div
                                                        key={sub.category_id}
                                                        onClick={() => {
                                                            setCategoryPath(prev => [...prev, sub.category_id]);
                                                            setShowAllProductsInCategory(false);
                                                            setCurrentPage(1);
                                                        }}
                                                        className="group bg-card-bg border border-border-custom hover:border-indigo-500/50 p-5 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition duration-300 cursor-pointer flex items-center justify-between"
                                                    >
                                                        <div className="min-w-0 pr-4">
                                                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-500 transition truncate">
                                                                {categoryName(sub)}
                                                            </h4>
                                                            <p className="inline-flex mt-2 px-2.5 py-1 rounded-full bg-input-custom text-[10px] text-slate-650 dark:text-slate-300 font-bold">
                                                                {sub.total_product_count || 0} {t('productCount')}
                                                            </p>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition duration-300 shrink-0" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : loadingProducts ? (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div className="h-4 w-40 rounded-full bg-input-custom animate-pulse" />
                                                <div className="h-4 w-24 rounded-full bg-input-custom animate-pulse" />
                                            </div>
                                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                                                {Array.from({ length: 8 }).map((_, idx) => (
                                                    <div key={idx} className="bg-card-bg border border-border-custom rounded-2xl shadow-sm overflow-hidden">
                                                        <div className="h-44 bg-input-custom animate-pulse" />
                                                        <div className="p-4 space-y-3">
                                                            <div className="h-3 w-20 rounded-full bg-input-custom animate-pulse" />
                                                            <div className="h-4 w-full rounded-full bg-input-custom animate-pulse" />
                                                            <div className="h-4 w-3/4 rounded-full bg-input-custom animate-pulse" />
                                                            <div className="pt-3 border-t border-border-custom flex items-end justify-between">
                                                                <div className="space-y-2">
                                                                    <div className="h-3 w-10 rounded-full bg-input-custom animate-pulse" />
                                                                    <div className="h-6 w-16 rounded-full bg-input-custom animate-pulse" />
                                                                </div>
                                                                <div className="h-4 w-12 rounded-full bg-input-custom animate-pulse" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : products.length === 0 ? (
                                        <div className="h-[40vh] flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                                            <div className={`w-16 h-16 ${productError ? 'bg-amber-500/10 text-amber-600' : 'bg-indigo-500/10 text-indigo-600'} rounded-full flex items-center justify-center mb-4`}>
                                                {productError ? <Info className="w-8 h-8" /> : <Search className="w-8 h-8" />}
                                            </div>
                                            <h3 className="text-lg font-bold mb-1">{productError ? t('pricesNotLoadedTitle') : t('noProductsTitle')}</h3>
                                            <p className="text-sm text-slate-500 mb-4">
                                                {productError ? t('pricesNotLoadedText') : t('noProductsText')}
                                            </p>
                                            <button 
                                                onClick={resetFilters} 
                                                className="px-5 py-3 bg-indigo-500 text-white text-xs font-bold rounded-xl hover:bg-indigo-600 transition cursor-pointer"
                                            >
                                                {t('backHome')}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between text-xs font-medium text-slate-450">
                                                <span>{t('foundProducts')} {totalProductsCount} {t('productCount')}</span>
                                            </div>

                                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                                                    {products.map(prod => {
                                                        const isFav = favorites.some(p => p.id === prod.id);
                                                        const cheapest = getCheapestRetailer(prod);
                                                        const productUpdatedAt = formatProductUpdatedAt(prod);
                                                        return (
                                                            <div 
                                                                key={prod.id} 
                                                                onClick={() => showProductDetails(prod)}
                                                                className="group relative bg-card-bg border border-border-custom hover:border-indigo-500/50 rounded-2xl shadow-sm hover:shadow-md transition duration-300 overflow-hidden cursor-pointer flex flex-col"
                                                            >
                                                                {cheapest?.is_discount && (
                                                                    <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full z-10 shadow-md">
                                                                        {cheapest.discount_percentage ? `-${cheapest.discount_percentage}%` : 'Προσφορά'}
                                                                    </div>
                                                                )}

                                                                <button 
                                                                    onClick={(e) => toggleFavorite(e, prod)}
                                                                    className={`absolute top-2 right-2 p-3.5 z-20 rounded-full transition cursor-pointer shadow-sm border border-border-custom ${isFav ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-card-bg text-slate-400 hover:text-rose-500'}`}
                                                                >
                                                                    <Heart className={`w-4.5 h-4.5 ${isFav ? 'fill-current' : ''}`} />
                                                                </button>

                                                                <div className="p-4 flex items-center justify-center bg-input-custom h-44">
                                                                    <img 
                                                                        src={prod.image_url} 
                                                                        alt={prod.name}
                                                                        className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition duration-300"
                                                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80' }}
                                                                    />
                                                                </div>

                                                                <div className="p-4 flex-1 flex flex-col justify-between">
                                                                    <div>
                                                                        <span className="text-[10px] font-bold text-indigo-500 tracking-wider uppercase">{prod.brand || 'Γενικό'}</span>
                                                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-500 transition line-clamp-2 mt-1">{prod.name}</h4>
                                                                    </div>

                                                                    <div className="mt-4 pt-4 border-t border-border-custom flex items-end justify-between">
                                                                        <div>
                                                                            <span className="text-[10px] text-slate-450 block">Από</span>
                                                                            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">€{(prod.price_stats?.min_price || 0).toFixed(2)}</span>
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-450 font-semibold mb-1">
                                                                            {prod.unit_quantity} {prod.unit}
                                                                        </div>
                                                                    </div>

                                                                    <div className="mt-3 flex items-center gap-1.5">
                                                                        {prod.retailer_prices.map(rp => (
                                                                            <img 
                                                                                key={rp.retailer}
                                                                                className="w-5 h-5 rounded-full border border-border-custom object-cover" 
                                                                                src={retailerLogoUrl(rp.retailer)} 
                                                                                title={RETAILER_META[rp.retailer]?.name || rp.retailer}
                                                                                alt=""
                                                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                    {productUpdatedAt && (
                                                                        <div className="mt-3 flex items-center gap-1 text-[10px] text-slate-450 font-semibold">
                                                                            <Clock3 className="w-3 h-3" />
                                                                            <span>Ενημέρωση {productUpdatedAt}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>

                                            {/* Pagination */}
                                            <div className="pt-8 flex items-center justify-between border-t border-border-custom">
                                                <button 
                                                    disabled={currentPage === 1}
                                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                    className="px-4 py-2 text-xs font-semibold bg-background border border-border-custom disabled:opacity-50 disabled:cursor-not-allowed rounded-xl hover:bg-input-custom transition text-foreground"
                                                >
                                                    {t('previous')}
                                                </button>
                                                <span className="text-xs text-slate-450 font-medium">{t('page')} {currentPage} {t('from')} {totalPages}</span>
                                                <button 
                                                    disabled={currentPage === totalPages}
                                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                    className="px-4 py-2 text-xs font-semibold bg-background border border-border-custom disabled:opacity-50 disabled:cursor-not-allowed rounded-xl hover:bg-input-custom transition text-foreground"
                                                >
                                                    {t('next')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'offers' ? (
                            <div className="space-y-8 pb-12">
                                <section className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
                                    <div className="max-w-2xl">
                                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold mb-4">
                                            <Percent className="w-3.5 h-3.5" />
                                            {t('offersBadge')}
                                        </span>
                                        <h2 className="text-3xl font-black tracking-tight">{t('offersTitle')}</h2>
                                        <p className="text-sm text-white/80 mt-2">
                                            {t('offersText')}
                                        </p>
                                    </div>
                                </section>

                                {products.filter((product) => product.retailer_prices.some((price) => price.is_discount)).length === 0 ? (
                                    <div className="bg-card-bg border border-border-custom rounded-3xl p-8 text-center">
                                        <Percent className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                                        <h3 className="text-lg font-black">{t('offersEmptyTitle')}</h3>
                                        <p className="text-sm text-slate-500 mt-2">{t('offersEmptyText')}</p>
                                        <button
                                            onClick={() => setActiveTab('products')}
                                            className="mt-5 px-5 py-3 bg-indigo-500 text-white rounded-2xl text-sm font-black"
                                        >
                                            {t('searchProducts')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                        {[
                                            { title: t('biggestDiscounts'), subtitle: t('biggestDiscountsText') },
                                            { title: t('suggestedOffers'), subtitle: t('suggestedOffersText') }
                                        ].map((section) => (
                                            <div key={section.title} className="bg-card-bg border border-border-custom rounded-3xl p-5 shadow-sm">
                                                <h3 className="text-base font-black text-slate-850 dark:text-slate-100">{section.title}</h3>
                                                <p className="text-xs text-slate-500 mt-1 mb-4">{section.subtitle}</p>
                                                <div className="space-y-3">
                                                    {products.filter((product) => product.retailer_prices.some((price) => price.is_discount)).slice(0, 5).map((product) => {
                                                        const cheapest = getCheapestRetailer(product);
                                                        return (
                                                            <button
                                                                key={`${section.title}-${product.id}`}
                                                                onClick={() => showProductDetails(product)}
                                                                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-input-custom hover:bg-indigo-500/10 transition text-left"
                                                            >
                                                                <img src={product.image_url} alt="" className="w-12 h-12 rounded-xl object-contain bg-white p-1" />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-xs font-black truncate">{product.name}</div>
                                                                    <div className="text-[10px] text-slate-500 font-bold">{product.brand || product.category}</div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <div className="text-sm font-black text-emerald-600">€{(cheapest?.price || product.price_stats.min_price || 0).toFixed(2)}</div>
                                                                    <div className="text-[10px] font-black text-white bg-emerald-500 px-2 py-0.5 rounded-full">{t('offerLabel')}</div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'profile' ? (
                            profileSubView ? (
                                <div className="space-y-6 pb-12 animate-fadeIn">
                                    {/* Back Header */}
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setProfileSubView(null)}
                                            className="p-2 hover:bg-input-custom text-slate-650 dark:text-slate-350 rounded-xl transition cursor-pointer"
                                            aria-label={t('backToProfile')}
                                        >
                                            <ArrowLeft className="w-5 h-5" />
                                        </button>
                                        <h2 className="text-xl font-black text-slate-850 dark:text-slate-100">
                                            {profileSubView === 'savedBaskets' && t('savedBaskets')}
                                            {profileSubView === 'history' && t('shoppingHistory')}
                                            {profileSubView === 'supermarkets' && t('favoriteSupermarkets')}
                                            {profileSubView === 'settings' && t('settings')}
                                        </h2>
                                    </div>

                                    {/* Saved Baskets Sub-view */}
                                    {profileSubView === 'savedBaskets' && (
                                        <div className="space-y-6">
                                            <div className="bg-card-bg border border-border-custom rounded-3xl p-5 shadow-sm space-y-4">
                                                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                    {t('saveCurrentBasket')}
                                                </h3>
                                                {activeBasketProducts.length === 0 ? (
                                                    <p className="text-xs text-amber-500 font-semibold bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                                                        {t('activeBasketIsEmpty')}
                                                    </p>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <label className="text-xs font-medium text-slate-400">
                                                            {t('saveBasketPrompt')}
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <input 
                                                                type="text"
                                                                value={newBasketName}
                                                                onChange={(e) => setNewBasketName(e.target.value)}
                                                                placeholder={t('basketNamePlaceholder')}
                                                                className="flex-1 px-4 py-2 text-sm bg-background border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
                                                            />
                                                            <button 
                                                                onClick={() => {
                                                                    saveBasket(newBasketName);
                                                                    setNewBasketName('');
                                                                    setToastMessage(t('basketSavedSuccess'));
                                                                }}
                                                                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                                                            >
                                                                {t('saveCurrentBasket')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {savedBaskets.length === 0 ? (
                                                <div className="bg-card-bg border border-border-custom rounded-3xl p-8 text-center">
                                                    <ShoppingBasket className="w-10 h-10 text-indigo-500 mx-auto mb-3 opacity-60" />
                                                    <p className="text-sm text-slate-500 font-medium">{t('noSavedBaskets')}</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {savedBaskets.map((basket) => (
                                                        <div key={basket.id} className="bg-card-bg border border-border-custom rounded-3xl p-5 shadow-sm flex flex-col justify-between gap-4">
                                                            <div>
                                                                <h4 className="text-base font-black text-slate-800 dark:text-slate-100">{basket.name}</h4>
                                                                <p className="text-xs text-slate-400 mt-1">
                                                                    {t('date')}: {new Date(basket.createdAt).toLocaleDateString(language === 'el' ? 'el-GR' : 'en-US')}
                                                                </p>
                                                                <p className="text-xs font-bold text-indigo-500 mt-2">
                                                                    {basket.products.length} {language === 'el' ? 'προϊόντα' : 'products'}
                                                                </p>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button 
                                                                    onClick={() => {
                                                                        loadBasket(basket);
                                                                        setToastMessage(t('basketLoadedSuccess'));
                                                                    }}
                                                                    className="flex-1 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer"
                                                                >
                                                                    {t('load')}
                                                                </button>
                                                                <button 
                                                                    onClick={() => {
                                                                        if (confirm(t('confirmDeleteBasket'))) {
                                                                            deleteSavedBasket(basket.id);
                                                                        }
                                                                    }}
                                                                    className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white rounded-xl transition cursor-pointer"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Shopping History Sub-view */}
                                    {profileSubView === 'history' && (
                                        <div className="space-y-6">
                                            {shoppingHistory.length > 0 && (
                                                <div className="flex justify-end">
                                                    <button 
                                                        onClick={() => {
                                                            if (confirm(t('confirmClearHistory'))) {
                                                                clearShoppingHistory();
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        <span>{t('clearHistory')}</span>
                                                    </button>
                                                </div>
                                            )}

                                            {shoppingHistory.length === 0 ? (
                                                <div className="bg-card-bg border border-border-custom rounded-3xl p-8 text-center">
                                                    <Clock3 className="w-10 h-10 text-indigo-500 mx-auto mb-3 opacity-60" />
                                                    <p className="text-sm text-slate-500 font-medium">{t('noHistory')}</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {shoppingHistory.map((entry) => (
                                                        <details key={entry.id} className="group bg-card-bg border border-border-custom rounded-3xl overflow-hidden shadow-sm">
                                                            <summary className="list-none cursor-pointer p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                                                                <div className="space-y-1">
                                                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                                                        {t('completedTrip')}
                                                                    </h4>
                                                                    <p className="text-xs text-slate-400">
                                                                        {new Date(entry.date).toLocaleString(language === 'el' ? 'el-GR' : 'en-US')}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="text-right">
                                                                        <div className="text-sm text-slate-400 font-medium">{t('totalSpent')}</div>
                                                                        <strong className="text-base font-black text-slate-800 dark:text-slate-100">€{entry.totalCost.toFixed(2)}</strong>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="text-sm text-slate-400 font-medium">{t('totalSavings')}</div>
                                                                        <strong className="text-base font-black text-emerald-600 dark:text-emerald-400">€{entry.savings.toFixed(2)}</strong>
                                                                    </div>
                                                                    <button 
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            if (confirm(t('confirmDeleteTrip'))) {
                                                                                deleteHistoryEntry(entry.id);
                                                                            }
                                                                        }}
                                                                        className="p-2 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-xl transition cursor-pointer"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                    <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform" />
                                                                </div>
                                                            </summary>
                                                            <div className="px-5 pb-5 pt-2 border-t border-border-custom/50 space-y-4">
                                                                <div className="flex flex-wrap gap-2 items-center">
                                                                    <span className="text-xs font-bold text-slate-400">{t('storesVisited')}:</span>
                                                                    {entry.stores.map(storeId => (
                                                                        <span key={storeId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-input-custom text-[10px] font-bold text-slate-650 dark:text-slate-350">
                                                                            <img src={retailerLogoUrl(storeId)} alt="" className="w-4 h-4 rounded-full object-cover" />
                                                                            {RETAILER_META[storeId]?.name || storeId}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <span className="text-xs font-bold text-slate-400">{t('details')}:</span>
                                                                    <div className="divide-y divide-border-custom/50">
                                                                        {entry.items.map((item, idx) => (
                                                                            <div key={idx} className="flex justify-between items-center py-2 text-xs">
                                                                                <div className="flex items-center gap-2">
                                                                                    <img src={retailerLogoUrl(item.retailer)} alt="" className="w-4 h-4 rounded-full object-cover" />
                                                                                    <span className="text-slate-650 dark:text-slate-300 font-medium">{item.name}</span>
                                                                                </div>
                                                                                <strong className="text-slate-800 dark:text-slate-100">€{item.price.toFixed(2)}</strong>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </details>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Favorite Supermarkets Sub-view */}
                                    {profileSubView === 'supermarkets' && (
                                        <div className="bg-card-bg border border-border-custom rounded-3xl p-6 shadow-sm space-y-6">
                                            <p className="text-sm text-slate-500">
                                                {t('supermarketsDescription')}
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {ALLOWED_RETAILERS.map((retailerId) => {
                                                    const isFav = favoriteRetailers.includes(retailerId);
                                                    const meta = RETAILER_META[retailerId] || { name: retailerId };
                                                    return (
                                                        <div 
                                                            key={retailerId}
                                                            onClick={() => toggleFavoriteRetailer(retailerId)}
                                                            className={`
                                                                p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between select-none
                                                                ${isFav 
                                                                    ? 'bg-indigo-50/5 border-indigo-500/30' 
                                                                    : 'bg-input-custom border-transparent opacity-60 hover:opacity-100'}
                                                            `}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <img 
                                                                    src={retailerLogoUrl(retailerId)} 
                                                                    alt="" 
                                                                    className="w-10 h-10 rounded-full object-cover border border-border-custom"
                                                                />
                                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{meta.name}</span>
                                                            </div>
                                                            <div className={`
                                                                w-6 h-6 rounded-full flex items-center justify-center border transition
                                                                ${isFav 
                                                                    ? 'bg-indigo-500 border-indigo-500 text-white' 
                                                                    : 'border-slate-350 dark:border-slate-600'}
                                                            `}>
                                                                {isFav && <Check className="w-4 h-4" />}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Settings Sub-view */}
                                    {profileSubView === 'settings' && (
                                        <div className="space-y-6">
                                            <div className="bg-card-bg border border-border-custom rounded-3xl p-5 shadow-sm divide-y divide-border-custom">
                                                <div className="py-4 space-y-3">
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                            {language === 'el' ? 'Όνομα προφίλ' : 'Profile Name'}
                                                        </div>
                                                        <div className="text-xs text-slate-500 mt-1">
                                                            {language === 'el' ? 'Χρησιμοποιείται μόνο για το προσωπικό καλωσόρισμα στη συσκευή σου.' : 'Used only for the personal greeting on this device.'}
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={profileName}
                                                        onChange={(e) => saveProfileName(e.target.value)}
                                                        placeholder={language === 'el' ? 'π.χ. Angelo' : 'e.g. Angelo'}
                                                        className="w-full px-4 py-3 text-sm bg-background border border-border-custom rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-foreground"
                                                    />
                                                </div>

                                                {/* Language Setting */}
                                                <div className="py-4 flex items-center justify-between gap-4">
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('languageSettings')}</div>
                                                    </div>
                                                    <button 
                                                        onClick={toggleLanguage}
                                                        className="px-4 py-2 bg-input-custom hover:bg-border-custom/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl transition cursor-pointer border border-border-custom"
                                                    >
                                                        {language === 'el' ? 'English' : 'Ελληνικά'}
                                                    </button>
                                                </div>

                                                {/* Theme Setting */}
                                                <div className="py-4 flex items-center justify-between gap-4">
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('themeSettings')}</div>
                                                    </div>
                                                    <div className="flex bg-input-custom p-1 rounded-xl border border-border-custom">
                                                        <button 
                                                            onClick={() => theme !== 'light' && toggleTheme()}
                                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${theme === 'light' ? 'bg-background shadow text-slate-800 dark:text-slate-100' : 'text-slate-450 hover:text-foreground'}`}
                                                        >
                                                            <Sun className="w-3.5 h-3.5" />
                                                            <span>{t('themeLight')}</span>
                                                        </button>
                                                        <button 
                                                            onClick={() => theme !== 'dark' && toggleTheme()}
                                                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${theme === 'dark' ? 'bg-background shadow text-indigo-500 dark:text-indigo-400' : 'text-slate-450 hover:text-foreground'}`}
                                                        >
                                                            <Moon className="w-3.5 h-3.5" />
                                                            <span>{t('themeDark')}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Reset Section */}
                                            <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-6 space-y-4">
                                                <h3 className="text-sm font-black text-rose-500 flex items-center gap-2">
                                                    <AlertTriangle className="w-5 h-5" />
                                                    <span>{t('resetAppDataButton')}</span>
                                                </h3>
                                                <p className="text-xs text-slate-500 font-medium">
                                                    {t('resetAppDataPrompt')}
                                                </p>
                                                <button 
                                                    onClick={() => {
                                                        if (confirm(t('resetAppDataPrompt'))) {
                                                            if (confirm(t('resetAppDataConfirm'))) {
                                                                resetAllAppData();
                                                            }
                                                        }
                                                    }}
                                                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                                                >
                                                    {t('resetAppDataButton')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-7 pb-12 animate-fadeIn">
                                    <section className="relative overflow-hidden bg-card-bg border border-border-custom rounded-[2rem] p-6 sm:p-8 shadow-sm">
                                        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),_transparent_55%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_45%)] pointer-events-none" />
                                        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-[4.5rem] h-[4.5rem] rounded-[1.75rem] bg-gradient-to-br from-indigo-500/15 via-white to-emerald-500/10 border border-white/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shadow-sm">
                                                    <span className="text-2xl font-black">{profileDisplayName.slice(0, 1).toUpperCase()}</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-500">
                                                        {language === 'el' ? 'Το Kallathaki σου' : 'Your Kallathaki'}
                                                    </p>
                                                    <h2 className="text-2xl sm:text-3xl font-black text-slate-850 dark:text-slate-100">
                                                        {profileGreeting}, {profileDisplayName}
                                                    </h2>
                                                    <p className="text-sm text-slate-500">{profileGreetingSubline}</p>
                                                </div>
                                            </div>

                                            <div className="min-w-[220px] rounded-[1.75rem] border border-emerald-500/15 bg-white/70 dark:bg-slate-900/40 backdrop-blur p-4 shadow-sm">
                                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                                                    {language === 'el' ? 'Εξοικονόμηση αυτής της εβδομάδας' : 'This Week\'s Savings'}
                                                </p>
                                                <div className="mt-2 text-3xl font-black text-slate-850 dark:text-slate-100">
                                                    {currencyFormatter.format(savingsSnapshot.week)}
                                                </div>
                                                <p className="mt-2 text-xs text-slate-500">
                                                    {language === 'el' ? 'Ωραία δουλειά. Το καλάθι σου γίνεται όλο και πιο έξυπνο.' : 'Nice work. Your basket is getting smarter every week.'}
                                                </p>
                                            </div>
                                        </div>
                                    </section>

                                    <section className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                                                {language === 'el' ? 'Γρήγορα Στατιστικά' : 'Quick Stats'}
                                            </h3>
                                            <span className="text-xs text-slate-400">
                                                {language === 'el' ? 'Μια ματιά πριν ξεκινήσεις' : 'A quick glance before you shop'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                                            {[
                                                {
                                                    label: language === 'el' ? 'Αυτή την εβδομάδα' : 'This Week',
                                                    value: currencyFormatter.format(savingsSnapshot.week),
                                                    helper: language === 'el' ? 'σε εξοικονόμηση' : 'saved'
                                                },
                                                {
                                                    label: language === 'el' ? 'Αυτόν τον μήνα' : 'This Month',
                                                    value: currencyFormatter.format(savingsSnapshot.month),
                                                    helper: language === 'el' ? 'σε εξοικονόμηση' : 'saved'
                                                },
                                                {
                                                    label: language === 'el' ? 'Βελτιστοποιημένα καλάθια' : 'Baskets Optimized',
                                                    value: `${deferredShoppingHistory.length}`,
                                                    helper: language === 'el' ? 'διαδρομές ολοκληρώθηκαν' : 'shopping trips completed'
                                                },
                                                {
                                                    label: language === 'el' ? 'Αγαπημένο κατάστημα' : 'Favorite Store',
                                                    value: favoriteStoreSummary,
                                                    helper: language === 'el' ? 'με βάση το ιστορικό σου' : 'based on your history'
                                                }
                                            ].map((item) => (
                                                <div key={item.label} className="bg-card-bg border border-border-custom rounded-[1.6rem] p-4 shadow-sm">
                                                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
                                                    <div className="mt-3 text-xl font-black text-slate-850 dark:text-slate-100">{item.value}</div>
                                                    <div className="mt-1 text-xs text-slate-500">{item.helper}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="bg-card-bg border border-border-custom rounded-[1.8rem] p-5 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-850 dark:text-slate-100">
                                                    {language === 'el' ? 'Οι Αγορές Μου' : 'My Shopping'}
                                                </h3>
                                                <p className="text-sm text-slate-500">
                                                    {language === 'el' ? 'Το προσωπικό σου shopping memory για να συνεχίζεις γρήγορα.' : 'Your shopping memory so you can jump back in fast.'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                            {[
                                                {
                                                    title: language === 'el' ? 'Εβδομαδιαίο καλάθι' : 'Weekly Basket',
                                                    value: `${deferredActiveBasketProducts.length}`,
                                                    helper: language === 'el' ? 'προϊόντα έτοιμα για βελτιστοποίηση' : 'items ready to optimize',
                                                    icon: <ShoppingBasket className="w-5 h-5" />,
                                                    onClick: () => {
                                                        startTransition(() => {
                                                            setActiveTab('favorites');
                                                            setFavoritesSubTab('basket');
                                                        });
                                                    }
                                                },
                                                {
                                                    title: language === 'el' ? 'Αποθηκευμένα καλάθια' : 'Saved Baskets',
                                                    value: `${deferredSavedBaskets.length}`,
                                                    helper: latestSavedBasket
                                                        ? `${latestSavedBasket.name}`
                                                        : (language === 'el' ? 'Αποθήκευσε το πρώτο σου καλάθι.' : 'Save your first basket.'),
                                                    icon: <RefreshCw className="w-5 h-5" />,
                                                    onClick: () => openProfileView('savedBaskets')
                                                },
                                                {
                                                    title: language === 'el' ? 'Ιστορικό αγορών' : 'Shopping History',
                                                    value: `${deferredShoppingHistory.length}`,
                                                    helper: recentHistoryEntry
                                                        ? `${language === 'el' ? 'Τελευταία εξοικονόμηση' : 'Last saved'} ${currencyFormatter.format(recentHistoryEntry.savings)}`
                                                        : (language === 'el' ? 'Το ιστορικό σου θα εμφανιστεί εδώ.' : 'Your shopping history will appear here.'),
                                                    icon: <Clock3 className="w-5 h-5" />,
                                                    onClick: () => openProfileView('history')
                                                },
                                                {
                                                    title: language === 'el' ? 'Αγαπημένα προϊόντα' : 'Favorite Products',
                                                    value: `${deferredFavorites.length}`,
                                                    helper: language === 'el' ? 'προϊόντα που κρατάς κοντά σου' : 'products you keep close',
                                                    icon: <Heart className="w-5 h-5" />,
                                                    onClick: () => {
                                                        startTransition(() => {
                                                            setActiveTab('favorites');
                                                            setFavoritesSubTab('pantry');
                                                        });
                                                    }
                                                },
                                                {
                                                    title: language === 'el' ? 'Αγαπημένα σούπερ μάρκετ' : 'Favorite Supermarkets',
                                                    value: `${favoriteRetailers.length}`,
                                                    helper: favoriteRetailers.length === 0
                                                        ? (language === 'el' ? 'Επίλεξε αλυσίδες για προσωποποίηση.' : 'Choose stores to personalize results.')
                                                        : favoriteRetailers.map((retailerId) => RETAILER_META[retailerId]?.name || retailerId).slice(0, 2).join(', '),
                                                    icon: <Store className="w-5 h-5" />,
                                                    onClick: () => openProfileView('supermarkets')
                                                },
                                                {
                                                    title: language === 'el' ? 'Πρόσφατες αναζητήσεις' : 'Recent Searches',
                                                    value: `${deferredRecentSearches.length}`,
                                                    helper: deferredRecentSearches[0] || (language === 'el' ? 'Οι αναζητήσεις σου θα εμφανιστούν εδώ.' : 'Your searches will appear here.'),
                                                    icon: <Search className="w-5 h-5" />,
                                                    onClick: handleContinueShopping
                                                }
                                            ].map((item) => (
                                                <button
                                                    key={item.title}
                                                    onClick={item.onClick}
                                                    className="text-left bg-background/70 border border-border-custom rounded-[1.4rem] p-4 hover:border-indigo-500/30 hover:bg-indigo-500/[0.03] transition cursor-pointer"
                                                >
                                                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-3">
                                                        {item.icon}
                                                    </div>
                                                    <div className="text-sm font-black text-slate-850 dark:text-slate-100">{item.title}</div>
                                                    <div className="mt-2 text-2xl font-black text-slate-850 dark:text-slate-100">{item.value}</div>
                                                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.helper}</p>
                                                </button>
                                            ))}
                                        </div>
                                        {deferredRecentSearches.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {deferredRecentSearches.map((query) => (
                                                    <button
                                                        key={query}
                                                        onClick={() => handleRecentSearchClick(query)}
                                                        className="px-3 py-2 rounded-full bg-input-custom border border-border-custom text-xs font-bold text-slate-650 dark:text-slate-300 hover:border-indigo-500/30 hover:text-indigo-500 transition cursor-pointer"
                                                    >
                                                        {query}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    <section className="bg-card-bg border border-border-custom rounded-[1.8rem] p-5 shadow-sm space-y-4">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-850 dark:text-slate-100">
                                                {language === 'el' ? 'Έξυπνες Συντομεύσεις' : 'Smart Shortcuts'}
                                            </h3>
                                            <p className="text-sm text-slate-500">
                                                {language === 'el' ? 'Οι πιο χρήσιμες κινήσεις σου, μπροστά σου.' : 'The actions you use most, right where you need them.'}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                                            {[
                                                {
                                                    title: language === 'el' ? 'Συνέχισε τα ψώνια' : 'Continue Shopping',
                                                    text: language === 'el' ? 'Γύρνα άμεσα στην αναζήτηση προϊόντων.' : 'Jump straight back to product search.',
                                                    icon: <ShoppingBag className="w-5 h-5" />,
                                                    onClick: handleContinueShopping
                                                },
                                                {
                                                    title: language === 'el' ? 'Βελτιστοποίησε το τελευταίο καλάθι' : 'Optimize Last Basket',
                                                    text: language === 'el' ? 'Άνοιξε το ενεργό καλάθι και δες το καλύτερο πλάνο.' : 'Open your active basket and see the best plan.',
                                                    icon: <Trophy className="w-5 h-5" />,
                                                    onClick: handleOptimizeBasketShortcut
                                                },
                                                {
                                                    title: language === 'el' ? 'Επανάλαβε το εβδομαδιαίο καλάθι' : 'Repeat Weekly Basket',
                                                    text: language === 'el' ? 'Φόρτωσε ξανά το πιο πρόσφατο αποθηκευμένο καλάθι.' : 'Load your latest saved basket again.',
                                                    icon: <RefreshCw className="w-5 h-5" />,
                                                    onClick: handleRepeatWeeklyBasket
                                                },
                                                {
                                                    title: language === 'el' ? 'Δες προσφορές' : 'Browse Offers',
                                                    text: language === 'el' ? 'Μπες κατευθείαν στις καλύτερες προσφορές.' : 'Go straight to the best offers.',
                                                    icon: <Percent className="w-5 h-5" />,
                                                    onClick: () => startTransition(() => setActiveTab('offers'))
                                                },
                                                {
                                                    title: language === 'el' ? 'Νέο καλάθι' : 'Create New Basket',
                                                    text: language === 'el' ? 'Καθάρισε την πορεία και ξεκίνα νέο κύκλο αγορών.' : 'Reset the flow and start a new shopping run.',
                                                    icon: <Sparkles className="w-5 h-5" />,
                                                    onClick: resetFilters
                                                }
                                            ].map((shortcut) => (
                                                <button
                                                    key={shortcut.title}
                                                    onClick={shortcut.onClick}
                                                    className="text-left bg-background/70 border border-border-custom rounded-[1.4rem] p-4 hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] transition cursor-pointer"
                                                >
                                                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
                                                        {shortcut.icon}
                                                    </div>
                                                    <div className="text-sm font-black text-slate-850 dark:text-slate-100">{shortcut.title}</div>
                                                    <p className="mt-2 text-xs text-slate-500">{shortcut.text}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
                                        <div className="bg-card-bg border border-border-custom rounded-[1.8rem] p-5 shadow-sm space-y-4">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-850 dark:text-slate-100">
                                                    {language === 'el' ? 'Εξοικονόμηση' : 'Savings'}
                                                </h3>
                                                <p className="text-sm text-slate-500">
                                                    {language === 'el' ? 'Κράτα επαφή με το πόσα κερδίζεις σε κάθε χρονικό ορίζοντα.' : 'Stay close to what you are saving across every timeframe.'}
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                {[
                                                    { label: language === 'el' ? 'Σήμερα' : 'Today', value: savingsSnapshot.today },
                                                    { label: language === 'el' ? 'Αυτή την εβδομάδα' : 'This Week', value: savingsSnapshot.week },
                                                    { label: language === 'el' ? 'Αυτόν τον μήνα' : 'This Month', value: savingsSnapshot.month },
                                                    { label: language === 'el' ? 'Φέτος' : 'This Year', value: savingsSnapshot.year },
                                                    { label: language === 'el' ? 'Συνολικά' : 'Lifetime', value: savingsSnapshot.lifetime }
                                                ].map((item) => (
                                                    <div key={item.label} className="rounded-[1.3rem] bg-background/70 border border-border-custom p-4">
                                                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
                                                        <div className="mt-3 text-lg font-black text-emerald-600 dark:text-emerald-400">{currencyFormatter.format(item.value)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="rounded-[1.4rem] border border-emerald-500/15 bg-emerald-500/[0.05] p-4">
                                                <div className="text-sm font-black text-slate-850 dark:text-slate-100">
                                                    {language === 'el' ? 'Κράτα το momentum.' : 'Keep the momentum going.'}
                                                </div>
                                                <p className="mt-2 text-sm text-slate-500">{motivationLine}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-5">
                                            <section className="bg-card-bg border border-border-custom rounded-[1.8rem] p-5 shadow-sm space-y-4">
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-850 dark:text-slate-100">
                                                        {language === 'el' ? 'Προτιμήσεις Αγορών' : 'Preferences'}
                                                    </h3>
                                                    <p className="text-sm text-slate-500">
                                                        {language === 'el' ? 'Μόνο ρυθμίσεις που αλλάζουν τον τρόπο που ψωνίζεις.' : 'Only settings that shape how you shop.'}
                                                    </p>
                                                </div>
                                                <div className="space-y-3">
                                                    <button
                                                        onClick={() => openProfileView('supermarkets')}
                                                        className="w-full flex items-center justify-between rounded-[1.3rem] border border-border-custom bg-background/70 px-4 py-3 text-left hover:border-indigo-500/30 transition cursor-pointer"
                                                    >
                                                        <div>
                                                            <div className="text-sm font-black text-slate-850 dark:text-slate-100">
                                                                {language === 'el' ? 'Προτιμώμενα σούπερ μάρκετ' : 'Preferred Supermarkets'}
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                {favoriteRetailers.length > 0
                                                                    ? favoriteRetailers.map((retailerId) => RETAILER_META[retailerId]?.name || retailerId).join(', ')
                                                                    : (language === 'el' ? 'Επίλεξε αλυσίδες για πιο προσωπικές προτάσεις.' : 'Choose stores for more personal recommendations.')}
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                                    </button>

                                                    <div className="rounded-[1.3rem] border border-border-custom bg-background/70 p-4 flex items-center justify-between gap-4">
                                                        <div>
                                                            <div className="text-sm font-black text-slate-850 dark:text-slate-100">
                                                                {language === 'el' ? 'Γλώσσα' : 'Preferred Language'}
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                {language === 'el' ? 'Ελληνικά' : 'English'}
                                                            </div>
                                                        </div>
                                                        <button onClick={toggleLanguage} className="px-3 py-2 rounded-xl bg-input-custom border border-border-custom text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                                                            {language === 'el' ? 'English' : 'Ελληνικά'}
                                                        </button>
                                                    </div>

                                                    <div className="rounded-[1.3rem] border border-border-custom bg-background/70 p-4 flex items-center justify-between gap-4">
                                                        <div>
                                                            <div className="text-sm font-black text-slate-850 dark:text-slate-100">
                                                                {language === 'el' ? 'Dark Mode' : 'Dark Mode'}
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                {theme === 'dark'
                                                                    ? (language === 'el' ? 'Άνετη προβολή για βραδινό planning.' : 'Comfortable viewing for evening planning.')
                                                                    : (language === 'el' ? 'Φωτεινή προβολή για γρήγορες συγκρίσεις.' : 'Bright view for fast comparisons.')}
                                                            </div>
                                                        </div>
                                                        <button onClick={toggleTheme} className="px-3 py-2 rounded-xl bg-input-custom border border-border-custom text-xs font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer">
                                                            {theme === 'dark' ? (language === 'el' ? 'Σκοτεινό' : 'Dark') : (language === 'el' ? 'Φωτεινό' : 'Light')}
                                                        </button>
                                                    </div>

                                                    <button
                                                        onClick={toggleNotifications}
                                                        className="w-full rounded-[1.3rem] border border-border-custom bg-background/70 p-4 flex items-center justify-between gap-4 text-left cursor-pointer"
                                                    >
                                                        <div>
                                                            <div className="text-sm font-black text-slate-850 dark:text-slate-100">
                                                                {language === 'el' ? 'Ειδοποιήσεις' : 'Notifications'}
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                {notificationsEnabled
                                                                    ? (language === 'el' ? 'Θα ειδοποιείσαι όταν έχει νόημα να επιστρέψεις.' : 'You will get a nudge when it is worth coming back.')
                                                                    : (language === 'el' ? 'Άφησέ το κλειστό αν προτιμάς ησυχία.' : 'Keep it off if you prefer a quieter experience.')}
                                                            </div>
                                                        </div>
                                                        <div className={`w-11 h-6 rounded-full transition ${notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                                            <div className={`w-5 h-5 mt-0.5 bg-white rounded-full transition ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                        </div>
                                                    </button>

                                                    <button
                                                        onClick={togglePriceAlerts}
                                                        className="w-full rounded-[1.3rem] border border-border-custom bg-background/70 p-4 flex items-center justify-between gap-4 text-left cursor-pointer"
                                                    >
                                                        <div>
                                                            <div className="text-sm font-black text-slate-850 dark:text-slate-100">
                                                                {language === 'el' ? 'Προτιμήσεις price alerts' : 'Price Alert Preferences'}
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                {priceAlertsEnabled
                                                                    ? (language === 'el' ? 'Θα δίνουμε προτεραιότητα σε προσφορές σχετικές με το καλάθι σου.' : 'We will prioritize offer nudges related to your basket.')
                                                                    : (language === 'el' ? 'Καμία πίεση, μόνο χειροκίνητος έλεγχος.' : 'No pressure, manual checking only.')}
                                                            </div>
                                                        </div>
                                                        <div className={`w-11 h-6 rounded-full transition ${priceAlertsEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                                            <div className={`w-5 h-5 mt-0.5 bg-white rounded-full transition ${priceAlertsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                        </div>
                                                    </button>

                                                    <button
                                                        onClick={() => openProfileView('settings')}
                                                        className="w-full flex items-center justify-between rounded-[1.3rem] border border-dashed border-border-custom bg-background/50 px-4 py-3 text-left hover:border-slate-400 transition cursor-pointer"
                                                    >
                                                        <div>
                                                            <div className="text-sm font-black text-slate-850 dark:text-slate-100">
                                                                {language === 'el' ? 'Advanced' : 'Advanced'}
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                {language === 'el' ? 'Reset δεδομένων και πιο τεχνικές επιλογές.' : 'Reset data and more technical controls.'}
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-slate-400" />
                                                    </button>
                                                </div>
                                            </section>

                                            <section className="bg-card-bg border border-border-custom rounded-[1.8rem] p-5 shadow-sm space-y-4">
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-850 dark:text-slate-100">
                                                        {language === 'el' ? 'Λογαριασμός' : 'Account'}
                                                    </h3>
                                                    <p className="text-sm text-slate-500">
                                                        {language === 'el' ? 'Χωρίς πίεση. Το Kallathaki δουλεύει και ως guest.' : 'No pressure. Kallathaki works fine in guest mode too.'}
                                                    </p>
                                                </div>
                                                <div className="rounded-[1.4rem] border border-indigo-500/15 bg-indigo-500/[0.05] p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                                                            <UserCircle className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-black text-slate-850 dark:text-slate-100">
                                                                {language === 'el' ? 'Guest mode ενεργό' : 'Guest mode active'}
                                                            </div>
                                                            <div className="text-xs text-slate-500 mt-1">
                                                                {language === 'el' ? 'Όταν προστεθεί account sync, θα μπορείς να σώσεις καλάθια, αγαπημένα και alerts σε όλες τις συσκευές.' : 'When account sync arrives, you will be able to keep baskets, favorites, and alerts across devices.'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {(language === 'el'
                                                            ? ['Αποθήκευση καλαθιών', 'Συγχρονισμός συσκευών', 'Price alerts', 'Μνήμη αγαπημένων']
                                                            : ['Save baskets', 'Sync devices', 'Price alerts', 'Remember favorites']
                                                        ).map((benefit) => (
                                                            <span key={benefit} className="px-3 py-2 rounded-full bg-white/70 dark:bg-slate-900/40 border border-border-custom text-xs font-bold text-slate-650 dark:text-slate-300">
                                                                {benefit}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                    </section>

                                    <section className="bg-card-bg border border-border-custom rounded-[1.8rem] p-5 shadow-sm space-y-4">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-850 dark:text-slate-100">
                                                {language === 'el' ? 'Βοήθεια' : 'Help'}
                                            </h3>
                                            <p className="text-sm text-slate-500">
                                                {language === 'el' ? 'Ό,τι χρειάζεσαι για να συνεχίσεις με σιγουριά.' : 'Everything you need to keep shopping with confidence.'}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <Link href="/guide" className="rounded-[1.3rem] border border-border-custom bg-background/70 p-4 hover:border-indigo-500/30 transition">
                                                <div className="text-sm font-black text-slate-850 dark:text-slate-100">
                                                    {language === 'el' ? 'Κέντρο βοήθειας' : 'Help Center'}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {language === 'el' ? 'Οδηγός για αναζήτηση, καλάθι και βελτιστοποίηση.' : 'Guide for search, basket, and optimization.'}
                                                </div>
                                            </Link>
                                            {[
                                                language === 'el' ? 'Επικοινωνία υποστήριξης' : 'Contact Support',
                                                language === 'el' ? 'Αναφορά λανθασμένης τιμής' : 'Report Incorrect Price',
                                                language === 'el' ? 'Πρότεινε feature' : 'Suggest Feature',
                                                language === 'el' ? 'Σχετικά με το Kallathaki' : 'About Kallathaki',
                                                language === 'el' ? 'Privacy Policy' : 'Privacy Policy',
                                                language === 'el' ? 'Terms' : 'Terms'
                                            ].map((label) => (
                                                <button
                                                    key={label}
                                                    onClick={() => handleHelpPlaceholder(label)}
                                                    className="rounded-[1.3rem] border border-border-custom bg-background/70 p-4 text-left hover:border-indigo-500/30 transition cursor-pointer"
                                                >
                                                    <div className="text-sm font-black text-slate-850 dark:text-slate-100">{label}</div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {language === 'el' ? 'Θα συνδεθεί με το κατάλληλο flow σε επόμενο βήμα.' : 'This will connect to the proper flow in a follow-up step.'}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            )
                        ) : (
                            // FAVORITES & BASKET OPTIMIZER VIEW
                            <FavoritesView
                                language={language}
                                favorites={favorites}
                                activeBasketIds={activeBasketIds}
                                favoritesSubTab={favoritesSubTab}
                                setFavoritesSubTab={setFavoritesSubTab}
                                toggleBasketItem={toggleBasketItem}
                                toggleFavorite={toggleFavorite}
                                clearAllFavorites={clearAllFavorites}
                                selectAllBasketItems={selectAllBasketItems}
                                deselectAllBasketItems={deselectAllBasketItems}
                                activeBasketProducts={activeBasketProducts}
                                singleStoreResults={singleStoreResults}
                                splitTripData={splitTripData}
                                activeFavRetailers={activeFavRetailers}
                                RETAILER_META={RETAILER_META}
                                setActiveMapRetailer={setActiveMapRetailer}
                                setIsShareOpen={setIsShareOpen}
                                setIsHelperOpen={setIsHelperOpen}
                                setHelperRetailer={setHelperRetailer}
                                showOptimizerResults={showOptimizerResults}
                                setShowOptimizerResults={setShowOptimizerResults}
                                basketOptimizer={basketOptimizer}
                                onRecordTrip={(option) => {
                                    recordTrip(option);
                                    setToastMessage(t('tripRecordedSuccess'));
                                }}
                            />
                        )}
                    </main>
                </div>

                {/* Details Drawer */}
                <div className={`
                    fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-sidebar-bg
                    transition-all duration-300 flex flex-col
                    ${isDetailOpen ? 'translate-x-0 border-l border-border-custom shadow-2xl' : 'translate-x-full border-l-transparent shadow-none pointer-events-none'}
                `}>
                    {selectedProduct && (
                        <>
                            <div className="p-6 border-b border-border-custom flex items-center justify-between">
                                <h3 className="text-base font-bold truncate max-w-[280px]">{selectedProduct.name}</h3>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={(e) => toggleFavorite(e, selectedProduct)}
                                        className={`p-2 rounded-xl transition cursor-pointer ${
                                            favorites.some(p => p.id === selectedProduct.id)
                                                ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                                                : 'hover:bg-input-custom text-slate-450 hover:text-slate-650 dark:hover:text-slate-250 border border-transparent'
                                        }`}
                                        title={favorites.some(p => p.id === selectedProduct.id) ? 'Αφαίρεση από τα Αγαπημένα' : 'Προσθήκη στα Αγαπημένα'}
                                    >
                                        <Heart className={`w-4.5 h-4.5 ${favorites.some(p => p.id === selectedProduct.id) ? 'fill-current' : ''}`} />
                                    </button>
                                    <button className="p-2 hover:bg-input-custom text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 rounded-xl transition cursor-pointer" onClick={() => setIsDetailOpen(false)}>
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="h-48 bg-input-custom rounded-2xl flex items-center justify-center p-4">
                                    <img src={selectedProduct.image_url} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-normal" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80' }} />
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-indigo-500 uppercase">{selectedProduct.brand}</span>
                                    <h4 className="text-lg font-bold mt-1">{selectedProduct.name}</h4>
                                    <p className="text-xs text-slate-400 mt-2 font-medium">Κατηγορία: {selectedProduct.category}</p>
                                </div>

                                <div className="space-y-3">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Τιμές ανά Κατάστημα</div>
                                    <div className="space-y-2">
                                        {selectedProduct.retailer_prices.map(rp => {
                                            const meta = RETAILER_META[rp.retailer] || { name: rp.retailer };
                                            return (
                                                <div key={rp.retailer} className="flex justify-between items-center p-3 bg-input-custom rounded-xl border border-transparent">
                                                    <div className="flex items-center gap-2">
                                                        <img className="w-6 h-6 rounded-full object-cover" src={retailerLogoUrl(rp.retailer)} alt="" />
                                                        <div>
                                                            <span className="text-xs font-bold block">{meta.name}</span>
                                                            {rp.last_updated && (
                                                                <span className="text-[10px] text-slate-450 font-semibold">Ενημέρωση {formatGreekDate(rp.last_updated)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {rp.is_discount && (
                                                            <span className="text-[9px] font-black text-white bg-emerald-500 px-1.5 py-0.5 rounded">{rp.discount_percentage ? `-${rp.discount_percentage}%` : 'Προσφορά'}</span>
                                                        )}
                                                        <strong className="text-xs font-extrabold text-slate-800 dark:text-slate-100">€{rp.price.toFixed(2)}</strong>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ιστορικό Τιμών (2 Μήνες)</div>
                                    <div className="h-44 bg-input-custom rounded-xl p-3 border border-border-custom">
                                        <canvas ref={chartRef}></canvas>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Share Drawer */}
                <div className={`
                    fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-sidebar-bg
                    transition-all duration-300 flex flex-col
                    ${isShareOpen ? 'translate-x-0 border-l border-border-custom shadow-2xl' : 'translate-x-full border-l-transparent shadow-none pointer-events-none'}
                `}>
                    <div className="p-6 border-b border-border-custom flex items-center justify-between">
                        <h3 className="text-base font-bold flex items-center gap-1.5"><Share2 className="w-5 h-5 text-emerald-500" /><span>{language === 'en' ? 'Share List' : 'Κοινοποίηση Λίστας'}</span></h3>
                        <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg" onClick={() => setIsShareOpen(false)} aria-label={language === 'en' ? 'Close sharing' : 'Κλείσιμο κοινής χρήσης'}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <p className="text-xs text-slate-400">{language === 'en' ? 'Choose how you want to share your shopping list.' : 'Επιλέξτε πώς θέλετε να μοιραστείτε τη λίστα αγορών σας με την οικογένειά σας:'}</p>

                        <div className="space-y-3">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{language === 'en' ? 'Text for WhatsApp / Viber' : 'Κείμενο για WhatsApp / Viber (Λίστα Αγορών)'}</div>
                            <textarea 
                                readOnly 
                                value={shareMessageText}
                                aria-label={language === 'en' ? 'Shopping list text to copy' : 'Κείμενο λίστας αγορών για αντιγραφή'}
                                className="w-full h-56 p-3 text-xs bg-input-custom border border-border-custom rounded-xl outline-none resize-none font-sans leading-relaxed text-slate-700 dark:text-slate-200"
                            />
                            <button 
                                onClick={copyText}
                                className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition"
                            >
                                <Copy className="w-4 h-4" />
                                <span>{language === 'en' ? 'Copy List Text' : 'Αντιγραφή Λίστας (Κείμενο)'}</span>
                            </button>
                        </div>

                        <div className="border-t border-border-custom my-2"></div>

                        <div className="space-y-3">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{language === 'en' ? 'Web link for Kallathaki.gr' : 'Web Link (για εισαγωγή στο Kallathaki.gr)'}</div>
                            <input 
                                type="text"
                                readOnly
                                value={webShareLink}
                                aria-label={language === 'en' ? 'Shopping list link to copy' : 'Σύνδεσμος λίστας αγορών για αντιγραφή'}
                                className="w-full p-3 text-xs bg-input-custom border border-border-custom rounded-xl outline-none text-slate-750 dark:text-slate-250 truncate"
                            />
                            <button 
                                onClick={copyLink}
                                className="w-full py-2.5 bg-input-custom hover:bg-input-custom text-foreground text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-border-custom transition"
                            >
                                <LinkIcon className="w-4 h-4" />
                                <span>{language === 'en' ? 'Copy Web Link' : 'Αντιγραφή Συνδέσμου (Web Link)'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Map Drawer */}
                <div className={`
                    fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-sidebar-bg
                    transition-all duration-300 flex flex-col
                    ${activeMapRetailer ? 'translate-x-0 border-l border-border-custom shadow-2xl' : 'translate-x-full border-l-transparent shadow-none pointer-events-none'}
                `}>
                    <div className="p-6 border-b border-border-custom flex items-center justify-between">
                        <h3 className="text-base font-bold flex items-center gap-1.5">
                            <MapPin className="w-5 h-5 text-indigo-500" />
                            <span>{language === 'en' ? 'Store Location' : 'Τοποθεσία Καταστήματος'}</span>
                        </h3>
                        <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-slate-500" onClick={() => setActiveMapRetailer(null)} aria-label={language === 'en' ? 'Close map' : 'Κλείσιμο χάρτη'}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {activeMapRetailer && (
                        <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
                            <div>
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">{language === 'en' ? 'SUPERMARKET' : 'ΣΟΥΠΕΡ ΜΑΡΚΕΤ'}</span>
                                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1">
                                    {RETAILER_META[activeMapRetailer]?.name || activeMapRetailer}
                                </h4>
                                <p className="text-xs text-slate-400 mt-1 font-medium">
                                    {userCoords 
                                        ? (language === 'en' ? 'Showing the nearest store based on your location.' : 'Εμφάνιση του πλησιέστερου καταστήματος με βάση τις συντεταγμένες σας.')
                                        : (language === 'en' ? 'Showing store locations. Allow location access to find the nearest one automatically.' : 'Εμφάνιση καταστημάτων. Επιτρέψτε την τοποθεσία στο πρόγραμμα περιήγησης για αυτόματη εύρεση του πλησιέστερου.')}
                                </p>
                            </div>

                            <div className="flex-1 w-full rounded-2xl overflow-hidden border border-border-custom bg-input-custom min-h-[320px] relative">
                                <iframe 
                                    title="Google Maps Store Locator"
                                    width="100%" 
                                    height="100%" 
                                    style={{ border: 0 }}
                                    loading="lazy" 
                                    allowFullScreen 
                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(
                                        userCoords 
                                            ? `${RETAILER_SEARCH_NAMES[activeMapRetailer]} near ${userCoords.lat},${userCoords.lng}`
                                            : RETAILER_SEARCH_NAMES[activeMapRetailer]
                                    )}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                                ></iframe>
                            </div>

                            <a 
                                href={userCoords
                                    ? `https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${encodeURIComponent(RETAILER_SEARCH_NAMES[activeMapRetailer])}`
                                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(RETAILER_SEARCH_NAMES[activeMapRetailer])}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition duration-300"
                            >
                                <MapPin className="w-4 h-4" />
                                <span>{language === 'en' ? 'Open Directions in Google Maps' : 'Έναρξη Πλοήγησης (Google Maps)'}</span>
                            </a>
                        </div>
                    )}
                </div>

                {isCategoryBrowserOpen && (
                    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6" onClick={() => setIsCategoryBrowserOpen(false)}>
                        <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] bg-panel-bg border border-border-custom rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <div className="p-4 sm:p-5 border-b border-border-custom flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-black text-slate-850 dark:text-slate-100">{t('categories')}</h2>
                                    <p className="text-xs text-slate-500 mt-1">{t('categoryBrowserText')}</p>
                                </div>
                                <button
                                    onClick={() => setIsCategoryBrowserOpen(false)}
                                    className="p-2 rounded-xl hover:bg-input-custom text-slate-500 transition shrink-0"
                                    aria-label={t('closeCategories')}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 sm:p-5 border-b border-border-custom">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={categoryBrowserQuery}
                                        onChange={(e) => setCategoryBrowserQuery(e.target.value)}
                                        placeholder={t('categorySearchPlaceholder')}
                                        aria-label={t('categorySearchPlaceholder')}
                                        className="w-full pl-10 pr-10 py-3 text-sm bg-input-custom border border-transparent focus:border-indigo-500 focus:bg-background rounded-xl outline-none transition text-foreground"
                                        autoFocus
                                    />
                                    {categoryBrowserQuery && (
                                        <button
                                            onClick={() => setCategoryBrowserQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                                            aria-label={t('clearSearch')}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                                {loadingCategories ? (
                                    <div className="h-40 flex items-center justify-center text-sm text-slate-500">
                                        <RefreshCw className="w-4 h-4 animate-spin mr-2 text-amber-500" />
                                        {t('loadingCategories')}
                                    </div>
                                ) : visibleCategoryGroups.length === 0 ? (
                                    <div className="h-40 flex flex-col items-center justify-center text-center">
                                        <Search className="w-8 h-8 text-slate-400 mb-2" />
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('noCategories')}</p>
                                        <p className="text-xs text-slate-500 mt-1">{t('tryGeneralTerm')}</p>
                                    </div>
                                ) : (
                                    visibleCategoryGroups.map((cat) => {
                                        const isActive = selectedCategoryId === cat.category_id;
                                        const children = cat.children || [];

                                        return (
                                            <div key={cat.category_id} className="rounded-2xl border border-border-custom bg-card-bg overflow-hidden">
                                                <button
                                                    onClick={() => handleCategoryClick(cat.category_id)}
                                                    className={`w-full p-4 flex items-center gap-4 text-left transition ${isActive ? 'bg-indigo-500/10' : 'hover:bg-input-custom'}`}
                                                >
                                                    <div className="w-12 h-12 rounded-xl bg-input-custom border border-border-custom overflow-hidden flex items-center justify-center shrink-0">
                                                        {cat.image_url ? (
                                                            <img src={cat.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                                        ) : (
                                                            <ShoppingBag className="w-5 h-5 text-slate-400" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-black text-slate-850 dark:text-slate-100 truncate">{categoryName(cat)}</div>
                                                        <div className="text-[11px] text-slate-500 font-bold mt-1">
                                                            {cat.total_product_count ? `${cat.total_product_count.toLocaleString('el-GR')} ${t('productCount')}` : t('viewProducts')}
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                                </button>

                                                {children.length > 0 && (
                                                    <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {children.slice(0, categoryBrowserQuery ? 12 : 8).map((sub) => {
                                                            const isSubActive = selectedSubcategoryId === sub.category_id;

                                                            return (
                                                                <button
                                                                    key={sub.category_id}
                                                                    onClick={(e) => selectSubcategory(e, cat.category_id, sub.category_id)}
                                                                    className={`min-h-11 px-3 py-2 rounded-xl text-left text-xs font-bold transition flex items-center justify-between gap-3 ${
                                                                        isSubActive
                                                                            ? 'bg-indigo-500 text-white'
                                                                            : 'bg-input-custom hover:bg-indigo-500/10 text-slate-650 dark:text-slate-300'
                                                                    }`}
                                                                >
                                                                    <span className="truncate">{categoryName(sub)}</span>
                                                                    <span className="shrink-0 opacity-75">{sub.total_product_count || 0}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Mobile Bottom Navigation Bar */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 z-35 bg-sidebar-bg/95 backdrop-blur border-t border-border-custom px-2 pt-2 pb-[calc(0.6rem+env(safe-area-inset-bottom))] grid grid-cols-5 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
                    <button 
                        onClick={() => {
                            setActiveTab('products');
                            resetFilters();
                        }}
                        className={`min-h-14 flex flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95 ${
                            activeTab === 'products' ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 font-bold' : 'text-slate-650 dark:text-slate-400 hover:text-foreground'
                        }`}
                    >
                        <Search className="w-5 h-5" />
                        <span className="text-[10px]">{t('searchNav')}</span>
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTab('favorites');
                            setFavoritesSubTab('basket');
                            setShowOptimizerResults(false);
                        }}
                        className={`min-h-14 flex flex-col items-center justify-center gap-1 rounded-2xl transition relative active:scale-95 ${
                            activeTab === 'favorites' && favoritesSubTab === 'basket' && !showOptimizerResults ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 font-bold' : 'text-slate-650 dark:text-slate-400 hover:text-foreground'
                        }`}
                    >
                        <ShoppingBasket className="w-5 h-5" />
                        <span className="text-[10px]">{t('basketNav')}</span>
                        {activeBasketIds.length > 0 && (
                            <span className="absolute top-1 right-2 bg-emerald-500 text-white text-[10px] font-black rounded-full min-w-5 h-5 px-1 flex items-center justify-center shadow-md ring-2 ring-sidebar-bg">
                                {activeBasketIds.length}
                            </span>
                        )}
                    </button>
                    <button 
                        onClick={() => {
                            setActiveTab('favorites');
                            setFavoritesSubTab('basket');
                            setShowOptimizerResults(true);
                        }}
                        className="min-h-16 -mt-5 flex flex-col items-center justify-center gap-1 rounded-3xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 transition active:scale-95 font-black"
                    >
                        <Trophy className="w-5 h-5 fill-white" />
                        <span className="text-[10px]">{t('optimizeNav')}</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('offers')}
                        className={`min-h-14 flex flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95 ${
                            activeTab === 'offers' ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 font-bold' : 'text-slate-650 dark:text-slate-400 hover:text-foreground'
                        }`}
                    >
                        <Percent className="w-5 h-5" />
                        <span className="text-[10px]">{t('offersNav')}</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('profile')}
                        className={`min-h-14 flex flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95 ${
                            activeTab === 'profile' ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 font-bold' : 'text-slate-650 dark:text-slate-400 hover:text-foreground'
                        }`}
                    >
                        <UserCircle className="w-5 h-5" />
                        <span className="text-[10px]">{t('profileNav')}</span>
                    </button>
                </nav>

                {/* Floating Toast Notification */}
                {toastMessage && (
                    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-850/95 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-white/10 animate-fadeIn backdrop-blur">
                        <Check className="w-4.5 h-4.5 text-emerald-400" />
                        <span>{toastMessage}</span>
                    </div>
                )}

                {/* Barcode Scanner Modal */}
                {isScannerOpen && (
                    <BarcodeScannerModal 
                        isOpen={isScannerOpen} 
                        onClose={() => setIsScannerOpen(false)} 
                        onScanSuccess={handleBarcodeScanSuccess} 
                    />
                )}

                {/* e-Shop Order Helper Modal */}
                {isHelperOpen && (
                    <EShopHelperModal 
                        isOpen={isHelperOpen} 
                        onClose={() => setIsHelperOpen(false)} 
                        products={activeBasketProducts} 
                        retailer={helperRetailer} 
                    />
                )}

            </div>
        </div>
    );
}
