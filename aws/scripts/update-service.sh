#!/bin/bash

# Update ECS Service Script for Prompt Library
set -e

# Configuration
ENVIRONMENT=${1:-production}
SERVICE_NAME=${2:-backend}  # frontend or backend
AWS_REGION=${AWS_REGION:-us-east-1}

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ "$SERVICE_NAME" != "frontend" ] && [ "$SERVICE_NAME" != "backend" ]; then
    echo "Usage: $0 [environment] [frontend|backend]"
    echo "Example: $0 production backend"
    exit 1
fi

echo -e "${BLUE}🔄 Updating ${SERVICE_NAME} service in ${ENVIRONMENT} environment...${NC}"

# Build and push new image
echo -e "${BLUE}🔨 Building and pushing new ${SERVICE_NAME} image...${NC}"
../build-and-push.sh latest

# Load image URIs
source ../image-uris.env

# Get current task definition
CLUSTER_NAME="${ENVIRONMENT}-prompt-library-cluster"
SERVICE_FULL_NAME="${ENVIRONMENT}-prompt-library-${SERVICE_NAME}"

echo -e "${BLUE}📋 Getting current task definition...${NC}"
TASK_DEFINITION_ARN=$(aws ecs describe-services \
    --cluster "${CLUSTER_NAME}" \
    --services "${SERVICE_FULL_NAME}" \
    --query 'services[0].taskDefinition' \
    --output text \
    --region "${AWS_REGION}")

# Get task definition details
TASK_DEF_JSON=$(aws ecs describe-task-definition \
    --task-definition "${TASK_DEFINITION_ARN}" \
    --region "${AWS_REGION}")

# Extract task definition without revision-specific fields
NEW_TASK_DEF=$(echo "${TASK_DEF_JSON}" | jq '.taskDefinition | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy)')

# Update image URI based on service type
if [ "$SERVICE_NAME" = "frontend" ]; then
    NEW_TASK_DEF=$(echo "${NEW_TASK_DEF}" | jq --arg image "${FRONTEND_IMAGE}" '.containerDefinitions[0].image = $image')
else
    NEW_TASK_DEF=$(echo "${NEW_TASK_DEF}" | jq --arg image "${BACKEND_IMAGE}" '.containerDefinitions[0].image = $image')
fi

# Write updated task definition to temp file
echo "${NEW_TASK_DEF}" > /tmp/updated-task-def.json

# Register new task definition
echo -e "${BLUE}📝 Registering new task definition...${NC}"
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file:///tmp/updated-task-def.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text \
    --region "${AWS_REGION}")

echo -e "${GREEN}✅ New task definition registered: ${NEW_TASK_DEF_ARN}${NC}"

# Update service
echo -e "${BLUE}🚀 Updating service...${NC}"
aws ecs update-service \
    --cluster "${CLUSTER_NAME}" \
    --service "${SERVICE_FULL_NAME}" \
    --task-definition "${NEW_TASK_DEF_ARN}" \
    --region "${AWS_REGION}" > /dev/null

echo -e "${GREEN}✅ Service update initiated${NC}"

# Wait for deployment to complete
echo -e "${BLUE}⏳ Waiting for deployment to complete...${NC}"
aws ecs wait services-stable \
    --cluster "${CLUSTER_NAME}" \
    --services "${SERVICE_FULL_NAME}" \
    --region "${AWS_REGION}"

# Get deployment status
DEPLOYMENT_STATUS=$(aws ecs describe-services \
    --cluster "${CLUSTER_NAME}" \
    --services "${SERVICE_FULL_NAME}" \
    --query 'services[0].deployments[0].status' \
    --output text \
    --region "${AWS_REGION}")

if [ "$DEPLOYMENT_STATUS" = "PRIMARY" ]; then
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    
    # Show running tasks
    echo -e "${BLUE}📊 Current running tasks:${NC}"
    aws ecs list-tasks \
        --cluster "${CLUSTER_NAME}" \
        --service-name "${SERVICE_FULL_NAME}" \
        --query 'taskArns' \
        --output table \
        --region "${AWS_REGION}"
else
    echo -e "${YELLOW}⚠️  Deployment status: ${DEPLOYMENT_STATUS}${NC}"
    echo -e "${YELLOW}Check AWS Console for more details${NC}"
fi

# Clean up temp file
rm -f /tmp/updated-task-def.json

echo -e "${GREEN}✅ Service update completed!${NC}"