'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { editDateEntry } from '../date-entry';

type Props = Omit<
  ComponentPropsWithoutRef<'input'>,
  'type' | 'inputMode' | 'value' | 'onChange' | 'maxLength'
> & { value: string; onChange: (value: string) => void };

export function DateInput({ value, onChange, ...props }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<{ start: number; end: number }>();
  useLayoutEffect(() => {
    if (selection && document.activeElement === input.current)
      input.current?.setSelectionRange(selection.start, selection.end);
  }, [value, selection]);
  return (
    <input
      {...props}
      ref={input}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(event) => {
        const node = event.currentTarget;
        const native = event.nativeEvent;
        const next = editDateEntry(
          value,
          node.value,
          node.selectionStart ?? node.value.length,
          node.selectionEnd ?? node.value.length,
          native instanceof InputEvent ? native.inputType : '',
        );
        onChange(next.value);
        setSelection({ start: next.start, end: next.end });
      }}
    />
  );
}
