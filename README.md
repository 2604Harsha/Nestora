# NESTORA – E-Commerce Website

NESTORA is an e-commerce website that allows users to browse products, add items to their shopping cart, manage quantities, and proceed through checkout to place orders.

## Features

- Browse and view products.
- Add products to the shopping cart.
- Increase, decrease, and remove cart items.
- View cart subtotal and total price.
- User authentication and session management.
- Shipping and billing address forms.
- Cash on Delivery (COD) payment option.
- Order placement and confirmation.
- Backend API integration.
- Responsive user interface.

## Technologies Used

- **Frontend:** HTML5, CSS3, JavaScript
- **Backend:** API-based backend integration(Node.js)
- **Database:** Depends on the configured backend(Mysql)
- **Development Tools:** Visual Studio Code, Git, GitHub
- **Frontend Server:** Live Server

## Project Structure

```text
NESTORA/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js
│       ├── products.js
│       ├── cart.js
│       ├── app.js
│       └── checkout.js
├── backend/
│   └── Backend application files
└── README.md
```

*Update the folder names above if your actual project structure differs.*

## Installation and Setup

1. Clone or download the project.
2. Open the project folder in Visual Studio Code.
3. Configure the backend API URL in `frontend/js/api.js`.
4. Start the backend server using its configured startup command.
5. Open `frontend/index.html` with the VS Code Live Server extension.
6. Register or sign in to the application.
7. Browse products and add items to your cart.

## How to Use

1. Open the NESTORA website.
2. Browse the available products.
3. Add products to the cart.
4. Adjust product quantities or remove items as required.
5. Click **Proceed to Checkout**.
6. Enter your shipping address.
7. Confirm your billing details.
8. Select **Cash on Delivery**.
9. Review your order and click **Place Order**.
10. View the order confirmation after the backend successfully creates the order.

## Cart Functionality

The shopping cart supports two modes:

- **Guest users:** Cart items are stored in browser `localStorage`.
- **Signed-in users:** Cart items are loaded and managed through the backend API.

The cart displays product details, quantities, subtotal, and total price.

## Checkout and Orders

The checkout process includes shipping, billing, payment selection, and order confirmation.

The backend must validate the user's cart, calculate the order total, verify product availability, save the order, and return an order identifier before the frontend displays a successful confirmation.

The online payment gateway is not available unless separately integrated. Cash on Delivery requires backend support.

## Running the Project

Run the frontend and backend separately:

- **Frontend:** Open `frontend/index.html` using Live Server.
- **Backend:** Start the server using the command configured for your backend framework.

Make sure the frontend API URL matches the backend URL and that the backend permits requests from the frontend's development origin.

## Future Enhancements

- Online payment gateway integration.
- Order history and order tracking.
- Product reviews and ratings.
- Wishlist functionality.
- Email and order status notifications.
- Improved product search and filtering.
- Automated frontend and backend testing.

## Author

Harsha Vardhan Naidu Dasireddy
Web Developer Intern 

## License

Specify the applicable license before distributing the project publicly.
