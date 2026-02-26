# Stack Research: Real Estate Deal Sourcing & Wholesale Automation Platform

**Domain:** Real estate wholesale automation, deal sourcing, and lead management SaaS
**Researched:** 2026-02-25
**Confidence:** HIGH

## Recommended Stack

### Core Framework & Runtime

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 20+ LTS | Backend runtime | Industry standard for SaaS APIs with async/await excellence and vast ecosystem. PropStream API integration, email automation, and queue processing all have mature Node.js libraries |
| TypeScript | 5.5+ | Type safety for backend and frontend | Reduces production bugs by 30-40%. Essential for a team-built product with complex deal logic. Strong in both Node.js and React ecosystems |
| Express.js | 4.18+ | HTTP API framework | Lightweight, battle-tested, perfect for building RESTful APIs. Excellent routing, middleware support, and flexibility for integrating external APIs like PropStream |
| Next.js | 15+ | Frontend + API routes | Modern React framework with built-in server-side rendering, authentication patterns, and API routes. Provides polished UI that users expect from SaaS platforms |
| React | 19+ | UI framework | Dominates dashboard/SPA development with 39% developer adoption. Ideal for interactive deal dashboards, qualification forms, and lead management interfaces |

### Database & Data Layer

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PostgreSQL | 15+ | Primary relational database | PostGIS extension handles geospatial queries critical for real estate. Strong ACID compliance for deal transactions. Structured property data benefits from relational schema. Most real estate platforms migrate to PostgreSQL for data consistency |
| Redis | 7+ | Caching and task queue | Essential for BullMQ (job scheduling). Caches frequently accessed deal data, property comps, and API responses. Dramatically improves performance for repeat API calls |

### API Integration & HTTP

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Axios | 1.6+ | HTTP REST client for Node.js | Calling PropStream API and other third-party real estate data services. Built-in retry logic, interceptors, and timeout handling |
| node-fetch or native Fetch | 18+ | Lightweight HTTP client alternative | If you want to avoid external dependencies. Node.js 18+ has native Fetch API support |

### Authentication & Authorization

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Clerk or Auth0 | Latest | Managed authentication (IDaaS) | 99% of SaaS should NOT build auth from scratch. Clerk handles OAuth, passwordless, MFA, session management, and compliance (SOC 2, HIPAA). Includes TypeScript SDKs for seamless integration |
| jsonwebtoken | 9.0+ | JWT token validation | If using custom auth, validate issued tokens on API requests. Clerk/Auth0 can issue JWTs that your Express backend validates |

### Task Scheduling & Background Jobs

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| BullMQ | 5.0+ | Distributed job queue with Redis | **Critical for this project.** Handles scheduled offer emails, follow-up sequences, PropStream data polling, and deal qualification batches. Replaces cron jobs with reliable, retryable queue processing. Can scale to millions of jobs |
| node-schedule | 2.1+ | Simple cron scheduling (optional backup) | Only for simple, non-critical recurring tasks. Not sufficient for email sequences—use BullMQ instead |

### Email & Communications

| Service/Library | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| SendGrid | Latest SDK | Email API for transactional and marketing emails | **Recommended.** Official @sendgrid/mail npm package (1.6M+ weekly downloads). Handles offer emails, follow-up sequences, and bulk communications. Integrates with BullMQ for scheduled delivery |
| Bento | Latest SDK | Alternative email + marketing platform | Light alternative with TypeScript support and Express middleware. Use if preference for simpler platform |
| Nodemailer | 6.9+ | SMTP-based email client (self-hosted) | Only if using existing SMTP server (internal mail server). More complex to debug. Not recommended for SaaS |

### Data Validation & Serialization

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.22+ | TypeScript-first runtime validation | **Recommended for Node.js backend.** Define PropStream API response schemas, deal qualification criteria, and form inputs with strong typing. Zero dependencies, 2kb gzipped. Validates at runtime what TypeScript only checks at compile time |
| Prisma | 5.0+ | ORM for database operations | Strongly typed database queries, automatic migrations, excellent TypeScript support. Simplifies PostgreSQL operations and prevents SQL injection |

### Frontend Form & UI

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React Hook Form | 7.50+ | Form state management | **Recommended.** Best-in-class performance (uncontrolled components), native HTML validation, TypeScript-first. 95% less re-renders than Formik. Perfect for complex deal qualification forms |
| shadcn/ui | Latest | Customizable React component library | Copy-paste Radix UI components styled with Tailwind. Own your component code. Perfect for polished dashboards. Includes form components, tables for deal lists, modals for offers |
| Tailwind CSS | 4.0+ | Utility-first CSS framework | Modern standard for SaaS UIs. Works seamlessly with shadcn/ui. Rapid prototyping and consistent styling |

### Data Visualization

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Recharts | 2.10+ | React charting library | Display equity distribution, market trends, deal performance metrics. Wraps D3 functionality with React component API. Animation and responsive sizing built-in |
| TanStack Charts | Latest | Advanced charting (time series) | If dealing with historical deal data or market analysis dashboards. More flexibility than Recharts |

### Testing

| Framework | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| Vitest | 1.0+ | Test runner for TypeScript | **Recommended for modern stack.** 10-20x faster than Jest. Reuses Vite config, zero Babel setup needed. 95% Jest-compatible. Ideal for Next.js + TypeScript |
| Jest | 29+ | Alternative test framework | If team already uses Jest. More mature ecosystem, better for legacy projects. Jest works fine but slower |

### API Documentation & Client Generation

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| OpenAPI/Swagger | 3.1 | API specification standard | Document your PropStream integration layer and API endpoints. Enables automatic API client generation and better frontend-backend coordination |
| Zod to OpenAPI converters | Latest | Generate OpenAPI from Zod schemas | Automatically generate API docs from your validation schemas |

## Installation

```bash
# Core runtime and frameworks
npm install express@^4.18.0
npm install next@^15.0.0
npm install react@^19.0.0

# TypeScript and compilation
npm install -D typescript@^5.5
npm install -D tsx  # TypeScript runner for Node.js

# Database
npm install postgres@^3.3.5
npm install prisma@^5.0.0
npm install -D prisma@^5.0.0

# API integration
npm install axios@^1.6.0
npm install bullmq@^5.0.0
npm install redis@^4.6.0

# Email
npm install @sendgrid/mail@^8.0.0

# Authentication
npm install @clerk/nextjs@^latest

# Data validation
npm install zod@^3.22.0

# Frontend (React/Next.js)
npm install react-hook-form@^7.50.0
npm install tailwindcss@^4.0.0
npm install lucide-react@^latest

# UI Components
npm install recharts@^2.10.0

# Dev dependencies
npm install -D @types/node@^20.0.0
npm install -D @types/express@^4.17.0
npm install -D vitest@^1.0.0
npm install -D @testing-library/react@^14.0.0
npm install -D prettier@^3.0.0
npm install -D eslint@^8.0.0
```

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|---------|
| Backend Framework | Express.js | NestJS | If building enterprise-scale microservices requiring decorators/DI. Overkill for initial SaaS product |
| Frontend Framework | Next.js + React | Vue.js | If team has stronger Vue expertise. React has larger ecosystem for SaaS dashboards |
| Database | PostgreSQL | MongoDB | Only if schema is highly unstructured (it isn't—deal data is relational). Real estate use case strongly favors PostgreSQL |
| Job Queue | BullMQ | Temporal | For mission-critical workflows. BullMQ sufficient for wholesale deal sequences. Temporal adds complexity |
| Form Library | React Hook Form | TanStack Form | Newer alternative. React Hook Form is battle-tested, larger community |
| ORM | Prisma | TypeORM | Both solid. Prisma has better TypeScript support and migration experience |
| Hosting | Railway or Render | AWS/GCP | For MVP. Railway/Render have better DX, predictable pricing. Migrate to AWS later if needed |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Formik for forms | Unmaintained (2+ years). Over 800 open issues. Creator recommends React Hook Form | React Hook Form |
| MongoDB for property data | No geographic queries without plugins. Real estate needs PostGIS. Relational schema makes more sense | PostgreSQL with PostGIS |
| Building custom auth | Wastes 6-8 weeks, introduces security vulnerabilities (password hashing, session management, MFA, CORS). 99% of cases should use Clerk/Auth0 | Clerk or Auth0 (managed IDaaS) |
| Bull (legacy) | In maintenance mode only. Development moved to BullMQ | BullMQ |
| Nodemailer + self-hosted SMTP | Debugging delivery is nightmare. IP reputation issues. Use managed service | SendGrid or AWS SES |
| Jest for TypeScript-heavy projects | 10-20x slower than Vitest. Requires Babel setup | Vitest |
| Handcrafted component library | Wheel reinvention. Maintenance burden | shadcn/ui or Material-UI |

## Version Compatibility Notes

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 15 | React 19 | Next.js App Router requires React 18+. Use React 19 for latest features |
| TypeScript 5.5 | Node.js 20+ | Node.js 20 LTS has full TS support and ES2024 features |
| Zod 3.22+ | Node.js 16+ | Works everywhere. No breaking changes planned |
| BullMQ 5.0+ | Redis 6.0+ | Redis 7+ strongly recommended for performance |
| Prisma 5.0+ | PostgreSQL 9.6+ | Modern deployments use PG 14+. PG 9.6 unsupported end-2024 |
| Tailwind v4 | React 18+ | Requires latest shadcn/ui components |
| Clerk | Next.js 12+ | Official Next.js SDK. Middleware support for all route types |

## Stack Patterns by Variant

**If you want the fastest time-to-market:**
- Use Next.js with API routes instead of separate Express server
- Skip custom authentication—use Clerk
- Use shadcn/ui for all UI components
- Skip custom testing initially, add Vitest later
- Deploy to Vercel (frontend) + Railway (background jobs)

**If you need maximum flexibility and scale:**
- Separate Express backend + Next.js frontend (current recommendation)
- Self-hosted Redis for BullMQ
- PostgreSQL managed database (AWS RDS or Railway)
- Custom monitoring and error tracking

**If building for team collaboration early:**
- Use Prisma Studio for database visibility
- Implement OpenAPI documentation from day one
- Use shadcn/ui with Figma for design consistency
- Implement Clerk roles/permissions from start

## PropStream Integration Specifics

PropStream provides a REST API. Integration approach:

```typescript
// Use Axios for PropStream API calls
import axios from 'axios';

const propstreamClient = axios.create({
  baseURL: 'https://api.propstream.com/v1',
  headers: {
    'Authorization': `Bearer ${process.env.PROPSTREAM_API_KEY}`
  }
});

// Validate API responses with Zod
import { z } from 'zod';

const PropertySchema = z.object({
  address: z.string(),
  equity: z.number(),
  debt: z.number(),
  interestRate: z.number().optional()
});

// Queue API calls with BullMQ for reliability
const propstreamQueue = new Queue('propstream-polling', {
  connection: redisConnection
});

propstreamQueue.process(async (job) => {
  const response = await propstreamClient.get(`/properties/${job.data.zip}`);
  return PropertySchema.parse(response.data);
});
```

## Team Considerations

- **TypeScript across frontend + backend:** Strong type safety prevents integration bugs
- **No custom authentication:** Let Clerk handle user management, freeing team for business logic
- **Infrastructure as code:** Railway and Render both support git-deployed infrastructure
- **Database migrations:** Prisma migrations version-control schema changes
- **Email reliability:** SendGrid handles bounce management and deliverability—critical for offer sequences

## Sources

- [Alpaca Real Estate: AI in Real Estate Private Equity - Tech Stack Advantages](https://alpacarealestate.com/2025/08/ai-in-real-estate-private-equity-are-tech-stack-as-a-competitive-advantage/)
- [iHomeFinder: Real Estate Tech Stack 2026](https://www.ihomefinder.com/blog/agent-and-broker-resources/real-estate-tech-stack/)
- [Batchdata: Real Estate API Integration Guide](https://batchdata.io/blog/how-to-set-up-real-estate-api-integration/)
- [HouseCanary: Best Real Estate APIs in 2026](https://www.housecanary.com/blog/real-estate-api/)
- [Contentful: NestJS vs Next.js 2025 Guide](https://www.contentful.com/blog/nestjs-vs-nextjs/)
- [StaticMania: Next.js vs Express Ultimate Guide](https://staticmania.com/blog/next-js-vs-express-js/)
- [LogRocket: React vs Vue vs Angular 2025](https://blog.logrocket.com/react-vs-vuejs/)
- [Bytebase: PostgreSQL vs MongoDB 2025](https://www.bytebase.com/blog/postgres-vs-mongodb/)
- [Meerako: Authentication Guide 2025 - JWT, OAuth2, Passwordless](https://www.meerako.com/blogs/ultimate-guide-authentication-jwt-oauth2-passwordless-2025/)
- [Auth0: OAuth 2.0 Express SDK for JWT](https://auth0.com/blog/introducing-oauth2-express-sdk-protecting-api-with-jwt/)
- [Bento: Node.js Email Marketing Integration](https://bentonow.com/nodejs/)
- [Mailtrap: Best Email APIs for Node.js Developers 2026](https://mailtrap.io/blog/best-email-api-for-nodejs-developers/)
- [BullMQ Official Documentation](https://bullmq.io/)
- [Better Stack: BullMQ Job Scheduling Guide](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/)
- [Zod Documentation and TypeScript Validation](https://zod.dev/)
- [LogRocket: Zod TypeScript Validation](https://blog.logrocket.com/schema-validation-typescript-zod/)
- [React Hook Form Official](https://react-hook-form.com/)
- [Medium: React Hook Form vs Formik 2025](https://medium.com/@tejasvinavale1599/the-future-of-forms-react-hook-form-vs-formik-vs-zod-validation-21fda10596b5/)
- [shadcn/ui Official](https://www.shadcn.io/)
- [Vercel Academy: React UI with shadcn/ui + Radix + Tailwind](https://vercel.com/academy/shadcn-ui)
- [Medium: Vitest vs Jest 2025](https://medium.com/@ruverd/jest-vs-vitest-which-test-runner-should-you-use-in-2025-5c85e4f2bda9/)
- [Better Stack: Vitest vs Jest](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/)
- [LogRocket: Best React Chart Libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- [DesignRevision: Vercel vs Railway vs Render 2026](https://designrevision.com/blog/saas-hosting-compared)
- [DEV Community: Railway vs Render vs Heroku 2025](https://dev.to/alex_aslam/deploy-nodejs-apps-like-a-boss-railway-vs-render-vs-heroku-zero-server-stress-5p3)
- [Medium: TypeScript Node.js Production 2025](https://medium.com/@gabrieldrouin/node-js-2025-guide-how-to-setup-express-js-with-typescript-eslint-and-prettier-b342cd21c30d)

---
*Stack research for: Real Estate Deal Sourcing & Wholesale Automation Platform*
*Researched: 2026-02-25*
