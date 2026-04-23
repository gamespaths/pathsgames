import { useContext } from 'react';
import { UIContext } from '../context/UIContext';

export function useUI() {
  return useContext(UIContext);
}
