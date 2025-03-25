import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Task, TaskStatus } from '../common/entities/task.entity';


@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post()
  create(
    @Body() body: { projectId: number; title: string; description: string; startDate: string; endDate: string; assignedToId?: number },
    @Request() req,
  ) {
    return this.tasksService.create(body.projectId, body.title, body.description, body.startDate, body.endDate, req.user.userId, body.assignedToId);
  }

  @Get('me')
  findByUser(@Request() req) {
    return this.tasksService.findByUser(req.user.userId);
  }

  @Get(':id') 
  async findOne(@Param('id') id: string, @Request() req) {
    return this.tasksService.findOne(+id, req.user.userId);
  }

  @Get('project/:projectId')
  findByProject(@Param('projectId') projectId: string, @Query('status') status?: TaskStatus) {
    return this.tasksService.findByProject(+projectId, status);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<Task>, @Request() req) {
    return this.tasksService.update(+id, body, req.user.userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.tasksService.delete(+id, req.user.userId);
  }
}