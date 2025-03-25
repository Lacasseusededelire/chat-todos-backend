// chat.controller.ts
import { Controller, Get, Post, Param, Body, UseGuards, Request, ForbiddenException, NotFoundException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestWithUser } from '../common/types/request-with-user';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  // Endpoint pour uploader un fichier
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|pdf|mp4|mp3|wav|webm|ogg/;
      const ext = extname(file.originalname).toLowerCase();
      const mimetype = allowedTypes.test(file.mimetype);
      const extnameValid = allowedTypes.test(ext);
      if (mimetype && extnameValid) {
        return cb(null, true);
      }
      cb(new Error('Type de fichier non supporté'), false);
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new ForbiddenException('Aucun fichier uploadé');
    }
    const fileUrl = `/uploads/${file.filename}`;
    return { fileUrl };
  }

  @Get(':chatId/messages')
  async getMessages(@Param('chatId') chatId: string, @Request() req: RequestWithUser) {
    const chat = await this.chatService['chatsRepository'].findOne({
      where: { id: +chatId },
      relations: ['project', 'project.users'],
    });

    if (!chat) {
      throw new NotFoundException('Chat non trouvé');
    }
    if (!chat.project || !chat.project.users || !chat.project.users.some(u => u.id === req.user.userId)) {
      throw new ForbiddenException('Tu n’as pas accès à ce chat');
    }

    return this.chatService.getMessages(+chatId);
  }

  @Post(':chatId/message')
  async sendMessage(
    @Param('chatId') chatId: string,
    @Body() body: { content: string; taskId?: number; fileUrl?: string },
    @Request() req: RequestWithUser,
  ) {
    const chat = await this.chatService['chatsRepository'].findOne({
      where: { id: +chatId },
      relations: ['project', 'project.users'],
    });

    if (!chat) {
      throw new NotFoundException('Chat non trouvé');
    }
    if (!chat.project || !chat.project.users || !chat.project.users.some(u => u.id === req.user.userId)) {
      throw new ForbiddenException('Tu n’as pas accès à ce chat');
    }

    return this.chatService.saveMessage(+chatId, req.user.userId, body.content, body.taskId, body.fileUrl);
  }

  @Post(':chatId/gemini')
  async sendToGemini(
    @Param('chatId') chatId: string,
    @Body() body: { message: string },
    @Request() req: RequestWithUser,
  ) {
    const chat = await this.chatService['chatsRepository'].findOne({
      where: { id: +chatId },
      relations: ['project', 'project.users'],
    });

    if (!chat) {
      throw new NotFoundException('Chat non trouvé');
    }
    if (!chat.project || !chat.project.users || !chat.project.users.some(u => u.id === req.user.userId)) {
      throw new ForbiddenException('Tu n’as pas accès à ce chat');
    }

    return this.chatService.chatWithGemini(+chatId, req.user.userId, body.message);
  }
}