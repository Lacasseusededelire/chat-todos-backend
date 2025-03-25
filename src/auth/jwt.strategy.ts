import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'ton-secret-jwt',
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findById(payload.sub); // Payload utilise "sub"
    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }
    return { userId: user.id, email: user.email }; // Retourne "userId"
  }
}