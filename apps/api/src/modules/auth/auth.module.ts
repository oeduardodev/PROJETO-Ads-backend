import { Module } from '@nestjs/common';
import { AuthenticationGuard } from './authentication.guard.js';
import { AuthTokenVerifier } from './auth-token.verifier.js';

@Module({
  providers: [AuthTokenVerifier, AuthenticationGuard],
  exports: [AuthTokenVerifier, AuthenticationGuard],
})
export class AuthModule {}
