function updateLoadingIcon(element, percentage) {
    const loaderFill = element.querySelector('.loader-fill');

    if (loaderFill) {
        // Set a timeout to remove the initial animation class after 8 seconds
        setTimeout(() => {
            loaderFill.classList.remove('initial-animation');
        }, 8000); // 8000 milliseconds = 8 seconds

        // Scale from 0 to 1 based on the percentage
        const scale = percentage / 100;
        loaderFill.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
}

