# JBR - Jual Beli Raket 🏸

Marketplace untuk jual beli raket badminton baru dan bekas (preloved).

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Better Auth
- **File Upload**: UploadThing
- **Styling**: Tailwind CSS 4

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- UploadThing account

### Installation

1. Clone repository
```bash
git clone git@github.com:developercosmos/jbr.com.git
cd jbr.com
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables
```bash
cp .env.example .env.local
# Edit .env.local dengan kredensial Anda
```

4. Setup database
```bash
npx drizzle-kit push
```

5. Run development server
```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── admin/          # Admin dashboard
│   ├── seller/         # Seller dashboard
│   ├── profile/        # User profile pages
│   ├── product/        # Product detail pages
│   └── api/            # API routes
├── actions/            # Server Actions
├── components/         # React components
├── db/                 # Database schema & config
└── lib/                # Utilities & auth config
```

## Features

### Buyer
- 🔍 Browse & search products
- 🛒 Shopping cart
- 📦 Order tracking
- 💬 Chat with seller
- ❤️ Wishlist

### Seller
- 📝 Product management
- 📊 Sales analytics
- 📦 Order management
- ⚙️ Store settings

### Admin
- 👥 User management
- 🛍️ Product moderation
- 📋 Order overview
- 📈 Platform analytics
- 🎫 Support tickets
- ⚖️ Dispute resolution

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Database Commands

```bash
npx drizzle-kit generate  # Generate migrations
npx drizzle-kit push      # Push schema to database
npx drizzle-kit studio    # Open Drizzle Studio GUI
```

## License

MIT
