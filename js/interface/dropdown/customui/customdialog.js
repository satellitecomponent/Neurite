window.prompt = async (message, defaultValue = '') => {
    Modal.open('promptModal'); // Load content into modal body

    const modalBody = Modal.div.querySelector('.modal-body');
    if (!modalBody) {
        Logger.err("Modal body not found!");
        return null;
    }

    const messageEl = modalBody.querySelector('.modal-prompt-message');
    const inputEl = modalBody.querySelector('.modal-prompt-textarea'); // This is now a textarea
    const okBtn = modalBody.querySelector('.modal-ok');
    const cancelBtn = modalBody.querySelector('.modal-cancel');

    if (!messageEl || !inputEl || !okBtn || !cancelBtn) {
        Logger.err("Missing elements in prompt modal!");
        return null;
    }

    messageEl.textContent = message;
    inputEl.value = defaultValue;
    inputEl.focus(); // Auto-focus textarea

    return new Promise((resolve) => {
        const handleOk = () => {
            Modal.close();
            resolve(inputEl.value);
            cleanup();
        };

        const handleCancel = () => {
            Modal.close();
            resolve(null);
            cleanup();
        };

        const handleKey = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                // If Enter is pressed without Shift, submit the input
                e.preventDefault(); // Prevent new line in textarea
                handleOk();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
            // If Shift+Enter is pressed, allow new lines (default behavior)
        };

        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            inputEl.removeEventListener('keydown', handleKey);
        };

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
        inputEl.addEventListener('keydown', handleKey);
    });
}
window.alert = async (message) => {
    Modal.open('alertModal');
    const modalBody = Modal.div.querySelector('.modal-body');
    const messageEl = modalBody.querySelector('.alert-message');
    const okBtn = modalBody.querySelector('.modal-ok');
    messageEl.textContent = message;

    return new Promise((resolve) => {
        okBtn.addEventListener('click', () => {
            Modal.close();
            resolve();
        }, { once: true });
    });
}
window.confirm = async (message) => {
    Modal.open('confirmModal');
    const modalBody = Modal.div.querySelector('.modal-body');
    const messageEl = modalBody.querySelector('.confirm-message');
    const okBtn = modalBody.querySelector('.modal-ok');
    const cancelBtn = modalBody.querySelector('.modal-cancel');
    messageEl.textContent = message;

    return new Promise((resolve) => {
        const cleanup = (result) => {
            Modal.close();
            resolve(result);
        };
        okBtn.addEventListener('click', () => cleanup(true), { once: true });
        cancelBtn.addEventListener('click', () => cleanup(false), { once: true });
    });
}
