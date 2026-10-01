import { FileText } from 'lucide-react';
import type { Questionnaire, QuestionnaireReply } from '@client/src/utils/local-storage';

interface QuestionnaireMessageProps {
  questionnaire: Questionnaire;
  isMe: boolean;
  isReplied?: boolean;
  replies?: QuestionnaireReply[];
}

export function QuestionnaireMessage({ questionnaire, isMe, isReplied, replies }: QuestionnaireMessageProps) {
  const bubbleBg = isMe ? 'var(--chat-bubble-me)' : 'var(--chat-bubble-ta)';
  const textColor = isMe ? 'var(--chat-bubble-me-text)' : 'var(--chat-bubble-ta-text)';
  const cardBg = isMe ? 'rgba(255,255,255,0.15)' : 'rgba(201, 168, 124, 0.08)';
  const borderColor = isMe ? 'rgba(255,255,255,0.2)' : 'rgba(201, 168, 124, 0.2)';
  const accentColor = isMe ? '#fff' : '#c9a87c';

  if (isReplied && replies) {
    return (
      <div
        className="px-3 md:px-4 py-2 md:py-2.5 text-[14px] md:text-[15px] leading-relaxed break-words shadow-sm rounded-2xl max-w-full"
        style={{
          backgroundColor: bubbleBg,
          color: textColor,
          borderRadius: '20px',
        }}
      >
        <div className="flex items-center gap-2 mb-2" style={{ color: accentColor }}>
          <FileText size={14} />
          <span className="text-sm font-medium">{questionnaire.title} · TA的回复</span>
        </div>
        <div className="space-y-3">
          {questionnaire.questions.map((q, idx) => {
            const reply = replies.find((r) => r.questionId === q.id);
            return (
              <div key={q.id} className="text-sm">
                <div className="font-medium mb-1">{idx + 1}. {q.content}</div>
                {q.type === 'single' && reply?.selectedOptions && reply.selectedOptions.length > 0 && (
                  <div style={{ color: accentColor }}>
                    TA选择了：{reply.selectedOptions.join('、')}
                  </div>
                )}
                {q.type === 'multiple' && reply?.selectedOptions && reply.selectedOptions.length > 0 && (
                  <div style={{ color: accentColor }}>
                    TA选择了：{reply.selectedOptions.join('、')}
                  </div>
                )}
                {q.type === 'textcard' && reply?.textcardReply && (
                  <div style={{ color: accentColor }}>
                    TA说：{reply.textcardReply}
                  </div>
                )}
                {(!reply || (q.type === 'textcard' && !reply.textcardReply) || ((q.type === 'single' || q.type === 'multiple') && (!reply.selectedOptions || reply.selectedOptions.length === 0))) && (
                  <div style={{ color: 'var(--chat-text-muted)', fontSize: '12px' }}>TA没有回复</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="px-3 md:px-4 py-2 md:py-2.5 text-[14px] md:text-[15px] leading-relaxed break-words shadow-sm rounded-2xl max-w-full"
      style={{
        backgroundColor: bubbleBg,
        color: textColor,
        borderRadius: '20px',
      }}
    >
      <div className="flex items-center gap-2 mb-2" style={{ color: accentColor }}>
        <FileText size={14} />
        <span className="text-sm font-medium">{questionnaire.title}</span>
      </div>
      {questionnaire.description && (
        <div className="text-xs mb-2 opacity-80">{questionnaire.description}</div>
      )}
      <div
        className="p-3 rounded-xl space-y-3"
        style={{
          backgroundColor: cardBg,
          border: `1px solid ${borderColor}`,
        }}
      >
        {questionnaire.questions.map((q, idx) => (
          <div key={q.id} className="text-sm">
            <div className="font-medium mb-1.5">{idx + 1}. {q.content}</div>
            {q.type === 'single' && (
              <div className="space-y-1">
                {q.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{
                        border: `1.5px solid ${accentColor}`,
                        opacity: 0.6,
                      }}
                    />
                    <span>{opt}</span>
                  </div>
                ))}
              </div>
            )}
            {q.type === 'multiple' && (
              <div className="space-y-1">
                {q.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                      style={{
                        border: `1.5px solid ${accentColor}`,
                        opacity: 0.6,
                      }}
                    />
                    <span>{opt}</span>
                  </div>
                ))}
              </div>
            )}
            {q.type === 'textcard' && (
              <div
                className="text-xs px-2 py-1 rounded"
                style={{ color: accentColor, backgroundColor: 'transparent' }}
              >
                TA将自由回复
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
