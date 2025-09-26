# AWS Deployment Guide

This directory contains all the necessary files to deploy the Prompt Library system to AWS using ECS Fargate.

## Architecture Overview

- **ECS Fargate**: Container orchestration for frontend and backend services
- **RDS PostgreSQL**: Managed database service
- **ElastiCache Redis**: Managed caching service
- **Application Load Balancer**: Traffic distribution and SSL termination
- **EFS**: Persistent storage for prompt data
- **ECR**: Container registry for Docker images
- **CloudWatch**: Logging and monitoring
- **Secrets Manager**: Secure storage for sensitive configuration

## Deployment Steps

1. **Prerequisites Setup**
   ```bash
   # Install AWS CLI and configure credentials
   aws configure
   
   # Install Terraform (if using Terraform approach)
   # Or use AWS CDK/CloudFormation
   ```

2. **Build and Push Docker Images**
   ```bash
   ./aws/scripts/build-and-push.sh
   ```

3. **Deploy Infrastructure**
   ```bash
   # Using CloudFormation
   aws cloudformation deploy --template-file aws/cloudformation/infrastructure.yml --stack-name prompt-library-infra
   
   # Or using Terraform
   cd aws/terraform
   terraform init
   terraform plan
   terraform apply
   ```

4. **Deploy Application**
   ```bash
   aws cloudformation deploy --template-file aws/cloudformation/application.yml --stack-name prompt-library-app
   ```

## Directory Structure

- `cloudformation/` - CloudFormation templates
- `terraform/` - Terraform configuration (alternative to CloudFormation)
- `scripts/` - Deployment and utility scripts
- `ecs/` - ECS task definitions and service configurations
- `monitoring/` - CloudWatch dashboards and alarms
- `secrets/` - Secret management configurations

## Cost Estimation

Estimated monthly costs for production deployment:
- ECS Fargate: ~$50-100/month
- RDS PostgreSQL (db.t3.micro): ~$15/month
- ElastiCache Redis (cache.t3.micro): ~$15/month
- Application Load Balancer: ~$20/month
- EFS: ~$5/month (for 5GB)
- Data transfer and other services: ~$10/month

**Total estimated cost: ~$115-165/month**

## Security Considerations

- All services run in private subnets
- Database and Redis are not publicly accessible
- SSL/TLS encryption for all traffic
- Secrets stored in AWS Secrets Manager
- IAM roles with least privilege access
- VPC Flow Logs enabled for network monitoring