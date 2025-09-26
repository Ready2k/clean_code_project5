#!/bin/bash

# Monitoring Setup Script for Prompt Library
set -e

ENVIRONMENT=${1:-production}
AWS_REGION=${2:-us-east-1}

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Setting up monitoring for ${ENVIRONMENT} environment...${NC}"

# Create CloudWatch Dashboard
cat > /tmp/dashboard.json << EOF
{
    "widgets": [
        {
            "type": "metric",
            "x": 0,
            "y": 0,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/ECS", "CPUUtilization", "ServiceName", "${ENVIRONMENT}-prompt-library-frontend", "ClusterName", "${ENVIRONMENT}-prompt-library-cluster" ],
                    [ ".", ".", "ServiceName", "${ENVIRONMENT}-prompt-library-backend", ".", "." ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "ECS CPU Utilization",
                "period": 300
            }
        },
        {
            "type": "metric",
            "x": 12,
            "y": 0,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/ECS", "MemoryUtilization", "ServiceName", "${ENVIRONMENT}-prompt-library-frontend", "ClusterName", "${ENVIRONMENT}-prompt-library-cluster" ],
                    [ ".", ".", "ServiceName", "${ENVIRONMENT}-prompt-library-backend", ".", "." ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "ECS Memory Utilization",
                "period": 300
            }
        },
        {
            "type": "metric",
            "x": 0,
            "y": 6,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/ApplicationELB", "RequestCount", "LoadBalancer", "${ENVIRONMENT}-prompt-library-alb" ],
                    [ ".", "HTTPCode_Target_2XX_Count", ".", "." ],
                    [ ".", "HTTPCode_Target_4XX_Count", ".", "." ],
                    [ ".", "HTTPCode_Target_5XX_Count", ".", "." ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "Load Balancer Requests",
                "period": 300
            }
        },
        {
            "type": "metric",
            "x": 12,
            "y": 6,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "${ENVIRONMENT}-prompt-library-alb" ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "Response Time",
                "period": 300
            }
        },
        {
            "type": "metric",
            "x": 0,
            "y": 12,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "${ENVIRONMENT}-prompt-library-db" ],
                    [ ".", "DatabaseConnections", ".", "." ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "RDS Metrics",
                "period": 300
            }
        },
        {
            "type": "metric",
            "x": 12,
            "y": 12,
            "width": 12,
            "height": 6,
            "properties": {
                "metrics": [
                    [ "AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${ENVIRONMENT}-prompt-library-redis" ],
                    [ ".", "CurrConnections", ".", "." ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "${AWS_REGION}",
                "title": "Redis Metrics",
                "period": 300
            }
        }
    ]
}
EOF

# Create the dashboard
aws cloudwatch put-dashboard \
    --dashboard-name "${ENVIRONMENT}-prompt-library-dashboard" \
    --dashboard-body file:///tmp/dashboard.json \
    --region "${AWS_REGION}"

echo -e "${GREEN}✅ CloudWatch Dashboard created: ${ENVIRONMENT}-prompt-library-dashboard${NC}"

# Create CloudWatch Alarms
echo -e "${BLUE}🚨 Creating CloudWatch Alarms...${NC}"

# High CPU Alarm for Backend
aws cloudwatch put-metric-alarm \
    --alarm-name "${ENVIRONMENT}-prompt-library-backend-high-cpu" \
    --alarm-description "Backend service high CPU utilization" \
    --metric-name CPUUtilization \
    --namespace AWS/ECS \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --alarm-actions "arn:aws:sns:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):${ENVIRONMENT}-prompt-library-alerts" \
    --dimensions Name=ServiceName,Value="${ENVIRONMENT}-prompt-library-backend" Name=ClusterName,Value="${ENVIRONMENT}-prompt-library-cluster" \
    --region "${AWS_REGION}"

# High Memory Alarm for Backend
aws cloudwatch put-metric-alarm \
    --alarm-name "${ENVIRONMENT}-prompt-library-backend-high-memory" \
    --alarm-description "Backend service high memory utilization" \
    --metric-name MemoryUtilization \
    --namespace AWS/ECS \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --alarm-actions "arn:aws:sns:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):${ENVIRONMENT}-prompt-library-alerts" \
    --dimensions Name=ServiceName,Value="${ENVIRONMENT}-prompt-library-backend" Name=ClusterName,Value="${ENVIRONMENT}-prompt-library-cluster" \
    --region "${AWS_REGION}"

# High Error Rate Alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "${ENVIRONMENT}-prompt-library-high-error-rate" \
    --alarm-description "High 5XX error rate" \
    --metric-name HTTPCode_Target_5XX_Count \
    --namespace AWS/ApplicationELB \
    --statistic Sum \
    --period 300 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --alarm-actions "arn:aws:sns:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):${ENVIRONMENT}-prompt-library-alerts" \
    --dimensions Name=LoadBalancer,Value="${ENVIRONMENT}-prompt-library-alb" \
    --region "${AWS_REGION}"

# Database CPU Alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "${ENVIRONMENT}-prompt-library-db-high-cpu" \
    --alarm-description "Database high CPU utilization" \
    --metric-name CPUUtilization \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --alarm-actions "arn:aws:sns:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):${ENVIRONMENT}-prompt-library-alerts" \
    --dimensions Name=DBInstanceIdentifier,Value="${ENVIRONMENT}-prompt-library-db" \
    --region "${AWS_REGION}"

echo -e "${GREEN}✅ CloudWatch Alarms created${NC}"

# Clean up temp file
rm -f /tmp/dashboard.json

echo -e "${GREEN}📊 Monitoring setup completed!${NC}"
echo -e "${GREEN}Dashboard URL: https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#dashboards:name=${ENVIRONMENT}-prompt-library-dashboard${NC}"