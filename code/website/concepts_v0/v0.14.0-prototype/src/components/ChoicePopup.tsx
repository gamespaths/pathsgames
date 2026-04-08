/* =============================================
   ChoicePopup — toast popup for "coming soon"
   ============================================= */

import { useEffect } from 'react';
import { useUI } from '../hooks/useUI';

export default function ChoicePopup() {
  const { state, dispatch } = useUI();

  useEffect(() => {
    if (state.choicePopup) {
      const timer = setTimeout(() => {
        dispatch({ type: 'HIDE_CHOICE_POPUP' });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [state.choicePopup, dispatch]);

  if (!state.choicePopup) return null;

  return (
    <div className="choice-popup">
      <i className="fas fa-scroll me-2" />
      {state.choicePopup}
    </div>
  );
}
