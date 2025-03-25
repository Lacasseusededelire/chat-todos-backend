import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Project } from '../common/entities/project.entity'; 

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  findAll(@Request() req) {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.projectsService.findAll(req.user.userId);
  }
  
  @Get('invitations')
  findInvitations(@Request() req) {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    return this.projectsService.findInvitationsByUser(req.user.userId);
  }
  @Post()
  create(@Body() body: { name: string; price: number; language: string }, @Request() req) {
    return this.projectsService.create(body.name, body.price, body.language, req.user.userId);
  }

  

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findById(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<Project>, @Request() req) {
    return this.projectsService.update(+id, body, req.user.userId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.projectsService.delete(+id, req.user.userId);
  }

  @Post(':id/invite')
  invite(@Param('id') id: string, @Body() body: { email: string }, @Request() req) {
    return this.projectsService.invite(+id, req.user.userId, body.email);
  }

  @Post('invitations/:invitationId/respond')
  respondToInvitation(@Param('invitationId') invitationId: string, @Body() body: { accept: boolean }, @Request() req) {
    return this.projectsService.respondToInvitation(+invitationId, req.user.userId, body.accept);
  }

  @Post(':id/leave')
  leave(@Param('id') id: string, @Request() req) {
    return this.projectsService.leaveProject(+id, req.user.userId);
  }
}