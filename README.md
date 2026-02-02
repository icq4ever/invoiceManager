# Invoice Manager

A self-hosted web application for generating and managing multi-company invoices with multilingual support (Korean/English).

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

### Invoice List & Preview
![Invoice Preview](assets/preview.png)

### PDF Output
![PDF Output](assets/output.png)

## Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/invoice-manager.git
cd invoice-manager

# Setup environment
cp .env.example .env
# Edit .env with your settings

# Run with Docker
docker-compose up --build -d

# Access at http://localhost:3000
```

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

- [ ] Invoice status management (sent, accepted, rejected)
- [ ] Email invoice delivery
- [ ] Payment tracking
- [ ] Multi-user support

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Changelog

### v1.1.0
- Added itemized invoice details mode (sub-items with individual pricing)
- Added database schema version tracking
- Improved invoice view table styling

### v1.0.1
- Bug fixes and improvements

### v1.0.0
- Initial release

---

**Version**: 1.1.0 | Built with Node.js, Express, and Tailwind CSS
