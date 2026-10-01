import React, { useEffect, useRef } from 'react';
import CallPanel from '@client/src/components/CallPanel/CallPanel';
import { useChatMessages, useProfile } from '@client/src/hooks/use-local-storage';
import type { CallMode } from '@client/src/stores/call-store';

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const GlobalCallPanel: React.FC = () => {
  const { addSystemMessage } = useChatMessages();
  const { profile } = useProfile();
  const endedRef = useRef<{ mode: CallMode; duration: number } | null>(null);

  const handleHangUp = (mode: CallMode, duration: number) => {
    const ta = profile.taName || 'TA';
    if (mode === 'connected') {
      addSystemMessage(`📞 通话已结束 · ${formatDuration(duration)}`, { callType: 'outgoing', callDuration: duration });
    } else if (mode === 'incoming') {
      addSystemMessage(`📞 我拒绝了 ${ta} 的通话`, { callType: 'rejected' });
    } else if (mode === 'calling') {
      endedRef.current = { mode, duration };
    }
  };

  return <CallPanel onHangUp={handleHangUp} />;
};

export default GlobalCallPanel;
