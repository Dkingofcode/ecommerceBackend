# 🛒 E-Commerce Backend API

Production-grade e-commerce backend built with Node.js, Express, MongoDB, Redis, and Stripe.

## ✨ Features

- 🔐 **Authentication & Authorization**: JWT-based auth with role-based access control
- 👤 **User Management**: Registration, email verification, password reset
- 📦 **Product Management**: CRUD operations, search, filtering, pagination
- 🛍️ **Shopping Cart**: Add/remove items, apply coupons
- 📋 **Order Management**: Create orders, track status, returns
- 💳 **Payment Integration**: Stripe payment processing
- ⭐ **Reviews & Ratings**: Product reviews with moderation
- 💖 **Wishlist**: Save favorite products
- 📧 **Email Notifications**: Order confirmations, status updates
- 📱 **SMS Notifications**: Optional Twilio integration
- 🖼️ **Image Upload**: Cloudinary integration
- 🔍 **Advanced Search**: Full-text search, filters
- 📊 **Admin Dashboard**: Analytics, reports, user management
- 🚀 **Performance**: Redis caching, compression, rate limiting
- 🔒 **Security**: Helmet, CORS, sanitization, HPP protection
- 📝 **Logging**: Winston with daily log rotation
- 📖 **API Documentation**: Swagger/OpenAPI
- 🐳 **Docker Support**: Ready for containerization

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Cache**: Redis (optional)
- **Payment**: Stripe
- **Storage**: Cloudinary
- **Email**: Nodemailer
- **SMS**: Twilio (optional)
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Express Mongo Sanitize

## 📋 Prerequisites

- Node.js 18 or higher
- MongoDB 7 or higher
- Redis (optional)
- Stripe account
- Cloudinary account
- SMTP server (for emails)

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/ecommerce-backend.git
cd ecommerce-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment setup
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ecommerce
JWT_SECRET=your-super-secret-key-min-64-chars
STRIPE_SECRET_KEY=your-stripe-secret-key
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
EMAIL_USER=your-email@gmail.com
# ... see .env.example for all options
```

### 4. Start MongoDB
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:7

# Or use local MongoDB
mongod
```

### 5. Run the application
```bash
# Development
npm run dev

# Production
npm start
```

### 6. Access the API

- **API**: http://localhost:5000/api/v1
- **Docs**: http://localhost:5000/api/docs
- **Health**: http://localhost:5000/api/v1/health

## 🐳 Docker Deployment
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## 📚 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/verify-email` - Verify email
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password
- `GET /api/v1/auth/me` - Get current user

### Products
- `GET /api/v1/products` - Get all products
- `GET /api/v1/products/:slug` - Get product by slug
- `POST /api/v1/products` - Create product (seller/admin)
- `PUT /api/v1/products/:id` - Update product
- `DELETE /api/v1/products/:id` - Delete product

### Cart
- `GET /api/v1/cart` - Get cart
- `POST /api/v1/cart/items` - Add to cart
- `PUT /api/v1/cart/items/:productId` - Update quantity
- `DELETE /api/v1/cart/items/:productId` - Remove from cart

### Orders
- `GET /api/v1/orders` - Get user orders
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders/:id` - Get order details
- `POST /api/v1/orders/:id/cancel` - Cancel order

### Reviews
- `GET /api/v1/reviews/product/:productId` - Get product reviews
- `POST /api/v1/reviews` - Create review
- `PUT /api/v1/reviews/:id` - Update review
- `DELETE /api/v1/reviews/:id` - Delete review

See [API Documentation](http://localhost:5000/api/docs) for complete endpoint list.

## 🧪 Testing
```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📊 Database Seeding
```bash
# Seed database with sample data
npm run seed
```

## 🔧 Development
```bash
# Run with nodemon
npm run dev

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format
```

## 🚀 Production Deployment

### Environment Variables

Ensure all production environment variables are set:
- Set `NODE_ENV=production`
- Use strong `JWT_SECRET`
- Configure production database
- Enable `ENABLE_RATE_LIMITING=true`
- Set proper CORS origins

### Deploy to Heroku
```bash
heroku create your-app-name
heroku addons:create mongolab
heroku config:set NODE_ENV=production
git push heroku main
```

### Deploy to AWS/DigitalOcean

Use PM2 for process management:
```bash
npm install -g pm2
pm2 start server.js --name ecommerce-api
pm2 save
pm2 startup
```

## 📈 Monitoring

- Logs are stored in `logs/` directory
- Use PM2 for process monitoring
- Set up error tracking (Sentry recommended)
- Monitor database performance

## 🔒 Security Best Practices

- Keep dependencies updated
- Use environment variables for secrets
- Enable HTTPS in production
- Implement rate limiting
- Sanitize user input
- Use helmet for security headers
- Enable CORS properly
- Hash passwords with bcrypt
- Validate JWT tokens

## 📝 License

MIT License - see LICENSE file for details

## 👥 Contributing

Contributions are welcome! Please read CONTRIBUTING.md first.

## 📧 Support

For support, email support@ecommerce.com

## 🙏 Acknowledgments

- Express.js team
- MongoDB team
- Stripe
- All contributors

---

**Built with ❤️ using Node.js**