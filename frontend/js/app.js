/* NESTORA storefront: API-connected interactions. Existing CSS is unchanged. */
const productGrid = document.getElementById("productGrid");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchCategory = document.getElementById("searchCategory");
const sortSelect = document.getElementById("sortSelect");
const emptyState = document.getElementById("emptyState");
const clearFiltersButton = document.getElementById("clearFiltersButton");
const loadMoreButton = document.getElementById("loadMoreButton");
const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");
const cartButton = document.getElementById("cartButton");
const closeCartButton = document.getElementById("closeCartButton");
const continueShoppingButton = document.getElementById("continueShoppingButton");
const authDialog = document.getElementById("authDialog");
const checkoutDialog = document.getElementById("checkoutDialog");

let activeCategory = "all";
let searchTerm = "";
let sortOption = "featured";
let visibleProductCount = 8;
let toastTimeout;
let authMode = "login";
const favourites = new Set();

function formatPrice(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 0
    }).format(Number(amount) || 0);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 3000);
}

function getFilteredProducts() {
    let result = [...window.products];
    if (activeCategory !== "all") result = result.filter(p => p.category === activeCategory);
    if (searchTerm) {
        result = result.filter(p =>
            `${p.name} ${p.category} ${p.badge} ${p.description}`.toLowerCase().includes(searchTerm)
        );
    }
    switch (sortOption) {
        case "price-low": result.sort((a, b) => a.price - b.price); break;
        case "price-high": result.sort((a, b) => b.price - a.price); break;
        case "rating": result.sort((a, b) => b.rating - a.rating); break;
        case "discount": result.sort((a, b) => b.discount - a.discount); break;
    }
    return result;
}

function createProductCard(product) {
    const badgeClass = product.badge === "NEW" ? "new" : product.badge === "POPULAR" ? "popular" : "";
    const isFavourite = favourites.has(product.id);
    const stockText = product.stock > 0 ? "✓ Delivery options at checkout" : "Currently out of stock";
    return `
        <article class="product-card">
            <div class="product-image-wrap">
                <span class="product-badge ${badgeClass}">${escapeHTML(product.badge)}</span>
                <button class="wishlist-button ${isFavourite ? "is-favourite" : ""}" type="button"
                    data-action="favourite" data-id="${product.id}"
                    aria-label="${isFavourite ? "Remove from" : "Add to"} favourites"
                    aria-pressed="${isFavourite}">${isFavourite ? "♥" : "♡"}</button>
                <img class="product-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}"
                    loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/400x400/f0f3fa/526080?text=Product';">
            </div>
            <div class="product-info">
                <span class="product-category">${escapeHTML(product.category)}</span>
                <h3 class="product-name">${escapeHTML(product.name)}</h3>
                <div class="product-rating">
                    <span class="rating-pill">${product.rating.toFixed(1)} <span>★</span></span>
                    <span class="rating-count">(${Number(product.reviews || 0).toLocaleString("en-IN")})</span>
                </div>
                <div class="product-pricing">
                    <span class="current-price">${formatPrice(product.price)}</span>
                    <span class="original-price">${formatPrice(product.originalPrice)}</span>
                    <span class="discount-text">${product.discount}% off</span>
                </div>
                <p class="delivery-text">${stockText}</p>
                <div class="product-card-actions">
                    <button class="add-cart-button" type="button" data-action="add" data-id="${product.id}"
                        ${product.stock <= 0 ? "disabled" : ""}>＋ Add to cart</button>
                    <button class="quick-buy-button" type="button" data-action="quick-buy" data-id="${product.id}"
                        aria-label="Add ${escapeHTML(product.name)} and open cart" title="Quick add"
                        ${product.stock <= 0 ? "disabled" : ""}>↗</button>
                </div>
            </div>
        </article>`;
}

function renderProducts() {
    const filtered = getFilteredProducts();
    productGrid.innerHTML = filtered.slice(0, visibleProductCount).map(createProductCard).join("");
    emptyState.hidden = filtered.length !== 0;
    productGrid.hidden = filtered.length === 0;
    loadMoreButton.hidden = filtered.length <= visibleProductCount;
    updateFilterButtons();
    updateProductHeading();
}

function updateFilterButtons() {
    document.querySelectorAll("[data-category]").forEach(button => {
        const active = button.dataset.category === activeCategory;
        if (button.classList.contains("filter-chip")) button.classList.toggle("selected", active);
        if (button.classList.contains("nav-category")) button.classList.toggle("active", active);
    });
}

function updateProductHeading() {
    const title = document.getElementById("productSectionTitle");
    const subtitle = document.getElementById("productSectionSubtitle");
    if (searchTerm) {
        title.textContent = `Results for "${searchTerm}"`;
        subtitle.textContent = "Products matching your search.";
    } else if (activeCategory !== "all") {
        title.textContent = activeCategory === "Home" ? "Home & Living" : activeCategory;
        subtitle.textContent = `Discover our ${activeCategory.toLowerCase()} collection.`;
    } else {
        title.innerHTML = 'Trending right now <span>✦</span>';
        subtitle.textContent = "Popular picks people are loving today.";
    }
}

function setCategory(category) {
    activeCategory = category;
    searchCategory.value = category === "all" ? "all" : category;
    visibleProductCount = 8;
    renderProducts();
    document.getElementById("products").scrollIntoView({ behavior: "smooth", block: "start" });
}

searchForm.addEventListener("submit", event => {
    event.preventDefault();
    searchTerm = searchInput.value.trim().toLowerCase();
    activeCategory = searchCategory.value === "all" ? "all" : searchCategory.value;
    visibleProductCount = 8;
    renderProducts();
    document.getElementById("products").scrollIntoView({ behavior: "smooth", block: "start" });
});
searchInput.addEventListener("input", () => {
    if (!searchInput.value.trim()) { searchTerm = ""; visibleProductCount = 8; renderProducts(); }
});
searchCategory.addEventListener("change", () => {
    activeCategory = searchCategory.value;
    visibleProductCount = 8;
    renderProducts();
});
document.querySelectorAll(".nav-category, .category-tile, .filter-chip").forEach(button => {
    button.addEventListener("click", event => {
        event.preventDefault();
        searchTerm = "";
        searchInput.value = "";
        setCategory(button.dataset.category || "all");
    });
});
document.querySelectorAll("[data-footer-category]").forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();
        searchTerm = "";
        searchInput.value = "";
        setCategory(link.dataset.footerCategory);
    });
});
sortSelect.addEventListener("change", () => { sortOption = sortSelect.value; visibleProductCount = 8; renderProducts(); });
loadMoreButton.addEventListener("click", () => { visibleProductCount += 4; renderProducts(); });
clearFiltersButton.addEventListener("click", () => {
    activeCategory = "all"; searchTerm = ""; sortOption = "featured"; visibleProductCount = 8;
    searchInput.value = ""; searchCategory.value = "all"; sortSelect.value = "featured";
    renderProducts();
});

productGrid.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = Number(button.dataset.id);
    const product = window.products.find(item => item.id === id);
    if (!product) return showToast("Product not found.");
    if (button.dataset.action === "add") await addToCart(id);
    if (button.dataset.action === "quick-buy") { await addToCart(id); openCart(); }
    if (button.dataset.action === "favourite") {
        if (favourites.has(id)) { favourites.delete(id); showToast("Removed from favourites."); }
        else { favourites.add(id); showToast("Added to favourites."); }
        renderProducts();
    }
});

function openCart() {
    cartDrawer.classList.add("open");
    cartOverlay.classList.add("open");
    cartDrawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    closeCartButton.focus();
}
function closeCart() {
    cartDrawer.classList.remove("open");
    cartOverlay.classList.remove("open");
    cartDrawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}
cartButton.addEventListener("click", openCart);
closeCartButton.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);
continueShoppingButton.addEventListener("click", closeCart);
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        if (cartDrawer.classList.contains("open")) closeCart();
        if (authDialog.open) authDialog.close();
        if (checkoutDialog.open) checkoutDialog.close();
    }
});

function updateAccountButton() {
    const session = getAuthSession();
    const button = document.getElementById("accountButton");
    const label = button.querySelector(".action-label");
    if (session?.user) {
        label.innerHTML = `<small>Hello, ${escapeHTML(session.user.name || "shopper")}</small><strong>Sign out</strong>`;
    } else {
        label.innerHTML = "<small>Hello, shopper</small><strong>Account</strong>";
    }
}

function openAuth(mode = "login") {
    authMode = mode;
    const isRegister = mode === "register";
    document.getElementById("authTitle").textContent = isRegister ? "Create your NESTORA account" : "Sign in to NESTORA";
    document.getElementById("authDescription").textContent = isRegister ? "Create an account to save your cart and track orders." : "Sign in to access your cart and order history.";
    document.getElementById("authName").hidden = !isRegister;
    document.getElementById("authNameLabel").hidden = !isRegister;
    document.getElementById("authName").required = isRegister;
    document.getElementById("authPassword").autocomplete = isRegister ? "new-password" : "current-password";
    document.getElementById("authSubmitButton").textContent = isRegister ? "Create account" : "Sign in";
    document.getElementById("authSwitchText").textContent = isRegister ? "Already have an account?" : "New to NESTORA?";
    document.getElementById("authSwitchButton").textContent = isRegister ? "Sign in" : "Create account";
    authDialog.showModal();
}
document.getElementById("accountButton").addEventListener("click", async () => {
    if (getAuthSession()?.token) {
        setAuthSession(null);
        cart = loadGuestCart();
        renderCart();
        updateAccountButton();
        showToast("You have been signed out.");
        return;
    }
    openAuth("login");
});
document.getElementById("closeAuthButton").addEventListener("click", () => authDialog.close());
document.getElementById("authSwitchButton").addEventListener("click", () => openAuth(authMode === "login" ? "register" : "login"));

document.getElementById("authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const name = document.getElementById("authName").value.trim();
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const path = authMode === "register" ? "/auth/register" : "/auth/login";
    const payload = authMode === "register" ? { name, email, password } : { email, password };
    const submit = document.getElementById("authSubmitButton");
    submit.disabled = true;
    try {
        const response = await apiRequest(path, { method: "POST", body: JSON.stringify(payload) });
        setAuthSession({ token: response.token, user: response.user });
        authDialog.close();
        updateAccountButton();
        await syncGuestCartToApi();
        showToast(response.message || "You are signed in.");
        await loadOrders();
    } catch (error) {
        showToast(error.message);
    } finally {
        submit.disabled = false;
    }
});

document.getElementById("checkoutButton").addEventListener("click", () => {
    // Refresh guest cart from the existing cart module.
    if (!getAuthSession()?.token && typeof loadGuestCart === "function") {
        const guestCart = loadGuestCart();

        if (Array.isArray(guestCart)) {
            cart = guestCart;
        }
    }

    // Use the cart that the storefront actually displays.
    if (!Array.isArray(cart) || cart.length === 0) {
        showToast("Your cart is empty. Please add a product first.");
        return;
    }

    // Keep your existing authentication requirement.
    if (!getAuthSession()?.token) {
        showToast("Please sign in or create an account before checkout.");
        openAuth("login");
        return;
    }

    if (checkoutDialog && !checkoutDialog.open) {
        checkoutDialog.showModal();
    }
});
document.getElementById("closeCheckoutButton").addEventListener("click", () => checkoutDialog.close());

document.getElementById("checkoutForm").addEventListener("submit", async event => {
    event.preventDefault();
    const submit = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    const payload = {
        shippingName: document.getElementById("shippingName").value.trim(),
        shippingPhone: document.getElementById("shippingPhone").value.trim(),
        shippingAddress: document.getElementById("shippingAddress").value.trim()
    };
    try {
        const response = await apiRequest("/orders", { method: "POST", body: JSON.stringify(payload) });
        checkoutDialog.close();
        closeCart();
        cart = [];
        renderCart();
        showToast(`Order #${response.order.id} placed successfully.`);
        event.currentTarget.reset();
        await loadOrders();
    } catch (error) {
        showToast(error.message);
    } finally {
        submit.disabled = false;
    }
});

async function loadOrders() {
    const ordersSection = document.getElementById("orders");
    if (!getAuthSession()?.token) {
        ordersSection.innerHTML = '<span>📦</span><div><strong>Your next order starts here.</strong><p>Sign in to view your order history.</p></div>';
        return;
    }
    try {
        const response = await apiRequest("/orders");
        const orders = response.orders || [];
        if (!orders.length) {
            ordersSection.innerHTML = '<span>📦</span><div><strong>No orders yet.</strong><p>Your completed purchases will appear here.</p></div>';
            return;
        }
        ordersSection.innerHTML = `<span>📦</span><div><strong>Your orders</strong>${orders.map(order => `
            <div style="padding:10px 0;border-top:1px solid #e9edf5;margin-top:10px">
                <strong>Order #${Number(order.id)}</strong>
                <p>Total: ${formatPrice(order.totalAmount)} · Status: ${escapeHTML(order.status)} · ${new Date(order.createdAt).toLocaleString("en-IN")}</p>
            </div>`).join("")}</div>`;
    } catch (error) {
        showToast(error.message);
    }
}

document.getElementById("newsletterForm").addEventListener("submit", event => {
    event.preventDefault();
    const email = document.getElementById("newsletterEmail");
    if (!email.checkValidity()) return email.reportValidity();
    showToast("Newsletter subscription is not configured in the provided backend yet.");
    email.value = "";
});

document.getElementById("currentYear").textContent = new Date().getFullYear();

(async function initStorefront() {
    try {
        await window.loadProductsFromApi();
        renderProducts();
        await refreshCartForSession();
        updateAccountButton();
        await loadOrders();
    } catch (error) {
        productGrid.hidden = true;
        emptyState.hidden = false;
        emptyState.querySelector("h3").textContent = "Unable to load products";
        emptyState.querySelector("p").textContent = error.message;
        showToast(error.message);
    }
})();