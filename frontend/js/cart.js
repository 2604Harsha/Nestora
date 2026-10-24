/* NESTORA cart: server-side for signed-in users, localStorage for guests. */
(function () {
    "use strict";

    const CART_STORAGE_KEY = "nestora_cart_v1";
    let cart = [];

    function getProductsList() {
        return Array.isArray(window.products) ? window.products : [];
    }

    function getAuthSession() {
        try {
            return typeof window.getAuthSession === "function"
                ? window.getAuthSession()
                : null;
        } catch {
            return null;
        }
    }

    function isSignedIn() {
        return Boolean(getAuthSession()?.token);
    }

    function loadGuestCart() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(CART_STORAGE_KEY) || "[]"
            );

            if (!Array.isArray(saved)) return [];

            return saved
                .filter(item =>
                    Number.isInteger(Number(item.id)) &&
                    Number.isInteger(Number(item.quantity)) &&
                    Number(item.quantity) > 0
                )
                .map(item => ({
                    id: Number(item.id),
                    quantity: Number(item.quantity)
                }));
        } catch (error) {
            console.error("Unable to read guest cart:", error);
            return [];
        }
    }

    function saveGuestCart() {
        try {
            localStorage.setItem(
                CART_STORAGE_KEY,
                JSON.stringify(cart)
            );
        } catch (error) {
            console.error("Unable to save guest cart:", error);
            window.showToast?.("Unable to save your cart in this browser.");
        }
    }

    function getCartItemCount() {
        return cart.reduce(
            (total, item) => total + Number(item.quantity),
            0
        );
    }

    function getCartSubtotal() {
        const products = getProductsList();

        return cart.reduce((total, item) => {
            const product = products.find(
                product => Number(product.id) === Number(item.id)
            );

            return product
                ? total + Number(product.price) * Number(item.quantity)
                : total;
        }, 0);
    }

    // NEW: Expose full cart items for checkout.js.
    function getCartItems() {
        const products = getProductsList();

        return cart.map(item => {
            const product = products.find(
                product => Number(product.id) === Number(item.id)
            );

            if (!product) return null;

            return {
                ...product,
                id: Number(product.id),
                quantity: Number(item.quantity),
                price: Number(product.price) || 0
            };
        }).filter(Boolean);
    }

    async function loadCartFromApi() {
        if (typeof window.apiRequest !== "function") {
            throw new Error("API client is not loaded.");
        }

        const response = await window.apiRequest("/cart");

        const items = Array.isArray(response?.items)
            ? response.items
            : Array.isArray(response?.cart?.items)
                ? response.cart.items
                : [];

        cart = items.map(item => ({
            id: Number(
                item.productId ??
                item.product_id ??
                item.product?.id ??
                item.id
            ),
            quantity: Number(item.quantity)
        })).filter(item =>
            Number.isInteger(item.id) &&
            item.id > 0 &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0
        );

        renderCart();
        return getCartItems();
    }

    async function syncGuestCartToApi() {
        if (!isSignedIn()) return;

        const guestCart = loadGuestCart();

        for (const item of guestCart) {
            await window.apiRequest("/cart", {
                method: "POST",
                body: JSON.stringify({
                    productId: item.id,
                    quantity: item.quantity
                })
            });
        }

        localStorage.removeItem(CART_STORAGE_KEY);
        await loadCartFromApi();
    }

    async function refreshCartForSession() {
        if (isSignedIn()) {
            try {
                await loadCartFromApi();
            } catch (error) {
                console.error("Unable to load server cart:", error);
                cart = [];
                renderCart();
                window.showToast?.(error.message);
            }
        } else {
            cart = loadGuestCart();
            renderCart();
        }
    }

    async function addToCart(productId, quantity = 1) {
        const products = getProductsList();
        const product = products.find(
            item => Number(item.id) === Number(productId)
        );

        if (!product) {
            window.showToast?.("Product not found. Please reload the products.");
            return;
        }

        quantity = Number(quantity);

        if (!Number.isInteger(quantity) || quantity < 1) {
            window.showToast?.("Invalid product quantity.");
            return;
        }

        if (Number(product.stock) <= 0) {
            window.showToast?.("Sorry, this product is out of stock.");
            return;
        }

        if (isSignedIn()) {
            try {
                await window.apiRequest("/cart", {
                    method: "POST",
                    body: JSON.stringify({
                        productId: Number(productId),
                        quantity
                    })
                });

                await loadCartFromApi();
                window.showToast?.(`${product.name} added to your cart.`);
            } catch (error) {
                window.showToast?.(error.message);
            }

            return;
        }

        const existing = cart.find(
            item => item.id === Number(productId)
        );

        const nextQuantity = (existing?.quantity || 0) + quantity;

        if (product.stock != null && nextQuantity > Number(product.stock)) {
            window.showToast?.(
                `Only ${product.stock} item(s) are available.`
            );
            return;
        }

        if (existing) {
            existing.quantity = nextQuantity;
        } else {
            cart.push({
                id: Number(productId),
                quantity
            });
        }

        saveGuestCart();
        renderCart();

        window.showToast?.(
            `${product.name} added to your cart. Sign in at checkout to sync it.`
        );
    }

    async function updateCartQuantity(productId, change) {
        const item = cart.find(
            item => item.id === Number(productId)
        );

        if (!item) return;

        const nextQuantity = item.quantity + Number(change);

        if (nextQuantity <= 0) {
            await removeFromCart(productId);
            return;
        }

        const product = getProductsList().find(
            product => Number(product.id) === Number(productId)
        );

        if (
            product &&
            product.stock != null &&
            nextQuantity > Number(product.stock)
        ) {
            window.showToast?.(
                `Only ${product.stock} item(s) are available.`
            );
            return;
        }

        if (isSignedIn()) {
            try {
                await window.apiRequest(`/cart/${productId}`, {
                    method: "PATCH",
                    body: JSON.stringify({ quantity: nextQuantity })
                });

                await loadCartFromApi();
            } catch (error) {
                window.showToast?.(error.message);
            }
        } else {
            item.quantity = nextQuantity;
            saveGuestCart();
            renderCart();
        }
    }

    async function removeFromCart(productId) {
        if (isSignedIn()) {
            try {
                await window.apiRequest(`/cart/${productId}`, {
                    method: "DELETE"
                });

                await loadCartFromApi();
                window.showToast?.("Item removed from your cart.");
            } catch (error) {
                window.showToast?.(error.message);
            }
        } else {
            cart = cart.filter(
                item => item.id !== Number(productId)
            );

            saveGuestCart();
            renderCart();
            window.showToast?.("Item removed from your cart.");
        }
    }

    // NEW: clear the current cart after a successful order.
    async function clearCart() {
        if (isSignedIn()) {
            // The backend order route should clear its cart after
            // committing the order. Reload the server cart here.
            await loadCartFromApi();
            return;
        }

        cart = [];
        saveGuestCart();
        renderCart();
    }

    function escapeHTML(value) {
        if (typeof window.escapeHTML === "function") {
            return window.escapeHTML(String(value ?? ""));
        }

        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function formatPrice(value) {
        if (typeof window.formatPrice === "function") {
            return window.formatPrice(value);
        }

        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(Number(value) || 0);
    }

    function renderCart() {
        const products = getProductsList();

        const itemsElement = document.getElementById("cartItems");
        const emptyElement = document.getElementById("cartEmpty");
        const summaryElement = document.getElementById("cartSummary");
        const countElement = document.getElementById("cartCount");
        const drawerCountElement = document.getElementById("drawerCartCount");
        const subtotalElement = document.getElementById("cartSubtotal");
        const totalElement = document.getElementById("cartTotal");
        const checkoutButton = document.getElementById("checkoutButton");

        if (!itemsElement) return;

        const validItems = cart.filter(item =>
            products.some(product =>
                Number(product.id) === Number(item.id)
            )
        );

        const count = getCartItemCount();
        const subtotal = getCartSubtotal();

        if (countElement) {
            countElement.textContent = count;
            countElement.setAttribute(
                "aria-label",
                `${count} items in cart`
            );
        }

        if (drawerCountElement) {
            drawerCountElement.textContent = `(${count})`;
        }

        if (!validItems.length) {
            itemsElement.innerHTML = "";
            if (emptyElement) emptyElement.hidden = false;
            if (summaryElement) summaryElement.hidden = true;
            if (checkoutButton) checkoutButton.disabled = true;
        } else {
            if (emptyElement) emptyElement.hidden = true;
            if (summaryElement) summaryElement.hidden = false;
            if (checkoutButton) checkoutButton.disabled = false;

            itemsElement.innerHTML = validItems.map(item => {
                const product = products.find(
                    product => Number(product.id) === Number(item.id)
                );

                return `
                    <article class="cart-item">
                        <img
                            src="${escapeHTML(product.image)}"
                            alt="${escapeHTML(product.name)}"
                            onerror="this.onerror=null;this.src='https://placehold.co/100x100/f0f3fa/526080?text=Product';"
                        >
                        <div class="cart-item-details">
                            <h4>${escapeHTML(product.name)}</h4>
                            <div class="cart-item-price">
                                ${formatPrice(product.price * item.quantity)}
                            </div>
                            <div class="cart-item-bottom">
                                <div class="quantity-control">
                                    <button
                                        type="button"
                                        data-cart-action="decrease"
                                        data-id="${product.id}"
                                        aria-label="Decrease quantity"
                                    >−</button>
                                    <span>${item.quantity}</span>
                                    <button
                                        type="button"
                                        data-cart-action="increase"
                                        data-id="${product.id}"
                                        aria-label="Increase quantity"
                                    >+</button>
                                </div>
                                <button
                                    type="button"
                                    class="remove-item"
                                    data-cart-action="remove"
                                    data-id="${product.id}"
                                >Remove</button>
                            </div>
                        </div>
                    </article>
                `;
            }).join("");
        }

        if (subtotalElement) {
            subtotalElement.textContent = formatPrice(subtotal);
        }

        if (totalElement) {
            totalElement.textContent = formatPrice(subtotal);
        }
    }

    // Public functions used by app.js and checkout.js.
    window.getCartItemCount = getCartItemCount;
    window.getCartSubtotal = getCartSubtotal;
    window.getCartItems = getCartItems;
    window.loadCartFromApi = loadCartFromApi;
    window.syncGuestCartToApi = syncGuestCartToApi;
    window.refreshCartForSession = refreshCartForSession;
    window.addToCart = addToCart;
    window.updateCartQuantity = updateCartQuantity;
    window.removeFromCart = removeFromCart;
    window.clearCart = clearCart;
    window.renderCart = renderCart;

    const cartItemsElement = document.getElementById("cartItems");

    if (cartItemsElement) {
        cartItemsElement.addEventListener("click", async event => {
            const button = event.target.closest("[data-cart-action]");
            if (!button) return;

            const id = Number(button.dataset.id);

            if (button.dataset.cartAction === "increase") {
                await updateCartQuantity(id, 1);
            } else if (button.dataset.cartAction === "decrease") {
                await updateCartQuantity(id, -1);
            } else if (button.dataset.cartAction === "remove") {
                await removeFromCart(id);
            }
        });
    }
})();