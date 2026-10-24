/* NESTORA product catalogue */
(function () {
    "use strict";

    window.products = [];

    const PLACEHOLDER_IMAGE =
        "https://placehold.co/600x600/f0f3fa/526080?text=Product";

    function getProductImageUrl(item) {
        const rawImage =
            item.imageUrl ??
            item.image_url ??
            item.image ??
            item.photo ??
            item.product_image ??
            "";

        const image = String(rawImage).trim();

        if (!image) return PLACEHOLDER_IMAGE;

        if (/^(https?:\/\/|data:image\/|blob:)/i.test(image)) {
            return image;
        }

        const apiBase =
            window.API_BASE_URL || "http://localhost:5000/api";

        const origin = new URL(apiBase).origin;

        if (image.startsWith("/")) {
            return `${origin}${image}`;
        }

        return `${origin}/${image.replace(/^\/+/, "")}`;
    }

    function mapApiProduct(item) {
        const price = Number(item.price) || 0;

        const originalPrice =
            Number(item.originalPrice ?? item.original_price ?? price) ||
            price;

        const discount =
            originalPrice > 0
                ? Math.max(
                      0,
                      Math.round(
                          ((originalPrice - price) / originalPrice) * 100
                      )
                  )
                : 0;

        return {
            id: Number(item.id),
            name: item.name || "Product",
            description: item.description || "",
            category: item.category || "Other",
            price,
            originalPrice,
            rating: Number(item.rating) || 0,
            reviews: Number(item.reviews ?? item.reviewCount ?? 0),
            discount,
            badge: item.badge || (discount >= 40 ? "HOT DEAL" : "POPULAR"),
            image: getProductImageUrl(item),
            stock: Number(item.stock ?? 0)
        };
    }

    async function loadProductsFromApi() {
        if (typeof window.apiRequest !== "function") {
            throw new Error(
                "API client missing. Check frontend/js/api.js."
            );
        }

        const response = await window.apiRequest(
            "/products?limit=50&page=1&sort=featured"
        );

        console.log("NESTORA products API response:", response);

        let list;

        if (Array.isArray(response)) {
            list = response;
        } else if (Array.isArray(response?.products)) {
            list = response.products;
        } else if (Array.isArray(response?.data?.products)) {
            list = response.data.products;
        } else if (Array.isArray(response?.data)) {
            list = response.data;
        } else {
            throw new Error(
                "Product API returned an unexpected response. Check the backend."
            );
        }

        window.products = list
            .map(mapApiProduct)
            .filter(product => Number.isFinite(product.id) && product.id > 0);

        console.log("Products loaded:", window.products.length);
        console.table(window.products);

        return window.products;
    }

    function getProducts() {
        return window.products;
    }

    function getProductById(id) {
        return window.products.find(
            product => product.id === Number(id)
        ) || null;
    }

    function handleProductImageError(img) {
        if (img.dataset.fallbackApplied === "true") return;

        img.dataset.fallbackApplied = "true";
        img.src = PLACEHOLDER_IMAGE;
    }

    window.getProductImageUrl = getProductImageUrl;
    window.mapApiProduct = mapApiProduct;
    window.loadProductsFromApi = loadProductsFromApi;
    window.getProducts = getProducts;
    window.getProductById = getProductById;
    window.handleProductImageError = handleProductImageError;
})();