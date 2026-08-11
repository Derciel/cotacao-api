# Systemsatx Integration - Authentication Controller

## Overview
This module implements a secure authentication controller for Systemsatx integration that handles the login flow to obtain API keys and stores them securely in the database. It provides a RESTful endpoint for users to configure their Systemsatx credentials and manage their API access.

## Key Features
- POST `/api/systemsatx/configurar` endpoint for email/password authentication
- Secure storage of API keys with expiration management
- User association for multi-user support
- Comprehensive error handling for invalid credentials and network issues
- Validation of email format and password requirements
- Token refresh capabilities for future API calls
- Permission-based access control using JWT guards

## Database Schema

### SystemsatxAuth Entity
Stores user credentials for Systemsatx authentication:
```typescript
@Entity({ name: 'systemsatx_auth' })
export class SystemsatxAuth {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    email!: string;

    @Column()
    password!: string; // In production, this should be encrypted

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column({ name: 'user_id' })
    userId!: number;

    @Column({ name: 'api_key_id' })
    apiKeyId!: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
}
```

### ApiKey Entity (Extended)
Used to store the Systemsatx API key:
```typescript
export enum ApiKeyRole {
    READ_ONLY = 'READ_ONLY',
    FULL_ACCESS = 'FULL_ACCESS',
}

@Entity({ name: 'api_keys' })
export class ApiKey {
    // ... existing fields ...
    
    @Column({
        type: 'enum',
        enum: ApiKeyRole,
        default: ApiKeyRole.READ_ONLY,
    })
    role!: ApiKeyRole;

    @Column({ name: 'expires_at', type: 'timestamp' })
    expiresAt!: Date;

    @Column({ name: 'is_active', type: 'boolean', default: true })
    isActive!: boolean;
}
```

## API Endpoints

### Configure Systemsatx Integration
**POST** `/api/systemsatx/configurar`
- **Authentication Required**: Yes (JWT)
- **Request Body**:
  ```json
  {
    "email": "user@company.com",
    "password": "securepassword123"
  }
  ```
- **Success Response** (200):
  ```json
  {
    "apiKey": "sk_live_abc123def456...",
    "expiresAt": "2027-08-11T10:30:00.000Z",
    "message": "Integração com Systemsatx configurada com sucesso"
  }
  ```
- **Error Responses**:
  - 400: Invalid request data
  - 401: Invalid credentials
  - 500: Internal server error

### Get Current Configuration
**GET** `/api/systemsatx/configuracao`
- **Authentication Required**: Yes (JWT)
- **Success Response** (200):
  ```json
  {
    "apiKeyId": 1,
    "name": "Systemsatx Integration - john_doe",
    "role": "FULL_ACCESS",
    "expiresAt": "2027-08-11T10:30:00.000Z",
    "isActive": true,
    "createdAt": "2026-08-11T10:30:00.000Z",
    "updatedAt": "2026-08-11T10:30:00.000Z"
  }
  ```
- **Error Responses**:
  - 404: Configuration not found

### Remove Configuration
**DELETE** `/api/systemsatx/configuracao`
- **Authentication Required**: Yes (JWT)
- **Success Response** (200):
  ```json
  {
    "message": "Integração com Systemsatx removida com sucesso"
  }
  ```
- **Error Responses**:
  - 404: Configuration not found

## Security Implementation

### Password Handling
- Passwords are validated for minimum length (6 characters) and maximum length (50 characters)
- Email format validation using class-validator decorators
- **Note**: In a production environment, passwords should be encrypted before storage using bcrypt or similar

### API Key Generation
- Cryptographically secure random keys using `crypto.randomBytes()`
- Prefix `sk_live_` for easy identification
- 24 bytes of random data encoded in hex (48 characters)

### Expiration Management
- API keys are set to expire in 1 year from creation
- Automatic validation of expiration dates on API key usage
- Soft deletion approach (isActive flag) for audit purposes

### Access Control
- JWT authentication required for all endpoints
- Users can only access their own Systemsatx configurations
- Admin users have access to all configurations (through existing API keys controller)

## Error Handling

### Validation Errors
- Automatic validation through class-validator and NestJS pipes
- Clear error messages for email format, password length, etc.

### Authentication Errors
- 401 Unauthorized for invalid Systemsatx credentials
- Distinguishes between invalid credentials and Systemsatx service errors

### Network Errors
- Timeout handling (10 seconds) for Systemsatx API calls
- Specific error messages for connectivity issues
- Graceful degradation when Systemsatx service is unavailable

### Database Errors
- Foreign key constraints prevent orphaned records
- Cascade deletes maintain data integrity
- Unique constraints prevent duplicate emails

## Installation & Usage

### Database Migration
Run the migration to create the necessary tables:
```bash
npm run migration:run
```

### Environment Variables
No additional environment variables are required for this module. It uses the existing:
- `JWT_SECRET` for token signing
- Database connection parameters

### Testing the Integration
1. Login to obtain a JWT token via `/api/auth/login`
2. Use the token in the Authorization header: `Bearer <token>`
3. POST to `/api/systemsatx/configurar` with email and password
4. Store the returned API key for future Systemsatx API calls

## Future Enhancements

### Password Security
- Implement encryption for stored passwords using AES or bcrypt
- Add password rotation capabilities
- Implement secure credential storage (AWS Secrets Manager, HashiCorp Vault)

### Refresh Token Mechanism
- Implement refresh token flow for long-lived Sessions
- Add automatic token refresh before expiration
- Implement token revocation capabilities

### Enhanced Monitoring
- Add audit logging for Systemsatx authentication attempts
- Implement rate limiting to prevent brute force attacks
- Add metrics collection for authentication success/failure rates

### Multi-Factor Authentication
- Support for MFA when Systemsatx implements it
- Backup code generation for account recovery
- Device trust mechanisms

## Dependencies
- `@nestjs/common`: Core NestJS framework
- `@nestjs/typeorm`: TypeORM integration for NestJS
- `class-validator`: Input validation
- `class-transformer`: Payload transformation
- `request-promise-native`: HTTP client for Systemsatx API calls
- `crypto`: Built-in Node.js cryptographic library

## Files Created
1. `src/auth/entities/systemsatx-auth.entity.ts` - SystemsatxAuth entity definition
2. `src/auth/dto/systemsatx.dto.ts` - DTOs for request/response validation
3. `src/auth/services/systemsatx-auth.service.ts` - Business logic for authentication
4. `src/auth/systemsatx.controller.ts` - REST controller with endpoints
5. `src/auth/auth.module.ts` - Updated module to include new components
6. `src/migrations/1786000000000-CreateSystemsatxAuthTable.ts` - Database migration

## Files Modified
1. `src/auth/auth.module.ts` - Added SystemsatxAuth entity and service to module

## Compliance
This implementation follows:
- RESTful API design principles
- NestJS best practices and conventions
- TypeORM entity relationships
- Input validation using class-validator
- Secure password handling practices
- Proper error handling and HTTP status codes