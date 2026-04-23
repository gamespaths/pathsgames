/* =============================================
   OptionStep — single step in the options wizard
   Shows option cards with lock overlay for disabled
   ============================================= */

import type { OptionStep as OptionStepType } from '../types';
import { useUI } from '../hooks/useUI';
import { useGame } from '../hooks/useGame';
import Card3D from './Card3D';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';

interface OptionStepProps {
  step: OptionStepType;
  onSelect: (value: string) => void;
}

export default function OptionStepComponent({ step, onSelect }: OptionStepProps) {
  const { dispatch: uiDispatch } = useUI();
  const { dispatch: gameDispatch } = useGame();

  const handleClick = (label: string, disabled: boolean) => {
    if (disabled) {
      uiDispatch({ type: 'SHOW_CHOICE_POPUP', message: `${label} — Coming Soon!` });
      return;
    }
    gameDispatch({ type: 'SET_OPTION', key: step.option, value: label });
    onSelect(label);
  };

  return (
    <div>
      <h4 className="option-step-title">
        <i className={`${step.icon} me-2`} />
        Choose {step.option}
      </h4>
      <div className="option-cards-row">
        {step.values.map((val) => (
          <Card3D
            key={val.label}
            className="card-medieval card-dimension-little flex-shrink-0 relative"
          >
            {/* Lock overlay for disabled cards */}
            {val.disabled && (
              <div className="option-lock-overlay">
                <FontAwesomeIcon icon={faLock} className="option-lock-icon" />
                <span className="option-lock-text">Coming Soon</span>
              </div>
            )}

            {/* Card content */}
            <div
              className="card-medieval-header"
              style={{ minHeight: '80px', cursor: val.disabled ? 'default' : 'pointer' }}
              onClick={() => handleClick(val.label, val.disabled)}
            >
              <i className={`${val.icon} text-3xl`} style={{ color: 'var(--color-gold-light)' }} />
            </div>
            <div className="card-medieval-title text-xs">{val.label}</div>
            <div className="card-medieval-body flex justify-center">
              {!val.disabled && (
                <button
                  className="btn-medieval w-full text-xs"
                  onClick={() => handleClick(val.label, val.disabled)}
                >
                  Select
                </button>
              )}
            </div>

          </Card3D>
        ))}
      </div>
    </div>
  );
}
