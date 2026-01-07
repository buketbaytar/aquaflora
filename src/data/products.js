export const products = [
    // --- Tüplü Dalış (Scuba) ---
    {
        id: 101,
        name: "Aqualung Pro X BCD",
        category: "Tüplü Dalış",
        subCategory: "BC (Denge Yeleği)",
        brand: "Aqualung",
        price: "18.500 ₺",
        image: "https://images.unsplash.com/photo-1570174084152-32aeb4e7c7a8?q=80&w=2070&auto=format&fit=crop",
        video: "https://videos.pexels.com/video-files/4553259/4553259-sd_640_360_25fps.mp4",
        specs: { material: "Cordura 1000D", weight: "3.2kg", lift: "150N" }
    },
    {
        id: 102,
        name: "Suunto D5 Dalış Bilgisayarı",
        category: "Tüplü Dalış",
        subCategory: "Dalış Bilgisayarı",
        brand: "Suunto",
        price: "24.000 ₺",
        image: "https://images.unsplash.com/photo-1533234978939-9a5cf44c062c?q=80&w=1968&auto=format&fit=crop", // Watch placeholder
        video: "https://videos.pexels.com/video-files/855018/855018-hd_1280_720_30fps.mp4",
        specs: { display: "Color MIP", depth: "100m", connectivity: "Bluetooth" }
    },
    {
        id: 103,
        name: "Mares Abyss 22 Regülatör",
        category: "Tüplü Dalış",
        subCategory: "Regülatör",
        brand: "Mares",
        price: "14.250 ₺",
        image: "https://images.unsplash.com/photo-1682687220208-22d2899825d1?q=80&w=1000&auto=format&fit=crop", // Abstract deep sea gear feel
        video: "https://videos.pexels.com/video-files/3043690/3043690-hd_1280_720_24fps.mp4",
        specs: { type: "Diaphragm", coldWater: "Yes", ports: "2 HP / 4 LP" }
    },

    // --- Serbest Dalış & Zıpkın ---
    {
        id: 201,
        name: "Carbon Spear 500",
        category: "Serbest Dalış & Zıpkın",
        subCategory: "Zıpkınlar",
        brand: "Pathos",
        price: "8.500 ₺",
        image: "https://images.unsplash.com/photo-1627993072212-0f0c05ba683f?q=80&w=2072&auto=format&fit=crop",
        video: "https://videos.pexels.com/video-files/854297/854297-hd_1280_720_30fps.mp4",
        specs: { material: "100% Carbon", length: "100cm", bands: "Dual 16mm" }
    },
    {
        id: 202,
        name: "Omer Holo Stone Wetsuit 5mm",
        category: "Serbest Dalış & Zıpkın",
        subCategory: "Elbiseler",
        brand: "Omer",
        price: "7.800 ₺",
        image: "https://images.unsplash.com/photo-1544551763-46a8723ba3f9?q=80&w=2070&auto=format&fit=crop",
        video: "https://videos.pexels.com/video-files/7565439/7565439-sd_640_360_25fps.mp4",
        specs: { thickness: "5mm", type: "Open Cell", camouflage: "3D Rock" }
    },

    // --- Yüzme ---
    {
        id: 301,
        name: "Speedo Fastskin Goggles",
        category: "Yüzme",
        subCategory: "Gözlük",
        brand: "Speedo",
        price: "2.100 ₺",
        image: "https://images.unsplash.com/photo-1622345053704-585802524f2b?q=80&w=2070&auto=format&fit=crop",
        video: "https://videos.pexels.com/video-files/4827054/4827054-sd_640_360_25fps.mp4",
        specs: { lens: "Mirrored", antiFog: "Yes", strap: "Double Silicone" }
    },

    // --- Kamp & Outdoor ---
    {
        id: 401,
        name: "Husky Fighter 3 Çadır",
        category: "Kamp & Outdoor",
        subCategory: "Çadır",
        brand: "Husky",
        price: "9.600 ₺",
        image: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?q=80&w=2070&auto=format&fit=crop",
        video: "https://videos.pexels.com/video-files/2418386/2418386-hd_1280_720_24fps.mp4",
        specs: { capacity: "3 Person", weight: "4.5kg", season: "4 Season" }
    },
    {
        id: 402,
        name: "Stanley Klasik Termos 1.9L",
        category: "Kamp & Outdoor",
        subCategory: "Mutfak",
        brand: "Stanley",
        price: "2.750 ₺",
        image: "https://images.unsplash.com/photo-1517036662492-c96766442646?q=80&w=2070&auto=format&fit=crop", // Camping coffee vibe
        video: "https://videos.pexels.com/video-files/4552086/4552086-sd_640_360_25fps.mp4", // Camping video
        specs: { volume: "1.9L", retention: "48h Hot/Cold", material: "Stainless Steel" }
    }
];

export const categories = [
    {
        id: "scuba",
        title: "Tüplü Dalış",
        sub: ["BC (Denge Yeleği)", "Regülatör", "Dalış Bilgisayarı", "Elbiseler", "Maske & Palet"]
    },
    {
        id: "freedive",
        title: "Serbest Dalış & Zıpkın",
        sub: ["Zıpkınlar", "Elbiseler", "Paletler", "Maske & Şnorkel", "Aksesuarlar"]
    },
    {
        id: "swim",
        title: "Yüzme",
        sub: ["Mayo", "Gözlük", "Bone", "Antrenman", "Terlik & Havlu"]
    },
    {
        id: "outdoor",
        title: "Kamp & Outdoor",
        sub: ["Çadır", "Uyku Tulumu", "Mutfak", "Giyim", "Ayakkabı"]
    }
];
