import { memo } from "react";
import { Search, Filter, MoreVertical, Send, Smile, Paperclip, CheckCircle, Loader2, MessageCircle, Image, FileText, Mic, X, User, Trash2, Check, CheckCheck, Tag, ChevronUp, ChevronDown, ArrowLeft, Video, Calendar, MoreHorizontal, Bot, UserCheck, Building, PenLine, CheckSquare, Archive, Download, RefreshCw, Info, Users, AlertCircle, Eye } from "lucide-react";
import { ConversationDialogs, BulkDialogs } from "@/components/atendimento/ConversationDialogs";
import { ReadOnlyBadge } from "@/components/ui/ReadOnlyBadge";
import { AudioPlayer } from "@/components/atendimento/AudioPlayer";
import { MediaAutoDownloader } from "@/components/atendimento/MediaAutoDownloader";
import { AudioProcessingStatus } from "@/components/atendimento/AudioProcessingStatus";
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import ContactProfilePanel from "@/components/atendimento/ContactProfilePanel";
import { ChatConnectionIndicator } from "@/components/atendimento/ChatConnectionIndicator";
import { FollowUpIndicator } from "@/components/atendimento/FollowUpIndicator";
import LidContactIndicator, { isLidOnlyContact } from "@/components/atendimento/LidContactIndicator";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Message } from "@/hooks/useConversations";
import { useAtendimentoState, statusConfig, resolveMediaUrl } from "@/hooks/useAtendimentoState";
import { getContactSecondaryName } from "@/hooks/useContactDisplayName";

export default function Atendimento() {
  const s = useAtendimentoState();

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-yellow-300 dark:bg-yellow-600 px-0.5 rounded">{part}</mark>
        : part
    );
  };

  const renderDeliveryStatus = (message: Message) => {
    if (message.sender_type !== 'agent') return null;
    const status = message.delivery_status || 'sent';
    switch (status) {
      case 'read': return <CheckCheck className="w-3.5 h-3.5 text-primary" />;
      case 'delivered': return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />;
      default: return <Check className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const renderMessage = (message: Message) => {
    const isOutgoing = message.sender_type === "agent";
    const isCurrentResult = s.searchResults[s.currentSearchIndex]?.id === message.id;

    return (
      <div
        key={message.id}
        ref={(el) => el && s.messageRefs.current.set(message.id, el)}
        className={cn("flex", isOutgoing ? "justify-end" : "justify-start")}
      >
        <div className={cn("max-w-[85%] sm:max-w-[70%]", isOutgoing ? "chat-bubble-outgoing" : "chat-bubble-incoming", isCurrentResult && "ring-2 ring-primary ring-offset-2")}>
          {message.message_type === "image" && message.media_url && (
            <img src={resolveMediaUrl(message.media_url)} alt="Imagem" className="rounded-lg max-w-full mb-2 cursor-pointer hover:opacity-90" onClick={() => window.open(resolveMediaUrl(message.media_url), '_blank')} />
          )}
          {message.message_type === "image" && !message.media_url && (
            <MediaAutoDownloader messageId={message.id} conversationId={message.conversation_id} sessionName={s.selectedConversation?.connection?.name || 'default'} mediaType="image" />
          )}
          {message.message_type === "document" && message.media_url && (
            <a href={resolveMediaUrl(message.media_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-background/50 rounded mb-2 hover:bg-background/70">
              <FileText className="w-5 h-5" /><span className="text-sm underline">Documento</span>
            </a>
          )}
          {message.message_type === "audio" && message.media_url && <AudioPlayer src={resolveMediaUrl(message.media_url)} className="mb-2" />}
          {message.message_type === "audio" && !message.media_url && (
            <MediaAutoDownloader messageId={message.id} conversationId={message.conversation_id} sessionName={s.selectedConversation?.connection?.name || 'default'} mediaType="audio" />
          )}
          {message.message_type === "video" && message.media_url && (
            <video controls className="rounded-lg max-w-full mb-2" style={{ maxHeight: '300px' }}><source src={resolveMediaUrl(message.media_url)} />Seu navegador não suporta vídeos.</video>
          )}
          {message.message_type === "video" && !message.media_url && (
            <MediaAutoDownloader messageId={message.id} conversationId={message.conversation_id} sessionName={s.selectedConversation?.connection?.name || 'default'} mediaType="video" />
          )}
          {message.content && message.message_type !== "audio" && (
            <p className="text-sm break-words">{s.messageSearchQuery ? highlightText(message.content, s.messageSearchQuery) : message.content}</p>
          )}
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground">{s.formatTime(message.created_at)}</span>
            {renderDeliveryStatus(message)}
          </div>
        </div>
      </div>
    );
  };

  if (s.conversationsLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (s.conversationsIsError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <div className="text-center">
          <p className="font-medium">Erro ao carregar conversas</p>
          <p className="text-sm text-muted-foreground mt-1">{(s.conversationsError as Error)?.message || "Erro de conexão com o servidor"}</p>
        </div>
        <Button variant="outline" onClick={() => s.refetchConversations()}><RefreshCw className="w-4 h-4 mr-2" />Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-[calc(100vh-3rem)] -m-4 md:-m-6 bg-card border border-border overflow-hidden shadow-sm">
      {/* Hidden file inputs */}
      <input ref={s.imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => s.handleFileSelect(e, 'image')} />
      <input ref={s.fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={(e) => s.handleFileSelect(e, 'document')} />
      <input ref={s.videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => s.handleFileSelect(e, 'video')} />

      {/* Contact List */}
      <div className={cn("w-full md:w-80 lg:w-96 border-r border-border flex flex-col transition-all duration-300 ease-out", s.showMobileChat && "hidden md:flex", !s.showMobileChat && "animate-fade-in md:animate-none")}>
        <div className="p-3 sm:p-4 border-b border-border space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou telefone..." value={s.searchQuery} onChange={(e) => s.setSearchQuery(e.target.value)} className="pl-9 input-search" />
          </div>

          <div className="flex items-center gap-2">
            <Popover open={s.showFilterPopover} onOpenChange={s.setShowFilterPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 relative">
                  <Filter className="w-4 h-4 mr-2" />Filtrar
                  {s.activeFiltersCount > 0 && <Badge className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center bg-primary text-primary-foreground text-xs">{s.activeFiltersCount}</Badge>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">Filtros</p>
                    {s.activeFiltersCount > 0 && <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={s.clearFilters}>Limpar</Button>}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Status</p>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={s.statusFilter.includes(key)} onCheckedChange={() => s.toggleStatusFilter(key)} />
                        <Badge className={cn("text-xs", config.className)}>{config.label}</Badge>
                      </label>
                    ))}
                  </div>
                  {s.queues && s.queues.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Setor</p>
                      <Select value={s.queueFilter} onValueChange={s.setQueueFilter}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os setores</SelectItem>
                          {s.queues.map(queue => (
                            <SelectItem key={queue.id} value={queue.id}>
                              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: queue.color }} />{queue.name}</div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {s.tags && s.tags.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Tags</p>
                      {s.tags.map(tag => (
                        <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={s.tagFilter.includes(tag.id)} onCheckedChange={() => s.toggleTagFilter(tag.id)} />
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                          <span className="text-sm">{tag.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant={s.bulkSelectionMode ? "secondary" : "outline"} size="sm" onClick={s.toggleBulkSelectionMode} title={s.bulkSelectionMode ? "Cancelar seleção" : "Selecionar conversas"}>
              {s.bulkSelectionMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
            </Button>
          </div>

          {s.activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-1">
              {s.statusFilter.map(status => (
                <Badge key={status} variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-secondary/80" onClick={() => s.toggleStatusFilter(status)}>
                  {statusConfig[status as keyof typeof statusConfig].label}<X className="w-3 h-3" />
                </Badge>
              ))}
              {s.queueFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-secondary/80" onClick={() => s.setQueueFilter("all")}>
                  {s.queues?.find(q => q.id === s.queueFilter)?.name}<X className="w-3 h-3" />
                </Badge>
              )}
              {s.tagFilter.map(tagId => {
                const tag = s.tags?.find(t => t.id === tagId);
                return tag ? (
                  <Badge key={tagId} style={{ backgroundColor: tag.color }} className="text-white text-xs gap-1 cursor-pointer hover:opacity-80" onClick={() => s.toggleTagFilter(tagId)}>
                    {tag.name}<X className="w-3 h-3" />
                  </Badge>
                ) : null;
              })}
            </div>
          )}

          <Tabs value={s.activeTab} onValueChange={(v) => s.setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="attending" className="text-xs gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-1">
                <UserCheck className="w-3.5 h-3.5" /><span className="hidden sm:inline">Atendendo</span>
                <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px] h-4 min-w-[18px]">{s.tabCounts.attending}</Badge>
              </TabsTrigger>
              <TabsTrigger value="completed" className="text-xs gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-1">
                <CheckCircle className="w-3.5 h-3.5" /><span className="hidden sm:inline">Concluído</span>
                <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px] h-4 min-w-[18px]">{s.tabCounts.completed}</Badge>
              </TabsTrigger>
              <TabsTrigger value="chatbot" className="text-xs gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-1">
                <Bot className="w-3.5 h-3.5" /><span className="hidden sm:inline">Chatbot</span>
                <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px] h-4 min-w-[18px]">{s.tabCounts.chatbot}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {s.queues && s.queues.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin pb-1">
              <Badge variant={s.queueFilter === 'all' ? 'default' : 'outline'} className="cursor-pointer shrink-0 text-xs px-2 py-0.5" onClick={() => s.setQueueFilter('all')}>Todos</Badge>
              {s.queues.map(queue => (
                <Badge key={queue.id} variant={s.queueFilter === queue.id ? 'default' : 'outline'}
                  className="cursor-pointer shrink-0 text-xs px-2 py-0.5 gap-1"
                  style={s.queueFilter === queue.id ? { backgroundColor: queue.color || '#6366f1' } : { borderColor: queue.color || '#6366f1', color: queue.color || '#6366f1' }}
                  onClick={() => s.setQueueFilter(s.queueFilter === queue.id ? 'all' : queue.id)}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.queueFilter === queue.id ? 'white' : queue.color || '#6366f1' }} />
                  {queue.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Bulk Selection Bar */}
        {s.bulkSelectionMode && (
          <div className="p-3 bg-primary/10 border-b border-border">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Checkbox checked={s.selectedConversationIds.size === s.filteredConversations.length && s.filteredConversations.length > 0} onCheckedChange={s.toggleSelectAll} />
                <span className="text-sm font-medium">{s.selectedConversationIds.size} selecionada(s)</span>
              </div>
              <Button variant="ghost" size="sm" onClick={s.toggleBulkSelectionMode}><X className="w-4 h-4" /></Button>
            </div>
            {s.selectedConversationIds.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="destructive" size="sm" onClick={() => s.setShowBulkDeleteDialog(true)} disabled={s.bulkDeleteConversations.isPending || !s.canEdit}><Trash2 className="w-4 h-4 mr-1" />Excluir</Button>
                <Button variant="outline" size="sm" onClick={s.handleBulkResolve} disabled={s.bulkUpdateConversations.isPending || !s.canEdit}><CheckCircle className="w-4 h-4 mr-1" />Resolver</Button>
                <Button variant="outline" size="sm" onClick={s.handleBulkArchive} disabled={s.bulkUpdateConversations.isPending || !s.canEdit}><Archive className="w-4 h-4 mr-1" />Arquivar</Button>
                <Button variant="outline" size="sm" onClick={() => s.setShowExportDialog(true)} disabled={s.exportConversations.isPending}><Download className="w-4 h-4 mr-1" />Exportar</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><MoreHorizontal className="w-4 h-4 mr-1" />Mais</Button></DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => s.setShowBulkStatusDialog(true)}>Alterar Status</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => s.setShowBulkAssignDialog(true)}>Atribuir Agente</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { s.setBulkTagMode('add'); s.setSelectedBulkTags(new Set()); s.setShowBulkTagDialog(true); }}><Tag className="w-4 h-4 mr-2" />Adicionar Tags</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { s.setBulkTagMode('remove'); s.setSelectedBulkTags(new Set()); s.setShowBulkTagDialog(true); }}><Tag className="w-4 h-4 mr-2" />Remover Tags</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        )}

        {/* Pull-to-refresh indicator */}
        <div className={cn("flex items-center justify-center overflow-hidden transition-all duration-200 md:hidden", s.pullDistance > 0 ? "opacity-100" : "opacity-0")} style={{ height: s.pullDistance > 0 ? s.pullDistance : 0 }}>
          <RefreshCw className={cn("w-5 h-5 text-primary transition-transform", s.isRefreshing && "animate-spin", s.pullDistance >= s.PULL_THRESHOLD && !s.isRefreshing && "text-green-500")} style={{ transform: `rotate(${Math.min(s.pullDistance * 3, 360)}deg)` }} />
          <span className="ml-2 text-xs text-muted-foreground">{s.isRefreshing ? "Atualizando..." : s.pullDistance >= s.PULL_THRESHOLD ? "Solte para atualizar" : "Puxe para atualizar"}</span>
        </div>

        <div ref={s.conversationListRef} className="flex-1 overflow-y-auto scrollbar-thin" onTouchStart={s.handleTouchStart} onTouchMove={s.handleTouchMove} onTouchEnd={s.handleTouchEnd}>
          {s.filteredConversations.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Nenhuma conversa encontrada</div>
          ) : (
            s.filteredConversations.map((conversation, index) => (
              <div
                key={conversation.id}
                onClick={() => !s.bulkSelectionMode && s.handleSelectConversation(conversation)}
                className={cn("flex items-stretch border-b border-border cursor-pointer hover:bg-muted/50 transition-all duration-200 animate-fade-in", s.selectedConversation?.id === conversation.id && !s.bulkSelectionMode && "bg-primary/5 hover:bg-primary/10", s.selectedConversationIds.has(conversation.id) && "bg-primary/5")}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="w-1 shrink-0 rounded-l" style={{ backgroundColor: conversation.connection?.color || '#22c55e' }} />
                <div className="flex items-center gap-3 p-3 flex-1 min-w-0">
                  {s.bulkSelectionMode && (
                    <Checkbox checked={s.selectedConversationIds.has(conversation.id)} onCheckedChange={() => s.toggleConversationSelection(conversation.id)} onClick={(e) => e.stopPropagation()} className="shrink-0" />
                  )}
                  <div className="relative shrink-0">
                    <Avatar className="w-10 h-10">
                      {conversation.contact?.is_group ? (
                        <AvatarFallback className="bg-secondary text-secondary-foreground font-medium text-sm"><Users className="w-5 h-5" /></AvatarFallback>
                      ) : (
                        <><AvatarImage src={conversation.contact?.avatar_url || undefined} /><AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">{s.getInitials(conversation.contact)}</AvatarFallback></>
                      )}
                    </Avatar>
                    {conversation.is_bot_active && <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center"><Bot className="w-2.5 h-2.5 text-primary-foreground" /></span>}
                    {!conversation.is_bot_active && !conversation.contact?.is_group && isLidOnlyContact(conversation.contact) && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-muted rounded-full flex items-center justify-center" title="Contato com identificador temporário"><Info className="w-2.5 h-2.5 text-muted-foreground" /></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{s.getDisplayName(conversation.contact)}</p>
                        {getContactSecondaryName(conversation.contact) && <p className="text-[10px] text-muted-foreground truncate">{getContactSecondaryName(conversation.contact)}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{conversation.last_message_at ? format(new Date(conversation.last_message_at), "HH:mm", { locale: ptBR }) : ""}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mb-1.5">{conversation.subject || "Nova conversa"}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Badge style={{ backgroundColor: conversation.queue?.color || '#6366f1' }} className="text-white text-[9px] px-1.5 py-0 h-4 cursor-pointer hover:opacity-80" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                            <Building className="w-2.5 h-2.5 mr-0.5" />{conversation.queue?.name || 'Setor'}<ChevronDown className="w-2.5 h-2.5 ml-0.5" />
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40 bg-popover border border-border shadow-lg z-[9999]" onClick={(e) => e.stopPropagation()} side="bottom" sideOffset={4}>
                          <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); s.updateConversation.mutate({ id: conversation.id, queue_id: null }); }}>
                            <X className="w-3 h-3 mr-2" />Sem setor
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {s.queues?.map(queue => (
                            <DropdownMenuItem key={queue.id} className="text-xs" onClick={(e) => { e.stopPropagation(); s.updateConversation.mutate({ id: conversation.id, queue_id: queue.id }); }}>
                              <div className="w-3 h-3 rounded-full mr-2 shrink-0" style={{ backgroundColor: queue.color || '#6366f1' }} />
                              {queue.name}{conversation.queue_id === queue.id && <Check className="w-3 h-3 ml-auto" />}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {conversation.tags && conversation.tags.slice(0, 2).map(tag => (
                        <Badge key={tag.id} style={{ backgroundColor: tag.color }} className="text-white text-[9px] px-1.5 py-0 h-4">{tag.name}</Badge>
                      ))}
                      {conversation.kanban_column && (
                        <Badge variant="outline" style={{ borderColor: conversation.kanban_column.color || '#3B82F6', color: conversation.kanban_column.color || '#3B82F6' }} className="text-[9px] px-1.5 py-0 h-4">{conversation.kanban_column.name}</Badge>
                      )}
                      {conversation.assignee && (
                        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5"><User className="w-2.5 h-2.5" />{conversation.assignee.name.split(' ')[0]}</span>
                      )}
                    </div>
                  </div>
                  {conversation.unread_count > 0 && (
                    <Badge className="bg-accent text-accent-foreground w-5 h-5 p-0 flex items-center justify-center rounded-full text-xs shrink-0">{conversation.unread_count}</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {s.selectedConversation ? (
        <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300 ease-out", !s.showMobileChat && "hidden md:flex", s.showMobileChat && "animate-slide-in-right md:animate-none")}>
          {/* Chat Header */}
          <div className="border-b border-border px-3 sm:px-4 py-2">
            <div className="flex items-center justify-between gap-2 h-12">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => s.setShowMobileChat(false)}><ArrowLeft className="w-5 h-5" /></Button>
                <div className="relative">
                  <Avatar className="w-8 h-8 sm:w-10 sm:h-10 shrink-0">
                    <AvatarImage src={s.selectedConversation.contact?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">{s.getInitials(s.selectedConversation.contact)}</AvatarFallback>
                  </Avatar>
                  {s.selectedConversation.channel === "whatsapp" && (
                    <TooltipProvider><Tooltip><TooltipTrigger asChild>
                      <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-card", s.contactIsOnline ? "bg-green-500" : "bg-muted-foreground/50")} />
                    </TooltipTrigger><TooltipContent side="bottom" className="text-xs">
                      {s.statusLoading ? "Verificando..." : s.contactIsOnline ? "Online agora" : s.contactLastSeen ? `Visto por último: ${formatDistanceToNow(new Date(s.contactLastSeen), { addSuffix: true, locale: ptBR })}` : "Offline"}
                    </TooltipContent></Tooltip></TooltipProvider>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-sm sm:text-base truncate">{s.getDisplayName(s.selectedConversation.contact)}</p>
                    {s.selectedConversation.channel === "whatsapp" && s.contactIsOnline && <span className="text-[10px] text-green-500 font-medium hidden sm:inline">• online</span>}
                  </div>
                  {getContactSecondaryName(s.selectedConversation.contact) && <p className="text-[11px] text-muted-foreground truncate">{getContactSecondaryName(s.selectedConversation.contact)}</p>}
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground truncate">{s.formatPhoneDisplay(s.selectedConversation.contact?.phone) || s.selectedConversation.contact?.email || "-"}</p>
                    {s.selectedConversation.channel === "whatsapp" && (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-accent border-accent/30 hidden sm:flex"><MessageCircle className="w-3 h-3" />WhatsApp</Badge>
                        <ChatConnectionIndicator connectionId={s.selectedConversation.connection_id} />
                      </div>
                    )}
                    <FollowUpIndicator conversationId={s.selectedConversation.id} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => s.setShowMessageSearch(!s.showMessageSearch)} className={cn(s.showMessageSearch && "bg-primary/10 text-primary")}><Search className="w-4 h-4" /></Button>
                <Popover open={s.showTagPopover} onOpenChange={s.setShowTagPopover}>
                  <PopoverTrigger asChild><Button variant="ghost" size="icon"><Tag className="w-4 h-4" /></Button></PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="end">
                    <div className="space-y-2">
                      <p className="text-sm font-medium px-2">Tags da conversa</p>
                      {s.conversationTags && s.conversationTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 px-2 pb-2 border-b">
                          {s.conversationTags.map(ct => (
                            <Badge key={ct.id} style={{ backgroundColor: ct.tag?.color }} className="text-white text-xs gap-1 cursor-pointer hover:opacity-80" onClick={() => s.handleRemoveTag(ct.tag_id)}>{ct.tag?.name}<X className="w-3 h-3" /></Badge>
                          ))}
                        </div>
                      )}
                      {s.availableTags && s.availableTags.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground px-2">Adicionar tag:</p>
                          {s.availableTags.map(tag => (
                            <Button key={tag.id} variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => s.handleAddTag(tag.id)}>
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />{tag.name}
                            </Button>
                          ))}
                        </div>
                      ) : <p className="text-xs text-muted-foreground text-center py-2">Todas as tags já foram adicionadas</p>}
                    </div>
                  </PopoverContent>
                </Popover>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="shrink-0"><MoreVertical className="w-5 h-5" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => s.setShowProfilePanel(true)}><User className="w-4 h-4 mr-2" />Ver perfil</DropdownMenuItem>
                    {s.selectedConversation.status !== "resolved" && s.canEdit && (
                      <DropdownMenuItem onClick={s.handleResolve} disabled={s.updateConversation.isPending}><CheckCircle className="w-4 h-4 mr-2" />Resolver conversa</DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => s.setShowMessageSearch(true)}><Search className="w-4 h-4 mr-2" />Buscar mensagens</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setTimeout(() => s.setShowTagPopover(true), 150); }}><Tag className="w-4 h-4 mr-2" />Gerenciar tags</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => s.setShowScheduleDialog(true)}><Calendar className="w-4 h-4 mr-2" />Agendar mensagem</DropdownMenuItem>
                    {s.canEdit && <DropdownMenuItem onClick={s.handleChangeQueue}><Building className="w-4 h-4 mr-2" />Mudar setor</DropdownMenuItem>}
                    {s.canEdit && (
                      s.selectedConversation.is_bot_active
                        ? <DropdownMenuItem onClick={s.handleTransferToManual} disabled={s.updateConversation.isPending}><UserCheck className="w-4 h-4 mr-2" />Assumir atendimento</DropdownMenuItem>
                        : <DropdownMenuItem onClick={s.handleTransferToBot} disabled={s.updateConversation.isPending}><Bot className="w-4 h-4 mr-2" />Transferir para Bot</DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {s.canEdit && <DropdownMenuItem className="text-destructive" onClick={() => s.setShowDeleteDialog(true)}><Trash2 className="w-4 h-4 mr-2" />Excluir conversa</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {s.conversationTags && s.conversationTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {s.conversationTags.map(ct => (
                  <Badge key={ct.id} style={{ backgroundColor: ct.tag?.color }} className="text-white text-[10px] px-1.5 py-0">{ct.tag?.name}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Message Search Bar */}
          {s.showMessageSearch && (
            <div className="px-3 sm:px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input ref={s.messageSearchInputRef} placeholder="Buscar nas mensagens..." value={s.messageSearchQuery} onChange={(e) => { s.setMessageSearchQuery(e.target.value); s.setCurrentSearchIndex(0); }} className="h-8 text-sm" />
              {s.searchResults.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{s.currentSearchIndex + 1}/{s.searchResults.length}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => s.navigateSearchResult('prev')}><ChevronUp className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => s.navigateSearchResult('next')}><ChevronDown className="w-4 h-4" /></Button>
                </div>
              )}
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { s.setShowMessageSearch(false); s.setMessageSearchQuery(""); }}><X className="w-4 h-4" /></Button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-muted/30 scrollbar-thin">
            {s.messagesLoading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : s.messages && s.messages.length > 0 ? (
              <>
                {s.messages.map(renderMessage)}
                {s.typingUsers.length > 0 && (
                  <div className="flex justify-start">
                    <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-md flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" />
                      </div>
                      <span className="text-xs text-muted-foreground ml-1">{s.typingUsers.length === 1 ? `${s.typingUsers[0].name} está digitando...` : `${s.typingUsers.length} pessoas digitando...`}</span>
                    </div>
                  </div>
                )}
                <div ref={s.messagesEndRef} />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm text-center px-4">Nenhuma mensagem ainda. Inicie a conversa!</div>
            )}
          </div>

          {/* Media Preview */}
          {s.mediaPreview && (
            <div className="px-3 sm:px-4 py-2 border-t border-border bg-muted/50">
              <div className="flex items-center gap-3">
                {s.mediaPreview.type === 'image' && s.mediaPreview.previewUrl && <img src={s.mediaPreview.previewUrl} alt="Preview" className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg" />}
                {s.mediaPreview.type === 'document' && <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-lg flex items-center justify-center"><FileText className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" /></div>}
                {s.mediaPreview.type === 'audio' && <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-lg flex items-center justify-center"><Mic className="w-6 h-6 sm:w-8 sm:h-8 text-accent" /></div>}
                {s.mediaPreview.type === 'video' && s.mediaPreview.previewUrl && <video src={s.mediaPreview.previewUrl} className="w-16 h-16 object-cover rounded-lg" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.mediaPreview.file.name}</p>
                  <p className="text-xs text-muted-foreground">{(s.mediaPreview.file.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button variant="ghost" size="icon" onClick={s.clearMediaPreview}><X className="w-4 h-4" /></Button>
              </div>
            </div>
          )}

          {/* Recording indicator */}
          {s.isRecording && (
            <div className="px-3 sm:px-4 py-3 border-t border-border bg-destructive/10 flex items-center gap-3">
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-medium text-destructive">Gravando... {s.formatRecordingTime(s.recordingTime)}</span>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={s.cancelRecording}><X className="w-4 h-4 mr-1" />Cancelar</Button>
            </div>
          )}

          {/* Quick Replies Dropdown */}
          {s.showQuickReplies && s.filteredQuickReplies.length > 0 && (
            <div className="px-3 sm:px-4 border-t border-border">
              <div className="bg-popover rounded-lg border shadow-lg max-h-48 overflow-y-auto">
                {s.filteredQuickReplies.map((reply, index) => (
                  <button key={reply.id} className={cn("w-full text-left px-3 py-2 hover:bg-muted transition-colors", index === s.selectedQuickReplyIndex && "bg-muted")} onClick={() => s.insertQuickReply(reply)} onMouseEnter={() => {}}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">/{reply.shortcut}</span>
                      <span className="text-sm font-medium truncate">{reply.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{reply.message}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="p-2 sm:p-4 border-t border-border">
            <div className="flex items-end gap-1 sm:gap-2">
              <Popover open={s.showEmojiPicker} onOpenChange={s.setShowEmojiPicker}>
                <PopoverTrigger asChild><Button variant="ghost" size="icon" className="shrink-0 hidden sm:flex"><Smile className="w-5 h-5" /></Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0" align="start" side="top">
                  <Picker data={data} onEmojiSelect={s.handleEmojiSelect} locale="pt" theme="auto" previewPosition="none" />
                </PopoverContent>
              </Popover>
              <Popover open={s.attachmentOpen} onOpenChange={s.setAttachmentOpen}>
                <PopoverTrigger asChild><Button variant="ghost" size="icon" className="shrink-0"><Paperclip className="w-5 h-5" /></Button></PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="space-y-1">
                    <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => s.imageInputRef.current?.click()}><Image className="w-4 h-4 text-primary" />Imagem</Button>
                    <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => s.videoInputRef.current?.click()}><Video className="w-4 h-4 text-accent" />Vídeo</Button>
                    <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => s.fileInputRef.current?.click()}><FileText className="w-4 h-4 text-warning" />Documento</Button>
                  </div>
                </PopoverContent>
              </Popover>

              {s.selectedConversation?.channel === 'whatsapp' && (
                <TooltipProvider><Tooltip><TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className={cn("shrink-0 transition-colors", s.signatureEnabled && "bg-accent/20 text-accent")} onClick={() => s.setSignatureEnabled(!s.signatureEnabled)}><PenLine className="w-5 h-5" /></Button>
                </TooltipTrigger><TooltipContent><p>{s.signatureEnabled ? 'Desativar assinatura' : 'Ativar assinatura'}</p></TooltipContent></Tooltip></TooltipProvider>
              )}

              {!s.isRecording ? (
                <>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={s.handleStartRecording} disabled={!!s.mediaPreview}><Mic className="w-5 h-5 text-accent" /></Button>
                  <div className="flex-1 relative">
                    <Textarea placeholder="Digite / para respostas rápidas..." value={s.messageText} onChange={(e) => s.handleTextChange(e.target.value)} onKeyDown={s.handleKeyDown} className="min-h-[40px] sm:min-h-[44px] max-h-32 resize-none text-sm" rows={1} />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Clique no botão verde para enviar</div>
              )}

              <TooltipProvider><Tooltip><TooltipTrigger asChild>
                <span>
                  <Button size="icon" className={cn("shrink-0", "bg-accent hover:bg-accent/90")} onClick={s.handleSendMessage} disabled={(!s.messageText.trim() && !s.mediaPreview && !s.isRecording) || s.sendMessage.isPending || s.isUploading}>
                    {(s.sendMessage.isPending || s.isUploading) ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </Button>
                </span>
              </TooltipTrigger></Tooltip></TooltipProvider>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn("flex-1 flex items-center justify-center text-muted-foreground", !s.showMobileChat && "hidden md:flex")}>Selecione uma conversa para começar</div>
      )}

      {/* Contact Profile Panel */}
      {s.showProfilePanel && s.selectedConversation?.contact?.id && (
        <div className="hidden md:block">
          <ContactProfilePanel contactId={s.selectedConversation.contact.id} conversationId={s.selectedConversation.id} onClose={() => s.setShowProfilePanel(false)} />
        </div>
      )}
      <Sheet open={s.showProfilePanel && !!s.selectedConversation?.contact?.id} onOpenChange={(open) => !open && s.setShowProfilePanel(false)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 md:hidden">
          {s.selectedConversation?.contact?.id && <ContactProfilePanel contactId={s.selectedConversation.contact.id} conversationId={s.selectedConversation.id} onClose={() => s.setShowProfilePanel(false)} />}
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      <ConversationDialogs
        showDeleteDialog={s.showDeleteDialog} setShowDeleteDialog={s.setShowDeleteDialog} onDeleteConversation={s.handleDeleteConversation} deleteLoading={s.deleteConversation.isPending}
        showScheduleDialog={s.showScheduleDialog} setShowScheduleDialog={s.setShowScheduleDialog}
        scheduleTitle={s.scheduleTitle} setScheduleTitle={s.setScheduleTitle} scheduleDescription={s.scheduleDescription} setScheduleDescription={s.setScheduleDescription}
        scheduleDate={s.scheduleDate} setScheduleDate={s.setScheduleDate} scheduleTime={s.scheduleTime} setScheduleTime={s.setScheduleTime}
        onCreateSchedule={() => { s.setScheduleTitle(""); s.setScheduleDescription(""); s.setScheduleDate(""); s.setScheduleTime(""); s.setShowScheduleDialog(false); }} scheduleLoading={false}
        showBotFlowDialog={s.showBotFlowDialog} setShowBotFlowDialog={s.setShowBotFlowDialog} selectedFlowId={s.selectedFlowId} setSelectedFlowId={s.setSelectedFlowId}
        activeFlows={s.activeFlows} onConfirmTransferToBot={s.confirmTransferToBot} transferLoading={s.updateConversation.isPending}
        showQueueDialog={s.showQueueDialog} setShowQueueDialog={s.setShowQueueDialog} selectedQueueId={s.selectedQueueId} setSelectedQueueId={s.setSelectedQueueId}
        queues={s.queues || []} onConfirmChangeQueue={s.confirmChangeQueue} queueLoading={s.updateConversation.isPending}
      />
      <BulkDialogs
        showBulkDeleteDialog={s.showBulkDeleteDialog} setShowBulkDeleteDialog={s.setShowBulkDeleteDialog} selectedCount={s.selectedConversationIds.size}
        onBulkDelete={s.handleBulkDelete} bulkDeleteLoading={s.bulkDeleteConversations.isPending}
        showBulkStatusDialog={s.showBulkStatusDialog} setShowBulkStatusDialog={s.setShowBulkStatusDialog} bulkStatusValue={s.bulkStatusValue} setBulkStatusValue={s.setBulkStatusValue}
        onBulkStatusUpdate={s.handleBulkStatusUpdate} bulkStatusLoading={s.bulkUpdateConversations.isPending}
        showBulkAssignDialog={s.showBulkAssignDialog} setShowBulkAssignDialog={s.setShowBulkAssignDialog} bulkAssignValue={s.bulkAssignValue} setBulkAssignValue={s.setBulkAssignValue}
        onBulkAssign={s.handleBulkAssign} bulkAssignLoading={s.bulkUpdateConversations.isPending} users={s.users || []}
        showBulkTagDialog={s.showBulkTagDialog} setShowBulkTagDialog={s.setShowBulkTagDialog} bulkTagMode={s.bulkTagMode} setBulkTagMode={s.setBulkTagMode}
        selectedBulkTags={s.selectedBulkTags} setSelectedBulkTags={s.setSelectedBulkTags} onBulkTagAction={s.handleBulkTagAction}
        bulkTagLoading={s.bulkAddTags.isPending || s.bulkRemoveTags.isPending} tags={s.tags || []}
        showExportDialog={s.showExportDialog} setShowExportDialog={s.setShowExportDialog} exportFormat={s.exportFormat} setExportFormat={s.setExportFormat}
        onExport={s.handleExport} exportLoading={s.exportConversations.isPending}
      />
    </div>
  );
}
