#!/bin/bash

# AWS Deployment Script for Prompt Library
set -e

# Configuration
ENVIRONMENT=${1:-production}
AWS_REGION=${AWS_REGION:-us-east-1}
DOMAIN_NAME=${2:-promptlibrary.com}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting AWS deployment for Prompt Library${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"
echo -e "${BLUE}Domain: ${DOMAIN_NAME}${NC}"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ AWS CLI not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✅ AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"

# Function to prompt for secure input
prompt_secure() {
    local prompt="$1"
    local var_name="$2"
    echo -n -e "${YELLOW}${prompt}: ${NC}"
    read -s value
    echo
    eval "${var_name}='${value}'"
}

# Collect secure parameters
echo -e "${YELLOW}📝 Please provide the following secure parameters:${NC}"
prompt_secure "Database Password (min 8 chars)" DATABASE_PASSWORD
prompt_secure "Redis Password (min 8 chars)" REDIS_PASSWORD
prompt_secure "JWT Secret (min 32 chars)" JWT_SECRET
prompt_secure "Encryption Key (min 32 chars)" ENCRYPTION_KEY

# Validate input lengths
if [ ${#DATABASE_PASSWORD} -lt 8 ]; then
    echo -e "${RED}❌ Database password must be at least 8 characters${NC}"
    exit 1
fi

if [ ${#JWT_SECRET} -lt 32 ]; then
    echo -e "${RED}❌ JWT secret must be at least 32 characters${NC}"
    exit 1
fi

if [ ${#ENCRYPTION_KEY} -lt 32 ]; then
    echo -e "${RED}❌ Encryption key must be at least 32 characters${NC}"
    exit 1
fi

# Step 1: Build and push Docker images
echo -e "${BLUE}🔨 Step 1: Building and pushing Docker images...${NC}"
./build-and-push.sh latest

# Load image URIs
if [ -f "../image-uris.env" ]; then
    source ../image-uris.env
    echo -e "${GREEN}✅ Loaded image URIs${NC}"
else
    echo -e "${RED}❌ Image URIs file not found. Build may have failed.${NC}"
    exit 1
fi

# Step 2: Deploy infrastructure
echo -e "${BLUE}🏗️  Step 2: Deploying infrastructure...${NC}"
aws cloudformation deploy \
    --template-file ../cloudformation/infrastructure.yml \
    --stack-name "${ENVIRONMENT}-prompt-library-infra" \
    --parameter-overrides \
        Environment="${ENVIRONMENT}" \
        DatabasePassword="${DATABASE_PASSWORD}" \
        RedisPassword="${REDIS_PASSWORD}" \
        DomainName="${DOMAIN_NAME}" \
    --capabilities CAPABILITY_IAM \
    --region "${AWS_REGION}" \
    --tags \
        Environment="${ENVIRONMENT}" \
        Project="prompt-library" \
        ManagedBy="cloudformation"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Infrastructure deployment completed${NC}"
else
    echo -e "${RED}❌ Infrastructure deployment failed${NC}"
    exit 1
fi

# Step 3: Deploy application
echo -e "${BLUE}🚀 Step 3: Deploying application...${NC}"
aws cloudformation deploy \
    --template-file ../cloudformation/application.yml \
    --stack-name "${ENVIRONMENT}-prompt-library-app" \
    --parameter-overrides \
        Environment="${ENVIRONMENT}" \
        FrontendImageURI="${FRONTEND_IMAGE}" \
        BackendImageURI="${BACKEND_IMAGE}" \
        DatabasePassword="${DATABASE_PASSWORD}" \
        RedisPassword="${REDIS_PASSWORD}" \
        JWTSecret="${JWT_SECRET}" \
        EncryptionKey="${ENCRYPTION_KEY}" \
        DomainName="${DOMAIN_NAME}" \
    --capabilities CAPABILITY_IAM \
    --region "${AWS_REGION}" \
    --tags \
        Environment="${ENVIRONMENT}" \
        Project="prompt-library" \
        ManagedBy="cloudformation"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Application deployment completed${NC}"
else
    echo -e "${RED}❌ Application deployment failed${NC}"
    exit 1
fi

# Step 4: Get deployment information
echo -e "${BLUE}📋 Step 4: Getting deployment information...${NC}"

# Get Load Balancer DNS name
ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name "${ENVIRONMENT}-prompt-library-infra" \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNSName`].OutputValue' \
    --output text \
    --region "${AWS_REGION}")

# Get SSL Certificate ARN
CERT_ARN=$(aws cloudformation describe-stacks \
    --stack-name "${ENVIRONMENT}-prompt-library-app" \
    --query 'Stacks[0].Outputs[?OutputKey==`SSLCertificateArn`].OutputValue' \
    --output text \
    --region "${AWS_REGION}")

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📍 Load Balancer DNS: ${ALB_DNS}${NC}"
echo -e "${GREEN}🔒 SSL Certificate ARN: ${CERT_ARN}${NC}"
echo -e "${GREEN}🌐 Application URL: https://${DOMAIN_NAME}${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "${YELLOW}📝 Next Steps:${NC}"
echo -e "${YELLOW}1. Update your DNS records to point ${DOMAIN_NAME} to ${ALB_DNS}${NC}"
echo -e "${YELLOW}2. Wait for SSL certificate validation (may take a few minutes)${NC}"
echo -e "${YELLOW}3. Test the application at https://${DOMAIN_NAME}${NC}"
echo -e "${YELLOW}4. Monitor the deployment in AWS Console${NC}"

# Step 5: Create monitoring dashboard
echo -e "${BLUE}📊 Step 5: Setting up monitoring...${NC}"
./setup-monitoring.sh "${ENVIRONMENT}" "${AWS_REGION}"

echo -e "${GREEN}✅ Full deployment completed!${NC}"