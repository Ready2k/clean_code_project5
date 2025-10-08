# Setup Local PostgreSQL for Prompt Library

## Install PostgreSQL

### macOS (using Homebrew):
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows:
Download and install from https://www.postgresql.org/download/windows/

## Setup Database

1. **Create user and database:**
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create user and database
CREATE USER postgres WITH PASSWORD 'password';
CREATE DATABASE promptlib OWNER postgres;
GRANT ALL PRIVILEGES ON DATABASE promptlib TO postgres;
\q
```

2. **Test connection:**
```bash
psql -h localhost -U postgres -d promptlib
```

## Install Redis (also required)

### macOS:
```bash
brew install redis
brew services start redis
```

### Ubuntu/Debian:
```bash
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Windows:
Download from https://github.com/microsoftarchive/redis/releases