export function revealInvalidEditorField(form: HTMLFormElement, reveal: (index: number) => void) {
  const fields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select'));
  for (const field of fields) {
    // A collapsed section still participates in validation; reveal it before focusing.
    if (!field.willValidate || field.validity.valid) continue;
    const section = field.closest<HTMLElement>('[data-editor-index]');
    if (section) reveal(Number(section.dataset.editorIndex));
    for (let parent = field.parentElement; parent && parent !== form; parent = parent.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    }
    setTimeout(() => {
      if (!field.isConnected) return;
      field.focus(); field.scrollIntoView?.({ block: 'center' }); field.reportValidity();
    }, 0);
    return false;
  }
  return true;
}

export function clearEditorErrors(form: HTMLFormElement) {
  for (const field of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')) {
    field.setCustomValidity(field.required && !field.value.trim() ? 'Заполни это поле' : '');
  }
}

export function focusNewEditorSection(id: string) {
  setTimeout(() => {
    const field = document.getElementById(id)?.querySelector<HTMLInputElement | HTMLTextAreaElement>('textarea,input');
    field?.focus(); field?.scrollIntoView?.({ block: 'center' });
  }, 0);
}
