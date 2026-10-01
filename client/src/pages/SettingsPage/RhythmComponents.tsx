interface RhythmSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayValue: string;
  onChange: (v: number) => void;
}

const RhythmSlider: React.FC<RhythmSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  displayValue,
  onChange,
}) => {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm" style={{ color: 'var(--chat-setting-title)' }}>
          {label}
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--chat-accent)' }}
        >
          {displayValue}
        </span>
      </div>
      <div className="relative h-5">
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full"
          style={{ backgroundColor: 'var(--chat-setting-range-track)' }}
        />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full"
          style={{
            width: `${percent}%`,
            backgroundColor: 'var(--chat-accent)',
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="rhythm-range absolute inset-0 w-full h-full cursor-pointer"
        />
      </div>
    </div>
  );
};

interface RhythmSwitchRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const RhythmSwitchRow: React.FC<RhythmSwitchRowProps> = ({
  label,
  checked,
  onChange,
}) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/40"
    >
      <span className="text-sm" style={{ color: 'var(--chat-setting-title)' }}>
        {label}
      </span>
      <div
        className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors"
        style={{
          backgroundColor: checked ? 'var(--chat-accent)' : 'var(--chat-divider)',
        }}
      >
        <div
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? '22px' : '2px' }}
        />
      </div>
    </button>
  );
};

interface ProbabilitySliderProps {
  label: string;
  desc?: string;
  value: number;
  max?: number;
  onChange: (v: number) => void;
}

const ProbabilitySlider: React.FC<ProbabilitySliderProps> = ({
  label,
  desc,
  value,
  max = 100,
  onChange,
}) => {
  const percent = (value / max) * 100;
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between mb-2 gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm" style={{ color: 'var(--chat-setting-title)' }}>
            {label}
          </div>
          {desc && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--chat-setting-desc)' }}>
              {desc}
            </div>
          )}
        </div>
        <span
          className="text-sm font-medium flex-shrink-0"
          style={{ color: 'var(--chat-accent)' }}
        >
          {value}%
        </span>
      </div>
      <div className="relative h-5">
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full"
          style={{ backgroundColor: 'var(--chat-setting-range-track)' }}
        />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full"
          style={{
            width: `${percent}%`,
            backgroundColor: 'var(--chat-accent)',
          }}
        />
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="rhythm-range absolute inset-0 w-full h-full cursor-pointer"
        />
      </div>
    </div>
  );
};

interface ResetButtonProps {
  onClick: () => void;
}

const ResetProbabilitiesButton: React.FC<ResetButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm transition-colors active:bg-white/60"
      style={{ color: 'var(--chat-accent-dark)' }}
    >
      恢复默认概率
    </button>
  );
};

export { RhythmSlider, RhythmSwitchRow, ProbabilitySlider, ResetProbabilitiesButton };
