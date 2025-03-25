import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.entity';
import { Project } from './project.entity';

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  inviter: User;

  @ManyToOne(() => User)
  invitee: User;

  @ManyToOne(() => Project)
  project: Project;

  @Column({ default: 'pending' })
  status: string;
}