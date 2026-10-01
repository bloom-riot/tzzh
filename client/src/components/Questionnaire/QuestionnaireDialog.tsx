import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
 import { X, Plus, Trash2, Send, Edit, ChevronUp, ChevronDown, ArrowLeft, CheckCircle, Clock, FileText, Copy, Eye } from 'lucide-react';
 import { toast } from 'sonner';
 import { logger } from '@lark-apaas/client-toolkit/logger';
 import { useTheme } from '@client/src/hooks/use-theme';
 import {
   addQuestionnaire,
   updateQuestionnaire,
   deleteQuestionnaire,
   getQuestionnaires,
   duplicateQuestionnaire,
   addPendingQuestionnaireReply,
   type Questionnaire,
   type QuestionnaireQuestion,
   type QuestionnaireQuestionType,
   type PendingQuestionnaireReply,
   type RhythmConfigSettings,
   type ProfileSettings,
 } from '@client/src/utils/local-storage';

interface QuestionnaireDialogProps {
  open: boolean;
  onClose: () => void;
  rhythm: RhythmConfigSettings;
  profile: ProfileSettings;
  onUserSend: (questionnaire: Questionnaire) => void;
  onTaReply: (questionnaire: Questionnaire) => void;
}

 type ViewMode = 'list' | 'editor' | 'detail';

const QuestionnaireDialog = ({ open, onClose, rhythm, profile, onUserSend, onTaReply }: QuestionnaireDialogProps) => {
  const { isDark } = useTheme();
   const [view, setView] = useState<ViewMode>('list');
   const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
   const [editing, setEditing] = useState<Questionnaire | null>(null);
   const [viewing, setViewing] = useState<Questionnaire | null>(null);

  const taName = profile.taName || 'TA';

  const loadQuestionnaires = useCallback(() => {
    setQuestionnaires(getQuestionnaires());
  }, []);

   useEffect(() => {
     if (!open) return;
     loadQuestionnaires();
   }, [open, loadQuestionnaires]);


  const handleCreate = useCallback(() => {
    setEditing({
      id: '',
      title: '',
      description: '',
      questions: [
        {
          id: `q_${Date.now()}_0`,
          content: '',
          type: 'single',
          options: ['', ''],
        },
      ],
      createdAt: Date.now(),
      status: 'draft',
    });
    setView('editor');
  }, []);

   const handleEdit = useCallback((q: Questionnaire) => {
     setEditing(JSON.parse(JSON.stringify(q)));
     setView('editor');
   }, []);

   const handleView = useCallback((q: Questionnaire) => {
     setViewing(q);
     setView('detail');
   }, []);

   const handleEditFromDetail = useCallback(() => {
     if (!viewing) return;
     setEditing(JSON.parse(JSON.stringify(viewing)));
     setViewing(null);
     setView('editor');
   }, [viewing]);

  const handleDuplicate = useCallback((q: Questionnaire) => {
    const newQ = duplicateQuestionnaire(q);
    toast('问卷已复制');
    setEditing(newQ);
    setView('editor');
    loadQuestionnaires();
  }, [loadQuestionnaires]);

  const handleSave = useCallback(() => {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast('请填写问卷标题');
      return;
    }
    const validQuestions = editing.questions.filter((q) => q.content.trim().length > 0);
    if (validQuestions.length === 0) {
      toast('至少添加一个问题');
      return;
    }
    for (const q of validQuestions) {
      if (q.type === 'single' || q.type === 'multiple') {
        const validOpts = q.options.filter((o) => o.trim().length > 0);
        if (validOpts.length < 2) {
          toast('单选/多选题至少需要2个选项');
          return;
        }
      }
    }

    const cleanedQuestions = validQuestions.map((q) => ({
      ...q,
      options: q.type === 'textcard' ? [] : q.options.filter((o) => o.trim().length > 0),
    }));

    if (editing.id) {
      updateQuestionnaire(editing.id, {
        title: editing.title.trim(),
        description: editing.description.trim(),
        questions: cleanedQuestions,
      });
    } else {
      addQuestionnaire({
        title: editing.title.trim(),
        description: editing.description.trim(),
        questions: cleanedQuestions,
      });
    }
    toast('已保存');
    setEditing(null);
    setView('list');
    loadQuestionnaires();
  }, [editing, loadQuestionnaires]);

  const handleDelete = useCallback((id: string) => {
    deleteQuestionnaire(id);
    loadQuestionnaires();
    toast('已删除');
  }, [loadQuestionnaires]);

  const handleSend = useCallback((q: Questionnaire) => {
    if (q.status !== 'draft') {
      toast('该问卷已发送');
      return;
    }
    const now = Date.now();
    const minMs = rhythm.surveyMinSeconds * 1000;
    const maxMs = rhythm.surveyMaxSeconds * 1000;
    const delayMs = minMs + Math.floor(Math.random() * (maxMs - minMs));
    const scheduledAt = now + delayMs;
    const willReply = Math.random() < 0.8;
    const taskId = `qn_reply_${now}_${Math.random().toString(36).slice(2, 8)}`;

    updateQuestionnaire(q.id, { status: 'sent', sentAt: now });

    const task: PendingQuestionnaireReply = {
      id: taskId,
      questionnaireId: q.id,
      scheduledAt,
      willReply,
      userMessageId: null,
      createdAt: now,
    };
     addPendingQuestionnaireReply(task);

     logger.info(`[survey-reply] 发送问卷 id=${q.id} scheduledAt=${new Date(scheduledAt).toISOString()} willReply=${willReply} delayMs=${delayMs}`);

     onUserSend({ ...q, status: 'sent', sentAt: now });
     setView('list');
     loadQuestionnaires();
     toast('问卷已发送');
   }, [rhythm.surveyMinSeconds, rhythm.surveyMaxSeconds, onUserSend, loadQuestionnaires]);

  const addQuestion = useCallback(() => {
    if (!editing) return;
    const newQ: QuestionnaireQuestion = {
      id: `q_${Date.now()}_${editing.questions.length}`,
      content: '',
      type: 'single',
      options: ['', ''],
    };
    setEditing({ ...editing, questions: [...editing.questions, newQ] });
  }, [editing]);

  const updateQuestion = useCallback((qIdx: number, patch: Partial<QuestionnaireQuestion>) => {
    if (!editing) return;
    const next = [...editing.questions];
    next[qIdx] = { ...next[qIdx], ...patch };
    setEditing({ ...editing, questions: next });
  }, [editing]);

  const removeQuestion = useCallback((qIdx: number) => {
    if (!editing) return;
    if (editing.questions.length <= 1) {
      toast('至少保留一个问题');
      return;
    }
    const next = editing.questions.filter((_, i) => i !== qIdx);
    setEditing({ ...editing, questions: next });
  }, [editing]);

  const moveQuestion = useCallback((qIdx: number, direction: -1 | 1) => {
    if (!editing) return;
    const next = [...editing.questions];
    const target = qIdx + direction;
    if (target < 0 || target >= next.length) return;
    [next[qIdx], next[target]] = [next[target], next[qIdx]];
    setEditing({ ...editing, questions: next });
  }, [editing]);

  const addOption = useCallback((qIdx: number) => {
    if (!editing) return;
    const next = [...editing.questions];
    next[qIdx] = { ...next[qIdx], options: [...next[qIdx].options, ''] };
    setEditing({ ...editing, questions: next });
  }, [editing]);

  const updateOption = useCallback((qIdx: number, optIdx: number, value: string) => {
    if (!editing) return;
    const next = [...editing.questions];
    const opts = [...next[qIdx].options];
    opts[optIdx] = value;
    next[qIdx] = { ...next[qIdx], options: opts };
    setEditing({ ...editing, questions: next });
  }, [editing]);

  const removeOption = useCallback((qIdx: number, optIdx: number) => {
    if (!editing) return;
    const next = [...editing.questions];
    if (next[qIdx].options.length <= 2) {
      toast('至少保留2个选项');
      return;
    }
    const opts = next[qIdx].options.filter((_, i) => i !== optIdx);
    next[qIdx] = { ...next[qIdx], options: opts };
    setEditing({ ...editing, questions: next });
  }, [editing]);

  const formatDate = useCallback((ts: number) => {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }, []);

  const statusInfo = useMemo(() => ({
    draft: { label: '草稿', color: '#999' },
    sent: { label: '等待回复', color: '#c9a87c' },
    replied: { label: '已回复', color: '#52c41a' },
  } satisfies Record<Questionnaire['status'], { label: string; color: string }>), []);

  if (!open) return null;

  const contentBg = isDark ? '#2c2c2e' : '#fdfbf7';
  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const textPrimary = isDark ? '#f5f5f7' : '#333333';
  const textSecondary = isDark ? '#98989d' : '#999999';
  const accent = '#c9a87c';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(201, 168, 124, 0.15)';
  const inputBg = isDark ? '#2c2c2e' : '#f9f6f0';
  const borderColor = isDark ? '#3a3a3c' : '#e8dfd0';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:justify-center">
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md md:max-w-lg md:rounded-2xl rounded-t-3xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: contentBg,
          height: '85vh',
          maxHeight: '85vh',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.15)',
        }}
      >
        {view === 'list' ? (
          <QuestionnaireListView
            questionnaires={questionnaires}
            taName={taName}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            cardBg={cardBg}
            accent={accent}
            dividerColor={dividerColor}
            borderColor={borderColor}
            statusInfo={statusInfo}
            formatDate={formatDate}
            onClose={onClose}
            onCreate={handleCreate}
             onEdit={handleEdit}
             onView={handleView}
             onDelete={handleDelete}
            onSend={handleSend}
            onDuplicate={handleDuplicate}
          />
         ) : view === 'detail' ? (
          <QuestionnaireDetailView
            questionnaire={viewing}
            taName={taName}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            cardBg={cardBg}
            accent={accent}
            dividerColor={dividerColor}
            borderColor={borderColor}
            statusInfo={statusInfo}
            formatDate={formatDate}
            onBack={() => { setView('list'); setViewing(null); }}
            onEditFromDetail={handleEditFromDetail}
          />
        ) : (
          <QuestionnaireEditorView
            editing={editing}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            cardBg={cardBg}
            accent={accent}
            dividerColor={dividerColor}
            inputBg={inputBg}
            borderColor={borderColor}
            onBack={() => { setView('list'); setEditing(null); }}
            onSave={handleSave}
            onUpdateTitle={(t) => editing && setEditing({ ...editing, title: t })}
            onUpdateDescription={(d) => editing && setEditing({ ...editing, description: d })}
            onAddQuestion={addQuestion}
            onUpdateQuestion={updateQuestion}
            onRemoveQuestion={removeQuestion}
            onMoveQuestion={moveQuestion}
            onAddOption={addOption}
            onUpdateOption={updateOption}
            onRemoveOption={removeOption}
          />
        )}
      </div>
    </div>
  );
};

interface ListViewProps {
  questionnaires: Questionnaire[];
  taName: string;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  accent: string;
  dividerColor: string;
  borderColor: string;
  statusInfo: Record<Questionnaire['status'], { label: string; color: string }>;
  formatDate: (ts: number) => string;
  onClose: () => void;
  onCreate: () => void;
   onEdit: (q: Questionnaire) => void;
   onView: (q: Questionnaire) => void;
   onDelete: (id: string) => void;
  onSend: (q: Questionnaire) => void;
  onDuplicate: (q: Questionnaire) => void;
}

 const QuestionnaireListView = ({
   questionnaires,
   taName,
   textPrimary,
   textSecondary,
   cardBg,
   accent,
   dividerColor,
   borderColor,
   statusInfo,
   formatDate,
   onClose,
   onCreate,
   onEdit,
   onView,
   onDelete,
   onSend,
   onDuplicate,
 }: ListViewProps) => {
  return (
    <>
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${dividerColor}` }}
      >
        <div className="flex items-center gap-2">
          <FileText size={18} style={{ color: accent }} />
          <span className="text-base font-medium" style={{ color: textPrimary }}>问卷管理</span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110"
          style={{ color: textSecondary }}
          aria-label="关闭"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {questionnaires.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText size={48} style={{ color: borderColor }} />
            <p className="mt-4 text-sm" style={{ color: textSecondary }}>还没有问卷</p>
            <p className="mt-1 text-xs" style={{ color: textSecondary }}>
              点击下方按钮创建你的第一份问卷
            </p>
          </div>
        ) : (
          questionnaires.map((q) => (
            <div
              key={q.id}
              className="p-4 rounded-xl"
              style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium truncate" style={{ color: textPrimary }}>
                      {q.title}
                    </h3>
                    <span
                      className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: statusInfo[q.status].color + '20',
                        color: statusInfo[q.status].color,
                      }}
                    >
                      {statusInfo[q.status].label}
                    </span>
                  </div>
                  {q.description && (
                    <p className="mt-1 text-xs line-clamp-2" style={{ color: textSecondary }}>
                      {q.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs" style={{ color: textSecondary }}>
                    <span>{q.questions.length} 个问题</span>
                    <span>创建于 {formatDate(q.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div
                className="mt-3 pt-3 flex items-center justify-end gap-2 flex-wrap"
                style={{ borderTop: `1px solid ${dividerColor}` }}
              >
                {q.status === 'draft' && (
                  <button
                    onClick={() => onSend(q)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: accent, color: '#fff' }}
                  >
                    <Send size={12} />
                    发送给{taName}
                  </button>
                )}
                 <button
                   onClick={() => onView(q)}
                   className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-90 active:scale-95"
                   style={{ backgroundColor: accent + '20', color: accent }}
                 >
                   <Eye size={12} />
                   查看
                 </button>
                 {q.status === 'draft' && (
                   <button
                     onClick={() => onEdit(q)}
                     className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-90 active:scale-95"
                     style={{ backgroundColor: accent + '20', color: accent }}
                   >
                     <Edit size={12} />
                     编辑
                   </button>
                 )}
                <button
                  onClick={() => onDuplicate(q)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: accent + '20', color: accent }}
                >
                  <Copy size={12} />
                  复制重发
                </button>
                <button
                  onClick={() => onDelete(q.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-90 active:scale-95"
                  style={{ color: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)' }}
                >
                  <Trash2 size={12} />
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderTop: `1px solid ${dividerColor}`, backgroundColor: cardBg }}
      >
        <button
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ backgroundColor: accent, color: '#fff' }}
        >
          <Plus size={16} />
          创建问卷
        </button>
      </div>
    </>
  );
};

interface EditorProps {
  editing: Questionnaire | null;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  accent: string;
  dividerColor: string;
  inputBg: string;
  borderColor: string;
  onBack: () => void;
  onSave: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (desc: string) => void;
  onAddQuestion: () => void;
  onUpdateQuestion: (idx: number, patch: Partial<QuestionnaireQuestion>) => void;
  onRemoveQuestion: (idx: number) => void;
  onMoveQuestion: (idx: number, direction: -1 | 1) => void;
  onAddOption: (qIdx: number) => void;
  onUpdateOption: (qIdx: number, optIdx: number, value: string) => void;
  onRemoveOption: (qIdx: number, optIdx: number) => void;
}

const QuestionnaireEditorView = ({
  editing,
  textPrimary,
  textSecondary,
  accent,
  dividerColor,
  inputBg,
  borderColor,
  onBack,
  onSave,
  onUpdateTitle,
  onUpdateDescription,
  onAddQuestion,
  onUpdateQuestion,
  onRemoveQuestion,
  onMoveQuestion,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: EditorProps) => {
  if (!editing) return null;

  const questionTypeOptions: Array<{ value: QuestionnaireQuestionType; label: string }> = [
    { value: 'single', label: '单选' },
    { value: 'multiple', label: '多选' },
    { value: 'textcard', label: '字卡回复' },
  ];

  return (
    <>
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${dividerColor}` }}
      >
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110"
          style={{ color: textSecondary }}
          aria-label="返回"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-base font-medium" style={{ color: textPrimary }}>编辑问卷</span>
        <button
          onClick={onSave}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: accent, color: '#fff' }}
        >
          <CheckCircle size={14} />
          保存
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: textSecondary }}>
            问卷标题 <span style={{ color: '#e74c3c' }}>*</span>
          </label>
          <input
            type="text"
            value={editing.title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            placeholder="例如：关于我们的小调查"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{
              backgroundColor: inputBg,
              color: textPrimary,
              border: `1px solid ${borderColor}`,
            }}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium" style={{ color: textSecondary }}>问卷描述（选填）</label>
          <textarea
            value={editing.description}
            onChange={(e) => onUpdateDescription(e.target.value)}
            placeholder="简单介绍一下这份问卷..."
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{
              backgroundColor: inputBg,
              color: textPrimary,
              border: `1px solid ${borderColor}`,
            }}
          />
        </div>

        <div
          className="pt-2 flex items-center justify-between"
          style={{ borderTop: `1px solid ${dividerColor}` }}
        >
          <span className="text-sm font-medium" style={{ color: textPrimary }}>问题列表</span>
          <button
            onClick={onAddQuestion}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-90"
            style={{ color: accent, backgroundColor: accent + '15' }}
          >
            <Plus size={14} />
            添加问题
          </button>
        </div>

        {editing.questions.map((q, qIdx) => (
          <div
            key={q.id}
            className="p-3 rounded-xl space-y-3"
            style={{ backgroundColor: inputBg, border: `1px solid ${borderColor}` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: accent }}>
                第 {qIdx + 1} 题
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onMoveQuestion(qIdx, -1)}
                  disabled={qIdx === 0}
                  className="w-6 h-6 flex items-center justify-center rounded-md transition-all"
                  style={{ color: qIdx === 0 ? borderColor : textSecondary }}
                  aria-label="上移"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => onMoveQuestion(qIdx, 1)}
                  disabled={qIdx === editing.questions.length - 1}
                  className="w-6 h-6 flex items-center justify-center rounded-md transition-all"
                  style={{ color: qIdx === editing.questions.length - 1 ? borderColor : textSecondary }}
                  aria-label="下移"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={() => onRemoveQuestion(qIdx)}
                  className="w-6 h-6 flex items-center justify-center rounded-md transition-all"
                  style={{ color: '#e74c3c' }}
                  aria-label="删除问题"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={q.content}
                onChange={(e) => onUpdateQuestion(qIdx, { content: e.target.value })}
                placeholder="请输入问题内容"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: '#fff',
                  color: textPrimary,
                  border: `1px solid ${borderColor}`,
                }}
              />

              <div className="flex items-center gap-2">
                <span className="text-xs flex-shrink-0" style={{ color: textSecondary }}>类型：</span>
                <div className="flex gap-1 flex-wrap">
                  {questionTypeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => onUpdateQuestion(qIdx, { type: opt.value })}
                      className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                      style={{
                        backgroundColor: q.type === opt.value ? accent : 'transparent',
                        color: q.type === opt.value ? '#fff' : textSecondary,
                        border: `1px solid ${q.type === opt.value ? accent : borderColor}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {(q.type === 'single' || q.type === 'multiple') && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs" style={{ color: textSecondary }}>选项：</div>
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
                        style={{
                          borderRadius: q.type === 'single' ? '50%' : '3px',
                          border: `1.5px solid ${borderColor}`,
                        }}
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => onUpdateOption(qIdx, optIdx, e.target.value)}
                        placeholder={`选项 ${optIdx + 1}`}
                        className="flex-1 px-2 py-1.5 rounded-md text-sm outline-none"
                        style={{
                          backgroundColor: '#fff',
                          color: textPrimary,
                          border: `1px solid ${borderColor}`,
                        }}
                      />
                      <button
                        onClick={() => onRemoveOption(qIdx, optIdx)}
                        className="w-6 h-6 flex items-center justify-center rounded-md transition-all"
                        style={{ color: '#e74c3c' }}
                        aria-label="删除选项"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => onAddOption(qIdx)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                    style={{ color: accent }}
                  >
                    <Plus size={12} />
                    添加选项
                  </button>
                </div>
              )}

              {q.type === 'textcard' && (
                <div
                  className="mt-1 px-3 py-2 rounded-lg text-xs"
                  style={{
                    backgroundColor: accent + '10',
                    color: accent,
                  }}
                >
                  TA 将从字卡库中随机抽取字卡作为回复
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
   );
 };

interface DetailViewProps {
  questionnaire: Questionnaire | null;
  taName: string;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  accent: string;
  dividerColor: string;
  borderColor: string;
  statusInfo: Record<Questionnaire['status'], { label: string; color: string }>;
  formatDate: (ts: number) => string;
  onBack: () => void;
  onEditFromDetail: () => void;
}

const QuestionnaireDetailView = ({
  questionnaire,
  taName,
  textPrimary,
  textSecondary,
  cardBg,
  accent,
  dividerColor,
  borderColor,
  statusInfo,
  formatDate,
  onBack,
  onEditFromDetail,
}: DetailViewProps) => {
  if (!questionnaire) return null;

  const replyMap = new Map<string, QuestionnaireQuestionType>();
  const replyContentMap = new Map<string, { selectedOptions?: string[]; textcardReply?: string }>();
  if (questionnaire.replies) {
    for (const r of questionnaire.replies) {
      replyMap.set(r.questionId, r.type);
      replyContentMap.set(r.questionId, {
        selectedOptions: r.selectedOptions,
        textcardReply: r.textcardReply,
      });
    }
  }

  const typeLabelMap: Record<QuestionnaireQuestionType, string> = {
    single: '单选',
    multiple: '多选',
    textcard: '字卡回复',
  };

  return (
    <>
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${dividerColor}` }}
      >
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110"
          style={{ color: textSecondary }}
          aria-label="返回"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-base font-medium" style={{ color: textPrimary }}>问卷详情</span>
        <div style={{ width: 32 }} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium" style={{ color: textPrimary }}>
              {questionnaire.title}
            </h2>
            <span
              className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: statusInfo[questionnaire.status].color + '20',
                color: statusInfo[questionnaire.status].color,
              }}
            >
              {statusInfo[questionnaire.status].label}
            </span>
          </div>
          {questionnaire.description && (
            <p className="text-sm leading-relaxed" style={{ color: textSecondary }}>
              {questionnaire.description}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs" style={{ color: textSecondary }}>
            <span>创建于 {formatDate(questionnaire.createdAt)}</span>
            {questionnaire.sentAt && <span>发送于 {formatDate(questionnaire.sentAt)}</span>}
            {questionnaire.repliedAt && <span>回复于 {formatDate(questionnaire.repliedAt)}</span>}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${dividerColor}` }} />

        {questionnaire.status === 'sent' && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
            style={{
              backgroundColor: accent + '10',
              color: accent,
            }}
          >
            <Clock size={16} />
            等待{taName}回复中...
          </div>
        )}

        {questionnaire.questions.map((q, qIdx) => {
          const reply = replyContentMap.get(q.id);
          const selectedSet = new Set(reply?.selectedOptions ?? []);

          return (
            <div
              key={q.id}
              className="p-4 rounded-xl space-y-3"
              style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: accent }}>
                  第 {qIdx + 1} 题
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: accent + '15',
                    color: accent,
                  }}
                >
                  {typeLabelMap[q.type]}
                </span>
              </div>

              <p className="text-sm font-medium leading-relaxed" style={{ color: textPrimary }}>
                {q.content}
              </p>

              {(q.type === 'single' || q.type === 'multiple') && q.options.length > 0 && (
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = selectedSet.has(opt);
                    return (
                      <div
                        key={optIdx}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                        style={{
                          backgroundColor: isSelected ? accent + '15' : 'transparent',
                          color: isSelected ? accent : textPrimary,
                        }}
                      >
                        <div
                          className="w-4 h-4 flex-shrink-0 flex items-center justify-center"
                          style={{
                            borderRadius: q.type === 'single' ? '50%' : '3px',
                            border: `1.5px solid ${isSelected ? accent : borderColor}`,
                            backgroundColor: isSelected ? accent : 'transparent',
                          }}
                        >
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path
                                d="M2 5L4 7L8 3"
                                stroke="#fff"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                        <span>{opt}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {q.type === 'textcard' && (
                <div
                  className="px-3 py-2 rounded-lg text-xs"
                  style={{
                    backgroundColor: accent + '10',
                    color: accent,
                  }}
                >
                  TA 将从字卡库中随机抽取字卡作为回复
                </div>
              )}

              {questionnaire.status === 'replied' && reply && (
                <div
                  className="mt-2 pt-3 space-y-2"
                  style={{ borderTop: `1px dashed ${dividerColor}` }}
                >
                  <div className="text-xs font-medium" style={{ color: accent }}>
                    {taName}的回复
                  </div>
                  {reply.textcardReply && (
                    <div
                      className="px-3 py-2 rounded-lg text-sm leading-relaxed"
                      style={{
                        backgroundColor: accent + '15',
                        color: textPrimary,
                        borderLeft: `3px solid ${accent}`,
                      }}
                    >
                      {reply.textcardReply}
                    </div>
                  )}
                  {(reply.selectedOptions ?? []).length > 0 && (q.type === 'single' || q.type === 'multiple') && (
                    <div className="text-sm" style={{ color: textPrimary }}>
                      选择了 {reply.selectedOptions!.length} 项
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {questionnaire.status === 'draft' && (
          <button
            onClick={onEditFromDetail}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: accent, color: '#fff' }}
          >
            <Edit size={16} />
            继续编辑
          </button>
        )}
      </div>
    </>
  );
};

export { QuestionnaireDialog };
