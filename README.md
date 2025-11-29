# Supply-Bot: Autonomous Procurement Agent for SMB Manufacturing

<p align="center">
  <img src="docs/logo.png" alt="Supply-Bot Logo" width="200">
</p>

**Supply-Bot** is an "Agentic Middleware" that revolutionizes procurement for small and medium-sized manufacturing businesses. It connects to your inventory system and autonomously manages the entire procurement lifecycle—from detecting low stock to negotiating prices and placing orders.

## 🎯 Problem Statement

SMB manufacturers are trapped between two worlds:
- **Excel Hell**: Managing complex Bills of Materials (BOMs) and hundreds of suppliers manually
- **Enterprise Bloat**: ERP systems like SAP or Oracle are too expensive and complex for a 50-person shop

**Supply-Bot bridges this gap** with AI-powered autonomous procurement agents.

## ✨ Key Features

### 🔍 The Scout Agent
Continuously monitors supplier websites and catalogs for:
- Real-time pricing updates
- Stock level changes
- New product availability
- Supplier reliability metrics

### 📊 The Strategist Agent
Predicts and prevents stockouts using:
- Historical consumption analysis
- Demand forecasting
- Optimal reorder point calculation
- Economic Order Quantity (EOQ) optimization

### 🤝 The Diplomat Agent
Autonomous price negotiation via:
- AI-generated professional emails
- Multi-round negotiation strategies
- Game-theoretic pricing models
- Volume leverage and competitive positioning

### 🔗 Integration Layer
Seamless connection to legacy supplier systems:
- Browser automation for "old-school" vendor portals
- REST API integration for modern suppliers
- QuickBooks/Xero inventory sync

### 🏛️ Virtual Cooperative (Federation)
Aggregate buying power across SMBs:
- Anonymous demand aggregation
- Bulk order coordination
- Collective negotiation leverage

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Supply-Bot                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Scout     │  │ Strategist  │  │  Diplomat   │              │
│  │   Agent     │  │   Agent     │  │   Agent     │              │
│  │             │  │             │  │             │              │
│  │ - Scraping  │  │ - Forecast  │  │ - Negotiate │              │
│  │ - Pricing   │  │ - Predict   │  │ - Email AI  │              │
│  │ - Stock     │  │ - Optimize  │  │ - Terms     │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                       │
│                 ┌────────▼────────┐                             │
│                 │   Orchestrator  │                             │
│                 │   (Task Queue)  │                             │
│                 └────────┬────────┘                             │
│                          │                                       │
├──────────────────────────┼──────────────────────────────────────┤
│                 ┌────────▼────────┐                             │
│                 │    REST API     │                             │
│                 └────────┬────────┘                             │
│                          │                                       │
├──────────────────────────┼──────────────────────────────────────┤
│  ┌────────────┐  ┌───────▼───────┐  ┌────────────┐              │
│  │ PostgreSQL │◀─│   Prisma ORM  │─▶│   Redis    │              │
│  └────────────┘  └───────────────┘  └────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Grok API key (from xAI)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/supply-bot.git
cd supply-bot

# Start Docker services (PostgreSQL, Redis, MailHog)
docker-compose -f docker-compose.dev.yml up -d

# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your Grok API key

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed sample data
npm run db:seed

# Install Playwright browsers
npx playwright install chromium

# Start the server
npm run dev
```

### Dashboard Setup

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:3000 to access the dashboard.

**Demo login**: `admin@acmefurniture.com` (password: any)

### Development URLs

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | http://localhost:3000 | Main UI |
| API | http://localhost:3001 | Backend API |
| MailHog | http://localhost:8025 | Email testing |
| Redis Commander | http://localhost:8081 | Redis UI |

## 🏭 Production Deployment

### Option 1: Docker Compose

```bash
# Copy and configure production environment
cp .env.production.example .env.production
# Edit .env.production with production values

# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# Run database migrations
docker-compose -f docker-compose.prod.yml exec supplybot npx prisma migrate deploy
```

### Option 2: Manual Deployment

1. **Database**: Set up PostgreSQL (AWS RDS, Supabase, etc.)
2. **Redis**: Set up Redis (AWS ElastiCache, Upstash, etc.)
3. **Build the app**:
   ```bash
   npm run build
   cd dashboard && npm run build
   ```
4. **Start with PM2**:
   ```bash
   pm2 start dist/index.js --name supplybot
   cd dashboard && pm2 start npm --name dashboard -- start
   ```

### Environment Variables for Production

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `GROK_API_KEY` | Grok/xAI API key | ✅ |
| `API_SECRET` | JWT secret (use `openssl rand -hex 32`) | ✅ |
| `SMTP_*` | Email configuration | ✅ |
| `API_CORS_ORIGIN` | Frontend URL | ✅ |

## 📁 Project Structure

```
supply-bot/
├── prisma/
│   └── schema.prisma       # Database schema
├── src/
│   ├── agents/
│   │   ├── types.ts        # Agent interfaces
│   │   ├── scout/          # Web scraping agent
│   │   ├── strategist/     # Prediction agent
│   │   └── diplomat/       # Negotiation agent
│   ├── api/
│   │   └── server.ts       # REST API
│   ├── config/
│   │   └── index.ts        # Configuration
│   ├── database/
│   │   ├── client.ts       # Prisma client
│   │   └── seed.ts         # Sample data
│   ├── services/
│   │   ├── orchestrator.ts # Agent coordination
│   │   ├── portal-automation.ts
│   │   └── federation.ts   # Cooperative features
│   └── utils/
│       └── logger.ts       # Logging
├── dashboard/              # Next.js frontend
└── docker-compose.yml      # Docker setup
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `OPENAI_API_KEY` | OpenAI API key for AI features | - |
| `SMTP_*` | Email configuration for Diplomat | - |
| `SCOUT_SCAN_INTERVAL` | Minutes between supplier scans | `60` |
| `DIPLOMAT_MAX_NEGOTIATION_ROUNDS` | Max email rounds | `3` |

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Dashboard
- `GET /api/dashboard` - Dashboard statistics

### Inventory
- `GET /api/inventory` - List inventory items
- `GET /api/inventory/analysis` - AI-powered analysis
- `GET /api/inventory/predictions` - Stockout predictions

### Suppliers
- `GET /api/suppliers` - List suppliers
- `POST /api/suppliers/:id/scan` - Trigger supplier scan

### Negotiations
- `GET /api/negotiations` - List negotiations
- `POST /api/negotiations` - Start new negotiation

### Agent Control
- `POST /api/agents/run-cycle` - Run full procurement cycle
- `POST /api/agents/auto-reorder` - Trigger auto-reorder

## 🤖 Agent Details

### Scout Agent

The Scout Agent monitors supplier pricing and availability:

```typescript
// Example: Scan a specific supplier
await scoutAgent.executeTask({
  type: 'scan_supplier',
  payload: { supplierId: 'supplier-uuid' }
});

// Example: Compare prices across suppliers
await scoutAgent.executeTask({
  type: 'compare_prices',
  payload: { productId: 'product-uuid' }
});
```

### Strategist Agent

The Strategist Agent predicts inventory needs:

```typescript
// Analyze inventory levels
await strategistAgent.executeTask({
  type: 'analyze_inventory',
  payload: { organizationId: 'org-uuid' }
});

// Generate reorder suggestions
await strategistAgent.executeTask({
  type: 'generate_reorder_suggestions',
  payload: { organizationId: 'org-uuid' }
});
```

### Diplomat Agent

The Diplomat Agent handles supplier negotiations:

```typescript
// Start price negotiation
await diplomatAgent.executeTask({
  type: 'initiate_negotiation',
  payload: {
    organizationId: 'org-uuid',
    supplierId: 'supplier-uuid',
    products: [
      { productId: 'prod-1', quantity: 1000 },
      { productId: 'prod-2', quantity: 500 }
    ]
  }
});
```

## 🏛️ Virtual Cooperative

The Federation feature enables SMBs to combine purchasing power:

```typescript
// Join a cooperative
await federationService.joinCooperative('cooperative-uuid');

// Submit anonymized demand data
await federationService.submitDemandData();

// Participate in bulk order
await federationService.participateInBulkOrder('opportunity-id', 500);

// Calculate potential savings
const savings = await federationService.calculateCooperativeSavings();
```

### How It Works

1. **Anonymous Aggregation**: Members submit anonymized demand data
2. **Opportunity Detection**: System identifies bulk buying opportunities
3. **Collective Negotiation**: Combined volume used for better pricing
4. **Fair Distribution**: Savings distributed proportionally to participants

## 🐳 Docker Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f supply-bot

# Stop services
docker-compose down
```

## 🔒 Security

- JWT-based authentication
- Encrypted supplier credentials
- Role-based access control
- Anonymized cooperative data sharing
- Secure API communication

## 📈 Roadmap

- [ ] QuickBooks/Xero direct integration
- [ ] Mobile app for alerts
- [ ] Multi-language negotiation support
- [ ] Blockchain-based cooperative ledger
- [ ] Predictive supplier risk scoring
- [ ] Carbon footprint optimization

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- OpenAI for GPT-4 powering negotiations
- Playwright for browser automation
- The SMB manufacturing community for inspiration

---

<p align="center">
  <strong>Supply-Bot</strong> - Leveling the playing field for SMB manufacturers
</p>
