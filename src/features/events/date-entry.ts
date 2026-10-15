const digitsOnly = (value: string) => value.replace(/\D/g, '');

// Work with digit offsets so inserting separators does not send the caret to
// the end. Deleting a separator also deletes the adjacent digit, avoiding traps.
export function editDateEntry(
  previous: string,
  raw: string,
  start: number,
  end = start,
  inputType = '',
) {
  let digits = digitsOnly(raw);
  let before = digitsOnly(raw.slice(0, start)).length;
  let after = digitsOnly(raw.slice(0, end)).length;
  if (raw.length < previous.length && digits === digitsOnly(previous)) {
    if (inputType === 'deleteContentBackward' && before > 0) {
      digits = digits.slice(0, before - 1) + digits.slice(before);
      before--;
      after = before;
    } else if (inputType === 'deleteContentForward') {
      digits = digits.slice(0, before) + digits.slice(before + 1);
      after = before;
    }
  }
  digits = digits.slice(0, 8);
  const value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter(Boolean)
    .join('/');
  const position = (offset: number) => {
    const count = Math.min(offset, digits.length);
    return count + (count > 2 ? 1 : 0) + (count > 4 ? 1 : 0);
  };
  return { value, start: position(before), end: position(after) };
}
