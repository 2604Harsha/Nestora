/* NESTORA checkout: shipping, billing, payment and order placement. */
(function () {
    "use strict";

    const $ = id => document.getElementById(id);

    let isSubmitting = false;

    function getSession() {
        try {
            return typeof window.getAuthSession === "function"
                ? window.getAuthSession()
                : null;
        } catch (error) {
            console.error("Unable to read authentication session:", error);
            return null;
        }
    }

    function getToken() {
        const session = getSession();

        if (
            session?.token ||
            session?.accessToken ||
            session?.access_token
        ) {
            return session.token ||
                session.accessToken ||
                session.access_token;
        }

        for (const key of [
            "token",
            "authToken",
            "accessToken",
            "access_token"
        ]) {
            const value = localStorage.getItem(key);
            if (!value) continue;

            try {
                const parsed = JSON.parse(value);

                if (typeof parsed === "string") return parsed;

                if (parsed && typeof parsed === "object") {
                    const token =
                        parsed.token ||
                        parsed.accessToken ||
                        parsed.access_token;

                    if (token) return token;
                }
            } catch {
                return value;
            }
        }

        return "";
    }

    async function request(endpoint, options = {}) {
        // Use the same API client as the rest of NESTORA.
        if (typeof window.apiRequest === "function") {
            return window.apiRequest(endpoint, options);
        }

        throw new Error(
            "API client is unavailable. Load api.js before checkout.js."
        );
    }

    function showError(message) {
        let error = $("checkoutError");

        if (!error) {
            error = document.createElement("div");
            error.id = "checkoutError";
            error.setAttribute("role", "alert");
            error.style.cssText =
                "margin:12px 0;padding:12px;border-radius:8px;" +
                "background:#fff0f0;color:#b42318;font-size:14px;";

            $("checkoutForm")?.prepend(error);
        }

        error.textContent = message;
        error.hidden = false;
    }

    function clearError() {
        const error = $("checkoutError");

        if (error) {
            error.textContent = "";
            error.hidden = true;
        }
    }

    function showStep(step) {
        document.querySelectorAll("#checkoutForm [data-step]")
            .forEach(section => {
                section.hidden = Number(section.dataset.step) !== step;
            });

        const titles = {
            1: "Shipping Address",
            2: "Billing Details",
            3: "Payment",
            4: "Order Confirmation"
        };

        if ($("checkoutTitle")) {
            $("checkoutTitle").textContent = titles[step] || "Checkout";
        }

        document.querySelectorAll("[data-step-indicator]")
            .forEach(indicator => {
                const number = Number(indicator.dataset.stepIndicator);

                indicator.classList.toggle("active", number === step);
                indicator.classList.toggle("completed", number < step);
            });

        clearError();
    }

    function money(amount) {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(Number(amount) || 0);
    }

    // IMPORTANT: Always read the shared cart from cart.js.
    async function getCartItems() {
        if (getToken() && typeof window.loadCartFromApi === "function") {
            await window.loadCartFromApi();
        }

        if (typeof window.getCartItems === "function") {
            return window.getCartItems();
        }

        return [];
    }

    function itemName(item) {
        return item.name ||
            item.title ||
            item.product_name ||
            item.product?.name ||
            "Product";
    }

    function itemPrice(item) {
        return Number(
            item.price ??
            item.salePrice ??
            item.sale_price ??
            item.product?.price ??
            0
        );
    }

    function itemQuantity(item) {
        return Math.max(1, Number(item.quantity ?? item.qty ?? 1));
    }

    function getSubtotal(items) {
        return items.reduce(
            (total, item) =>
                total + itemPrice(item) * itemQuantity(item),
            0
        );
    }

    async function renderOrderSummary() {
        const items = await getCartItems();
        const container = $("checkoutOrderItems");

        if (!items.length) {
            showError(
                "Your cart is empty or could not be loaded. " +
                "Close checkout, refresh the page, and try again."
            );
            return false;
        }

        if (!container) {
            showError(
                'The order summary element "checkoutOrderItems" is missing from index.html.'
            );
            return false;
        }

        container.replaceChildren();

        items.forEach(item => {
            const row = document.createElement("div");
            row.className = "checkout-item";

            const name = document.createElement("span");
            name.textContent =
                `${itemName(item)} × ${itemQuantity(item)}`;

            const price = document.createElement("strong");
            price.textContent = money(
                itemPrice(item) * itemQuantity(item)
            );

            row.append(name, price);
            container.appendChild(row);
        });

        const total = getSubtotal(items);

        if ($("checkoutSubtotal")) {
            $("checkoutSubtotal").textContent = money(total);
        }

        if ($("checkoutDelivery")) {
            $("checkoutDelivery").textContent = "FREE";
        }

        if ($("checkoutTotal")) {
            $("checkoutTotal").textContent = money(total);
        }

        if ($("paymentTotal")) {
            $("paymentTotal").textContent = money(total);
        }

        return true;
    }

    function validateFields(ids) {
        for (const id of ids) {
            const field = $(id);

            if (!field) {
                showError(`Required checkout field is missing: ${id}`);
                return false;
            }

            if (!field.checkValidity()) {
                field.reportValidity();
                return false;
            }

            if (
                typeof field.value === "string" &&
                !field.value.trim()
            ) {
                field.setCustomValidity("This field is required.");
                field.reportValidity();
                field.setCustomValidity("");
                return false;
            }
        }

        return true;
    }

    function getAddress(prefix) {
        return {
            name: $(`${prefix}Name`)?.value.trim() || "",
            address: $(`${prefix}Address`)?.value.trim() || "",
            city: $(`${prefix}City`)?.value.trim() || "",
            state: $(`${prefix}State`)?.value.trim() || "",
            pincode: $(`${prefix}Pincode`)?.value.trim() || "",
            country: $(`${prefix}Country`)?.value.trim() || "India"
        };
    }

    function copyShippingToBilling() {
        const fields = {
            billingName: "shippingName",
            billingAddress: "shippingAddress",
            billingCity: "shippingCity",
            billingState: "shippingState",
            billingPincode: "shippingPincode",
            billingCountry: "shippingCountry"
        };

        Object.entries(fields).forEach(([target, source]) => {
            if ($(target) && $(source)) {
                $(target).value = $(source).value;
            }
        });
    }

    function toggleBillingFields() {
        const same = $("sameAsShipping")?.checked ?? true;
        const container = $("billingFields");

        if (container) {
            container.hidden = same;
        }

        [
            "billingName",
            "billingAddress",
            "billingCity",
            "billingState",
            "billingPincode"
        ].forEach(id => {
            const field = $(id);

            if (field) {
                field.disabled = same;
                field.required = !same;
            }
        });

        if (same) copyShippingToBilling();
    }

    async function openCheckout(event) {
        event?.preventDefault();
        clearError();

        try {
            const items = await getCartItems();

            if (!items.length) {
                alert(
                    "Your cart could not be loaded. " +
                    "Please refresh the page and try again."
                );
                return;
            }

            if (!getToken()) {
                alert("Please sign in before proceeding to checkout.");
                return;
            }

            $("checkoutForm")?.reset();

            if ($("sameAsShipping")) {
                $("sameAsShipping").checked = true;
            }

            toggleBillingFields();

            if (!(await renderOrderSummary())) return;

            showStep(1);

            const dialog = $("checkoutDialog");

            if (dialog) {
                if (typeof dialog.showModal === "function") {
                    if (!dialog.open) dialog.showModal();
                } else {
                    dialog.style.display = "block";
                }
            } else {
                showError(
                    'The checkout dialog "checkoutDialog" is missing from index.html.'
                );
            }
        } catch (error) {
            console.error("Unable to open checkout:", error);
            alert(error.message || "Unable to load your cart.");
        }
    }

    async function placeOrder(event) {
        event.preventDefault();

        if (isSubmitting) return;

        clearError();

        if (!getToken()) {
            showError("Your login session has expired. Please sign in again.");
            return;
        }

        if (!$("acceptTerms")?.checked) {
            showError("Please confirm your shipping, billing and order details.");
            return;
        }

        const paymentMethod =
            document.querySelector(
                'input[name="paymentMethod"]:checked'
            )?.value || "cod";

        if (String(paymentMethod).toLowerCase() !== "cod") {
            showError(
                "Online payment is not integrated yet. Please select Cash on Delivery."
            );
            return;
        }

        const shipping = getAddress("shipping");
        const billing = $("sameAsShipping")?.checked
            ? { ...shipping }
            : getAddress("billing");

        const requiredShippingFields = [
            "shippingName",
            "shippingPhone",
            "shippingAddress",
            "shippingCity",
            "shippingState",
            "shippingPincode"
        ];

        if (!validateFields(requiredShippingFields)) return;

        if (
            !$("sameAsShipping")?.checked &&
            !validateFields([
                "billingName",
                "billingAddress",
                "billingCity",
                "billingState",
                "billingPincode"
            ])
        ) {
            return;
        }

        const button = $("placeOrderButton");
        isSubmitting = true;

        if (button) {
            button.disabled = true;
            button.textContent = "Placing Order...";
        }

        try {
            // Load and validate the current cart before calling the backend.
            const items = await getCartItems();

            if (!items.length) {
                throw new Error(
                    "Your cart is empty. Please return to the cart and try again."
                );
            }

            // The backend should calculate prices from its own product/cart data.
            const result = await request("/orders", {
                method: "POST",
                body: JSON.stringify({
                    shippingName: shipping.name,
                    shippingEmail: $("shippingEmail")?.value.trim() || "",
                    shippingPhone: $("shippingPhone")?.value.trim() || "",
                    shippingAddress: shipping.address,
                    shippingCity: shipping.city,
                    shippingState: shipping.state,
                    shippingPincode: shipping.pincode,
                    shippingCountry: shipping.country,
                    billingAddress: billing,
                    paymentMethod: "COD"
                })
            });

            const order = result?.order || result?.data?.order || result?.data;

            const orderId = order?.id ??
                order?.orderId ??
                order?.order_id;

            if (!orderId) {
                console.error("Unexpected order response:", result);
                throw new Error(
                    "The server did not return an order number. " +
                    "Check the backend POST /orders response."
                );
            }

            if ($("orderReference")) {
                $("orderReference").textContent = `#${orderId}`;
            }

            if ($("confirmationTotal")) {
                $("confirmationTotal").textContent = money(
                    order.totalAmount ??
                    order.total_amount ??
                    getSubtotal(items)
                );
            }

            if ($("orderConfirmationMessage")) {
                $("orderConfirmationMessage").textContent =
                    "Your order has been placed successfully.";
            }

            // Refresh cart from the server after successful order creation.
            // The backend should clear ordered cart items after committing.
            if (typeof window.loadCartFromApi === "function") {
                try {
                    await window.loadCartFromApi();
                } catch (refreshError) {
                    console.warn(
                        "Order succeeded, but cart refresh failed:",
                        refreshError
                    );
                }
            }

            if (typeof window.loadOrders === "function") {
                try {
                    await window.loadOrders();
                } catch (ordersError) {
                    console.warn("Unable to refresh order list:", ordersError);
                }
            }

            showStep(4);
        } catch (error) {
            console.error("Order placement error:", error);
            showError(
                error.message ||
                "Unable to place your order. Please try again."
            );
        } finally {
            isSubmitting = false;

            if (button) {
                button.disabled = false;
                button.textContent = "Place Order";
            }
        }
    }

    function setup() {
        const form = $("checkoutForm");

        if (!form) {
            console.error("Checkout form not found. Check index.html.");
            return;
        }

        $("checkoutButton")?.addEventListener("click", openCheckout);

        document.querySelector(
            '#checkoutForm [data-step="1"] [data-next="2"]'
        )?.addEventListener("click", async () => {
            if (!validateFields([
                "shippingName",
                "shippingEmail",
                "shippingPhone",
                "shippingAddress",
                "shippingCity",
                "shippingState",
                "shippingPincode"
            ])) {
                return;
            }

            copyShippingToBilling();
            toggleBillingFields();
            showStep(2);
        });

        $("sameAsShipping")?.addEventListener(
            "change",
            toggleBillingFields
        );

        document.querySelector(
            '#checkoutForm [data-step="2"] [data-next="3"]'
        )?.addEventListener("click", async () => {
            if (!$("sameAsShipping")?.checked) {
                if (!validateFields([
                    "billingName",
                    "billingAddress",
                    "billingCity",
                    "billingState",
                    "billingPincode"
                ])) {
                    return;
                }
            }

            if (await renderOrderSummary()) {
                showStep(3);
            }
        });

        document.querySelectorAll("#checkoutForm [data-back]")
            .forEach(button => {
                button.addEventListener("click", () => {
                    showStep(Number(button.dataset.back));
                });
            });

        form.addEventListener("submit", placeOrder);

        $("closeCheckoutButton")?.addEventListener("click", () => {
            $("checkoutDialog")?.close();
        });

        $("finishCheckoutButton")?.addEventListener("click", () => {
            $("checkoutDialog")?.close();
            form.reset();
            toggleBillingFields();
            showStep(1);
        });

        toggleBillingFields();
        showStep(1);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setup);
    } else {
        setup();
    }
})();