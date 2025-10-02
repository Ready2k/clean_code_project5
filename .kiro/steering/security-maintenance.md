---
inclusion: always
---

# Security and Maintenance Standards

## Security Audit Process

### Regular Security Audits
- Run `npm audit` weekly across all packages
- Address all HIGH and CRITICAL vulnerabilities immediately
- Review and update MODERATE vulnerabilities within 30 days
- Document security decisions and exceptions

### Dependency Management
- Update dependencies monthly using `npm update`
- Test all updates in development environment before production
- Use exact versions for critical security packages
- Remove unused dependencies to reduce attack surface
- Monitor security advisories for used packages

### Code Security Standards
- Use TypeScript strict mode for type safety
- Implement proper input validation and sanitization
- Never use `eval()` or similar dynamic code execution
- Avoid `any` types - use proper TypeScript interfaces
- Use secure random number generation (`crypto.randomBytes`)
- Implement proper error handling without information leakage

## Package Update Strategy

### Update Frequency
- **Security updates**: Immediate (within 24 hours)
- **Major version updates**: Monthly review cycle
- **Minor/patch updates**: Bi-weekly
- **Development dependencies**: Monthly

### Update Process
1. **Review changelog** for breaking changes
2. **Update in development** environment first
3. **Run full test suite** including integration tests
4. **Verify build processes** work correctly
5. **Test application functionality** manually
6. **Deploy to staging** for final verification
7. **Update production** with proper rollback plan

### Version Pinning Strategy
- Pin exact versions for security-critical packages
- Use caret ranges (^) for stable, well-maintained packages
- Use tilde ranges (~) for packages with frequent updates
- Lock file (`package-lock.json`) must be committed

## Code Quality Maintenance

### Linting and Formatting
- Use ESLint 9.x with modern flat configuration
- Enforce TypeScript strict mode rules
- Use Prettier for consistent code formatting
- Run linting in CI/CD pipeline
- Fix all linting errors before merging

### TypeScript Standards
- Use TypeScript 5.9.3+ for latest features
- Enable all strict mode flags in `tsconfig.json`
- Use proper type definitions instead of `any`
- Document complex types with JSDoc comments
- Use branded types for domain-specific values

### Testing Standards
- Maintain >90% test coverage
- Use Vitest 3.2.4+ for modern testing features
- Write integration tests for all API endpoints
- Mock external dependencies properly
- Test error conditions and edge cases

## Build and Deployment Security

### Build Process
- Use Vite 7.1.8+ for secure build tooling
- Enable source maps for debugging (development only)
- Minify and optimize production builds
- Remove development dependencies from production
- Verify build reproducibility

### Container Security
- Use official, minimal base images
- Run containers as non-root users
- Scan images for vulnerabilities
- Keep base images updated
- Use multi-stage builds to reduce image size

### Environment Security
- Use separate configurations for dev/staging/production
- Never include secrets in Docker images
- Use environment variables for configuration
- Implement proper secret management
- Rotate secrets regularly

## Monitoring and Alerting

### Security Monitoring
- Monitor authentication failures and suspicious activity
- Log all security-relevant events
- Implement rate limiting and abuse detection
- Monitor for unusual API usage patterns
- Set up alerts for security events

### Performance Monitoring
- Monitor application performance metrics
- Track database query performance
- Monitor memory and CPU usage
- Set up alerts for performance degradation
- Regular performance testing

### Dependency Monitoring
- Use automated tools to monitor for new vulnerabilities
- Subscribe to security advisories for critical packages
- Implement automated dependency updates where safe
- Regular review of dependency tree for unused packages

## Incident Response

### Security Incident Process
1. **Immediate assessment** of impact and scope
2. **Containment** of the security issue
3. **Investigation** to understand root cause
4. **Remediation** with proper testing
5. **Communication** to stakeholders
6. **Post-incident review** and process improvement

### Rollback Procedures
- Maintain ability to rollback to previous version quickly
- Test rollback procedures regularly
- Document rollback steps for each component
- Implement database migration rollback strategies
- Maintain communication plan for rollbacks

## Compliance and Documentation

### Security Documentation
- Maintain security architecture documentation
- Document all security controls and their purpose
- Keep incident response procedures up to date
- Document security testing procedures
- Maintain security training materials

### Audit Trail
- Log all administrative actions
- Maintain change logs for security-relevant changes
- Document security decisions and rationale
- Keep records of security testing and audits
- Maintain compliance documentation as required

## Tools and Automation

### Security Tools
- **npm audit** for dependency vulnerability scanning
- **ESLint** with security rules for code analysis
- **TypeScript** strict mode for type safety
- **Prettier** for consistent code formatting
- **Vitest** for comprehensive testing

### Automation
- Automated security scanning in CI/CD pipeline
- Automated dependency updates where appropriate
- Automated testing for all changes
- Automated deployment with security checks
- Automated monitoring and alerting

This document should be reviewed and updated quarterly to ensure it remains current with evolving security best practices and tooling.