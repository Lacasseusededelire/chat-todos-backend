import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, WebSocketServer, WsException } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      const token = socket.handshake.auth.token;
      console.log('Token reçu:', token);
      if (!token) {
        return next(new Error('Authentification requise'));
      }
      try {
        const decoded = this.jwtService.verify(token, { secret: 'ton-secret-jwt' });
        socket['user'] = decoded;
        console.log('Utilisateur authentifié:', socket['user']);
        next();
      } catch (err) {
        console.error('Erreur token:', err);
        next(new WsException('Token invalide'));
      }
    });
  }

  handleConnection(client: Socket) {
    console.log(`Client connecté : ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client déconnecté : ${client.id}`);
  }

  @SubscribeMessage('joinChat')
  handleJoinChat(@MessageBody() data: { chatId: number }, @ConnectedSocket() client: Socket) {
    if (!client['user']) {
      throw new WsException('Utilisateur non authentifié');
    }
    client.join(`chat_${data.chatId}`);
    console.log(`Client ${client.id} a rejoint le chat ${data.chatId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { chatId: number; content: string; taskId?: number; fileUrl?: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!client['user']) {
      throw new WsException('Utilisateur non authentifié');
    }
    console.log('sendMessage:', data);
    const message = await this.chatService.saveMessage(
      data.chatId,
      client['user'].sub, // ou client['user'].sub selon ton payload
      data.content,
      data.taskId,
      data.fileUrl,
    );
    this.server.to(`chat_${data.chatId}`).emit('receiveMessage', message);
  }

  @SubscribeMessage('sendToGemini')
  async handleSendToGemini(
    @MessageBody() data: { chatId: number; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!client['user']) {
      throw new WsException('Utilisateur non authentifié');
    }
    console.log('sendToGemini:', data);
    try {
      const { userMessage, geminiResponse } = await this.chatService.chatWithGemini(
        data.chatId,
        client['user'].sub, // ou client['user'].sub
        data.message,
      );
      this.server.to(`chat_${data.chatId}`).emit('receiveMessage', userMessage);
      this.server.to(`chat_${data.chatId}`).emit('receiveMessage', geminiResponse);
    } catch (error) {
      throw new WsException(error.message || 'Erreur avec Gemini');
    }
  }
}