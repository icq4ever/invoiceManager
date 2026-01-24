# Invoice Manager

A self-hosted web application for generating and managing multi-company invoices with multilingual support (Korean/English).

**Language**: [English](README.md) | [한국어](README.ko.md)

## Overview

Invoice Manager is a professional invoice generation and management system designed for businesses that need to issue invoices in multiple currencies and languages. It supports managing multiple companies, clients, and invoice templates with easy PDF export functionality.

**Key Features:**
- ✅ Multi-company invoice generation
- ✅ Bilingual support (Korean/English)
- ✅ Client management
- ✅ Dynamic invoice items with automatic calculations
- ✅ Reusable note templates
- ✅ PDF export and printing
- ✅ Dark mode support
- ✅ Docker deployment ready
- ✅ SQLite database (no external dependencies)

## Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite (file-based, persistent via Docker volumes)
- **Frontend**: EJS templating + Tailwind CSS
- **Styling**: Tailwind CSS with dark mode support
- **Authentication**: Express-session + bcrypt
- **Deployment**: Docker & Docker Compose

## Project Structure

```
invoiceManager/
├── Dockerfile                    # Container configuration
├── docker-compose.yml            # Docker Compose setup
├── .env.example                  # Environment variables template
├── README.md                      # Documentation (English)
├── README.ko.md                   # Documentation (Korean)
├── app/                           # Application source code
│   ├── package.json              # Node.js dependencies
│   ├── src/
│   │   ├── app.js                # Express application entry point
│   │   ├── config/
│   │   │   └── database.js       # SQLite configuration & migrations
│   │   ├── middleware/
│   │   │   ├── auth.js           # Authentication middleware
│   │   │   └── i18n.js           # Internationalization middleware
│   │   ├── routes/
│   │   │   ├── auth.js           # Login/logout routes
│   │   │   ├── companies.js      # Company management (CRUD)
│   │   │   ├── clients.js        # Client management (CRUD)
│   │   │   ├── invoices.js       # Invoice management (CRUD)
│   │   │   └── templates.js      # Note template management
│   │   ├── views/                # EJS templates
│   │   │   ├── layout.ejs        # Master layout
│   │   │   ├── login.ejs
│   │   │   ├── dashboard.ejs
│   │   │   ├── companies/
│   │   │   ├── clients/
│   │   │   ├── invoices/
│   │   │   └── templates/
│   │   ├── locales/              # i18n translation files
│   │   │   ├── ko.json
│   │   │   └── en.json
│   │   ├── public/               # Static assets
│   │   └── utils/                # Utility functions
│   └── scripts/                  # Build scripts
├── data/                         # SQLite database (Docker volume)
├── uploads/                      # Company logos/stamps (Docker volume)
└── .gitignore                    # Git ignore rules
```

## Database Schema

### Companies Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| name | TEXT | Company name (Korean) |
| name_en | TEXT | Company name (English) |
| representative | TEXT | Representative name (Korean) |
| representative_en | TEXT | Representative name (English) |
| business_number | TEXT | Tax ID |
| address | TEXT | Address (Korean) |
| address_en | TEXT | Address (English) |
| phone | TEXT | Phone number (Korean) |
| phone_en | TEXT | Phone number (English) |
| email | TEXT | Email (Korean) |
| email_en | TEXT | Email (English) |
| bank_info | TEXT | Bank account info (Korean) |
| bank_info_en | TEXT | Bank account info (English) |
| logo_path | TEXT | Logo image path |
| stamp_path | TEXT | Signature/stamp image path |
| invoice_prefix | TEXT | Invoice number prefix (e.g., INV, S42) |
| is_default | BOOLEAN | Default company flag |
| created_at | DATETIME | Creation timestamp |

### Clients Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| name | TEXT | Client/company name |
| business_number | TEXT | Tax ID |
| contact_person | TEXT | Contact person name |
| phone | TEXT | Phone number |
| email | TEXT | Email address |
| address | TEXT | Address |
| created_at | DATETIME | Creation timestamp |

### Invoices Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| invoice_number | TEXT | Invoice number (e.g., INV-2026-0001) |
| company_id | INTEGER FK | Issuing company |
| client_id | INTEGER FK | Client/recipient |
| project_name | TEXT | Project name |
| issue_date | DATE | Invoice issue date |
| validity_period | TEXT | Validity period (e.g., "1 month from issue date") |
| subtotal | REAL | Subtotal (supply amount) |
| tax_rate | REAL | Tax rate (%) |
| tax_amount | REAL | Tax amount |
| total_amount | REAL | Total amount |
| notes | TEXT | Additional notes (JSON array) |
| status | TEXT | Invoice status (draft) |
| currency | TEXT | Currency (KRW, USD, EUR, JPY, GBP, CNY) |
| pdf_path | TEXT | Generated PDF path |
| created_at | DATETIME | Creation timestamp |
| updated_at | DATETIME | Update timestamp |

### Invoice Items Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| invoice_id | INTEGER FK | Parent invoice |
| title | TEXT | Item title |
| details | TEXT | Item details (multiline) |
| quantity | REAL | Quantity |
| unit_price | REAL | Unit price |
| amount | REAL | Total amount (qty × unit_price) |
| sort_order | INTEGER | Display order |

### Note Templates Table
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Unique identifier |
| title | TEXT | Template name |
| content | TEXT | Template content |
| is_default | BOOLEAN | Include in new invoices by default |
| sort_order | INTEGER | Display order |
| created_at | DATETIME | Creation timestamp |

## Installation & Setup

### Prerequisites
- Docker & Docker Compose installed
- Port 3000 available (or configure in docker-compose.yml)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/invoice-manager.git
   cd invoice-manager
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your settings:
   ```env
   NODE_ENV=production
   PORT=3000
   SESSION_SECRET=your-secret-key-here
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD_HASH=bcrypt-hashed-password
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up --build -d
   ```

4. **Access the application**
   - Open browser: `http://localhost:3000`
   - Login with credentials from `.env`

### Manual Setup (without Docker)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Start the application**
   ```bash
   npm start
   ```

   Application runs on `http://localhost:3000`

### Change Admin Password

To change the admin password, you need to generate a bcrypt hash:

1. **Generate password hash using the script**
   ```bash
   npm run hash-password
   ```

   Or with Docker:
   ```bash
   docker exec -it invoice-manager npm run hash-password
   ```

2. **Enter your new password** when prompted
   - The script will output a bcrypt hash

3. **Update `.env` file**
   ```env
   ADMIN_PASSWORD_HASH='<paste-the-generated-hash-here>'
   ```

4. **Restart the application**
   ```bash
   docker-compose restart invoice-manager
   ```

   Or without Docker:
   ```bash
   npm start
   ```

The new password will be active immediately after restart.

## Usage

### 1. Login
Access the application and log in with admin credentials.

### 2. Company Management
- Navigate to **Companies** section
- Add company information in both Korean and English using tabs
- Upload company logo and signature/stamp images
- Set one company as default

### 3. Client Management
- Navigate to **Clients** section
- Add client/customer information
- View, edit, or delete clients

### 4. Create Invoice
- Click **New Invoice**
- Select company and client
- Add line items with details, quantity, and unit price
- System automatically calculates totals and taxes
- Select note templates or add custom notes
- Save as draft

### 5. View & Export
- Click on invoice to view details
- Switch between Korean/English language
- Print or export as PDF
- Duplicate invoices for quick creation

### 6. Templates
- Manage reusable note templates
- Set templates as default (auto-included in new invoices)
- Examples: payment terms, warranty info, company policies

## Features

### Multi-Company Support
- Register multiple companies/branches
- Each has separate logo, stamp, and invoice prefix
- Set one as default for quick selection

### Bilingual Interface
- Full support for Korean and English
- Switch languages at any time
- Company information stored in both languages
- Invoice displays in selected language

### Dynamic Invoice Items
- Add/remove line items on the fly
- Multi-line item details support
- Automatic calculation of amounts
- Support for multiple currencies (KRW, USD, EUR, JPY, GBP, CNY)

### Professional Templates
- Pre-defined note templates (payment terms, policies, etc.)
- Create custom templates
- Set templates to auto-include in new invoices

### PDF Export
- Print-friendly invoice layout
- Includes company logo and signature
- Professional formatting with Korean font support
- Download as PDF directly from browser

### Dark Mode
- Toggle between light and dark themes
- Preference saved in browser cookies
- Consistent styling throughout

## Docker Deployment

### Docker Compose Configuration

```yaml
services:
  invoice:
    build: .
    container_name: invoice-manager
    restart: unless-stopped
    expose:
      - "3000"
    volumes:
      - invoice-data:/app/data          # SQLite database
      - invoice-uploads:/app/uploads    # Company images
    env_file:
      - .env
    environment:
      - TZ=Asia/Seoul
      - NODE_ENV=production
    networks:
      - shared

volumes:
  invoice-data:
  invoice-uploads:

networks:
  shared:
    external: true
```

### Nginx Reverse Proxy Setup

Add to nginx.conf:

```nginx
upstream docker-invoice {
    server invoice-manager:3000;
}

server {
    listen 80;
    server_name invoice.example.com;
    server_tokens off;

    location / {
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_pass http://docker-invoice;
    }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment (development/production) | production |
| PORT | Server port | 3000 |
| SESSION_SECRET | Session encryption key | fallback-secret-key |
| ADMIN_USERNAME | Login username | admin |
| ADMIN_PASSWORD_HASH | bcrypt hashed password | (required) |
| HTTPS | Enable HTTPS in production | false |
| TZ | Timezone | Asia/Seoul |

## Security

- **Authentication**: Express-session with httpOnly cookies
- **Password Storage**: bcrypt hashing
- **Input Validation**: Server-side validation for all inputs
- **File Upload**: Restricted to image files (jpeg, jpg, png, gif, webp)
- **Database**: SQLite with parameterized queries (SQL injection prevention)

## Troubleshooting

### Application won't start
```bash
# Check logs
docker-compose logs -f invoice-manager

# Rebuild container
docker-compose down
docker-compose up --build -d
```

### Database locked error
```bash
# Restart the application
docker-compose restart invoice-manager
```

### Uploads not visible
- Verify Docker volume is mounted: `docker volume ls`
- Check file permissions in uploads directory
- Ensure uploads directory exists: `docker-compose exec invoice-manager ls -la /app/uploads`

## Performance Tips

1. **Database Optimization**: Regular SQLite maintenance
2. **Image Optimization**: Compress logo/stamp images before upload
3. **Browser Cache**: Clear cache if styles don't update
4. **Timezone**: Set TZ variable to match your location

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Submit a pull request

## Support

For issues and questions:
1. Check existing issues on GitHub
2. Create a new issue with detailed information
3. Include error logs and screenshots

## Roadmap

- [ ] Invoice status management (sent, accepted, rejected)
- [ ] Automatic PDF generation on save
- [ ] Email invoice delivery
- [ ] Payment tracking
- [ ] Advanced reporting and analytics
- [ ] API for third-party integration
- [ ] Multi-user support with role-based access

## Credits

Built with ❤️ using Node.js, Express, and Tailwind CSS

---

**Version**: 1.0.0
**Last Updated**: January 2026
