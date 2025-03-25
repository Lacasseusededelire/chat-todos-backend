import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from '../common/entities/task.entity';
import { ProjectsService } from '../projects/projects.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    private projectsService: ProjectsService,
    private usersService: UsersService,
  ) {}

  async create(projectId: number, title: string, description: string, startDate: string, endDate: string, userId: number, assignedToId?: number): Promise<Task> {
    const project = await this.projectsService.findById(projectId);
    if (!project) {
      throw new NotFoundException('Projet non trouvé');
    }
    if (!project.users.some(u => u.id === userId)) {
      throw new ForbiddenException('Tu n’as pas accès à ce projet');
    }
    const assignedTo = assignedToId ? await this.usersService.findById(assignedToId) : undefined;
    if (assignedToId && !assignedTo) {
      throw new NotFoundException('Utilisateur assigné non trouvé');
    }
    const task = this.tasksRepository.create({
      title,
      description,
      startDate,
      endDate,
      project,
      assignedTo: assignedTo || undefined,
    });
    return this.tasksRepository.save(task);
  }

  async findByUser(userId: number): Promise<Task[]> {
    return this.tasksRepository.find({
      where: { assignedTo: { id: userId } },
      relations: ['project', 'assignedTo'],
    });
  }

  async findOne(id: number, userId: number): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['project', 'project.users', 'assignedTo'],
    });
    if (!task) {
      throw new NotFoundException('Tâche non trouvée');
    }
    if (!task.project || !task.project.users || !task.project.users.some(u => u.id === userId)) {
      throw new ForbiddenException('Tu n’as pas accès à cette tâche');
    }
    return task;
  }
  
  async findByProject(projectId: number, status?: TaskStatus): Promise<Task[]> {
    const query = {
      where: { project: { id: projectId } },
      relations: ['project', 'assignedTo'],
    } as any;
    if (status) query.where.status = status;
    return this.tasksRepository.find(query);
  }


async update(id: number, updateData: Partial<Task>, userId: number): Promise<Task> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['project', 'project.users'],
    });
    
    if (!task) {
      throw new NotFoundException('Tâche non trouvée');
    }
    
    if (!task.project || !task.project.users || !task.project.users.some(u => u.id === userId)) {
      throw new ForbiddenException('Tu n’as pas accès à cette tâche');
    }
    
    const { project, assignedTo, ...safeUpdateData } = updateData;
    await this.tasksRepository.update(id, safeUpdateData);
    
    return this.tasksRepository.findOne({
      where: { id },
      relations: ['project', 'assignedTo'],
    }) as Promise<Task>;
  }

  async delete(id: number, userId: number): Promise<void> {
    const task = await this.tasksRepository.findOne({
      where: { id },
      relations: ['project','project.users'],
    });
    if (!task) {
      throw new NotFoundException('Tâche non trouvée');
    }
    if (!task.project.users.some(u => u.id === userId)) {
      throw new ForbiddenException('Tu n’as pas accès à cette tâche');
    }
    await this.tasksRepository.delete(id);
  }
}