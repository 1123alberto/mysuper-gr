"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Bell,
    Camera,
    CheckCircle2,
    Grid2X2,
    Heart,
    MapPin,
    Moon,
    Percent,
    Search,
    Share2,
    ShoppingBasket,
    Sparkles,
    Store,
    Sun,
    Trophy,
    UserCircle
} from 'lucide-react';

type GuideLanguage = 'el' | 'en';

const guideCopy = {
    el: {
        appCta: 'Άνοιγμα εφαρμογής',
        backTitle: 'Επιστροφή στην αρχική',
        languageLabel: 'Language',
        themeLabel: 'Αλλαγή θέματος',
        badge: 'Οδηγός Χρήσης & Δυνατοτήτων',
        title: 'Τι μπορείτε να κάνετε με το Kallathaki',
        intro: 'Το Kallathaki σας βοηθά να βρίσκετε προϊόντα, να συγκρίνετε τιμές, να οργανώνετε καλάθι και να αποφασίζετε πού σας συμφέρει να ψωνίσετε.',
        flowBadge: 'Γρήγορη ροή χρήσης',
        flowTitle: 'Από αναζήτηση σε έξυπνο καλάθι',
        flowText: 'Η πιο χρήσιμη διαδρομή είναι απλή: βρίσκετε προϊόντα, τα προσθέτετε στο καλάθι και αφήνετε την εφαρμογή να σας δείξει το οικονομικότερο σενάριο αγοράς.',
        toolsTitle: 'Άλλα χρήσιμα εργαλεία',
        toolsText: 'Μικρές λειτουργίες που κάνουν την καθημερινή λίστα πιο πρακτική.',
        fallbackTitle: 'Τι γίνεται αν δεν φορτώσουν οι ζωντανές τιμές;',
        fallbackText: 'Αν η επίσημη πηγή τιμών καθυστερεί ή δεν απαντά προσωρινά, η εφαρμογή προσπαθεί να εμφανίσει αποθηκευμένα διαθέσιμα δεδομένα ώστε να μπορείτε να συνεχίσετε την αναζήτηση. Όταν οι ζωντανές τιμές επανέλθουν, τα αποτελέσματα ενημερώνονται ξανά από την πηγή.',
        readyTitle: 'Έτοιμοι για σύγκριση;',
        readyCta: 'Επιστροφή στην εφαρμογή',
        features: [
            {
                icon: <Search className="w-6 h-6 text-indigo-500" />,
                title: 'Βρείτε γρήγορα προϊόντα',
                text: 'Αναζητήστε με όνομα, μάρκα ή λέξη-κλειδί και δείτε άμεσα σε ποια αλυσίδα συμφέρει περισσότερο.',
                tips: ['Δοκιμάστε απλές λέξεις όπως “γάλα”, “ρύζι”, “καφές”.', 'Ανοίξτε ένα προϊόν για να δείτε όλες τις διαθέσιμες τιμές.']
            },
            {
                icon: <Grid2X2 className="w-6 h-6 text-emerald-500" />,
                title: 'Περιηγηθείτε με κατηγορίες',
                text: 'Ανοίξτε τις κατηγορίες από την επάνω μπάρα ή από την αρχική σελίδα και βρείτε προϊόντα χωρίς να χρειάζεται να θυμάστε ονόματα.',
                tips: ['Χρησιμοποιήστε την αναζήτηση μέσα στις κατηγορίες.', 'Μπείτε σε υποκατηγορίες ή δείτε όλα τα προϊόντα μιας κατηγορίας.']
            },
            {
                icon: <Camera className="w-6 h-6 text-amber-500" />,
                title: 'Σκανάρετε barcode στο κατάστημα',
                text: 'Όταν κρατάτε ένα προϊόν στο χέρι, σκανάρετε το barcode και συγκρίνετε την τιμή του με άλλες αλυσίδες.',
                tips: ['Χρήσιμο για γρήγορο έλεγχο πριν το βάλετε στο καρότσι.', 'Αν δεν βρεθεί ακριβές barcode, γίνεται αναζήτηση με τον κωδικό.']
            },
            {
                icon: <ShoppingBasket className="w-6 h-6 text-violet-500" />,
                title: 'Φτιάξτε ενεργό καλάθι',
                text: 'Προσθέστε προϊόντα στα αγαπημένα και επιλέξτε ποια μπαίνουν στο ενεργό καλάθι της τρέχουσας αγοράς.',
                tips: ['Κρατήστε στα αγαπημένα προϊόντα που αγοράζετε συχνά.', 'Αλλάξτε το ενεργό καλάθι ανάλογα με τη σημερινή λίστα.']
            },
            {
                icon: <Trophy className="w-6 h-6 text-emerald-500" />,
                title: 'Βρείτε τον φθηνότερο τρόπο αγοράς',
                text: 'Η εφαρμογή συγκρίνει το καλάθι σας και δείχνει αν συμφέρει ένα κατάστημα ή διαμοιρασμός σε περισσότερες αλυσίδες.',
                tips: ['Χρησιμοποιήστε “Optimize” για τη μεγαλύτερη δυνατή οικονομία.', 'Δείτε ποια προϊόντα συμφέρουν από κάθε κατάστημα.']
            },
            {
                icon: <Percent className="w-6 h-6 text-rose-500" />,
                title: 'Δείτε προσφορές',
                text: 'Η καρτέλα Προσφορές συγκεντρώνει προϊόντα με ένδειξη προσφοράς, ώστε να βρίσκετε ευκαιρίες πιο γρήγορα.',
                tips: ['Προσθέστε προσφορές απευθείας στο καλάθι.', 'Συγκρίνετε την τιμή προσφοράς με τις υπόλοιπες αλυσίδες.']
            }
        ],
        flowSteps: [
            'Αναζητήστε προϊόν ή ανοίξτε μια κατηγορία.',
            'Ανοίξτε προϊόντα και συγκρίνετε τιμές ανά αλυσίδα.',
            'Πατήστε την καρδιά για να τα κρατήσετε στα αγαπημένα.',
            'Επιλέξτε ποια αγαπημένα μπαίνουν στο ενεργό καλάθι.',
            'Πατήστε Optimize για να δείτε το καλύτερο πλάνο αγοράς.'
        ],
        tools: [
            { icon: <Bell className="w-5 h-5 text-indigo-500" />, title: 'Ειδοποιήσεις προσφορών', text: 'Ενεργοποιήστε ειδοποιήσεις για να μαθαίνετε όταν προϊόντα του καλαθιού σας εμφανίζονται σε προσφορά.' },
            { icon: <MapPin className="w-5 h-5 text-emerald-500" />, title: 'Κοντινό κατάστημα', text: 'Ανοίξτε τον χάρτη μιας αλυσίδας και ξεκινήστε πλοήγηση με Google Maps.' },
            { icon: <Share2 className="w-5 h-5 text-amber-500" />, title: 'Κοινοποίηση λίστας', text: 'Μοιραστείτε τη λίστα αγορών με την οικογένεια μέσω κειμένου ή συνδέσμου.' },
            { icon: <Store className="w-5 h-5 text-violet-500" />, title: 'Βοήθεια για e-shop', text: 'Ανοίξτε γρήγορα αναζητήσεις στα e-shop των αλυσίδων για τα προϊόντα του καλαθιού σας.' },
            { icon: <Heart className="w-5 h-5 text-rose-500" />, title: 'Αγαπημένα προϊόντα', text: 'Κρατήστε προϊόντα που αγοράζετε συχνά για να φτιάχνετε λίστα χωρίς να τα ψάχνετε ξανά.' },
            { icon: <UserCircle className="w-5 h-5 text-slate-500" />, title: 'Το προφίλ σας', text: 'Δείτε σύνοψη αγαπημένων, ενεργού καλαθιού και εκτιμώμενης εξοικονόμησης.' }
        ]
    },
    en: {
        appCta: 'Open app',
        backTitle: 'Back to home',
        languageLabel: 'Language',
        themeLabel: 'Change theme',
        badge: 'User Guide & Features',
        title: 'What you can do with Kallathaki',
        intro: 'Kallathaki helps you find products, compare prices, organize a basket, and decide where it makes sense to shop.',
        flowBadge: 'Quick workflow',
        flowTitle: 'From search to a smarter basket',
        flowText: 'The most useful flow is simple: find products, add them to your basket, and let the app show you the cheapest shopping plan.',
        toolsTitle: 'Other useful tools',
        toolsText: 'Small features that make everyday shopping lists more practical.',
        fallbackTitle: 'What if live prices do not load?',
        fallbackText: 'If the official price source is slow or temporarily unavailable, the app tries to show saved available data so you can keep searching. When live prices return, results update from the source again.',
        readyTitle: 'Ready to compare?',
        readyCta: 'Back to the app',
        features: [
            {
                icon: <Search className="w-6 h-6 text-indigo-500" />,
                title: 'Find products quickly',
                text: 'Search by product name, brand, or keyword and see which chain is currently cheaper.',
                tips: ['Try simple terms like “milk”, “rice”, or “coffee”.', 'Open a product to see all available prices.']
            },
            {
                icon: <Grid2X2 className="w-6 h-6 text-emerald-500" />,
                title: 'Browse by category',
                text: 'Open categories from the top bar or home page and find products without remembering exact names.',
                tips: ['Use search inside the category browser.', 'Open subcategories or view all products in a category.']
            },
            {
                icon: <Camera className="w-6 h-6 text-amber-500" />,
                title: 'Scan a barcode in-store',
                text: 'When you are holding a product, scan its barcode and compare its price across other chains.',
                tips: ['Useful for a quick check before adding it to your cart.', 'If the exact barcode is not found, the app searches by code.']
            },
            {
                icon: <ShoppingBasket className="w-6 h-6 text-violet-500" />,
                title: 'Build an active basket',
                text: 'Save products as favorites and choose which ones belong in today’s active shopping basket.',
                tips: ['Keep frequent purchases in favorites.', 'Change the active basket depending on today’s list.']
            },
            {
                icon: <Trophy className="w-6 h-6 text-emerald-500" />,
                title: 'Find the cheapest way to shop',
                text: 'The app compares your basket and shows whether one store or a split trip gives you the best price.',
                tips: ['Use “Optimize” for the largest possible savings.', 'See which products are best bought from each store.']
            },
            {
                icon: <Percent className="w-6 h-6 text-rose-500" />,
                title: 'See offers',
                text: 'The Offers tab collects products marked as discounted so you can spot deals faster.',
                tips: ['Add offers directly to your basket.', 'Compare the offer price against the other chains.']
            }
        ],
        flowSteps: [
            'Search for a product or open a category.',
            'Open products and compare prices by chain.',
            'Tap the heart to save products to favorites.',
            'Choose which favorites go into the active basket.',
            'Tap Optimize to see the best shopping plan.'
        ],
        tools: [
            { icon: <Bell className="w-5 h-5 text-indigo-500" />, title: 'Offer notifications', text: 'Enable notifications to learn when products in your basket appear on offer.' },
            { icon: <MapPin className="w-5 h-5 text-emerald-500" />, title: 'Nearby store', text: 'Open a chain’s map and start navigation with Google Maps.' },
            { icon: <Share2 className="w-5 h-5 text-amber-500" />, title: 'Share your list', text: 'Share your shopping list with family by text or link.' },
            { icon: <Store className="w-5 h-5 text-violet-500" />, title: 'E-shop helper', text: 'Open quick e-shop searches for the products in your basket.' },
            { icon: <Heart className="w-5 h-5 text-rose-500" />, title: 'Favorite products', text: 'Keep products you buy often so you can build lists without searching again.' },
            { icon: <UserCircle className="w-5 h-5 text-slate-500" />, title: 'Your profile', text: 'See a summary of favorites, active basket, and estimated savings.' }
        ]
    }
} satisfies Record<GuideLanguage, {
    appCta: string;
    backTitle: string;
    languageLabel: string;
    themeLabel: string;
    badge: string;
    title: string;
    intro: string;
    flowBadge: string;
    flowTitle: string;
    flowText: string;
    toolsTitle: string;
    toolsText: string;
    fallbackTitle: string;
    fallbackText: string;
    readyTitle: string;
    readyCta: string;
    features: Array<{ icon: React.ReactNode; title: string; text: string; tips: string[] }>;
    flowSteps: string[];
    tools: Array<{ icon: React.ReactNode; title: string; text: string }>;
}>;

export default function GuidePage() {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [language, setLanguage] = useState<GuideLanguage>('el');
    const copy = guideCopy[language];

    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'dark' : 'light');
        setLanguage(localStorage.getItem('kallathaki_language') === 'en' ? 'en' : 'el');
    }, []);

    const toggleTheme = () => {
        const nextTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(nextTheme);
        localStorage.setItem('posokanei_theme', nextTheme);
        document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    };

    const toggleLanguage = () => {
        const nextLanguage: GuideLanguage = language === 'el' ? 'en' : 'el';
        setLanguage(nextLanguage);
        localStorage.setItem('kallathaki_language', nextLanguage);
    };

    return (
        <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300 flex flex-col">
            <header className="p-4 border-b border-border-custom bg-panel-bg flex items-center justify-between sticky top-0 z-50 shadow-sm backdrop-blur-md bg-opacity-80">
                <div className="flex items-center gap-3 min-w-0">
                    <Link href="/" className="p-2 hover:bg-input-custom rounded-xl transition text-foreground flex items-center justify-center" title={copy.backTitle}>
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2 min-w-0">
                        <ShoppingBasket className="w-6 h-6 text-indigo-500 shrink-0" />
                        <span className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-emerald-500 bg-clip-text text-transparent truncate">Kallathaki.gr</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <button onClick={toggleLanguage} className="px-3 py-2.5 hover:bg-input-custom border border-border-custom rounded-xl transition text-xs font-black text-foreground" title={copy.languageLabel} aria-label={copy.languageLabel}>
                        {language === 'el' ? 'EN' : 'EL'}
                    </button>
                    <button onClick={toggleTheme} className="p-2.5 hover:bg-input-custom border border-border-custom rounded-xl transition text-foreground" title={copy.themeLabel} aria-label={copy.themeLabel}>
                        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </button>
                    <Link href="/" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow transition duration-200">
                        {copy.appCta}
                    </Link>
                </div>
            </header>

            <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10 md:py-14 space-y-12">
                <section className="text-center space-y-4 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                        <Sparkles className="w-4 h-4" />
                        <span>{copy.badge}</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white">
                        {copy.title}
                    </h1>
                    <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 font-medium">
                        {copy.intro}
                    </p>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {copy.features.map((feature) => (
                        <article key={feature.title} className="bg-card-bg border border-border-custom p-6 rounded-2xl shadow-sm hover:shadow-md transition duration-200 space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-input-custom rounded-xl shrink-0">{feature.icon}</div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-850 dark:text-white">{feature.title}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mt-2">{feature.text}</p>
                                </div>
                            </div>
                            <ul className="space-y-2 border-t border-border-custom pt-4 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {feature.tips.map((tip) => (
                                    <li key={tip} className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span>{tip}</span>
                                    </li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </section>

                <section className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 md:p-10 shadow-xl border border-indigo-500/20">
                    <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-8 items-start">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold">
                                <Trophy className="w-4 h-4" />
                                <span>{copy.flowBadge}</span>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black mt-4">{copy.flowTitle}</h2>
                            <p className="text-sm text-indigo-200 mt-3 leading-relaxed">{copy.flowText}</p>
                        </div>

                        <ol className="space-y-3">
                            {copy.flowSteps.map((step, index) => (
                                <li key={step} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-2xl p-4">
                                    <span className="w-7 h-7 rounded-full bg-white text-indigo-900 font-black text-xs flex items-center justify-center shrink-0">{index + 1}</span>
                                    <span className="text-sm font-semibold text-white/90">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section className="space-y-5">
                    <div className="text-center">
                        <h2 className="text-2xl font-black text-slate-850 dark:text-white">{copy.toolsTitle}</h2>
                        <p className="text-sm text-slate-500 mt-2">{copy.toolsText}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {copy.tools.map((tool) => (
                            <article key={tool.title} className="p-5 bg-card-bg border border-border-custom rounded-2xl shadow-sm space-y-3">
                                <div className="p-2.5 bg-input-custom rounded-xl w-fit">{tool.icon}</div>
                                <h3 className="text-base font-black text-slate-850 dark:text-white">{tool.title}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{tool.text}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="bg-card-bg border border-border-custom rounded-3xl p-6 md:p-8 shadow-sm">
                    <h2 className="text-2xl font-black text-slate-850 dark:text-white">{copy.fallbackTitle}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">{copy.fallbackText}</p>
                </section>

                <section className="text-center py-6 border-t border-border-custom space-y-4">
                    <h2 className="text-xl font-black text-slate-850 dark:text-white">{copy.readyTitle}</h2>
                    <Link href="/" className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold rounded-2xl shadow-lg transition duration-200">
                        <span>{copy.readyCta}</span>
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                    </Link>
                </section>
            </main>

            <footer className="p-6 border-t border-border-custom bg-panel-bg text-center text-xs text-slate-400 mt-auto">
                <div>Kallathaki.gr &copy; {new Date().getFullYear()}</div>
            </footer>
        </div>
    );
}
