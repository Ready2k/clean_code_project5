# AWS Deployment Guide - Prompt Library

## Quick Start

### Prerequisites
1. **AWS CLI configured** with appropriate permissions
2. **Docker installed** and running
3. **Domain name** ready for SSL certificate
4. **AWS Account** with sufficient permissions

### One-Command Deployment
```bash
cd aws/scripts
./deploy.sh production your-domain.com
```

This will:
- Build and push Docker images to ECR
- Deploy infrastructure (VPC, RDS, Redis, EFS, ALB)
- Deploy application (ECS services, task definitions)
- Set up monitoring and alarms
- Configure SSL certificates

## Step-by-Step Deployment

### 1. Prepare Environment
```bash
# Clone and navigate to project
git clone <your-repo>
cd prompt-library/aws

# Configure AWS CLI
aws configure
```

### 2. Build and Push Images
```bash
cd scripts
./build-and-push.sh latest
```

### 3. Deploy Infrastructure
```bash
aws cloudformation deploy \
    --template-file ../cloudformation/infrastructure.yml \
    --stack-name production-prompt-library-infra \
    --parameter-overrides \
        Environment=production \
        DatabasePassword=YourSecurePassword123 \
        RedisPassword=YourRedisPassword123 \
        DomainName=your-domain.com \
    --capabilities CAPABILITY_IAM
```

### 4. Deploy Application
```bash
# Load image URIs from previous step
source ../image-uris.env

aws cloudformation deploy \
    --template-file ../cloudformation/application.yml \
    --stack-name production-prompt-library-app \
    --parameter-overrides \
        Environment=production \
        FrontendImageURI=$FRONTEND_IMAGE \
        BackendImageURI=$BACKEND_IMAGE \
        DatabasePassword=YourSecurePassword123 \
        RedisPassword=YourRedisPassword123 \
        JWTSecret=YourJWTSecret32CharactersLong123 \
        EncryptionKey=YourEncryptionKey32CharsLong123 \
        DomainName=your-domain.com \
    --capabilities CAPABILITY_IAM
```

### 5. Configure DNS
Point your domain to the Application Load Balancer DNS name:
```bash
# Get ALB DNS name
aws cloudformation describe-stacks \
    --stack-name production-prompt-library-infra \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNSName`].OutputValue' \
    --output text
```

Create a CNAME record:
```
your-domain.com -> alb-dns-name-from-above.us-east-1.elb.amazonaws.com
```

## Architecture Overview

```
Internet
    ↓
Application Load Balancer (ALB)
    ↓
ECS Fargate Services
├── Frontend (React) - Port 3000
└── Backend (Node.js) - Port 8000
    ↓
├── RDS PostgreSQL (Private)
├── ElastiCache Redis (Private)
└── EFS Storage (Private)
```

## Cost Breakdown

| Service | Instance Type | Monthly Cost |
|---------|---------------|--------------|
| ECS Fargate | 2x Frontend + 2x Backend | ~$50-100 |
| RDS PostgreSQL | db.t3.micro | ~$15 |
| ElastiCache Redis | cache.t3.micro | ~$15 |
| Application Load Balancer | Standard | ~$20 |
| EFS | 5GB storage | ~$5 |
| Data Transfer | Moderate usage | ~$10 |
| **Total** | | **~$115-165/month** |

## Scaling Configuration

### Auto Scaling
- **CPU Target**: 70%
- **Min Capacity**: 2 instances per service
- **Max Capacity**: 10 instances per service

### Database Scaling
- **Storage**: Auto-scaling enabled (20GB → 100GB)
- **Read Replicas**: Can be added for read-heavy workloads

## Security Features

✅ **Network Security**
- Private subnets for all data services
- Security groups with least privilege access
- VPC Flow Logs enabled

✅ **Data Security**
- RDS encryption at rest
- EFS encryption at rest
- SSL/TLS for all traffic
- Secrets stored in AWS Secrets Manager

✅ **Application Security**
- Non-root containers
- Read-only file systems where possible
- IAM roles with minimal permissions

## Monitoring & Alerts

### CloudWatch Dashboard
- ECS CPU/Memory utilization
- Load balancer metrics
- Database performance
- Redis metrics

### Alarms
- High CPU utilization (>80%)
- High memory utilization (>80%)
- High error rates (>10 5XX errors)
- Database CPU (>80%)

## Maintenance Operations

### Update Application
```bash
# Update backend service
./update-service.sh production backend

# Update frontend service
./update-service.sh production frontend
```

### Database Backup
- **Automated**: 7-day retention
- **Manual**: Create snapshot before major updates

### Log Management
- **Retention**: 30 days in CloudWatch
- **Access**: Via AWS Console or CLI

## Troubleshooting

### Common Issues

**1. SSL Certificate Validation**
```bash
# Check certificate status
aws acm describe-certificate --certificate-arn <cert-arn>
```

**2. Service Health**
```bash
# Check ECS service status
aws ecs describe-services --cluster production-prompt-library-cluster --services production-prompt-library-backend
```

**3. Database Connectivity**
```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier production-prompt-library-db
```

### Logs Access
```bash
# View application logs
aws logs tail /ecs/production-prompt-library-backend --follow

# View frontend logs
aws logs tail /ecs/production-prompt-library-frontend --follow
```

## Cleanup

### Delete Everything
```bash
# Delete application stack
aws cloudformation delete-stack --stack-name production-prompt-library-app

# Wait for completion, then delete infrastructure
aws cloudformation delete-stack --stack-name production-prompt-library-infra

# Delete ECR repositories
aws ecr delete-repository --repository-name prompt-library-frontend --force
aws ecr delete-repository --repository-name prompt-library-backend --force
```

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review CloudFormation events
3. Verify security group rules
4. Check ECS service events

## Next Steps

After successful deployment:
1. Set up CI/CD pipeline
2. Configure backup monitoring
3. Set up log aggregation
4. Implement blue/green deployments
5. Add performance monitoring