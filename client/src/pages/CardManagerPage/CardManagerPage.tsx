import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Heart,
  Loader2,
  FolderPlus,
  Folder,
  ChevronDown,
  Check,
  MoveRight,
  Download,
  Upload,
  Ban,
  MoreHorizontal,
  Smile,
  ImagePlus,
  Settings,
  Megaphone,
  Copy,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  useReplyCards,
  useCategories,
  useEmojiLib,
  useStickerLib,
  useBlockedCards,
  usePatPats,
  useTaStatuses,
  useTopMottos,
  useDailyAnnouncements,
} from '@client/src/hooks/use-local-storage';
import type { VibeTextItem } from '@client/src/hooks/use-local-storage';
import type { ReplyCard } from '@shared/api.interface';
import { Image as ImageComponent } from '@client/src/components/ui/image';
import { Image } from '@client/src/components/ui/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { toast } from 'sonner';
import { CardItem } from './CardItem';

const PAGE_SIZE = 50;

const CardManagerPage: React.FC = () => {
  const mountStart = performance.now();
  // eslint-disable-next-line no-console
  logger.info('[Perf] CardManagerPage mount start');
  const navigate = useNavigate();
  const listEndRef = useRef<HTMLDivElement>(null);
  const cardListRef = useRef<HTMLDivElement>(null);
  const addTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { cards, addCard, addCardsBatch, updateCard, deleteCard, moveCards } = useReplyCards();
  const { categories, addCategory, renameCategory, deleteCategory } = useCategories();
  const { emojis, addEmoji, removeEmoji } = useEmojiLib();
  const { stickers, addSticker, removeSticker } = useStickerLib();
  const { blockedIds, blockCards, unblockCards, isBlocked } = useBlockedCards();

  const { items: patPats, add: addPatPat, remove: removePatPat } = usePatPats();
  const {
    items: taStatuses,
    current: currentTaStatus,
    add: addTaStatusItem,
    remove: removeTaStatus,
    refresh: refreshTaStatus,
  } = useTaStatuses();
  const { items: topMottos, add: addTopMotto, remove: removeTopMotto } = useTopMottos();
  const {
    items: dailyAnnouncements,
    add: addDailyAnnouncement,
    remove: removeDailyAnnouncement,
  } = useDailyAnnouncements();

  type VibeSubTab = 'patpat' | 'tastatus' | 'questions' | 'period' | 'maxim' | 'dailyAnnouncement' | 'intro';
  const [activeVibeTab, setActiveVibeTab] = useState<VibeSubTab>('patpat');
  const [newPatPatInput, setNewPatPatInput] = useState('');
  const [showAddPatPat, setShowAddPatPat] = useState(false);
  const [newTaStatusInput, setNewTaStatusInput] = useState('');
  const [showAddTaStatus, setShowAddTaStatus] = useState(false);
  const [newTopMottoInput, setNewTopMottoInput] = useState('');
  const [showAddTopMotto, setShowAddTopMotto] = useState(false);
  const [newDailyAnnouncementInput, setNewDailyAnnouncementInput] = useState('');
  const [showAddDailyAnnouncement, setShowAddDailyAnnouncement] = useState(false);

  const handleAddPatPat = () => {
    const lines = newPatPatInput.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    lines.forEach((line) => addPatPat(line));
    setNewPatPatInput('');
    setShowAddPatPat(false);
  };

  const handleAddTaStatus = () => {
    const lines = newTaStatusInput.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    lines.forEach((line) => addTaStatusItem(line));
    setNewTaStatusInput('');
    setShowAddTaStatus(false);
  };

  const handleAddTopMotto = () => {
    const lines = newTopMottoInput.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    lines.forEach((line) => addTopMotto(line));
    setNewTopMottoInput('');
    setShowAddTopMotto(false);
  };

  const handleAddDailyAnnouncement = () => {
    const lines = newDailyAnnouncementInput.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    lines.forEach((line) => addDailyAnnouncement(line));
    setNewDailyAnnouncementInput('');
    setShowAddDailyAnnouncement(false);
  };

  type ManagerTab = 'cards' | 'emoji' | 'stickers' | 'vibe';
  const [activeTab, setActiveTab] = useState<ManagerTab>('cards');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [activeCatId, setActiveCatId] = useState<string>('all');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('default');

  const [newEmojiInput, setNewEmojiInput] = useState('');
  const [activeGroupActionsId, setActiveGroupActionsId] = useState<string | null>(null);

  const groupActionsRef = useRef<HTMLDivElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchKeyword, setSearchKeyword] = useState('');
  const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const moveMenuRef = useRef<HTMLDivElement>(null);

  const [newCatInput, setNewCatInput] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [confirmDelCatId, setConfirmDelCatId] = useState<string | null>(null);
  const [showAddCardPanel, setShowAddCardPanel] = useState(false);
  const [catManageMode, setCatManageMode] = useState(false);
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const [showBatchDelConfirm, setShowBatchDelConfirm] = useState(false);

  const [showDupDialog, setShowDupDialog] = useState(false);
  const [dupGroups, setDupGroups] = useState<{ key: string; cards: ReplyCard[]; categories: string[] }[]>([]);
  const [dedupLoading, setDedupLoading] = useState(false);

  // 分组管理对话框
  const [showGroupManageDialog, setShowGroupManageDialog] = useState(false);
  const [dialogNewCat, setDialogNewCat] = useState(false);
  const [dialogNewCatName, setDialogNewCatName] = useState('');
  const [dialogEditingId, setDialogEditingId] = useState<string | null>(null);
  const [dialogEditingName, setDialogEditingName] = useState('');
  const [dialogDelConfirmId, setDialogDelConfirmId] = useState<string | null>(null);
  const dialogNewCatInputRef = useRef<HTMLInputElement>(null);
  const dialogEditInputRef = useRef<HTMLInputElement>(null);

  const jsonFileRef = useRef<HTMLInputElement>(null);
  const catTabScrollRef = useRef<HTMLDivElement>(null);
  const activeCatBtnRef = useRef<HTMLButtonElement>(null);
  const [importDialog, setImportDialog] = useState<{
    open: boolean;
    mode: 'merge' | 'replace';
    pendingData: {
      categories: Array<{ id: string; name: string; color?: string }>;
      cards: Array<{ content: string; category: string; id?: string; createdAt?: string }>;
      emojis: string[];
      patPats: string[];
      taStatuses: string[];
      topMottos: string[];
      dailyAnnouncements: string[];
      intros: string[];
      announcement?: string | null;
      cardCount: number;
      catCount: number;
      emojiCount: number;
      patPatCount: number;
      taStatusCount: number;
      mottoCount: number;
      dailyAnnouncementCount: number;
      introCount: number;
      hasAnnouncement: boolean;
      modules: {
        key: string;
        label: string;
        count: number;
        unit: string;
        enabled: boolean;
      }[];
    } | null;
  }>({ open: false, mode: 'merge', pendingData: null });

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 50);
    return () => clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    // eslint-disable-next-line no-console
    logger.info('[Perf] CardManagerPage first paint:', { arg0: performance.now() - mountStart, arg1: 'ms, cards:', arg2: cards.length, arg3: ', filtered:', arg4: filteredCards.length });
  }, []);

  useEffect(() => {
    if (categories.length > 0 && activeCatId === 'all') {
      // default
    }
    if (categories.length > 0 && newCategory === '') {
      setNewCategory(categories[0].id);
    }
    setCurrentPage(1);
    cardListRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    const btn = activeCatBtnRef.current;
    const container = catTabScrollRef.current;
    if (btn && container) {
      const btnLeft = btn.offsetLeft;
      const btnRight = btnLeft + btn.offsetWidth;
      const viewLeft = container.scrollLeft;
      const viewRight = viewLeft + container.clientWidth;
      if (btnLeft < viewLeft + 8) {
        container.scrollTo({ left: btnLeft - 8, behavior: 'smooth' });
      } else if (btnRight > viewRight - 8) {
        container.scrollTo({ left: btnRight - container.clientWidth + 8, behavior: 'smooth' });
      }
    }
  }, [categories, activeCatId, newCategory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchKeyword(searchKeyword);
      setCurrentPage(1);
      cardListRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moveMenuRef.current && !moveMenuRef.current.contains(e.target as Node)) {
        setShowMoveMenu(false);
      }
      if (groupActionsRef.current && !groupActionsRef.current.contains(e.target as Node)) {
        setActiveGroupActionsId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      const t0 = performance.now();
      document.removeEventListener('mousedown', handleClickOutside);
      const t1 = performance.now();
      // eslint-disable-next-line no-console
      logger.info('[Perf] CardManagerPage cleanup removeListener:', { arg0: t1 - t0, arg1: 'ms' });
    };
  }, []);

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content) return;
    setSubmitting(true);
    try {
      const lines = content.split('\n');
      addCardsBatch(lines, newCategory || 'default');
      setNewContent('');
    } catch (err) {
      logger.error('添加字卡失败', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    unblockCards(ids);
    ids.forEach((id) => deleteCard(id));
    setSelectedIds(new Set());
  };

  const handleBatchBlock = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const allBlocked = ids.every((id) => isBlocked(id));
    if (allBlocked) {
      unblockCards(ids);
    } else {
      blockCards(ids);
    }
    setSelectedIds(new Set());
  };

  const handleBatchUnblock = () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    unblockCards(ids);
    setSelectedIds(new Set());
  };

  const handleAddEmoji = () => {
    const lines = newEmojiInput.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    lines.forEach((line) => addEmoji(line));
    setNewEmojiInput('');
  };

  const getCatName = (catId: string): string => {
    const cat = categories.find((c) => c.id === catId);
    return cat?.name || '默认';
  };

  const handleCheckDuplicates = () => {
    const map = new Map<string, ReplyCard[]>();
    cards.forEach((card: ReplyCard) => {
      const key = card.content.trim().toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    });
    const groups: { key: string; cards: ReplyCard[]; categories: string[] }[] = [];
    map.forEach((groupCards: ReplyCard[], key: string) => {
      if (groupCards.length > 1) {
        const sorted = [...groupCards].sort(
          (a: ReplyCard, b: ReplyCard) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const catNames = Array.from(new Set(sorted.map((c: ReplyCard) => getCatName(c.category))));
        groups.push({
          key: sorted[0].content,
          cards: sorted,
          categories: catNames,
        });
      }
    });
    setDupGroups(groups);
    setShowDupDialog(true);
    toast.info(`发现 ${groups.length} 组重复字卡`);
  };

  const handleDedupGroup = (groupKey: string) => {
    const group = dupGroups.find((g) => g.key === groupKey);
    if (!group) return;
    const toDelete = group.cards.slice(1);
    toDelete.forEach((card: ReplyCard) => deleteCard(card.id));
    const newGroups = dupGroups.filter((g) => g.key !== groupKey);
    setDupGroups(newGroups);
    toast.success(`已删除 ${toDelete.length} 条重复字卡`);
    if (newGroups.length === 0) {
      setShowDupDialog(false);
    }
  };

  const handleDedupAll = async () => {
    setDedupLoading(true);
    try {
      let total = 0;
      dupGroups.forEach((group) => {
        const toDelete = group.cards.slice(1);
        toDelete.forEach((card: ReplyCard) => deleteCard(card.id));
        total += toDelete.length;
      });
      setDupGroups([]);
      setShowDupDialog(false);
      toast.success(`已删除 ${total} 条重复字卡`);
    } catch (err) {
      logger.error('去重失败', err);
      toast.error('去重失败');
    } finally {
      setDedupLoading(false);
    }
  };

  const filteredCards = useMemo(() => {
    let result = activeCatId === 'all'
      ? cards
      : cards.filter((c) => c.category === activeCatId);
    if (debouncedSearchKeyword.trim()) {
      const kw = debouncedSearchKeyword.trim().toLowerCase();
      result = result.filter((c) => c.content.toLowerCase().includes(kw));
    }
    return result;
  }, [activeCatId, cards, debouncedSearchKeyword]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const pagedCards = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCards.slice(start, start + PAGE_SIZE);
  }, [filteredCards, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startEdit = (card: ReplyCard) => {
    setEditingId(card.id);
    setEditContent(card.content);
    setEditCategory(card.category || 'default');
    setConfirmDeleteId(null);
    setSelectedIds(new Set());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
    setEditCategory('');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const content = editContent.trim();
    if (!content) return;
    setEditSaving(true);
    try {
      updateCard(editingId, {
        content,
        category: editCategory.trim() || 'default',
      });
      cancelEdit();
    } catch (err) {
      logger.error('保存字卡失败', err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeletingId(id);
    try {
      deleteCard(id);
      unblockCards([id]);
      setConfirmDeleteId(null);
      if (editingId === id) cancelEdit();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      logger.error('删除字卡失败', err);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredCards.length && filteredCards.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCards.map((c) => c.id)));
    }
  };

  const handleMoveTo = (catId: string) => {
    if (selectedIds.size === 0) return;
    moveCards(Array.from(selectedIds), catId);
    setSelectedIds(new Set());
    setShowMoveMenu(false);
  };

  const handleAddCategory = () => {
    const name = newCatInput.trim();
    if (!name) return;
    addCategory(name);
    setNewCatInput('');
    setShowNewCat(false);
  };

  const startRenameCat = (id: string, name: string) => {
    setEditingCatId(id);
    setEditingCatName(name);
    setConfirmDelCatId(null);
  };

  const saveRenameCat = () => {
    if (!editingCatId) return;
    const name = editingCatName.trim();
    if (!name) {
      setEditingCatId(null);
      return;
    }
    renameCategory(editingCatId, name);
    setEditingCatId(null);
    setEditingCatName('');
  };

  const handleDeleteCategory = (id: string) => {
    if (id === 'default') return;
    if (confirmDelCatId !== id) {
      setConfirmDelCatId(id);
      return;
    }
    deleteCategory(id);
    setConfirmDelCatId(null);
    if (activeCatId === id) setActiveCatId('all');
  };

  const toggleCatSelect = (id: string) => {
    if (id === 'default') return;
    const next = new Set(selectedCatIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCatIds(next);
  };

  const selectAllCats = () => {
    const deletable = categories.filter((c) => c.id !== 'default');
    if (selectedCatIds.size === deletable.length) {
      setSelectedCatIds(new Set());
    } else {
      setSelectedCatIds(new Set(deletable.map((c) => c.id)));
    }
  };

  const exitCatManageMode = () => {
    setCatManageMode(false);
    setSelectedCatIds(new Set());
  };

  const handleBatchDeleteCats = () => {
    const ids = Array.from(selectedCatIds);
    const cardIdsToMove = cards.filter((c) => ids.includes(c.category)).map((c) => c.id);
    if (cardIdsToMove.length > 0) moveCards(cardIdsToMove, 'default');
    for (const id of ids) {
      deleteCategory(id);
    }
    if (ids.includes(activeCatId)) setActiveCatId('all');
    setShowBatchDelConfirm(false);
    exitCatManageMode();
  };

  const formatDate = (iso: string): string => {
    try {
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day} ${hh}:${mm}`;
    } catch {
      return iso;
    }
  };

  const catCount = (catId: string): number => {
    if (catId === 'all') return cards.length;
    return cards.filter((c) => c.category === catId).length;
  };

  const getCatDotColor = (catId: string): string => {
    // 简单的字符串哈希生成 HSL 颜色
    let hash = 0;
    for (let i = 0; i < catId.length; i++) {
      hash = catId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    if (catId === 'default') return 'var(--chat-accent)';
    return `hsl(${hue}, 65%, 70%)`;
  };

  // ========== 分组管理对话框 ==========
  const openGroupManageDialog = () => {
    setDialogNewCat(false);
    setDialogNewCatName('');
    setDialogEditingId(null);
    setDialogEditingName('');
    setDialogDelConfirmId(null);
    setShowGroupManageDialog(true);
  };

  const handleDialogAddCat = () => {
    const name = dialogNewCatName.trim();
    if (!name) return;
    addCategory(name);
    setDialogNewCatName('');
    setDialogNewCat(false);
  };

  const startDialogEditCat = (id: string, name: string) => {
    setDialogEditingId(id);
    setDialogEditingName(name);
    setDialogDelConfirmId(null);
    setTimeout(() => dialogEditInputRef.current?.focus(), 0);
  };

  const saveDialogEditCat = () => {
    if (!dialogEditingId) return;
    const name = dialogEditingName.trim();
    if (!name) {
      setDialogEditingId(null);
      return;
    }
    renameCategory(dialogEditingId, name);
    setDialogEditingId(null);
    setDialogEditingName('');
  };

  const cancelDialogEditCat = () => {
    setDialogEditingId(null);
    setDialogEditingName('');
  };

  const handleDialogDeleteCat = (id: string) => {
    if (id === 'default') return;
    if (dialogDelConfirmId !== id) {
      setDialogDelConfirmId(id);
      return;
    }
    deleteCategory(id);
    setDialogDelConfirmId(null);
    if (activeCatId === id) setActiveCatId('all');
  };

  const cancelDialogDeleteCat = () => {
    setDialogDelConfirmId(null);
  };

  const confirmDialogDeleteCat = () => {
    if (!dialogDelConfirmId) return;
    deleteCategory(dialogDelConfirmId);
    if (activeCatId === dialogDelConfirmId) setActiveCatId('all');
    setDialogDelConfirmId(null);
  };

  const handleExportJson = async () => {
    let latestCards: ReplyCard[] = [];
    let latestCategories: Array<{ id: string; name: string; color?: string }> = [];
    try {
      const mod = await import('@client/src/utils/local-storage');
      if (typeof mod.getReplyCards === 'function') {
        latestCards = mod.getReplyCards();
      }
      if (typeof mod.getCategories === 'function') {
        latestCategories = mod.getCategories();
      }
    } catch {
      latestCards = cards;
      latestCategories = categories;
    }

    logger.info('[导出调试] localStorage字卡key: ta_reply_cards');
    logger.info('[导出调试] localStorage分组key: ta_card_categories');
    logger.info('[导出调试] 字卡总数:', String(latestCards.length));
    logger.info('[导出调试] 分组总数:', String(latestCategories.length));
    logger.info('[导出调试] 前5条字卡数据:', String(latestCards.slice(0, 5)));
    logger.info('[导出调试] 全部分组数据:', String(latestCategories));
    latestCards.slice(0, 3).forEach((c: { id?: string; content: string; category: string }, i: number) => {
      logger.info(`[导出调试] 字卡${i + 1} category值:`, { arg0: JSON.stringify(c.category), arg1: '类型:', arg2: typeof c.category });
    });

    const catMap = new Map(
      latestCategories.map((c) => [c.id, { name: c.name, color: c.color }] as const),
    );
    logger.info('[导出调试] catMap keys(分组id列表):', String(Array.from(catMap.keys())));
    logger.info('[导出调试] catMap构建: key=分组id, value={name, color}');

    const ungrouped: string[] = [];
    const groupsMap = new Map<string, { name: string; color?: string; items: string[] }>();

    for (const c of latestCards) {
      const catId = c.category || 'default';
      const catInfo = catMap.get(catId);
      if (catId === 'default' || !catInfo) {
        ungrouped.push(c.content);
      } else {
        if (!groupsMap.has(catId)) {
          groupsMap.set(catId, { name: catInfo.name, color: catInfo.color, items: [] });
        }
        groupsMap.get(catId)!.items.push(c.content);
      }
    }

    logger.info('[导出调试] 各分组字卡数:');
    groupsMap.forEach((g, catId) => {
      logger.info(`  - [${catId}] ${g.name}: ${g.items.length} 条`);
    });
    logger.info(`  - [default] 未分组: ${ungrouped.length} 条`);

    const DEFAULT_GROUP_COLOR = '#4DABF7';
    const customReplyGroups = Array.from(groupsMap.entries()).map(([catId, g]) => ({
      id: catId,
      name: g.name,
      color: g.color || DEFAULT_GROUP_COLOR,
      disabled: false,
      items: g.items,
      _collapsed: true as const,
    }));

    logger.info('[导出调试] 最终customReplyGroups结构:', String(customReplyGroups));
    logger.info('[导出调试] 最终customReplies长度:', String(ungrouped.length));

    let customIntros: string[] = [];
    let announcementConfig: Record<string, unknown> = {};
    try {
      const mod = await import('@client/src/utils/local-storage');
      if (typeof mod.getIntroAnimations === 'function') {
        const introItems = mod.getIntroAnimations() as Array<{ content: string }>;
        customIntros = introItems.map((i) => i.content);
      }
      if (typeof mod.getAnnouncement === 'function') {
        const ann = mod.getAnnouncement();
        if (ann !== null && ann !== undefined) {
          announcementConfig = { content: ann, enabled: true };
        }
      }
    } catch {
      // 忽略读取失败，导出为空
    }

    const data = {
      exportDate: new Date().toISOString(),
      modules: [
        'replies',
        'pokes',
        'statuses',
        'mottos',
        'intros',
        'emojis',
        'announcementConfig',
        'groups',
        'pokeGroups',
        'statusGroups',
      ],
      customReplies: ungrouped,
      customReplyGroups,
      customPokes: patPats.map((p) => p.content),
      customPokeGroups: [] as Array<{ name: string; replies: string[]; _collapsed: boolean }>,
      customStatuses: taStatuses.map((s) => s.content),
      customStatusGroups: [] as Array<{ name: string; replies: string[]; _collapsed: boolean }>,
      customMottos: topMottos.map((m) => m.content),
      customIntros,
      customEmojis: emojis,
      dailyAnnouncements: dailyAnnouncements.map((a) => a.content),
      announcementConfig,
    };

    logger.info('[导出调试] 最终导出JSON(预览):', String({
      totalCards: latestCards.length,
      customRepliesCount: ungrouped.length,
      customReplyGroups: customReplyGroups.map((g) => ({
        id: g.id,
        name: g.name,
        itemsCount: g.items.length,
      })),
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `字卡库_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const defaultCatId = 'default';

      const parsedCats: Array<{ id: string; name: string; color?: string }> = [];
      const parsedCards: Array<{ content: string; category: string; id?: string; createdAt?: string }> = [];
      let parsedEmojis: string[] = [];
      let parsedPatPats: string[] = [];
      let parsedTaStatuses: string[] = [];
      let parsedMottos: string[] = [];
      let parsedDailyAnnouncements: string[] = [];
      let parsedIntros: string[] = [];

      const isStringArray = (v: unknown): v is string[] =>
        Array.isArray(v) && v.every((x) => typeof x === 'string');

      if (parsed.customReplyGroups && Array.isArray(parsed.customReplyGroups)) {
        for (const g of parsed.customReplyGroups) {
          if (!g || typeof g !== 'object') continue;
          const gid = String(g.id || `grp_${Math.random().toString(36).slice(2, 8)}`);
          const gname = String(g.name || '未命名分组').trim();
          if (!gname) continue;
          parsedCats.push({ id: gid, name: gname, color: g.color });
          const replyList = isStringArray(g.replies) ? g.replies : isStringArray(g.items) ? g.items : [];
          for (const content of replyList) {
            const trimmed = content.trim();
            if (trimmed) parsedCards.push({ content: trimmed, category: gid });
          }
        }
      }

      if (isStringArray(parsed.customReplies)) {
        const existingContents = new Set(parsedCards.map((c) => c.content));
        for (const s of parsed.customReplies) {
          const trimmed = s.trim();
          if (trimmed && !existingContents.has(trimmed)) {
            parsedCards.push({ content: trimmed, category: defaultCatId });
            existingContents.add(trimmed);
          }
        }
      }

      if (parsed.categories && Array.isArray(parsed.categories)) {
        const existingCatIds = new Set(parsedCats.map((c) => c.id));
        for (const c of parsed.categories) {
          if (c && c.id && c.name && !existingCatIds.has(c.id)) {
            parsedCats.push({ id: c.id, name: c.name, color: c.color });
            existingCatIds.add(c.id);
          }
        }
      }

      if (Array.isArray(parsed.cards)) {
        const existingContents = new Set(parsedCards.map((c) => c.content));
        for (const card of parsed.cards) {
          if (typeof card === 'string') {
            const trimmed = card.trim();
            if (trimmed && !existingContents.has(trimmed)) {
              parsedCards.push({ content: trimmed, category: defaultCatId });
              existingContents.add(trimmed);
            }
          } else if (card && typeof card.content === 'string') {
            const trimmed = card.content.trim();
            if (trimmed && !existingContents.has(trimmed)) {
              parsedCards.push({
                content: trimmed,
                category: card.category || defaultCatId,
                id: card.id,
                createdAt: card.createdAt,
              });
              existingContents.add(trimmed);
            }
          }
        }
      } else if (isStringArray(parsed)) {
        const existingContents = new Set(parsedCards.map((c) => c.content));
        for (const s of parsed) {
          const trimmed = s.trim();
          if (trimmed && !existingContents.has(trimmed)) {
            parsedCards.push({ content: trimmed, category: defaultCatId });
            existingContents.add(trimmed);
          }
        }
      }

      if (isStringArray(parsed.customPokes)) {
        const arr = parsed.customPokes as string[];
        parsedPatPats = [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
      }
      if (isStringArray(parsed.customStatuses)) {
        const arr = parsed.customStatuses as string[];
        parsedTaStatuses = [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
      }
      if (isStringArray(parsed.customMottos)) {
        const arr = parsed.customMottos as string[];
        parsedMottos = [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
      }
      if (isStringArray(parsed.dailyAnnouncements)) {
        const arr = parsed.dailyAnnouncements as string[];
        parsedDailyAnnouncements = [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
      }
      if (isStringArray(parsed.customDailyAnnouncements)) {
        const arr = parsed.customDailyAnnouncements as string[];
        parsedDailyAnnouncements = [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
      }
      if (isStringArray(parsed.customIntros)) {
        const arr = parsed.customIntros as string[];
        parsedIntros = [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
      }
      if (isStringArray(parsed.customEmojis)) {
        const arr = parsed.customEmojis as string[];
        parsedEmojis = [...new Set(arr.filter(Boolean))];
      }

      let parsedAnnouncement: string | null = null;
      if (typeof parsed.announcement === 'string') {
        parsedAnnouncement = parsed.announcement;
      } else if (typeof parsed.customAnnouncement === 'string') {
        parsedAnnouncement = parsed.customAnnouncement;
      }
      const hasAnnouncement = parsedAnnouncement !== null;

      const totalItems = parsedCards.length + parsedEmojis.length + parsedPatPats.length
        + parsedTaStatuses.length + parsedMottos.length + parsedDailyAnnouncements.length + parsedIntros.length
        + (hasAnnouncement ? 1 : 0);
      if (totalItems === 0) {
        toast.error('未找到有效数据，请检查 JSON 格式');
        return;
      }

      const modules = [
        { key: 'cards', label: '主字卡', count: parsedCards.length, unit: '条', enabled: parsedCards.length > 0 },
        { key: 'patPats', label: '拍一拍', count: parsedPatPats.length, unit: '条', enabled: parsedPatPats.length > 0 },
        { key: 'taStatuses', label: '对方状态', count: parsedTaStatuses.length, unit: '条', enabled: parsedTaStatuses.length > 0 },
        { key: 'topMottos', label: '顶部格言', count: parsedMottos.length, unit: '条', enabled: parsedMottos.length > 0 },
        { key: 'dailyAnnouncements', label: '今日公告', count: parsedDailyAnnouncements.length, unit: '条', enabled: parsedDailyAnnouncements.length > 0 },
        { key: 'intros', label: '开场动画', count: parsedIntros.length, unit: '条', enabled: parsedIntros.length > 0 },
        { key: 'emojis', label: 'Emoji 库', count: parsedEmojis.length, unit: '个', enabled: parsedEmojis.length > 0 },
        { key: 'announcement', label: '今日公告配置', count: hasAnnouncement ? 1 : 0, unit: '项', enabled: hasAnnouncement },
        { key: 'categories', label: '字卡分组', count: parsedCats.length, unit: `条·含分组结构`, enabled: parsedCats.length > 0 },
      ];

      setImportDialog({
        open: true,
        mode: 'merge',
        pendingData: {
          categories: parsedCats,
          cards: parsedCards,
          emojis: parsedEmojis,
          patPats: parsedPatPats,
          taStatuses: parsedTaStatuses,
          topMottos: parsedMottos,
          dailyAnnouncements: parsedDailyAnnouncements,
          intros: parsedIntros,
          announcement: parsedAnnouncement,
          cardCount: parsedCards.length,
          catCount: parsedCats.length,
          emojiCount: parsedEmojis.length,
          patPatCount: parsedPatPats.length,
          taStatusCount: parsedTaStatuses.length,
          mottoCount: parsedMottos.length,
          dailyAnnouncementCount: parsedDailyAnnouncements.length,
          introCount: parsedIntros.length,
          hasAnnouncement,
          modules,
        },
      });
    } catch (err) {
      logger.error('JSON 导入失败', err);
      toast.error('JSON 解析失败，请检查文件格式');
    } finally {
      e.target.value = '';
    }
  };

  const doImport = async () => {
    const data = importDialog.pendingData;
    if (!data) return;
    const mode = importDialog.mode;
    const defaultCatId = 'default';

    const isModuleEnabled = (key: string): boolean => {
      const m = data.modules.find((x) => x.key === key);
      return !!m?.enabled;
    };

    const cardsEnabled = isModuleEnabled('cards');
    const catsEnabled = isModuleEnabled('categories') && cardsEnabled;
    const emojisEnabled = isModuleEnabled('emojis');
    const patPatsEnabled = isModuleEnabled('patPats');
    const taStatusesEnabled = isModuleEnabled('taStatuses');
    const mottosEnabled = isModuleEnabled('topMottos');
    const dailyAnnouncementsEnabled = isModuleEnabled('dailyAnnouncements');
    const introsEnabled = isModuleEnabled('intros');
    const announcementEnabled = isModuleEnabled('announcement');

    if (mode === 'replace') {
      if (cardsEnabled) {
        const finalCats = catsEnabled && data.categories.length > 0
          ? data.categories
          : [{ id: defaultCatId, name: '默认' }];
        const hasDefault = finalCats.some((c) => c.id === defaultCatId);
        if (!hasDefault) finalCats.unshift({ id: defaultCatId, name: '默认' });
        const now = new Date().toISOString();
        const finalCards = data.cards.map((c) => ({
          id: c.id || crypto.randomUUID(),
          content: c.content,
          category: c.category || defaultCatId,
          createdAt: c.createdAt || now,
          updatedAt: now,
        }));
        localStorage.setItem('ta_card_categories', JSON.stringify(finalCats));
        localStorage.setItem('ta_reply_cards', JSON.stringify(finalCards));
      }
      if (emojisEnabled) {
        localStorage.setItem('ta_custom_emojis', JSON.stringify(data.emojis));
      }
      if (patPatsEnabled) {
        localStorage.setItem('ta_vibe_pat_pats', JSON.stringify(data.patPats.map((s, i) => ({ id: `pat_${i}`, content: s }))));
      }
      if (taStatusesEnabled) {
        localStorage.setItem('ta_vibe_statuses', JSON.stringify(data.taStatuses.map((s, i) => ({ id: `status_${i}`, content: s }))));
      }
      if (mottosEnabled) {
        localStorage.setItem('ta_top_mottos', JSON.stringify(data.topMottos.map((s, i) => ({ id: `motto_${i}`, content: s }))));
      }
      if (dailyAnnouncementsEnabled) {
        localStorage.setItem('ta_vibe_daily_announcement', JSON.stringify(data.dailyAnnouncements.map((s, i) => ({ id: `daily_ann_${i}`, content: s }))));
      }
      if (introsEnabled) {
        try {
          const { saveIntroAnimations } = await import('@client/src/utils/local-storage');
          saveIntroAnimations(data.intros);
        } catch (e) {
          logger.warn('导入开场动画失败', e);
        }
      }
      if (announcementEnabled && data.announcement !== null) {
        try {
          const { saveAnnouncement } = await import('@client/src/utils/local-storage');
          saveAnnouncement(data.announcement);
        } catch (e) {
          logger.warn('导入公告失败', e);
        }
      }
      window.location.reload();
      return;
    }

    let addedCats = 0;
    if (catsEnabled) {
      const existingCardContents = new Set(cards.map((c) => c.content));
      const catIdMap = new Map<string, string>();
      for (const cat of data.categories) {
        const existing = categories.find((c) => c.id === cat.id);
        if (existing) {
          catIdMap.set(cat.id, existing.id);
        } else {
          const existingByName = categories.find((c) => c.name === cat.name);
          if (existingByName) {
            catIdMap.set(cat.id, existingByName.id);
          } else {
            const newCat = addCategory(cat.name);
            catIdMap.set(cat.id, newCat.id);
            addedCats += 1;
          }
        }
      }

      const defaultLines: string[] = [];
      const nonDefaultCards: Array<{ content: string; category: string }> = [];
      for (const c of data.cards) {
        if (existingCardContents.has(c.content)) continue;
        existingCardContents.add(c.content);
        const mappedCat = catIdMap.get(c.category) || c.category || defaultCatId;
        const catExists = categories.some((x) => x.id === mappedCat)
          || [...catIdMap.values()].includes(mappedCat);
        const finalCat = catExists ? mappedCat : defaultCatId;
        if (finalCat === defaultCatId) {
          defaultLines.push(c.content);
        } else {
          nonDefaultCards.push({ content: c.content, category: finalCat });
        }
      }
      if (defaultLines.length > 0) addCardsBatch(defaultLines, defaultCatId);
      for (const c of nonDefaultCards) addCard(c.content, c.category);
      const addedCards = defaultLines.length + nonDefaultCards.length;
      if (addedCards > 0 || addedCats > 0) {
        // 字卡/分组处理完成
      }
    }

    let addedCards = 0;
    if (cardsEnabled && !catsEnabled) {
      const existingCardContents = new Set(cards.map((c) => c.content));
      const newCards: string[] = [];
      for (const c of data.cards) {
        if (!existingCardContents.has(c.content)) {
          existingCardContents.add(c.content);
          newCards.push(c.content);
        }
      }
      if (newCards.length > 0) addCardsBatch(newCards, defaultCatId);
      addedCards = newCards.length;
    } else if (cardsEnabled) {
      addedCards = data.cards.filter((c) =>
        !cards.some((x) => x.content === c.content)
      ).length;
    }

    let addedEmojis = 0;
    if (emojisEnabled) {
      const emojiSet = new Set(emojis);
      for (const e of data.emojis) {
        if (!emojiSet.has(e)) {
          addEmoji(e);
          emojiSet.add(e);
          addedEmojis += 1;
        }
      }
    }

    let addedPatPats = 0;
    if (patPatsEnabled) {
      const patPatSet = new Set(patPats.map((p) => p.content));
      for (const s of data.patPats) {
        if (!patPatSet.has(s)) {
          addPatPat(s);
          patPatSet.add(s);
          addedPatPats += 1;
        }
      }
    }

    let addedTaStatuses = 0;
    if (taStatusesEnabled) {
      const statusSet = new Set(taStatuses.map((s) => s.content));
      for (const s of data.taStatuses) {
        if (!statusSet.has(s)) {
          addTaStatusItem(s);
          statusSet.add(s);
          addedTaStatuses += 1;
        }
      }
    }

    let addedMottos = 0;
    if (mottosEnabled) {
      const mottoSet = new Set(topMottos.map((m) => m.content));
      for (const s of data.topMottos) {
        if (!mottoSet.has(s)) {
          addTopMotto(s);
          mottoSet.add(s);
          addedMottos += 1;
        }
      }
    }

    let addedDailyAnnouncements = 0;
    if (dailyAnnouncementsEnabled) {
      const dailyAnnSet = new Set(dailyAnnouncements.map((m) => m.content));
      for (const s of data.dailyAnnouncements) {
        if (!dailyAnnSet.has(s)) {
          addDailyAnnouncement(s);
          dailyAnnSet.add(s);
          addedDailyAnnouncements += 1;
        }
      }
    }

    let addedIntros = 0;
    if (introsEnabled && data.intros.length > 0) {
      try {
        const { getIntroAnimations, addIntroAnimation } = await import('@client/src/utils/local-storage');
        const existing = getIntroAnimations();
        const introSet = new Set(existing.map((i) => i.content));
        for (const s of data.intros) {
          if (!introSet.has(s)) {
            addIntroAnimation(s);
            introSet.add(s);
            addedIntros += 1;
          }
        }
      } catch (e) {
        logger.warn('导入开场动画失败', e);
      }
    }

    let addedAnnouncement = false;
    if (announcementEnabled && data.announcement !== null) {
      try {
        const { saveAnnouncement, getAnnouncement } = await import('@client/src/utils/local-storage');
        const current = getAnnouncement();
        if (current !== data.announcement) {
          saveAnnouncement(data.announcement);
          addedAnnouncement = true;
        }
      } catch (e) {
        logger.warn('导入公告失败', e);
      }
    }

    const parts: string[] = [];
    if (addedCards > 0) parts.push(`字卡 ${addedCards} 条`);
    if (addedCats > 0) parts.push(`分组 ${addedCats} 个`);
    if (addedEmojis > 0) parts.push(`Emoji ${addedEmojis} 个`);
    if (addedPatPats > 0) parts.push(`拍一拍 ${addedPatPats} 条`);
    if (addedTaStatuses > 0) parts.push(`状态 ${addedTaStatuses} 条`);
    if (addedMottos > 0) parts.push(`格言 ${addedMottos} 条`);
    if (addedDailyAnnouncements > 0) parts.push(`今日公告 ${addedDailyAnnouncements} 条`);
    if (addedIntros > 0) parts.push(`开场动画 ${addedIntros} 条`);
    if (addedAnnouncement) parts.push(`公告配置 1 项`);

    if (parts.length === 0) {
      toast('导入完成，所有数据均已存在，未新增');
    } else {
      toast.success(`导入成功：${parts.join('、')}`);
    }

    setImportDialog({ open: false, mode: 'merge', pendingData: null });
  };

  return (
    <div
      className="h-dvh w-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: 'var(--chat-setting-page-bg)',
        color: 'var(--chat-text-primary)',
      }}
    >
      <header className="flex items-center justify-between px-3 md:px-6 py-4 flex-shrink-0"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-full hover:bg-[color-mix(in_oklab,var(--chat-bubble-me-text)_5%,transparent)] transition-colors"
          style={{ color: 'var(--chat-text-primary)' }}
          aria-label="返回"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-medium">回复库管理</h1>
        <div
          className="text-sm px-3 py-1 rounded-full"
          style={{
            color: 'var(--chat-accent)',
            backgroundColor: 'color-mix(in_oklab, var(--chat-accent) 12%, transparent)',
          }}
        >
          {activeTab === 'cards' && `共 ${cards.length} 张`}
          {activeTab === 'emoji' && `共 ${emojis.length} 个`}
          {activeTab === 'stickers' && `共 ${stickers.length} 张`}
          {activeTab === 'vibe' && activeVibeTab === 'patpat' && `共 ${patPats.length} 条`}
          {activeTab === 'vibe' && activeVibeTab === 'tastatus' && `共 ${taStatuses.length} 条`}
        </div>
      </header>

       <section className="px-3 md:px-6 pb-2 flex-shrink-0">
         <div className="flex items-center gap-1 rounded-full p-1 overflow-x-auto flex-nowrap" style={{ backgroundColor: 'var(--chat-surface-secondary)', scrollbarWidth: 'none' }}>
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors`}
            style={{
              color: activeTab === 'cards' ? 'var(--chat-bubble-me-text)' : 'var(--chat-text-secondary)',
              backgroundColor: activeTab === 'cards' ? 'var(--chat-accent)' : 'transparent',
            }}
          >
            主字卡
          </button>
          <button
            onClick={() => setActiveTab('emoji')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1`}
            style={{
              color: activeTab === 'emoji' ? 'var(--chat-bubble-me-text)' : 'var(--chat-text-secondary)',
              backgroundColor: activeTab === 'emoji' ? 'var(--chat-accent)' : 'transparent',
            }}
          >
            <Smile size={12} />
            Emoji
          </button>
           <button
             onClick={() => setActiveTab('stickers')}
             className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1`}
             style={{
               color: activeTab === 'stickers' ? 'var(--chat-bubble-me-text)' : 'var(--chat-text-secondary)',
               backgroundColor: activeTab === 'stickers' ? 'var(--chat-accent)' : 'transparent',
             }}
           >
             <ImagePlus size={12} />
             表情库
           </button>
           <button
             onClick={() => setActiveTab('vibe')}
             className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1`}
             style={{
               color: activeTab === 'vibe' ? 'var(--chat-bubble-me-text)' : 'var(--chat-text-secondary)',
               backgroundColor: activeTab === 'vibe' ? 'var(--chat-accent)' : 'transparent',
             }}
           >
             <Heart size={12} />
             氛围感
           </button>
         </div>
       </section>

        {activeTab === 'cards' && (
          <section className="px-3 md:px-6 pb-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div
                ref={catTabScrollRef}
                className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                style={{ scrollbarWidth: 'none' }}
                onWheel={(e) => {
                  const el = catTabScrollRef.current;
                  if (!el) return;
                  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                    el.scrollLeft += e.deltaY;
                    e.preventDefault();
                  }
                }}
              >
                <button
                  onClick={() => setActiveCatId('all')}
                  ref={activeCatId === 'all' ? activeCatBtnRef : undefined}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
                    activeCatId === 'all' ? 'font-medium' : ''
                  }`}
                  style={{
                    color: activeCatId === 'all' ? 'var(--chat-bubble-me-text)' : 'var(--chat-text-secondary)',
                    backgroundColor: activeCatId === 'all'
                      ? 'var(--chat-accent)'
                      : 'var(--chat-surface-secondary)',
                  }}
                >
                  <Folder size={12} />
                  全部
                  <span className="opacity-70">({catCount('all')})</span>
                </button>
                {categories.map((cat) => (
                  <div key={cat.id} className="flex-shrink-0 flex items-center gap-1">
                    {editingCatId === cat.id ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full"
                        style={{ backgroundColor: 'var(--chat-divider-soft)' }}
                      >
                        <input
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          onBlur={saveRenameCat}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRenameCat();
                            if (e.key === 'Escape') setEditingCatId(null);
                          }}
                          autoFocus
                          className="bg-transparent outline-none text-xs w-20"
                          style={{ color: 'var(--chat-text-primary)' }}
                        />
                        <button
                          onClick={saveRenameCat}
                          className="p-0.5 rounded"
                          style={{ color: 'var(--chat-accent)' }}
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : catManageMode ? (
                      <button
                        onClick={() => toggleCatSelect(cat.id)}
                        disabled={cat.id === 'default'}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
                          selectedCatIds.has(cat.id) ? 'font-medium' : ''
                        } ${cat.id === 'default' ? 'opacity-40 cursor-not-allowed' : ''}`}
                        style={{
                          color: selectedCatIds.has(cat.id) ? 'var(--chat-bubble-me-text)' : 'var(--chat-text-secondary)',
                          backgroundColor: selectedCatIds.has(cat.id)
                            ? 'var(--chat-accent)'
                            : 'var(--chat-surface-secondary)',
                          border: selectedCatIds.has(cat.id)
                            ? '1px solid var(--chat-accent)'
                            : '1px solid transparent',
                        }}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
                          style={{
                             backgroundColor: selectedCatIds.has(cat.id)
                               ? 'color-mix(in_oklab, var(--chat-accent) 40%, transparent)'
                               : 'color-mix(in_oklab, var(--chat-text-tertiary) 20%, transparent)',
                          }}
                        >
                          {selectedCatIds.has(cat.id) && <Check size={10} />}
                        </div>
                        {cat.name}
                        <span className="opacity-70">({catCount(cat.id)})</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveCatId(cat.id)}
                        ref={activeCatId === cat.id ? activeCatBtnRef : undefined}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
                          activeCatId === cat.id ? 'font-medium' : ''
                        }`}
                        style={{
                          color: activeCatId === cat.id ? 'var(--chat-bubble-me-text)' : 'var(--chat-text-secondary)',
                          backgroundColor: activeCatId === cat.id
                            ? 'var(--chat-accent)'
                            : 'var(--chat-surface-secondary)',
                        }}
                      >
                        <Folder size={12} />
                        {cat.name}
                        <span className="opacity-70">({catCount(cat.id)})</span>
                      </button>
                    )}
                  </div>
                ))}
                {!catManageMode && (showNewCat ? (
                  <div className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--chat-divider-soft)' }}
                  >
                    <input
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      onBlur={() => {
                        if (newCatInput.trim()) handleAddCategory();
                        else setShowNewCat(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCategory();
                        if (e.key === 'Escape') setShowNewCat(false);
                      }}
                      autoFocus
                      placeholder="分组名"
                      className="bg-transparent outline-none text-xs w-20"
                      style={{ color: 'var(--chat-text-primary)' }}
                    />
                    <button
                      onClick={handleAddCategory}
                      className="p-0.5 rounded"
                      style={{ color: 'var(--chat-accent)' }}
                    >
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowNewCat(true); setNewCatInput(''); }}
                    className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs"
                    style={{
                      color: 'var(--chat-text-secondary)',
                      backgroundColor: 'var(--chat-surface-secondary)',
                      border: '1px solid var(--chat-divider-soft)',
                    }}
                  >
                    <FolderPlus size={12} />
                    新建分组
                  </button>
                ))}
              </div>
              {catManageMode && (
                <div className="flex-shrink-0 flex items-center gap-2 ml-2">
                  <button
                    onClick={selectAllCats}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs"
                    style={{
                      color: 'var(--chat-text-secondary)',
                      backgroundColor: 'var(--chat-surface-secondary)',
                    }}
                  >
                    {selectedCatIds.size === categories.filter((c) => c.id !== 'default').length ? '取消全选' : '全选'}
                  </button>
                  <span className="text-xs" style={{ color: 'var(--chat-text-tertiary)' }}>
                    已选 {selectedCatIds.size}
                  </span>
                  <button
                    onClick={() => setShowBatchDelConfirm(true)}
                    disabled={selectedCatIds.size === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-opacity disabled:opacity-40"
                    style={{
                      color: 'var(--chat-bubble-me-text)',
                      backgroundColor: 'var(--chat-danger)',
                    }}
                  >
                    <Trash2 size={12} />
                    删除选中
                  </button>
                  <button
                    onClick={exitCatManageMode}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs"
                    style={{
                      color: 'var(--chat-bubble-me-text)',
                      backgroundColor: 'var(--chat-accent)',
                    }}
                  >
                    完成
                  </button>
                </div>
              )}
              {!catManageMode && (
                <button
                  onClick={openGroupManageDialog}
                  className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs ml-1"
                  style={{
                    color: 'var(--chat-text-secondary)',
                    backgroundColor: 'var(--chat-surface-secondary)',
                    border: '1px solid var(--chat-divider-soft)',
                  }}
                >
                  <FolderPlus size={12} />
                  分组管理
                </button>
              )}
            </div>
          </section>
        )}

       {activeTab === 'cards' && (
         <section className="px-3 md:px-6 pb-2 flex-shrink-0">
           <div className="flex items-center justify-between gap-2 flex-wrap">
             <button
               onClick={() => setShowAddCardPanel(true)}
               className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
               style={{
                 color: 'var(--chat-bubble-me-text)',
                 backgroundColor: 'var(--chat-accent)',
               }}
             >
               <Plus size={12} />
               添加字卡
             </button>
              <div className="flex items-center gap-2 flex-1 justify-end">
                 <div className="relative flex-1 min-w-[120px] max-w-full md:max-w-[200px]">
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="搜索字卡"
                    className="w-full h-7 px-3 pr-7 rounded-full text-xs outline-none"
                    style={{
                      color: 'var(--chat-text-primary)',
                      backgroundColor: 'var(--chat-surface-secondary)',
                      border: '1px solid var(--chat-divider-soft)',
                    }}
                  />
                  {searchKeyword && (
                    <button
                      onClick={() => setSearchKeyword('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full"
                      style={{ color: 'var(--chat-text-muted)' }}
                      aria-label="清除搜索"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <input
                  ref={jsonFileRef}
                 type="file"
                 accept=".json,application/json"
                 className="hidden"
                 onChange={handleImportJson}
               />
               <button
                 onClick={() => jsonFileRef.current?.click()}
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                 style={{
                   color: 'var(--chat-text-secondary)',
                   backgroundColor: 'var(--chat-surface-secondary)',
                 }}
               >
                 <Upload size={12} />
                 导入
               </button>
                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                  style={{
                    color: 'var(--chat-text-secondary)',
                    backgroundColor: 'var(--chat-surface-secondary)',
                  }}
                >
                  <Download size={12} />
                  导出
                </button>
                <button
                  onClick={handleCheckDuplicates}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
                  style={{
                    color: 'var(--chat-text-secondary)',
                    backgroundColor: 'var(--chat-surface-secondary)',
                  }}
                >
                  <Copy size={12} />
                  查重
                </button>
              </div>
           </div>
         </section>
       )}

       {activeTab === 'cards' && showAddCardPanel && (
         <section className="px-3 md:px-6 pb-3 flex-shrink-0">
           <div
             className="rounded-2xl p-4 shadow-md"
             style={{
               backgroundColor: 'var(--chat-surface-secondary)',
               border: '1px solid var(--chat-surface-secondary)',
               backdropFilter: 'blur(8px)',
             }}
           >
             <textarea
               ref={addTextareaRef}
               value={newContent}
               onChange={(e) => setNewContent(e.target.value)}
               placeholder={'每行一条字卡，一次添加多张，空行自动忽略...'}
               rows={5}
               className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed placeholder:text-[var(--chat-text-muted)]"
               style={{ color: 'var(--chat-text-primary)' }}
             />
             <div className="flex items-center gap-2 mt-3">
               <select
                 value={newCategory}
                 onChange={(e) => setNewCategory(e.target.value)}
                 className="text-sm px-3 py-2 rounded-lg outline-none cursor-pointer"
                 style={{
                   color: 'var(--chat-text-primary)',
                   backgroundColor: 'var(--chat-surface-secondary)',
                   border: '1px solid var(--chat-divider-soft)',
                 }}
               >
                 {categories.map((cat) => (
                   <option key={cat.id} value={cat.id}>
                     {cat.name}
                   </option>
                 ))}
               </select>
               <button
                 onClick={() => setShowAddCardPanel(false)}
                 className="px-3 py-2 rounded-lg text-xs"
                 style={{
                   color: 'var(--chat-text-secondary)',
                   backgroundColor: 'var(--chat-surface-secondary)',
                 }}
               >
                 收起
               </button>
               <button
                 onClick={handleAdd}
                 disabled={submitting || !newContent.trim()}
                 className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 ml-auto"
                 style={{
                   backgroundColor: 'var(--chat-accent)',
                   color: 'var(--chat-bubble-me-text)',
                 }}
               >
                 {submitting ? (
                   <Loader2 size={16} className="animate-spin" />
                 ) : (
                   <Plus size={16} />
                 )}
                 批量添加
               </button>
             </div>
           </div>
         </section>
       )}

       {activeTab === 'cards' && selectedIds.size > 0 && (
         <section className="px-3 md:px-6 pb-3 flex-shrink-0">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{
              backgroundColor: 'color-mix(in_oklab, var(--chat-accent) 20%, transparent)',
              border: '1px solid color-mix(in_oklab, var(--chat-accent) 25%, transparent)',
            }}
          >
            <span className="text-sm" style={{ color: 'var(--chat-accent-light)' }}>
              已选 {selectedIds.size} 张
            </span>
            <div className="relative flex-1" ref={moveMenuRef}>
              <button
                onClick={() => setShowMoveMenu((v) => !v)}
                className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs"
                style={{
                  color: 'var(--chat-bubble-me-text)',
                  backgroundColor: 'var(--chat-accent)',
                }}
              >
                <MoveRight size={12} />
                移动到分组
                <ChevronDown size={12} />
              </button>
              {showMoveMenu && (
                <div
                  className="absolute left-0 top-8 z-20 rounded-lg py-1 min-w-[120px] shadow-lg"
                  style={{ backgroundColor: 'var(--chat-setting-group-bg)' }}
                >
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleMoveTo(cat.id)}
                      className="w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-[color-mix(in_oklab,var(--chat-bubble-me-text)_10%,transparent)]"
                      style={{ color: 'var(--chat-text-primary)' }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleBatchBlock}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
              style={{
                color: 'var(--chat-bubble-me-text)',
                backgroundColor: 'hsla(30, 80%, 60%, 0.9)',
              }}
            >
              <Ban size={12} />
              {selectedIds.size > 0 && Array.from(selectedIds).every((id) => isBlocked(id)) ? '取消屏蔽' : '屏蔽'}
            </button>
            <button
              onClick={handleBatchDelete}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs"
              style={{
                color: 'var(--chat-bubble-me-text)',
                backgroundColor: 'var(--chat-danger)',
              }}
            >
              <Trash2 size={12} />
              删除
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs"
              style={{ color: 'var(--chat-text-secondary)' }}
            >
              取消选择
            </button>
          </div>
        </section>
      )}

      {activeTab === 'cards' && (
        <section
          className="flex-1 overflow-y-auto px-3 md:px-6 pb-6 space-y-3"
          ref={(el: HTMLDivElement | null) => { listEndRef.current = el; cardListRef.current = el; }}
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2
              size={28}
              className="animate-spin"
              style={{ color: 'var(--chat-accent)' }}
            />
            <span style={{ color: 'var(--chat-text-secondary)' }} className="text-sm">
              加载中...
            </span>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in_oklab, var(--chat-accent) 20%, transparent)' }}
            >
              <Heart size={28} style={{ color: 'var(--chat-accent)' }} />
            </div>
            <div>
              <p className="text-base font-medium" style={{ color: 'var(--chat-text-primary)' }}>
                {searchKeyword.trim()
                  ? `未找到包含'${searchKeyword}'的字卡`
                  : activeCatId === 'all' ? '还没有字卡呢' : '该分组暂无字卡'}
              </p>
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--chat-text-secondary)' }}
              >
                {searchKeyword.trim()
                  ? '试试其他关键词，或清除搜索条件'
                  : activeCatId === 'all'
                    ? '在上方写下第一句话，让TA开口说吧 💌'
                    : '可以从其他分组成批移动字卡到这里'}
              </p>
            </div>
          </div>
        ) : (
          <>
             <div className="flex items-center justify-between px-1 mb-1">
               <button
                 onClick={selectAll}
                 className="flex items-center gap-2 text-xs"
                 style={{ color: 'var(--chat-text-tertiary)' }}
               >
                 <div
                   className="w-4 h-4 rounded flex items-center justify-center"
                   style={{
                     backgroundColor:
                       selectedIds.size === filteredCards.length && filteredCards.length > 0
                         ? 'var(--chat-accent)'
                         : 'transparent',
                     border: '1px solid var(--chat-divider)',
                   }}
                 >
                   {selectedIds.size === filteredCards.length && filteredCards.length > 0 && (
                     <Check size={10} style={{ color: 'var(--chat-bubble-me-text)' }} />
                   )}
                 </div>
                 全选 ({filteredCards.length}张)
               </button>
             </div>
             {pagedCards.map((card: ReplyCard) => (
               <CardItem
                 key={card.id}
                 card={card}
                 isSelected={selectedIds.has(card.id)}
                 isBlocked={isBlocked(card.id)}
                 isEditing={editingId === card.id}
                 editContent={editContent}
                 editCategory={editCategory}
                 editSaving={editSaving}
                 deletingId={deletingId}
                 confirmDeleteId={confirmDeleteId}
                 categories={categories}
                 catName={getCatName(card.category)}
                 onToggleSelect={toggleSelect}
                 onStartEdit={startEdit}
                 onCancelEdit={cancelEdit}
                 onSaveEdit={handleSaveEdit}
                 onEditContentChange={setEditContent}
                 onEditCategoryChange={setEditCategory}
                 onToggleBlock={(id) => {
                   if (isBlocked(id)) {
                     unblockCards([id]);
                   } else {
                     blockCards([id]);
                   }
                 }}
                 onDelete={(id) => void handleDelete(id)}
                 onConfirmDelete={(id) => setConfirmDeleteId(id)}
               />
             ))}
             {totalPages > 1 && (
               <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                  <button
                    onClick={() => {
                      setCurrentPage(1);
                      cardListRef.current?.scrollTo({ top: 0, behavior: 'auto' });
                    }}
                    disabled={currentPage === 1}
                   className="px-2 py-1 rounded-lg text-xs transition-opacity disabled:opacity-30"
                   style={{
                     color: 'var(--chat-text-secondary)',
                     backgroundColor: 'var(--chat-surface-secondary)',
                   }}
                 >
                   首页
                 </button>
                  <button
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      cardListRef.current?.scrollTo({ top: 0, behavior: 'auto' });
                    }}
                    disabled={currentPage === 1}
                   className="px-2 py-1 rounded-lg text-xs transition-opacity disabled:opacity-30"
                   style={{
                     color: 'var(--chat-text-secondary)',
                     backgroundColor: 'var(--chat-surface-secondary)',
                   }}
                 >
                   上一页
                 </button>
                 <span
                   className="text-xs px-2"
                   style={{ color: 'var(--chat-text-secondary)' }}
                 >
                   第 <span style={{ color: 'var(--chat-accent)', fontWeight: 500 }}>{currentPage}</span> / {totalPages} 页 · 共 {filteredCards.length} 张
                 </span>
                  <button
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      cardListRef.current?.scrollTo({ top: 0, behavior: 'auto' });
                    }}
                    disabled={currentPage === totalPages}
                   className="px-2 py-1 rounded-lg text-xs transition-opacity disabled:opacity-30"
                   style={{
                     color: 'var(--chat-text-secondary)',
                     backgroundColor: 'var(--chat-surface-secondary)',
                   }}
                 >
                   下一页
                 </button>
                  <button
                    onClick={() => {
                      setCurrentPage(totalPages);
                      cardListRef.current?.scrollTo({ top: 0, behavior: 'auto' });
                    }}
                    disabled={currentPage === totalPages}
                   className="px-2 py-1 rounded-lg text-xs transition-opacity disabled:opacity-30"
                   style={{
                     color: 'var(--chat-text-secondary)',
                     backgroundColor: 'var(--chat-surface-secondary)',
                   }}
                 >
                   末页
                 </button>
               </div>
             )}
           </>
         )}

        <div className="h-2" />
        </section>
      )}

       {activeTab === 'emoji' && (
         <section className="flex-1 overflow-y-auto px-3 md:px-6 pb-6 space-y-3"
           style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
         >
          <div
            className="rounded-2xl p-4 shadow-md"
            style={{
              backgroundColor: 'var(--chat-surface-secondary)',
              border: '1px solid var(--chat-surface-secondary)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div className="space-y-2">
              <textarea
                value={newEmojiInput}
                onChange={(e) => setNewEmojiInput(e.target.value)}
                placeholder="输入 Emoji，每行一个，批量添加..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-lg bg-transparent outline-none resize-none leading-relaxed"
                style={{
                  color: 'var(--chat-text-primary)',
                  backgroundColor: 'var(--chat-surface-secondary)',
                  border: '1px solid var(--chat-divider-soft)',
                }}
              />
              <div className="flex justify-end">
                <button
                  onClick={handleAddEmoji}
                  disabled={!newEmojiInput.trim()}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--chat-accent)',
                    color: 'var(--chat-bubble-me-text)',
                  }}
                >
                  <Plus size={14} />
                  批量添加
                </button>
              </div>
            </div>
          </div>

          {emojis.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <Smile size={28} style={{ color: 'var(--chat-accent)' }} />
              <p className="text-sm" style={{ color: 'var(--chat-text-secondary)' }}>
                还没有 Emoji，添加一个吧
              </p>
            </div>
          ) : (
             <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {emojis.map((emoji, idx) => (
                <div
                  key={`${emoji}-${idx}`}
                  className="relative aspect-square flex items-center justify-center text-2xl rounded-xl group transition-colors"
                  style={{
                    backgroundColor: 'var(--chat-surface-secondary)',
                    border: '1px solid var(--chat-surface-secondary)',
                  }}
                >
                  <span>{emoji}</span>
                  <button
                    onClick={() => removeEmoji(emoji)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      backgroundColor: 'var(--chat-danger)',
                      color: 'var(--chat-bubble-me-text)',
                    }}
                    aria-label="删除"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'stickers' && (
         <section className="flex-1 overflow-y-auto px-3 md:px-6 pb-6 space-y-3"
           style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
         >
          <div
            className="rounded-2xl p-4 shadow-md"
            style={{
              backgroundColor: 'var(--chat-surface-secondary)',
              border: '1px solid var(--chat-surface-secondary)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <label
              className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl cursor-pointer transition-colors border-2 border-dashed hover:opacity-80"
              style={{
                borderColor: 'color-mix(in_oklab, var(--chat-accent) 40%, transparent)',
                backgroundColor: 'color-mix(in_oklab, var(--chat-accent) 8%, transparent)',
                color: 'var(--chat-text-primary)',
              }}
            >
              <ImagePlus size={20} style={{ color: 'var(--chat-accent)' }} />
              <span className="text-sm">点击上传表情包图片</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files || files.length === 0) return;
                  Array.from(files).forEach((file) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const result = ev.target?.result;
                      if (typeof result === 'string' && result.startsWith('data:image')) {
                        const img = new window.Image();
                        img.onload = () => {
                          const maxSize = 256;
                          const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
                          const w = Math.floor(img.width * ratio);
                          const h = Math.floor(img.height * ratio);
                          const canvas = document.createElement('canvas');
                          canvas.width = w;
                          canvas.height = h;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.drawImage(img, 0, 0, w, h);
                            const dataUrl = canvas.toDataURL('image/png', 0.9);
                            void addSticker(dataUrl);
                          }
                        };
                        img.src = result;
                      }
                    };
                    reader.readAsDataURL(file);
                  });
                  e.target.value = '';
                }}
              />
            </label>
            <p className="text-xs mt-2 text-center" style={{ color: 'var(--chat-text-tertiary)' }}>
              支持 JPG / PNG / GIF 等图片格式，自动压缩保存到本地
            </p>
          </div>

          {stickers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <ImagePlus size={28} style={{ color: 'var(--chat-accent)' }} />
              <p className="text-sm" style={{ color: 'var(--chat-text-secondary)' }}>
                还没有表情包，上传第一张吧
              </p>
            </div>
          ) : (
             <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {stickers.map((sticker, idx) => (
                <div
                  key={`sticker-${idx}`}
                  className="relative aspect-square rounded-xl overflow-hidden group transition-transform hover:scale-[1.02]"
                  style={{
                    backgroundColor: 'var(--chat-surface-secondary)',
                    border: '1px solid var(--chat-surface-secondary)',
                  }}
                >
                  <ImageComponent
                    src={sticker}
                    alt={`表情包${idx + 1}`}
                    className="w-full h-full object-contain p-1"
                  />
                  <button
                    onClick={() => void removeSticker(sticker)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    style={{
                      backgroundColor: 'var(--chat-danger)',
                      color: 'var(--chat-bubble-me-text)',
                    }}
                    aria-label="删除"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

       {activeTab === 'vibe' && (
          <>
            <section className="px-3 md:px-6 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {[
                { key: 'patpat' as const, label: '拍一拍' },
                { key: 'tastatus' as const, label: '对方状态' },
                { key: 'questions' as const, label: '问卷题库' },
                { key: 'period' as const, label: '经期' },
                 { key: 'maxim' as const, label: '顶部格言' },
                 { key: 'dailyAnnouncement' as const, label: '今日公告' },
                 { key: 'intro' as const, label: '开场动画' },
               ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveVibeTab(tab.key)}
                  className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{
                    color: activeVibeTab === tab.key ? 'var(--chat-bubble-me-text)' : 'var(--chat-text-secondary)',
                    backgroundColor: activeVibeTab === tab.key
                      ? 'var(--chat-accent)'
                      : 'var(--chat-surface-secondary)',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {activeVibeTab === 'patpat' && (
             <section className="flex-1 overflow-y-auto px-3 md:px-6 pb-6 space-y-2" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
              {patPats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <Heart size={28} style={{ color: 'var(--chat-accent)' }} />
                  <p className="text-sm" style={{ color: 'var(--chat-text-secondary)' }}>
                    还没有拍一拍文案，添加一条吧
                  </p>
                </div>
              ) : (
                patPats.map((item: VibeTextItem) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-sm"
                    style={{
                      backgroundColor: 'var(--chat-surface-secondary)',
                      border: '1px solid var(--chat-surface-secondary)',
                    }}
                  >
                    <p
                      className="flex-1 text-sm leading-relaxed break-words"
                      style={{ color: 'var(--chat-text-primary)' }}
                    >
                      {item.content}
                    </p>
                    <button
                      onClick={() => removePatPat(item.id)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-[color-mix(in_oklab,var(--chat-bubble-me-text)_10%,transparent)] flex-shrink-0"
                      style={{ color: 'var(--chat-text-secondary)' }}
                      aria-label="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}

              {showAddPatPat ? (
                <div
                  className="rounded-xl p-4 shadow-md"
                  style={{
                    backgroundColor: 'var(--chat-surface-secondary)',
                    border: '1px solid var(--chat-surface-secondary)',
                  }}
                >
                  <textarea
                    value={newPatPatInput}
                    onChange={(e) => setNewPatPatInput(e.target.value)}
                    placeholder="输入拍一拍文案，每行一条，批量添加..."
                    autoFocus
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none resize-none leading-relaxed"
                    style={{
                      color: 'var(--chat-text-primary)',
                      backgroundColor: 'var(--chat-surface-secondary)',
                      border: '1px solid var(--chat-divider-soft)',
                    }}
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={() => { setShowAddPatPat(false); setNewPatPatInput(''); }}
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{
                        color: 'var(--chat-text-secondary)',
                        backgroundColor: 'var(--chat-surface-secondary)',
                      }}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddPatPat}
                      disabled={!newPatPatInput.trim()}
                      className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, var(--chat-accent-light) 0%, var(--chat-accent) 100%)',
                        color: 'var(--chat-bubble-me-text)',
                        boxShadow: '0 2px 8px color-mix(in_oklab, var(--chat-accent) 30%, transparent)',
                      }}
                    >
                      <Plus size={12} />
                      添加
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddPatPat(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition-opacity"
                  style={{
                    background: 'linear-gradient(135deg, var(--chat-accent-light) 0%, var(--chat-accent) 100%)',
                    color: 'var(--chat-bubble-me-text)',
                    boxShadow: '0 2px 12px color-mix(in_oklab, var(--chat-accent) 30%, transparent)',
                  }}
                >
                  <Plus size={16} />
                  新增
                </button>
              )}
            </section>
          )}

          {activeVibeTab === 'tastatus' && (
             <section className="flex-1 overflow-y-auto px-3 md:px-6 pb-6 space-y-2" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
              {taStatuses.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <Heart size={28} style={{ color: 'var(--chat-accent)' }} />
                  <p className="text-sm" style={{ color: 'var(--chat-text-secondary)' }}>
                    还没有对方状态文案，添加一条吧
                  </p>
                </div>
              ) : (
                taStatuses.map((item: VibeTextItem) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-sm"
                    style={{
                      backgroundColor: 'var(--chat-surface-secondary)',
                      border: '1px solid var(--chat-surface-secondary)',
                    }}
                  >
                    <p
                      className="flex-1 text-sm leading-relaxed break-words"
                      style={{ color: 'var(--chat-text-primary)' }}
                    >
                      {item.content}
                    </p>
                    <button
                      onClick={() => removeTaStatus(item.id)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-[color-mix(in_oklab,var(--chat-bubble-me-text)_10%,transparent)] flex-shrink-0"
                      style={{ color: 'var(--chat-text-secondary)' }}
                      aria-label="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}

              {showAddTaStatus ? (
                <div
                  className="rounded-xl p-4 shadow-md"
                  style={{
                    backgroundColor: 'var(--chat-surface-secondary)',
                    border: '1px solid var(--chat-surface-secondary)',
                  }}
                >
                  <textarea
                    value={newTaStatusInput}
                    onChange={(e) => setNewTaStatusInput(e.target.value)}
                    placeholder="输入对方状态文案，每行一条，批量添加..."
                    autoFocus
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none resize-none leading-relaxed"
                    style={{
                      color: 'var(--chat-text-primary)',
                      backgroundColor: 'var(--chat-surface-secondary)',
                      border: '1px solid var(--chat-divider-soft)',
                    }}
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={() => { setShowAddTaStatus(false); setNewTaStatusInput(''); }}
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{
                        color: 'var(--chat-text-secondary)',
                        backgroundColor: 'var(--chat-surface-secondary)',
                      }}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddTaStatus}
                      disabled={!newTaStatusInput.trim()}
                      className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, var(--chat-accent-light) 0%, var(--chat-accent) 100%)',
                        color: 'var(--chat-bubble-me-text)',
                        boxShadow: '0 2px 8px color-mix(in_oklab, var(--chat-accent) 30%, transparent)',
                      }}
                    >
                      <Plus size={12} />
                      添加
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddTaStatus(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition-opacity"
                  style={{
                    background: 'linear-gradient(135deg, var(--chat-accent-light) 0%, var(--chat-accent) 100%)',
                    color: 'var(--chat-bubble-me-text)',
                    boxShadow: '0 2px 12px color-mix(in_oklab, var(--chat-accent) 30%, transparent)',
                  }}
                >
                  <Plus size={16} />
                  新增
                </button>
              )}
            </section>
          )}

          {activeVibeTab === 'maxim' && (
             <section className="flex-1 overflow-y-auto px-3 md:px-6 pb-6 space-y-2" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
              {topMottos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <Heart size={28} style={{ color: 'var(--chat-accent)' }} />
                  <p className="text-sm" style={{ color: 'var(--chat-text-secondary)' }}>
                    还没有顶部格言，添加一条吧
                  </p>
                </div>
              ) : (
                topMottos.map((item: VibeTextItem) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-sm"
                    style={{
                      backgroundColor: 'var(--chat-surface-secondary)',
                      border: '1px solid var(--chat-surface-secondary)',
                    }}
                  >
                    <p
                      className="flex-1 text-sm leading-relaxed break-words"
                      style={{ color: 'var(--chat-text-primary)' }}
                    >
                      {item.content}
                    </p>
                    <button
                      onClick={() => removeTopMotto(item.id)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-[color-mix(in_oklab,var(--chat-bubble-me-text)_10%,transparent)] flex-shrink-0"
                      style={{ color: 'var(--chat-text-secondary)' }}
                      aria-label="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}

              {showAddTopMotto ? (
                <div
                  className="rounded-xl p-4 shadow-md"
                  style={{
                    backgroundColor: 'var(--chat-surface-secondary)',
                    border: '1px solid var(--chat-surface-secondary)',
                  }}
                >
                  <textarea
                    value={newTopMottoInput}
                    onChange={(e) => setNewTopMottoInput(e.target.value)}
                    placeholder="输入顶部格言，每行一条，批量添加..."
                    autoFocus
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none resize-none leading-relaxed"
                    style={{
                      color: 'var(--chat-text-primary)',
                      backgroundColor: 'var(--chat-surface-secondary)',
                      border: '1px solid var(--chat-divider-soft)',
                    }}
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={() => { setShowAddTopMotto(false); setNewTopMottoInput(''); }}
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{
                        color: 'var(--chat-text-secondary)',
                        backgroundColor: 'var(--chat-surface-secondary)',
                      }}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddTopMotto}
                      disabled={!newTopMottoInput.trim()}
                      className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, var(--chat-accent-light) 0%, var(--chat-accent) 100%)',
                        color: 'var(--chat-bubble-me-text)',
                        boxShadow: '0 2px 8px color-mix(in_oklab, var(--chat-accent) 30%, transparent)',
                      }}
                    >
                      <Plus size={12} />
                      批量添加
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddTopMotto(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition-opacity"
                  style={{
                    background: 'linear-gradient(135deg, var(--chat-accent-light) 0%, var(--chat-accent) 100%)',
                    color: 'var(--chat-bubble-me-text)',
                    boxShadow: '0 2px 12px color-mix(in_oklab, var(--chat-accent) 30%, transparent)',
                  }}
                >
                  <Plus size={16} />
                  新增
                </button>
              )}
            </section>
          )}

          {activeVibeTab === 'dailyAnnouncement' && (
             <section className="flex-1 overflow-y-auto px-3 md:px-6 pb-6 space-y-2" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
              {dailyAnnouncements.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                  <Megaphone size={28} style={{ color: 'var(--chat-accent)' }} />
                  <p className="text-sm" style={{ color: 'var(--chat-text-secondary)' }}>
                    还没有今日公告，添加一条吧
                  </p>
                </div>
              ) : (
                dailyAnnouncements.map((item: VibeTextItem) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-sm"
                    style={{
                      backgroundColor: 'var(--chat-surface-secondary)',
                      border: '1px solid var(--chat-surface-secondary)',
                    }}
                  >
                    <p
                      className="flex-1 text-sm leading-relaxed break-words"
                      style={{ color: 'var(--chat-text-primary)' }}
                    >
                      {item.content}
                    </p>
                    <button
                      onClick={() => removeDailyAnnouncement(item.id)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-[color-mix(in_oklab,var(--chat-bubble-me-text)_10%,transparent)] flex-shrink-0"
                      style={{ color: 'var(--chat-text-secondary)' }}
                      aria-label="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}

              {showAddDailyAnnouncement ? (
                <div
                  className="rounded-xl p-4 shadow-md"
                  style={{
                    backgroundColor: 'var(--chat-surface-secondary)',
                    border: '1px solid var(--chat-surface-secondary)',
                  }}
                >
                  <textarea
                    value={newDailyAnnouncementInput}
                    onChange={(e) => setNewDailyAnnouncementInput(e.target.value)}
                    placeholder="输入今日公告，每行一条，批量添加..."
                    autoFocus
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg text-sm bg-transparent outline-none resize-none leading-relaxed"
                    style={{
                      color: 'var(--chat-text-primary)',
                      backgroundColor: 'var(--chat-surface-secondary)',
                      border: '1px solid var(--chat-divider-soft)',
                    }}
                  />
                  <div className="flex justify-end gap-2 mt-3">
                    <button
                      onClick={() => { setShowAddDailyAnnouncement(false); setNewDailyAnnouncementInput(''); }}
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{
                        color: 'var(--chat-text-secondary)',
                        backgroundColor: 'var(--chat-surface-secondary)',
                      }}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddDailyAnnouncement}
                      disabled={!newDailyAnnouncementInput.trim()}
                      className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, var(--chat-accent-light) 0%, var(--chat-accent) 100%)',
                        color: 'var(--chat-bubble-me-text)',
                        boxShadow: '0 2px 8px color-mix(in_oklab, var(--chat-accent) 30%, transparent)',
                      }}
                    >
                      <Plus size={12} />
                      批量添加
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddDailyAnnouncement(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition-opacity"
                  style={{
                    background: 'linear-gradient(135deg, var(--chat-accent-light) 0%, var(--chat-accent) 100%)',
                    color: 'var(--chat-bubble-me-text)',
                    boxShadow: '0 2px 12px color-mix(in_oklab, var(--chat-accent) 30%, transparent)',
                  }}
                >
                  <Plus size={16} />
                  新增
                </button>
              )}
             </section>
           )}

           {(activeVibeTab === 'questions' || activeVibeTab === 'period' || activeVibeTab === 'intro') && (
             <section className="flex-1 overflow-y-auto px-3 md:px-6 pb-6 flex flex-col" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                <Heart size={28} style={{ color: 'var(--chat-accent)', opacity: 0.5 }} />
                <p className="text-sm" style={{ color: 'var(--chat-text-secondary)' }}>
                  暂无内容
                </p>
              </div>
              <button
                onClick={() => { toast('功能开发中'); }}
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-medium transition-opacity"
                style={{
                  background: 'linear-gradient(135deg, var(--chat-accent-light) 0%, var(--chat-accent) 100%)',
                  color: 'var(--chat-bubble-me-text)',
                  boxShadow: '0 2px 12px color-mix(in_oklab, var(--chat-accent) 30%, transparent)',
                }}
              >
                <Plus size={16} />
                新增
              </button>
            </section>
          )}
        </>
      )}

      {importDialog.open && importDialog.pendingData && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ backgroundColor: 'var(--chat-overlay)' }}
          onClick={() => setImportDialog({ open: false, mode: 'merge', pendingData: null })}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 shadow-xl max-h-[85vh] overflow-y-auto"
            style={{
              backgroundColor: 'var(--chat-surface-secondary)',
              color: 'var(--chat-text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-medium mb-1" style={{ color: 'var(--chat-setting-title)' }}>导入字卡</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--chat-text-secondary)' }}>
              文件中包含 {importDialog.pendingData.modules.filter((m) => m.count > 0).length} 个模块
            </p>

            <div className="space-y-2 mb-5">
              {importDialog.pendingData.modules.map((mod) => {
                const disabled = mod.count === 0;
                return (
                  <div
                    key={mod.key}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      disabled ? 'opacity-50' : ''
                    }`}
                    style={{
                      backgroundColor: 'color-mix(in_oklab, var(--chat-accent) 8%, transparent)',
                      border: '1px solid color-mix(in_oklab, var(--chat-accent) 20%, transparent)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'color-mix(in_oklab, var(--chat-accent) 20%, transparent)' }}
                    >
                      <Folder size={14} style={{ color: 'var(--chat-accent)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium" style={{ color: 'var(--chat-setting-title)' }}>
                        {mod.label}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--chat-text-tertiary)' }}>
                        {mod.count > 0 ? `${mod.count}${mod.unit}` : '0 条'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (disabled) return;
                        setImportDialog((prev) => {
                          if (!prev.pendingData) return prev;
                          return {
                            ...prev,
                            pendingData: {
                              ...prev.pendingData,
                              modules: prev.pendingData.modules.map((m) =>
                                m.key === mod.key ? { ...m, enabled: !m.enabled } : m
                              ),
                            },
                          };
                        });
                      }}
                      disabled={disabled}
                      className="w-10 h-6 rounded-full relative transition-colors flex-shrink-0"
                      style={{
                        backgroundColor: mod.enabled ? 'var(--chat-accent)' : 'var(--chat-divider)',
                      }}
                      aria-label={`切换${mod.label}`}
                    >
                      <div
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-[var(--chat-bubble-me-text)] shadow transition-transform"
                        style={{
                          transform: mod.enabled ? 'translateX(18px)' : 'translateX(2px)',
                        }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mb-5">
              <p className="text-xs mb-2" style={{ color: 'var(--chat-text-secondary)' }}>导入方式</p>
              <div className="space-y-2">
                <label
                  className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                  style={{
                    backgroundColor: importDialog.mode === 'merge'
                      ? 'color-mix(in_oklab, var(--chat-accent) 12%, transparent)'
                      : 'var(--chat-surface-secondary)',
                    border: importDialog.mode === 'merge'
                      ? '1px solid color-mix(in_oklab, var(--chat-accent) 40%, transparent)'
                      : '1px solid var(--chat-divider-soft)',
                  }}
                >
                  <input
                    type="radio"
                    checked={importDialog.mode === 'merge'}
                    onChange={() => setImportDialog((prev) => ({ ...prev, mode: 'merge' }))}
                    className="mt-0.5 accent-[var(--chat-accent)]"
                  />
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--chat-setting-title)' }}>追加</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--chat-text-secondary)' }}>
                      与现有数据合并，重复内容自动去重
                    </div>
                  </div>
                </label>

                <label
                  className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                  style={{
                    backgroundColor: importDialog.mode === 'replace'
                      ? 'color-mix(in_oklab, var(--chat-accent) 12%, transparent)'
                      : 'var(--chat-surface-secondary)',
                    border: importDialog.mode === 'replace'
                      ? '1px solid color-mix(in_oklab, var(--chat-accent) 40%, transparent)'
                      : '1px solid var(--chat-divider-soft)',
                  }}
                >
                  <input
                    type="radio"
                    checked={importDialog.mode === 'replace'}
                    onChange={() => setImportDialog((prev) => ({ ...prev, mode: 'replace' }))}
                    className="mt-0.5 accent-[var(--chat-accent)]"
                  />
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--chat-setting-title)' }}>覆盖</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--chat-text-secondary)' }}>
                      清空对应模块现有数据后导入（不可恢复）
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setImportDialog({ open: false, mode: 'merge', pendingData: null })}
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  color: 'var(--chat-text-secondary)',
                  backgroundColor: 'var(--chat-surface-secondary)',
                }}
              >
                取消
              </button>
              <button
                onClick={doImport}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  color: 'var(--chat-bubble-me-text)',
                  backgroundColor: 'var(--chat-accent)',
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {showBatchDelConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ backgroundColor: 'var(--chat-overlay)' }}
          onClick={() => setShowBatchDelConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 shadow-xl"
            style={{
              backgroundColor: 'var(--chat-surface-secondary)',
              color: 'var(--chat-text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-medium mb-2" style={{ color: 'var(--chat-setting-title)' }}>删除分组</h3>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--chat-text-primary)' }}>
              确定删除选中的 <span style={{ color: 'var(--chat-accent)', fontWeight: 600 }}>{selectedCatIds.size}</span> 个分组吗？
              <br />
              <span style={{ color: 'var(--chat-text-secondary)' }}>分组下的字卡将移至「默认」分组</span>
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowBatchDelConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  color: 'var(--chat-text-secondary)',
                  backgroundColor: 'var(--chat-surface-secondary)',
                }}
              >
                取消
              </button>
              <button
                onClick={handleBatchDeleteCats}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{
                  color: 'var(--chat-bubble-me-text)',
                  backgroundColor: 'var(--chat-danger)',
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {showDupDialog && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ backgroundColor: 'var(--chat-overlay)' }}
          onClick={() => setShowDupDialog(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-5 shadow-xl flex flex-col"
            style={{
              backgroundColor: 'var(--chat-surface-secondary)',
              color: 'var(--chat-text-primary)',
              maxHeight: '80vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-medium" style={{ color: 'var(--chat-setting-title)' }}>重复字卡</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--chat-text-secondary)' }}>
              共 {dupGroups.length} 组重复
            </p>
            <div
              className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1"
              style={{ minHeight: '100px' }}
            >
              {dupGroups.length === 0 ? (
                <div className="text-sm text-center py-8" style={{ color: 'var(--chat-text-secondary)' }}>
                  没有重复字卡
                </div>
              ) : (
                dupGroups.map((group) => (
                  <div
                    key={group.key}
                    className="p-3 rounded-xl"
                    style={{
                      backgroundColor: 'var(--chat-surface-tertiary)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-sm leading-relaxed break-words"
                          style={{ color: 'var(--chat-text-primary)' }}
                        >
                          {group.key}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--chat-text-secondary)' }}>
                          {group.cards.length} 条 · 分组：{group.categories.join('、')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDedupGroup(group.key)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium"
                        style={{
                          color: 'var(--chat-bubble-me-text)',
                          backgroundColor: 'var(--chat-accent)',
                        }}
                      >
                        保留最早
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setShowDupDialog(false)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  color: 'var(--chat-text-secondary)',
                  backgroundColor: 'var(--chat-surface-secondary)',
                }}
              >
                关闭
              </button>
              <button
                onClick={handleDedupAll}
                disabled={dedupLoading || dupGroups.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                style={{
                  color: 'var(--chat-bubble-me-text)',
                  backgroundColor: 'var(--chat-accent)',
                  opacity: dedupLoading || dupGroups.length === 0 ? 0.6 : 1,
                }}
              >
                {dedupLoading && <Loader2 size={14} className="animate-spin" />}
                全部保留最早
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分组管理对话框 */}
      <Dialog open={showGroupManageDialog} onOpenChange={setShowGroupManageDialog}>
        <DialogContent
          className="rounded-2xl p-0 overflow-hidden"
          style={{
            backgroundColor: 'var(--chat-surface-secondary)',
            color: 'var(--chat-text-primary)',
            maxWidth: '420px',
            width: 'calc(100% - 2rem)',
          }}
        >
          <DialogHeader className="px-5 pt-5 pb-3" style={{ textAlign: 'left' }}>
            <DialogTitle style={{ color: 'var(--chat-text-primary)', fontSize: '16px', fontWeight: 600 }}>
              分组管理
            </DialogTitle>
          </DialogHeader>

          {/* 分组列表 */}
          <div
            className="overflow-y-auto px-3 py-2"
            style={{ maxHeight: '400px' }}
          >
            {/* 新建分组输入行 */}
            {dialogNewCat && (
              <div
                className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl"
                style={{ backgroundColor: 'color-mix(in_oklab, var(--chat-accent) 8%, transparent)' }}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: 'var(--chat-accent)' }}
                />
                <input
                  ref={dialogNewCatInputRef}
                  value={dialogNewCatName}
                  onChange={(e) => setDialogNewCatName(e.target.value)}
                  onBlur={() => {
                    if (dialogNewCatName.trim()) handleDialogAddCat();
                    else setDialogNewCat(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDialogAddCat();
                    if (e.key === 'Escape') {
                      setDialogNewCat(false);
                      setDialogNewCatName('');
                    }
                  }}
                  autoFocus
                  placeholder="输入分组名称"
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--chat-text-primary)' }}
                />
                <button
                  onClick={handleDialogAddCat}
                  className="p-1 rounded-md transition-colors"
                  style={{ color: 'var(--chat-accent)' }}
                >
                  <Check size={16} />
                </button>
              </div>
            )}

            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'color-mix(in_oklab, var(--chat-accent) 6%, transparent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
              >
                {/* 彩色圆点 */}
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getCatDotColor(cat.id) }}
                />

                {/* 名称 / 编辑输入框 */}
                {dialogEditingId === cat.id ? (
                  <input
                    ref={dialogEditInputRef}
                    value={dialogEditingName}
                    onChange={(e) => setDialogEditingName(e.target.value)}
                    onBlur={saveDialogEditCat}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveDialogEditCat();
                      if (e.key === 'Escape') cancelDialogEditCat();
                    }}
                    autoFocus
                    className="flex-1 bg-[color-mix(in_oklab,var(--chat-bubble-me-text)_60%,transparent)] outline-none text-sm px-2 py-1 rounded-md border"
                    style={{ color: 'var(--chat-text-primary)', borderColor: 'color-mix(in_oklab, var(--chat-accent) 30%, transparent)' }}
                  />
                ) : (
                  <>
                    <span className="text-sm flex-1 truncate" style={{ color: 'var(--chat-text-primary)' }}>
                      {cat.name}
                    </span>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--chat-text-secondary)' }}>
                      {catCount(cat.id)} 条
                    </span>
                  </>
                )}

                {/* 操作按钮 */}
                {dialogEditingId === cat.id ? (
                  <button
                    onClick={saveDialogEditCat}
                    className="p-1.5 rounded-md transition-colors flex-shrink-0"
                    style={{ color: 'var(--chat-accent)' }}
                  >
                    <Check size={15} />
                  </button>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => startDialogEditCat(cat.id, cat.name)}
                      className="p-1.5 rounded-md transition-colors"
                      style={{ color: 'var(--chat-text-secondary)' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--chat-accent)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--chat-text-secondary)'; }}
                      aria-label="编辑分组"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDialogDeleteCat(cat.id)}
                      disabled={cat.id === 'default'}
                      className={`p-1.5 rounded-md transition-colors ${
                        cat.id === 'default' ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                      style={{
                        color: cat.id === 'default'
                          ? 'var(--chat-text-secondary)'
                          : dialogDelConfirmId === cat.id
                          ? 'var(--chat-danger)'
                          : 'var(--chat-text-secondary)',
                      }}
                      onMouseEnter={(e) => {
                        if (cat.id !== 'default' && dialogDelConfirmId !== cat.id) {
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--chat-danger)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (cat.id !== 'default' && dialogDelConfirmId !== cat.id) {
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--chat-text-secondary)';
                        }
                      }}
                      aria-label="删除分组"
                    >
                      {dialogDelConfirmId === cat.id ? <Check size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 底部新建分组按钮 */}
          <div className="px-5 pt-2 pb-5">
            <button
              onClick={() => {
                setDialogNewCat(true);
                setDialogNewCatName('');
                setTimeout(() => dialogNewCatInputRef.current?.focus(), 0);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm transition-colors"
              style={{
                color: 'var(--chat-accent)',
                border: '1.5px dashed color-mix(in_oklab, var(--chat-accent) 40%, transparent)',
                backgroundColor: 'color-mix(in_oklab, var(--chat-accent) 4%, transparent)',
              }}
            >
              <Plus size={15} />
              新建分组
            </button>
          </div>

          {/* 删除确认对话框（内嵌 overlay） */}
          {dialogDelConfirmId && (
            <div
              className="absolute inset-0 flex items-center justify-center z-10 rounded-2xl"
              style={{ backgroundColor: 'var(--chat-overlay)' }}
              onClick={cancelDialogDeleteCat}
            >
              <div
                className="w-[80%] max-w-xs rounded-2xl p-5 shadow-xl"
                style={{
                  backgroundColor: 'var(--chat-surface-secondary)',
                  color: 'var(--chat-text-primary)',
                  border: '1px solid color-mix(in_oklab, var(--chat-accent) 20%, transparent)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base font-medium mb-2" style={{ color: 'var(--chat-setting-title)' }}>删除分组</h3>
                <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--chat-text-primary)' }}>
                  确定删除此分组吗？
                  <br />
                  <span style={{ color: 'var(--chat-text-secondary)' }}>删除后字卡移至默认分组</span>
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={cancelDialogDeleteCat}
                    className="px-4 py-2 rounded-lg text-sm"
                    style={{
                      color: 'var(--chat-text-secondary)',
                      backgroundColor: 'var(--chat-surface-secondary)',
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmDialogDeleteCat}
                    className="px-4 py-2 rounded-lg text-sm font-medium"
                    style={{
                      color: 'var(--chat-bubble-me-text)',
                      backgroundColor: 'var(--chat-danger)',
                    }}
                  >
                    确认删除
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CardManagerPage;
