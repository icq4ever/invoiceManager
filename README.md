# Invoice Manager

A self-hosted web application for generating and managing multi-company invoices with multilingual support (Korean/English).

[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?logo=github&logoColor=white)](https://github.com/icq4ever/invoiceManager) 

**Language**: [English](README.md) | [한국어](README.ko.md)

## Features

- Multi-company invoice generation
- Bilingual support (Korean/English)
- Client management
- Dynamic invoice items with automatic calculations
- Reusable note templates
- PDF export and printing
- Dark mode support
- Backup & Restore
- Docker deployment ready

## Screenshots

### Dashboard
![Dashboard](assets/01_dashboard.png)

### Invoice List
![Invoice List](assets/02_invoiceList.png)

### Invoice Form - Simple Text Mode
![Invoice Form - Simple Mode](assets/03_invoice_simple.png)

### Invoice Form - Itemized Details Mode
![Invoice Form - Itemized Mode](assets/04_invoice_detail.png)

### Invoice Print Preview
![Invoice Print Preview](assets/05_invoice_print_preview.png)

### Client List
![Client List](assets/06_client_list.png)

## Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/invoice-manager.git
cd invoice-manager

# Setup environment
cp .env.example .env

# Run with Docker
docker compose up --build -d

# Set up admin credentials
docker exec -it invoice-manager npm run set-credentials

# Access at http://localhost:3006
```

> **Note**: On first launch, the login page will show setup instructions until you run the `set-credentials` command. You can re-run it anytime to change the admin username or password.

### Using with a shared Nginx reverse proxy

If you run a single Nginx container as a reverse proxy for multiple services on a shared Docker network, you need to connect the invoice-manager container to that network:

```bash
# Connect to your shared network (run after docker compose up)
docker network connect shared invoice-manager

# Reload Nginx to resolve the new upstream
docker exec nginx nginx -s reload
```

Or, change `external: false` to `external: true` in `docker-compose.yml` under `networks.shared` so it automatically joins the existing network.

## Tech Stack

- **Backend**: Node.js + Express.js
- **Database**: SQLite
- **Frontend**: EJS + Tailwind CSS
- **Deployment**: Docker

## Documentation

| Document | Description |
|----------|-------------|
| [Installation](docs/installation.md) | Setup guide & environment variables |
| [Usage](docs/usage.md) | How to use the application |
| [Docker](docs/docker.md) | Docker deployment & Nginx setup |
| [Database](docs/database.md) | Database schema reference |
| [Troubleshooting](docs/troubleshooting.md) | Common issues & solutions |

## Support

If you find Invoice Manager useful, consider supporting its development:

- [GitHub Sponsors](https://github.com/sponsors/icq4ever)
- Kakao Pay: <br/>
<img src="assets/kakaoDonation.jpg" alt="Kakao Pay" width="300">

## License

**GNU Affero General Public License v3 (AGPL v3)**

- You can use and modify freely
- Modifications must be shared under AGPL v3
- Web service usage requires source code disclosure

See [LICENSE](LICENSE) for details.

## Roadmap

- [x] Invoice status management (draft, confirmed, discarded)
- [x] Email invoice delivery
- [ ] Payment tracking
- [ ] Multi-user support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

---

**Version**: 1.4.1 | Built with Node.js, Express, and Tailwind CSS
