import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from './user.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  content: string;

  @Column({ type: 'datetime' })
  timestamp: Date;

  @ManyToOne(() => Chat, chat => chat.messages)
  chat: Chat;

  @ManyToOne(() => User, { nullable: true })
  sender: User;

  @Column({ nullable: true })
  taskId: number;

  @Column({ nullable: true })
  fileUrl: string;
}