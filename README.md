# Kallathaki.gr (Καλαθάκι) - Έξυπνη Σύγκριση Τιμών Supermarket

Το **Kallathaki.gr (Καλαθάκι)** είναι μια σύγχρονη, γρήγορη και εξαιρετικά εύχρηστη εφαρμογή ιστού (web application) PWA για τη σύγκριση τιμών προϊόντων και τη βελτιστοποίηση καλαθιού αγορών στα μεγαλύτερα σούπερ μάρκετ της Ελλάδας (Σκλαβενίτης, Lidl, ΑΒ Βασιλόπουλος, Μασούτης, My Market, Κρητικός).

Η εφαρμογή συνδέεται απευθείας με τα επίσημα δεδομένα του **e-Katanalotis (posokanei.gov.gr)** μέσω ενός custom API Route proxy, επιτρέποντας στους καταναλωτές να οργανώνουν τη λίστα αγορών τους και να βρίσκουν την οικονομικότερη λύση.

---

## 🌟 Κύρια Χαρακτηριστικά

*   **🔍 Έξυπνη Αναζήτηση & Κατηγοριοποίηση**: Αναζήτηση προϊόντων σε πραγματικό χρόνο με φιλτράρισμα ανά κύριες κατηγορίες και υποκατηγορίες.
*   **📷 Σάρωση Barcode (Barcode Scanner)**: Δυνατότητα σάρωσης του γραμμωτού κώδικα (barcode - EAN) των προϊόντων μέσω της κάμερας της κινητής συσκευής (ή με χειροκίνητη πληκτρολόγηση EAN) για αστραπιαία εύρεση και σύγκριση τιμών σε πραγματικό χρόνο. Χρησιμοποιεί το **html5-qrcode** με fallback στο native API `BarcodeDetector` του browser για hardware-accelerated decoding.
*   **📊 Πίνακας Σύγκρισης Τιμών (Matrix)**: Δείτε με μια ματιά τις τιμές των αγαπημένων σας προϊόντων σε όλα τα διαθέσιμα σούπερ μάρκετ, με επισήμανση της φθηνότερης επιλογής.
*   **🗂️ Διαχωρισμός Pantry List & Active Basket**: Διαχωρισμός της μόνιμης λίστας συχνών αγορών («Pantry List») από το τρέχον ενεργό καλάθι. Ο χρήστης μπορεί να διατηρεί μια βιβλιοθήκη με αγαπημένα προϊόντα και να επιλέγει ποια από αυτά θέλει να μεταφέρει στο ενεργό καλάθι για σύγκριση τιμών. Οι αλγόριθμοι βελτιστοποίησης (Single Store / Split-Trip) λειτουργούν αυτόματα και αποκλειστικά με το ενεργό καλάθι.
*   **🛒 Μηχανή Βελτιστοποίησης Καλαθιού (Basket Optimization Engine)**:
    *   **Αγορά από 1 Σούπερ Μάρκετ (Single Store)**: Υπολογισμός του συνολικού κόστους για όλα τα επιλεγμένα προϊόντα σε ένα μόνο κατάστημα (εμφανίζεται μόνο αν το κατάστημα διαθέτει το 100% των προϊόντων του καλαθιού σας).
    *   **Βέλτιστος Διαμοιρασμός (Split-Trip)**: Διαχωρισμός της λίστας στα καταστήματα με τις χαμηλότερες τιμές ανά προϊόν για τη μέγιστη δυνατή εξοικονόμηση. Εμφανίζει λεπτομερή κατανομή ανά κατάστημα με υποσύνολο, κέρδος εξοικονόμησης, ποσοστό κάλυψης, και διαδραστικό checklist.
*   **🔔 Ειδοποιήσεις Προσφορών (Sale Alerts & Web Push)**: Δυνατότητα εγγραφής σε Web Push notifications. Το σύστημα ελέγχει στο background τις τιμές των προϊόντων του καλαθιού σας και στέλνει ειδοποίηση εάν κάποιο προϊόν εμφανίσει έκπτωση ή χαμηλότερη τιμή.
*   **🛒 e-Shop Order Helper (Βοηθός Παραγγελίας e-Shop)**: Δυνατότητα γρήγορης εύρεσης και προσθήκης των προϊόντων του καλαθιού στα επίσημα online e-shops των supermarkets μέσω EAN barcode deep-linking ή ονομασίας (fallback).
*   **🗺️ Εύρεση Πλησιέστερου Καταστήματος (Χάρτης)**: Με ένα κλικ πάνω σε οποιοδήποτε σούπερ μάρκετ, η εφαρμογή εντοπίζει την τοποθεσία σας και εμφανίζει το πλησιέστερο φυσικό κατάστημα σε ενσωματωμένο χάρτη της Google, με δυνατότητα άμεσης πλοήγησης (GPS directions).
*   **💬 Κοινοποίηση Λίστας**: Δυνατότητα αντιγραφής της λίστας αγορών σε απλή μορφή κειμένου (κατάλληλη για αποστολή σε Viber, WhatsApp, SMS) ή παραγωγής Web Link για εισαγωγή της λίστας σε άλλη συσκευή.
*   **🌐 Πολυγλωσσικότητα & Οδηγός Χρήσης**: Πλήρης υποστήριξη ελληνικών και αγγλικών (multilingual toggle) στην εφαρμογή και στον ενσωματωμένο **Οδηγό Χρήσης & Δυνατοτήτων** (`/guide`).
*   **🌓 Μοντέρνος Σχεδιασμός**: Responsive UI με απαλά border εφέ, frosted glass αισθητική, bottom navigation bar για χρήση ως native mobile app, και υποστήριξη manual εναλλαγής μεταξύ Light και Dark theme.

---

## 🛠️ Τεχνολογίες (Tech Stack)

*   **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
*   **Γλώσσα**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (CSS-first configuration, tokens και dark mode στο `src/app/globals.css`)
*   **Εικονίδια**: [Lucide React](https://lucide.dev/)
*   **Σάρωση Barcode**: [html5-qrcode](https://github.com/mebjas/html5-qrcode)
*   **Push Notifications**: Native Service Worker & Web Push API (με βιβλιοθήκη `web-push` στο backend)
*   **Βάση Δεδομένων / Persistence**: Redis (μέσω Upstash KV API) για την αποθήκευση των Push Subscriptions, και `localStorage` στον client για τα προϊόντα του καλαθιού και τις προτιμήσεις του χρήστη.

---

## 📁 Δομή Φακέλων

```text
kallathaki-app/
├── docs/
│   └── products/              # Σχεδιασμός & Φιλοσοφία Προϊόντος (Phase 2 & 3)
├── src/
│   ├── app/
│   │   ├── api/               # API Proxy (CORS bypass) & Web Push endpoints
│   │   │   ├── [...path]/     # Δυναμικό API proxy για το posokanei.gov.gr
│   │   │   └── push/          # Διαχείριση Web Push notifications & Sale checks
│   │   ├── guide/             # Σελίδα Οδηγού Χρήσης (Greek/English)
│   │   ├── globals.css        # Tailwind v4 configuration, theme variables & themes
│   │   ├── layout.tsx         # Root Layout
   │   │   └── page.tsx           # Κύριο Application Shell & Logic
│   ├── components/            # Διακριτά components της εφαρμογής
│   │   ├── BarcodeScannerModal.tsx
│   │   ├── EShopHelperModal.tsx
│   │   └── FavoritesView.tsx  # modular UI για Αγαπημένα & Basket Optimizer
│   └── lib/                   # Utility helpers & push configuration
│       ├── push-store.ts      # Αποθήκευση/ανάκτηση push subscriptions (Redis/local file fallback)
│       ├── push-types.ts      # TypeScript interfaces για Web Push
│       └── sale-alerts.ts     # Αλγόριθμος εντοπισμού προσφορών καλαθιού
├── public/                    # Στατικά αρχεία (εικόνες, logos)
├── package.json               # Dependencies & scripts
└── README.md                  # Τεκμηρίωση εφαρμογής
```

---

## 🔒 Ασφάλεια & CORS Proxy

Η εφαρμογή χρησιμοποιεί έναν εσωτερικό proxy (Next.js Route Handler) για να προωθεί τα αιτήματα αναζήτησης στο `api.posokanei.gov.gr` προσθέτοντας τα απαραίτητα `Origin` και `Referer` headers. Αυτό είναι απαραίτητο καθώς το επίσημο API απορρίπτει αιτήματα που γίνονται απευθείας από τον browser λόγω CORS πολιτικών. 

---

## 📋 Αρχιτεκτονικοί Κανόνες & Περιορισμοί (Project Constraints)

Οι παρακάτω κανόνες ισχύουν για την ανάπτυξη και συντήρηση της εφαρμογής:

1.  **API Proxy**: Κάθε αίτημα προς το `api.posokanei.gov.gr` **πρέπει** να περνάει από το `/api/[...path]` route handler.
2.  **Tailwind CSS v4**: Μη δημιουργείτε `tailwind.config.js` ή `tailwind.config.ts`. Όλα τα tokens και custom rules (όπως dark mode) ορίζονται στο `src/app/globals.css` με το directive `@theme`.
3.  **Υποστηριζόμενα Supermarkets**: `lidl`, `masoutis`, `ab_vasilopoulos`, `mymarket`, `sklavenitis`, `kritikos`.
4.  **Maps Integration**: Δεν χρησιμοποιούμε εξωτερικές JS βιβλιοθήκες χαρτών (π.χ. Leaflet) για να διατηρήσουμε το build lightweight. Η τοποθεσία και η πλοήγηση επιλύονται με custom iframe Google Maps query χρησιμοποιώντας συντεταγμένες GPS.
5.  **Hydration Mismatch**: Για στοιχεία που βασίζονται σε client-side APIs (`window.location`, `localStorage`, κλπ.), χρησιμοποιούμε `mounted` lifecycle flag για να αποφύγουμε warnings κατά το Server-Side Rendering (SSR).

---

## 📝 Πληροφορίες Υλοποίησης e-Shop Order Helper & Barcode Fallbacks

### Προδιαγραφές Συνδέσμων e-Shop (Search Deep Links)
*   **Σκλαβενίτης**: `https://www.sklavenitis.gr/apotelesmata-anazitisis/?Query={query}` (Χρησιμοποιεί `Query` με κεφαλαίο **Q**, όχι `search`).
*   **ΑΒ Βασιλόπουλος**: `https://www.ab.gr/search?q={query}`
*   **MyMarket**: `https://www.mymarket.gr/search?query={query}`
*   **Κρητικός**: `https://eshop.kritikos-sm.gr/anazitisi?q={query}`
*   **Μασούτης**: `https://www.masoutis.gr/categories/index/search?text={query}`
*   **Lidl**: `https://www.lidl-hellas.gr/q/search?q={query}`

### Διαχείριση Barcode vs Fallback
Το API του PosoKanei (εξέλιξη του e-Katanalotis) **δεν** επιστρέφει το barcode (EAN) κατά την περιήγηση κατηγοριών ή την αναζήτηση κειμένου (επιστρέφει μόνο το UUID). 

Για τον λόγο αυτό, αποθηκεύουμε το barcode στο αντικείμενο του προϊόντος κατά τη σάρωση (`handleBarcodeScanSuccess`), και όταν αυτό δεν υπάρχει (π.χ. προσθήκη από κατηγορία), χρησιμοποιούμε ως fallback το συνδυασμό `Brand + Name` με έλεγχο ασφαλείας να μην γίνει αναζήτηση εάν το κείμενο είναι μικρότερο από 3 χαρακτήρες.
