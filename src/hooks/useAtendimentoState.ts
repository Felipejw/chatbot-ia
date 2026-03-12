import { useState, useEffect, useRef, useCallback, useMemo, ChangeEvent, TouchEvent as ReactTouchEvent } from "react";
import { useConversations, useMessages, useSendMessage, useUpdateConversation, useDeleteConversation, useMarkConversationAsRead, Conversation, Message } from "@/hooks/useConversations";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useQuickReplies, QuickReply } from "@/hooks/useQuickReplies";
import { useTags } from "@/hooks/useTags";
import { useConversationTags, useAddTagToConversation, useRemoveTagFromConversation } from "@/hooks/useConversationTags";
import { useNotifications } from "@/hooks/useNotifications";
import { useFlows } from "@/hooks/useFlows";
import { useQueues } from "@/hooks/useQueues";
import { useBulkDeleteConversations, useBulkUpdateConversations, useBulkAddTagsToConversations, useBulkRemoveTagsFromConversations, useExportConversations } from "@/hooks/useBulkConversationActions";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useContactOnlineStatus } from "@/hooks/useContactOnlineStatus";
import { useContactDisplayName, formatPhoneForDisplay as formatPhone, getContactSecondaryName } from "@/hooks/useContactDisplayName";
import { useUsers } from "@/hooks/useUsers";
import { supabase } from "@/integrations/supabase/client";

export interface MediaPreview {
  file: File;
  type: 'image' | 'document' | 'audio' | 'video';
  previewUrl?: string;
}

// Template variable replacement helper
export const replaceTemplateVariables = (
  text: string, 
  contact?: { name?: string | null; phone?: string | null; company?: string | null },
  attendantName?: string
): string => {
  const now = new Date();
  return text
    .replace(/{nome}/gi, contact?.name || 'Cliente')
    .replace(/{telefone}/gi, contact?.phone || '')
    .replace(/{empresa}/gi, contact?.company || '')
    .replace(/{data}/gi, format(now, 'dd/MM/yyyy', { locale: ptBR }))
    .replace(/{hora}/gi, format(now, 'HH:mm'))
    .replace(/{atendente}/gi, attendantName || 'Atendente');
};

export const statusConfig = {
  new: { label: "Novo", className: "bg-primary/10 text-primary" },
  in_progress: { label: "Em Atendimento", className: "bg-warning/10 text-warning" },
  resolved: { label: "Resolvido", className: "bg-success/10 text-success" },
  archived: { label: "Arquivado", className: "bg-muted text-muted-foreground" },
};

// Helper to resolve media URLs
export const resolveMediaUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.includes('kong:8000') || url.includes('localhost:')) {
    return url.replace(/^https?:\/\/[^/]+/, '');
  }
  return url;
};

const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

export function useAtendimentoState() {
  const [activeTab, setActiveTab] = useState<'attending' | 'completed' | 'chatbot'>('attending');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [selectedQuickReplyIndex, setSelectedQuickReplyIndex] = useState(0);
  const [showTagPopover, setShowTagPopover] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [showFilterPopover, setShowFilterPopover] = useState(false);
  const [showBotFlowDialog, setShowBotFlowDialog] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");
  const [showQueueDialog, setShowQueueDialog] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkStatusDialog, setShowBulkStatusDialog] = useState(false);
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>("");
  const [bulkAssignValue, setBulkAssignValue] = useState<string>("");
  const [bulkTagMode, setBulkTagMode] = useState<'add' | 'remove'>('add');
  const [selectedBulkTags, setSelectedBulkTags] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResolvingLid, setIsResolvingLid] = useState(false);

  const pullStartY = useRef<number>(0);
  const conversationListRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageSearchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { user, profile, hasPermission, isAdmin } = useAuth();
  const canEdit = isAdmin || hasPermission('atendimento', 'edit');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: conversations, isLoading: conversationsLoading, isError: conversationsIsError, error: conversationsError, refetch: refetchConversations } = useConversations();
  const { data: messages, isLoading: messagesLoading } = useMessages(selectedConversation?.id || "");
  const sendMessage = useSendMessage();
  const updateConversation = useUpdateConversation();
  const deleteConversation = useDeleteConversation();
  const markAsRead = useMarkConversationAsRead();
  const uploadFile = useFileUpload();
  const { isRecording, recordingTime, startRecording, stopRecording, cancelRecording } = useAudioRecorder();
  const { data: quickReplies } = useQuickReplies();
  const { data: tags } = useTags();
  const { data: conversationTags } = useConversationTags(selectedConversation?.id);
  const addTagToConversation = useAddTagToConversation();
  const removeTagFromConversation = useRemoveTagFromConversation();
  const { requestPermission, showNotification } = useNotifications();
  const { data: flows } = useFlows();
  const { data: queues } = useQueues();
  const { data: users } = useUsers();

  const bulkDeleteConversations = useBulkDeleteConversations();
  const bulkUpdateConversations = useBulkUpdateConversations();
  const bulkAddTags = useBulkAddTagsToConversations();
  const bulkRemoveTags = useBulkRemoveTagsFromConversations();
  const exportConversations = useExportConversations();

  const activeFlows = useMemo(() => flows?.filter(f => f.is_active) || [], [flows]);

  const { typingUsers, handleTyping, stopTyping } = useTypingIndicator(
    selectedConversation?.id || '',
    user?.id || '',
    profile?.name || 'Atendente'
  );

  const { isOnline: contactIsOnline, lastSeen: contactLastSeen, isLoading: statusLoading } = useContactOnlineStatus(
    selectedConversation?.channel === 'whatsapp' ? selectedConversation?.contact?.phone : null
  );

  const { getDisplayName, getInitials } = useContactDisplayName();

  const formatPhoneDisplay = (phone?: string | null) => {
    if (!phone) return null;
    return formatPhone(phone);
  };

  // Effects
  useEffect(() => { requestPermission(); }, [requestPermission]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.sender_type === 'contact' && !lastMessage.is_read) {
        const contactName = selectedConversation?.contact?.name || 'Contato';
        showNotification(`Nova mensagem de ${contactName}`, lastMessage.content.substring(0, 100), selectedConversation?.contact?.avatar_url || undefined);
      }
    }
  }, [messages?.length]);

  useEffect(() => {
    if (selectedConversation && selectedConversation.unread_count > 0) {
      markAsRead.mutate(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (selectedConversation && conversations) {
      const updated = conversations.find(c => c.id === selectedConversation.id);
      if (updated && updated.last_message_at !== selectedConversation.last_message_at) {
        setSelectedConversation(updated);
      }
    }
  }, [conversations]);

  useEffect(() => {
    return () => { if (mediaPreview?.previewUrl) URL.revokeObjectURL(mediaPreview.previewUrl); };
  }, [mediaPreview]);

  useEffect(() => {
    setShowProfilePanel(false);
    setShowMessageSearch(false);
    setMessageSearchQuery("");
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (showMessageSearch) messageSearchInputRef.current?.focus();
  }, [showMessageSearch]);

  useEffect(() => {
    if (!showMessageSearch) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showMessageSearch]);

  useEffect(() => {
    if (!selectedConversation && conversations && conversations.length > 0) {
      setSelectedConversation(conversations[0]);
    }
  }, [conversations, selectedConversation]);

  useEffect(() => {
    if (searchResults.length > 0 && currentSearchIndex < searchResults.length) {
      const messageId = searchResults[currentSearchIndex].id;
      const element = messageRefs.current.get(messageId);
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentSearchIndex]);

  // Memos
  const filteredQuickReplies = useMemo(() => {
    if (!showQuickReplies || !quickReplies) return [];
    const query = messageText.slice(1).toLowerCase();
    return quickReplies.filter(qr => qr.shortcut.toLowerCase().includes(query) || qr.title.toLowerCase().includes(query)).slice(0, 5);
  }, [messageText, showQuickReplies, quickReplies]);

  const searchResults = useMemo(() => {
    if (!messageSearchQuery.trim() || !messages) return [];
    const query = messageSearchQuery.toLowerCase();
    return messages.filter(m => m.content.toLowerCase().includes(query));
  }, [messages, messageSearchQuery]);

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    return conversations.filter((c) => {
      const name = c.contact?.name?.toLowerCase() || "";
      const phone = c.contact?.phone || "";
      const normalizedPhoneVal = normalizePhone(phone);
      const query = searchQuery.toLowerCase();
      const normalizedQuery = normalizePhone(searchQuery);
      const matchesSearch = name.includes(query) || phone.toLowerCase().includes(query) || normalizedPhoneVal.includes(normalizedQuery);
      const isGroup = c.contact?.is_group === true;
      let matchesTab = false;
      if (activeTab === 'attending') matchesTab = !isGroup && !c.is_bot_active && (c.status === 'new' || c.status === 'in_progress');
      else if (activeTab === 'completed') matchesTab = !isGroup && c.status === 'resolved';
      else if (activeTab === 'chatbot') matchesTab = !isGroup && c.is_bot_active && c.status !== 'resolved' && c.status !== 'archived';
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(c.status);
      const matchesTags = tagFilter.length === 0 || (c.tags?.some(t => tagFilter.includes(t.id)) ?? false);
      const matchesQueue = queueFilter === 'all' || c.queue_id === queueFilter;
      return matchesSearch && matchesTab && matchesStatus && matchesTags && matchesQueue;
    });
  }, [conversations, searchQuery, activeTab, statusFilter, tagFilter, queueFilter]);

  const tabCounts = useMemo(() => {
    if (!conversations) return { attending: 0, completed: 0, chatbot: 0 };
    return {
      attending: conversations.filter(c => c.contact?.is_group !== true && !c.is_bot_active && (c.status === 'new' || c.status === 'in_progress')).length,
      completed: conversations.filter(c => c.contact?.is_group !== true && c.status === 'resolved').length,
      chatbot: conversations.filter(c => c.contact?.is_group !== true && c.is_bot_active && c.status !== 'resolved' && c.status !== 'archived').length,
    };
  }, [conversations]);

  const activeFiltersCount = statusFilter.length + tagFilter.length + (queueFilter !== 'all' ? 1 : 0);

  const availableTags = useMemo(() => {
    if (!tags || !conversationTags) return tags || [];
    const addedTagIds = new Set(conversationTags.map(ct => ct.tag_id));
    return tags.filter(t => !addedTagIds.has(t.id));
  }, [tags, conversationTags]);

  // Handlers
  const clearFilters = () => { setStatusFilter([]); setTagFilter([]); setQueueFilter("all"); };
  const toggleStatusFilter = (status: string) => setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  const toggleTagFilter = (tagId: string) => setTagFilter(prev => prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]);

  const toggleBulkSelectionMode = () => { setBulkSelectionMode(!bulkSelectionMode); setSelectedConversationIds(new Set()); };
  const toggleConversationSelection = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedConversationIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleSelectAll = () => {
    if (selectedConversationIds.size === filteredConversations.length) setSelectedConversationIds(new Set());
    else setSelectedConversationIds(new Set(filteredConversations.map(c => c.id)));
  };

  const handleBulkDelete = async () => {
    await bulkDeleteConversations.mutateAsync(Array.from(selectedConversationIds));
    setSelectedConversationIds(new Set()); setBulkSelectionMode(false); setShowBulkDeleteDialog(false); setSelectedConversation(null);
  };
  const handleBulkStatusUpdate = async () => {
    if (!bulkStatusValue) return;
    await bulkUpdateConversations.mutateAsync({ ids: Array.from(selectedConversationIds), updates: { status: bulkStatusValue as any } });
    setSelectedConversationIds(new Set()); setBulkSelectionMode(false); setShowBulkStatusDialog(false); setBulkStatusValue("");
  };
  const handleBulkAssign = async () => {
    await bulkUpdateConversations.mutateAsync({ ids: Array.from(selectedConversationIds), updates: { assigned_to: bulkAssignValue === "none" ? null : bulkAssignValue || null } });
    setSelectedConversationIds(new Set()); setBulkSelectionMode(false); setShowBulkAssignDialog(false); setBulkAssignValue("");
  };
  const handleBulkResolve = async () => {
    await bulkUpdateConversations.mutateAsync({ ids: Array.from(selectedConversationIds), updates: { status: "resolved" } });
    setSelectedConversationIds(new Set()); setBulkSelectionMode(false);
  };
  const handleBulkArchive = async () => {
    await bulkUpdateConversations.mutateAsync({ ids: Array.from(selectedConversationIds), updates: { status: "archived" } });
    setSelectedConversationIds(new Set()); setBulkSelectionMode(false);
  };
  const handleBulkTagAction = async () => {
    if (selectedBulkTags.size === 0) return;
    const tagIds = Array.from(selectedBulkTags);
    const conversationIds = Array.from(selectedConversationIds);
    if (bulkTagMode === 'add') await bulkAddTags.mutateAsync({ conversationIds, tagIds });
    else await bulkRemoveTags.mutateAsync({ conversationIds, tagIds });
    setSelectedBulkTags(new Set()); setShowBulkTagDialog(false); setSelectedConversationIds(new Set()); setBulkSelectionMode(false);
  };
  const handleExport = async () => {
    await exportConversations.mutateAsync({ conversationIds: Array.from(selectedConversationIds), format: exportFormat });
    setShowExportDialog(false);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>, type: 'image' | 'document' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxSize = type === 'video' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) { toast({ title: "Arquivo muito grande", description: `O arquivo deve ter no máximo ${type === 'video' ? '50MB' : '10MB'}`, variant: "destructive" }); return; }
    const previewUrl = (type === 'image' || type === 'video') ? URL.createObjectURL(file) : undefined;
    setMediaPreview({ file, type, previewUrl }); setAttachmentOpen(false); e.target.value = '';
  };

  const clearMediaPreview = () => { if (mediaPreview?.previewUrl) URL.revokeObjectURL(mediaPreview.previewUrl); setMediaPreview(null); };

  const formatRecordingTime = (seconds: number) => { const mins = Math.floor(seconds / 60); const secs = seconds % 60; return `${mins}:${secs.toString().padStart(2, '0')}`; };

  const handleStartRecording = async () => {
    try { await startRecording(); toast({ title: "Gravando áudio...", description: "Clique no botão enviar para parar e enviar" }); }
    catch { toast({ title: "Erro ao gravar", description: "Permita o acesso ao microfone para gravar áudio", variant: "destructive" }); }
  };

  const handleSendAudio = async () => {
    if (!selectedConversation || !user) return;
    const audioBlob = await stopRecording();
    if (!audioBlob) return;
    const isWhatsApp = selectedConversation.channel === "whatsapp";
    try {
      setIsUploading(true);
      const blobType = audioBlob.type || 'audio/webm';
      const extension = blobType.includes('mp4') ? 'mp4' : blobType.includes('ogg') ? 'ogg' : 'webm';
      const audioFile = new File([audioBlob], `audio_${Date.now()}.${extension}`, { type: blobType });
      const mediaUrl = await uploadFile.mutateAsync(audioFile);
      setIsUploading(false);
      await sendMessage.mutateAsync({ conversationId: selectedConversation.id, content: '🎤 Áudio', senderId: user.id, senderType: "agent", sendViaWhatsApp: isWhatsApp, messageType: 'audio', mediaUrl });
      if (selectedConversation.status === "new") await updateConversation.mutateAsync({ id: selectedConversation.id, status: "in_progress", assigned_to: user.id });
    } catch (error) { console.error("Error sending audio:", error); setIsUploading(false); }
  };

  const handleSendMessage = async () => {
    if (isRecording) { await handleSendAudio(); return; }
    if ((!messageText.trim() && !mediaPreview) || !selectedConversation || !user) return;
    const isWhatsApp = selectedConversation.channel === "whatsapp";
    try {
      let mediaUrl: string | undefined;
      if (mediaPreview) {
        setIsUploading(true);
        toast({ title: "Enviando arquivo...", description: `Fazendo upload do ${mediaPreview.type === 'image' ? 'imagem' : 'documento'}` });
        try { mediaUrl = await uploadFile.mutateAsync(mediaPreview.file); } catch { setIsUploading(false); return; }
        setIsUploading(false);
      }
      let finalContent = messageText.trim() || (mediaPreview?.type === 'image' ? '📷 Imagem' : mediaPreview?.type === 'video' ? '🎬 Vídeo' : mediaPreview?.file.name || '');
      if (signatureEnabled && messageText.trim() && isWhatsApp) { finalContent = `*${profile?.name || 'Atendente'}:* ${messageText.trim()}`; }
      await sendMessage.mutateAsync({ conversationId: selectedConversation.id, content: finalContent, senderId: user.id, senderType: "agent", sendViaWhatsApp: isWhatsApp, messageType: mediaPreview?.type || 'text', mediaUrl });
      setMessageText(""); clearMediaPreview(); stopTyping();
      if (selectedConversation.status === "new") await updateConversation.mutateAsync({ id: selectedConversation.id, status: "in_progress", assigned_to: user.id });
    } catch (error) { console.error("Error sending message:", error); }
  };

  const handleResolve = async () => {
    if (!selectedConversation) return;
    await updateConversation.mutateAsync({ id: selectedConversation.id, status: "resolved" });
  };

  const handleTransferToManual = async () => {
    if (!selectedConversation || !user) return;
    await updateConversation.mutateAsync({ id: selectedConversation.id, is_bot_active: false, assigned_to: user.id, status: selectedConversation.status === 'new' ? 'in_progress' : selectedConversation.status });
    toast({ title: "Conversa transferida", description: "A conversa foi transferida para atendimento manual" });
  };

  const handleTransferToBot = async () => {
    if (!selectedConversation) return;
    if (activeFlows.length > 0) { setSelectedFlowId(activeFlows[0].id); setShowBotFlowDialog(true); return; }
    await updateConversation.mutateAsync({ id: selectedConversation.id, is_bot_active: true, assigned_to: null });
    toast({ title: "Conversa transferida", description: "A conversa foi transferida para o Chatbot" });
  };

  const confirmTransferToBot = async () => {
    if (!selectedConversation) return;
    await updateConversation.mutateAsync({ id: selectedConversation.id, is_bot_active: true, assigned_to: null, active_flow_id: selectedFlowId || null });
    setShowBotFlowDialog(false); setSelectedFlowId("");
    const selectedFlow = activeFlows.find(f => f.id === selectedFlowId);
    toast({ title: "Conversa transferida", description: selectedFlow ? `A conversa foi transferida para o fluxo "${selectedFlow.name}"` : "A conversa foi transferida para o Chatbot" });
  };

  const handleChangeQueue = async () => {
    if (!selectedConversation) return;
    setSelectedQueueId(selectedConversation.queue_id || "");
    setShowQueueDialog(true);
  };

  const confirmChangeQueue = async () => {
    if (!selectedConversation) return;
    const queueId = selectedQueueId === 'none' ? null : selectedQueueId;
    await updateConversation.mutateAsync({ id: selectedConversation.id, queue_id: queueId });
    setShowQueueDialog(false);
    const selectedQueue = queues?.find(q => q.id === queueId);
    toast({ title: "Setor alterado", description: selectedQueue ? `A conversa foi movida para "${selectedQueue.name}"` : "A conversa foi removida do setor" });
  };

  const handleResolveLidContact = async (contactId?: string) => {
    if (!contactId || isResolvingLid) return;
    setIsResolvingLid(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "Erro", description: "Sessão expirada. Faça login novamente.", variant: "destructive" }); return; }
      const response = await supabase.functions.invoke('resolve-lid-contact', { body: { contactId } });
      if (response.error) throw new Error(response.error.message || 'Erro ao resolver contato');
      const result = response.data;
      if (result.success && result.realPhone) {
        toast({ title: "Número encontrado!", description: `O número ${result.realPhone} foi associado ao contato.` });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        if (selectedConversation) queryClient.invalidateQueries({ queryKey: ['conversation', selectedConversation.id] });
      } else {
        toast({ title: "Número não encontrado", description: result.message || "Não foi possível localizar o número real.", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error resolving LID:', error);
      toast({ title: "Erro", description: error instanceof Error ? error.message : "Erro ao tentar localizar o número.", variant: "destructive" });
    } finally { setIsResolvingLid(false); }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    await deleteConversation.mutateAsync(selectedConversation.id);
    setSelectedConversation(null); setShowDeleteDialog(false); setShowMobileChat(false);
  };

  const handleSelectConversation = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation); setShowMobileChat(true);
  }, []);

  const PULL_THRESHOLD = 80;
  const handleTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    const container = conversationListRef.current;
    if (container && container.scrollTop === 0) { pullStartY.current = e.touches[0].clientY; setIsPulling(true); }
  };
  const handleTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!isPulling || isRefreshing) return;
    const container = conversationListRef.current;
    if (!container || container.scrollTop > 0) { setIsPulling(false); setPullDistance(0); return; }
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, Math.min((currentY - pullStartY.current) * 0.5, PULL_THRESHOLD + 20));
    setPullDistance(distance);
  };
  const handleTouchEnd = async () => {
    if (!isPulling) return;
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true); setPullDistance(PULL_THRESHOLD);
      try { await refetchConversations(); toast({ title: "Atualizado", description: "Lista de conversas atualizada" }); }
      catch { toast({ title: "Erro", description: "Falha ao atualizar conversas", variant: "destructive" }); }
      finally { setIsRefreshing(false); }
    }
    setIsPulling(false); setPullDistance(0);
  };

  const handleTextChange = (value: string) => {
    setMessageText(value);
    if (value.length > 0) handleTyping();
    if (value.startsWith('/') && value.length >= 1) { setShowQuickReplies(true); setSelectedQuickReplyIndex(0); }
    else setShowQuickReplies(false);
  };

  const insertQuickReply = (reply: QuickReply) => {
    const processedMessage = replaceTemplateVariables(reply.message, selectedConversation?.contact, profile?.name);
    setMessageText(processedMessage); setShowQuickReplies(false);
  };

  const handleEmojiSelect = (emoji: any) => { setMessageText(prev => prev + emoji.native); setShowEmojiPicker(false); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showQuickReplies && filteredQuickReplies.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedQuickReplyIndex(i => Math.min(i + 1, filteredQuickReplies.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedQuickReplyIndex(i => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertQuickReply(filteredQuickReplies[selectedQuickReplyIndex]); }
      else if (e.key === 'Escape') setShowQuickReplies(false);
    } else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleAddTag = (tagId: string) => { if (!selectedConversation) return; addTagToConversation.mutate({ conversationId: selectedConversation.id, tagId }); };
  const handleRemoveTag = (tagId: string) => { if (!selectedConversation) return; removeTagFromConversation.mutate({ conversationId: selectedConversation.id, tagId }); };

  const navigateSearchResult = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    if (direction === 'next') setCurrentSearchIndex(i => (i + 1) % searchResults.length);
    else setCurrentSearchIndex(i => (i - 1 + searchResults.length) % searchResults.length);
  };

  const formatTime = (date: string) => format(new Date(date), "HH:mm", { locale: ptBR });
  const formatRelativeTime = (date: string) => formatDistanceToNow(new Date(date), { addSuffix: false, locale: ptBR });

  return {
    // State
    activeTab, setActiveTab, selectedConversation, setSelectedConversation, messageText, setMessageText,
    searchQuery, setSearchQuery, mediaPreview, setMediaPreview, attachmentOpen, setAttachmentOpen,
    showProfilePanel, setShowProfilePanel, isUploading, showDeleteDialog, setShowDeleteDialog,
    showMobileChat, setShowMobileChat, showMessageSearch, setShowMessageSearch, messageSearchQuery, setMessageSearchQuery,
    currentSearchIndex, setCurrentSearchIndex, showQuickReplies, selectedQuickReplyIndex,
    showTagPopover, setShowTagPopover,
    showEmojiPicker, setShowEmojiPicker, statusFilter, tagFilter, queueFilter, setQueueFilter,
    showFilterPopover, setShowFilterPopover, showBotFlowDialog, setShowBotFlowDialog,
    selectedFlowId, setSelectedFlowId, showQueueDialog, setShowQueueDialog,
    selectedQueueId, setSelectedQueueId, signatureEnabled, setSignatureEnabled,
    bulkSelectionMode, selectedConversationIds, showBulkDeleteDialog, setShowBulkDeleteDialog,
    showBulkStatusDialog, setShowBulkStatusDialog, showBulkAssignDialog, setShowBulkAssignDialog,
    showBulkTagDialog, setShowBulkTagDialog, showExportDialog, setShowExportDialog,
    bulkStatusValue, setBulkStatusValue, bulkAssignValue, setBulkAssignValue,
    bulkTagMode, setBulkTagMode, selectedBulkTags, setSelectedBulkTags, exportFormat, setExportFormat,
    isPulling, pullDistance, isRefreshing, isResolvingLid,

    // Refs
    pullStartY, conversationListRef, messagesEndRef, messageSearchInputRef,
    fileInputRef, imageInputRef, videoInputRef, messageRefs,

    // Data
    conversations, conversationsLoading, conversationsIsError, conversationsError, refetchConversations,
    messages, messagesLoading, quickReplies, tags, conversationTags, flows, queues, users,
    activeFlows, filteredConversations, filteredQuickReplies, searchResults, tabCounts,
    activeFiltersCount, availableTags, typingUsers, contactIsOnline, contactLastSeen, statusLoading,

    // Auth
    user, profile, canEdit, isAdmin,

    // Mutations
    sendMessage, updateConversation, deleteConversation, bulkDeleteConversations,
    bulkUpdateConversations, bulkAddTags, bulkRemoveTags, exportConversations,
    isRecording, recordingTime, cancelRecording,

    // Handlers
    clearFilters, toggleStatusFilter, toggleTagFilter, toggleBulkSelectionMode,
    toggleConversationSelection, toggleSelectAll, handleBulkDelete, handleBulkStatusUpdate,
    handleBulkAssign, handleBulkResolve, handleBulkArchive, handleBulkTagAction, handleExport,
    handleFileSelect, clearMediaPreview, formatRecordingTime, handleStartRecording,
    handleSendMessage, handleResolve, handleTransferToManual, handleTransferToBot,
    confirmTransferToBot, handleChangeQueue, confirmChangeQueue, handleResolveLidContact,
    handleDeleteConversation, handleSelectConversation,
    handleTouchStart, handleTouchMove, handleTouchEnd, handleTextChange, insertQuickReply,
    handleEmojiSelect, handleKeyDown, handleAddTag, handleRemoveTag,
    navigateSearchResult, formatTime, formatRelativeTime, formatPhoneDisplay,
    getDisplayName, getInitials, PULL_THRESHOLD,
  };
}
