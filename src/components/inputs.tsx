import type { ComponentProps } from 'react';
import { autoBigText } from '../lib/units';

type Props = Omit<ComponentProps<'input'>, 'onChange' | 'value'> & {
  value: string;
  onChange: (text: string) => void;
  unit?: string;          // для «1600 л → 1,6 л» при выходе из поля
};

/** Поле количества (десятичная клавиатура). Вышел из поля — 1600 кг само станет 1,6 кг */
export function NumInput({ value, onChange, unit, onBlur, ...rest }: Props) {
  return (
    <input
      inputMode="decimal"
      {...rest}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={e => {
        if (unit !== undefined) { const t = autoBigText(e.target.value, unit); if (t != null) onChange(t); }
        onBlur?.(e);
      }}
    />
  );
}
