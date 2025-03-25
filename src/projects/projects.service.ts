import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../common/entities/project.entity';
import { Invitation } from '../common/entities/invitation.entity';
import { UsersService } from '../users/users.service';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
    @InjectRepository(Invitation)
    private invitationsRepository: Repository<Invitation>,
    private usersService: UsersService,
    private chatService: ChatService,
  ) {}

  // Méthodes existantes inchangées : create, findAll, findById, update, delete, invite, respondToInvitation, leaveProject

  async create(name: string, price: number, language: string, creatorId: number): Promise<Project> {
    const creator = await this.usersService.findById(creatorId);
    if (!creator) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    const project = this.projectsRepository.create({ name, price, language, users: [creator] });
    const savedProject = await this.projectsRepository.save(project);
    await this.chatService.createDefaultChat(savedProject.id, creatorId);
    return savedProject;
  }

  async findAll(userId: number): Promise<Project[]> {
    if (!userId || isNaN(userId)) {
      throw new NotFoundException('ID utilisateur invalide');
    }
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    return user.projects || [];
  }

  async findById(id: number): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id },
      relations: ['users', 'tasks', 'chats'],
    });
    if (!project) {
      throw new NotFoundException('Projet non trouvé');
    }
    return project;
  }

  async update(id: number, updateData: Partial<Project>, userId: number): Promise<Project> {
    const project = await this.findById(id);
    if (!project.users.some(u => u.id === userId)) {
      throw new ForbiddenException('Tu n’as pas accès à ce projet');
    }
    const { users, tasks, chats, ...safeUpdateData } = updateData;
    await this.projectsRepository.update(id, safeUpdateData);
    return this.findById(id);
  }

  async delete(id: number, userId: number): Promise<void> {
    const project = await this.findById(id);
    if (project.users.length > 1) {
      throw new ForbiddenException('L’accord des collaborateurs est requis pour supprimer');
    }
    if (!project.users.some(u => u.id === userId)) {
      throw new ForbiddenException('Tu n’as pas accès à ce projet');
    }
    await this.projectsRepository.delete(id);
  }

  async invite(projectId: number, inviterId: number, inviteeEmail: string): Promise<Invitation> {
    const project = await this.findById(projectId);
    const inviter = await this.usersService.findById(inviterId);
    if (!inviter) {
      throw new NotFoundException('Inviteur non trouvé');
    }
    if (!project.users.some(u => u.id === inviterId)) {
      throw new ForbiddenException('Seul un membre peut inviter');
    }
    const invitee = await this.usersService.findByEmail(inviteeEmail);
    if (!invitee) {
      throw new NotFoundException('Utilisateur invité non trouvé');
    }
    const invitation = this.invitationsRepository.create({ inviter, invitee, project });
    return this.invitationsRepository.save(invitation);
  }

  async respondToInvitation(invitationId: number, userId: number, accept: boolean): Promise<void> {
    const invitation = await this.invitationsRepository.findOne({
      where: { id: invitationId },
      relations: ['project', 'invitee'],
    });
    if (!invitation) {
      throw new NotFoundException('Invitation non trouvée');
    }
    if (invitation.invitee.id !== userId) {
      throw new ForbiddenException('Cette invitation ne t’est pas destinée');
    }
    invitation.status = accept ? 'accepted' : 'declined';
    await this.invitationsRepository.save(invitation);
    if (accept) {
      const project = await this.findById(invitation.project.id);
      project.users.push(invitation.invitee);
      await this.projectsRepository.save(project);
      await this.chatService.addUserToDefaultChat(project.id, userId);
    }
  }

  async leaveProject(projectId: number, userId: number): Promise<void> {
    const project = await this.findById(projectId);
    if (project.users.length === 1 && project.users[0].id === userId) {
      await this.delete(projectId, userId);
      return;
    }
    throw new ForbiddenException('L’accord du créateur est requis pour quitter');
  }

  // Nouvelle méthode pour récupérer les invitations d’un utilisateur
  async findInvitationsByUser(userId: number): Promise<Invitation[]> {
    console.log('findInvitationsByUser appelé avec userId:', userId);
    if (!userId || isNaN(userId)) {
      throw new NotFoundException('ID utilisateur invalide');
    }
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    const invitations = await this.invitationsRepository.find({
      where: { invitee: { id: userId } },
      relations: ['inviter', 'project'],
    });
    console.log('Invitations trouvées:', invitations);
    return invitations;
  }
}