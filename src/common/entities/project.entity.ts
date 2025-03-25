import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Task } from './task.entity';
import { Chat } from './chat.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ default: 'fr' })
  language: string;

  @ManyToMany(() => User, user => user.projects)
  users: User[];

  @OneToMany(() => Task, task => task.project)
  tasks: Task[];

  @OneToMany(() => Chat, chat => chat.project)
  chats: Chat[];
}