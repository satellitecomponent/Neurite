function updateLoadingIcon(element, percentage) {
    const loaderFill = element.querySelector('.loader-fill');
    if (!loaderFill) return;

    const cb = ()=>{ loaderFill.classList.remove('initial-animation') } ;
    Promise.delay(8000).then(cb); // after 8 secs

    // Scale from 0 to 1 based on the percentage
    const scale = percentage / 100;
    loaderFill.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

