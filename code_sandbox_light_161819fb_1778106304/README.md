# DesignDreams – Luxury Stainless Steel Jewelry Website

A fully functional e-commerce website for **DesignDreams**, an artificial jewelry business specializing in premium 316L stainless steel pieces.

---

## 🌐 Pages

| Page | URL | Description |
|---|---|---|
| Homepage | `index.html` | Hero, categories, featured products, testimonials, inquiry form |
| Shop | `shop.html` | Full product catalog with filters & sorting |
| Product Detail | `product.html?id=PRODUCT_ID` | Single product view with add-to-cart |
| Checkout | `checkout.html` | Multi-step checkout with payment options |

---

## ✅ Implemented Features

### 🛍️ E-Commerce
- Product catalog with 8+ jewelry products (necklaces, bracelets, rings, earrings, sets)
- Product cards with images, pricing (PKR + USD), ratings, and badges
- Add-to-cart with drawer (slide-in sidebar)
- Quantity controls in cart (increase/decrease/remove)
- Cart persists in `localStorage`
- Quick-view modal for fast browsing
- Full product detail page with gallery thumbnails
- "Buy Now" button (add to cart + redirect to checkout)

### 💳 Payment Gateways
- **PayPal** – SDK integration (configure Client ID in `js/config.js`)
- **EasyPaisa** – Manual payment with detailed instructions + account number display
- **JazzCash** – Manual payment with detailed instructions + account number display
- **Cash on Delivery** – With PKR 500 COD fee

### 📱 WhatsApp Integration
- Floating WhatsApp button (bottom-right, all pages)
- "Order via WhatsApp" button on product pages
- WhatsApp link pre-filled with product/order details
- Inquiry form includes WhatsApp follow-up link
- Checkout page has WhatsApp help link

### ✉️ Email Inquiry Form
- Full inquiry form (name, email, phone, subject, message)
- Saves to database (`inquiries` table)
- Confirmation message with WhatsApp alternative
- Subject categories: Product Inquiry, Bulk Order, Custom Design, Return, etc.

### 🎨 Design & UX
- Luxury gold & dark color palette
- Playfair Display (serif) + Jost (sans-serif) typography
- Hero slideshow with auto-advance
- Category grid with hover effects
- Testimonials section
- Instagram-style gallery strip
- Responsive for mobile, tablet, desktop
- Sticky header with scroll shadow
- Mobile hamburger menu
- Search bar toggle

### 🗄️ Data Storage
- Products stored in `products` table (Table API)
- Orders stored in `orders` table
- Inquiries stored in `inquiries` table

---

## ⚙️ Configuration (`js/config.js`)

Edit this file to connect your business services:

```javascript
const DD_CONFIG = {
  business: {
    email:    'info@designdreams.pk',    // ← Your business email
    whatsapp: '923330492914',            // ← WhatsApp (international, no +)
  },
  paypal: {
    enabled:  false,                     // ← Set true + add Client ID
    clientId: 'YOUR_PAYPAL_CLIENT_ID',
  },
  easypaisa: {
    accountNumber: '0300-0000000',       // ← Your EasyPaisa number
    accountTitle:  'DesignDreams',
  },
  jazzcash: {
    accountNumber: '0300-0000000',       // ← Your JazzCash number
    accountTitle:  'DesignDreams',
  },
};
```

---

## 📦 Data Models

### products table
| Field | Type | Description |
|---|---|---|
| id | text | Unique ID |
| name | text | Product name |
| category | text | Necklaces / Bracelets / Rings / Earrings / Sets |
| price | number | Price in PKR |
| price_usd | number | Price in USD |
| description | rich_text | Full description |
| short_desc | text | Card description |
| material | text | Material details |
| image_url | text | Product image URL |
| badge | text | Bestseller / New / Sale |
| in_stock | bool | Stock status |
| rating | number | Rating (0-5) |

### orders table
| Field | Type | Description |
|---|---|---|
| customer_name | text | Full name |
| customer_email | text | Email |
| customer_phone | text | Phone |
| customer_address | rich_text | Full address |
| items | rich_text | JSON of cart items |
| total_pkr | number | Total in PKR |
| total_usd | number | Total in USD |
| payment_method | text | PayPal / EasyPaisa / JazzCash / COD |
| payment_status | text | Pending / Paid / Failed |
| order_status | text | Pending / Processing / Shipped / Delivered |

### inquiries table
| Field | Type | Description |
|---|---|---|
| name | text | Customer name |
| email | text | Email |
| phone | text | Phone |
| subject | text | Inquiry type |
| message | rich_text | Full message |
| status | text | New / Replied / Closed |

---

## 🔌 API Endpoints Used

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `tables/products?limit=4` | Load featured products |
| GET | `tables/products?limit=100` | Load all products for shop |
| GET | `tables/products/{id}` | Load single product |
| POST | `tables/orders` | Create new order |
| POST | `tables/inquiries` | Submit inquiry |

---

## 🚀 Setup Steps to Go Live

1. **Update `js/config.js`** with your real business info
2. **EasyPaisa**: Register at [easypaisa.com.pk/online-payment-gateway](https://easypaisa.com.pk/online-payment-gateway/) and add your account number
3. **JazzCash**: Register at jazzcash.com.pk and add your account number
4. **PayPal**: Get Client ID from [developer.paypal.com](https://developer.paypal.com), set `enabled: true`
5. **WhatsApp**: Update the phone number in config and all HTML files
6. **Products**: Add more products via the Table API or admin panel
7. **Deploy**: Use the **Publish tab** to deploy your site

---

## 📁 File Structure

```
index.html          – Homepage
shop.html           – Product catalog
product.html        – Product detail
checkout.html       – Checkout & payment
css/
  style.css         – All styles (luxury jewelry theme)
js/
  config.js         – Business settings & credentials
  cart.js           – Cart state & drawer
  main.js           – Header, slider, inquiry form, quick view
  shop.js           – Shop filters, sorting, product listing
  product.js        – Product detail page
  checkout.js       – Order form, payment methods, PayPal SDK
README.md
```

---

## 🎯 Recommended Next Steps

- [ ] Set up real EasyPaisa/JazzCash merchant accounts
- [ ] Activate PayPal with live Client ID
- [ ] Add product images to a CDN for faster loading
- [ ] Add more products via the admin panel or API
- [ ] Set up email notifications (using a service like EmailJS or Formspree)
- [ ] Add a size guide page for rings
- [ ] Create an admin dashboard to view orders
- [ ] Add product search page results
- [ ] Integrate Google Analytics for tracking

---

*Built with ❤️ for DesignDreams – Lahore, Pakistan*
