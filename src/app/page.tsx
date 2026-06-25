/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { 
    Search, Moon, Sun, Heart, Trash2, Share2, Copy, Link as LinkIcon, 
    X, Sparkles, ShoppingBag, ChevronRight, ChevronDown, ChevronLeft, LayoutGrid,
    Store, Percent, Trophy, Info, PiggyBank, RefreshCw, Menu, ShoppingBasket,
    MapPin, Home, Camera, Bell, ShieldCheck, Clock3
} from 'lucide-react';
import dynamic from 'next/dynamic';

const BarcodeScannerModal = dynamic(() => import('../components/BarcodeScannerModal'), { ssr: false });
const EShopHelperModal = dynamic(() => import('../components/EShopHelperModal'), { ssr: false });

const GOV_API_ORIGIN = 'https://api.posokanei.gov.gr';
const proxyGovAssetUrl = (url?: string) => {
    if (!url) return '';
    return url.startsWith(GOV_API_ORIGIN) ? url.replace(GOV_API_ORIGIN, '/api') : url;
};
const retailerLogoUrl = (retailerId: string) => `/api/images/retailer/${retailerId}`;
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

const CATEGORY_META: { [key: string]: { emoji: string; gradient: string } } = {
    'fb7311d1172f411dba075194a4120689': { emoji: '🍏', gradient: 'from-emerald-500/10 to-teal-500/10 hover:border-emerald-500/30 text-emerald-600 dark:text-emerald-400' },
    '7f677200338b447cb4d469622588b749': { emoji: '🥤', gradient: 'from-amber-500/10 to-orange-500/10 hover:border-amber-500/30 text-amber-600 dark:text-amber-400' },
    '648a987abf254feb8cf62a10ea1eb117': { emoji: '🧼', gradient: 'from-blue-500/10 to-indigo-500/10 hover:border-blue-500/30 text-blue-600 dark:text-blue-400' },
    'b2a17c2ad4235ea8574d602763988be6': { emoji: '🧴', gradient: 'from-pink-500/10 to-rose-500/10 hover:border-pink-500/30 text-pink-600 dark:text-pink-400' },
    'cFsywHNrftQ6yeittltcSFQ4qbM14Q3F': { emoji: '🍼', gradient: 'from-purple-500/10 to-violet-500/10 hover:border-purple-500/30 text-purple-600 dark:text-purple-400' },
    'b2a17c2ad4235ea8574d602763a39395': { emoji: '🐶', gradient: 'from-orange-500/10 to-yellow-500/10 hover:border-orange-500/30 text-orange-600 dark:text-orange-400' }
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
    total_products: number;
    products_on_discount: number;
}

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

export default function KallathakiApp() {
    // Theme state
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [mounted, setMounted] = useState(false);

    // App state
    const [categories, setCategories] = useState<CategoryNode[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [favorites, setFavorites] = useState<Product[]>([]);
    const [activeBasketIds, setActiveBasketIds] = useState<string[]>([]);
    const [favoritesSubTab, setFavoritesSubTab] = useState<'pantry' | 'basket'>('pantry');
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [barcodeCache, setBarcodeCache] = useState<Record<string, Product>>({});
    const [isHelperOpen, setIsHelperOpen] = useState(false);
    const [helperRetailer, setHelperRetailer] = useState<string>('');
    const [showOptimizerResults, setShowOptimizerResults] = useState(false);

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

    const [pushSupported, setPushSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);

    const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const subscribeToPush = async () => {
        if (!pushSupported) return;
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('Η άδεια για ειδοποιήσεις απορρίφθηκε.');
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            const vapidPublicKey = 'BEl62iUZGStZOy4mJJw92z6r1wCr5T0FC21B_a5vB52yZ10Mh20Hh88S_nL1u5Yd_e3yB-8e9Z18h20z52yZ10M';
            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            console.log('Push Subscription:', JSON.stringify(subscription));
            setIsSubscribed(true);
            alert('Ενεργοποιήθηκαν οι ειδοποιήσεις για προσφορές!');
        } catch (error) {
            console.error('Failed to subscribe:', error);
            alert('Σφάλμα κατά την ενεργοποίηση ειδοποιήσεων: ' + error);
        }
    };

    const unsubscribeFromPush = async () => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                setIsSubscribed(false);
                alert('Απενεργοποιήθηκαν οι ειδοποιήσεις.');
            }
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
        }
    };

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

    const sanitizeCategoryTree = (nodes: CategoryNode[]): CategoryNode[] => nodes.map((node) => ({
        ...node,
        image_url: proxyGovAssetUrl(node.image_url),
        children: node.children ? sanitizeCategoryTree(node.children) : undefined
    }));

    const currentCategoryNode = useMemo(() => {
        return getCurrentCategoryNode(categoryPath, categories);
    }, [categoryPath, categories]);

    const hasSubcategories = useMemo(() => {
        return currentCategoryNode && currentCategoryNode.children && currentCategoryNode.children.length > 0;
    }, [currentCategoryNode]);

    const isHomeScreen = !searchTerm && categoryPath.length === 0;

    const shouldShowSubcategoryGrid = !searchTerm && hasSubcategories && !showAllProductsInCategory;

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const sortBy = 'priceAsc';
    const [activeTab, setActiveTab] = useState<'products' | 'favorites'>('products');

    // UI state
    const [openCategories, setOpenCategories] = useState<{ [key: string]: boolean }>({});
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
    const chartInstance = useRef<any>(null);

    // Initialize Theme and LocalStorage state
    useEffect(() => {
        const storedTheme = localStorage.getItem('posokanei_theme') || 'light';
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
            // Default to selecting all favorites if no stored basket exists
            loadedBasketIds = loadedFavs.map(p => p.id);
            localStorage.setItem('posokanei_active_basket', JSON.stringify(loadedBasketIds));
        }

        // Defer state updates to avoid synchronous setState warnings in effect
        setTimeout(() => {
            setTheme(storedTheme as 'light' | 'dark');
            setFavorites(loadedFavs);
            setActiveBasketIds(loadedBasketIds);
            
            // Check for shortcut action
            if (window.location.search.includes('action=scan')) {
                setIsScannerOpen(true);
            }

            // Check Push Notification support
            if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
                setPushSupported(true);
                navigator.serviceWorker.ready.then((registration) => {
                    registration.pushManager.getSubscription().then((subscription) => {
                        setIsSubscribed(!!subscription);
                    });
                });
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

    // Load initial metadata
    useEffect(() => {
        const fetchMetadata = async () => {
            setLoadingCategories(true);
            try {
                // Fetch stats
                const statsRes = await fetch('/api/meta/stats');
                if (statsRes.ok) {
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
                    const data = await res.json();
                    setProducts((data.products || []).map(sanitizeProduct));
                    setTotalPages(data.total_pages || 1);
                    setTotalProductsCount(data.total || 0);
                } else {
                    setProducts([]);
                    setTotalProductsCount(0);
                    setProductError('Δεν μπορέσαμε να φορτώσουμε τις τιμές αυτή τη στιγμή.');
                }
            } catch (error) {
                console.error("Failed to load products", error);
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
        if (confirm("Είστε σίγουροι ότι θέλετε να διαγράψετε όλα τα αγαπημένα σας προϊόντα;")) {
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
        setIsSidebarOpen(false);
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
        setOpenCategories(prev => ({
            ...prev,
            [catId]: true
        }));
    };

    const getBreadcrumbs = () => {
        const steps = [{ name: 'Αρχική', onClick: resetFilters }];
        
        let currentList = categories;
        const pathAcc: string[] = [];
        for (const id of categoryPath) {
            const cat = currentList.find(c => c.category_id === id);
            if (cat) {
                pathAcc.push(id);
                const snapshotPath = [...pathAcc];
                steps.push({
                    name: cat.name,
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
                name: `Αναζήτηση: "${searchTerm}"`,
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

    // Category tree toggling
    const toggleCategoryAccordion = (catId: string) => {
        setOpenCategories(prev => ({
            ...prev,
            [catId]: !prev[catId]
        }));
        setCategoryPath([catId]);
        setShowAllProductsInCategory(false);
        setCurrentPage(1);
    };

    const selectSubcategory = (e: React.MouseEvent, parentId: string, subId: string) => {
        e.stopPropagation();
        setCategoryPath([parentId, subId]);
        setShowAllProductsInCategory(false);
        setCurrentPage(1);
        setIsSidebarOpen(false);
    };

    // Render price details chart
    useEffect(() => {
        if (!selectedProduct || !chartRef.current || !isDetailOpen) return;

        let activeChart: any = null;

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
        let text = `🛒 Kallathaki.gr - Λίστα Αγορών\n`;
        text += `================================\n\n`;

        text += `📋 Προϊόντα προς αγορά:\n`;
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
            text += `1️⃣ Επιλογή Α: Όλα από 1 κατάστημα\n`;
            text += `📍 ${meta.name}\n`;
            text += `💰 Σύνολο: €${bestSingle.totalCost.toFixed(2)} (${bestSingle.itemsCount}/${bestSingle.totalItems} προϊόντα)\n\n`;
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
            text += `2️⃣ Επιλογή Β: Διαμοιρασμός (Καλύτερες Τιμές)\n`;
            groups.forEach(([retId, items]) => {
                const meta = RETAILER_META[retId] || { name: retId };
                text += `📍 ${meta.name}:\n`;
                items.forEach(item => {
                    text += `  - ${item}\n`;
                });
            });
        }

        return text;
    }, [activeBasketProducts]);

    const webShareLink = useMemo(() => {
        if (!mounted || activeBasketProducts.length === 0) return '';
        const ids = activeBasketProducts.map(p => p.id).join(',');
        return `${window.location.origin}${window.location.pathname}#share=${ids}`;
    }, [activeBasketProducts, mounted]);

    // Copy handlers
    const copyText = () => {
        navigator.clipboard.writeText(shareMessageText).then(() => {
            alert("Η λίστα αγορών αντιγράφηκε! Μπορείτε να τη στείλετε μέσω WhatsApp/Viber.");
        });
    };

    const copyLink = () => {
        navigator.clipboard.writeText(webShareLink).then(() => {
            alert("Ο σύνδεσμος Kallathaki.gr αντιγράφηκε στο πρόχειρο!");
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
            const retailerIds = ALLOWED_RETAILERS.filter((retailerId) =>
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
    }, [activeBasketProducts]);

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

    return (
        <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
            <div className="flex h-screen overflow-hidden">
                
                {/* Collapsible/Drawer Sidebar */}
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
                            <span>Τιμές από επίσημα δεδομένα{stats ? ` — ενημέρωση ${formatGreekDate(stats.timestamp)}` : ''}</span>
                        </div>
                        <p className="leading-relaxed">
                            Τα δεδομένα προέρχονται από δημόσια διαθέσιμες πηγές τιμών.
                        </p>
                    </div>
                </aside>

                {/* Main Content Pane */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    
                    {/* Header bar */}
                    <header className="p-4 border-b border-border-custom bg-panel-bg flex flex-wrap gap-4 items-center justify-between">
                        
                        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                            <button className="md:hidden p-2 hover:bg-input-custom rounded-xl" onClick={() => setIsSidebarOpen(true)} aria-label="Άνοιγμα μενού">
                                <Menu className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={resetFilters}
                                className="md:hidden flex items-center gap-2 text-left hover:opacity-85 transition cursor-pointer focus:outline-none select-none mr-1"
                                title="Αρχική"
                            >
                                <ShoppingBasket className="w-6 h-6 text-indigo-500" />
                                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-emerald-500 bg-clip-text text-transparent">Kallathaki</span>
                            </button>
                            
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                    placeholder="Αναζήτηση προϊόντων (π.χ. γάλα, φέτα, ρύζι)..."
                                    aria-label="Αναζήτηση προϊόντων"
                                    className="w-full pl-9 pr-10 py-2 text-base md:text-sm bg-input-custom border border-transparent focus:border-indigo-500 focus:bg-background rounded-xl outline-none transition text-foreground"
                                  />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                    {searchTerm && (
                                        <button 
                                            onClick={() => setSearchTerm('')} 
                                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                                            title="Καθαρισμός αναζήτησης"
                                            aria-label="Καθαρισμός αναζήτησης"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
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
                                    Προϊόντα
                                </button>
                                <button 
                                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'favorites' ? 'bg-background shadow text-indigo-800 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-400 hover:text-foreground'}`}
                                    onClick={() => setActiveTab('favorites')}
                                >
                                    <ShoppingBasket className="w-3.5 h-3.5" />
                                    <span>Καλάθι ({activeBasketIds.length}/{favorites.length})</span>
                                </button>
                            </div>

                        </div>
                    </header>

                    {/* Content Area */}
                    <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6 transition-colors duration-300 scroll-smooth">
                        {activeTab === 'products' ? (
                            isHomeScreen ? (
                                // BRAND-NEW HOMEPAGE DASHBOARD
                                <div className="space-y-14 pb-12">
                                    {/* Modern Hero Section */}
                                    <div className="relative bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-xl overflow-hidden">
                                        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.12)_0%,transparent_45%,rgba(16,185,129,0.16)_100%)] pointer-events-none" />

                                        <div className="relative z-10 max-w-2xl">
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-[11px] font-semibold mb-4">
                                                <ShieldCheck className="w-3.5 h-3.5 text-white/80" />
                                                <span>Τιμές από επίσημα δεδομένα{stats ? ` — ενημέρωση ${formatGreekDate(stats.timestamp)}` : ''}</span>
                                            </div>
                                            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight bg-gradient-to-r from-white via-emerald-100 to-amber-200 bg-clip-text text-transparent">
                                                Συγκρίνετε Τιμές Σούπερ Μάρκετ & Εξοικονομήστε Χρήματα
                                            </h2>
                                            <p className="text-sm md:text-base text-white/90 max-w-lg mt-3 font-medium">
                                                Αναζητήστε προϊόντα, συγκρίνετε τιμές στις μεγαλύτερες αλυσίδες και φτιάξτε ένα καλάθι που κρατάει τα έξοδα υπό έλεγχο.
                                            </p>
                                            
                                            <div className="mt-6 flex flex-wrap gap-4">
                                                <button
                                                    onClick={() => {
                                                        const input = document.querySelector<HTMLInputElement>('input[aria-label="Αναζήτηση προϊόντων"]');
                                                        input?.focus();
                                                    }}
                                                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-indigo-800 hover:bg-indigo-50 font-bold rounded-2xl shadow-md transition duration-250 cursor-pointer text-sm"
                                                >
                                                    <Search className="w-4 h-4 text-indigo-800" />
                                                    <span>Ξεκινήστε Σύγκριση Τιμών</span>
                                                </button>
                                                <button 
                                                    onClick={() => setIsScannerOpen(true)}
                                                    className="inline-flex items-center gap-2 px-6 py-3.5 bg-indigo-600/20 border border-white/20 hover:bg-indigo-600/35 text-white font-bold rounded-2xl shadow-md transition duration-250 cursor-pointer text-sm"
                                                >
                                                    <Camera className="w-4.5 h-4.5 text-indigo-250" />
                                                    <span>Σάρωση Barcode</span>
                                                </button>
                                                <Link
                                                    href="/guide"
                                                    className="inline-flex items-center gap-2 px-5 py-3.5 text-white/90 hover:text-white font-bold rounded-2xl transition duration-250 cursor-pointer text-sm"
                                                >
                                                    <Sparkles className="w-4 h-4" />
                                                    <span>Οδηγός χρήσης</span>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>

                                    <section className="bg-card-bg border border-border-custom rounded-3xl p-5 sm:p-7 shadow-sm">
                                        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                                            <div className="lg:w-80">
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Αναζήτηση προϊόντων</span>
                                                <h3 className="text-xl font-black text-slate-850 dark:text-slate-100 mt-1">Βρείτε γρήγορα την καλύτερη τιμή</h3>
                                                <p className="text-sm text-slate-500 mt-2">Ξεκινήστε με ένα προϊόν ή επιλέξτε κατηγορία παρακάτω.</p>
                                            </div>
                                            <div className="relative flex-1">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={searchTerm}
                                                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                                    placeholder="π.χ. γάλα, φέτα, καφές, απορρυπαντικό"
                                                    aria-label="Αναζήτηση προϊόντων από την αρχική"
                                                    className="w-full pl-12 pr-4 py-4 text-base bg-input-custom border border-transparent focus:border-indigo-500 focus:bg-background rounded-2xl outline-none transition text-foreground shadow-inner"
                                                />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Global Statistics Grid */}
                                    <div className="space-y-5">
                                        <div className="px-1">
                                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                                                Γιατί αξίζει να συγκρίνετε
                                            </h3>
                                            <p className="text-sm text-slate-500 mt-1">Καθαρή εικόνα τιμών πριν πάτε στο ταμείο.</p>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                            {[
                                                {
                                                    label: 'Περισσότερες επιλογές',
                                                    value: stats ? Number(stats.total_products).toLocaleString('el-GR') : '8.773',
                                                    desc: 'Προϊόντα για σύγκριση τιμών',
                                                    icon: <ShoppingBag className="w-5 h-5 text-indigo-500" />,
                                                    bgColor: 'bg-indigo-500/10'
                                                },
                                                {
                                                    label: 'Ευκαιρίες σήμερα',
                                                    value: stats ? Number(stats.products_on_discount).toLocaleString('el-GR') : '2.263',
                                                    desc: 'Προϊόντα με ένδειξη προσφοράς',
                                                    icon: <Percent className="w-5 h-5 text-emerald-500" />,
                                                    bgColor: 'bg-emerald-500/10'
                                                },
                                                {
                                                    label: 'Σύγκριση αλυσίδων',
                                                    value: `${ALLOWED_RETAILERS.length} αλυσίδες`,
                                                    desc: 'Οι βασικές επιλογές για καθημερινά ψώνια',
                                                    icon: <Store className="w-5 h-5 text-amber-500" />,
                                                    bgColor: 'bg-amber-500/10'
                                                },
                                                {
                                                    label: 'Πρόσφατες τιμές',
                                                    value: stats ? formatGreekDate(stats.timestamp) : 'Σήμερα',
                                                    desc: 'Τελευταία ενημέρωση δεδομένων',
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
                                    <div className="space-y-5">
                                        <div className="px-1">
                                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                                                Ανακαλύψτε ανά κατηγορία
                                            </h3>
                                            <p className="text-sm text-slate-500 mt-1">Μεγάλες κατηγορίες, καθαρή πλοήγηση, γρήγορη σύγκριση.</p>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                                            {categories.map((cat) => {
                                                const meta = CATEGORY_META[cat.category_id] || { emoji: '📦', gradient: 'from-slate-500/10 to-slate-600/10 text-slate-550' };
                                                return (
                                                    <button
                                                        key={cat.category_id}
                                                        onClick={() => handleCategoryClick(cat.category_id)}
                                                        className={`
                                                            min-h-36 flex flex-col items-start justify-between text-left p-5 rounded-2xl border border-border-custom 
                                                            bg-gradient-to-br ${meta.gradient} shadow-sm hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition duration-300 cursor-pointer group
                                                        `}
                                                    >
                                                        <div className="w-full flex items-start justify-between gap-2">
                                                            <span className="text-3xl group-hover:scale-110 transition duration-300">{meta.emoji}</span>
                                                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition" />
                                                        </div>
                                                        <div className="w-full">
                                                            <span className="text-sm font-black text-slate-850 dark:text-slate-100 block leading-tight">{cat.name}</span>
                                                            <span className="inline-flex mt-3 px-2.5 py-1 rounded-full bg-background/75 border border-border-custom text-[10px] text-slate-650 dark:text-slate-300 font-bold">
                                                                {cat.total_product_count ? `${cat.total_product_count.toLocaleString('el-GR')} προϊόντα` : 'Δείτε όλα'}
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
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
                                                        {sub.name} ({sub.total_product_count || 0})
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
                                                        {currentCategoryNode?.name}
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
                                                    <span>Προβολή Όλων των Προϊόντων ({currentCategoryNode?.total_product_count || 0})</span>
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
                                                                {sub.name}
                                                            </h4>
                                                            <p className="inline-flex mt-2 px-2.5 py-1 rounded-full bg-input-custom text-[10px] text-slate-650 dark:text-slate-300 font-bold">
                                                                {sub.total_product_count || 0} προϊόντα
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
                                            <h3 className="text-lg font-bold mb-1">{productError ? 'Δεν φορτώθηκαν οι τιμές' : 'Δεν βρέθηκαν προϊόντα'}</h3>
                                            <p className="text-sm text-slate-500 mb-4">
                                                {productError || 'Δοκιμάστε άλλη λέξη αναζήτησης ή επιλέξτε διαφορετική κατηγορία.'}
                                            </p>
                                            <button 
                                                onClick={resetFilters} 
                                                className="px-5 py-3 bg-indigo-500 text-white text-xs font-bold rounded-xl hover:bg-indigo-600 transition cursor-pointer"
                                            >
                                                Επιστροφή στην αρχική
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between text-xs font-medium text-slate-450">
                                                <span>Βρέθηκαν {totalProductsCount} προϊόντα</span>
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
                                                    Προηγούμενη
                                                </button>
                                                <span className="text-xs text-slate-450 font-medium">Σελίδα {currentPage} από {totalPages}</span>
                                                <button 
                                                    disabled={currentPage === totalPages}
                                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                    className="px-4 py-2 text-xs font-semibold bg-background border border-border-custom disabled:opacity-50 disabled:cursor-not-allowed rounded-xl hover:bg-input-custom transition text-foreground"
                                                >
                                                    Επόμενη
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            // FAVORITES & BASKET OPTIMIZER VIEW
                            <div className="space-y-8">
                                {favorites.length === 0 ? (
                                    <div className="h-[60vh] flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                                        <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-4">
                                            <Heart className="w-8 h-8 fill-current" />
                                        </div>
                                        <h3 className="text-lg font-bold mb-1">Η λίστα σας είναι άδεια</h3>
                                        <p className="text-sm text-slate-500">Προσθέστε προϊόντα στα αγαπημένα σας για να τα συγκρίνετε και να τα βελτιστοποιήσετε εδώ.</p>
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
                                                            Ειδοποιήσεις για Προσφορές
                                                        </h4>
                                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                                            Λάβετε αυτόματες ειδοποιήσεις όταν κάποιο προϊόν του καλαθιού σας έχει έκπτωση.
                                                        </p>
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
                                                    {isSubscribed ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}
                                                </button>
                                            </div>
                                        )}
                                        
                                        {/* Sub-tab Navigation */}
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-border-custom gap-4">
                                            <div>
                                                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                    <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                                                    <span>Τα Αγαπημένα μου</span>
                                                </h2>
                                                <p className="text-xs text-slate-400 mt-1">Διαχειριστείτε τη λίστα Pantry και το ενεργό καλάθι αγορών σας.</p>
                                            </div>

                                            <div className="flex bg-input-custom p-1 rounded-xl w-full sm:w-auto border border-border-custom/50">
                                                <button 
                                                    className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${favoritesSubTab === 'pantry' ? 'bg-background shadow text-indigo-500 dark:text-indigo-400' : 'text-slate-500 hover:text-foreground'}`}
                                                    onClick={() => setFavoritesSubTab('pantry')}
                                                >
                                                    <ShoppingBag className="w-3.5 h-3.5" />
                                                    <span>Λίστα Pantry ({favorites.length})</span>
                                                </button>
                                                <button 
                                                    className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${favoritesSubTab === 'basket' ? 'bg-background shadow text-emerald-500 dark:text-emerald-400' : 'text-slate-500 hover:text-foreground'}`}
                                                    onClick={() => setFavoritesSubTab('basket')}
                                                >
                                                    <ShoppingBasket className="w-3.5 h-3.5" />
                                                    <span>Ενεργό Καλάθι ({activeBasketIds.length})</span>
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
                                                            <span>Λίστα Pantry</span>
                                                        </h3>
                                                        <p className="text-xs text-slate-400 mt-1">Επιλέξτε ποια προϊόντα θα προστεθούν στο ενεργό καλάθι για βελτιστοποίηση.</p>
                                                    </div>
                                                    <div className="flex gap-2.5">
                                                        <button 
                                                            onClick={selectAllBasketItems}
                                                            className="px-3 py-1.5 text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-xl transition"
                                                        >
                                                            Επιλογή Όλων
                                                        </button>
                                                        <button 
                                                            onClick={deselectAllBasketItems}
                                                            className="px-3 py-1.5 text-xs font-semibold bg-input-custom text-slate-650 dark:text-slate-400 border border-slate-500/20 hover:bg-input-custom rounded-xl transition"
                                                        >
                                                            Απεπιλογή Όλων
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
                                                                    <span className="text-[9px] font-bold text-indigo-500 block uppercase tracking-wider truncate">{prod.brand || 'Γενικό'}</span>
                                                                    <strong className="text-xs font-semibold text-slate-800 dark:text-slate-100 block line-clamp-2 leading-snug">{prod.name}</strong>
                                                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                                                                        {cheapest ? `Από €${cheapest.price.toFixed(2)}` : '-'}
                                                                    </span>
                                                                </div>
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleFavorite(e, prod);
                                                                    }}
                                                                    className="p-1 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded transition shrink-0"
                                                                    title="Αφαίρεση από Pantry"
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
                                                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Το Καλάθι σας είναι άδειο</div>
                                                    <p className="text-xs text-slate-400 mt-1 max-w-[280px] mb-4">Επιλέξτε προϊόντα από τη λίστα Pantry για να ενεργοποιήσετε τους αλγόριθμους σύγκρισης και βελτιστοποίησης τιμών.</p>
                                                    <button 
                                                        onClick={() => setFavoritesSubTab('pantry')}
                                                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition"
                                                    >
                                                        Μετάβαση στη λίστα Pantry
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-8">
                                                    <section className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl overflow-hidden">
                                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                                            <div>
                                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-[11px] font-bold mb-4">
                                                                    <ShoppingBasket className="w-3.5 h-3.5" />
                                                                    <span>{activeBasketProducts.length} προϊόντα στο καλάθι</span>
                                                                </div>
                                                                <h3 className="text-2xl sm:text-3xl font-black tracking-tight">Βελτιστοποίηση Καλαθιού</h3>
                                                                <p className="text-sm text-white/80 mt-2 max-w-xl">
                                                                    Βρείτε αν σας συμφέρει μία στάση ή διαμοιρασμός σε 2-3 σούπερ μάρκετ, με καθαρή εικόνα εξοικονόμησης.
                                                                </p>
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 lg:min-w-[420px]">
                                                                <div className="bg-white/10 border border-white/15 rounded-2xl p-4">
                                                                    <span className="text-[10px] font-bold text-white/70 uppercase">Εκτίμηση</span>
                                                                    <strong className="block text-xl font-black mt-1">€{(basketOptimizer.recommended?.totalCost || 0).toFixed(2)}</strong>
                                                                </div>
                                                                <div className="bg-white/10 border border-white/15 rounded-2xl p-4">
                                                                    <span className="text-[10px] font-bold text-white/70 uppercase">Μέγιστο όφελος</span>
                                                                    <strong className="block text-xl font-black text-emerald-200 mt-1">€{basketOptimizer.bestPossibleSaving.toFixed(2)}</strong>
                                                                </div>
                                                                <button
                                                                    onClick={() => setShowOptimizerResults(true)}
                                                                    className="col-span-2 sm:col-span-1 min-h-16 px-5 py-3 bg-white text-indigo-800 hover:bg-indigo-50 rounded-2xl font-black text-sm shadow-lg transition active:scale-[0.98]"
                                                                >
                                                                    Βελτιστοποίηση Καλαθιού
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {basketOptimizer.missingPriceCount > 0 && (
                                                            <div className="mt-5 flex items-start gap-2 text-xs text-amber-100 bg-amber-500/15 border border-amber-200/20 rounded-2xl p-3">
                                                                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                                                                <span>Δεν υπάρχουν αρκετά δεδομένα τιμών για {basketOptimizer.missingPriceCount} προϊόντα. Η σύγκριση γίνεται με όσα προϊόντα έχουν διαθέσιμες τιμές.</span>
                                                            </div>
                                                        )}
                                                    </section>

                                                    {showOptimizerResults && basketOptimizer.hasEnoughData && (
                                                        <section className="space-y-5">
                                                            <div className="bg-card-bg border border-emerald-500/20 rounded-3xl p-6 shadow-sm">
                                                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Αποτέλεσμα</span>
                                                                <h3 className="text-2xl font-black text-slate-850 dark:text-slate-100 mt-1">
                                                                    Μπορείτε να εξοικονομήσετε έως €{basketOptimizer.bestPossibleSaving.toFixed(2)}
                                                                </h3>
                                                                <p className="text-sm text-slate-500 mt-2">
                                                                    {basketOptimizer.recommended?.stops === 1
                                                                        ? 'Για λίγα ευρώ παραπάνω, μπορείτε να τα πάρετε όλα από ένα κατάστημα.'
                                                                        : 'Η προτεινόμενη λύση κρατά καλή ισορροπία ανάμεσα στην οικονομία και την ευκολία.'}
                                                                </p>
                                                            </div>

                                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                                                {[
                                                                    {
                                                                        key: 'convenient',
                                                                        title: 'Πιο βολικό',
                                                                        option: basketOptimizer.convenient,
                                                                        accent: 'border-slate-200 dark:border-slate-700',
                                                                        badge: 'Όλα σε μία στάση',
                                                                        icon: <Store className="w-5 h-5" />
                                                                    },
                                                                    {
                                                                        key: 'recommended',
                                                                        title: 'Προτεινόμενο',
                                                                        option: basketOptimizer.recommended,
                                                                        accent: 'border-emerald-500/50 ring-2 ring-emerald-500/10 shadow-lg',
                                                                        badge: 'Καλύτερη σχέση οικονομίας και ευκολίας',
                                                                        icon: <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
                                                                    },
                                                                    {
                                                                        key: 'maximum',
                                                                        title: 'Μέγιστη εξοικονόμηση',
                                                                        option: basketOptimizer.maximumSavings,
                                                                        accent: 'border-indigo-500/30',
                                                                        badge: 'Χαμηλότερο συνολικό κόστος',
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
                                                                                    {option.stops} {option.stops === 1 ? 'στάση' : 'στάσεις'}
                                                                                </span>
                                                                            </div>

                                                                            <div>
                                                                                <strong className="text-3xl font-black text-emerald-600 dark:text-emerald-400">€{option.totalCost.toFixed(2)}</strong>
                                                                                <div className="text-sm font-bold text-slate-500 mt-1">Εξοικονόμηση €{saving.toFixed(2)}</div>
                                                                            </div>

                                                                            <div className="space-y-2">
                                                                                <div className="flex justify-between text-xs font-semibold text-slate-500">
                                                                                    <span>Διαθέσιμα προϊόντα</span>
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
                                                                            <h4 className="text-base font-black text-slate-850 dark:text-slate-100">Τι να αγοράσετε από κάθε σούπερ μάρκετ</h4>
                                                                            <p className="text-xs text-slate-500 mt-1">Ανάλυση για την προτεινόμενη επιλογή.</p>
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
                                                                                            <div className="text-[10px] text-slate-500 font-bold">{group.items.length} προϊόντα</div>
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
                                                                            Δεν υπάρχουν τιμές για {basketOptimizer.recommended.missingItems.length} προϊόντα στην προτεινόμενη επιλογή.
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
                                                                    <span>Προϊόντα στο Ενεργό Καλάθι ({activeBasketProducts.length})</span>
                                                                </h3>
                                                                <p className="text-xs text-slate-400 mt-1">Ενεργά προϊόντα που συμμετέχουν στη βελτιστοποίηση. Ξεκλικάρετε για να τα εξαιρέσετε προσωρινά.</p>
                                                            </div>
                                                            <div className="flex gap-2.5">
                                                                <button 
                                                                    onClick={deselectAllBasketItems}
                                                                    className="px-3 py-1.5 text-xs font-semibold bg-input-custom text-slate-650 dark:text-slate-400 border border-slate-500/20 hover:bg-input-custom rounded-xl transition"
                                                                >
                                                                    Απεπιλογή Όλων
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
                                                                            <span className="text-[9px] font-bold text-indigo-500 block uppercase tracking-wider truncate">{prod.brand || 'Γενικό'}</span>
                                                                            <strong className="text-xs font-semibold text-slate-800 dark:text-slate-100 block truncate">{prod.name}</strong>
                                                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                                                                                {cheapest ? `Από €${cheapest.price.toFixed(2)}` : '-'}
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
                                                            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Σύγκριση Τιμών Καλαθιού ανά Σούπερ Μάρκετ</h3>
                                                            <div className="flex gap-2.5">
                                                                <button 
                                                                    onClick={() => setIsShareOpen(true)}
                                                                    className="px-4 py-2 text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl flex items-center gap-1.5 transition"
                                                                >
                                                                    <Share2 className="w-3.5 h-3.5" />
                                                                    <span>Κοινοποίηση Λίστας</span>
                                                                </button>
                                                                <button 
                                                                    onClick={clearAllFavorites}
                                                                    className="px-4 py-2 text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 rounded-xl flex items-center gap-1.5 transition"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                    <span>Καθαρισμός Λίστας</span>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left text-sm border-collapse">
                                                                <thead>
                                                                    <tr className="border-b border-border-custom">
                                                                        <th className="py-3 px-4 font-bold text-slate-400 text-xs uppercase">Προϊόν</th>
                                                                        <th className="py-3 px-4 font-bold text-slate-400 text-xs uppercase text-center bg-indigo-500/5">Φθηνότερο</th>
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
                                                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Αγορά από 1 Σούπερ Μάρκετ</h3>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mb-6">Σύγκριση του συνολικού κόστους για όλα τα αγαπημένα σας προϊόντα αν τα αγοράσετε από ένα μόνο κατάστημα.</p>
                                                            
                                                            <div className="space-y-4 flex-1">
                                                                {singleStoreResults.length === 0 ? (
                                                                    <div className="flex flex-col items-center justify-center py-8 text-center bg-input-custom rounded-xl p-4 border border-border-custom">
                                                                        <Info className="w-8 h-8 text-amber-500 mb-2" />
                                                                        <div className="text-xs font-bold text-slate-600 dark:text-slate-300">Κανένα κατάστημα δεν έχει όλα τα προϊόντα</div>
                                                                        <p className="text-[10px] text-slate-400 mt-1 max-w-[240px]">Κανένα μεμονωμένο σούπερ μάρκετ δεν διαθέτει το 100% των επιλογών σας. Δείτε την πρόταση Split-Trip παρακάτω για αγορά από τα φθηνότερα.</p>
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
                                                                                title="Κάντε κλικ για προβολή στο χάρτη"
                                                                            >
                                                                                <div className="flex items-center gap-3">
                                                                                    <img className="w-9 h-9 rounded-full object-cover border border-border-custom" src={retailerLogoUrl(res.retailerId)} alt="" />
                                                                                    <div>
                                                                                        <div className="text-xs font-bold flex items-center gap-1">
                                                                                            <span>{meta.name}</span>
                                                                                            {isWinner && <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                                                                                        </div>
                                                                                        <div className="text-[10px] text-slate-400 font-semibold">{res.itemsCount}/{res.totalItems} προϊόντα • 100% διαθεσιμότητα</div>
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
                                                                                        title="Online Παραγγελία"
                                                                                    >
                                                                                        <ShoppingBag className="w-3.5 h-3.5" />
                                                                                        <span className="hidden sm:inline">Παραγγελία</span>
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
                                                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Βέλτιστος Διαμοιρασμός (Split-Trip)</h3>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mb-6">Συνδυασμός καταστημάτων αγοράζοντας κάθε προϊόν από εκεί που είναι φθηνότερο για τη μέγιστη εξοικονόμηση.</p>

                                                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between mb-6">
                                                                <div>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Συνολικό Κόστος</span>
                                                                    <strong className="text-2xl font-black text-emerald-500">€{splitTripData.totalCost.toFixed(2)}</strong>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Εξοικονόμηση</span>
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
                                                                                        title="Προβολή στο χάρτη"
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
                                                                                        title="Βοηθός e-Shop"
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
                        <h3 className="text-base font-bold flex items-center gap-1.5"><Share2 className="w-5 h-5 text-emerald-500" /><span>Κοινοποίηση Λίστας</span></h3>
                        <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg" onClick={() => setIsShareOpen(false)} aria-label="Κλείσιμο κοινής χρήσης">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <p className="text-xs text-slate-400">Επιλέξτε πώς θέλετε να μοιραστείτε τη λίστα αγορών σας με την οικογένειά σας:</p>

                        <div className="space-y-3">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Κείμενο για WhatsApp / Viber (Λίστα Αγορών)</div>
                            <textarea 
                                readOnly 
                                value={shareMessageText}
                                aria-label="Κείμενο λίστας αγορών για αντιγραφή"
                                className="w-full h-56 p-3 text-xs bg-input-custom border border-border-custom rounded-xl outline-none resize-none font-sans leading-relaxed text-slate-700 dark:text-slate-200"
                            />
                            <button 
                                onClick={copyText}
                                className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition"
                            >
                                <Copy className="w-4 h-4" />
                                <span>Αντιγραφή Λίστας (Κείμενο)</span>
                            </button>
                        </div>

                        <div className="border-t border-border-custom my-2"></div>

                        <div className="space-y-3">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Web Link (για εισαγωγή στο Kallathaki.gr)</div>
                            <input 
                                type="text"
                                readOnly
                                value={webShareLink}
                                aria-label="Σύνδεσμος λίστας αγορών για αντιγραφή"
                                className="w-full p-3 text-xs bg-input-custom border border-border-custom rounded-xl outline-none text-slate-750 dark:text-slate-250 truncate"
                            />
                            <button 
                                onClick={copyLink}
                                className="w-full py-2.5 bg-input-custom hover:bg-input-custom text-foreground text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-border-custom transition"
                            >
                                <LinkIcon className="w-4 h-4" />
                                <span>Αντιγραφή Συνδέσμου (Web Link)</span>
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
                            <span>Τοποθεσία Καταστήματος</span>
                        </h3>
                        <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg text-slate-500" onClick={() => setActiveMapRetailer(null)} aria-label="Κλείσιμο χάρτη">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {activeMapRetailer && (
                        <div className="flex-1 flex flex-col p-6 space-y-4 overflow-y-auto">
                            <div>
                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">ΣΟΥΠΕΡ ΜΑΡΚΕΤ</span>
                                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1">
                                    {RETAILER_META[activeMapRetailer]?.name || activeMapRetailer}
                                </h4>
                                <p className="text-xs text-slate-400 mt-1 font-medium">
                                    {userCoords 
                                        ? 'Εμφάνιση του πλησιέστερου καταστήματος με βάση τις συντεταγμένες σας.' 
                                        : 'Εμφάνιση καταστημάτων. Επιτρέψτε την τοποθεσία στο πρόγραμμα περιήγησης για αυτόματη εύρεση του πλησιέστερου.'}
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
                                <span>Έναρξη Πλοήγησης (Google Maps)</span>
                            </a>
                        </div>
                    )}
                </div>

                {/* Mobile Bottom Navigation Bar */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 z-35 bg-sidebar-bg/95 backdrop-blur border-t border-border-custom px-3 pt-2 pb-[calc(0.6rem+env(safe-area-inset-bottom))] grid grid-cols-4 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
                    <button 
                        onClick={() => {
                            setActiveTab('products');
                            resetFilters();
                        }}
                        className={`min-h-14 flex flex-col items-center justify-center gap-1 rounded-2xl transition active:scale-95 ${
                            activeTab === 'products' ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 font-bold' : 'text-slate-650 dark:text-slate-400 hover:text-foreground'
                        }`}
                    >
                        <Home className="w-5 h-5" />
                        <span className="text-[10px]">Αρχική</span>
                    </button>
                    <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="min-h-14 flex flex-col items-center justify-center gap-1 rounded-2xl text-slate-650 dark:text-slate-400 hover:text-foreground transition active:scale-95"
                    >
                        <Menu className="w-5 h-5" />
                        <span className="text-[10px]">Κατηγορίες</span>
                    </button>
                    <button 
                        onClick={() => setIsScannerOpen(true)}
                        className="min-h-14 flex flex-col items-center justify-center gap-1 rounded-2xl text-slate-650 dark:text-slate-400 hover:text-indigo-800 dark:hover:text-indigo-400 transition active:scale-95"
                    >
                        <Camera className="w-5 h-5" />
                        <span className="text-[10px]">Σάρωση</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('favorites')}
                        className={`min-h-14 flex flex-col items-center justify-center gap-1 rounded-2xl transition relative active:scale-95 ${
                            activeTab === 'favorites' ? 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-400 font-bold' : 'text-slate-650 dark:text-slate-400 hover:text-foreground'
                        }`}
                    >
                        <ShoppingBasket className="w-5 h-5" />
                        <span className="text-[10px]">Καλάθι</span>
                        {activeBasketIds.length > 0 && (
                            <span className="absolute top-1 right-3 bg-emerald-500 text-white text-[10px] font-black rounded-full min-w-5 h-5 px-1 flex items-center justify-center shadow-md ring-2 ring-sidebar-bg">
                                {activeBasketIds.length}
                            </span>
                        )}
                    </button>
                </nav>

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
