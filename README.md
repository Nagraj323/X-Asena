# X-Asena Bot

> 🚧 **Active Development Branch: `baileys_7`** 🚧
> 
> This branch represents ongoing development work to modernize X-Asena with the latest Baileys library (v7) and production-ready database architecture.

X-Asena is a powerful and versatile WhatsApp bot built using Node.js and the Baileys library. This bot offers a wide range of features and capabilities, making it an excellent choice for both personal and commercial use cases.

## ⚡ What's New in This Branch

This development branch introduces **major architectural improvements** for production deployments:

### 🔐 Database-Based Authentication State
- **Replaces file-based auth** with a robust database solution
- **Production-ready** with retry logic, mutex locks, and error handling
- **Simplified API** - direct drop-in replacement for `useMultiFileAuthState`
- **Works with SQLite** (development) and **PostgreSQL** (production)
- **Thread-safe** operations for multi-instance deployments

### 📦 Key Improvements
- ✅ Upgraded to **Baileys v7** (latest)
- ✅ Database authentication state for scalability
- ✅ Enhanced error handling and retry mechanisms
- ✅ Better buffer serialization for crypto operations
- ✅ Atomic database operations with proper locking
- ✅ Comprehensive logging and debugging

[![DigitalOcean Referral Badge](https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%203.svg)](https://www.digitalocean.com/?refcode=9db4c65bb8ee&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge)

🚀 Deploy your X-Asena Bot on DigitalOcean and get $200 in free credits! Perfect for production deployments with our new database-backed authentication!

## 📑 Table of Contents

- [Why Database Authentication?](#why-database-authentication)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Quick Start](#quick-start)
- [New Architecture](#new-architecture)
  - [Database Authentication State](#database-authentication-state)
  - [Benefits Over File-Based Storage](#benefits-over-file-based-storage)
- [Development Status](#development-status)
- [Usage](#usage)
  - [Creating a Plugin](#creating-a-plugin)
  - [Sending Messages](#sending-messages)
- [External Plugins](#external-plugins)
- [Migration Guide](#migration-guide)
- [Community and Support](#community-and-support)
- [Contributing](#contributing)
- [Documentation](#documentation)
- [Credits](#credits)
- [License](#license)

## 🤔 Why Database Authentication?

### The Problem with File-Based Storage
The original Baileys `useMultiFileAuthState` stores authentication data in files, which creates issues:
- ❌ Doesn't work well in containerized environments (Docker, Kubernetes)
- ❌ Difficult to scale horizontally
- ❌ No built-in backup/restore mechanisms
- ❌ Race conditions in multi-instance setups
- ❌ File system dependencies

### Our Database Solution
We've implemented a **production-ready database authentication state** that:
- ✅ **Scales effortlessly** - works in Docker, Kubernetes, serverless
- ✅ **Thread-safe** - mutex locks prevent race conditions
- ✅ **Reliable** - automatic retry with exponential backoff
- ✅ **Flexible** - supports SQLite, PostgreSQL, MySQL
- ✅ **Maintainable** - easy backup, restore, and debugging
- ✅ **Compatible** - drop-in replacement for file-based auth

### Why This Matters
This architectural change makes X-Asena suitable for:
- 🏢 **Enterprise deployments** with multiple instances
- ☁️ **Cloud platforms** (AWS, GCP, Azure, DigitalOcean)
- 🐳 **Containerized environments** (Docker, Kubernetes)
- 📈 **Scalable architectures** with load balancing
- 🔄 **High availability** setups with redundancy

## 🚀 Installation

### Prerequisites

Before installing X-Asena, ensure you have:

- **Node.js** (v18 or higher)
- **FFmpeg** (for media processing)
- **Git** (for cloning the repository)

### Quick Start

```bash
# Clone the repository (baileys_7 branch)
git clone -b baileys_7 https://github.com/Neeraj-x0/X-Asena.git
cd X-Asena

# Install dependencies
npm install

# Install additional required packages
npm install sqlite3 async-mutex

# Optional: Install PM2 for process management
npm install pm2 -g

# Start the bot
npm start
```

### First Run
On the first run:
1. The bot will create a new database (`database.db`)
2. A QR code will be displayed in the terminal
3. Scan it with WhatsApp to link your device
4. Authentication data is automatically saved to the database


## 🏗️ New Architecture

### Database Authentication State

The new authentication system is built around `useMultiDbAuthState()`:

```javascript
// Old file-based approach
const { state, saveCreds } = await useMultiFileAuthState('./auth_folder');

// New database approach (same interface!)
const { state, saveCreds } = await useMultiDbAuthState();
```

**Key Features:**

1. **Automatic Retry Logic**
   - 3 retry attempts with exponential backoff
   - Smart error categorization
   - Graceful degradation on failures

2. **Thread-Safe Operations**
   - Per-key mutex locks
   - No race conditions
   - Safe for concurrent access

3. **Enhanced Buffer Handling**
   - Proper serialization of crypto buffers
   - Support for Uint8Array, Buffer, and plain objects
   - Base64 encoding for efficient storage

4. **Database Optimizations**
   - Atomic `upsert` operations
   - Indexed queries for fast lookups
   - Connection pooling via Sequelize

5. **Proto Message Support**
   - Full Baileys protocol compatibility
   - Automatic proto conversion
   - App-state-sync-key handling

### Benefits Over File-Based Storage

| Feature | File-Based | Database-Based |
|---------|-----------|----------------|
| **Containerization** | ❌ Requires volume mounts | ✅ Works seamlessly |
| **Horizontal Scaling** | ❌ File conflicts | ✅ Built-in support |
| **Backup/Restore** | ⚠️ Manual process | ✅ Database-level tools |
| **Multi-Instance** | ❌ Race conditions | ✅ Thread-safe locks |
| **Cloud Deployment** | ⚠️ Complicated | ✅ Simple and reliable |
| **Error Recovery** | ❌ Manual intervention | ✅ Automatic retry |
| **Debugging** | ⚠️ File inspection | ✅ SQL queries |
| **Performance** | ⚠️ File I/O overhead | ✅ Optimized queries |

## 🔨 Development Status

This branch is under **active development**. Here's what's been done and what's coming:

### ✅ Completed

- [x] Implemented database authentication state
- [x] Added retry mechanism with exponential backoff
- [x] Thread-safe operations with mutex locks
- [x] Enhanced buffer serialization
- [x] Atomic database operations
- [x] Comprehensive error handling
- [x] SQLite and PostgreSQL support
- [x] Documentation and examples

### 🚧 In Progress
- [ ] Upgrading to Baileys v7
- [ ] Plugin system migration to new architecture
- [ ] Enhanced message handling
- [ ] Media optimization for database storage
- [ ] Performance benchmarking
- [ ] Integration tests

### 📋 Planned
- [ ] Redis caching layer
- [ ] Multi-device support
- [ ] Enhanced plugin API
- [ ] Web dashboard for management
- [ ] Docker compose setup
- [ ] Kubernetes deployment manifests


## 🔄 Migration Guide

### From Main Branch to baileys_7

If you're migrating from the main branch:

1. **Backup your data**
   ```bash
   cp -r auth_folder auth_folder_backup
   ```

2. **Pull the new branch**
   ```bash
   git fetch origin baileys_7
   git checkout baileys_7
   ```

3. **Install new dependencies**
   ```bash
   npm install
   npm install sqlite3 async-mutex
   ```

4. **Clear old auth and restart**
   ```bash
   rm -rf auth_folder
   npm start
   # Scan QR code again
   ```

The database will be created automatically on first run!

### Configuration Changes

Update your `config.js` if needed:
```javascript
// The DATABASE_URL can point to SQLite or PostgreSQL
DATABASE_URL: process.env.DATABASE_URL || "./database.db"
```

For PostgreSQL:
```javascript
DATABASE_URL: "postgresql://user:password@localhost:5432/xasena"
```

## 🤝 Community and Support

Join our WhatsApp group for support, discussions, and updates:

[![JOIN WHATSAPP GROUP](https://raw.githubusercontent.com/Neeraj-x0/Neeraj-x0/main/photos/suddidina-join-whatsapp.png)](https://chat.whatsapp.com/DJYrdBENyX33MRppEFPxV6)

### Getting Help
- 💬 **WhatsApp Group**: Quick community support
- 🐛 **GitHub Issues**: Bug reports and feature requests
- 📖 **Wiki**: Detailed documentation (coming soon)
- 💡 **Discussions**: Ideas and questions

## 🌟 Contributing

We welcome contributions, especially during **Hacktoberfest 2024**!

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Test thoroughly**
   ```bash
   npm start
   ```
5. **Commit your changes**
   ```bash
   git commit -m "Add amazing feature"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Contribution Areas

- 🐛 Bug fixes (check issues labeled `bug`)
- ✨ New features (check issues labeled `enhancement`)
- 📝 Documentation improvements
- 🧪 Writing tests
- 🎨 UI/UX improvements
- 🌐 Translations

### Development Guidelines

- Follow existing code style
- Write meaningful commit messages
- Test your changes before submitting
- Update documentation as needed
- Be respectful and collaborative

## 📚 Documentation

Detailed documentation is available in the following files:

- **[AUTH_STATE_IMPROVEMENTS.md](./AUTH_STATE_IMPROVEMENTS.md)** - Technical deep-dive into the new auth system
- **[SIMPLIFIED_AUTH_STATE.md](./SIMPLIFIED_AUTH_STATE.md)** - Quick guide and API reference
- **[example-auth-usage.js](./example-auth-usage.js)** - Complete working example

### API Reference

See the documentation files for:
- Database schema details
- Error handling strategies
- Performance considerations
- Deployment best practices
- Troubleshooting guide

## 💡 Example Projects

Check out these examples:

1. **Basic Bot** - `example-auth-usage.js`
2. **Plugin Development** - `src/plugins/` directory
3. **Custom Commands** - See existing plugins for reference

## 🔧 Troubleshooting

### Common Issues

**Issue: Database locked errors**
```bash
# Solution: Automatic retry handles this, but if persistent:
rm database.db
npm start
```

**Issue: QR code not showing**
```bash
# Solution: Install qrcode-terminal
npm install qrcode-terminal
```

**Issue: "No existing credentials found"**
```
# This is normal on first run - just scan the QR code
```

**Issue: Connection keeps dropping**
```bash
# Check your internet connection and try:
npm start
```

### Debug Mode

Enable debug logging:
```javascript
// In config.js
LOGS: true
```

## 🎯 Roadmap

### Short Term (v4.1)
- [ ] Stabilize database authentication
- [ ] Complete plugin migration
- [ ] Add integration tests
- [ ] Docker support

### Medium Term (v4.2)
- [ ] Redis caching
- [ ] Web dashboard
- [ ] Multi-device support
- [ ] Enhanced media handling

### Long Term (v4.3)
- [ ] Microservices architecture
- [ ] Kubernetes deployment
- [ ] Advanced analytics

## 🏆 Credits

**X-Asena** is created and maintained by:
- **Neeraj-X0** - Current maintainer 
- **Contributors** - All the amazing people who contribute to this project

Special thanks to:
- [WhiskeySockets/Baileys](https://github.com/WhiskeySockets/Baileys) - The WhatsApp Web API library
- The open-source community

## 📄 License

X-Asena is licensed under the **MIT License**:

```
MIT License

Copyright (c) 2023-2025 X-Electra, Neeraj-X0

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">

### ⭐ Star this repository if you find it useful!

**Made with ❤️ by the X-Asena Team**

[Report Bug](https://github.com/Neeraj-x0/X-Asena/issues) · [Request Feature](https://github.com/Neeraj-x0/X-Asena/issues) · [Join Community](https://chat.whatsapp.com/DJYrdBENyX33MRppEFPxV6)

</div>
