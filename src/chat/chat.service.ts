import { Injectable, ForbiddenException, NotFoundException,Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chat } from '../common/entities/chat.entity';
import { Message } from '../common/entities/message.entity';
import { UsersService } from '../users/users.service';
import { ProjectsService } from '../projects/projects.service';
const fetch = require('node-fetch');

@Injectable()
export class ChatService {
  private readonly apiKey = "AIzaSyD0ARAcgdtnBqQdNptUMbwINM4Ea1QvW3o";
  private chatHistories: { [chatId: number]: { role: string; parts: { text: string }[] }[] } = {};

  constructor(
    @InjectRepository(Chat)
    private chatsRepository: Repository<Chat>,
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
    private usersService: UsersService,
    @Inject(forwardRef(() => ProjectsService))
    private projectsService: ProjectsService,
  ) {}  
  
  async createDefaultChat(projectId: number, creatorId: number): Promise<Chat> {
    const project = await this.projectsService.findById(projectId);
    const creator = await this.usersService.findById(creatorId);
    if (!project || !creator) {
      throw new NotFoundException('Projet ou créateur non trouvé');
    }
    const chat = this.chatsRepository.create({ name: `${project.name} - Général`, project });
    const savedChat = await this.chatsRepository.save(chat);
    this.chatHistories[savedChat.id] = [];
    return savedChat;
  }

  async addUserToDefaultChat(projectId: number, userId: number): Promise<void> {
    const project = await this.projectsService.findById(projectId);
    const chat = project.chats.find(c => c.name.includes('Général'));
    if (!chat) {
      throw new NotFoundException('Chat général non trouvé');
    }
  }

  async getMessages(chatId: number): Promise<Message[]> {
    return this.messagesRepository.find({
      where: { chat: { id: chatId } },
      relations: ['sender'],
    });
  }

  async saveMessage(chatId: number, senderId: number | null, content: string, taskId?: number, fileUrl?: string): Promise<Message> {
    const chat = await this.chatsRepository.findOne({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException('Chat non trouvé');
    }
    const sender = senderId ? await this.usersService.findById(senderId) : null;
    if (senderId && !sender) {
      throw new NotFoundException('Expéditeur non trouvé');
    }
    const message = this.messagesRepository.create({
      chat,
      sender: sender || undefined,
      content,
      timestamp: new Date(),
      taskId,
      fileUrl,
    });
    return this.messagesRepository.save(message);
  }

  async chatWithGemini(chatId: number, userId: number, message: string): Promise<{ userMessage: Message; geminiResponse: Message }> {
    const chat = await this.chatsRepository.findOne({
      where: { id: chatId },
      relations: ['project', 'project.users'],
    });

    if (!chat) {
      throw new NotFoundException('Chat non trouvé');
    }
    if (!chat.project || !chat.project.users || !chat.project.users.some(u => u.id === userId)) {
      throw new ForbiddenException('Tu n’as pas accès à ce chat');
    }

    const userMsg = await this.saveMessage(chatId, userId, message);

    const systemPrompt = 'Tu es un conseiller utile pour les projets et tâches. Réponds de manière concise et pratique.';
    const history = this.chatHistories[chatId] || [];
    const contents = history.length === 0
      ? [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${message}` }] }]
      : [...history, { role: 'user', parts: [{ text: message }] }];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: 500 },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Erreur API Gemini');
    }

    const geminiResponseText = data.candidates[0].content.parts[0].text;
    const geminiMsg = await this.saveMessage(chatId, null, geminiResponseText);

    this.chatHistories[chatId] = [
      ...(this.chatHistories[chatId] || []),
      { role: 'user', parts: [{ text: message }] },
      { role: 'model', parts: [{ text: geminiResponseText }] },
    ];

    return { userMessage: userMsg, geminiResponse: geminiMsg };
  }
  async generatePlanning(tasks: any[]): Promise<string> {
    const tasksForPlanning = tasks.map(task => ({
      title: task.title,
      description: task.description,
      startDate: task.startDate,
      endDate: task.endDate,
      status: task.status,
      project: task.project?.name,
      assignedTo: task.assignedTo?.username || 'Non assigné',
    }));
  
    const message = `Génère un planning structuré pour les tâches suivantes : ${JSON.stringify(tasksForPlanning)}. Fournis une réponse sous forme de liste (et non un tableau) avec les détails suivants pour chaque tâche : Tâche, Description, Date de début, Date de fin, Statut, Assigné à, Ressources nécessaires. Par exemple :  
  - Tâche : [Nom de la tâche]  
    Description : [Description]  
    Date de début : [Date]  
    Date de fin : [Date]  
    Statut : [Statut]  
    Assigné à : [Utilisateur]  
    Ressources nécessaires : [Ressources]`;
  
    const systemPrompt = 'Tu es un conseiller utile pour les projets et tâches. Réponds de manière concise et pratique.';
    const contents = [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${message}` }] }];
  
    console.log('Envoi de la requête à Gemini avec les tâches:', tasksForPlanning);
  
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: 500 },
      }),
    });
  
    const data = await response.json();
    if (!response.ok) {
      console.error('Erreur API Gemini:', data);
      throw new Error(data.error?.message || 'Erreur API Gemini');
    }
  
    const planningText = data.candidates[0].content.parts[0].text;
    console.log('Planning généré:', planningText);
    return planningText;
  }
}