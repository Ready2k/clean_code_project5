#!/bin/bash

# AWS ECR Build and Push Script for Prompt Library
set -e

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Repository names
FRONTEND_REPO="prompt-library-frontend"
BACKEND_REPO="prompt-library-backend"

# Image tags
TAG=${1:-latest}
FRONTEND_IMAGE="${ECR_REGISTRY}/${FRONTEND_REPO}:${TAG}"
BACKEND_IMAGE="${ECR_REGISTRY}/${BACKEND_REPO}:${TAG}"

echo "🚀 Building and pushing Prompt Library images to ECR..."
echo "Registry: ${ECR_REGISTRY}"
echo "Tag: ${TAG}"

# Login to ECR
echo "📝 Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Create repositories if they don't exist
echo "🏗️  Creating ECR repositories if needed..."
aws ecr describe-repositories --repository-names ${FRONTEND_REPO} --region ${AWS_REGION} 2>/dev/null || \
    aws ecr create-repository --repository-name ${FRONTEND_REPO} --region ${AWS_REGION}

aws ecr describe-repositories --repository-names ${BACKEND_REPO} --region ${AWS_REGION} 2>/dev/null || \
    aws ecr create-repository --repository-name ${BACKEND_REPO} --region ${AWS_REGION}

# Build and push frontend
echo "🔨 Building frontend image..."
cd ../interface
docker build -f docker/production/frontend.Dockerfile -t ${FRONTEND_IMAGE} .

echo "📤 Pushing frontend image..."
docker push ${FRONTEND_IMAGE}

# Build and push backend
echo "🔨 Building backend image..."
docker build -f docker/production/backend.Dockerfile -t ${BACKEND_IMAGE} .

echo "📤 Pushing backend image..."
docker push ${BACKEND_IMAGE}

echo "✅ Successfully built and pushed images:"
echo "   Frontend: ${FRONTEND_IMAGE}"
echo "   Backend: ${BACKEND_IMAGE}"

# Output for use in deployment scripts
echo "FRONTEND_IMAGE=${FRONTEND_IMAGE}" > ../aws/image-uris.env
echo "BACKEND_IMAGE=${BACKEND_IMAGE}" >> ../aws/image-uris.env

echo "🎉 Build and push completed successfully!"