import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: {
    userId: number; // Actuellement défini ainsi
    email?: string; // Optionnel si pas toujours présent
    username?: string; // Optionnel
  };
}